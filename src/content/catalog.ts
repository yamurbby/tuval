// Parça koleksiyonu: sergiler, eserler, küratör notları.
// Kaynak verisi tools/fetch_art.py (The Met Open Access) ve tools/build_curation.py ile üretilir.
import Constants from 'expo-constants';
import { ImageSourcePropType, Platform } from 'react-native';
import { hashString } from '../game/rng';
import { ARTWORK_IMAGES, ARTWORK_META, ARTWORK_PREVIEWS } from './artworks.generated';
import { CURATION } from './curation.generated';
import { EXHIBITIONS, Exhibition, getExhibition } from './exhibitions';
import { dateTr, mediumTr } from './l10n';
import type { ArtworkMeta, CategoryId, Curation, Detail, ExhibitionId, L10n } from './types';

export type { CategoryId, Detail, ExhibitionId } from './types';
export { EXHIBITIONS, getExhibition, monthExhibition } from './exhibitions';
export type { Exhibition } from './exhibitions';

export const CATEGORIES: ExhibitionId[] = EXHIBITIONS.map((e) => e.id);

/** Çevrimiçi eserlerin barındığı site (yerel Android/iOS derlemesi için app.json → extra.collectionBaseUrl) */
const BASE_URL: string = ((Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.collectionBaseUrl as string) ?? '';

export interface Artwork extends ArtworkMeta {
  /** Tam çözünürlüklü görsel (uygulama içi ya da çevrimiçi) */
  image: ImageSourcePropType;
  /** Küçük önizleme — her zaman uygulamayla gelir */
  preview: ImageSourcePropType;
  /** Katalog numarası (01, 02 …) */
  number: string;
  /** Sergi içindeki sıra (1'den) */
  room: number;
  curation?: Curation;
}

function remoteSource(a: ArtworkMeta): ImageSourcePropType {
  if (!a.remotePath) return { uri: a.fallbackImageUrl };
  if (Platform.OS === 'web') return { uri: a.remotePath };
  return { uri: BASE_URL ? BASE_URL.replace(/\/$/, '') + a.remotePath : a.fallbackImageUrl };
}

export const ARTWORKS: Artwork[] = CATEGORIES.flatMap((c) => ARTWORK_META.filter((a) => a.category === c)).map((a, i, all) => ({
  ...a,
  image: a.bundled ? ARTWORK_IMAGES[a.id] : remoteSource(a),
  preview: ARTWORK_PREVIEWS[a.id],
  number: String(i + 1).padStart(2, '0'),
  room: all.filter((b, j) => j <= i && b.category === a.category).length,
  curation: CURATION[a.id],
}));

export function getArtwork(id: string | undefined | null): Artwork | undefined {
  return ARTWORKS.find((a) => a.id === id);
}

export function exhibitionWorks(id: ExhibitionId): Artwork[] {
  return ARTWORKS.filter((a) => a.category === id);
}

/** Aynı sergide sıradaki eser; sergi bitince bir sonraki sergiye geçer. */
export function nextArtwork(id: string): Artwork {
  const i = ARTWORKS.findIndex((a) => a.id === id);
  return ARTWORKS[(i + 1) % ARTWORKS.length];
}

export const pick = (l: L10n, locale: string) => (locale === 'tr' ? l.tr : l.en);

export interface Localized {
  title: string;
  medium: string;
  date: string;
  original: string;
  note: string;
}

/** Arayüz dili için başlık/teknik/tarih/küratör notu */
export function localize(a: Artwork, locale: string): Localized {
  const tr = locale === 'tr';
  return {
    title: a.curation ? pick(a.curation.title, locale) : a.title,
    medium: tr ? mediumTr(a.medium) : a.medium,
    date: tr ? dateTr(a.date) : a.date,
    original: a.title,
    note: a.curation ? pick(a.curation.note, locale) : '',
  };
}

export function details(a: Artwork): Detail[] {
  return a.curation?.details ?? [];
}

/** "Sanatçı, tarih" — boş alanları atlar */
export function byline(a: Artwork, n: Localized): string {
  return [a.artist, n.date].filter(Boolean).join(', ');
}

export function exhibitionOf(a: Artwork): Exhibition {
  return getExhibition(a.category)!;
}

export function todayKey(d = new Date()): string {
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export const DAILY_TARGET = 200;

/** Günün eseri: tarih tohumundan seçilir; herkes aynı kesimi görür. İnternetsiz oynanabilsin diye uygulama içi eserlerden. */
const DAILY_POOL = ARTWORKS.filter((a) => a.bundled);
export function dailyArtwork(date = todayKey()) {
  const seed = hashString(`parca-daily-${date}`);
  return { artwork: DAILY_POOL[seed % DAILY_POOL.length], seed, date, target: DAILY_TARGET };
}
