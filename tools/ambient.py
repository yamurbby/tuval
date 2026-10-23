"""Özgün, dikişsiz döngüsel ortam sesleri üretir: yağmur, şömine, sakin piyano.

Kullanım: python3 tools/ambient.py   → assets/sounds/ambient-{rain,fire,piano}.wav
Gereken: numpy, scipy
Tamamen sentezlenmiştir; kayıt ya da üçüncü taraf ses içermez.

Dikişsizlik: her ses L saniyelik bir döngü için üretilir; döngü sonunu aşan kuyruklar
(yankı, sönümlenen notalar, olaylar) başa katlanır — böylece döngü başa sardığında hiçbir
kesinti ya da tık olmaz. MP3 kodlayıcıları döngüye kısa sessizlik eklediği için WAV kullanılır.
"""
import os
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 22050
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "sounds")
rng = np.random.default_rng(11)


def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output="sos"), x)


def filt_loop(x, kind, f, order=2):
    """Döngü sinyali için filtre: iki tur çalıştırılıp ikinci tur alınır (geçiş durumu döngüyle uyumlu)."""
    y = filt(np.concatenate([x, x]), kind, f, order)
    return y[len(x) :]


def periodic_noise(n):
    spec = np.fft.rfft(rng.standard_normal(n))
    freqs = np.fft.rfftfreq(n, 1 / SR)
    return spec, freqs


def colored(n, slope=0.0, lo=None, hi=None):
    """1/f^slope gürültü, bant sınırlı; dairesel olduğu için döngüde dikiş yok."""
    spec, freqs = periodic_noise(n)
    g = np.ones_like(freqs)
    nz = freqs > 0
    g[nz] = 1 / freqs[nz] ** (slope / 2)
    g[0] = 0
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(freqs, 1e-3)) ** 4)
    if hi:
        g *= 1 / np.sqrt(1 + (freqs / hi) ** 4)
    x = np.fft.irfft(spec * g, n)
    return x / (np.abs(x).max() + 1e-9)


def smooth_lfo(n, cps_list, depth):
    """Döngü uzunluğunun tam katı frekanslı yavaş dalgalanma (dikişsiz)."""
    t = np.arange(n) / n
    y = np.zeros(n)
    for k, a in cps_list:
        y += a * np.sin(2 * np.pi * k * t + rng.uniform(0, 2 * np.pi))
    y /= sum(a for _, a in cps_list)
    return 1 + depth * y


def wrap_add(buf, start, x):
    """x'i buf'a start konumundan ekler; taşan kısım başa katlanır."""
    n = len(buf)
    i = start % n
    k = min(len(x), n - i)
    buf[i : i + k] += x[:k]
    rest = x[k:]
    while len(rest):
        m = min(len(rest), n)
        buf[:m] += rest[:m]
        rest = rest[m:]


def circular_reverb(x, seconds, mix, bright=3000):
    """Dairesel (döngüsel) evrişimli yankı: döngü sonunu aşan yankı kendiliğinden başa sarar."""
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * seconds / 6))
    ir = filt(ir, "low", bright)
    a = int(0.012 * SR)
    ir[:a] *= np.linspace(0, 1, a)
    ir /= np.sqrt((ir**2).sum())
    h = np.zeros(len(x))
    h[:n] = ir
    wet = np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(h), len(x))
    return x * (1 - mix) + wet * mix


def rain(L=36.0):
    n = int(L * SR)
    bed = colored(n, 1.15, lo=300, hi=4200) * 0.34 * smooth_lfo(n, [(1, 1), (3, 0.5)], 0.12)
    low = colored(n, 1.6, lo=40, hi=380) * 0.22
    # yumuşak damla tıpırtıları: kısa, alçak geçiren gürültü darbeleri (tiz "ping" yok)
    pat = np.zeros(n)
    for _ in range(int(L * 55)):
        m = int(rng.uniform(0.004, 0.012) * SR)
        burst = rng.standard_normal(m) * np.exp(-np.arange(m) / (m / 4))
        wrap_add(pat, rng.integers(0, n), burst * rng.uniform(0.02, 0.08))
    pat = filt_loop(pat, "band", [900, 4200])
    # oluktan seyrek, yumuşak su sesi
    gutter = np.zeros(n)
    for _ in range(int(L * 1.2)):
        m = int(0.08 * SR)
        k = np.arange(m)
        tone = np.sin(2 * np.pi * rng.uniform(420, 700) * k / SR * (1 - 0.25 * k / m)) * np.exp(-k / (m / 5))
        wrap_add(gutter, rng.integers(0, n), tone * rng.uniform(0.01, 0.025))
    x = bed + low + pat + filt_loop(gutter, "low", 1500)
    return circular_reverb(x, 1.2, 0.2, 3500)


def fire(L=36.0):
    n = int(L * SR)
    flicker = smooth_lfo(n, [(2, 1), (5, 0.6), (11, 0.4), (23, 0.3)], 0.35)
    roar = colored(n, 1.8, lo=30, hi=320) * 0.5 * flicker
    hiss = colored(n, 0.5, lo=1500, hi=6000) * 0.035 * flicker
    crack = np.zeros(n)
    t = 0.0
    while t < L:
        # çıtırtılar kümeler halinde gelir
        t += rng.exponential(0.22)
        burst_n = rng.integers(1, 5)
        for j in range(burst_n):
            m = int(rng.uniform(0.002, 0.009) * SR)
            c = rng.standard_normal(m) * np.exp(-np.arange(m) / (m / 3))
            wrap_add(crack, int((t + j * rng.uniform(0.008, 0.04)) * SR), c * rng.uniform(0.05, 0.35) ** 1.5)
    crack = filt_loop(crack, "high", 1200)
    pops = np.zeros(n)
    for _ in range(int(L * 0.35)):
        m = int(0.03 * SR)
        k = np.arange(m)
        p = filt(rng.standard_normal(m), "band", [300, 1800]) * np.exp(-k / (m / 6))
        wrap_add(pops, rng.integers(0, n), p * rng.uniform(0.15, 0.3))
    x = roar + hiss + crack + pops
    return circular_reverb(x, 0.6, 0.15, 4000)


NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def hz(name):
    """'A4' → 440"""
    p, o = name[:-1], int(name[-1])
    semis = NOTE[p[0]] + (1 if "#" in p else 0) + (o - 4) * 12 - 9
    return 440.0 * 2 ** (semis / 12)


def piano_note(f, dur, vel):
    m = int(dur * SR)
    k = np.arange(m) / SR
    y = np.zeros(m)
    B = 0.0004  # hafif inharmoniklik
    for h in range(1, 9):
        fh = f * h * np.sqrt(1 + B * h * h)
        if fh > SR / 2.2:
            break
        amp = (1 / h**1.35) * (0.6 + 0.4 * vel)
        decay = 1.6 + 0.9 * h + f / 500
        y += amp * np.sin(2 * np.pi * fh * k + rng.uniform(0, 6.28)) * np.exp(-k * decay / (1 + 0.3 * (h == 1)))
    att = int(0.006 * SR)
    y[:att] *= np.linspace(0, 1, att)
    # yumuşak keçe çekiç sesi
    hn = int(0.012 * SR)
    y[:hn] += filt(rng.standard_normal(hn), "band", [800, 2600]) * np.exp(-np.arange(hn) / (hn / 4)) * 0.05 * vel
    return filt(y, "low", 2200 + 1200 * vel) * vel


def piano(L=32.0):
    """Do majör, yavaş: Cmaj7 – Am7 – Fmaj7 – G6sus, her akor 8 sn; seyrek melodi."""
    n = int(L * SR)
    buf = np.zeros(n)
    chords = [
        ["C3", "G3", "E4", "B4"],
        ["A2", "E3", "C4", "G4"],
        ["F2", "C3", "A3", "E4"],
        ["G2", "D3", "B3", "E4"],
    ]
    melody = [
        [(0.0, "G5"), (2.6, "E5"), (5.2, "D5")],
        [(0.4, "C5"), (3.0, "E5"), (6.0, "G5")],
        [(0.2, "A5"), (2.8, "G5"), (5.6, "E5")],
        [(0.6, "D5"), (3.4, "B4"), (6.2, "D5")],
    ]
    for i, ch in enumerate(chords):
        t0 = i * 8.0
        for j, nm in enumerate(ch):  # yumuşak arpej
            wrap_add(buf, int((t0 + j * 0.32 + rng.uniform(0, 0.03)) * SR), piano_note(hz(nm), 7.5, 0.45 - j * 0.05) * 0.5)
        # akorun yarısında hafif tekrar
        wrap_add(buf, int((t0 + 4.2) * SR), piano_note(hz(ch[0]), 4.5, 0.3) * 0.4)
        for dt, nm in melody[i]:
            wrap_add(buf, int((t0 + dt + rng.uniform(0, 0.04)) * SR), piano_note(hz(nm), 4.0, 0.42) * 0.42)
    room = colored(n, 1.0, lo=60, hi=1200) * 0.004  # çok hafif oda tonu, tamamen dijital sessizlik olmasın
    return circular_reverb(buf, 2.8, 0.38, 2800) + room


def write_wav(name, x, rms_target):
    x = x - x.mean()
    rms = np.sqrt((x**2).mean())
    x = x * (rms_target / rms)
    peak = np.abs(x).max()
    if peak > 0.85:
        x *= 0.85 / peak
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    path = os.path.join(OUT, f"ambient-{name}.wav")
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    d = np.abs(np.diff(pcm.astype(np.float64))) / 32767
    seam = abs(int(pcm[-1]) - int(pcm[0])) / 32767 / (np.percentile(d, 99) + 1e-9)  # tipik ardışık farka oranı
    print(f"{path}  {len(pcm)/SR:.0f} sn  {os.path.getsize(path)//1024} KB  rms {np.sqrt((x**2).mean()):.3f}  tepe {np.abs(x).max():.2f}  dikiş {seam:.4f}")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for old in ("salon", "rain", "fire", "piano"):
        for ext in ("mp3", "wav"):
            p = os.path.join(OUT, f"ambient-{old}.{ext}")
            if os.path.exists(p):
                os.remove(p)
    write_wav("rain", rain(), 0.12)
    write_wav("fire", fire(), 0.11)
    write_wav("piano", piano(), 0.09)
