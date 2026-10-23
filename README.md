# Tuval — sanat eserlerinden yapbozlar (v3)

> Uygulamanın adı v3.1'de **Parça**'dan **Tuval**'e değişti. Kayıt anahtarları (`parca/...`) eski kayıtlar korunsun diye aynı bırakıldı.

Yetişkinlere yönelik, sakin, uzun oturumlu bir mobil yapboz uygulaması. Kamu malı müze eserleri 100–1000 parça arasında oynanır. Uygulama bir müze salonu gibi tasarlandı: sergiler, küratör notları ve tamamlanan eserlerin toplandığı bir albüm.

Expo SDK 58 + React Native + TypeScript + Expo Router ile yazıldı. iOS, Android ve web'de çalışır. 30 eser uygulamayla gelir ve internetsiz oynanır; 91 eser çevrimiçi koleksiyondadır, ilk açılışta indirilir ve sonra internetsiz açılır.

## Hızlı başlangıç

```bash
npm install
npx expo start              # telefondaki Expo Go ile QR kodu okut
npx expo start --android    # veya --ios / --web
npm test                    # oyun mantığı, yerleşim, yakınlaştırma testleri (11)
npm run typecheck
```

Expo Go sürümü SDK 58'i desteklemiyorsa geliştirme derlemesi alın: `npx expo run:android` / `npx expo run:ios`.

## Neler değişti (v2 → v3)

| Konu | v3 |
|---|---|
| İçerik | 121 kamu malı eser (The Met, CC0), 10 sergide: Yüzen Dünya, Hollanda Altın Çağı, Işığın Peşinde, Sessiz Nesneler, Bitkiler Kitabı, Haritalar ve Şehirler, Roma ve Venedik, Yeni Dünya Manzaraları, Saray Atölyeleri, Rönesans'tan Baroka |
| Uygulama içi / çevrimiçi | Her sergiden 3 eser uygulamayla gelir (19,7 MB). Kalan 91 eser sitede `/collection/` altında (55,7 MB); ilk açılışta indirilir. Sergi sayfasından toplu indirilebilir |
| Salon | Ana sayfada “Bu ayın sergisi” (her ay sıradaki sergi), spot ışığı altında çerçeveli eser, günün eseri, devam edenler, sergi listesi |
| Dergi | Sergi sayfası: giriş yazısı, her eser için kısa küratör notu. Eser sayfası: büyük harfle başlayan küratör notu, “Yakından bak” ayrıntıları, açılır künye |
| Yakından bak | Her eserde 2–3 ayrıntı bölgesi. Yapbozda bölgenin tüm parçaları yerleşince bir kart açılır; “Yakınlaştır” tahtayı o bölgeye götürür |
| Albüm | Sergi başına mühür, ilerleme çubuğu, tamamlanan eserler kart olarak; tamamlanmayanlar numaralı boş çerçeve |
| Tema | Sistem / Açık / Koyu. Salon duvarı (öne çıkan sergi, eser ve tamamlama ekranları) her temada koyudur |
| Masa düzeni (varsayılan) | Tahta ortada, parçalar çevresindeki masaya dağılır (dik ekranda üst ve alta). Parça masada serbestçe taşınır; komşusunun yanına bırakılınca birleşir, doğru yere yakın bırakılınca oturur. Kenar: kenar parçalarını tahtanın hemen yanına toplar. Karıştır: yeniden dağıtır. Eski sayfalı tepsi Ayarlar → Parça düzeni → Tepsi ile seçilebilir |
| Ortam sesi | Kapalı / Yağmur / Şömine / Piyano. Özgün, sentezlenmiş, dikişsiz WAV döngüler (`tools/ambient.py`); oyun sırasında çalar, duraklatınca ve arka planda susar. Duraklatma menüsünden de değiştirilir |
| Dil | Varsayılan Türkçe (önceden cihaz diline göre seçiliyordu). Ayarlar → Dil'den English seçilebilir |
| Düzeltme | Otomatik kayıt, süre sayacı her saniye ilerlediği için oyun sırasında sürekli erteleniyordu; artık en geç 1,2 saniyede yazılıyor. Web'de sekme kapanırken de kaydediliyor |

## Neler değişti (v1 → v2)

| Konu | v2 |
|---|---|
| İçerik | 11 kamu malı eser (The Met, CC0): tablo, manzara, natürmort, botanik, baskı, mimari, harita |
| Seviye | Kolay 100 · Orta 300 · Zor 500 · Uzman 750/1000 (cihaz belleğine göre) · Özel 100–1000 (50'şer adım) |
| Izgara | Eserin kendi en-boy oranından; hücreler kareye yakın, hedef sayıya en yakın (ör. 20×15 = 300) |
| Tahta | İki parmakla yakınlaştırma, tek parmakla kaydırma, çift dokunma, + / − / tümünü göster düğmeleri |
| Tepsi | Sayfalı; Tümü / Kenar / Grup / Renk (eserin kendi paleti) / Desen (sade–dokulu) filtreleri; karışık, renge göre, açıktan koyuya sıralama; kenarları otomatik öne alma |
| Gruplar | Tepside bir parçayı komşusunun üstüne bırakınca birleşirler; grup tek parça gibi taşınıp yerleştirilir |
| Geri bildirim | Yanlış yer: uyarı yok, parça sessizce tepsiye döner. Doğru yer: hafif tık sesi ve ince bir parıltı |
| Süre | Varsayılan olarak gizli; ayarlardan veya menüden açılır. Kapalıyken de kaydedilir |
| Tamamlama | Sade ekran; süre, hamle ve parça sayısı “Ayrıntıları göster” ile açılır |
| Görsel dil | EB Garamond + sistem yazı tipi; kâğıt kremi, mürekkep laciverti, koyu zeytin, taş, kiremit; ince çizgiler; yıldız, rozet ve sevimli ikon yok |

## Proje yapısı

```
src/
  app/                    Expo Router ekranları
    index.tsx             Salon: bu ayın sergisi, günün eseri, devam edenler, sergiler
    exhibition.tsx        Sergi: giriş yazısı, eserler + küratör notları, toplu indirme
    gallery.tsx           Tüm eserler: sergi sekmeleri
    level.tsx             Eser sayfası (dergi): küratör notu, Yakından bak, parça sayısı, açılır künye
    game.tsx              → features/game/GameScreen
    complete.tsx          Sade tamamlama ekranı (ayrıntılar isteğe bağlı)
    collection.tsx        Albüm: sergi başına kartlar, boş çerçeveler, ilerleme
    credits.tsx           Kaynaklar ve lisanslar (her eser için atıf, envanter no., bağlantı)
    settings.tsx          Tema, ortam sesi, oyun, geri bildirim, dil, erişilebilirlik
  game/                   SAF oyun mantığı (React'e bağımlı değil)
    types.ts              Hazır seviyeler, ızgara hesabı, oyun durumu
    cut.ts                Kesim: paylaşılan bezier kenarlar, dikiş yolu, grup kutuları
    engine.ts             Reducer: yerleştir, birleştir (komşuluk kontrolü), sessiz ıska, karıştır
    stats.ts              Parça renk/desen istatistikleri, tepsi filtreleme/sıralama, ton adları
  features/game/
    GameScreen.tsx        Görsel indirme kapısı + tepsi düzeni (sayfalı tepsi, filtreler)
    TableGame.tsx         Masa düzeni: dağınık parçalar, serbest taşıma, masada birleştirme
    parts.tsx             Ortak parçalar: menü, Yakından bak kartı, araç düğmeleri, oyun yaşam döngüsü
    layout.ts             Yerleşim + görünüm matematiği (odak çevresinde yakınlaştırma, sınırlar)
  components/             GroupView, Plate/Frame/Seal (levha, çerçeve, mühür), DetailCrop, DropCap, ui, Icon
  content/
    artworks.generated.ts tools/fetch_art.py çıktısı: künye, lisans, palet, RGB önizleme, görsel kaynakları
    curation.generated.ts tools/build_curation.py çıktısı: TR/EN başlık, küratör notu, Yakından bak
    exhibitions.ts        Sergiler: başlık, dönem, giriş yazısı, mühür rengi; bu ayın sergisi
    catalog.ts            Eser listesi, yerelleştirme, günün eseri (uygulama içi eserlerden)
    l10n.ts               Teknik ve tarih ifadelerinin Türkçesi
    download.ts           Çevrimiçi eserleri indirme
  feedback/               feedback.ts (tık/çan, titreşim), ambient.ts (ortam sesi)
  i18n/                   tr.ts (kaynak), en.ts
  storage/persist.ts      AsyncStorage v2: ayarlar, koleksiyon, kayıtlı oyunlar (eser:parça sayısı)
assets/art/               Uygulama içi eserler (2000 px) + LICENSES.md
assets/previews/          Tüm eserler için 560 px önizleme (listeler internetsiz görünür)
public/collection/        Çevrimiçi eserler (siteyle birlikte yayınlanır)
assets/sounds/            Efektler + ambient-salon.mp3, ambient-rain.mp3
tools/collection.json     Sergiler ve Met nesne numaraları (uygulama içi / çevrimiçi), kırpma ayarları
tools/curation/*.json     Küratör notları (sergi başına); ızgara hücreleriyle (A–H × 1–8) ayrıntı bölgeleri
tools/fetch_art.py        Eserleri indirip lisansını doğrulayan betik
tools/build_curation.py   Küratör notlarını uygulama verisine çevirir
tools/write_licenses.py   LICENSES.md dosyalarını üretir
tools/ambient.py          Ortam seslerini sentezler
tests/engine.test.ts
```

## Teknik notlar

- **Net yakınlaştırma:** Hareket sırasında tahtaya geçici bir dönüşüm (transform) uygulanır. Parmak kalkınca yeni `viewBox` ile tahta keskin olarak yeniden çizilir. Görseller 2400 px olduğu için yakın planda da ayrıntı kaybolmaz.
- **Performans:** Yerleşen parçalar tek bir görsel üzerinde satır satır kırpma yollarıyla çizilir, yani 1000 parça için 1000 görsel öğesi oluşmaz. Tepside her sayfada yalnızca 10–28 öğe çizilir. Web'de 500 ve 1000 parçalık oyun yaklaşık 1,1 saniyede açıldı.
- **Parça istatistikleri:** Derleme sırasında üretilen 128 px'lik ham RGB önizlemeden hesaplanır. Cihazda piksel okumak gerekmez.
- **Bırakma toleransı:** Uzaklaştırılmış görünümde parmak hassasiyetine göre genişler (en az 12 ekran pikseli), ama komşu hücreyi kabul edecek kadar genişlemez.
- **Otomatik kayıt:** Değişiklikler en geç 1,2 saniyede, uygulama arka plana geçerken ve web'de sekme kapanırken anında kaydedilir. Her eser ve parça sayısı ikilisi için ayrı kayıt tutulur.
- **Çevrimiçi koleksiyon:** Web/PWA'da eser görselleri `/collection/` altından gelir. Service worker bunları önceden indirmez; ilk açılışta `parca-collection-v1` adlı kalıcı önbelleğe yazar (uygulama güncellense de silinmez). Görsel inmeden oyun başlamaz; bağlantı yoksa “Tekrar dene” ekranı çıkar. Yerel Android/iOS derlemesinde `app.json → expo.extra.collectionBaseUrl` alanına sitenin adresi (ör. `https://parca.netlify.app`) yazılmalı; boşsa müzenin kendi küçük görseli kullanılır.
- **Web:** Oyun alanında tarayıcının kaydırma ve geri hareketleri kapatılır. Uçtan uca testler için `window.__parca` salt okunur bir durum özeti sunar; bu yalnızca web'de vardır.

## İçerik ve lisans

`python3 tools/fetch_art.py` betiği her eser için The Met API'sini sorgular. `isPublicDomain` değeri `true` değilse eser eklenmez. Başlık, sanatçı, tarih, teknik, boyut, edinim bilgisi, envanter no., kaynak URL, lisans (CC0 1.0), atıf, doğrulama tarihi ve SHA-256 değeri metadata'ya yazılır. Uygulamada bu bilgiler eser sayfasında ve **Koleksiyonum → Kaynaklar ve lisanslar** bölümünde görünür. Yazı tipi EB Garamond, SIL OFL 1.1 lisanslıdır.

Yeni eser eklemek için `tools/collection.json` içinde ilgili serginin `bundled` ya da `online` listesine Met nesne numarasını ekleyin ve `tools/curation/<sergi>.json` dosyasına başlık, not ve ayrıntıları yazın. Sonra sırayla `python3 tools/fetch_art.py`, `python3 tools/build_curation.py`, `python3 tools/write_licenses.py` çalıştırın. `fetch_art.py`, `collectionapi.metmuseum.org` ve `images.metmuseum.org` adreslerine ağ erişimi ister. Küratör notları ve Yakından bak metinleri bu proje için yazılmıştır; müze metinlerinden kopyalanmamıştır.

## Test edilenler

Web derlemesi Playwright ile ve gerçek dokunma olaylarıyla (CDP) 320×568, 360×640, 412×915 ve 800×360 boyutlarında denendi. Hiçbir ekranda yatay taşma yok. Doğrulananlar:

- tepsiden tahtaya sürükleme
- yanlış yere bırakınca sessiz geri dönüş
- parça birleştirme ve grubu yerleştirme
- iki parmakla yakınlaştırma, kaydırma, tümünü gösterme
- filtreler ve sıralama
- referans görsel ve duraklatma menüsü
- sayfa yenilendikten sonra kaldığı yerden devam
- 99 parçalık bir yapbozu baştan sona tamamlama ve koleksiyona kayıt
- 500 ve 1000 parçada sürükleyerek doğru yerleştirme
- masa düzeni: 100/300/1000 parçada açılış, sürükleyip yerine oturtma, masada taşıma, komşuyla birleştirme, pan/pinch, kaldığı yerden devam; 99 parçalık yapbozu masada bitirip albüme kaydetme
- v3: açık ve koyu temada salon, sergi, eser, albüm, ayarlar ekranları (taşma yok, sayfa hatası yok)
- v3: çevrimiçi eserin indirilip oynanması; sunucu kapalıyken “Tekrar dene”, açılınca oyunun başlaması
- v3: “Yakından bak” bölgesinin son parçası yerleşince kartın açılması ve “Yakınlaştır”

Gerçek iOS/Android cihazda henüz denenmedi. Ortam sesleri dinlenerek değil, ölçülerek (seviye, döngü dikişi) kontrol edildi; telefonda bir kez dinleyip ses seviyesini değerlendirmek iyi olur. Özellikle 1000 parçada eski Android cihazlarda performans ölçülmeli.

## Android APK oluşturma (Expo Go gerekmez)

**Android Studio ile, kendi bilgisayarında (Windows):**

1. Projeyi kısa bir yola taşı (Windows'ta 260 karakter yol sınırına takılmamak için), örneğin `C:\parca`.
2. PowerShell'de:
   ```powershell
   cd C:\parca
   npm install
   $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   npx expo prebuild --platform android
   cd android
   .\gradlew assembleRelease
   ```
3. APK: `android\app\build\outputs\apk\release\app-release.apk`. Telefona kopyalayıp aç; "bilinmeyen kaynaklardan yükleme" iznini ver.

Alternatif: `android` klasörünü Android Studio'da aç → **Build › Generate App Bundles or APKs › Generate APKs**. Telefon USB hata ayıklamayla bağlıysa `npx expo run:android --variant release` doğrudan kurar.

Not: Bu APK, Expo şablonunun hata ayıklama anahtarıyla imzalanır; kişisel kullanım ve test içindir. Play Store için kendi imza anahtarını oluşturman gerekir.

**Bulutta (EAS, ücretsiz Expo hesabı ile):** `npx eas-cli@latest build -p android --profile apk` → bittiğinde APK indirme bağlantısı verir.

## PWA → Android uygulaması (PWABuilder ile, Android Studio gerekmez)

1. `npm run build:pwa` → `dist/` klasörü kurulabilir, internetsiz çalışan bir PWA olur (manifest, service worker, ikonlar, `_redirects`).
2. `dist` klasörünü https://app.netlify.com/drop sayfasına sürükle → `https://…netlify.app` adresi verir.
3. https://www.pwabuilder.com → adresi yapıştır → **Package for stores → Android → Generate** → zip'i indir.
4. Zip içindeki APK'yı telefona kur (test için). Play Store için `.aab` dosyası kullanılır.
5. Adres çubuğunun görünmemesi için zip'teki `assetlinks.json` dosyasını `dist/.well-known/assetlinks.json` olarak kopyalayıp `dist` klasörünü Netlify'a yeniden sürükle.

Not: Siteyi kök adreste (`/`) yayınla; alt klasörde (ör. GitHub Pages proje sayfası) yol ayarı gerekir.
