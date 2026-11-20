"""Procedural audio for Little Creek (no external samples).

Generates ambience loops, bird songs, interface sounds and a gentle ambient
music loop with numpy, then encodes to Ogg Vorbis with ffmpeg.
Run from the project root:  python3 tools/audio/gen_audio.py
"""
import os
import subprocess
import tempfile
import wave

import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets", "audio")
SR = 44100
rng = np.random.default_rng(42)


def t_axis(dur, sr=SR):
    return np.arange(int(dur * sr)) / sr


def env_adsr(n, a=0.01, d=0.1, s=0.7, r=0.2, sr=SR):
    e = np.ones(n) * s
    na, nd, nr = int(a * sr), int(d * sr), int(r * sr)
    na = max(na, 1)
    e[:na] = np.linspace(0, 1, na)
    if nd:
        e[na:na + nd] = np.linspace(1, s, len(e[na:na + nd]))
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def one_pole_lp(x, cutoff, sr=SR):
    a = np.exp(-2 * np.pi * cutoff / sr)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):  # fine for our lengths
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def fft_band(x, lo, hi, sr=SR):
    """Zero-phase band-pass via FFT (smooth edges)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / sr)
    w = np.clip((f - lo * 0.7) / (lo * 0.3 + 1e-6), 0, 1) * np.clip((hi * 1.3 - f) / (hi * 0.3), 0, 1)
    return np.fft.irfft(X * w, len(x))


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


def make_loop(x, fade, sr=SR):
    """Crossfade the tail into the head for a seamless loop."""
    n = int(fade * sr)
    head = x[:n].copy()
    tail = x[-n:].copy()
    ramp = np.linspace(0, 1, n)
    out = x[:-n].copy()
    out[:n] = head * ramp + tail * (1 - ramp)
    return out


def write(path_noext, x, sr=SR, stereo=None, quality=4):
    os.makedirs(os.path.dirname(path_noext), exist_ok=True)
    if stereo is not None:
        data = np.stack([x, stereo], -1)
        ch = 2
    else:
        data = x[:, None]
        ch = 1
    pcm = (np.clip(data, -1, 1) * 32767).astype(np.int16)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        tmp = tf.name
    with wave.open(tmp, "wb") as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-c:a", "libvorbis",
                    "-q:a", str(quality), path_noext + ".ogg"], check=True)
    os.remove(tmp)


# ------------------------------------------------------------------ ambience
def water_loop():
    dur = 14.0
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    base = fft_band(noise, 180, 2600) * 0.5
    hiss = fft_band(rng.standard_normal(n), 2500, 9000) * 0.12
    t = t_axis(dur)
    am = 0.75 + 0.25 * np.sin(2 * np.pi * 0.37 * t) * np.sin(2 * np.pi * 0.11 * t + 1)
    x = base * am + hiss
    # bubbles: short rising sine chirps with fast decay
    for k in range(int(dur * 9)):
        st = rng.integers(0, n - 4000)
        f0 = rng.uniform(500, 1500)
        L = int(rng.uniform(0.02, 0.07) * SR)
        tt = np.arange(L) / SR
        f = f0 * (1 + tt * rng.uniform(8, 25))
        ph = 2 * np.pi * np.cumsum(f) / SR
        x[st:st + L] += np.sin(ph) * np.exp(-tt * 70) * rng.uniform(0.05, 0.16)
    xl = make_loop(norm(x, 0.8), 1.5)
    xr = np.roll(xl, int(0.013 * SR))  # slight stereo width
    write(os.path.join(OUT, "ambience", "water_loop"), xl, stereo=xr, quality=3)


def wind_loop():
    dur = 18.0
    n = int(dur * SR)
    t = t_axis(dur)
    low = fft_band(rng.standard_normal(n), 80, 700)
    sw = 0.55 + 0.45 * np.sin(2 * np.pi * t / dur * 2) * np.sin(2 * np.pi * t / dur * 3 + 0.7)
    leaves = fft_band(rng.standard_normal(n), 2500, 7000)
    gust = np.clip(np.sin(2 * np.pi * t / dur * 4 + 0.3), 0, 1) ** 3
    x = low * sw * 0.7 + leaves * gust * 0.15
    xl = make_loop(norm(x, 0.7), 2.0)
    write(os.path.join(OUT, "ambience", "wind_loop"), xl, stereo=np.roll(xl, 900), quality=2)


# ------------------------------------------------------------------ birds
def whistle(freqs, durs, glide=0.3, vib=6.0, bright=0.15):
    out = []
    for f0, d in zip(freqs, durs):
        tt = t_axis(d)
        f1 = f0 * (1 + rng.uniform(-glide, glide) * 0.4)
        f = np.linspace(f0, f1, len(tt)) * (1 + 0.015 * np.sin(2 * np.pi * vib * 4 * tt))
        ph = 2 * np.pi * np.cumsum(f) / SR
        e = np.sin(np.linspace(0, np.pi, len(tt))) ** 1.5
        out.append((np.sin(ph) + bright * np.sin(2 * ph)) * e)
        out.append(np.zeros(int(rng.uniform(0.03, 0.09) * SR)))
    return np.concatenate(out)


def birds():
    # sabiá-laranjeira: melodious, flute-like phrases
    for i in range(3):
        nn = rng.integers(4, 8)
        base = rng.uniform(1700, 2400)
        scale = np.array([1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2])
        freqs = base * rng.choice(scale, nn)
        durs = rng.uniform(0.07, 0.2, nn)
        x = whistle(freqs, durs, glide=0.5, bright=0.12)
        x = np.concatenate([x, np.zeros(int(0.2 * SR))])
        write(os.path.join(OUT, "sfx", "bird_sabia_%d" % i), norm(x, 0.6))
    # saíra: thin high "tsip" calls
    for i in range(3):
        parts = []
        for k in range(rng.integers(2, 5)):
            d = rng.uniform(0.03, 0.06)
            tt = t_axis(d)
            f = np.linspace(rng.uniform(6500, 7500), rng.uniform(5200, 6200), len(tt))
            ph = 2 * np.pi * np.cumsum(f) / SR
            parts.append(np.sin(ph) * np.sin(np.linspace(0, np.pi, len(tt))))
            parts.append(np.zeros(int(rng.uniform(0.05, 0.12) * SR)))
        x = np.concatenate(parts + [np.zeros(int(0.1 * SR))])
        write(os.path.join(OUT, "sfx", "bird_saira_%d" % i), norm(x, 0.45))


# ------------------------------------------------------------------ sfx
def bell(f, d, decay=4.0, partials=((1, 1.0), (2.01, 0.35), (3.02, 0.12), (4.2, 0.06))):
    tt = t_axis(d)
    x = sum(a * np.sin(2 * np.pi * f * m * tt) * np.exp(-tt * decay * (1 + m * 0.4)) for m, a in partials)
    att = np.clip(tt / 0.005, 0, 1)
    return x * att


def pluck(f, d, decay=6.0):
    tt = t_axis(d)
    x = np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt) * np.exp(-tt * 12)
    return x * np.exp(-tt * decay) * np.clip(tt / 0.003, 0, 1)


def mixat(dst, src, at):
    i = int(at * SR)
    end = min(len(dst), i + len(src))
    dst[i:end] += src[:end - i]


def sfx():
    S = os.path.join(OUT, "sfx")
    # water tap: plip + splash
    d = 0.45
    tt = t_axis(d)
    f = 1300 * np.exp(-tt * 18) + 380
    ph = 2 * np.pi * np.cumsum(f) / SR
    plip = np.sin(ph) * np.exp(-tt * 14)
    spl = fft_band(rng.standard_normal(len(tt)), 1500, 7000) * np.exp(-tt * 22) * 0.35
    write(os.path.join(S, "tap_water"), norm(plip + spl, 0.7))
    # rustle
    d = 0.5
    n = int(d * SR)
    x = fft_band(rng.standard_normal(n), 1800, 8000)
    e = np.zeros(n)
    for k in range(6):
        st = rng.integers(0, n - 3000)
        L = rng.integers(1500, 4500)
        e[st:st + L] += np.sin(np.linspace(0, np.pi, L)) * rng.uniform(0.4, 1)
    write(os.path.join(S, "rustle"), norm(x * e, 0.5))
    # place plant: soft earth thump + 2-note chime
    d = 0.7
    x = np.zeros(int(d * SR))
    tt = t_axis(0.18)
    mixat(x, fft_band(rng.standard_normal(len(tt)), 80, 600) * np.exp(-tt * 25), 0)
    mixat(x, bell(1046.5, 0.5, 6) * 0.3, 0.03)
    mixat(x, bell(1568, 0.5, 6) * 0.25, 0.1)
    write(os.path.join(S, "place_plant"), norm(x, 0.6))
    # place rock: thud + gravel
    d = 0.5
    tt = t_axis(d)
    thud = np.sin(2 * np.pi * (70 + 60 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 14)
    grav = fft_band(rng.standard_normal(len(tt)), 900, 5000) * np.exp(-tt * 18) * 0.3
    write(os.path.join(S, "place_rock"), norm(thud + grav, 0.7))
    # click (wood tick)
    tt = t_axis(0.08)
    x = (np.sin(2 * np.pi * 1800 * tt) * 0.6 + fft_band(rng.standard_normal(len(tt)), 2000, 6000) * 0.4) * np.exp(-tt * 90)
    write(os.path.join(S, "click"), norm(x, 0.5))
    # panel whoosh
    d = 0.3
    n = int(d * SR)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    for k, (lo, hi) in enumerate([(300, 900), (600, 1800), (1200, 3600)]):
        seg = fft_band(x, lo, hi) * np.sin(np.linspace(0, np.pi, n)) ** 2
        out += seg * (0.6 - k * 0.15)
    write(os.path.join(S, "panel"), norm(out, 0.35))
    # upgrade: rising pentatonic arpeggio
    x = np.zeros(int(1.0 * SR))
    for i, f in enumerate([523.25, 659.25, 783.99, 1046.5]):
        mixat(x, bell(f, 0.7, 5) * 0.4, i * 0.07)
    write(os.path.join(S, "upgrade"), norm(x, 0.6))
    # discover: ding-dong up
    x = np.zeros(int(1.4 * SR))
    mixat(x, bell(880, 1.2, 3), 0)
    mixat(x, bell(1318.5, 1.2, 3), 0.16)
    write(os.path.join(S, "discover"), norm(x, 0.55))
    # stage up: blooming chord + shimmer
    d = 3.2
    x = np.zeros(int(d * SR))
    for i, f in enumerate([261.63, 392.0, 493.88, 587.33, 659.25, 783.99, 1174.66]):
        mixat(x, bell(f, d - i * 0.12, 1.4) * (0.45 - i * 0.03), i * 0.12)
    tt = t_axis(d)
    shimmer = fft_band(rng.standard_normal(len(tt)), 5000, 11000) * np.sin(np.linspace(0, np.pi, len(tt))) * 0.05
    write(os.path.join(S, "stage_up"), norm(x + shimmer, 0.7))
    # error: two soft low notes down
    x = np.zeros(int(0.5 * SR))
    mixat(x, pluck(330, 0.25, 12), 0)
    mixat(x, pluck(247, 0.3, 12), 0.1)
    write(os.path.join(S, "error"), norm(x, 0.45))
    # camera shutter
    tt = t_axis(0.12)
    sh = fft_band(rng.standard_normal(len(tt)), 2000, 9000)
    e = np.exp(-tt * 60) + np.exp(-np.clip(tt - 0.06, 0, None) * 80) * (tt > 0.06)
    write(os.path.join(S, "camera"), norm(sh * e, 0.4))


# ------------------------------------------------------------------ music
def music():
    """Gentle ambient loop: soft pads + sparse kalimba-like pentatonic melody."""
    bpm = 60
    beat = 60 / bpm
    bars = 16
    dur = bars * 4 * beat  # 64 s
    n = int(dur * SR)
    L = np.zeros(n)
    Rr = np.zeros(n)
    # chords (Hz): Cmaj9, Am7(add11), Fmaj7#11, G6sus2 -- each 4 bars
    chords = [
        [130.81, 196.0, 246.94, 293.66, 329.63],
        [110.0, 164.81, 196.0, 261.63, 293.66],
        [87.31, 174.61, 220.0, 261.63, 329.63],
        [98.0, 146.83, 196.0, 220.0, 329.63],
    ]
    seg = 4 * 4 * beat
    for ci in range(4):
        for rep in range(1):
            start = ci * seg
            d = seg + 2.0
            tt = t_axis(d)
            pad = np.zeros(len(tt))
            for j, f in enumerate(chords[ci]):
                det = 1 + (j - 2) * 0.0015
                pad += np.sin(2 * np.pi * f * det * tt + j) * (0.5 if j == 0 else 0.28)
                pad += np.sin(2 * np.pi * f * 2.003 * tt) * 0.05
            env = np.clip(tt / 3.0, 0, 1) * np.clip((d - tt) / 3.0, 0, 1)
            pad *= env * (0.85 + 0.15 * np.sin(2 * np.pi * 0.08 * tt))
            i0 = int(start * SR)
            end = min(n, i0 + len(pad))
            L[i0:end] += pad[:end - i0] * 0.9
            Rr[i0:end] += np.roll(pad, 400)[:end - i0] * 0.9
            # wrap the tail to the beginning (seamless loop)
            if i0 + len(pad) > n:
                over = i0 + len(pad) - n
                L[:over] += pad[-over:] * 0.9
                Rr[:over] += np.roll(pad, 400)[-over:] * 0.9
    # melody: C major pentatonic, sparse
    pent = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66]
    t = 2 * beat
    mel_rng = np.random.default_rng(7)
    while t < dur - 2:
        if mel_rng.random() < 0.55:
            f = pent[mel_rng.integers(0, len(pent))]
            note = pluck(f, 2.2, 2.2) * 0.22
            pan = mel_rng.uniform(0.3, 0.7)
            i0 = int(t * SR)
            end = min(n, i0 + len(note))
            L[i0:end] += note[:end - i0] * (1 - pan)
            Rr[i0:end] += note[:end - i0] * pan
            if mel_rng.random() < 0.3:  # echo
                e0 = i0 + int(0.75 * beat * SR)
                end2 = min(n, e0 + len(note))
                if e0 < n:
                    L[e0:end2] += note[:end2 - e0] * 0.35 * pan
                    Rr[e0:end2] += note[:end2 - e0] * 0.35 * (1 - pan)
        t += beat * mel_rng.choice([1, 1, 2, 2, 3, 4])
    # gentle low-pass for warmth
    peak = max(np.max(np.abs(L)), np.max(np.abs(Rr)))
    L, Rr = L / peak * 0.6, Rr / peak * 0.6
    write(os.path.join(OUT, "music", "creek_theme"), L, stereo=Rr, quality=3)


if __name__ == "__main__":
    water_loop()
    wind_loop()
    birds()
    sfx()
    music()
    print("audio done")
