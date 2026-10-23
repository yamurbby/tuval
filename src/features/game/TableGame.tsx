// Masa düzeni: tahta ortada, parçalar çevresine dağılmış. Parçalar masada serbestçe taşınır,
// komşusunun yanına bırakılınca birleşir, doğru yere yakın bırakılınca tahtaya oturur.
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, GestureResponderEvent, Image, PanResponder, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { ClipPath, Defs, G, Image as SvgImage, Path, Rect as SvgRect } from 'react-native-svg';
import { GroupView, resolveHref } from '../../components/GroupView';
import { AppText } from '../../components/ui';
import { Artwork, byline, localize } from '../../content/catalog';
import { haptic, playSound } from '../../feedback/feedback';
import { generateCut, groupBox, PuzzleCut } from '../../game/cut';
import { areAdjacent, formatTime, gameReducer, pieceCount } from '../../game/engine';
import { boardSize, GameState } from '../../game/types';
import { useApp } from '../../state/AppContext';
import { space } from '../../theme';
import { Icon } from '../../components/Icon';
import { applyGesture, toBoard, toScreen, View as BoardView } from './layout';
import { LookCard, PauseMenu, pos, Tool, useGameShell, usePlacedRows, WEB_NO_GESTURES, ZoomBtn } from './parts';

const HEADER_H = 52;
const TOOLBAR_H = 60;
/** Parça tutulunca parmağın ne kadar üstünde durur (px) */
const LIFT = 26;

type Offsets = Record<string, [number, number]>;

interface World {
  x: number;
  y: number;
  w: number;
  h: number;
}

function worldBounds(cut: PuzzleCut, tray: number[][], table: Offsets | undefined): World {
  let x0 = -cut.cellW * 0.6;
  let y0 = -cut.cellH * 0.6;
  let x1 = cut.boardW + cut.cellW * 0.6;
  let y1 = cut.boardH + cut.cellH * 0.6;
  if (table)
    for (const g of tray) {
      const o = table[g[0]];
      if (!o) continue;
      const b = groupBox(cut, g);
      x0 = Math.min(x0, b.x + o[0]);
      y0 = Math.min(y0, b.y + o[1]);
      x1 = Math.max(x1, b.x + b.w + o[0]);
      y1 = Math.max(y1, b.y + b.h + o[1]);
    }
  const m = Math.min(cut.cellW, cut.cellH) * 0.4;
  return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
}

function fitWorld(w: World, vw: number, vh: number): BoardView {
  const s = Math.min(vw / w.w, vh / w.h) * 0.97;
  return { s, x0: w.x + w.w / 2 - vw / (2 * s), y0: w.y + w.h / 2 - vh / (2 * s) };
}

function clampWorld(v: BoardView, w: World, vw: number, vh: number, cell: number): BoardView {
  const fit = Math.min(vw / w.w, vh / w.h) * 0.97;
  const s = Math.min(Math.max(fit * 1.5, 140 / cell), Math.max(fit * 0.8, v.s));
  // Görünüm alanının ortası masanın içinde kalsın
  const cx = Math.min(w.x + w.w, Math.max(w.x, v.x0 + vw / (2 * s)));
  const cy = Math.min(w.y + w.h, Math.max(w.y, v.y0 + vh / (2 * s)));
  return { s, x0: cx - vw / (2 * s), y0: cy - vh / (2 * s) };
}

/** Masadaki gevşek parçalar — sürüklenen grup hariç. Yalnızca durum değişince yeniden çizilir. */
const LooseLayer = React.memo(function LooseLayer({
  cut,
  tray,
  table,
  hidden,
  selected,
  href,
  shadows,
  selColor,
  edge,
  shadowColor,
}: {
  cut: PuzzleCut;
  tray: number[][];
  table: Offsets;
  hidden: number | null;
  selected: number | null;
  href: any;
  shadows: boolean;
  selColor: string;
  edge: string;
  shadowColor: string;
}) {
  const sw = Math.min(cut.cellW, cut.cellH) * 0.014;
  const sh = Math.min(cut.cellW, cut.cellH) * 0.035;
  return (
    <>
      {tray.map((g) => {
        const k = g[0];
        const o = table[k];
        if (!o || k === hidden) return null;
        const d = g.map((id) => cut.pieces[id].path).join(' ');
        const isSel = selected === k;
        return (
          <G key={k} transform={`translate(${o[0]} ${o[1]})`}>
            <Defs>
              <ClipPath id={`t${k}`}>
                <Path d={d} />
              </ClipPath>
            </Defs>
            {shadows ? <Path d={d} fill={shadowColor} transform={`translate(${sh} ${sh * 1.4})`} /> : null}
            <G clipPath={`url(#t${k})`}>
              <SvgImage href={href} x={0} y={0} width={cut.boardW} height={cut.boardH} preserveAspectRatio="none" />
            </G>
            <Path
              d={d}
              fill="none"
              stroke={isSel ? selColor : edge}
              strokeWidth={isSel ? sw * 3 : sw}
              strokeDasharray={isSel ? `${sw * 8} ${sw * 5}` : undefined}
            />
          </G>
        );
      })}
    </>
  );
});

interface Drag {
  anchor: number;
  ids: number[];
  /** dokunma noktası ile grubun ekrandaki sol üstü arasındaki fark */
  grab: { x: number; y: number };
}

export function TableGame({ initial, art }: { initial: GameState; art: Artwork }) {
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
  const total = pieceCount(state);
  const names = localize(art, locale);
  const href = resolveHref(art.image);
  const cell = Math.min(cut.cellW, cut.cellH);

  const areaW = win.width - insets.left - insets.right;
  const areaH = win.height - insets.top - Math.max(insets.bottom, 6);
  const vp = { x: 0, y: HEADER_H, w: areaW, h: Math.max(200, areaH - HEADER_H - TOOLBAR_H) };
  const toolbar = { x: space(2), y: vp.y + vp.h, w: areaW - space(4), h: TOOLBAR_H };

  // Masa dizilimi yoksa (yeni oyun / tepsi düzeninden gelen kayıt) oluştur
  const needsArrange = !state.table || state.tray.some((g) => !state.table![g[0]]);
  useEffect(() => {
    if (needsArrange && state.status === 'playing')
      dispatch({ type: 'tableArrange', aspect: vp.w / vp.h, seed: state.seed, onlyMissing: !!state.table });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsArrange]);

  const table = state.table ?? {};
  const world = useMemo(() => worldBounds(cut, state.tray, state.table), [cut, state.tray, state.table]);

  // --- Görünüm
  const [view, setView] = useState<BoardView>(() => {
    const w = worldBounds(cut, initial.tray, initial.table);
    const f = fitWorld(w, vp.w, vp.h);
    return f;
  });
  const fitted = useRef(!!initial.table);
  useEffect(() => {
    // İlk dizilim yapıldığında tüm masayı göster; parçalar çok küçük kalıyorsa tahtaya yakınlaş
    if (fitted.current || !state.table) return;
    fitted.current = true;
    const f = fitWorld(world, vp.w, vp.h);
    if (f.s * cell >= 14) setView(f);
    else {
      const s = 20 / cell;
      setView(clampWorld({ s, x0: -cut.cellW * 3, y0: cut.boardH / 2 - vp.h / (2 * s) }, world, vp.w, vp.h, cell));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.table]);

  const gTx = useRef(new Animated.Value(0)).current;
  const gTy = useRef(new Animated.Value(0)).current;
  const gK = useRef(new Animated.Value(1)).current;
  const pendingReset = useRef(false);
  useLayoutEffect(() => {
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
  const dragPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const doneOpacity = useRef(new Animated.Value(0)).current;
  const areaRef = useRef<React.ComponentRef<typeof View>>(null);
  const areaOffset = useRef({ x: 0, y: 0 });

  const live = useRef({ state, view, world, paused, showRef, settings, drag: null as Drag | null, selected: null as number | null });
  live.current = { ...live.current, state, view, world, paused, showRef, settings };
  const setSelected = (v: number | null) => {
    live.current.selected = v;
    setSelectedState(v);
  };
  const setDragState = (d: Drag | null) => {
    live.current.drag = d;
    setDrag(d);
  };

  const { look, setLook, restart } = useGameShell({
    art,
    initialPlaced: initial.placed,
    state,
    dispatch,
    paused,
    setPaused,
    onComplete: () => {
      setView(fitWorld({ x: 0, y: 0, w: cut.boardW, h: cut.boardH }, vp.w, vp.h));
      Animated.timing(doneOpacity, { toValue: 1, duration: settings.reduceMotion ? 1 : 900, useNativeDriver: true }).start();
    },
  });

  // id -> grup çapası (isabet testi için)
  const owner = useMemo(() => {
    const m = new Int32Array(total).fill(-1);
    for (const g of state.tray) for (const id of g) m[id] = g[0];
    return m;
  }, [state.tray, total]);
  const liveOwner = useRef(owner);
  liveOwner.current = owner;

  /** Ekran noktasının (görünüm alanına göre) altındaki en üstteki grup */
  const hitGroup = (sx: number, sy: number): number[] | null => {
    const { view: v, state: S } = live.current;
    const tb = S.table ?? {};
    const w = toBoard(v, sx, sy);
    const probes = [
      [0, 0],
      [0.2, 0],
      [-0.2, 0],
      [0, 0.2],
      [0, -0.2],
    ];
    for (let i = S.tray.length - 1; i >= 0; i--) {
      const g = S.tray[i];
      const o = tb[g[0]];
      if (!o) continue;
      for (const [px, py] of probes) {
        const lx = w.x - o[0] + px * cut.cellW;
        const ly = w.y - o[1] + py * cut.cellH;
        const c = Math.floor(lx / cut.cellW);
        const r = Math.floor(ly / cut.cellH);
        if (c < 0 || r < 0 || c >= cut.cols || r >= cut.rows) continue;
        if (liveOwner.current[r * cut.cols + c] === g[0]) return g;
      }
    }
    return null;
  };

  const snapTol = (s: number) => Math.min(cell * 0.45, Math.max(cell * 0.22, 14 / Math.max(s, 0.0001)));

  const placeGroup = (ids: number[], anchor: number) => {
    const S = live.current.settings;
    dispatch({ type: 'place', anchor });
    setSelected(null);
    setFlash(ids);
    flashOpacity.setValue(1);
    Animated.timing(flashOpacity, { toValue: 0, duration: S.reduceMotion ? 1 : 700, delay: 120, useNativeDriver: true }).start(() => setFlash(null));
    playSound('snap', S.sound);
    haptic('snap', S.haptics);
    AccessibilityInfo.announceForAccessibility?.(t('game.boardLabel', { placed: live.current.state.placedCount + ids.length, total }));
  };

  /** Grubu masada (dx,dy) kaymasına bırak: tahtaya oturt, komşuyla birleştir ya da sadece taşı */
  const dropGroup = (ids: number[], anchor: number, dx: number, dy: number) => {
    const { view: v, state: S, settings: St } = live.current;
    const tol = snapTol(v.s);
    if (Math.hypot(dx, dy) <= tol) return placeGroup(ids, anchor);
    const tb = S.table ?? {};
    for (const g of S.tray) {
      if (g[0] === anchor) continue;
      const o = tb[g[0]];
      if (!o || Math.hypot(o[0] - dx, o[1] - dy) > tol) continue;
      if (!areAdjacent(ids, g, cut.cols)) continue;
      dispatch({ type: 'tableJoin', from: anchor, into: g[0] });
      playSound('merge', St.sound);
      haptic('merge', St.haptics);
      // Birleşen grup doğru yere de yakınsa (komşusu yerindeyse zaten yerleşmiş olurdu) — taşıma yeterli
      return;
    }
    dispatch({ type: 'tableMove', anchor, dx, dy });
  };

  // --- Dokunma
  type Mode = 'none' | 'piece' | 'pan';
  const g = useRef({
    mode: 'none' as Mode,
    group: null as number[] | null,
    start: { x: 0, y: 0, t: 0 },
    moved: false,
    touches: 0,
    f0: { x: 0, y: 0 },
    d0: 1,
    k: 1,
    f: { x: 0, y: 0 },
    last: { x: 0, y: 0 },
    lastTap: 0,
  });

  const local = (e: GestureResponderEvent) => ({ x: e.nativeEvent.pageX - areaOffset.current.x, y: e.nativeEvent.pageY - areaOffset.current.y });
  const touchesVp = (e: GestureResponderEvent) =>
    (e.nativeEvent.touches?.length ? e.nativeEvent.touches : [e.nativeEvent]).map((tch) => ({
      x: tch.pageX - areaOffset.current.x - vp.x,
      y: tch.pageY - areaOffset.current.y - vp.y,
    }));
  const inVp = (p: { x: number; y: number }) => p.x >= vp.x && p.x <= vp.x + vp.w && p.y >= vp.y && p.y <= vp.y + vp.h;

  const commitPan = () => {
    const G = g.current;
    const { view: v, world: w } = live.current;
    if (G.k === 1 && G.f.x === G.f0.x && G.f.y === G.f0.y) return;
    const nv = clampWorld(applyGesture(v, G.k, G.f0, G.f), w, vp.w, vp.h, cell);
    pendingReset.current = true;
    live.current.view = nv;
    setView(nv);
    G.k = 1;
    G.f0 = G.f;
  };
  const baseline = (pts: { x: number; y: number }[]) => {
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
  const gestureTransform = () => {
    const G = g.current;
    const c = { x: vp.w / 2, y: vp.h / 2 };
    gK.setValue(G.k);
    gTx.setValue(G.f.x - c.x - G.k * (G.f0.x - c.x));
    gTy.setValue(G.f.y - c.y - G.k * (G.f0.y - c.y));
  };
  const zoomBy = useCallback(
    (factor: number, focus?: { x: number; y: number }) => {
      const { view: v, world: w } = live.current;
      const f = focus ?? { x: vp.w / 2, y: vp.h / 2 };
      setView(clampWorld(applyGesture(v, factor, f, f), w, vp.w, vp.h, cell));
    },
    [vp.w, vp.h, cell],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (e) => {
          const Lv = live.current;
          if (Lv.paused || Lv.drag || Lv.state.status !== 'playing' || Lv.showRef) return false;
          return inVp(local(e));
        },
        onMoveShouldSetPanResponder: () => false,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const G = g.current;
          const p = local(e);
          areaRef.current?.measureInWindow((x, y) => {
            areaOffset.current = { x, y };
          });
          G.start = { x: p.x, y: p.y, t: Date.now() };
          G.last = p;
          G.moved = false;
          const pts = touchesVp(e);
          const hit = pts.length === 1 ? hitGroup(p.x - vp.x, p.y - vp.y) : null;
          if (hit) {
            G.mode = 'piece';
            G.group = hit;
          } else {
            G.mode = 'pan';
            G.group = null;
            baseline(pts);
          }
        },
        onPanResponderMove: (e, gs) => {
          const Lv = live.current;
          const G = g.current;
          const p = local(e);
          G.last = p;
          if (G.mode === 'piece' && G.group) {
            const pts = touchesVp(e);
            if (!G.moved && pts.length >= 2) {
              // İkinci parmak geldi: parça yerine görünüm hareketi
              G.mode = 'pan';
              baseline(pts);
              return;
            }
            if (!G.moved) {
              if (Math.hypot(gs.dx, gs.dy) < 6) return;
              G.moved = true;
              const ids = G.group;
              const o = (Lv.state.table ?? {})[ids[0]] ?? [0, 0];
              const box = groupBox(cut, ids);
              const tl = toScreen(Lv.view, box.x + o[0], box.y + o[1]);
              const grab = { x: G.start.x - (vp.x + tl.x), y: G.start.y - (vp.y + tl.y) };
              setDragState({ anchor: ids[0], ids, grab });
              setSelected(null);
              haptic('pick', Lv.settings.haptics);
            }
            const d = live.current.drag;
            if (d) dragPos.setValue({ x: p.x - d.grab.x, y: p.y - d.grab.y - LIFT });
            return;
          }
          if (G.mode === 'pan') {
            const pts = touchesVp(e);
            if (pts.length !== G.touches) {
              commitPan();
              baseline(pts);
              return;
            }
            if (!G.moved && Math.hypot(gs.dx, gs.dy) < 6 && pts.length < 2) return;
            G.moved = true;
            if (pts.length >= 2) {
              const f = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
              const dd = Math.max(10, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
              G.k = Math.min(6, Math.max(0.2, dd / G.d0));
              G.f = f;
            } else {
              G.k = 1;
              G.f = pts[0];
            }
            gestureTransform();
          }
        },
        onPanResponderRelease: () => {
          const Lv = live.current;
          const G = g.current;
          const p = G.last;
          if (G.mode === 'piece' && G.group) {
            const ids = G.group;
            const d = Lv.drag;
            if (G.moved && d) {
              // Parçanın ekrandaki sol üstü → masa koordinatı → yeni kayma
              const sx = p.x - d.grab.x - vp.x;
              const sy = p.y - d.grab.y - LIFT - vp.y;
              const w = toBoard(Lv.view, sx, sy);
              const box = groupBox(cut, ids);
              dropGroup(ids, ids[0], w.x - box.x, w.y - box.y);
              setDragState(null);
              return;
            }
            // Dokunma: seç / seçimi kaldır
            const next = Lv.selected === ids[0] ? null : ids[0];
            setSelected(next);
            if (next != null) {
              haptic('pick', Lv.settings.haptics);
              AccessibilityInfo.announceForAccessibility?.(t('game.selected'));
            }
            return;
          }
          if (G.mode === 'pan') {
            const wasTap = !G.moved && Date.now() - G.start.t < 320;
            commitPan();
            if (!wasTap) return;
            const sp = { x: p.x - vp.x, y: p.y - vp.y };
            const b = toBoard(Lv.view, sp.x, sp.y);
            if (Lv.selected != null) {
              const ids = Lv.state.tray.find((gr) => gr[0] === Lv.selected);
              if (!ids) return setSelected(null);
              const a = cut.pieces[ids[0]];
              const inBoard = b.x >= 0 && b.y >= 0 && b.x <= cut.boardW && b.y <= cut.boardH;
              if (inBoard && Math.floor(b.x / cut.cellW) === a.col && Math.floor(b.y / cut.cellH) === a.row) placeGroup(ids, ids[0]);
              else if (inBoard) dispatch({ type: 'miss' });
              else {
                // Masada boş bir yere dokunuldu: seçili parçayı oraya taşı
                const box = groupBox(cut, ids);
                dispatch({ type: 'tableMove', anchor: ids[0], dx: b.x - (box.x + box.w / 2), dy: b.y - (box.y + box.h / 2) });
                setSelected(null);
              }
              return;
            }
            const now = Date.now();
            if (now - G.lastTap < 320) {
              G.lastTap = 0;
              zoomBy(2, sp);
            } else G.lastTap = now;
          }
        },
        onPanResponderTerminate: () => {
          const G = g.current;
          if (G.mode === 'pan') commitPan();
          if (live.current.drag) setDragState(null);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cut, cell, vp.w, vp.h, zoomBy],
  );

  const placedRows = usePlacedRows(cut, state.placed);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    (window as any).__parca = {
      mode: 'table',
      selected,
      view,
      vp,
      cols: cut.cols,
      rows: cut.rows,
      cellW: cut.cellW,
      cellH: cut.cellH,
      pad: cut.pad,
      placed: state.placedCount,
      tray: state.tray.length,
      groups: state.tray,
      table: state.table,
      moves: state.moves,
    };
  }
  const done = state.status === 'complete';
  const px = 1 / view.s;
  const viewBox = `${view.x0} ${view.y0} ${vp.w / view.s} ${vp.h / view.s}`;

  return (
    <View style={{ flex: 1, backgroundColor: theme.paper, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
      <View
        ref={areaRef}
        style={[{ width: areaW, height: areaH, overflow: 'hidden' }, WEB_NO_GESTURES]}
        onLayout={() => areaRef.current?.measureInWindow((x, y) => (areaOffset.current = { x, y }))}
        {...responder.panHandlers}
      >
        {/* Başlık */}
        <View style={[styles.header, pos({ x: space(4), y: 0, w: areaW - space(8), h: HEADER_H })]}>
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

        {/* Masa */}
        <View accessible accessibilityLabel={t('game.boardLabel', { placed: state.placedCount, total })} testID="board" style={[pos(vp), { overflow: 'hidden', backgroundColor: theme.table }]}>
          {/* Dokunmalar üstteki tek responder'da toplanır; SVG öğeleri olayı yakalamasın */}
          <Animated.View pointerEvents="none" style={{ width: vp.w, height: vp.h, transform: [{ translateX: gTx }, { translateY: gTy }, { scale: gK }] }}>
            <Svg width={vp.w} height={vp.h} viewBox={viewBox} pointerEvents="none">
              <Defs>
                <ClipPath id="placed">
                  {placedRows.map((r) => (
                    <Path key={r.key} d={r.d} />
                  ))}
                </ClipPath>
              </Defs>
              <SvgRect x={-4 * px} y={-3 * px} width={cut.boardW + 8 * px} height={cut.boardH + 8 * px} fill={theme.pieceShadow} />
              <SvgRect x={0} y={0} width={cut.boardW} height={cut.boardH} fill={theme.tableBoard} />
              {settings.guide ? <SvgImage href={href} x={0} y={0} width={cut.boardW} height={cut.boardH} opacity={0.14} preserveAspectRatio="none" /> : null}
              {settings.seams && !done ? <Path d={cut.seams} fill="none" stroke={theme.tableLine} strokeWidth={0.8 * px} /> : null}
              {placedRows.length ? (
                <G clipPath="url(#placed)">
                  <SvgImage href={href} x={0} y={0} width={cut.boardW} height={cut.boardH} preserveAspectRatio="none" />
                </G>
              ) : null}
              <SvgRect x={0} y={0} width={cut.boardW} height={cut.boardH} fill="none" stroke={theme.tableLine} strokeWidth={px} />
              {!done && state.table ? (
                <LooseLayer
                  cut={cut}
                  tray={state.tray}
                  table={table}
                  hidden={drag?.anchor ?? null}
                  selected={selected}
                  href={href}
                  shadows={total <= 520}
                  selColor={theme.ink}
                  edge={theme.pieceEdge}
                  shadowColor={theme.pieceShadow}
                />
              ) : null}
            </Svg>
            {flash ? (
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: flashOpacity }]}>
                <Svg width={vp.w} height={vp.h} viewBox={viewBox}>
                  {flash.map((id) => (
                    <Path key={id} d={cut.pieces[id].path} fill="rgba(251,248,242,0.25)" stroke="#FBF8F2" strokeWidth={1.6 * px} />
                  ))}
                </Svg>
              </Animated.View>
            ) : null}
            {done ? (
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: doneOpacity }]}>
                <Svg width={vp.w} height={vp.h} viewBox={viewBox}>
                  <SvgImage href={href} x={0} y={0} width={cut.boardW} height={cut.boardH} preserveAspectRatio="none" />
                </Svg>
              </Animated.View>
            ) : null}
          </Animated.View>

          {!done ? (
            <View style={[styles.zoom, { backgroundColor: theme.glass, borderColor: theme.rule }]}>
              <ZoomBtn icon="plus" label={t('game.zoomIn')} onPress={() => zoomBy(1.6)} testID="zoom-in" />
              <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: theme.rule }} />
              <ZoomBtn icon="minus" label={t('game.zoomOut')} onPress={() => zoomBy(1 / 1.6)} testID="zoom-out" />
              <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: theme.rule }} />
              <ZoomBtn icon="fit" label={t('game.fit')} onPress={() => setView(fitWorld(world, vp.w, vp.h))} testID="zoom-fit" />
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
                const bw = r.w * cut.boardW;
                const bh = r.h * cut.boardH;
                const sNew = 0.82 * Math.min((vp.w - 24) / bw, (vp.h - 24) / bh);
                const cx = (r.x + r.w / 2) * cut.boardW;
                const cy = (r.y + r.h / 2) * cut.boardH;
                setView(clampWorld({ s: sNew, x0: cx - vp.w / (2 * sNew), y0: cy - vp.h / (2 * sNew) }, world, vp.w, vp.h, cell));
                setLook(null);
              }}
            />
          ) : null}
        </View>

        {/* Araç çubuğu */}
        <View style={[pos(toolbar), styles.toolbar, { borderTopColor: theme.rule }]}>
          <Tool icon="menu" label={t('game.menu')} onPress={() => setPaused(true)} testID="pause" />
          <Tool icon="image" label={t('game.reference')} onPress={() => setShowRef((v) => !v)} active={showRef} testID="reference" />
          <Tool
            icon="edges"
            label={t('game.edges')}
            onPress={() => dispatch({ type: 'tableArrange', aspect: vp.w / vp.h, seed: Date.now() >>> 0, edgesFirst: true })}
            testID="edges"
          />
          <Tool icon="shuffle" label={t('game.shuffle')} onPress={() => dispatch({ type: 'tableArrange', aspect: vp.w / vp.h, seed: Date.now() >>> 0 })} testID="shuffle" />
        </View>

        {/* Sürüklenen grup */}
        {drag ? (
          <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, transform: [{ translateX: dragPos.x }, { translateY: dragPos.y }] }}>
            <GroupView cut={cut} ids={drag.ids} source={art.image} scale={view.s} lifted />
          </Animated.View>
        ) : null}
      </View>

      {paused ? (
        <PauseMenu
          onResume={() => setPaused(false)}
          onRestart={() => {
            restart();
            fitted.current = false;
            setSelected(null);
            setPaused(false);
            doneOpacity.setValue(0);
          }}
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

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  zoom: { position: 'absolute', right: 10, bottom: 10, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  toolbar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth * 2, gap: space(1) },
});
