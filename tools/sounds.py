"""Özgün kısa ses efektleri üretir (WAV, 22.05 kHz mono)."""
import math, struct, wave, sys, os
SR = 22050
def write(path, samples):
    with wave.open(path, 'w') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, s)) * 30000)) for s in samples))
def tone(freq, dur, vol=0.5, decay=8.0, harm=(1, 0.3, 0.1)):
    n = int(SR * dur)
    return [vol * math.exp(-decay * i / SR) * min(1, i / (SR * 0.004)) *
            sum(a * math.sin(2 * math.pi * freq * (k + 1) * i / SR) for k, a in enumerate(harm)) for i in range(n)]
def mix(*parts):
    n = max(off + len(p) for off, p in parts); out = [0.0] * n
    for off, p in parts:
        for i, s in enumerate(p): out[off + i] += s
    return out
import random
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
rnd = random.Random(3)
# Yumuşak ahşap "tık": kısa gürültü darbesi + boğuk ton
click = [0.35 * math.exp(-90 * i / SR) * (rnd.uniform(-1, 1) * 0.6 + math.sin(2 * math.pi * 420 * i / SR)) for i in range(int(SR * 0.07))]
write(f'{out}/snap.wav', click)
# Birleştirme: daha da hafif, iki kısa tık
write(f'{out}/merge.wav', mix((0, [s * 0.6 for s in click]), (int(SR * 0.05), [s * 0.45 for s in click])))
# Tamamlama: sakin iki notalı çan
write(f'{out}/win.wav', mix((0, tone(392.0, 1.6, 0.22, 2.6, (1, 0.25, 0.08))), (int(SR * 0.28), tone(587.33, 1.6, 0.18, 2.6, (1, 0.2, 0.05)))))
print('ok')
