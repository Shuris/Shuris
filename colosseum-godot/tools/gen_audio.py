"""Gera os sons e as músicas do jogo em WAV (assets/audio), com as mesmas receitas
do sintetizador Web Audio da versão Electron (SoundManager.ts e Music.ts):
osciladores com envelopes exponenciais, ruído filtrado e pequenos sequenciadores.

Uso: python3 tools/gen_audio.py   (precisa de numpy e scipy)
"""
import math
import os
import wave

import numpy as np
from scipy.signal import lfilter

SR = 22050
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "audio")
rng = np.random.default_rng(1234)
NOISE = rng.uniform(-1, 1, SR * 4)


# ------------------------------------------------------------------ primitivas
def osc(kind, phase):
    if kind == "sine":
        return np.sin(2 * np.pi * phase)
    frac = phase % 1.0
    if kind == "square":
        return np.where(frac < 0.5, 1.0, -1.0)
    if kind == "sawtooth":
        return 2 * frac - 1
    return 4 * np.abs(frac - 0.5) - 1  # triangle


def exp_ramp(a, b, n):
    a, b = max(a, 1e-4), max(b, 1e-4)
    return a * (b / a) ** (np.arange(n) / max(1, n - 1))


class Buf:
    def __init__(self, seconds):
        self.d = np.zeros(int(SR * seconds) + SR)

    def add(self, at, sig):
        i = int(at * SR)
        n = min(len(sig), len(self.d) - i)
        if n > 0:
            self.d[i:i + n] += sig[:n]

    def tone(self, freq, dur, kind, gain, at=0.0, slide=None, attack=0.005, detune_cents=0.0):
        n = int((dur + 0.05) * SR)
        f = np.full(n, freq * 2 ** (detune_cents / 1200))
        nd = int(dur * SR)
        if slide:
            f[:nd] = exp_ramp(freq, max(20, slide), nd)
            f[nd:] = max(20, slide)
        phase = np.cumsum(f) / SR
        env = np.empty(n)
        na = max(1, int(attack * SR))
        env[:na] = exp_ramp(1e-4, gain, na)
        env[na:nd] = exp_ramp(gain, 1e-4, max(1, nd - na))[: max(0, nd - na)]
        env[nd:] = 1e-4
        self.add(at, osc(kind, phase) * env)

    def noise(self, dur, ftype, freq, gain, at=0.0, freq_to=None, q=1.0):
        n = int(dur * SR)
        start = rng.integers(0, len(NOISE) - n - 1)
        x = NOISE[start:start + n]
        fr = exp_ramp(freq, freq_to, n) if freq_to else np.full(n, float(freq))
        y = biquad_tv(x, ftype, fr, q)
        self.add(at, y * exp_ramp(gain, 1e-4, n))


def biquad_coefs(ftype, f, q):
    w0 = 2 * math.pi * min(f, SR * 0.45) / SR
    alpha = math.sin(w0) / (2 * q)
    c = math.cos(w0)
    if ftype == "lowpass":
        b = [(1 - c) / 2, 1 - c, (1 - c) / 2]
    elif ftype == "highpass":
        b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]
    else:  # bandpass (pico 0 dB, como o BiquadFilter do Web Audio)
        b = [alpha, 0, -alpha]
    a = [1 + alpha, -2 * c, 1 - alpha]
    return [v / a[0] for v in b], [1, a[1] / a[0], a[2] / a[0]]


def biquad_tv(x, ftype, freqs, q):
    """Filtro com frequência que varia: coeficientes recalculados em blocos de 64 amostras."""
    y = np.zeros_like(x)
    zi = np.zeros(2)
    for s in range(0, len(x), 64):
        b, a = biquad_coefs(ftype, float(freqs[s]), q)
        # transposed direct form II, estado carregado entre blocos
        seg, zi = lfilter(b, a, x[s:s + 64], zi=zi * 1.0 if zi.any() else np.zeros(2))
        y[s:s + 64] = seg
    return y


def save(name, data, loop=False):
    os.makedirs(OUT, exist_ok=True)
    peak = np.max(np.abs(data)) if len(data) else 1
    if peak > 0.98:
        data = data / peak * 0.98
    pcm = (np.clip(data, -1, 1) * 32767).astype("<i2")
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def trim(b, seconds):
    return b.d[: int(seconds * SR)]


# ------------------------------------------------------------------ efeitos (SoundManager.ts)
def sfx():
    def r():
        return 0.94 + rng.random() * 0.12

    specs = {}

    def hit(b):
        b.noise(0.12, "lowpass", 1400 * r(), 0.55)
        b.tone(150 * r(), 0.16, "sine", 0.7, 0, 50)
    specs["hit"] = (hit, 0.3)

    def crit(b):
        b.noise(0.2, "lowpass", 2200, 0.7)
        b.tone(110, 0.3, "sine", 0.9, 0, 38)
        b.tone(70, 0.35, "triangle", 0.5, 0.02, 35)
    specs["crit"] = (crit, 0.45)

    def block(b):
        for f, g in ((1180, 0.16), (1870, 0.11), (2650, 0.08), (3420, 0.05)):
            b.tone(f * r(), 0.35, "square", g * 0.5, 0, f * 0.97)
        b.noise(0.05, "highpass", 3000, 0.3)
        b.tone(220, 0.1, "sine", 0.25, 0, 120)
    specs["block"] = (block, 0.45)

    specs["whoosh"] = (lambda b: b.noise(0.2, "bandpass", 500, 0.35, 0, 2200, 1.5), 0.25)

    def dodge(b):
        b.noise(0.16, "bandpass", 1400, 0.3, 0, 3800, 2)
        b.noise(0.08, "lowpass", 300, 0.15, 0.1)
    specs["dodge"] = (dodge, 0.25)

    def skill(b):
        b.tone(660, 0.18, "triangle", 0.18)
        b.tone(990, 0.22, "triangle", 0.16, 0.07)
    specs["skill"] = (skill, 0.35)

    def guard(b):
        b.tone(330, 0.4, "triangle", 0.2)
        b.tone(495, 0.4, "triangle", 0.14, 0.05)
        b.tone(660, 0.5, "sine", 0.1, 0.1)
    specs["guard"] = (guard, 0.65)

    def horn(b):
        for f, at, d in ((196, 0, 0.42), (262, 0.45, 0.7)):
            b.tone(f, d, "sawtooth", 0.12, at, None, 0.05)
            b.tone(f * 2, d, "square", 0.03, at, None, 0.06)
    specs["horn"] = (horn, 1.25)

    def victory(b):
        for i, f in enumerate((392, 523, 659, 784)):
            b.tone(f, 0.7 if i == 3 else 0.16, "triangle", 0.22, i * 0.13)
        for i, f in enumerate((196, 262)):
            b.tone(f, 0.6, "sawtooth", 0.05, 0.39 + i * 0.01, None, 0.04)
    specs["victory"] = (victory, 1.2)

    def defeat(b):
        for i, f in enumerate((392, 349, 311, 262)):
            b.tone(f, 0.9 if i == 3 else 0.3, "triangle", 0.2, i * 0.28)
    specs["defeat"] = (defeat, 1.8)

    specs["click"] = (lambda b: b.tone(880, 0.05, "square", 0.06), 0.08)

    def equip(b):
        b.tone(520, 0.08, "square", 0.06)
        b.noise(0.06, "highpass", 2500, 0.12, 0.02)
    specs["equip"] = (equip, 0.12)

    def coin(b):
        b.tone(1320, 0.08, "square", 0.07)
        b.tone(1760, 0.16, "square", 0.07, 0.07)
    specs["coin"] = (coin, 0.26)

    def levelup(b):
        for i, f in enumerate((523, 659, 784, 1046)):
            b.tone(f, 0.5 if i == 3 else 0.12, "square", 0.08, i * 0.09)
    specs["levelup"] = (levelup, 0.85)

    def train(b):
        b.tone(120, 0.14, "sine", 0.5, 0, 55)
        b.noise(0.1, "lowpass", 900, 0.35)
    specs["train"] = (train, 0.2)

    specs["exhausted"] = (lambda b: b.tone(300, 0.4, "sine", 0.18, 0, 140, 0.05), 0.45)
    specs["step"] = (lambda b: b.noise(0.06, "lowpass", 420, 0.12), 0.08)
    specs["error"] = (lambda b: b.tone(200, 0.14, "square", 0.08), 0.18)

    def forge(b):
        for i in range(3):
            b.tone(1650 * r(), 0.25, "square", 0.06, i * 0.22, 1600)
            b.tone(2480 * r(), 0.18, "square", 0.035, i * 0.22)
            b.noise(0.05, "highpass", 2600, 0.25, i * 0.22)
    specs["forge"] = (forge, 0.75)

    def thunder(b):
        b.noise(2.6, "lowpass", 260, 0.7, 0, 70, 0.7)
        b.noise(0.4, "lowpass", 900, 0.4, 0.05, 200)
        b.tone(48, 1.8, "sine", 0.35, 0.05, 30, 0.08)
    specs["thunder"] = (thunder, 2.7)

    def cheer(b):
        n = int(2.2 * SR)
        start = rng.integers(0, len(NOISE) - n - 1)
        bb, aa = biquad_coefs("bandpass", 900, 0.6)
        y = lfilter(bb, aa, NOISE[start:start + n])
        env = np.concatenate([exp_ramp(1e-4, 0.22, int(0.3 * SR)), exp_ramp(0.22, 1e-4, n - int(0.3 * SR))])
        b.add(0, y * env * 2.2)
    specs["cheer"] = (cheer, 2.3)

    for name, (fn, length) in specs.items():
        b = Buf(length + 0.2)
        fn(b)
        save("sfx_" + name, trim(b, length))


def loops():
    # murmúrio do público (com respiração lenta) e chuva: ruído filtrado em laço sem emenda
    for name, ftype, freq, q, gain, lfo in (("crowd", "bandpass", 650, 0.5, 0.07 * 5, 0.17), ("rain", "highpass", 1200, 0.7, 0.09 * 4, 0)):
        n = SR * 6
        x = rng.uniform(-1, 1, n + SR)
        b, a = biquad_coefs(ftype, freq, q)
        y = lfilter(b, a, x)
        if name == "rain":
            b2, a2 = biquad_coefs("lowpass", 6000, 0.7)
            y = lfilter(b2, a2, y)
        y = y[SR:]
        # emenda: mistura o fim no começo
        fade = SR // 2
        y[:fade] = y[:fade] * np.linspace(0, 1, fade) + y[-fade:] * np.linspace(1, 0, fade)
        y = y[:-fade]
        if lfo:
            t = np.arange(len(y)) / SR
            y = y * (1 + 0.28 * np.sin(2 * np.pi * t / 6.0 * round(6.0 * lfo)))
        save("loop_" + name, y * gain)


# ------------------------------------------------------------------ músicas (Music.ts)
SCALES = {
    "dorian": [0, 2, 3, 5, 7, 9, 10],
    "phrygianDom": [0, 1, 4, 5, 7, 8, 10],
    "minorPenta": [0, 3, 5, 7, 10],
    "mixolydian": [0, 2, 4, 5, 7, 9, 10],
}
N = None
SONGS = {
    "menu": dict(bpm=70, root=50, scale="phrygianDom", chords=[0, 0, 5, 6, 0, 0, 5, 4],
                 lyre=[0, N, N, N, 2, N, N, N, 4, N, N, N, 2, N, N, N],
                 melody=[[[0, 7, 6], [8, 8, 4], [12, 9, 4]], [[0, 8, 8], [8, 7, 8]], [[0, 5, 6], [8, 6, 4], [12, 7, 4]], [[0, 6, 12]],
                         [[0, 7, 4], [4, 9, 4], [8, 10, 8]], [[0, 9, 8], [8, 8, 8]], [[0, 7, 6], [8, 6, 4], [12, 5, 4]], [[0, 4, 16]]],
                 lead="horn", drum=[1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0], tamb=[0] * 16, drone=True, lyreGain=0.07),
    "city": dict(bpm=96, root=50, scale="dorian", chords=[0, 6, 5, 6, 0, 3, 4, 0],
                 lyre=[0, 2, 4, 2, 7, 4, 2, 4, 0, 2, 4, 2, 7, 4, 2, 4],
                 melody=[[[0, 7, 4], [4, 8, 2], [6, 9, 2], [8, 11, 6], [14, 9, 2]], [[0, 8, 8], [8, 6, 4], [12, 7, 4]], [],
                         [[8, 6, 2], [10, 7, 2], [12, 8, 4]], [[0, 9, 6], [6, 8, 2], [8, 7, 8]], [[0, 5, 4], [4, 7, 4], [8, 8, 8]],
                         [[0, 6, 4], [4, 5, 4], [8, 4, 4], [12, 6, 4]], [[0, 7, 16]]],
                 lead="flute", drum=[1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0], tamb=[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], drone=False, lyreGain=0.06),
    "night": dict(bpm=62, root=45, scale="minorPenta", chords=[0, 0, 3, 2, 0, 0, 2, 1],
                  lyre=[0, N, N, 2, N, N, 4, N, N, 3, N, N, 2, N, N, N],
                  melody=[[], [[0, 7, 8], [8, 6, 8]], [], [[4, 5, 4], [8, 6, 8]], [], [[0, 8, 8], [8, 7, 8]], [], [[0, 5, 16]]],
                  lead="flute", drum=[0] * 16, tamb=[0] * 16, drone=True, lyreGain=0.05),
    "tavern": dict(bpm=128, root=52, scale="mixolydian", chords=[0, 0, 3, 4, 0, 0, 6, 4],
                   lyre=[0, 4, 2, 4, 0, 4, 2, 4, 1, 4, 2, 4, 0, 4, 7, 4],
                   melody=[[[0, 7, 2], [2, 8, 2], [4, 9, 4], [8, 7, 2], [10, 8, 2], [12, 9, 4]], [[0, 10, 4], [4, 9, 4], [8, 8, 8]],
                           [[0, 8, 2], [2, 9, 2], [4, 10, 4], [8, 8, 4], [12, 7, 4]], [[0, 8, 4], [4, 7, 4], [8, 6, 8]],
                           [[0, 7, 2], [2, 8, 2], [4, 9, 4], [8, 11, 4], [12, 9, 4]], [[0, 10, 4], [4, 9, 4], [8, 8, 8]],
                           [[0, 9, 4], [4, 8, 4], [8, 7, 4], [12, 6, 4]], [[0, 7, 8], [12, 4, 4]]],
                   lead="flute", drum=[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], tamb=[0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1], drone=False, lyreGain=0.055),
    "arena": dict(bpm=116, root=50, scale="phrygianDom", chords=[0, 0, 1, 0, 0, 0, 5, 1],
                  lyre=[0, N, 0, N, 2, N, 0, N, 0, N, 0, N, 1, N, 0, N],
                  melody=[[[0, 7, 4], [4, 7, 2], [6, 8, 2], [8, 9, 8]], [[0, 8, 4], [4, 7, 4], [8, 8, 8]], [[0, 7, 4], [4, 7, 2], [6, 8, 2], [8, 10, 8]],
                          [[0, 9, 4], [4, 8, 4], [8, 7, 8]], [[0, 10, 4], [4, 9, 4], [8, 10, 4], [12, 11, 4]], [[0, 12, 8], [8, 11, 8]],
                          [[0, 10, 4], [4, 9, 4], [8, 8, 4], [12, 9, 4]], [[0, 7, 16]]],
                  lead="horn", drum=[1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1], tamb=[0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], drone=True, lyreGain=0.045),
}


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def music():
    for name, s in SONGS.items():
        sc = SCALES[s["scale"]]
        six = 60 / s["bpm"] / 4
        bars = len(s["chords"])
        length = bars * 16 * six
        b = Buf(length + 2)

        def note(deg, octave=0):
            o = deg // len(sc)
            return hz(s["root"] + sc[deg % len(sc)] + 12 * (o + octave))

        def pluck(t, f, gain, dur=0.9):
            n = int((dur + 0.05) * SR)
            ph = np.arange(n) / SR
            sig = osc("triangle", ph * f) + 0.12 * osc("square", ph * f * 2.003)
            env = np.concatenate([exp_ramp(1e-4, gain, int(0.005 * SR)), exp_ramp(gain, 1e-4, n - int(0.005 * SR))])
            y = biquad_tv(sig * env, "lowpass", exp_ramp(f * 6, f * 1.5, n), 0.7)
            b.add(t, y)

        def flute(t, f, dur):
            dur = max(0.15, dur)
            n = int((dur + 0.15) * SR)
            tt = np.arange(n) / SR
            fr = f * 2 + np.sin(2 * np.pi * 5.2 * tt) * f * 0.012
            sig = np.sin(2 * np.pi * np.cumsum(fr) / SR)
            na, nh = int(0.06 * SR), int((dur - 0.06) * SR)
            env = np.concatenate([exp_ramp(1e-4, 0.05, na), np.full(max(0, nh - na), 0.05), exp_ramp(0.05, 1e-4, n - max(nh, na))])[:n]
            b.add(t, sig * env)
            b.noise(0.12, "bandpass", f * 2, 0.012, t, None, 8)

        def horn(t, f, dur):
            dur = max(0.2, dur)
            n = int((dur + 0.12) * SR)
            tt = np.arange(n) / SR
            sig = osc("sawtooth", tt * f) + osc("sawtooth", tt * f * 2 ** (4 / 1200))
            na, nh = int(0.05 * SR), int((dur - 0.05) * SR)
            env = np.concatenate([exp_ramp(1e-4, 0.045, na), np.full(max(0, nh - na), 0.04), exp_ramp(0.04, 1e-4, n - max(nh, na))])[:n]
            cut = np.interp(tt, [0, 0.08, dur, dur + 1], [f * 1.5, f * 5, f * 3, f * 3])
            b.add(t, biquad_tv(sig * env, "lowpass", cut, 0.7))

        def drum(t, k):
            n = int(0.3 * SR)
            ph = np.cumsum(np.concatenate([exp_ramp(110, 48, int(0.18 * SR)), np.full(n - int(0.18 * SR), 48.0)])) / SR
            b.add(t, np.sin(2 * np.pi * ph) * exp_ramp(0.22 * k, 1e-4, n))
            b.noise(0.08, "lowpass", 500, 0.08 * k, t)

        def tamb(t):
            b.noise(0.09, "highpass", 6000, 0.035, t)

        step_t = 0.0
        for step in range(bars * 16):
            bar, pos = step // 16, step % 16
            chord = s["chords"][bar]
            ly = s["lyre"][pos]
            if ly is not None:
                pluck(step_t, note(chord + ly), s["lyreGain"])
            if pos == 0:
                pluck(step_t, note(chord, -1), s["lyreGain"] * 1.2, 1.4)
            for at, deg, d in s["melody"][bar]:
                if at == pos:
                    if s["lead"] == "flute":
                        flute(step_t, note(deg), d * six)
                    else:
                        horn(step_t, note(deg, -1), d * six)
            if s["drum"][pos]:
                drum(step_t, 1 if pos == 0 else 0.7)
            if s["tamb"][pos]:
                tamb(step_t)
            step_t += six
        if s["drone"]:
            n = len(b.d)
            tt = np.arange(n) / SR
            dr = osc("sawtooth", tt * hz(s["root"] - 12) * 2 ** (5 / 1200)) + osc("sawtooth", tt * hz(s["root"] - 5) * 2 ** (-5 / 1200))
            bb, aa = biquad_coefs("lowpass", 700, 0.7)
            b.d += lfilter(bb, aa, dr) * 0.018
        # laço sem emenda: o que passa do fim (caudas) volta para o começo
        total = int(length * SR)
        y = b.d[:total].copy()
        tail = b.d[total:total + SR]
        y[: len(tail)] += tail
        save("music_" + name, y * 0.9 / max(1e-6, np.max(np.abs(y))) * 0.8)


if __name__ == "__main__":
    sfx()
    loops()
    music()
    print("ok", sorted(os.listdir(OUT)))
