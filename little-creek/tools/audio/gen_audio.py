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


# ------------------------------------------------------------------ v0.3: lo-fi + ambience
def lp(x, cutoff):
    """FFT low-pass with a soft knee (warm lo-fi tone)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1.0 / (1.0 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x))


def epiano(f, d, vel=1.0):
    """Rhodes-like electric piano: sine + bell partial with fast decay."""
    tt = t_axis(d)
    env = np.exp(-tt * 1.6) * np.clip(tt / 0.006, 0, 1)
    x = np.sin(2 * np.pi * f * tt + 0.8 * np.sin(2 * np.pi * f * tt) * np.exp(-tt * 6))
    x += 0.25 * np.sin(2 * np.pi * f * 2.0 * tt) * np.exp(-tt * 4)
    x += 0.10 * np.sin(2 * np.pi * f * 7.0 * tt) * np.exp(-tt * 18)
    return x * env * vel


def ks_guitar(f, d, vel=1.0, bright=0.5):
    """Karplus-Strong plucked nylon string."""
    n = int(d * SR)
    period = int(SR / f)
    buf = (np.random.default_rng(int(f * 10)).random(period) * 2 - 1) * vel
    out = np.zeros(n)
    for i in range(n):
        v = buf[i % period]
        out[i] = v
        nxt = buf[(i + 1) % period]
        buf[i % period] = (v * (0.5 + bright * 0.0) + nxt * 0.5) * 0.996
    return lp(out, 2600) * np.clip(t_axis(d) / 0.003, 0, 1)


def kick(d=0.4):
    tt = t_axis(d)
    f = 50 + 70 * np.exp(-tt * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)


def snare(d=0.25):
    tt = t_axis(d)
    n = fft_band(rng.standard_normal(len(tt)), 900, 4500) * np.exp(-tt * 22)
    return n * 0.6 + np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 30) * 0.3


def hat(d=0.06):
    tt = t_axis(d)
    return fft_band(rng.standard_normal(len(tt)), 6000, 11000) * np.exp(-tt * 70)


def vinyl(n):
    x = fft_band(rng.standard_normal(n), 2000, 9000) * 0.012
    pops = np.zeros(n)
    for k in range(int(n / SR * 3)):
        i = rng.integers(0, n - 200)
        pops[i:i + 60] += rng.uniform(0.05, 0.15) * np.exp(-np.arange(60) / 8.0)
    return x + pops * 0.6


def lofi_track(name, bpm, prog, scale, swing=0.58, drums=True, guitar=False, melody_density=0.45,
               cutoff=3400, seed=1, bars_per_chord=2, loops=4):
    r = np.random.default_rng(seed)
    beat = 60.0 / bpm
    bar = beat * 4
    total_bars = len(prog) * bars_per_chord * loops
    dur = total_bars * bar
    n = int(dur * SR)
    L = np.zeros(n + SR * 4)
    R = np.zeros(n + SR * 4)

    def put(sig, at, pan=0.5, g=1.0):
        i = int(at * SR)
        j = i + len(sig)
        L[i:j] += sig * g * (1 - pan) * 2 * 0.5
        R[i:j] += sig * g * pan * 2 * 0.5

    t = 0.0
    for b in range(total_bars):
        chord = prog[(b // bars_per_chord) % len(prog)]
        # chords: soft e-piano voicings on beat 1 and the "and" of 3
        for hit, vel in ((0.0, 0.32), (2.5 if b % 2 else 2.0, 0.22)):
            for k, f in enumerate(chord):
                put(epiano(f, bar * 1.2, vel * (0.9 if k else 1.0)), t + hit * beat + k * 0.012, 0.45 + 0.03 * k)
        # bass: root, then fifth, warm
        root = chord[0] / 2
        for hit, ff in ((0.0, root), (2.0, root * 1.5 if b % 2 else root)):
            tt = t_axis(beat * 1.6)
            bs = np.sin(2 * np.pi * ff * tt) * np.exp(-tt * 1.8) * np.clip(tt / 0.01, 0, 1)
            put(bs, t + hit * beat, 0.5, 0.28)
        if guitar:
            pattern = [0, 1, 2, 1, 3, 2, 1, 2]
            for i, pidx in enumerate(pattern):
                at = t + i * beat / 2 + (beat / 2 * (swing - 0.5) * 2 if i % 2 else 0)
                f = chord[pidx % len(chord)] * (2 if pidx == 3 else 1)
                put(ks_guitar(f, 1.2, 0.5), at, 0.62, 0.22)
        if drums:
            for i in range(8):
                at = t + i * beat / 2 + (beat / 2 * (swing - 0.5) * 2 if i % 2 else 0)
                if i in (0, 5) or (i == 3 and b % 4 == 3):
                    put(kick(), at, 0.5, 0.42)
                if i in (2, 6):
                    put(snare(), at, 0.52, 0.16)
                put(hat(), at, 0.58, 0.06 if i % 2 else 0.09)
        # sparse piano melody on the pentatonic scale
        for i in range(8):
            if r.random() < melody_density * (0.5 if i % 2 else 1.0):
                f = scale[r.integers(0, len(scale))]
                at = t + i * beat / 2 + (beat / 2 * (swing - 0.5) * 2 if i % 2 else 0)
                put(epiano(f * 2, beat * 2.5, 0.16), at, r.uniform(0.3, 0.7))
        t += bar
    L, R = L[:n], R[:n]
    # wrap the tail into the head for a seamless loop
    # tape wow: slow pitch wobble via resampling
    idx = np.arange(n) + 0.0018 * SR * np.sin(2 * np.pi * 0.33 * np.arange(n) / SR)
    idx = np.clip(idx, 0, n - 1)
    L = np.interp(idx, np.arange(n), L)
    R = np.interp(idx, np.arange(n), R)
    L = lp(L, cutoff) + vinyl(n)
    R = lp(R, cutoff) + vinyl(n)
    peak = max(np.max(np.abs(L)), np.max(np.abs(R)))
    L, R = L / peak * 0.55, R / peak * 0.55
    write(os.path.join(OUT, "music", name), L, stereo=R, quality=3)


def lofi():
    N = lambda m: 440.0 * 2 ** ((m - 69) / 12)
    ch = lambda *ms: [N(m) for m in ms]
    pent_c = [N(m) for m in (60, 62, 64, 67, 69, 72)]
    pent_a = [N(m) for m in (57, 60, 62, 64, 67, 69)]
    # morning: bright major 7ths, light beat + guitar
    lofi_track("lofi_morning", 78, [ch(48, 55, 59, 64), ch(45, 52, 55, 60), ch(41, 48, 52, 57), ch(43, 50, 53, 59)],
               pent_c, guitar=True, melody_density=0.35, cutoff=3800, seed=3)
    # day: warmer, steady beat
    lofi_track("lofi_day", 82, [ch(41, 48, 52, 57), ch(43, 50, 55, 59), ch(40, 47, 50, 55), ch(45, 52, 55, 60)],
               pent_c, guitar=False, melody_density=0.45, cutoff=3400, seed=5)
    # dusk: minor 9ths, slower, guitar
    lofi_track("lofi_dusk", 72, [ch(45, 52, 55, 59, 62), ch(41, 48, 52, 55), ch(43, 50, 53, 57), ch(40, 47, 50, 55)],
               pent_a, guitar=True, melody_density=0.3, cutoff=2900, seed=7)
    # night: no drums, sparse e-piano, very warm
    lofi_track("lofi_night", 64, [ch(45, 52, 55, 60), ch(41, 48, 53, 57), ch(38, 45, 50, 53), ch(40, 47, 52, 55)],
               pent_a, drums=False, guitar=False, melody_density=0.22, cutoff=2300, seed=9)


def ambience_v3():
    A = os.path.join(OUT, "ambience")
    # crickets: pulsed high chirps, several individuals
    dur = 12.0
    n = int(dur * SR)
    x = np.zeros(n)
    for k in range(7):
        f0 = rng.uniform(4200, 5200)
        rate = rng.uniform(2.2, 3.4)
        ph = rng.random()
        tt = t_axis(dur)
        gate = (np.sin(2 * np.pi * (rate * tt + ph)) > 0.55).astype(float)
        trem = 0.5 + 0.5 * np.sin(2 * np.pi * 30 * tt)
        x += np.sin(2 * np.pi * f0 * tt) * gate * trem * rng.uniform(0.3, 1.0)
    x = make_loop(norm(fft_band(x, 3000, 7000), 0.5), 1.0)
    write(os.path.join(A, "crickets_loop"), x, stereo=np.roll(x, 2000), quality=2)
    # insects (day): soft cicada-like shimmer swelling slowly
    dur = 14.0
    tt = t_axis(dur)
    nz = fft_band(rng.standard_normal(len(tt)), 3500, 8000)
    am = (0.5 + 0.5 * np.sin(2 * np.pi * tt / dur * 3)) * (0.6 + 0.4 * np.sin(2 * np.pi * 62 * tt))
    x = make_loop(norm(nz * am, 0.4), 1.5)
    write(os.path.join(A, "insects_loop"), x, stereo=np.roll(x, 1500), quality=2)
    # rain light / heavy: noise beds + drops on leaves
    for name, dens, gain, lo in (("rain_light_loop", 25, 0.5, 1500), ("rain_heavy_loop", 90, 0.85, 500)):
        dur = 12.0
        n = int(dur * SR)
        bed = fft_band(rng.standard_normal(n), lo, 9000) * gain
        drops = np.zeros(n)
        for k in range(int(dur * dens)):
            i = rng.integers(0, n - 800)
            L = rng.integers(200, 700)
            drops[i:i + L] += fft_band(rng.standard_normal(L), 1500, 6000)[:L] * np.exp(-np.arange(L) / 120.0) * rng.uniform(0.3, 1.0)
        x = make_loop(norm(bed + drops * 0.6, 0.7), 1.2)
        write(os.path.join(A, name), x, stereo=np.roll(x, 3000), quality=2)
    # morning bird chorus bed (distant, many birds)
    dur = 16.0
    n = int(dur * SR)
    x = np.zeros(n)
    for k in range(40):
        f0 = rng.uniform(2200, 4800)
        dd = rng.uniform(0.05, 0.3)
        tt = t_axis(dd)
        f = f0 * (1 + rng.uniform(-0.3, 0.3) * tt / dd)
        s_ = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.linspace(0, np.pi, len(tt)))
        mixat(x, s_ * rng.uniform(0.1, 0.4), rng.uniform(0, dur - 0.4))
    x = make_loop(norm(lp(x, 6000), 0.4), 1.5)
    write(os.path.join(A, "birds_loop"), x, stereo=np.roll(x, 2500), quality=2)


def sfx_v3():
    S = os.path.join(OUT, "sfx")
    # owl hoot: two soft low "hu-hoo"
    x = np.zeros(int(1.4 * SR))
    for at, f, d in ((0.0, 420, 0.25), (0.35, 400, 0.55)):
        tt = t_axis(d)
        ff = f * (1 - 0.06 * tt / d)
        s_ = np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.sin(np.linspace(0, np.pi, len(tt))) ** 0.7
        s_ += fft_band(rng.standard_normal(len(tt)), 300, 900) * 0.15 * np.sin(np.linspace(0, np.pi, len(tt)))
        mixat(x, s_, at)
    write(os.path.join(S, "owl"), norm(x, 0.5))
    # duck quack
    tt = t_axis(0.22)
    f = 520 * (1 - 0.3 * tt / 0.22)
    sq = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR))
    x = lp(sq * np.exp(-tt * 6) * np.clip(tt / 0.01, 0, 1), 1800)
    write(os.path.join(S, "duck"), norm(x, 0.45))
    # thunder: low rumble with crack
    dur = 5.0
    tt = t_axis(dur)
    rum = lp(rng.standard_normal(len(tt)), 140) * (np.exp(-tt * 0.8) * (0.6 + 0.4 * np.sin(2 * np.pi * 1.3 * tt) ** 2))
    crack = fft_band(rng.standard_normal(len(tt)), 400, 3000) * np.exp(-tt * 6)
    write(os.path.join(S, "thunder"), norm(rum * 3 + crack * 0.4, 0.8))
    # distant fox bark
    x = np.zeros(int(0.8 * SR))
    for at in (0.0, 0.3):
        tt = t_axis(0.12)
        f = 700 * (1 - 0.4 * tt / 0.12)
        mixat(x, lp(np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-tt * 18), 1400), at)
    write(os.path.join(S, "fox"), norm(x, 0.35))


if __name__ == "__main__" and len(__import__("sys").argv) > 1 and __import__("sys").argv[1] == "v3":
    lofi()
    ambience_v3()
    sfx_v3()
    print("audio v3 done")
    raise SystemExit


if __name__ == "__main__":
    water_loop()
    wind_loop()
    birds()
    sfx()
    music()
    print("audio done")
