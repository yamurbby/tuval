import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Device from 'expo-device';
import { AppState, Platform, useColorScheme } from 'react-native';
import type { GameResult, GameState } from '../game/types';
import { Locale, resolveLocale, TKey, translate } from '../i18n';
import {
  clearAll,
  Collection,
  DailyLog,
  DEFAULT_SETTINGS,
  Downloaded,
  gameKey,
  loadAll,
  mergeResult,
  saveCollection,
  saveDaily,
  saveDownloaded,
  saveGames,
  saveSettings,
  SavedGames,
  Settings,
} from '../storage/persist';
import { makeTheme, Theme } from '../theme';

interface AppValue {
  ready: boolean;
  storageWarning: boolean;
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  locale: Locale;
  t: (key: TKey, params?: Record<string, string | number>) => string;
  theme: Theme;
  collection: Collection;
  games: SavedGames;
  daily: DailyLog;
  upsertGame: (g: GameState) => void;
  removeGame: (key: string) => void;
  flushGames: () => void;
  recordResult: (r: GameResult) => { isBest: boolean };
  resetProgress: () => void;
  downloaded: Downloaded;
  markDownloaded: (ids: string[]) => void;
  /** Uzman seviyesinde 1000 parçayı kaldırabilecek cihaz mı? */
  highCapacity: boolean;
}

const Ctx = createContext<AppValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [collection, setCollection] = useState<Collection>({});
  const [games, setGames] = useState<SavedGames>({});
  const [daily, setDaily] = useState<DailyLog>({});
  const [downloaded, setDownloaded] = useState<Downloaded>({});
  const downloadedRef = useRef<Downloaded>({});
  const gamesRef = useRef<SavedGames>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    loadAll()
      .then((p) => {
        if (!alive) return;
        setSettings(p.settings);
        setCollection(p.collection);
        setGames(p.games);
        gamesRef.current = p.games;
        setDaily(p.daily);
        setDownloaded(p.downloaded);
        downloadedRef.current = p.downloaded;
        setStorageWarning(p.corrupted);
      })
      .catch(() => setStorageWarning(true))
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const flushGames = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    saveGames(gamesRef.current);
  }, []);

  // Uygulama arka plana alınırken bekleyen kaydı hemen yaz.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') flushGames();
    });
    // Web/PWA: sekme kapanırken de yaz
    const w = Platform.OS === 'web' && typeof window !== 'undefined' ? window : null;
    w?.addEventListener('pagehide', flushGames);
    return () => {
      sub.remove();
      w?.removeEventListener('pagehide', flushGames);
    };
  }, [flushGames]);

  // Kısma (throttle): bekleyen bir kayıt varsa erteleme. Süre her saniye ilerlediği için
  // erteleme (debounce) kullanılırsa kayıt oyun boyunca hiç yazılmaz.
  const scheduleSave = useCallback(() => {
    if (timer.current) return;
    timer.current = setTimeout(flushGames, 1200);
  }, [flushGames]);

  const upsertGame = useCallback(
    (g: GameState) => {
      const key = gameKey(g.puzzleId, g.target, g.daily);
      const next = { ...gamesRef.current, [key]: g };
      gamesRef.current = next;
      setGames(next);
      scheduleSave();
    },
    [scheduleSave],
  );

  const removeGame = useCallback(
    (key: string) => {
      if (!(key in gamesRef.current)) return;
      const next = { ...gamesRef.current };
      delete next[key];
      gamesRef.current = next;
      setGames(next);
      flushGames();
    },
    [flushGames],
  );

  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  }, []);

  const collectionRef = useRef(collection);
  collectionRef.current = collection;
  const dailyRef = useRef(daily);
  dailyRef.current = daily;

  const recordResult = useCallback((r: GameResult) => {
    const { collection: next, isBest } = mergeResult(collectionRef.current, r);
    if (isBest) {
      collectionRef.current = next;
      setCollection(next);
      saveCollection(next);
    }
    if (r.daily) {
      const d = { ...dailyRef.current, [r.daily]: true };
      dailyRef.current = d;
      setDaily(d);
      saveDaily(d);
    }
    return { isBest };
  }, []);

  const markDownloaded = useCallback((ids: string[]) => {
    const fresh = ids.filter((id) => !downloadedRef.current[id]);
    if (!fresh.length) return;
    const next = { ...downloadedRef.current };
    for (const id of fresh) next[id] = Date.now();
    downloadedRef.current = next;
    setDownloaded(next);
    saveDownloaded(next);
  }, []);

  const resetProgress = useCallback(() => {
    clearAll();
    gamesRef.current = {};
    setGames({});
    setCollection({});
    setDaily({});
  }, []);

  const locale = resolveLocale(settings.language);
  const t = useCallback(
    (key: TKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );
  const scheme = useColorScheme();
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && scheme === 'dark');
  const theme = useMemo(
    () => makeTheme({ largeText: settings.largeText, highContrast: settings.highContrast, dark }),
    [settings.largeText, settings.highContrast, dark],
  );

  // 4 GB ve üzeri bellek (veya masaüstü/web) → Uzman 1000 parça, aksi halde 750
  const highCapacity = useMemo(() => {
    if (Platform.OS === 'web') return true;
    const mem = Device.totalMemory ?? 0;
    return mem >= 3.5 * 1024 ** 3;
  }, []);

  const value: AppValue = {
    ready,
    storageWarning,
    settings,
    setSetting,
    locale,
    t,
    theme,
    collection,
    games,
    daily,
    upsertGame,
    removeGame,
    flushGames,
    recordResult,
    resetProgress,
    downloaded,
    markDownloaded,
    highCapacity,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp, AppProvider içinde kullanılmalı');
  return v;
}
