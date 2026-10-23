import type { Thumb } from '../game/stats';

/** Sergi kimlikleri — tools/collection.json ile aynı */
export type ExhibitionId =
  | 'japanese'
  | 'dutch'
  | 'impressionists'
  | 'stillLife'
  | 'botanical'
  | 'maps'
  | 'architecture'
  | 'american'
  | 'islamic'
  | 'renaissance';

/** Geriye dönük ad: eser kategorisi = sergisi */
export type CategoryId = ExhibitionId;

export interface ArtworkMeta {
  id: string;
  objectId: number;
  category: ExhibitionId;
  /** Uygulamayla mı geliyor (internetsiz), yoksa çevrimiçi koleksiyonda mı? */
  bundled: boolean;
  /** Çevrimiçi eserlerin sitedeki yolu, ör. /collection/met-123.jpg */
  remotePath: string | null;
  fileSize: number;
  title: string;
  artist: string;
  artistBio: string;
  culture: string;
  date: string;
  medium: string;
  dimensions: string;
  department: string;
  accession: string;
  creditLine: string;
  institution: string;
  sourceUrl: string;
  apiUrl: string;
  originalImageUrl: string;
  /** Kendi sitemiz yoksa (yerel derleme) kullanılan müze görseli */
  fallbackImageUrl: string;
  originalSize: [number, number];
  license: string;
  licenseUrl: string;
  licensePolicyUrl: string;
  verifiedPublicDomain: true;
  verifiedAt: string;
  attribution: string;
  width: number;
  height: number;
  aspect: number;
  sha256: string;
  palette: string[];
  thumb: Thumb;
}

export interface L10n {
  tr: string;
  en: string;
}

/** Eser üzerinde 0–1 kesirli dikdörtgen */
export interface FracRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Detail {
  id: string;
  rect: FracRect;
  title: L10n;
  text: L10n;
}

export interface Curation {
  title: L10n;
  note: L10n;
  details: Detail[];
}
