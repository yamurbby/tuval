// Web derlemesini (dist/) kurulabilir, çevrimdışı çalışan bir PWA'ya dönüştürür.
// Kullanım: npm run build:pwa   (expo export + bu betik)
//  * index.html'e manifest, tema rengi ve service worker kaydı eklenir
//  * sw.js: tüm dosyaları (eserler, yazı tipleri, sesler) önbelleğe alır → internetsiz oynanır
//  * _redirects: Netlify'da /game?... gibi derin bağlantılar yenilenince index.html'e düşer
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = join(process.cwd(), 'dist');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// Netlify, yüklemede "node_modules" adlı klasörleri atlar → yazı tipleri 404 olur.
// Bu klasörü "assets/vendor" olarak yeniden adlandırıp tüm başvuruları güncelle.
const NM = join(DIST, 'assets', 'node_modules');
if (existsSync(NM)) {
  renameSync(NM, join(DIST, 'assets', 'vendor'));
  for (const f of walk(DIST)) {
    if (!/\.(js|html|json|css)$/.test(f)) continue;
    const txt = readFileSync(f, 'utf8');
    if (txt.includes('/assets/node_modules/')) writeFileSync(f, txt.split('/assets/node_modules/').join('/assets/vendor/'));
  }
}

const files = walk(DIST)
  .map((p) => '/' + relative(DIST, p).split(sep).join('/'))
  .filter((p) => !['/sw.js', '/_redirects', '/metadata.json'].includes(p) && !p.startsWith('/.well-known/'))
  // Çevrimiçi koleksiyon önceden indirilmez: eser ilk açıldığında kalıcı önbelleğe yazılır
  .filter((p) => !p.startsWith('/collection/'));

const hash = createHash('sha256');
for (const f of files.sort()) hash.update(f + statSync(join(DIST, f)).size);
const version = hash.digest('hex').slice(0, 12);

const sw = `// OTOMATİK ÜRETİLDİ — tools/make-pwa.mjs
const CACHE = 'tuval-${version}';
// İndirilen çevrimiçi eserler sürüm güncellemesinde silinmesin diye ayrı ve kalıcı önbellekte
const ART = 'parca-collection-v1';
const FILES = ${JSON.stringify(['/', ...files.filter((f) => f !== '/index.html'), '/index.html'])};

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      // Tek tek ekle: bir dosya başarısız olsa bile diğerleri önbelleğe girer
      await Promise.all(FILES.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => {})));
      await self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== ART).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/collection/')) {
    e.respondWith(
      caches.open(ART).then((c) =>
        c.match(url.pathname).then(
          (hit) =>
            hit ||
            fetch(url.pathname).then((res) => {
              if (res.ok) c.put(url.pathname, res.clone());
              return res;
            }),
        ),
      ),
    );
    return;
  }
  // Sayfa gezinmeleri: önbellekteki uygulama kabuğu (rota ne olursa olsun)
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
`;
writeFileSync(join(DIST, 'sw.js'), sw);
writeFileSync(join(DIST, '_redirects'), '/* /index.html 200\n');

const indexPath = join(DIST, 'index.html');
let html = readFileSync(indexPath, 'utf8');
const head = `
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="#FAFAF7" />
    <!-- Uygulamanın kendi koyu teması var: tarayıcının otomatik karartması uygulanmasın -->
    <meta name="color-scheme" content="light dark" />
    <style>:root { color-scheme: light dark; }</style>
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Tuval" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
      }
    </script>
`;
if (!html.includes('rel="manifest"')) html = html.replace('</head>', head + '  </head>');
html = html.replace('<html lang="en">', '<html lang="tr">');
// Çentikli ekranlar için tam ekran
html = html.replace(/<meta name="viewport" content="([^"]*)"/, (m, c) => (c.includes('viewport-fit') ? m : `<meta name="viewport" content="${c}, viewport-fit=cover"`));
writeFileSync(indexPath, html);

const total = files.reduce((s, f) => s + statSync(join(DIST, f)).size, 0);
const coll = walk(DIST).filter((p) => p.includes(`${sep}collection${sep}`));
const collMb = coll.reduce((s, f) => s + statSync(f).size, 0) / 1e6;
console.log(`PWA hazır: ${files.length} dosya önbelleğe alınacak (${(total / 1e6).toFixed(1)} MB), sürüm ${version}`);
console.log(`Çevrimiçi koleksiyon: ${coll.length} dosya (${collMb.toFixed(1)} MB) — ilk açılışta indirilir`);
