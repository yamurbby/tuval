import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  AppState,
  BackHandler,
  Easing,
  GestureResponderEvent,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { ClipPath, Defs, G, Image as SvgImage, Path, Rect as SvgRect } from 'react-native-svg';
import { GroupView, resolveHref } from '../../components/GroupView';
import { DetailCrop } from '../../components/DetailCrop';
import { Icon, IconName } from '../../components/Icon';
import { AppText, Button } from '../../components/ui';
import { Artwork, byline, dailyArtwork, Detail, details, getArtwork, localize, pick } from '../../content/catalog';
import { ensureImage } from '../../content/download';
import { setAmbient, stopAmbient } from '../../feedback/ambient';
import { haptic, playSound, preloadSounds } from '../../feedback/feedback';
import { generateCut, groupBox, PuzzleCut } from '../../game/cut';
import { areAdjacent, createGame, formatTime, gameReducer, isDropCorrect, pieceCount, toResult } from '../../game/engine';
import { arrangeTray, computePieceStats, toneName, TrayFilter, TraySort } from '../../game/stats';
import { boardSize, GameState } from '../../game/types';
import { useApp } from '../../state/AppContext';
import { AmbientKind, gameKey } from '../../storage/persist';
import { radius, space } from '../../theme';
import { TableGame } from './TableGame';
import { LookCard, PauseMenu, pos, Tool, usePlacedRows, WEB_NO_GESTURES, ZoomBtn } from './parts';
import {
  applyGesture,
  clampView,
  computeLayout,
  fitView,
  GameLayout,
  hitSlot,
  initialView,
  inRect,
  slotRect,
  toBoard,
  toScreen,
  View as BoardView,
} from './layout';

type Params = { puzzle?: string; pieces?: string; daily?: string; fresh?: string };

export default function GameScreen() {
  const params = useLocalSearchParams<Params>();
  const { games, settings } = useApp();
  // Düzen oyun açılırken sabitlenir; ayar oyun sırasında değişirse bir sonraki açılışta uygulanır
  const [layout] = useState(settings.layout);
  const daily = params.daily || null;
  const art = getArtwork(params.puzzle);
  const target = Number(params.pieces) || 100;

  const initial = useMemo<GameState | null>(() => {
    if (!art) return null;
    const saved = games[gameKey(art.id, target, daily)];
    if (saved && params.fresh !== '1') return saved;
    const seed = daily ? dailyArtwork(daily).seed : undefined;
    return createGame({ puzzleId: art.id, target, aspect: art.aspect, seed, daily });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!art || !initial) return <NotFound />;
  return <ImageGate art={art}>{() => (layout === 'table' ? <TableGame initial={initial} art={art} /> : <Game initial={initial} art={art} />)}</ImageGate>;
}

/** Çevrimiçi eserlerde görsel inmeden oyunu başlatma (aksi halde parçalar boş görünür). */
function ImageGate({ art, children }: { art: Artwork; children: () => React.ReactNode }) {
  const { t, theme, downloaded, markDownloaded } = useApp();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(art.bundled ? 'ready' : 'loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (art.bundled) return;
    let alive = true;
    setState('loading');
    ensureImage(art, downloaded[art.id] ? 15000 : 60000).then((ok) => {
      if (!alive) return;
      if (ok) markDownloaded([art.id]);
      setState(ok ? 'ready' : 'error');
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [art.id, attempt]);
  if (state === 'ready') return <>{children()}</>;
  return (
    <View style={[styles.center, { backgroundColor: theme.paper }]} accessibilityLiveRegion="polite">
      {state === 'loading' ? (
        <>
          <ActivityIndicator color={theme.olive} />
          <AppText color={theme.inkSoft} style={{ marginTop: space(3) }}>
            {t('game.loadingArt')}
          </AppText>
        </>
      ) : (
        <>
          <Icon name="cloud" size={32} color={theme.inkSoft} />
          <AppText variant="title" style={{ textAlign: 'center', marginTop: space(3) }}>
            {t('game.loadFailed')}
          </AppText>
          <AppText color={theme.inkSoft} style={{ marginTop: space(2), textAlign: 'center' }}>
            {t('game.loadFailedHint')}
          </AppText>
          <Button label={t('common.retry')} onPress={() => setAttempt((a) => a + 1)} style={{ marginTop: space(6), alignSelf: 'stretch' }} testID="retry" />
          <Button kind="ghost" label={t('common.back')} onPress={() => router.back()} style={{ marginTop: space(2), alignSelf: 'stretch' }} />
        </>
      )}
    </View>
  );
}

function NotFound() {
  const { t, theme } = useApp();
  const router = useRouter();
  return (
    <View style={[styles.center, { backgroundColor: theme.paper }]}>
      <AppText variant="title" style={{ textAlign: 'center' }}>
        {t('game.notFound')}
      </AppText>
      <AppText color={theme.inkSoft} style={{ marginTop: space(2), textAlign: 'center' }}>
        {t('game.notFoundHint')}
      </AppText>
      <Button label={t('game.home')} onPress={() => router.replace('/')} style={{ marginTop: space(6) }} />
    </View>
  );
}

interface Drag {
  anchor: number;
  ids: number[];
  slot: number;
  renderScale: number;
}

/** Yerleşmiş parçaları satır satır tek yol olarak tutar; yalnızca değişen satır yeniden üretilir. */
function Game({ initial, art }: { initial: GameState; art: Artwork }) {
  const app = useApp();
  const { t, theme, settings, locale } = app;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const [state, dispatch] = useReducer(gameReducer, initial);
  const size = boardSize(art.aspect);
  const cut = useMemo(
    () => generateCut({ cols: state.cols, rows: state.rows, edgeStyle: state.edgeStyle, boardW: size.w, boardH: size.h }, state.seed),
    [state.cols, state.rows, state.edgeStyle, state.seed, size.w, size.h],
  );
  const stats = useMemo(() => computePieceStats(art.thumb, state.cols, state.rows, art.palette), [art, state.cols, state.rows]);
  const total = pieceCount(state);
  const key = gameKey(state.puzzleId, state.target, state.daily);
  const names = localize(art, locale);
  const href = resolveHref(art.image);
  const cellMin = Math.min(cut.cellW, cut.cellH);

  // --- Tepsi filtreleri
  const [filter, setFilter] = useState<TrayFilter>({ kind: 'all' });
  const [sort, setSort] = useState<TraySort>('shuffled');
  const withSub = filter.kind === 'tone' || filter.kind === 'pattern';

  const areaW = win.width - insets.left - insets.right;
  const areaH = win.height - insets.top - Math.max(insets.bottom, 6);
  const L = useMemo(() => computeLayout(areaW, areaH, withSub), [areaW, areaH, withSub]);
  const vw = L.board.w;
  const vh = L.board.h;

  const isEdge = useCallback((id: number) => cut.pieces[id].isEdge, [cut]);
  const items = useMemo(
    () => arrangeTray(state.tray, stats, isEdge, filter, sort, settings.autoEdges),
    [state.tray, stats, isEdge, filter, sort, settings.autoEdges],
  );
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / L.pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = items.slice(safePage * L.pageSize, (safePage + 1) * L.pageSize);
  useEffect(() => setPage(0), [filter, sort]);

  // --- Tahta görünümü (yakınlaştırma/kaydırma)
  const [view, setView] = useState<BoardView>(() => initialView(vw, vh, size.w, size.h, cellMin, total));
  const lastVp = useRef({ vw, vh });
  useEffect(() => {
    if (lastVp.current.vw !== vw || lastVp.current.vh !== vh) {
      lastVp.current = { vw, vh };
      setView((v) => clampView(v, vw, vh, size.w, size.h, cellMin));
    }
  }, [vw, vh, size.w, size.h, cellMin]);
  const gTx = useRef(new Animated.Value(0)).current;
  const gTy = useRef(new Animated.Value(0)).current;
  const gK = useRef(new Animated.Value(1)).current;
  const pendingReset = useRef(false);
  useLayoutEffect(() => {
    // Yeni viewBox çizildiği karede geçici dönüşümü sıfırla (titreşim olmasın)
    if (pendingReset.current) {
      pendingReset.current = false;
      gTx.setValue(0);
      gTy.setValue(0);
      gK.setValue(1);
    }
  }, [view, gTx, gTy, gK]);

  const [paused, setPaused] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selected, setSelectedState] = useState<number | null>(null);
  const [flash, setFlash] = useState<number[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<number | null>(null);

  const dragPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragScale = useRef(new Animated.Value(1)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const doneOpacity = useRef(new Animated.Value(0)).current;
  const areaRef = useRef<React.ComponentRef<typeof View>>(null);
  const areaOffset = useRef({ x: 0, y: 0 });

  const live = useRef({ state, L, pageItems, paused, drag: null as Drag | null, selected: null as number | null, settings, view, showRef });
  // drag yalnızca setDragState ile güncellenir (hareket sırasında render beklenmeden okunabilsin)
  live.current = { ...live.current, state, L, pageItems, paused, settings, view, showRef };

  // Seçim, bir sonraki dokunuşta render beklenmeden okunabilmeli
  const setSelected = (v: number | null) => {
    live.current.selected = v;
    setSelectedState(v);
  };

  useEffect(() => preloadSounds(), []);

  // --- Yakından bak: bir ayrıntının tüm parçaları yerleşince kart açılır
  const looks = useMemo(() => {
    return details(art).map((d) => {
      const ids: number[] = [];
      for (let r = 0; r < state.rows; r++)
        for (let c = 0; c < state.cols; c++) {
          const cx = (c + 0.5) / state.cols;
          const cy = (r + 0.5) / state.rows;
          if (cx >= d.rect.x && cx <= d.rect.x + d.rect.w && cy >= d.rect.y && cy <= d.rect.y + d.rect.h) ids.push(r * state.cols + c);
        }
      return { d, ids };
    });
  }, [art, state.rows, state.cols]);
  const lookDone = (ids: number[], placed: string) => ids.length > 0 && ids.every((i) => placed[i] === '1');
  const announced = useRef<Set<string> | null>(null);
  if (announced.current == null) announced.current = new Set(looks.filter((l) => lookDone(l.ids, initial.placed)).map((l) => l.d.id));
  const [look, setLook] = useState<Detail | null>(null);
  useEffect(() => {
    if (state.status !== 'playing') return;
    const fresh = looks.find((l) => !announced.current!.has(l.d.id) && lookDone(l.ids, state.placed));
    if (!fresh) return;
    announced.current!.add(fresh.d.id);
    setLook(fresh.d);
    AccessibilityInfo.announceForAccessibility?.(`${t('game.detailFound')}: ${pick(fresh.d.title, locale)}`);
  }, [state.placed, state.status, looks, locale, t]);
  useEffect(() => {
    if (!look) return;
    const id = setTimeout(() => setLook(null), 8000);
    return () => clearTimeout(id);
  }, [look]);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const prev = document.body.style.overscrollBehavior;
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overscrollBehavior = prev;
    };
  }, []);

  // --- Süre: gizli olsa da kaydedilir
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      setAppActive(s === 'active');
      if (s !== 'active') app.flushGames();
    });
    return () => sub.remove();
  }, [app]);
  useEffect(() => {
    if (paused || !appActive || state.status !== 'playing') return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      dispatch({ type: 'tick', ms: now - last });
      last = now;
    }, 1000);
    return () => clearInterval(id);
  }, [paused, appActive, state.status]);

  // --- Ortam sesi: oyun sürerken, duraklatınca ve arka planda susar
  useEffect(() => {
    if (settings.ambient === 'off' || paused || !appActive || state.status !== 'playing') {
      stopAmbient();
      return;
    }
    setAmbient(settings.ambient);
  }, [settings.ambient, paused, appActive, state.status]);
  useEffect(() => () => stopAmbient(true), []);

  // --- Otomatik kayıt ve tamamlanma
  const finished = useRef(false);
  useEffect(() => {
    if (state.status === 'playing') {
      app.upsertGame(state);
      return;
    }
    if (finished.current) return;
    finished.current = true;
    app.removeGame(key);
    const { isBest } = app.recordResult(toResult(state));
    playSound('win', settings.sound);
    haptic('win', settings.haptics);
    setView(fitView(vw, vh, size.w, size.h));
    Animated.timing(doneOpacity, { toValue: 1, duration: settings.reduceMotion ? 1 : 900, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      router.replace({
        pathname: '/complete',
        params: {
          puzzle: state.puzzleId,
          pieces: String(total),
          target: String(state.target),
          time: String(state.elapsedMs),
          moves: String(state.moves),
          best: isBest ? '1' : '0',
          daily: state.daily ?? '',
        },
      });
    }, 2200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setPaused((p) => !p);
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 1400);
    return () => clearTimeout(id);
  }, [note]);

  // --- Yardımcılar
  const itemScale = useCallback(
    (ids: number[]) => {
      const box = groupBox(cut, ids);
      const base = L.slot / (Math.max(cut.cellW, cut.cellH) * 1.4);
      // Gruplar slottan biraz taşabilir; yine de seçilebilir büyüklükte kalır
      return Math.min(base, (L.slot * 1.3) / Math.max(box.w, box.h));
    },
    [cut, L.slot],
  );

  const setDragState = (d: Drag | null) => {
    live.current.drag = d;
    setDrag(d);
  };

  const animateBack = (d: Drag) => {
    const { L: Ls, settings: S } = live.current;
    const r = slotRect(Ls, d.slot);
    const box = groupBox(cut, d.ids);
    const sc = itemScale(d.ids);
    const bw = box.w * d.renderScale;
    const bh = box.h * d.renderScale;
    const dur = S.reduceMotion ? 1 : 220;
    Animated.parallel([
      Animated.timing(dragPos, {
        toValue: { x: r.x + r.w / 2 - bw / 2, y: r.y + r.h / 2 - bh / 2 },
        duration: dur,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(dragScale, { toValue: sc / d.renderScale, duration: dur, useNativeDriver: false }),
    ]).start(() => setDragState(null));
  };

  const placeGroup = (ids: number[], anchor: number, viaDrag: Drag | null) => {
    const { view: v, settings: S, L: Ls } = live.current;
    const finish = () => {
      dispatch({ type: 'place', anchor });
      setDragState(null);
      setSelected(null);
      setFlash(ids);
      flashOpacity.setValue(1);
      Animated.timing(flashOpacity, { toValue: 0, duration: S.reduceMotion ? 1 : 700, delay: 120, useNativeDriver: true }).start(() =>
        setFlash(null),
      );
    };
    playSound('snap', S.sound);
    haptic('snap', S.haptics);
    AccessibilityInfo.announceForAccessibility?.(t('game.boardLabel', { placed: live.current.state.placedCount + ids.length, total }));
    if (!viaDrag) return finish();
    const box = groupBox(cut, ids);
    const tl = toScreen(v, box.x, box.y);
    const k = v.s / viaDrag.renderScale;
    const bw = box.w * viaDrag.renderScale;
    const bh = box.h * viaDrag.renderScale;
    // Ölçek merkezden uygulanır: hedef merkez → ölçeklenmemiş kutunun sol üstü
    const cx = Ls.board.x + tl.x + (box.w * v.s) / 2;
    const cy = Ls.board.y + tl.y + (box.h * v.s) / 2;
    const dur = S.reduceMotion ? 1 : 120;
    Animated.parallel([
      Animated.timing(dragPos, { toValue: { x: cx - bw / 2, y: cy - bh / 2 }, duration: dur, useNativeDriver: false }),
      Animated.timing(dragScale, { toValue: k, duration: dur, useNativeDriver: false }),
    ]).start(finish);
  };

  // --- Dokunma: tek responder (tepsi sürükleme, tahta kaydırma/yakınlaştırma, dokun-yerleştir)
  type Mode = 'none' | 'tray' | 'board';
  const g = useRef({
    mode: 'none' as Mode,
    start: { x: 0, y: 0, t: 0 },
    slot: null as number | null,
    moved: false,
    lift: 0,
    touches: 0,
    f0: { x: 0, y: 0 },
    d0: 1,
    k: 1,
    f: { x: 0, y: 0 },
    lastTap: 0,
    inBoard: false,
    last: { x: 0, y: 0 },
  });

  const local = (e: GestureResponderEvent) => ({
    x: e.nativeEvent.pageX - areaOffset.current.x,
    y: e.nativeEvent.pageY - areaOffset.current.y,
  });
  const touchesLocal = (e: GestureResponderEvent) =>
    (e.nativeEvent.touches?.length ? e.nativeEvent.touches : [e.nativeEvent]).map((tch) => ({
      x: tch.pageX - areaOffset.current.x - live.current.L.board.x,
      y: tch.pageY - areaOffset.current.y - live.current.L.board.y,
    }));

  const commitBoard = () => {
    const G = g.current;
    const { view: v, L: Ls } = live.current;
    if (G.k === 1 && G.f.x === G.f0.x && G.f.y === G.f0.y) return;
    const nv = clampView(applyGesture(v, G.k, G.f0, G.f), Ls.board.w, Ls.board.h, size.w, size.h, cellMin);
    pendingReset.current = true;
    live.current.view = nv;
    setView(nv);
    G.k = 1;
    G.f0 = G.f;
  };

  const startBoardBaseline = (pts: { x: number; y: number }[]) => {
    const G = g.current;
    G.touches = pts.length;
    if (pts.length >= 2) {
      G.f0 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      G.d0 = Math.max(10, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
    } else {
      G.f0 = pts[0];
      G.d0 = 1;
    }
    G.f = G.f0;
    G.k = 1;
  };

  const setGestureTransform = () => {
    const G = g.current;
    const { L: Ls } = live.current;
    const c = { x: Ls.board.w / 2, y: Ls.board.h / 2 };
    gK.setValue(G.k);
    gTx.setValue(G.f.x - c.x - G.k * (G.f0.x - c.x));
    gTy.setValue(G.f.y - c.y - G.k * (G.f0.y - c.y));
  };

  const zoomBy = (factor: number, focus?: { x: number; y: number }) => {
    const { view: v, L: Ls } = live.current;
    const f = focus ?? { x: Ls.board.w / 2, y: Ls.board.h / 2 };
    setView(clampView(applyGesture(v, factor, f, f), Ls.board.w, Ls.board.h, size.w, size.h, cellMin));
  };

  const updateDragOverlay = (p: { x: number; y: number }) => {
    const G = g.current;
    const d = live.current.drag;
    if (!d) return;
    const { L: Ls, view: v } = live.current;
    const box = groupBox(cut, d.ids);
    // Tahtada mı? Parmağa değil, parmağın üstünde duran parçanın merkezine bakılır
    const inBoard = inRect(Ls.board, p.x, p.y - G.lift);
    const display = inBoard ? v.s : itemScale(d.ids) * 1.15;
    if (inBoard !== G.inBoard) {
      G.inBoard = inBoard;
      Animated.timing(dragScale, { toValue: display / d.renderScale, duration: live.current.settings.reduceMotion ? 1 : 120, useNativeDriver: false }).start();
    }
    const dispH = box.h * display;
    // Parça parmağın üstünde kalır; parmak altındaki alan görünür
    G.lift = Math.max(40, dispH / 2 + 26);
    const bw = box.w * d.renderScale;
    const bh = box.h * d.renderScale;
    dragPos.setValue({ x: p.x - bw / 2, y: p.y - G.lift - bh / 2 });
    if (!inBoard) {
      const s = hitSlot(Ls, p.x, p.y);
      const other = s != null ? live.current.pageItems[s] : undefined;
      const tgt = other && other[0] !== d.anchor && areAdjacent(d.ids, other, cut.cols) ? other[0] : null;
      setMergeTarget((cur) => (cur === tgt ? cur : tgt));
    } else setMergeTarget((cur) => (cur == null ? cur : null));
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (e) => {
          const Lv = live.current;
          if (Lv.paused || Lv.drag || Lv.state.status !== 'playing' || Lv.showRef) return false;
          const p = local(e);
          const s = hitSlot(Lv.L, p.x, p.y);
          if (s != null && s < Lv.pageItems.length) return true;
          return inRect(Lv.L.board, p.x, p.y);
        },
        onMoveShouldSetPanResponder: () => false,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const Lv = live.current;
          const G = g.current;
          const p = local(e);
          areaRef.current?.measureInWindow((x, y) => {
            areaOffset.current = { x, y };
          });
          G.start = { x: p.x, y: p.y, t: Date.now() };
          G.last = p;
          G.moved = false;
          G.inBoard = false;
          const s = hitSlot(Lv.L, p.x, p.y);
          if (s != null && s < Lv.pageItems.length && !inRect(Lv.L.board, p.x, p.y)) {
            G.mode = 'tray';
            G.slot = s;
          } else {
            G.mode = 'board';
            G.slot = null;
            startBoardBaseline(touchesLocal(e));
          }
        },
        onPanResponderMove: (e, gs) => {
          const Lv = live.current;
          const G = g.current;
          const p = local(e);
          G.last = p;
          if (G.mode === 'tray' && G.slot != null) {
            if (!G.moved) {
              if (Math.hypot(gs.dx, gs.dy) < 6) return;
              G.moved = true;
              G.lift = 40;
              const ids = Lv.pageItems[G.slot];
              const renderScale = Math.max(Lv.view.s, itemScale(ids) * 1.15);
              const box = groupBox(cut, ids);
              const r = slotRect(Lv.L, G.slot);
              dragPos.setValue({ x: r.x + r.w / 2 - (box.w * renderScale) / 2, y: r.y + r.h / 2 - (box.h * renderScale) / 2 });
              dragScale.setValue(itemScale(ids) / renderScale);
              Animated.timing(dragScale, { toValue: (itemScale(ids) * 1.15) / renderScale, duration: 90, useNativeDriver: false }).start();
              setDragState({ anchor: ids[0], ids, slot: G.slot, renderScale });
              setSelected(null);
              haptic('pick', Lv.settings.haptics);
            }
            updateDragOverlay(p);
            return;
          }
          if (G.mode === 'board') {
            const pts = touchesLocal(e);
            if (pts.length !== G.touches) {
              commitBoard();
              startBoardBaseline(pts);
              return;
            }
            if (!G.moved && Math.hypot(gs.dx, gs.dy) < 6 && pts.length < 2) return;
            G.moved = true;
            if (pts.length >= 2) {
              const f = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
              const d = Math.max(10, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
              G.k = Math.min(6, Math.max(0.25, d / G.d0));
              G.f = f;
            } else {
              G.k = 1;
              G.f = pts[0];
            }
            setGestureTransform();
          }
        },
        onPanResponderRelease: () => {
          const Lv = live.current;
          const G = g.current;
          // Bırakma olayındaki koordinatlar bazı platformlarda boş gelir: son hareket noktası kullanılır
          const p = G.last;
          if (G.mode === 'tray' && G.slot != null) {
            const d = Lv.drag;
            if (G.moved && d) {
              setMergeTarget(null);
              const cx = p.x;
              const cy = p.y - G.lift;
              if (inRect(Lv.L.board, cx, cy)) {
                const b = toBoard(Lv.view, cx - Lv.L.board.x, cy - Lv.L.board.y);
                const box = groupBox(cut, d.ids);
                if (isDropCorrect(box, b.x, b.y, { w: cut.cellW, h: cut.cellH }, Lv.view.s)) {
                  placeGroup(d.ids, d.anchor, d);
                } else {
                  // Yanlış yer: uyarı yok, parça sessizce tepsiye döner
                  dispatch({ type: 'miss' });
                  animateBack(d);
                }
                return;
              }
              const s = hitSlot(Lv.L, p.x, p.y);
              const other = s != null ? Lv.pageItems[s] : undefined;
              if (other && other[0] !== d.anchor && areAdjacent(d.ids, other, cut.cols)) {
                dispatch({ type: 'merge', from: d.anchor, into: other[0] });
                playSound('merge', Lv.settings.sound);
                haptic('merge', Lv.settings.haptics);
                setNote(t('game.merged'));
                setDragState(null);
                return;
              }
              animateBack(d);
              return;
            }
            const ids = Lv.pageItems[G.slot];
            const next = Lv.selected === ids[0] ? null : ids[0];
            setSelected(next);
            if (next != null) {
              haptic('pick', Lv.settings.haptics);
              AccessibilityInfo.announceForAccessibility?.(t('game.selected'));
            }
            return;
          }
          if (G.mode === 'board') {
            const wasTap = !G.moved && Date.now() - G.start.t < 320;
            commitBoard();
            if (!wasTap) return;
            const sp = { x: p.x - Lv.L.board.x, y: p.y - Lv.L.board.y };
            const b = toBoard(Lv.view, sp.x, sp.y);
            if (Lv.selected != null) {
              const ids = Lv.state.tray.find((gr) => gr[0] === Lv.selected);
              if (!ids) return setSelected(null);
              const a = cut.pieces[ids[0]];
              const ok = Math.floor(b.x / cut.cellW) === a.col && Math.floor(b.y / cut.cellH) === a.row;
              if (ok) placeGroup(ids, ids[0], null);
              else dispatch({ type: 'miss' });
              return;
            }
            const now = Date.now();
            if (now - G.lastTap < 320) {
              G.lastTap = 0;
              zoomBy(2, sp); // çift dokunma: yakınlaştır
            } else G.lastTap = now;
          }
        },
        onPanResponderTerminate: () => {
          const G = g.current;
          if (G.mode === 'board') commitBoard();
          if (G.mode === 'tray' && live.current.drag) animateBack(live.current.drag);
          setMergeTarget(null);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cut, itemScale, size.w, size.h, cellMin],
  );

  const placedRows = usePlacedRows(cut, state.placed);
  // Web'de uçtan uca testler için salt-okunur durum özeti (yerel uygulamada yok)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    (window as any).__parca = { view, L, cols: cut.cols, rows: cut.rows, cellW: cut.cellW, cellH: cut.cellH, pad: cut.pad, placed: state.placedCount, tray: state.tray.length, pageItems, moves: state.moves };
  }
  const done = state.status === 'complete';
  const s = view.s;
  const px = 1 / s;
  const viewBox = `${view.x0} ${view.y0} ${vw / s} ${vh / s}`;
  const sortLabel = sort === 'shuffled' ? t('game.sortShuffled') : sort === 'color' ? t('game.sortColor') : t('game.sortLight');
  const groupCount = useMemo(() => state.tray.filter((x) => x.length > 1).length, [state.tray]);

  const onRestart = () => {
    finished.current = false;
    dispatch({ type: 'restart', seed: Date.now() >>> 0 });
    setPage(0);
    setSelected(null);
    setPaused(false);
    doneOpacity.setValue(0);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.paper, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
      <View
        ref={areaRef}
        style={[{ width: areaW, height: areaH, overflow: 'hidden' }, WEB_NO_GESTURES]}
        onLayout={() => areaRef.current?.measureInWindow((x, y) => (areaOffset.current = { x, y }))}
        {...responder.panHandlers}
      >
        {/* Başlık */}
        <View style={[styles.header, pos(L.header)]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText serif italic numberOfLines={1} style={{ fontSize: 18 * theme.fontScale, lineHeight: 22 * theme.fontScale }}>
              {names.title}
            </AppText>
            <AppText variant="tiny" color={theme.inkSoft} numberOfLines={1} testID="progress">
              {art.artist} · {state.placedCount}/{total}
            </AppText>
          </View>
          {settings.showTimer ? (
            <View style={styles.timer} accessible accessibilityLabel={formatTime(state.elapsedMs)}>
              <Icon name="clock" size={16} color={theme.inkSoft} />
              <AppText variant="small" color={theme.inkSoft} style={{ fontVariant: ['tabular-nums'] }}>
                {formatTime(state.elapsedMs)}
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Tahta görünüm alanı */}
        <View
          accessible
          accessibilityLabel={t('game.boardLabel', { placed: state.placedCount, total })}
          testID="board"
          style={[pos(L.board), { overflow: 'hidden', backgroundColor: theme.paperDeep }]}
        >
          <Animated.View style={{ width: vw, height: vh, transform: [{ translateX: gTx }, { translateY: gTy }, { scale: gK }] }}>
            <Svg width={vw} height={vh} viewBox={viewBox}>
              <Defs>
                <ClipPath id="placed">
                  {placedRows.map((r) => (
                    <Path key={r.key} d={r.d} />
                  ))}
                </ClipPath>
              </Defs>
              <SvgRect x={-3 * px} y={-2 * px} width={size.w + 6 * px} height={size.h + 6 * px} fill="rgba(20,24,30,0.10)" />
              <SvgRect x={0} y={0} width={size.w} height={size.h} fill={theme.boardBg} />
              {settings.guide ? (
                <SvgImage href={href} x={0} y={0} width={size.w} height={size.h} opacity={0.16} preserveAspectRatio="none" />
              ) : null}
              {settings.seams && !done ? (
                <Path d={cut.seams} fill="none" stroke={theme.highContrast ? (theme.isDark ? '#BBB' : '#444') : theme.isDark ? 'rgba(236,230,218,0.16)' : 'rgba(30,39,51,0.2)'} strokeWidth={0.8 * px} />
              ) : null}
              {placedRows.length ? (
                <G clipPath="url(#placed)">
                  <SvgImage href={href} x={0} y={0} width={size.w} height={size.h} preserveAspectRatio="none" />
                </G>
              ) : null}
              <SvgRect x={0} y={0} width={size.w} height={size.h} fill="none" stroke={theme.isDark ? 'rgba(236,230,218,0.3)' : 'rgba(30,39,51,0.35)'} strokeWidth={px} />
            </Svg>
            {flash ? (
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: flashOpacity }]}>
                <Svg width={vw} height={vh} viewBox={viewBox}>
                  {flash.map((id) => (
                    <Path key={id} d={cut.pieces[id].path} fill="rgba(251,248,242,0.25)" stroke="#FBF8F2" strokeWidth={1.6 * px} />
                  ))}
                </Svg>
              </Animated.View>
            ) : null}
            {done ? (
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: doneOpacity }]}>
                <Svg width={vw} height={vh} viewBox={viewBox}>
                  <SvgImage href={href} x={0} y={0} width={size.w} height={size.h} preserveAspectRatio="none" />
                </Svg>
              </Animated.View>
            ) : null}
          </Animated.View>

          {/* Yakınlaştırma: sağ altta, başparmağa yakın */}
          {!done ? (
            <View style={[styles.zoom, { backgroundColor: theme.glass, borderColor: theme.rule }]}>
              <ZoomBtn icon="plus" label={t('game.zoomIn')} onPress={() => zoomBy(1.6)} testID="zoom-in" />
              <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: theme.rule }} />
              <ZoomBtn icon="minus" label={t('game.zoomOut')} onPress={() => zoomBy(1 / 1.6)} testID="zoom-out" />
              <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: theme.rule }} />
              <ZoomBtn icon="fit" label={t('game.fit')} onPress={() => setView(fitView(vw, vh, size.w, size.h))} testID="zoom-fit" />
            </View>
          ) : null}

          {showRef ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={() => setShowRef(false)}
              style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim, padding: space(3) }]}
              testID="ref-close"
            >
              <Image source={art.image} style={{ flex: 1, width: '100%' }} resizeMode="contain" />
              <AppText variant="tiny" color={theme.inkSoft} style={{ textAlign: 'center', marginTop: 6 }} numberOfLines={1}>
                {names.title} — {byline(art, names)}
              </AppText>
            </Pressable>
          ) : null}
          {look && !showRef ? (
            <LookCard
              art={art}
              d={look}
              onClose={() => setLook(null)}
              onZoom={() => {
                const r = look.rect;
                const bw = r.w * size.w;
                const bh = r.h * size.h;
                const sNew = 0.82 * Math.min((vw - 24) / bw, (vh - 24) / bh);
                const cx = (r.x + r.w / 2) * size.w;
                const cy = (r.y + r.h / 2) * size.h;
                setView(clampView({ s: sNew, x0: cx - vw / (2 * sNew), y0: cy - vh / (2 * sNew) }, vw, vh, size.w, size.h, cellMin));
                setLook(null);
              }}
            />
          ) : null}
        </View>

        {/* Tepsi */}
        <FilterBar L={L} filter={filter} setFilter={setFilter} groups={groupCount} />
        {L.sub && filter.kind === 'tone' ? (
          <View style={[pos(L.sub), styles.subRow]}>
            {art.palette.map((hex, i) => {
              const active = filter.tone === i;
              return (
                <Pressable
                  key={hex}
                  testID={`tone-${i}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t('game.toneLabel', { name: toneName(hex, locale === 'tr' ? 'tr' : 'en') })}
                  onPress={() => setFilter({ kind: 'tone', tone: i })}
                  style={[styles.swatchWrap, { borderColor: active ? theme.ink : 'transparent' }]}
                >
                  <View style={[styles.swatch, { backgroundColor: hex, borderColor: theme.rule }]} />
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {L.sub && filter.kind === 'pattern' ? (
          <View style={[pos(L.sub), styles.subRow]}>
            {[false, true].map((busy) => {
              const active = !!filter.busy === busy;
              return (
                <Pressable
                  key={String(busy)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setFilter({ kind: 'pattern', busy })}
                  style={[styles.textChip, { borderColor: active ? theme.ink : theme.rule, backgroundColor: active ? theme.ink : 'transparent' }]}
                >
                  <AppText variant="small" color={active ? theme.paper : theme.ink}>
                    {busy ? t('game.busy') : t('game.plain')}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View pointerEvents="none" style={[pos(L.grid), { backgroundColor: theme.paperDeep, borderRadius: radius.sm }]} />
        {pageItems.length === 0 ? (
          <View pointerEvents="none" style={[pos(L.grid), styles.center]}>
            <AppText variant="small" color={theme.inkSoft}>
              {state.tray.length ? t('game.emptyFilter') : t('game.trayEmpty')}
            </AppText>
          </View>
        ) : null}
        {pageItems.map((ids, i) => {
          const r = slotRect(L, i);
          const sc = itemScale(ids);
          const box = groupBox(cut, ids);
          const w = box.w * sc;
          const h = box.h * sc;
          const anchor = ids[0];
          const hidden = drag?.anchor === anchor;
          const isSel = selected === anchor;
          return (
            <View
              key={anchor}
              accessible
              accessibilityRole="button"
              accessibilityLabel={ids.length > 1 ? t('game.groupLabel', { n: ids.length }) : t('game.pieceLabel', { n: anchor + 1 })}
              accessibilityHint={t('game.pieceHint')}
              accessibilityState={{ selected: isSel }}
              accessibilityActions={[{ name: 'activate' }]}
              onAccessibilityAction={() => setSelected(isSel ? null : anchor)}
              pointerEvents="none"
              style={{ position: 'absolute', left: r.x + r.w / 2 - w / 2, top: r.y + r.h / 2 - h / 2, opacity: hidden ? 0 : 1 }}
            >
              <GroupView cut={cut} ids={ids} source={art.image} scale={sc} selected={isSel} ink={theme.ink} />
              {ids.length > 1 ? (
                <View style={[styles.countTag, { backgroundColor: theme.ink }]}>
                  <AppText variant="tiny" color={theme.paper} style={{ fontSize: 10, lineHeight: 13 }}>
                    {ids.length}
                  </AppText>
                </View>
              ) : null}
              {mergeTarget === anchor ? (
                <View style={[StyleSheet.absoluteFill, { borderWidth: 1.5, borderColor: theme.ink, borderStyle: 'dashed', borderRadius: 4 }]} />
              ) : null}
            </View>
          );
        })}

        <View style={[pos(L.pager), styles.pager]}>
          <PagerBtn icon="chevronLeft" label={t('game.prevPage')} disabled={safePage === 0} onPress={() => setPage(safePage - 1)} testID="prev-page" />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <AppText variant="small" accessibilityLiveRegion="polite" style={{ fontVariant: ['tabular-nums'] }}>
              {t('game.page', { a: safePage + 1, b: pageCount })}
            </AppText>
            <AppText variant="tiny" color={theme.inkSoft} numberOfLines={1}>
              {note ?? (selected != null ? t('game.selected') : t('game.trayCount', { n: items.length }))}
            </AppText>
          </View>
          <PagerBtn icon="chevronRight" label={t('game.nextPage')} disabled={safePage >= pageCount - 1} onPress={() => setPage(safePage + 1)} testID="next-page" />
        </View>

        {/* Araç çubuğu */}
        <View style={[pos(L.toolbar), styles.toolbar, { borderTopColor: theme.rule }]}>
          <Tool icon="menu" label={t('game.menu')} onPress={() => setPaused(true)} testID="pause" />
          <Tool icon="image" label={t('game.reference')} onPress={() => setShowRef((v) => !v)} active={showRef} testID="reference" />
          <Tool icon="sort" label={sortLabel} onPress={() => setSort(sort === 'shuffled' ? 'color' : sort === 'color' ? 'light' : 'shuffled')} testID="sort" />
          <Tool icon="shuffle" label={t('game.shuffle')} onPress={() => dispatch({ type: 'shuffle', seed: Date.now() >>> 0 })} testID="shuffle" />
        </View>

        {/* Sürüklenen parça / grup */}
        {drag ? (
          <Animated.View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, top: 0, transform: [{ translateX: dragPos.x }, { translateY: dragPos.y }, { scale: dragScale }] }}
          >
            <GroupView cut={cut} ids={drag.ids} source={art.image} scale={drag.renderScale} lifted />
          </Animated.View>
        ) : null}
      </View>

      {paused ? (
        <PauseMenu
          onResume={() => setPaused(false)}
          onRestart={onRestart}
          onHome={() => {
            app.flushGames();
            router.dismissAll?.();
            router.replace('/');
          }}
        />
      ) : null}
    </View>
  );
}


function FilterBar({ L, filter, setFilter, groups }: { L: GameLayout; filter: TrayFilter; setFilter: (f: TrayFilter) => void; groups: number }) {
  const { t, theme } = useApp();
  const opts: { kind: TrayFilter['kind']; label: string }[] = [
    { kind: 'all', label: t('game.all') },
    { kind: 'edges', label: t('game.edges') },
    { kind: 'groups', label: groups ? `${t('game.groups')} ${groups}` : t('game.groups') },
    { kind: 'tone', label: t('game.tone') },
    { kind: 'pattern', label: t('game.pattern') },
  ];
  return (
    <View style={[pos(L.filters), styles.filters, { borderBottomColor: theme.rule }]} accessibilityRole="tablist">
      {opts.map((o) => {
        const active = filter.kind === o.kind;
        return (
          <Pressable
            key={o.kind}
            testID={`filter-${o.kind}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() =>
              setFilter(o.kind === 'tone' ? { kind: 'tone', tone: 0 } : o.kind === 'pattern' ? { kind: 'pattern', busy: false } : { kind: o.kind })
            }
            style={styles.filterBtn}
          >
            <AppText variant="small" weight={active ? '600' : '400'} color={active ? theme.ink : theme.inkSoft} numberOfLines={1}>
              {o.label}
            </AppText>
            <View style={{ height: 2, alignSelf: 'stretch', marginTop: 6, backgroundColor: active ? theme.tile : 'transparent' }} />
          </Pressable>
        );
      })}
    </View>
  );
}

function PagerBtn({ icon, label, onPress, disabled, testID }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  const { theme } = useApp();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.pagerBtn, { borderColor: theme.rule, opacity: disabled ? 0.3 : 1, backgroundColor: pressed ? theme.paperDeep : 'transparent' }]}
    >
      <Icon name={icon} size={22} color={theme.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(6) },
  header: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  zoom: { position: 'absolute', right: 10, bottom: 10, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  zoomBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  filterBtn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minHeight: 44, paddingHorizontal: 2 },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(2) },
  swatchWrap: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth * 2 },
  textChip: { paddingHorizontal: space(4), minHeight: 36, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  countTag: { position: 'absolute', right: -2, top: -2, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  pager: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  pagerBtn: { width: 56, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth * 2, gap: space(1) },
  tool: { flex: 1, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 2 },
  look: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(2.5),
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  overlay: { alignItems: 'center', justifyContent: 'flex-end', padding: space(4) },
  sheet: { width: '100%', maxWidth: 420, borderRadius: radius.md, padding: space(5), gap: space(2.5), alignItems: 'center' },
});
