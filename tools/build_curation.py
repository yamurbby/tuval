"""Küratör notlarını (tools/curation/*.json) uygulama verisine dönüştürür.

Kullanım:  python3 tools/build_curation.py
Çıktı:     src/content/curation.generated.ts

Her "Yakından bak" ayrıntısı 8×8'lik bir ızgarada hücre aralığı olarak yazılır
(ör. "C4:D5" → sütun C–D, satır 4–5). Burada 0–1 arası kesirli bir dikdörtgene
çevrilir: { x, y, w, h }.
"""
import glob
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "content", "curation.generated.ts")


def rect(rng):
    a, b = rng.split(":")
    c0, r0 = ord(a[0]) - 65, int(a[1:]) - 1
    c1, r1 = ord(b[0]) - 65, int(b[1:]) - 1
    c0, c1 = sorted((c0, c1))
    r0, r1 = sorted((r0, r1))
    return {"x": c0 / 8, "y": r0 / 8, "w": (c1 - c0 + 1) / 8, "h": (r1 - r0 + 1) / 8}


def main():
    out = {}
    for f in sorted(glob.glob(os.path.join(ROOT, "tools", "curation", "*.json"))):
        for slug, v in json.load(open(f)).items():
            out[slug] = {
                "title": {"tr": v["tr"], "en": v["en"]},
                "note": v["note"],
                "details": [
                    {"id": f"d{i}", "rect": rect(d[0]),
                     "title": {"tr": d[1], "en": d[3]}, "text": {"tr": d[2], "en": d[4]}}
                    for i, d in enumerate(v["details"])
                ],
            }
    with open(OUT, "w") as fh:
        fh.write("// OTOMATİK ÜRETİLDİ — tools/build_curation.py. Elle düzenlemeyin; tools/curation/*.json dosyalarını düzenleyin.\n")
        fh.write("import type { Curation } from './types';\n\n")
        fh.write("export const CURATION: Record<string, Curation> = " + json.dumps(out, ensure_ascii=False) + ";\n")
    print(f"{len(out)} eser için küratör notu yazıldı → {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
