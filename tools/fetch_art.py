"""Parça koleksiyonunu The Met Open Access API'sinden indirir ve lisansını doğrular.

Kullanım:  python3 tools/fetch_art.py
Gereken:   Pillow, numpy;  ağ erişimi: collectionapi.metmuseum.org, images.metmuseum.org

Her eser için:
  * Nesne API'si sorgulanır; `isPublicDomain` true değilse eser EKLENMEZ.
  * Tam çözünürlüklü `primaryImage` indirilir, uzun kenar 2400 px olacak şekilde
    küçültülüp assets/art/<slug>.jpg olarak kaydedilir.
  * Tepsi filtreleri için 128 px ham RGB önizleme ve 6 renkli palet hesaplanır.
  * Başlık, sanatçı, tarih, teknik, kaynak URL, lisans ve atıf
    src/content/artworks.generated.ts dosyasına yazılır.
"""
import base64
import hashlib
import io
import json
import os
import sys
import time
import urllib.request

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_IMG = os.path.join(ROOT, "assets", "art")            # uygulamayla gelen eserler
OUT_ONLINE = os.path.join(ROOT, "public", "collection")  # çevrimiçi koleksiyon (sitede yayınlanır)
OUT_PREV = os.path.join(ROOT, "assets", "previews")      # tüm eserler için küçük önizleme
OUT_TS = os.path.join(ROOT, "src", "content", "artworks.generated.ts")
LONG_SIDE = 2000
PREVIEW = 560
THUMB = 64
CONFIG = json.load(open(os.path.join(ROOT, "tools", "collection.json")))
CACHE = os.path.join(ROOT, ".art-cache")  # indirilen özgün dosyalar (git dışı)

API = "https://collectionapi.metmuseum.org/public/collection/v1/objects/{}"
LICENSE = {
    "name": "CC0 1.0 — Kamu malı (The Met Open Access)",
    "url": "https://creativecommons.org/publicdomain/zero/1.0/",
    "policyUrl": "https://www.metmuseum.org/hubs/open-access",
}


def get(url, binary=False, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Parca-puzzle-builder/1.0"})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
                return data if binary else json.loads(data)
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            time.sleep(2 + i * 2)


def trim_dark_border(img, thresh=40, max_frac=0.06):
    """Fotoğraf çekiminden kalan koyu arka plan/çerçeve şeritlerini kırpar (eserin kendisine dokunmaz)."""
    g = np.asarray(img.convert("L"), dtype=np.float32)
    h, w = g.shape
    def edge(lines, limit):
        n = 0
        for line in lines:
            if n >= limit or np.percentile(line, 90) > thresh:
                break
            n += 1
        return n
    top = edge((g[i] for i in range(h)), int(h * max_frac))
    bottom = edge((g[h - 1 - i] for i in range(h)), int(h * max_frac))
    left = edge((g[:, i] for i in range(w)), int(w * max_frac))
    right = edge((g[:, w - 1 - i] for i in range(w)), int(w * max_frac))
    if top + bottom + left + right == 0:
        return img
    m = 2  # kenarda ince koyu çizgi kalmasın
    return img.crop((left + m if left else 0, top + m if top else 0, w - (right + m if right else 0), h - (bottom + m if bottom else 0)))


def palette(img, k=6, seed=1):
    a = np.asarray(img.convert("RGB").resize((64, 64)), dtype=np.float32).reshape(-1, 3)
    rng = np.random.default_rng(seed)
    c = a[rng.choice(len(a), k, replace=False)]
    for _ in range(25):
        d = ((a[:, None, :] - c[None]) ** 2).sum(-1)
        lab = d.argmin(1)
        for j in range(k):
            m = a[lab == j]
            if len(m):
                c[j] = m.mean(0)
    counts = np.bincount(lab, minlength=k)
    order = np.argsort(-counts)
    out = []
    for j in order:
        if counts[j] < len(a) * 0.03:
            continue
        r, g, b = [int(round(v)) for v in c[j]]
        hx = f"#{r:02X}{g:02X}{b:02X}"
        # birbirine çok yakın tonları ele
        if all(sum((int(hx[i:i + 2], 16) - int(o[i:i + 2], 16)) ** 2 for i in (1, 3, 5)) > 900 for o in out):
            out.append(hx)
    return out


def clean_dimensions(d):
    """'46 7/8 x 63 3/4 in. (119 x 162 cm)' → '119 × 162 cm'"""
    import re
    m = re.findall(r"\(([\d.,\s×x]+cm)\)", d or "")
    return m[0].replace(" x ", " × ") if m else ""


def process(oid, category, bundled):
    meta = get(API.format(oid))
    if not meta.get("isPublicDomain"):
        print(f"ATLANDI (kamu malı değil): {oid} {meta.get('title')}")
        return None
    url = meta.get("primaryImage")
    if not url:
        print(f"ATLANDI (görsel yok): {oid}")
        return None
    slug = CONFIG["legacySlugs"].get(str(oid), f"met-{oid}")
    os.makedirs(CACHE, exist_ok=True)
    cpath = os.path.join(CACHE, f"{oid}.jpg")
    if not os.path.exists(cpath):
        open(cpath, "wb").write(get(url, binary=True))
    img = Image.open(cpath).convert("RGB")
    crop = CONFIG.get("crops", {}).get(str(oid))
    if crop:  # fotoğraftaki renk kartı / çerçeve şeritleri (oranlar: sol, üst, sağ, alt)
        W, H = img.size
        img = img.crop((round(crop[0] * W), round(crop[1] * H), round(crop[2] * W), round(crop[3] * H)))
    img = trim_dark_border(img)
    ow, oh = img.size
    scale = LONG_SIDE / max(ow, oh)
    if scale < 1:
        img = img.resize((round(ow * scale), round(oh * scale)), Image.LANCZOS)
    w, h = img.size
    out_dir = OUT_IMG if bundled else OUT_ONLINE
    path = os.path.join(out_dir, f"{slug}.jpg")
    img.save(path, "JPEG", quality=84, optimize=True, progressive=True)
    prev = img.copy(); prev.thumbnail((PREVIEW, PREVIEW), Image.LANCZOS)
    prev.save(os.path.join(OUT_PREV, f"{slug}.jpg"), "JPEG", quality=80, optimize=True)
    tw, th = (THUMB, max(1, round(THUMB * h / w))) if w >= h else (max(1, round(THUMB * w / h)), THUMB)
    thumb = img.resize((tw, th), Image.BOX)
    artist = (meta.get("artistDisplayName") or "").strip() or ("Anonim" if True else "")
    return {
        "id": slug,
        "objectId": oid,
        "category": category,
        "bundled": bundled,
        "remotePath": None if bundled else f"/collection/{slug}.jpg",
        "fileSize": os.path.getsize(path),
        "title": meta.get("title", "").strip(),
        "artist": artist,
        "artistBio": (meta.get("artistDisplayBio") or "").strip(),
        "culture": (meta.get("culture") or "").strip(),
        "date": (meta.get("objectDate") or "").strip(),
        "medium": (meta.get("medium") or "").strip(),
        "dimensions": clean_dimensions(meta.get("dimensions")),
        "department": meta.get("department", ""),
        "accession": meta.get("accessionNumber", ""),
        "creditLine": meta.get("creditLine", ""),
        "institution": "The Metropolitan Museum of Art, New York",
        "sourceUrl": meta.get("objectURL") or f"https://www.metmuseum.org/art/collection/search/{oid}",
        "apiUrl": API.format(oid),
        "originalImageUrl": url,
        "fallbackImageUrl": meta.get("primaryImageSmall") or url,
        "originalSize": [ow, oh],
        "license": LICENSE["name"],
        "licenseUrl": LICENSE["url"],
        "licensePolicyUrl": LICENSE["policyUrl"],
        "verifiedPublicDomain": True,
        "verifiedAt": time.strftime("%Y-%m-%d"),
        "attribution": f"{artist}, “{meta.get('title','').strip()}”, {meta.get('objectDate','')}. "
                       f"The Metropolitan Museum of Art, {meta.get('creditLine','')}. CC0 1.0.",
        "width": w,
        "height": h,
        "aspect": round(w / h, 5),
        "sha256": hashlib.sha256(open(path, "rb").read()).hexdigest(),
        "palette": palette(img),
        "thumb": {"w": tw, "h": th, "rgb": base64.b64encode(thumb.tobytes()).decode()},
    }


def main():
    import concurrent.futures as cf
    for d in (OUT_IMG, OUT_ONLINE, OUT_PREV):
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            if f.endswith(".jpg"):
                os.remove(os.path.join(d, f))
    jobs = []
    for ex in CONFIG["exhibitions"]:
        for oid in ex["bundled"]:
            jobs.append((oid, ex["id"], True))
        for oid in ex["online"]:
            jobs.append((oid, ex["id"], False))
    with cf.ThreadPoolExecutor(6) as pool:
        results = list(pool.map(lambda j: process(*j), jobs))
    entries = [r for r in results if r]
    for e in entries:
        print(f"{'APP ' if e['bundled'] else 'WEB '} {e['id']:24s} {e['width']}x{e['height']} {e['fileSize']//1024} KB  {e['title'][:50]}")

    lines = [
        "// OTOMATİK ÜRETİLDİ — tools/fetch_art.py. Elle düzenlemeyin.",
        "// Kaynak: The Met Open Access API. Yalnızca isPublicDomain=true doğrulanan eserler.",
        "import type { ArtworkMeta } from './types';",
        "",
        "export const ARTWORK_META: ArtworkMeta[] = " + json.dumps(entries, ensure_ascii=False) + ";",
        "",
        "/** Uygulamayla gelen tam çözünürlüklü görseller */",
        "export const ARTWORK_IMAGES: Record<string, number> = {",
    ]
    for e in entries:
        if e["bundled"]:
            lines.append(f"  '{e['id']}': require('../../assets/art/{e['id']}.jpg'),")
    lines += ["};", "", "/** Tüm eserler için küçük önizlemeler (listeler internetsiz görünür) */", "export const ARTWORK_PREVIEWS: Record<string, number> = {"]
    for e in entries:
        lines.append(f"  '{e['id']}': require('../../assets/previews/{e['id']}.jpg'),")
    lines.append("};\n")
    with open(OUT_TS, "w") as fh:
        fh.write("\n".join(lines))
    app = sum(e["fileSize"] for e in entries if e["bundled"]) / 1e6
    web = sum(e["fileSize"] for e in entries if not e["bundled"]) / 1e6
    print(f"{len(entries)} eser yazıldı → uygulama içi {app:.1f} MB, çevrimiçi {web:.1f} MB")


if __name__ == "__main__":
    sys.exit(main())
