// Çevrimiçi koleksiyon: görselleri ilk kullanımda indirir.
// Web/PWA'da service worker indirilen dosyayı kalıcı önbelleğe yazar (parca-collection);
// yerel uygulamada Image.prefetch diske önbellekler.
import { Image } from 'react-native';
import type { Artwork } from './catalog';

export function imageUri(a: Artwork): string | null {
  const s = a.image as { uri?: string } | number;
  return typeof s === 'object' && s?.uri ? s.uri : null;
}

/** Görsel hazır mı (uygulama içi ya da indirilebildi)? */
export async function ensureImage(a: Artwork, timeoutMs = 45000): Promise<boolean> {
  const uri = imageUri(a);
  if (!uri) return true;
  try {
    const ok = await Promise.race([
      Image.prefetch(uri).then((r) => r !== false),
      new Promise<boolean>((res) => setTimeout(() => res(false), timeoutMs)),
    ]);
    return !!ok;
  } catch {
    return false;
  }
}

/** Sırayla indirir; her başarıda onDone çağrılır. Başarısız olanların listesini döndürür. */
export async function downloadAll(arts: Artwork[], onDone: (a: Artwork) => void, isCancelled: () => boolean): Promise<Artwork[]> {
  const failed: Artwork[] = [];
  for (const a of arts) {
    if (isCancelled()) break;
    if (await ensureImage(a)) onDone(a);
    else failed.push(a);
  }
  return failed;
}

export const mb = (bytes: number) => (bytes / 1e6).toFixed(bytes < 1e7 ? 1 : 0);
