// Oyun mantığı: saf fonksiyonlar. Arayüz yalnızca bu fonksiyonları çağırır.
import { createRng, hashString, shuffle } from './rng';
import { boardSize, edgeStyleFor, GameResult, GameState, gridFor, MAX_PIECES, MIN_PIECES } from './types';

export function clampTarget(n: number): number {
  if (!Number.isFinite(n)) return MIN_PIECES;
  return Math.min(MAX_PIECES, Math.max(MIN_PIECES, Math.round(n)));
}

export function createGame(params: {
  puzzleId: string;
  target: number;
  aspect: number;
  seed?: number;
  daily?: string | null;
}): GameState {
  const target = clampTarget(params.target);
  const { cols, rows } = gridFor(target, params.aspect);
  const n = cols * rows;
  const seed = params.seed ?? (Date.now() ^ hashString(params.puzzleId)) >>> 0;
  const ids = Array.from({ length: n }, (_, i) => i);
  return {
    version: 2,
    puzzleId: params.puzzleId,
    target,
    cols,
    rows,
    aspect: params.aspect,
    edgeStyle: edgeStyleFor(target),
    seed,
    placed: '0'.repeat(n),
    placedCount: 0,
    tray: shuffle(ids, seed).map((id) => [id]),
    moves: 0,
    elapsedMs: 0,
    status: 'playing',
    daily: params.daily ?? null,
    updatedAt: Date.now(),
  };
}

export const pieceCount = (s: Pick<GameState, 'cols' | 'rows'>) => s.cols * s.rows;
export const isPlaced = (s: GameState, id: number) => s.placed.charCodeAt(id) === 49; // '1'

/** İki grup ızgarada en az bir kenar paylaşıyor mu? */
export function areAdjacent(a: number[], b: number[], cols: number): boolean {
  const set = new Set(b);
  for (const id of a) {
    const c = id % cols;
    if (c > 0 && set.has(id - 1)) return true;
    if (c < cols - 1 && set.has(id + 1)) return true;
    if (set.has(id - cols) || set.has(id + cols)) return true;
  }
  return false;
}

const groupKey = (g: number[]) => g[0];

export type GameAction =
  | { type: 'place'; anchor: number }
  | { type: 'miss' }
  | { type: 'merge'; from: number; into: number }
  | { type: 'tick'; ms: number }
  | { type: 'shuffle'; seed: number }
  | { type: 'restart'; seed: number }
  | { type: 'load'; state: GameState }
  /** Masa: grubu yeni kaymaya taşı ve en üste getir */
  | { type: 'tableMove'; anchor: number; dx: number; dy: number }
  /** Masa: grubu komşu gruba ekle (komşunun kayması korunur) */
  | { type: 'tableJoin'; from: number; into: number }
  /** Masa: tek parçaları tahtanın çevresine yeniden diz */
  | { type: 'tableArrange'; aspect: number; seed: number; edgesFirst?: boolean; onlyMissing?: boolean };

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'load':
      return action.state;
    case 'place': {
      if (state.status !== 'playing') return state;
      const idx = state.tray.findIndex((g) => groupKey(g) === action.anchor);
      if (idx < 0) return state;
      const group = state.tray[idx];
      const chars = state.placed.split('');
      for (const id of group) chars[id] = '1';
      const tray = state.tray.slice(0, idx).concat(state.tray.slice(idx + 1));
      const placedCount = state.placedCount + group.length;
      let table = state.table;
      if (table) {
        table = { ...table };
        delete table[action.anchor];
      }
      return {
        ...state,
        table,
        placed: chars.join(''),
        placedCount,
        tray,
        moves: state.moves + 1,
        status: tray.length === 0 ? 'complete' : 'playing',
        updatedAt: Date.now(),
      };
    }
    case 'miss':
      if (state.status !== 'playing') return state;
      return { ...state, moves: state.moves + 1, updatedAt: Date.now() };
    case 'merge': {
      if (action.from === action.into) return state;
      const a = state.tray.findIndex((g) => groupKey(g) === action.from);
      const b = state.tray.findIndex((g) => groupKey(g) === action.into);
      if (a < 0 || b < 0) return state;
      if (!areAdjacent(state.tray[a], state.tray[b], state.cols)) return state;
      const merged = [...state.tray[a], ...state.tray[b]].sort((x, y) => x - y);
      const tray = state.tray.filter((_, i) => i !== a && i !== b);
      // Birleşen grup, hedef öğenin yerinde kalır
      tray.splice(Math.min(b - (a < b ? 1 : 0), tray.length), 0, merged);
      return { ...state, tray, moves: state.moves + 1, updatedAt: Date.now() };
    }
    case 'tableMove': {
      if (state.status !== 'playing') return state;
      const idx = state.tray.findIndex((g) => groupKey(g) === action.anchor);
      if (idx < 0) return state;
      const tray = state.tray.slice(0, idx).concat(state.tray.slice(idx + 1), [state.tray[idx]]);
      return {
        ...state,
        tray,
        table: { ...(state.table ?? {}), [action.anchor]: [action.dx, action.dy] },
        moves: state.moves + 1,
        updatedAt: Date.now(),
      };
    }
    case 'tableJoin': {
      if (state.status !== 'playing' || action.from === action.into) return state;
      const a = state.tray.findIndex((g) => groupKey(g) === action.from);
      const b = state.tray.findIndex((g) => groupKey(g) === action.into);
      if (a < 0 || b < 0) return state;
      if (!areAdjacent(state.tray[a], state.tray[b], state.cols)) return state;
      const merged = [...state.tray[a], ...state.tray[b]].sort((x, y) => x - y);
      const off = state.table?.[action.into] ?? [0, 0];
      const table = { ...(state.table ?? {}) };
      delete table[action.from];
      delete table[action.into];
      table[merged[0]] = off;
      const tray = state.tray.filter((_, i) => i !== a && i !== b).concat([merged]);
      return { ...state, tray, table, moves: state.moves + 1, updatedAt: Date.now() };
    }
    case 'tableArrange':
      return { ...state, table: arrangeTable(state, action.aspect, action.seed, !!action.edgesFirst, !!action.onlyMissing), updatedAt: Date.now() };
    case 'tick':
      if (state.status !== 'playing') return state;
      return { ...state, elapsedMs: state.elapsedMs + action.ms };
    case 'shuffle':
      return { ...state, tray: shuffle(state.tray, action.seed), updatedAt: Date.now() };
    case 'restart':
      return createGame({
        puzzleId: state.puzzleId,
        target: state.target,
        aspect: state.aspect,
        seed: action.seed,
        daily: state.daily,
      });
    default:
      return state;
  }
}

/**
 * Masa düzeni: tek parçaları tahtanın çevresine, halka halka dizer (kayma = yuva merkezi − doğru merkez).
 * aspect: görünüm alanının en/boy oranı; masa bu orana yakın büyür (dik telefonda üst/alt ağırlıklı).
 * Çok parçalı gruplar (onlyMissing değilse de) yerinde kalır.
 */
export function arrangeTable(
  state: GameState,
  aspect: number,
  seed: number,
  edgesFirst = false,
  onlyMissing = false,
): Record<string, [number, number]> {
  const { w: bw, h: bh } = boardSize(state.aspect);
  const cw = bw / state.cols;
  const ch = bh / state.rows;
  const sw = cw * 1.55;
  const sh = ch * 1.55;
  const gap = Math.min(cw, ch) * 0.45;
  const old = state.table ?? {};
  const out: Record<string, [number, number]> = {};
  const loose: number[] = [];
  for (const g of state.tray) {
    const k = g[0];
    if ((g.length > 1 || onlyMissing) && old[k]) out[k] = old[k];
    else if (g.length > 1) out[k] = [0, Math.max(bh, bw) * 0.7];
    else loose.push(k);
  }
  if (!loose.length) return out;
  const target = Math.max(0.3, Math.min(3, aspect));
  const N = Math.ceil(Math.sqrt(loose.length) * 1.6) + Math.ceil(Math.max(state.cols, state.rows) / 1.5) + 6;
  const lattice: { x: number; y: number; dxo: number; dyo: number; r: number }[] = [];
  {
    const rnd0 = createRng((seed ^ 0x9e3779b9) >>> 0).next;
    for (let i = -N; i <= N; i++)
      for (let j = -N; j <= N; j++) {
        const x = bw / 2 + i * sw;
        const y = bh / 2 + j * sh;
        // Tahtayı (ve çevresindeki boşluğu) kesen yuvalar kullanılmaz
        if (x + sw / 2 > -gap && x - sw / 2 < bw + gap && y + sh / 2 > -gap && y - sh / 2 < bh + gap) continue;
        lattice.push({ x, y, dxo: Math.max(0, Math.abs(x - bw / 2) - bw / 2) / cw, dyo: Math.max(0, Math.abs(y - bh / 2) - bh / 2) / ch, r: rnd0() });
      }
  }
  // Yatay/dikey büyüme oranını, masanın en/boy oranı görünüm alanına en yakın olacak şekilde seç
  const order0 = (ax: number) =>
    lattice
      .map((p) => ({ ...p, m: Math.max(p.dxo / ax, p.dyo) }))
      .sort((p, q) => p.m - q.m || p.r - q.r)
      .slice(0, loose.length);
  let slots = order0(1);
  let bestErr = Infinity;
  for (let k = 0; k <= 24; k++) {
    const ax = 0.04 * Math.pow(1.3, k);
    const cand = order0(ax);
    let x0 = 0, y0 = 0, x1 = bw, y1 = bh;
    for (const p of cand) {
      x0 = Math.min(x0, p.x - sw / 2);
      x1 = Math.max(x1, p.x + sw / 2);
      y0 = Math.min(y0, p.y - sh / 2);
      y1 = Math.max(y1, p.y + sh / 2);
    }
    const err = Math.abs(Math.log((x1 - x0) / (y1 - y0) / target));
    if (err < bestErr) {
      bestErr = err;
      slots = cand;
    }
  }
  const rnd = createRng(seed >>> 0).next;
  let order = shuffle(loose, seed);
  if (edgesFirst) {
    const isEdge = (id: number) => {
      const c = id % state.cols;
      const r = Math.floor(id / state.cols);
      return c === 0 || r === 0 || c === state.cols - 1 || r === state.rows - 1;
    };
    order = [...order.filter(isEdge), ...order.filter((id) => !isEdge(id))];
  }
  order.forEach((id, i) => {
    const s = slots[i];
    const c = id % state.cols;
    const r = Math.floor(id / state.cols);
    const jx = (rnd() - 0.5) * cw * 0.12;
    const jy = (rnd() - 0.5) * ch * 0.12;
    out[id] = [s.x + jx - (c + 0.5) * cw, s.y + jy - (r + 0.5) * ch];
  });
  return out;
}

/** Bırakılan grubun merkezi gerçek merkezine yeterince yakın mı? (tahta birimi) */
export function isDropCorrect(
  target: { cx: number; cy: number },
  dropX: number,
  dropY: number,
  cell: { w: number; h: number },
  /** ekran pikseli / tahta birimi — çok uzaklaştırılmışken parmak hassasiyeti için */
  scale: number,
): boolean {
  const base = Math.min(cell.w, cell.h);
  const tol = Math.min(base * 0.62, Math.max(base * 0.36, 12 / Math.max(scale, 0.0001)));
  return Math.hypot(dropX - target.cx, dropY - target.cy) <= tol;
}

export const progress = (s: GameState) => s.placedCount / pieceCount(s);

export function toResult(state: GameState): GameResult {
  return {
    puzzleId: state.puzzleId,
    target: state.target,
    pieceCount: pieceCount(state),
    elapsedMs: state.elapsedMs,
    moves: state.moves,
    daily: state.daily,
  };
}

/** Kayıtlı veri bozuk veya eski sürümse null döner. */
export function validateGameState(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as GameState;
  if (s.version !== 2 || !Array.isArray(s.tray) || typeof s.placed !== 'string') return null;
  const n = s.cols * s.rows;
  if (!(n > 0) || s.placed.length !== n) return null;
  const seen = new Set<number>();
  for (const g of s.tray) {
    if (!Array.isArray(g) || g.length === 0) return null;
    for (const id of g) {
      if (typeof id !== 'number' || id < 0 || id >= n || seen.has(id) || s.placed[id] === '1') return null;
      seen.add(id);
    }
  }
  if (seen.size + s.placedCount !== n) return null;
  if (s.table != null) {
    if (typeof s.table !== 'object') return { ...s, table: undefined };
    for (const v of Object.values(s.table))
      if (!Array.isArray(v) || v.length !== 2 || !Number.isFinite(v[0]) || !Number.isFinite(v[1])) return { ...s, table: undefined };
  }
  return s;
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? m.toString().padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${s.toString().padStart(2, '0')}`;
}
