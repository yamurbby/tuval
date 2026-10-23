// Oyun ekranlarının (tepsi ve masa düzeni) ortak parçaları
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, BackHandler, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DetailCrop } from '../../components/DetailCrop';
import { Icon, IconName } from '../../components/Icon';
import { AppText, Button } from '../../components/ui';
import { Artwork, Detail, details, pick } from '../../content/catalog';
import { setAmbient, stopAmbient } from '../../feedback/ambient';
import { haptic, playSound, preloadSounds } from '../../feedback/feedback';
import type { PuzzleCut } from '../../game/cut';
import { GameAction, toResult } from '../../game/engine';
import type { GameState } from '../../game/types';
import { useApp } from '../../state/AppContext';
import { AmbientKind, gameKey } from '../../storage/persist';
import { radius, space } from '../../theme';

// Web'de tarayıcının kaydırma / geri-kaydırma hareketlerini oyun alanında kapat
export const WEB_NO_GESTURES = (Platform.OS === 'web' ? { touchAction: 'none', overscrollBehavior: 'none', userSelect: 'none' } : {}) as object;

export const pos = (r: { x: number; y: number; w: number; h: number }) =>
  ({ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h }) as const;

export const AMBIENT_CYCLE: AmbientKind[] = ['off', 'rain', 'fire', 'piano'];

export function usePlacedRows(cut: PuzzleCut, placed: string) {
  const cache = useRef(new Map<string, string>());
  return useMemo(() => {
    const rows: { key: string; d: string }[] = [];
    for (let r = 0; r < cut.rows; r++) {
      const slice = placed.slice(r * cut.cols, (r + 1) * cut.cols);
      if (slice.indexOf('1') < 0) continue;
      const key = `${r}:${slice}`;
      let d = cache.current.get(key);
      if (d == null) {
        d = '';
        for (let c = 0; c < cut.cols; c++) if (slice[c] === '1') d += cut.pieces[r * cut.cols + c].path;
        cache.current.set(key, d);
      }
      rows.push({ key, d });
    }
    return rows;
  }, [cut, placed]);
}

export function ZoomBtn({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID?: string }) {
  const { theme } = useApp();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.zoomBtn, pressed && { backgroundColor: theme.paperDeep }]}
    >
      <Icon name={icon} size={20} color={theme.ink} />
    </Pressable>
  );
}

export function Tool({ icon, label, onPress, active, testID }: { icon: IconName; label: string; onPress: () => void; active?: boolean; testID?: string }) {
  const { theme } = useApp();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tool, { backgroundColor: active || pressed ? theme.paperDeep : 'transparent' }]}
    >
      <Icon name={icon} size={21} color={theme.ink} />
      <AppText variant="tiny" color={theme.inkSoft} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function LookCard({ art, d, onClose, onZoom }: { art: Artwork; d: Detail; onClose: () => void; onZoom: () => void }) {
  const { t, theme, locale, settings } = useApp();
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(op, { toValue: 1, duration: settings.reduceMotion ? 1 : 320, useNativeDriver: true }).start();
  }, [op, settings.reduceMotion]);
  return (
    <Animated.View
      testID="look-card"
      style={[
        styles.look,
        { backgroundColor: theme.glass, borderColor: theme.rule, opacity: op, transform: [{ translateY: op.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] },
      ]}
      accessibilityViewIsModal={false}
    >
      <DetailCrop art={art} rect={d.rect} box={64} source={art.image} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="loupe" size={13} color={theme.inkSoft} />
          <AppText variant="tiny" color={theme.inkSoft} weight="600" style={{ letterSpacing: 1 }}>
            {t('game.detailFound').toLocaleUpperCase(locale)}
          </AppText>
        </View>
        <AppText serif italic numberOfLines={1} style={{ fontSize: 17 * theme.fontScale, lineHeight: 21 * theme.fontScale }}>
          {pick(d.title, locale)}
        </AppText>
        <AppText variant="tiny" color={theme.inkSoft} numberOfLines={2}>
          {pick(d.text, locale)}
        </AppText>
        <Pressable accessibilityRole="button" onPress={onZoom} style={{ minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' }} testID="look-zoom">
          <AppText variant="small" weight="600" color={theme.tile}>
            {t('game.detailShow')}
          </AppText>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={8} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }} testID="look-close">
        <Icon name="close" size={18} color={theme.inkSoft} />
      </Pressable>
    </Animated.View>
  );
}

export function PauseMenu({ onResume, onRestart, onHome }: { onResume: () => void; onRestart: () => void; onHome: () => void }) {
  const { t, theme, settings, setSetting } = useApp();
  const ambLabel = (k: AmbientKind) => (k === 'off' ? t('game.ambientOff') : `${t('game.ambient')}: ${k === 'rain' ? t('settings.ambientRain') : k === 'fire' ? t('settings.ambientFire') : t('settings.ambientPiano')}`);
  const insets = useSafeAreaInsets();
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: theme.overlay }]} accessibilityViewIsModal>
      <View style={[styles.sheet, { backgroundColor: theme.paper, marginBottom: space(3) + insets.bottom }]}>
        <AppText variant="title" accessibilityRole="header">
          {t('game.paused')}
        </AppText>
        <AppText variant="small" color={theme.inkSoft} style={{ marginBottom: space(2) }}>
          {t('game.saved')}
        </AppText>
        <Button label={t('game.resume')} onPress={onResume} style={{ alignSelf: 'stretch' }} testID="resume" />
        <Button
          kind="secondary"
          label={settings.showTimer ? t('game.hideTimer') : t('game.showTimer')}
          icon="clock"
          onPress={() => setSetting('showTimer', !settings.showTimer)}
          style={{ alignSelf: 'stretch' }}
          testID="toggle-timer"
        />
 <Button
          kind="secondary"
          label={ambLabel(settings.ambient)}
          icon="sound"
          onPress={() => setSetting('ambient', AMBIENT_CYCLE[(AMBIENT_CYCLE.indexOf(settings.ambient) + 1) % AMBIENT_CYCLE.length])}
          style={{ alignSelf: 'stretch' }}
          testID="toggle-ambient"
        />
        <Button kind="secondary" label={t('game.restart')} icon="restart" onPress={onRestart} style={{ alignSelf: 'stretch' }} testID="restart" />
        <Button kind="ghost" label={t('game.home')} icon="home" onPress={onHome} style={{ alignSelf: 'stretch' }} testID="home" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zoomBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
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

/**
 * Oyun ekranı yaşam döngüsü: süre, ortam sesi, otomatik kayıt, tamamlanma, geri tuşu, Yakından bak.
 * Masa düzeni bunu kullanır (tepsi düzeni aynı mantığı kendi içinde taşır).
 */
export function useGameShell(opts: {
  art: Artwork;
  initialPlaced: string;
  state: GameState;
  dispatch: (a: GameAction) => void;
  paused: boolean;
  setPaused: (fn: (p: boolean) => boolean) => void;
  onComplete: () => void;
}) {
  const { art, initialPlaced, state, dispatch, paused, setPaused, onComplete } = opts;
  const app = useApp();
  const { t, settings, locale } = app;
  const router = useRouter();
  const total = state.cols * state.rows;
  const key = gameKey(state.puzzleId, state.target, state.daily);

  useEffect(() => preloadSounds(), []);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const prev = document.body.style.overscrollBehavior;
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overscrollBehavior = prev;
    };
  }, []);

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
  }, [paused, appActive, state.status, dispatch]);

  useEffect(() => {
    if (settings.ambient === 'off' || paused || !appActive || state.status !== 'playing') {
      stopAmbient();
      return;
    }
    setAmbient(settings.ambient);
  }, [settings.ambient, paused, appActive, state.status]);
  useEffect(() => () => stopAmbient(true), []);

  const finished = useRef(false);
  useEffect(() => {
    if (state.status === 'playing') {
      finished.current = false;
      app.upsertGame(state);
      return;
    }
    if (finished.current) return;
    finished.current = true;
    app.removeGame(key);
    const { isBest } = app.recordResult(toResult(state));
    playSound('win', settings.sound);
    haptic('win', settings.haptics);
    onComplete();
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
    }, [setPaused]),
  );

  // Yakından bak
  const looks = useMemo(
    () =>
      details(art).map((d) => {
        const ids: number[] = [];
        for (let r = 0; r < state.rows; r++)
          for (let c = 0; c < state.cols; c++) {
            const cx = (c + 0.5) / state.cols;
            const cy = (r + 0.5) / state.rows;
            if (cx >= d.rect.x && cx <= d.rect.x + d.rect.w && cy >= d.rect.y && cy <= d.rect.y + d.rect.h) ids.push(r * state.cols + c);
          }
        return { d, ids };
      }),
    [art, state.rows, state.cols],
  );
  const lookDone = (ids: number[], placed: string) => ids.length > 0 && ids.every((i) => placed[i] === '1');
  const announced = useRef<Set<string> | null>(null);
  if (announced.current == null) announced.current = new Set(looks.filter((l) => lookDone(l.ids, initialPlaced)).map((l) => l.d.id));
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

  const restart = () => {
    finished.current = false;
    dispatch({ type: 'restart', seed: Date.now() >>> 0 });
  };
  return { look, setLook, restart, key };
}
