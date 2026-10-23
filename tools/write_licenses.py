"""assets/art/LICENSES.md ve public/collection/LICENSES.md dosyalarını üretir.

Kullanım: python3 tools/write_licenses.py   (fetch_art.py'den sonra)
Veri src/content/artworks.generated.ts içinden okunur.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TS = os.path.join(ROOT, "src", "content", "artworks.generated.ts")


def main():
    src = open(TS).read()
    meta = json.loads(src.split("ARTWORK_META: ArtworkMeta[] = ")[1].split(";\n")[0])
    cfg = json.load(open(os.path.join(ROOT, "tools", "collection.json")))
    order = [e["id"] for e in cfg["exhibitions"]]
    meta.sort(key=lambda m: order.index(m["category"]))
    head = [
        "# Eser görselleri — kaynak ve lisans",
        "",
        "Tüm görseller The Metropolitan Museum of Art Open Access programından alınmıştır.",
        "Her eser için `isPublicDomain: true` durumu müze API'sinden doğrulanmıştır (tools/fetch_art.py);",
        "doğrulanamayan hiçbir eser koleksiyona eklenmez.",
        "Lisans: CC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/",
        "Müze politikası: https://www.metmuseum.org/hubs/open-access",
        "",
        f"Toplam {len(meta)} eser: {sum(m['bundled'] for m in meta)} uygulama içi (assets/art), "
        f"{sum(not m['bundled'] for m in meta)} çevrimiçi (public/collection).",
        "",
        "| Sergi | Dosya | Eser | Sanatçı | Tarih | Envanter | Kaynak | Doğrulama |",
        "|---|---|---|---|---|---|---|---|",
    ]
    rows = []
    for m in meta:
        loc = "assets/art" if m["bundled"] else "public/collection"
        title = m["title"].replace("|", "/")
        rows.append(f"| {m['category']} | {loc}/{m['id']}.jpg | {title} | {m['artist']} | {m['date']} | {m['accession']} | {m['sourceUrl']} | {m['verifiedAt']} |")
    tail = [
        "",
        "Görseller, fotoğraf çekiminden kalan koyu kenar şeritleri ve renk kartları kırpılıp uzun kenarı 2000 px olacak şekilde "
        "küçültülmüştür; eserin kendisi değiştirilmemiştir. Küratör notları ve “Yakından bak” metinleri Parça için yazılmıştır.",
        "",
    ]
    text = "\n".join(head + rows + tail)
    for p in (os.path.join(ROOT, "assets", "art", "LICENSES.md"), os.path.join(ROOT, "public", "collection", "LICENSES.md")):
        open(p, "w").write(text)
    print(f"{len(meta)} satır yazıldı")


if __name__ == "__main__":
    main()
