// Saf oyun tipleri — React / React Native bağımlılığı yoktur.

export type Preset = 'easy' | 'medium' | 'hard' | 'expert';
export type EdgeStyle = 'classic' | 'irregular';

export const PRESET_ORDER: Preset[] = ['easy', 'medium', 'hard', 'expert'];

/** Hazır parça sayıları. Uzman seviyesi cihaz kapasitesine göre 750 veya 1000 olur. */
export function presetTarget(p: Preset, highCapacity: boolean): number {
  switch (p) {
    case 'easy':
      return 100;
    case 'medium':
      return 300;
    case 'hard':
      return 500;
    case 'expert':
      return highCapacity ? 1000 : 750;
  }
}

/** Serbest parça sayısı seçimi sınırları */
export const MIN_PIECES = 100;
export const MAX_PIECES = 1000;
export const PIECE_STEP = 50;

/** Parça sayısı arttıkça şekiller düzensizleşir. */
export function edgeStyleFor(target: number): EdgeStyle {
  return target <= 300 ? 'classic' : 'irregular';
}

/** Görselin uzun kenarı her zaman bu kadar tahta birimidir. */
export const BOARD_LONG = 1000;

export function boardSize(aspect: number): { w: number; h: number } {
  return aspect >= 1 ? { w: BOARD_LONG, h: BOARD_LONG / aspect } : { w: BOARD_LONG * aspect, h: BOARD_LONG };
}

/** Hedef parça sayısına ve en-boy oranına göre ızgara: hücreler kareye yakın kalır. */
export function gridFor(target: number, aspect: number): { cols: number; rows: number } {
  // Hücre en-boy oranı 0.8–1.25 aralığında kalan ızgaralar arasından hedefe en yakın parça sayısı
  let best = { cols: 2, rows: 2, score: Infinity };
  const c0 = Math.sqrt(target * aspect);
  for (let cols = Math.max(2, Math.floor(c0 * 0.75)); cols <= Math.ceil(c0 * 1.3); cols++) {
    for (const rows of [Math.floor(target / cols), Math.ceil(target / cols)]) {
      if (rows < 2) continue;
      const cell = aspect * (rows / cols); // hücre genişlik / yükseklik
      if (cell < 0.82 || cell > 1.22) continue;
      const score = Math.abs(cols * rows - target) * 10 + Math.abs(Math.log(cell)) * 8;
      if (score < best.score) best = { cols, rows, score };
    }
  }
  return { cols: best.cols, rows: best.rows };
}

export type GameStatus = 'playing' | 'complete';

export interface GameState {
  version: 2;
  puzzleId: string;
  /** Kullanıcının seçtiği hedef parça sayısı (gerçek sayı cols*rows) */
  target: number;
  cols: number;
  rows: number;
  aspect: number;
  edgeStyle: EdgeStyle;
  seed: number;
  /** Her parça için '1' yerleşti, '0' yerleşmedi */
  placed: string;
  placedCount: number;
  /** Tepsideki öğeler: her öğe bir parça grubu (tek parça = 1 elemanlı grup).
   *  Masa düzeninde dizideki sıra çizim sırasıdır (sondaki en üstte). */
  tray: number[][];
  /** Masa düzeni: grup çapası (en küçük id) -> doğru yerine göre kayma [dx, dy] (tahta birimi) */
  table?: Record<string, [number, number]>;
  moves: number;
  elapsedMs: number;
  status: GameStatus;
  daily: string | null;
  updatedAt: number;
}

export interface GameResult {
  puzzleId: string;
  target: number;
  pieceCount: number;
  elapsedMs: number;
  moves: number;
  daily: string | null;
}
