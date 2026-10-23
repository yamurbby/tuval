// Kalıcı depolama (AsyncStorage). İnternet gerektirmez; tüm veri cihazda kalır.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateGameState } from '../game/engine';
import type { GameResult, GameState } from '../game/types';
import type { LanguagePref } from '../i18n';
import type { ThemePref } from '../theme';

const KEYS = {
  settings: 'parca/settings/v2',
  collection: 'parca/collection/v2',
  games: 'parca/games/v2',
  daily: 'parca/daily/v2',
  downloaded: 'parca/downloaded/v1',
};

export interface Settings {
  sound: boolean;
  haptics: boolean;
  language: LanguagePref;
  largeText: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  /** Tahtada soluk referans görsel */
  guide: boolean;
  /** Parça sınırlarını (dikişleri) tahtada göster */
  seams: boolean;
  /** Süre göstergesi (varsayılan kapalı — rekabet zorunlu değil) */
  showTimer: boolean;
  /** Tepside kenar parçalarını otomatik olarak öne al */
  autoEdges: boolean;
  /** Görünüm: sistem / açık salon / gece salonu */
  theme: ThemePref;
  /** Oyun sırasında ortam sesi */
  ambient: AmbientKind;
  /** Parçalar masaya dağılmış mı (gerçek yapboz hissi), yoksa sayfalı tepside mi */
  layout: PieceLayout;
}

export type AmbientKind = 'off' | 'rain' | 'fire' | 'piano';
export type PieceLayout = 'table' | 'tray';

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  haptics: true,
  language: 'tr',
  largeText: false,
  highContrast: false,
  reduceMotion: false,
  guide: true,
  seams: true,
  showTimer: false,
  autoEdges: true,
  theme: 'system',
  ambient: 'off',
  layout: 'table',
};

export interface CompletionRecord {
  pieces: number;
  timeMs: number;
  moves: number;
  completedAt: number;
}
/** eserId -> tamamlanan oyunlar (parça sayısına göre en iyisi) */
export type Collection = Record<string, CompletionRecord[]>;
export type SavedGames = Record<string, GameState>;
/** tarih -> tamamlandı */
export type DailyLog = Record<string, boolean>;
/** Çevrimiçi eserlerden cihaza indirilenler (eserId -> indirildiği zaman) */
export type Downloaded = Record<string, number>;

export const gameKey = (puzzleId: string, target: number, daily?: string | null) =>
  daily ? `daily:${daily}` : `${puzzleId}:${target}`;

async function readJson<T>(key: string, fallback: T): Promise<{ value: T; corrupted: boolean }> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return { value: fallback, corrupted: false };
    return { value: JSON.parse(raw) as T, corrupted: false };
  } catch {
    return { value: fallback, corrupted: true };
  }
}

async function writeJson(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Depolama doluysa veya erişilemiyorsa oyun bellekte sürer.
  }
}

export interface Persisted {
  settings: Settings;
  collection: Collection;
  games: SavedGames;
  daily: DailyLog;
  downloaded: Downloaded;
  corrupted: boolean;
}

export async function loadAll(): Promise<Persisted> {
  const [s, c, g, d, dl] = await Promise.all([
    readJson<Partial<Settings>>(KEYS.settings, {}),
    readJson<Collection>(KEYS.collection, {}),
    readJson<SavedGames>(KEYS.games, {}),
    readJson<DailyLog>(KEYS.daily, {}),
    readJson<Downloaded>(KEYS.downloaded, {}),
  ]);
  const games: SavedGames = {};
  let dropped = false;
  for (const [k, v] of Object.entries(g.value ?? {})) {
    const valid = validateGameState(v);
    if (valid && valid.status === 'playing') games[k] = valid;
    else dropped = true;
  }
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(s.value ?? {}) };
  // v3 öncesi ortam sesi adları
  if (!['off', 'rain', 'fire', 'piano'].includes(settings.ambient)) settings.ambient = (settings.ambient as string) === 'salon' ? 'piano' : 'off';
  if (settings.layout !== 'table' && settings.layout !== 'tray') {
    // Bu sürümden önceki kayıt: dil "sistem"de kalmışsa (İngilizce cihazlarda uygulama İngilizce açılıyordu) Türkçeye al
    if (s.value && s.value.language === 'system') settings.language = 'tr';
    settings.layout = 'table';
  }
  return {
    settings,
    collection: c.value ?? {},
    games,
    daily: d.value ?? {},
    downloaded: dl.value ?? {},
    corrupted: s.corrupted || c.corrupted || g.corrupted || d.corrupted || dropped,
  };
}

export const saveSettings = (v: Settings) => writeJson(KEYS.settings, v);
export const saveCollection = (v: Collection) => writeJson(KEYS.collection, v);
export const saveGames = (v: SavedGames) => writeJson(KEYS.games, v);
export const saveDaily = (v: DailyLog) => writeJson(KEYS.daily, v);
export const saveDownloaded = (v: Downloaded) => writeJson(KEYS.downloaded, v);

export async function clearAll() {
  try {
    await AsyncStorage.multiRemove([KEYS.collection, KEYS.games, KEYS.daily]);
  } catch {
    // yoksay
  }
}

/** Aynı parça sayısı için daha iyi (daha kısa) kaydı tutar; isBest yeni rekor mu? */
export function mergeResult(collection: Collection, r: GameResult): { collection: Collection; isBest: boolean } {
  const list = collection[r.puzzleId] ?? [];
  const prev = list.find((x) => x.pieces === r.pieceCount);
  const isBest = !prev || r.elapsedMs < prev.timeMs;
  const rec: CompletionRecord = { pieces: r.pieceCount, timeMs: r.elapsedMs, moves: r.moves, completedAt: Date.now() };
  const next = isBest ? [...list.filter((x) => x.pieces !== r.pieceCount), rec] : list.map((x) => (x === prev ? { ...x, completedAt: Date.now() } : x));
  next.sort((a, b) => a.pieces - b.pieces);
  return { collection: { ...collection, [r.puzzleId]: next }, isBest };
}
