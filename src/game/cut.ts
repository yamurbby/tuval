// Yapboz kesim geometrisi: her parça için SVG yolu üretir.
// Komşu parçalar aynı kenar eğrisini paylaşır; böylece birebir oturur.
import { createRng } from './rng';
import type { EdgeStyle } from './types';

type Pt = [number, number];
/** Kübik bezier parçası: [c1, c2, bitiş] */
type Seg = [Pt, Pt, Pt];

interface TabParams {
  sign: 1 | -1;
  offset: number;
  height: number;
  width: number;
}

export interface PieceGeometry {
  id: number;
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  pad: number;
  /** Tahta koordinatlarında kapalı SVG yolu */
  path: string;
  isEdge: boolean;
}

export interface PuzzleCut {
  cols: number;
  rows: number;
  boardW: number;
  boardH: number;
  cellW: number;
  cellH: number;
  pad: number;
  pieces: PieceGeometry[];
  /** Tüm iç kenarlar tek yol olarak (parça sınırı rehberi) */
  seams: string;
}

export interface CutSpec {
  cols: number;
  rows: number;
  edgeStyle: EdgeStyle;
  boardW: number;
  boardH: number;
}

const TEMPLATE: Array<[number, number][]> = [
  [[0.4, 0], [0.4, 0.1], [0.36, 0.14]],
  [[0.28, 0.24], [0.38, 0.32], [0.5, 0.32]],
  [[0.62, 0.32], [0.72, 0.24], [0.64, 0.14]],
  [[0.6, 0.1], [0.6, 0], [0.66, 0]],
];

function edgeSegments(a: Pt, b: Pt, tab: TabParams | null): Seg[] {
  if (!tab) return [[a, b, b]];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const nx = dy / len;
  const ny = -dx / len;
  const map = (u: number, v: number): Pt => {
    const uu = 0.5 + (u - 0.5) * tab.width + tab.offset;
    const vv = v * tab.height * tab.sign;
    return [a[0] + dx * uu + nx * vv * len, a[1] + dy * uu + ny * vv * len];
  };
  const start = map(0.34, 0);
  const segs: Seg[] = [[a, start, start]];
  for (const s of TEMPLATE) segs.push([map(s[0][0], s[0][1]), map(s[1][0], s[1][1]), map(s[2][0], s[2][1])]);
  segs.push([b, b, b]);
  return segs;
}

function reverseSegments(start: Pt, segs: Seg[]): Seg[] {
  const points: Pt[] = [start, ...segs.map((s) => s[2])];
  const out: Seg[] = [];
  for (let i = segs.length - 1; i >= 0; i--) out.push([segs[i][1], segs[i][0], points[i]]);
  return out;
}

const f = (n: number) => (Math.round(n * 10) / 10).toString();

function segsToPath(segs: Seg[]): string {
  let d = '';
  for (const s of segs) {
    if (s[1] === s[2]) {
      d += `L${f(s[2][0])} ${f(s[2][1])}`;
    } else {
      d += `C${f(s[0][0])} ${f(s[0][1])} ${f(s[1][0])} ${f(s[1][1])} ${f(s[2][0])} ${f(s[2][1])}`;
    }
  }
  return d;
}

export function generateCut(spec: CutSpec, seed: number): PuzzleCut {
  const { cols, rows, edgeStyle, boardW, boardH } = spec;
  const cellW = boardW / cols;
  const cellH = boardH / rows;
  const rng = createRng(seed ^ 0x9e3779b9);
  const makeTab = (): TabParams =>
    edgeStyle === 'classic'
      ? { sign: rng.sign() as 1 | -1, offset: rng.range(-0.03, 0.03), height: 1, width: 1 }
      : {
          sign: rng.sign() as 1 | -1,
          offset: rng.range(-0.1, 0.1),
          height: rng.range(0.8, 1.2),
          width: rng.range(0.8, 1.16),
        };

  const hTabs: TabParams[][] = [];
  for (let r = 0; r < rows - 1; r++) {
    hTabs.push([]);
    for (let c = 0; c < cols; c++) hTabs[r].push(makeTab());
  }
  const vTabs: TabParams[][] = [];
  for (let r = 0; r < rows; r++) {
    vTabs.push([]);
    for (let c = 0; c < cols - 1; c++) vTabs[r].push(makeTab());
  }

  const pad = Math.max(cellW, cellH) * 0.42;
  const pieces: PieceGeometry[] = [];
  let seams = '';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * cellW;
      const y0 = r * cellH;
      const x1 = x0 + cellW;
      const y1 = y0 + cellH;
      const tl: Pt = [x0, y0];
      const tr: Pt = [x1, y0];
      const br: Pt = [x1, y1];
      const bl: Pt = [x0, y1];
      const segs: Seg[] = [];
      segs.push(...edgeSegments(tl, tr, r === 0 ? null : hTabs[r - 1][c]));
      const right = c === cols - 1 ? edgeSegments(tr, br, null) : edgeSegments(tr, br, vTabs[r][c]);
      segs.push(...right);
      const bottomCanon = r === rows - 1 ? null : edgeSegments(bl, br, hTabs[r][c]);
      segs.push(...(bottomCanon ? reverseSegments(bl, bottomCanon) : edgeSegments(br, bl, null)));
      segs.push(...(c === 0 ? edgeSegments(bl, tl, null) : reverseSegments(tl, edgeSegments(tl, bl, vTabs[r][c - 1]))));

      // Dikiş rehberi: her iç kenar bir kez
      if (c < cols - 1) seams += `M${f(tr[0])} ${f(tr[1])}` + segsToPath(right);
      if (bottomCanon) seams += `M${f(bl[0])} ${f(bl[1])}` + segsToPath(bottomCanon);

      pieces.push({
        id: r * cols + c,
        row: r,
        col: c,
        x: x0,
        y: y0,
        w: cellW,
        h: cellH,
        pad,
        path: `M${f(x0)} ${f(y0)}${segsToPath(segs)}Z`,
        isEdge: r === 0 || c === 0 || r === rows - 1 || c === cols - 1,
      });
    }
  }
  return { cols, rows, boardW, boardH, cellW, cellH, pad, pieces, seams };
}

export interface GroupBox {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
  /** Tahta biriminde, çıkıntılar dahil kutu */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Tahta biriminde gerçek merkez (hedef) */
  cx: number;
  cy: number;
}

export function groupBox(cut: PuzzleCut, ids: number[]): GroupBox {
  let minRow = Infinity,
    maxRow = -Infinity,
    minCol = Infinity,
    maxCol = -Infinity;
  for (const id of ids) {
    const r = Math.floor(id / cut.cols);
    const c = id % cut.cols;
    if (r < minRow) minRow = r;
    if (r > maxRow) maxRow = r;
    if (c < minCol) minCol = c;
    if (c > maxCol) maxCol = c;
  }
  const x = minCol * cut.cellW - cut.pad;
  const y = minRow * cut.cellH - cut.pad;
  const w = (maxCol - minCol + 1) * cut.cellW + cut.pad * 2;
  const h = (maxRow - minRow + 1) * cut.cellH + cut.pad * 2;
  return { minRow, maxRow, minCol, maxCol, x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}
