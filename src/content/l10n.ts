// Müze verisindeki İngilizce teknik ve tarih ifadelerinin Türkçe karşılıkları.
// Bilinmeyen bir ifade çıkarsa özgün metin gösterilir (uydurma çeviri yok).

const MEDIUM_TR: Record<string, string> = {
  'Oil on canvas': 'Tuval üzerine yağlıboya',
  'Oil on wood': 'Ahşap üzerine yağlıboya',
  'Oil on oak': 'Meşe pano üzerine yağlıboya',
  'Tempera and gold on wood': 'Ahşap üzerine tempera ve altın',
  'Tempera and oil on canvas': 'Tuval üzerine tempera ve yağlıboya',
  'Woodblock print; ink and color on paper': 'Ahşap baskı; kâğıt üzerine mürekkep ve renk',
  'Woodblock print (nishiki-e)': 'Renkli ahşap baskı (nishiki-e)',
  Woodcut: 'Ağaç baskı',
  Etching: 'Asitle gravür',
  Engraving: 'Kalem gravür',
  Lithograph: 'Taş baskı (litografi)',
  'Etching, hand colored': 'Elle renklendirilmiş asitle gravür',
  'Hand-colored etching': 'Elle renklendirilmiş asitle gravür',
  'Etching with hand coloring': 'Elle renklendirilmiş asitle gravür',
  'Hand-colored engraving': 'Elle renklendirilmiş kalem gravür',
  'Etching and engraving, hand-colored on laid paper': 'Asitle ve kalem gravür, vergeli kâğıt üzerine elle renklendirilmiş',
  'Etching with some engraving; undescribed state': 'Asitle gravür, kısmen kalem gravür',
  'Etching, sixteen separate sheets joined and backed on linen': 'Asitle gravür; on altı pafta birleştirilip kumaşa yapıştırılmış',
  'Etching, engraving, sulphur tint or open bite, burnishing; first state of four (Robison)':
    'Asitle gravür, kalem gravür, kükürt tonu, perdah; dört durumun ilki',
  'Etching, undescribed first state with address of Bouchard': 'Asitle gravür; Bouchard adresli ilk durum',
  'Line engraving with watercolor and gouache, text printed in gold ink': 'Kalem gravür, suluboya ve guaj; yazı altın mürekkeple basılmış',
  'Aquatint and stipple engraving printed in color with hand coloring': 'Renkli akuatint ve noktalama gravür, elle renklendirilmiş',
  'Color stipple engraving': 'Renkli noktalama gravür',
  'Pen and black ink, brush and gray wash, watercolor, over graphite': 'Grafit üzerine kalem ve siyah mürekkep, gri lavi, suluboya',
  'Watercolor, gouache, and shell gold on vellum': 'Parşömen üzerine suluboya, guaj ve kabuk altını',
  'Watercolor and gilt on vellum': 'Parşömen üzerine suluboya ve yaldız',
  'watercolor on vellum': 'Parşömen üzerine suluboya',
  'Watercolor, white gouache, on vellum': 'Parşömen üzerine suluboya ve beyaz guaj',
  'Watercolor and gouache, over black chalk': 'Siyah tebeşir üzerine suluboya ve guaj',
  'Watercolor and gouache over traces of black chalk': 'Siyah tebeşir izleri üzerine suluboya ve guaj',
  'Bodycolor (gouache) on vellum': 'Parşömen üzerine guaj',
  'Watercolor on parchment': 'Parşömen üzerine suluboya',
  'Ink, opaque watercolor, and gold on paper': 'Kâğıt üzerine mürekkep, opak suluboya ve altın',
  'Opaque watercolor, ink, silver, and gold on paper': 'Kâğıt üzerine opak suluboya, mürekkep, gümüş ve altın',
  'Ink, opaque watercolor, silver, and gold on paper': 'Kâğıt üzerine mürekkep, opak suluboya, gümüş ve altın',
  'Wool (warp, weft and pile); symmetrically knotted pile': 'Yün (çözgü, atkı ve hav); simetrik (Türk) düğüm',
  'Silk (warp and weft), wool (pile), cotton (pile); asymmetrically knotted pile':
    'İpek (çözgü ve atkı), yün ve pamuk (hav); asimetrik düğüm',
  'Main support: ink on paper\r\nBorder: Gold, ink, and opaque watercolor on paper':
    'Kâğıt üzerine mürekkep; bordür: altın, mürekkep ve opak suluboya',
  'Stonepaste; painted and polychrome glazed (cuerda seca technique)': 'Taş macunu; boyalı, çok renkli sırlı (cuerda seca tekniği)',
};

export function mediumTr(en: string): string {
  return MEDIUM_TR[en] ?? MEDIUM_TR[en.trim()] ?? en;
}

const MONTHS: Record<string, string> = {
  January: 'Ocak', February: 'Şubat', March: 'Mart', April: 'Nisan', May: 'Mayıs', June: 'Haziran',
  July: 'Temmuz', August: 'Ağustos', September: 'Eylül', October: 'Ekim', November: 'Kasım', December: 'Aralık',
};

const centuryTr = (s: string) => s.replace(/(\d+)(st|nd|rd|th)/g, '$1.');

/** "ca. 1830–32" → "y. 1830–32", "late 1720s" → "1720’lerin sonu" … */
export function dateTr(en: string): string {
  let s = en.trim();
  if (!s) return s;
  const special: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^dated (\d+) AH\/(.+) CE$/, (m) => `H. ${m[1]} / M. ${m[2]} tarihli`],
    [/^recto: (.+); verso: (.+)$/, (m) => `ön yüz: ${dateTr(m[1])}; arka yüz: ${dateTr(m[2])}`],
    [/^(\w+) (\d+), (\d{4})$/, (m) => (MONTHS[m[1]] ? `${m[2]} ${MONTHS[m[1]]} ${m[3]}` : m[0])],
    [/^(\d+)th month (\d{4})$/, (m) => `${m[2]}, ${m[1]}. ay`],
    [/^late (\d{4})s$/, (m) => `${m[1]}’lerin sonu`],
    [/^(\d{4})s$/, (m) => `${m[1]}’ler`],
    [/^after (\d{4})$/, (m) => `${m[1]} sonrası`],
    [/^(\d{4}) or (\d{4})$/, (m) => `${m[1]} veya ${m[2]}`],
    [/^late (\d+\w\w)–early (\d+\w\w) century$/, (m) => `${centuryTr(m[1])} yüzyıl sonu – ${centuryTr(m[2])} yüzyıl başı`],
    [/^late (\d+\w\w)–mid-(\d+\w\w) century$/, (m) => `${centuryTr(m[1])} yüzyıl sonu – ${centuryTr(m[2])} yüzyıl ortası`],
    [/^mid-(\d+\w\w) century$/, (m) => `${centuryTr(m[1])} yüzyıl ortası`],
    [/^(\d+\w\w) century$/, (m) => `${centuryTr(m[1])} yüzyıl`],
    [/^probably early (\d{4})s$/, (m) => `muhtemelen ${m[1]}’lerin başı`],
  ];
  for (const [re, f] of special) {
    const m = s.match(re);
    if (m) return f(m);
  }
  s = s.replace(/^probably /, 'muhtemelen ').replace(/^possibly /, 'muhtemelen ').replace(/\bca\. /g, 'y. ');
  return s;
}
