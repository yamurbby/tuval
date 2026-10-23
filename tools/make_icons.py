"""Tuval uygulama ikonlarını üretir (özgün çizim).

Kullanım: python3 tools/make_icons.py
Motif: kırık beyaz zemin üzerinde, sağ kenarında yapboz çıkıntısı ve üst kenarında yapboz
girintisi olan ada çayı yeşili bir tuval; ortasında EB Garamond "T".
"""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "node_modules", "@expo-google-fonts", "eb-garamond", "600SemiBold", "EBGaramond_600SemiBold.ttf")
PAPER = (250, 250, 247, 255)
SAGE = (79, 110, 92, 255)
OAK = (201, 162, 126, 255)
WHITE = (250, 250, 247, 255)
SS = 4  # süper örnekleme


def piece_mask(size, scale):
    """Yapboz-tuval şekli (beyaz=şekil). scale: tuval kenarı / ikon kenarı."""
    S = size * SS
    m = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(m)
    side = S * scale
    cx, cy = S / 2 - side * 0.04, S / 2  # çıkıntı sağda olduğu için hafif sola
    x0, y0, x1, y1 = cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2
    r = side * 0.06
    d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=255)
    tab = side * 0.17
    # sağ kenarda çıkıntı (boyun + baş)
    neck = tab * 0.62
    d.rectangle([x1 - 2, cy - neck / 2, x1 + tab * 0.5, cy + neck / 2], fill=255)
    d.ellipse([x1 + tab * 0.15, cy - tab * 0.66, x1 + tab * 1.45, cy + tab * 0.66], fill=255)
    # sol kenarda girinti (harfe değmesin diye sol kenar)
    d.rectangle([x0 - 2, cy - neck / 2, x0 + tab * 0.5, cy + neck / 2], fill=0)
    d.ellipse([x0 + tab * 0.25, cy - tab * 0.62, x0 + tab * 1.5, cy + tab * 0.62], fill=0)
    return m, (cx, cy, side)


def draw_icon(size, scale, bg=PAPER, fg=SAGE, letter=WHITE, line=OAK, shadow=True, mono=False):
    S = size * SS
    img = Image.new("RGBA", (S, S), bg if bg else (0, 0, 0, 0))
    mask, (cx, cy, side) = piece_mask(size, scale)
    if shadow and not mono:
        sh = Image.new("RGBA", (S, S), (60, 45, 30, 0))
        off = int(side * 0.025)
        shm = Image.new("L", (S, S), 0)
        shm.paste(mask, (off, off * 2))
        sh.putalpha(shm.point(lambda v: v * 0.22))
        img = Image.alpha_composite(img, sh)
    layer = Image.new("RGBA", (S, S), fg)
    layer.putalpha(mask)
    img = Image.alpha_composite(img, layer)
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, int(side * 0.66))
    txt = "T"
    bbox = d.textbbox((0, 0), txt, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    col = (0, 0, 0, 0) if mono else letter
    if mono:
        # tek renk: şekil beyaz, harf oyulmuş
        lm = Image.new("L", (S, S), 0)
        ImageDraw.Draw(lm).text((cx + side * 0.03 - tw / 2 - bbox[0], cy - th / 2 - bbox[1] - side * 0.05), txt, font=font, fill=255)
        a = img.getchannel("A")
        a = Image.composite(Image.new("L", (S, S), 0), a, lm)
        img.putalpha(a)
    else:
        d.text((cx + side * 0.03 - tw / 2 - bbox[0], cy - th / 2 - bbox[1] - side * 0.05), txt, font=font, fill=col)
        lw = side * 0.3
        ly = cy + side * 0.3
        d.rectangle([cx + side * 0.03 - lw / 2, ly, cx + side * 0.03 + lw / 2, ly + side * 0.022], fill=line)
    return img.resize((size, size), Image.LANCZOS)


def save(img, *parts):
    p = os.path.join(ROOT, *parts)
    img.save(p)
    print(p, img.size)


if __name__ == "__main__":
    save(draw_icon(1024, 0.56), "assets", "icon.png")
    save(draw_icon(512, 0.56), "public", "icons", "icon-512.png")
    save(draw_icon(192, 0.56), "public", "icons", "icon-192.png")
    save(draw_icon(180, 0.56).convert("RGB"), "public", "icons", "apple-touch-icon.png")
    save(draw_icon(512, 0.48), "public", "icons", "maskable-512.png")  # %80 güvenli alan
    save(draw_icon(48, 0.62, shadow=False), "assets", "favicon.png")
    # Android uyarlanabilir ikon: arka plan + ön plan (%66 güvenli alan) + tek renk
    save(Image.new("RGBA", (1024, 1024), PAPER), "assets", "android-icon-background.png")
    save(draw_icon(1024, 0.42, bg=None), "assets", "android-icon-foreground.png")
    save(draw_icon(1024, 0.42, bg=None, fg=(255, 255, 255, 255), mono=True), "assets", "android-icon-monochrome.png")
    save(draw_icon(1024, 0.5, bg=None), "assets", "splash-icon.png")
    fav = draw_icon(64, 0.62, shadow=False)
    fav.save(os.path.join(ROOT, "public", "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
