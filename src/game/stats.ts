// Parça renk/desen istatistikleri: tepsi filtreleri ve sıralama için.
// Görselin küçük bir ham RGB önizlemesinden (derleme sırasında üretilir) hesaplanır;
// cihazda piksel okuma gerekmez, internet gerekmez.

export interface Thumb {
  w: number;
  h: number;
  /** base64 kodlu ham RGB (w*h*3 bayt) */
  rgb: string;
}

export interface PieceStat {
  r: number;
  g: number;
  b: number;
  lum: number; // 0..1
  hue: number; // 0..360
  sat: number; // 0..1
  detail: number; // yerel parlaklık sapması
  tone: number; // en yakın palet rengi indeksi
  busy: boolean; // dokulu / desenli mi
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function decodeBase64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : 0;
    const d = i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : 0;
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

export function computePieceStats(thumb: Thumb, cols: number, rows: number, palette: string[]): PieceStat[] {
  const px = decodeBase64(thumb.rgb);
  const pal = palette.map(hexToRgb);
  const stats: PieceStat[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor((c / cols) * thumb.w);
      const x1 = Math.max(x0 + 1, Math.floor(((c + 1) / cols) * thumb.w));
      const y0 = Math.floor((r / rows) * thumb.h);
      const y1 = Math.max(y0 + 1, Math.floor(((r + 1) / rows) * thumb.h));
      // Komşu pikselleri de içeren biraz geniş pencere: detay ölçümü için
      const ex0 = Math.max(0, x0 - 1),
        ex1 = Math.min(thumb.w, x1 + 1),
        ey0 = Math.max(0, y0 - 1),
        ey1 = Math.min(thumb.h, y1 + 1);
      let sr = 0,
        sg = 0,
        sb = 0,
        n = 0,
        sl = 0,
        sl2 = 0;
      for (let y = ey0; y < ey1; y++) {
        for (let x = ex0; x < ex1; x++) {
          const i = (y * thumb.w + x) * 3;
          const R = px[i],
            G = px[i + 1],
            Bc = px[i + 2];
          const L = (0.2126 * R + 0.7152 * G + 0.0722 * Bc) / 255;
          sl += L;
          sl2 += L * L;
          if (x >= x0 && x < x1 && y >= y0 && y < y1) {
            sr += R;
            sg += G;
            sb += Bc;
            n++;
          }
        }
      }
      const m = (ex1 - ex0) * (ey1 - ey0);
      const mean = sl / m;
      const detail = Math.sqrt(Math.max(0, sl2 / m - mean * mean));
      const R = sr / n,
        G = sg / n,
        Bc = sb / n;
      const [hue, sat, lum] = rgbToHsl(R, G, Bc);
      let tone = 0;
      let best = Infinity;
      pal.forEach(([pr, pg, pb], k) => {
        const d = (pr - R) ** 2 * 0.3 + (pg - G) ** 2 * 0.59 + (pb - Bc) ** 2 * 0.11;
        if (d < best) {
          best = d;
          tone = k;
        }
      });
      stats.push({ r: R, g: G, b: Bc, lum, hue, sat, detail, tone, busy: false });
    }
  }
  // Desen eşiği: görselin kendi medyanı — her eserde yaklaşık yarı yarıya ayrılır
  const sorted = stats.map((s) => s.detail).sort((a, b) => a - b);
  const median = sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
  for (const s of stats) s.busy = s.detail > median;
  return stats;
}

export interface TrayFilter {
  kind: 'all' | 'edges' | 'groups' | 'tone' | 'pattern';
  tone?: number;
  busy?: boolean;
}
export type TraySort = 'shuffled' | 'color' | 'light';

/** Tepsi öğelerini (gruplar) filtreler ve sıralar. Grubun istatistiği ilk parçasından alınır. */
export function arrangeTray(
  tray: number[][],
  stats: PieceStat[] | null,
  isEdge: (id: number) => boolean,
  filter: TrayFilter,
  sort: TraySort,
  edgesFirst: boolean,
): number[][] {
  const avg = (g: number[], f: (s: PieceStat) => number) => {
    if (!stats) return 0;
    let t = 0;
    for (const id of g) t += f(stats[id]);
    return t / g.length;
  };
  let items = tray;
  switch (filter.kind) {
    case 'edges':
      items = tray.filter((g) => g.some(isEdge));
      break;
    case 'groups':
      items = tray.filter((g) => g.length > 1);
      break;
    case 'tone':
      if (stats) items = tray.filter((g) => g.some((id) => stats[id].tone === filter.tone));
      break;
    case 'pattern':
      if (stats) items = tray.filter((g) => stats[g[0]].busy === !!filter.busy);
      break;
  }
  if (sort === 'color' && stats) {
    items = [...items].sort((a, b) => {
      const ka = avg(a, (s) => (s.sat < 0.12 ? 400 + s.lum * 100 : s.hue));
      const kb = avg(b, (s) => (s.sat < 0.12 ? 400 + s.lum * 100 : s.hue));
      return ka - kb;
    });
  } else if (sort === 'light' && stats) {
    items = [...items].sort((a, b) => avg(a, (s) => s.lum) - avg(b, (s) => s.lum));
  }
  if (edgesFirst && filter.kind === 'all') {
    const e = items.filter((g) => g.some(isEdge));
    const i = items.filter((g) => !g.some(isEdge));
    items = [...e, ...i];
  }
  return items;
}

/** Palet rengi için erişilebilir ad (renk körlüğünde de anlaşılır) */
export function toneName(hex: string, locale: 'tr' | 'en'): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const light = l < 0.28 ? (locale === 'tr' ? 'koyu' : 'dark') : l > 0.7 ? (locale === 'tr' ? 'açık' : 'light') : '';
  let hueName: string;
  if (s < 0.14) hueName = l < 0.2 ? (locale === 'tr' ? 'siyah' : 'black') : l > 0.85 ? (locale === 'tr' ? 'beyaz' : 'white') : locale === 'tr' ? 'gri' : 'grey';
  else if (h < 18 || h >= 340) hueName = locale === 'tr' ? 'kırmızı' : 'red';
  else if (h < 45) hueName = l < 0.45 ? (locale === 'tr' ? 'kahve' : 'brown') : locale === 'tr' ? 'turuncu' : 'orange';
  else if (h < 70) hueName = l < 0.45 ? (locale === 'tr' ? 'zeytin' : 'olive') : locale === 'tr' ? 'sarı' : 'yellow';
  else if (h < 165) hueName = locale === 'tr' ? 'yeşil' : 'green';
  else if (h < 200) hueName = locale === 'tr' ? 'turkuaz' : 'teal';
  else if (h < 255) hueName = locale === 'tr' ? 'mavi' : 'blue';
  else if (h < 300) hueName = locale === 'tr' ? 'mor' : 'purple';
  else hueName = locale === 'tr' ? 'pembe' : 'pink';
  return light ? `${light} ${hueName}` : hueName;
}
