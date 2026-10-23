// Oyun ekranı yerleşimi: tahta görünüm alanı ve tepsi, ekran boyutu/yönüne göre.
// Saf fonksiyonlar — testlerde de kullanılır.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GameLayout {
  landscape: boolean;
  header: Rect;
  board: Rect; // tahta görünüm alanı (yakınlaştırılabilir)
  tray: Rect;
  filters: Rect;
  sub: Rect | null; // renk / desen alt satırı
  grid: Rect;
  pager: Rect;
  toolbar: Rect;
  slot: number;
  trayCols: number;
  trayRows: number;
  pageSize: number;
}

export const HEADER_H = 52;
export const TOOLBAR_H = 60;
export const FILTER_H = 44;
export const SUB_H = 44;
export const PAGER_H = 44;
const GAP = 6;
const SIDE = 12;

export function computeLayout(width: number, height: number, withSub: boolean): GameLayout {
  const landscape = width > height * 1.05;
  const header: Rect = { x: SIDE, y: 0, w: width - SIDE * 2, h: HEADER_H };
  const toolbar: Rect = { x: SIDE, y: height - TOOLBAR_H, w: width - SIDE * 2, h: TOOLBAR_H };
  const top = HEADER_H;
  const avail = toolbar.y - GAP - top;

  let board: Rect;
  let tray: Rect;
  if (!landscape) {
    const trayH = Math.round(Math.min(330, Math.max(230, avail * 0.46)));
    board = { x: 0, y: top, w: width, h: avail - trayH - GAP };
    tray = { x: SIDE, y: board.y + board.h + GAP, w: width - SIDE * 2, h: trayH };
  } else {
    const trayW = Math.round(Math.min(420, Math.max(260, width * 0.38)));
    board = { x: 0, y: top, w: width - trayW - SIDE - GAP, h: avail };
    tray = { x: board.w + GAP, y: top, w: trayW, h: avail };
  }

  const filters: Rect = { x: tray.x, y: tray.y, w: tray.w, h: FILTER_H };
  const sub: Rect | null = withSub ? { x: tray.x, y: filters.y + FILTER_H, w: tray.w, h: SUB_H } : null;
  const pager: Rect = { x: tray.x, y: tray.y + tray.h - PAGER_H, w: tray.w, h: PAGER_H };
  const gy = (sub ? sub.y + sub.h : filters.y + filters.h) + 4;
  const grid: Rect = { x: tray.x, y: gy, w: tray.w, h: pager.y - gy - 2 };

  // Slot ≥ 52px (rahat dokunma), sayfa başına yönetilebilir sayıda parça
  const target = 56;
  const trayCols = Math.max(3, Math.floor(grid.w / target));
  const trayRows = Math.max(1, Math.floor(grid.h / 52));
  const slot = Math.min(grid.w / trayCols, grid.h / trayRows);

  return { landscape, header, board, tray, filters, sub, grid, pager, toolbar, slot, trayCols, trayRows, pageSize: trayCols * trayRows };
}

export function slotRect(L: GameLayout, i: number): Rect {
  const used = L.trayCols * L.slot;
  const x0 = L.grid.x + (L.grid.w - used) / 2;
  const col = i % L.trayCols;
  const row = Math.floor(i / L.trayCols);
  return { x: x0 + col * L.slot, y: L.grid.y + row * L.slot, w: L.slot, h: L.slot };
}

export function hitSlot(L: GameLayout, x: number, y: number): number | null {
  for (let i = 0; i < L.pageSize; i++) {
    const r = slotRect(L, i);
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
  }
  return null;
}

export const inRect = (r: Rect, x: number, y: number, margin = 0) =>
  x >= r.x - margin && x <= r.x + r.w + margin && y >= r.y - margin && y <= r.y + r.h + margin;

// ---- Tahta görünümü (yakınlaştırma / kaydırma)

export interface View {
  /** Görünüm alanının sol üstündeki tahta koordinatı */
  x0: number;
  y0: number;
  /** ekran pikseli / tahta birimi */
  s: number;
}

/** Sağdaki yakınlaştırma şeridi için ayrılan genişlik: tümü görünürken tahtayı örtmesin */
export const ZOOM_STRIP = 60;

export function fitScale(vw: number, vh: number, bw: number, bh: number) {
  return Math.min((vw - ZOOM_STRIP) / bw, vh / bh) * 0.96;
}

export function fitView(vw: number, vh: number, bw: number, bh: number): View {
  const s = fitScale(vw, vh, bw, bh);
  const usable = vw - ZOOM_STRIP;
  return { s, x0: bw / 2 - usable / (2 * s) - 6 / s, y0: bh / 2 - vh / (2 * s) };
}

export function scaleLimits(vw: number, vh: number, bw: number, bh: number, cell: number) {
  const f = fitScale(vw, vh, bw, bh);
  return { min: f * 0.85, max: Math.max(f * 1.5, 120 / cell) };
}

/** Çok parçalı yapbozda başlangıç: sol üst köşeye yakın, hücre ~32px */
export function initialView(vw: number, vh: number, bw: number, bh: number, cell: number, pieces: number): View {
  const fit = fitView(vw, vh, bw, bh);
  if (pieces <= 150 || fit.s * cell >= 30) return fit;
  const s = 32 / cell;
  return clampView({ s, x0: -cell * 0.6, y0: -cell * 0.6 }, vw, vh, bw, bh, cell);
}

export function clampView(v: View, vw: number, vh: number, bw: number, bh: number, cell: number): View {
  const lim = scaleLimits(vw, vh, bw, bh, cell);
  const s = Math.min(lim.max, Math.max(lim.min, v.s));
  const w = vw / s;
  const h = vh / s;
  // Tahtanın en az yarım ekranı görünür kalsın
  const clampAxis = (x0: number, span: number, total: number) => {
    if (span >= total) return (total - span) / 2; // tahta görünümden küçükse ortala
    return Math.min(total - span * 0.5, Math.max(-span * 0.5, x0));
  };
  return { s, x0: clampAxis(v.x0, w, bw), y0: clampAxis(v.y0, h, bh) };
}

/** Odak noktası (ekran, görünüm alanına göre) etrafında k kat yakınlaştır, (dx,dy) kaydır */
export function applyGesture(v: View, k: number, f0: { x: number; y: number }, f: { x: number; y: number }): View {
  const s = v.s * k;
  return { s, x0: v.x0 + f0.x / v.s - f.x / s, y0: v.y0 + f0.y / v.s - f.y / s };
}

export const toBoard = (v: View, sx: number, sy: number) => ({ x: v.x0 + sx / v.s, y: v.y0 + sy / v.s });
export const toScreen = (v: View, bx: number, by: number) => ({ x: (bx - v.x0) * v.s, y: (by - v.y0) * v.s });
