// Sergiler: her biri bir oda gibi — kısa bir giriş metni ve bir mühür rengi.
// Eser listesi tools/collection.json'dan gelir; buradaki sıra salondaki sıradır.
import type { ExhibitionId, L10n } from './types';

export interface Exhibition {
  id: ExhibitionId;
  title: L10n;
  /** Kısa alt başlık (dönem / bölge) */
  span: L10n;
  intro: L10n;
  /** Albüm mührü ve sergi vurgu rengi */
  seal: string;
  /** Mühür üzerindeki iki harf */
  mark: string;
}

export const EXHIBITIONS: Exhibition[] = [
  {
    id: 'japanese',
    title: { tr: 'Yüzen Dünya', en: 'The Floating World' },
    span: { tr: 'Japon ahşap baskıları · 18.–19. yüzyıl', en: 'Japanese woodblock prints · 18th–19th c.' },
    intro: {
      tr: 'Edo dönemi Japonya’sında “ukiyo-e”, yani yüzen dünyanın resimleri, şehir hayatının geçici zevklerini anlatırdı. Hokusai ve Hiroshige ile manzara, dalgalar ve yolculuklar baskıların konusu oldu.',
      en: 'In Edo-period Japan, ukiyo-e — pictures of the floating world — celebrated the fleeting pleasures of city life. With Hokusai and Hiroshige, landscapes, waves and journeys became their subject.',
    },
    seal: '#A3452F',
    mark: '浮',
  },
  {
    id: 'dutch',
    title: { tr: 'Hollanda Altın Çağı', en: 'The Dutch Golden Age' },
    span: { tr: 'Hollanda resmi · 17. yüzyıl', en: 'Dutch painting · 17th c.' },
    intro: {
      tr: 'Ticaretle zenginleşen Hollanda’da resim, kilise ve saraydan evlere taşındı. Vermeer’in sessiz odaları, Rembrandt’ın ışığı ve gündelik hayatın küçük anları bu odada.',
      en: 'In a Netherlands enriched by trade, painting moved from church and court into the home. Vermeer’s quiet rooms, Rembrandt’s light and small moments of daily life fill this room.',
    },
    seal: '#3E5A6E',
    mark: 'NL',
  },
  {
    id: 'impressionists',
    title: { tr: 'Işığın Peşinde', en: 'Chasing the Light' },
    span: { tr: 'İzlenimciler ve sonrası · 1860–1900', en: 'Impressionism and after · 1860–1900' },
    intro: {
      tr: 'İzlenimciler şövalelerini açık havaya çıkardı; konu artık ışığın kendisiydi. Monet’nin kıyıları, Degas’nın dansçıları ve Van Gogh’un titreşen fırça darbeleri.',
      en: 'The Impressionists took their easels outdoors; the real subject became light itself. Monet’s coasts, Degas’s dancers and Van Gogh’s vibrating brushwork.',
    },
    seal: '#5E7A4A',
    mark: 'Iz',
  },
  {
    id: 'stillLife',
    title: { tr: 'Sessiz Nesneler', en: 'Silent Objects' },
    span: { tr: 'Natürmort · 17.–19. yüzyıl', en: 'Still life · 17th–19th c.' },
    intro: {
      tr: 'Bir masa, birkaç meyve, bir kadeh. Natürmort, sıradan nesnelerle zenginliği, geçiciliği ve ressamın ustalığını anlatır; her yansıma bir sınavdır.',
      en: 'A table, some fruit, a glass. Still life uses ordinary things to speak of wealth, transience and the painter’s skill; every reflection is a test.',
    },
    seal: '#7A5A2E',
    mark: 'Nt',
  },
  {
    id: 'botanical',
    title: { tr: 'Bitkiler Kitabı', en: 'A Book of Plants' },
    span: { tr: 'Botanik çizimler · 16.–19. yüzyıl', en: 'Botanical art · 16th–19th c.' },
    intro: {
      tr: 'Bilim ile sanatın buluştuğu sayfalar: her yaprak, tohum ve böcek gözlemle çizildi. Hoefnagel’in minyatürlerinden Redouté’nin parşömenlerine.',
      en: 'Pages where science and art meet: every leaf, seed and insect drawn from observation. From Hoefnagel’s miniatures to Redouté’s vellums.',
    },
    seal: '#4F6B3A',
    mark: 'Bt',
  },
  {
    id: 'maps',
    title: { tr: 'Haritalar ve Şehirler', en: 'Maps and Cities' },
    span: { tr: 'Kartografya · 16.–19. yüzyıl', en: 'Cartography · 16th–19th c.' },
    intro: {
      tr: 'Dünyanın nasıl göründüğünü bilmek bir güç ve bir hayaldi. Kuşbakışı şehir planları, gök haritaları ve elle renklendirilmiş atlas sayfaları.',
      en: 'Knowing what the world looked like was both power and dream. Bird’s-eye city plans, celestial charts and hand-coloured atlas pages.',
    },
    seal: '#6E5233',
    mark: 'Hr',
  },
  {
    id: 'architecture',
    title: { tr: 'Roma ve Venedik', en: 'Rome and Venice' },
    span: { tr: 'Mimari görünümler · 18. yüzyıl', en: 'Architectural views · 18th c.' },
    intro: {
      tr: 'Büyük Tur’a çıkan gezginler eve Piranesi’nin gravürlerini ve Canaletto’nun kanal görünümlerini götürürdü. Antik yıkıntılar, meydanlar ve hayali hapishaneler.',
      en: 'Grand Tour travellers took home Piranesi’s etchings and Canaletto’s canal views. Ancient ruins, piazzas and imaginary prisons.',
    },
    seal: '#5A4E44',
    mark: 'RV',
  },
  {
    id: 'american',
    title: { tr: 'Yeni Dünya Manzaraları', en: 'New World Landscapes' },
    span: { tr: 'Hudson Nehri Okulu · 1830–1880', en: 'Hudson River School · 1830–1880' },
    intro: {
      tr: 'Thomas Cole ve izleyicileri Amerika’nın vahşi doğasını ulusal bir kimlik olarak resmetti. Fırtınalar, şelaleler ve altın ışıkta sonsuz vadiler.',
      en: 'Thomas Cole and his followers painted America’s wilderness as a national identity. Storms, waterfalls and endless valleys in golden light.',
    },
    seal: '#3F5F5A',
    mark: 'Hd',
  },
  {
    id: 'islamic',
    title: { tr: 'Saray Atölyeleri', en: 'Court Workshops' },
    span: { tr: 'İslam sanatı · 15.–17. yüzyıl', en: 'Islamic art · 15th–17th c.' },
    intro: {
      tr: 'Tebriz’den İstanbul’a, Agra’ya uzanan saray nakkaşhaneleri; minyatürler, tuğralar, halılar ve çiniler. Her sayfa, yüzlerce saatlik ince işçiliğin ürünü.',
      en: 'Court studios from Tabriz to Istanbul and Agra: miniatures, tughras, carpets and tiles. Every page the work of hundreds of hours of fine craft.',
    },
    seal: '#2F4F7A',
    mark: 'نق',
  },
  {
    id: 'renaissance',
    title: { tr: 'Rönesans’tan Baroka', en: 'Renaissance to Baroque' },
    span: { tr: 'Avrupa resmi · 1490–1770', en: 'European painting · 1490–1770' },
    intro: {
      tr: 'Botticelli’nin zarafetinden Bruegel’in tarlalarına, El Greco’nun fırtınalı göğünden Tiepolo’nun tavanlarına: Avrupa resminin üç yüzyılı.',
      en: 'From Botticelli’s grace to Bruegel’s fields, from El Greco’s stormy sky to Tiepolo’s ceilings: three centuries of European painting.',
    },
    seal: '#7A2F38',
    mark: 'Rn',
  },
];

export function getExhibition(id: string | undefined | null): Exhibition | undefined {
  return EXHIBITIONS.find((e) => e.id === id);
}

/** Bu ayın sergisi: her ay sıradaki oda öne çıkar. */
export function monthExhibition(d = new Date()): Exhibition {
  const n = d.getFullYear() * 12 + d.getMonth();
  return EXHIBITIONS[n % EXHIBITIONS.length];
}
