// Tuval — "Gün ışığı galerisi": beyaz duvarlar, açık meşe çerçeveler, ada çayı yeşili vurgu.
// Açık tema varsayılan görünüm; koyu tema akşam galerisi. Vurgu rengi yalnızca birincil eylemlerde.
const light = {
  isDark: false,
  paper: '#FAFAF7', // sayfa (kırık beyaz)
  paperDeep: '#F0EFEA', // tepsi / ikincil yüzey
  surface: '#FFFFFF',
  ink: '#1C1C1E', // metin (~16:1)
  inkSoft: '#55575C', // ikincil metin (~7:1)
  stone: '#9A9893', // pasif çizgi/ikon (dekoratif)
  rule: '#E3E1DA',
  olive: '#4F6E5C', // birincil düğme: ada çayı (beyaz metinle ~5.7:1)
  onPrimary: '#FFFFFF',
  onPrimarySoft: '#DCE6DF',
  oliveSoft: '#E4ECE6',
  tile: '#A0603A', // sıcak meşe vurgusu (bağlantı, büyük harf)
  brass: '#C9A27E', // açık meşe
  boardBg: '#ECEAE3',
  /** Galeri duvarı: öne çıkan sergi, eser ve tamamlanma ekranları */
  wall: '#EEEDE8',
  wallDeep: '#E4E2DB',
  wallInk: '#1C1C1E',
  wallInkSoft: '#5F6166',
  frame: '#B89574', // açık meşe çerçeve
  mat: '#FFFFFF', // paspartu
  glass: 'rgba(255,255,255,0.94)', // yüzen kontroller
  scrim: 'rgba(250,250,247,0.97)',
  overlay: 'rgba(20,22,26,0.45)',
  shadow: 'rgba(20,22,26,0.10)',
  /** Masa düzeni */
  table: '#E9E6DF', // açık keten
  tableBoard: '#DEDAD1',
  tableLine: 'rgba(28,28,30,0.16)',
  pieceShadow: 'rgba(60,45,30,0.24)',
  pieceEdge: 'rgba(255,255,255,0.6)',
  frameShadow: 'rgba(30,25,20,0.14)',
};

export type Palette = { [K in keyof typeof light]: (typeof light)[K] extends boolean ? boolean : string };

const dark: Palette = {
  isDark: true,
  paper: '#141518',
  paperDeep: '#1E2024',
  surface: '#24262B',
  ink: '#ECE6DA',
  inkSoft: '#ABA598',
  stone: '#6F6B63',
  rule: '#33363B',
  olive: '#9DBBA8', // ada çayı düğme, koyu metinle
  onPrimary: '#121614',
  onPrimarySoft: '#33403A',
  oliveSoft: '#25302A',
  tile: '#D9A27A',
  brass: '#C9A27E',
  boardBg: '#26282C',
  wall: '#1B1D21',
  wallDeep: '#14161A',
  wallInk: '#EFE8DB',
  wallInkSoft: '#A9A194',
  frame: '#8C6E52',
  mat: '#E9E3D6',
  glass: 'rgba(36,38,43,0.94)',
  scrim: 'rgba(20,21,24,0.97)',
  overlay: 'rgba(0,0,0,0.6)',
  shadow: 'rgba(0,0,0,0.4)',
  table: '#17181B',
  tableBoard: '#22242A',
  tableLine: 'rgba(255,250,240,0.10)',
  pieceShadow: 'rgba(0,0,0,0.42)',
  pieceEdge: 'rgba(255,250,240,0.38)',
  frameShadow: 'rgba(0,0,0,0.3)',
};

export const palette = light;

export type Theme = Palette & { fontScale: number; highContrast: boolean };
export type ThemePref = 'system' | 'light' | 'dark';

export function makeTheme(opts: { largeText: boolean; highContrast: boolean; dark: boolean }): Theme {
  const p = opts.dark ? dark : light;
  const base: Theme = { ...p, fontScale: opts.largeText ? 1.18 : 1, highContrast: opts.highContrast };
  if (!opts.highContrast) return base;
  return opts.dark
    ? { ...base, paper: '#000000', surface: '#111111', ink: '#FFFFFF', inkSoft: '#DDDDDD', rule: '#888888', stone: '#BBBBBB', tile: '#FFAA80' }
    : { ...base, paper: '#FFFFFF', surface: '#FFFFFF', ink: '#000000', inkSoft: '#222222', rule: '#555555', stone: '#444444', tile: '#7A3018' };
}

export const radius = { xs: 2, sm: 4, md: 8, lg: 14, pill: 999 };
export const space = (n: number) => n * 4;
/** Minimum dokunma hedefi (Apple HIG 44pt, Material 48dp) */
export const TOUCH = 48;

export const fonts = {
  serif: 'EBGaramond_400Regular',
  serifItalic: 'EBGaramond_400Regular_Italic',
  serifMedium: 'EBGaramond_500Medium',
  serifSemi: 'EBGaramond_600SemiBold',
};

export const font = {
  display: 34,
  title: 26,
  h2: 20,
  body: 16,
  small: 14,
  tiny: 12,
};

/** Web'de görselin doğal boyutunu ezmek için açık genişlik/yükseklik gerekir. */
export const fillImage = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } as const;
