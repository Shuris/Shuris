"""Effect textures: seamless noise for shaders, particles, tap splash frames."""
import os
import sys
import math
import json
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from palette import *  # noqa
from palette import hx
from pixlib import *  # noqa

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets", "sprites", "effects")


def periodic_noise(size, cell, rng, octaves=4, persistence=0.55, sx=1, sy=1):
    """Seamless (tileable) fractal value noise in [0,1]."""
    total = np.zeros((size, size), np.float32)
    amp, norm = 1.0, 0.0
    gx, gy = max(1, size // (cell * sx)), max(1, size // (cell * sy))
    for _ in range(octaves):
        grid_ = rng.random((gy, gx)).astype(np.float32)
        ys = np.arange(size) * gy / size
        xs = np.arange(size) * gx / size
        y0 = np.floor(ys).astype(int)
        x0 = np.floor(xs).astype(int)
        fy = ys - y0
        fx = xs - x0
        fy = fy * fy * (3 - 2 * fy)
        fx = fx * fx * (3 - 2 * fx)
        y1 = (y0 + 1) % gy
        x1 = (x0 + 1) % gx
        a = grid_[y0][:, x0]
        b = grid_[y0][:, x1]
        c = grid_[y1][:, x0]
        d = grid_[y1][:, x1]
        top = a + (b - a) * fx[None, :]
        bot = c + (d - c) * fx[None, :]
        total += amp * (top + (bot - top) * fy[:, None])
        norm += amp
        amp *= persistence
        gx *= 2
        gy *= 2
    t = total / norm
    t = (t - t.min()) / (t.max() - t.min())
    return t


def main():
    os.makedirs(OUT, exist_ok=True)
    rng = np.random.default_rng(5)
    S = 256
    r = periodic_noise(S, 16, rng, 4)
    g = periodic_noise(S, 32, rng, 3)
    b = periodic_noise(S, 8, rng, 3)
    # A: blocky cluster noise used by the dissolve ("sprouting") effect
    a = periodic_noise(S, 4, rng, 2, persistence=0.4)
    a = 0.6 * a + 0.4 * periodic_noise(S, 16, rng, 2)
    a = (a - a.min()) / (a.max() - a.min())
    arr = np.stack([r, g, b, a], -1)
    Image.fromarray((arr * 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, "noise_rgba.png"))

    # 1px dust mote / 2px pollen / sparkle
    Image.fromarray(np.full((1, 1, 4), 255, np.uint8), "RGBA").save(os.path.join(OUT, "px.png"))
    sp = from_ascii([".w.", "wWw", ".w."], {"w": (241, 243, 224, 160), "W": (255, 255, 240, 255)})
    Image.fromarray(sp, "RGBA").save(os.path.join(OUT, "sparkle.png"))

    # falling leaf: 4 frames, 4x4
    lc = {"a": LEAF[7], "b": LEAF[5], "c": hx("#e8862d"), "d": hx("#a8441c")}
    frames = [
        ["..a.", ".ab.", "ab..", "b..."],
        ["....", "aab.", ".bb.", "...."],
        ["a...", ".ab.", "..ab", "...b"],
        ["....", ".ba.", ".baa", "...."],
    ]
    leaf_frames = [from_ascii(f, lc) for f in frames]
    save_sheet(leaf_frames, os.path.join(OUT, "leaf_fall.png"))
    dry_frames = [from_ascii([row.replace("a", "c").replace("b", "d") for row in f], lc) for f in frames]
    save_sheet(dry_frames, os.path.join(OUT, "leaf_fall_dry.png"))

    # tap splash: expanding ellipse ripple + droplets, 7 frames 24x12
    fr = []
    for i in range(7):
        cv = Canvas(24, 14)
        t = (i + 1) / 7.0
        rx, ry = 2 + t * 9, 1 + t * 4
        xs, ys = grid(24, 14)
        d = ((xs - 12) / rx) ** 2 + ((ys - 8) / ry) ** 2
        ring = (d <= 1.0) & (d >= 0.55)
        a = int(255 * (1 - t * 0.7))
        cv.put_color(ring, (216, 240, 230, a))
        if i < 4:
            for (dx, dy) in ((-3, -3), (3, -4), (0, -6), (-5, -1), (5, -2)):
                yy = 8 + int(dy * (1 - (i - 1.5) ** 2 / 4.0))
                cv.pixel(12 + dx * (1 + i * 0.4), yy, (241, 243, 224, 255))
        fr.append(cv.px)
    save_sheet(fr, os.path.join(OUT, "splash.png"))

    # sprout puff when planting: 6 frames 16x12 (leaf bits flying out)
    fr = []
    rng2 = np.random.default_rng(3)
    parts = [(rng2.random() * 6.28, 0.6 + rng2.random() * 0.6) for _ in range(9)]
    for i in range(6):
        cv = Canvas(18, 14)
        t = (i + 1) / 6.0
        for k, (ang, sp_) in enumerate(parts):
            x = 9 + math.cos(ang) * t * 8 * sp_
            y = 9 + math.sin(ang) * t * 5 * sp_ - t * 3 + t * t * 4
            col = (LEAF[8] if k % 3 else LIGHT[0]) + (int(255 * (1 - t * 0.8)),)
            cv.pixel(x, y, col)
        fr.append(cv.px)
    save_sheet(fr, os.path.join(OUT, "puff.png"))

    # music note (bird song)
    note = from_ascii(["..##", "..#.", "..#.", "###.", "##.."], {"#": (241, 243, 224, 230)})
    Image.fromarray(note, "RGBA").save(os.path.join(OUT, "note.png"))
    # camera flash
    fl = from_ascii(["..w..", ".wWw.", "wWWWw", ".wWw.", "..w.."],
                    {"w": (255, 246, 208, 140), "W": (255, 255, 255, 255)})
    Image.fromarray(fl, "RGBA").save(os.path.join(OUT, "flash.png"))
    # rain streaks (near: 2x7 diagonal, far: 1x4)
    near = from_ascii(["...a", "...b", "..b.", "..c.", ".c..", ".c..", "d..."],
                      {"a": (235, 244, 248, 140), "b": (225, 238, 244, 220), "c": (210, 230, 240, 200), "d": (195, 220, 232, 120)})
    Image.fromarray(near, "RGBA").save(os.path.join(OUT, "rain_drop.png"))
    far = from_ascii([".a", ".b", "b.", "c."], {"a": (225, 236, 242, 110), "b": (210, 228, 238, 170), "c": (195, 218, 232, 100)})
    Image.fromarray(far, "RGBA").save(os.path.join(OUT, "rain_drop_far.png"))
    # ground splash (4 frames, 7x4)
    fr = []
    for i in range(4):
        cv = Canvas(7, 4)
        if i == 0:
            cv.pixel(3, 3, (225, 238, 245, 200))
        elif i == 1:
            for x, y in ((2, 2), (4, 2), (3, 3)):
                cv.pixel(x, y, (220, 235, 245, 180))
        elif i == 2:
            for x, y in ((1, 1), (5, 1), (2, 3), (4, 3)):
                cv.pixel(x, y, (210, 230, 240, 140))
        else:
            for x, y in ((0, 1), (6, 1)):
                cv.pixel(x, y, (200, 225, 235, 80))
        fr.append(cv.px)
    save_sheet(fr, os.path.join(OUT, "rain_splash.png"))
    # rainbow arc (dithered bands, soft ends)
    RW, RH = 440, 170
    cv = Canvas(RW, RH)
    xs, ys = grid(RW, RH)
    cx, cy, r0 = RW / 2, RH + 40, 200.0
    d = np.sqrt((xs - cx) ** 2 + ((ys - cy) * 1.0) ** 2)
    bands = [(214, 92, 92), (232, 152, 84), (238, 214, 110), (130, 196, 120), (110, 160, 214), (140, 110, 190)]
    bw = 3.4
    end_fade = np.clip(1.0 - np.abs(xs - cx) / (RW / 2), 0, 1) ** 0.6
    bay = bayer(RW, RH) + 0.5
    for i, col in enumerate(bands):
        m = (d >= r0 + i * bw) & (d < r0 + (i + 1) * bw)
        a = end_fade * 0.85
        keep = m & (a > bay * 0.9)
        cv.put_color(keep, col + (int(255 * 0.75),))
    cv.save(os.path.join(OUT, "rainbow.png"))
    # firefly glow (stepped rings, additive) and body
    G = 15
    cv = Canvas(G, G)
    xs, ys = grid(G, G)
    d = np.sqrt((xs - G // 2) ** 2 + (ys - G // 2) ** 2)
    for r, a in ((7.2, 45), (5.2, 95), (3.4, 170), (2.0, 235), (1.0, 255)):
        m = d <= r
        cv.put_color(m, (255, 255, 255, a))
    cv.save(os.path.join(OUT, "glow.png"))
    body = from_ascii(["Y", "o"], {"Y": (236, 250, 140, 255), "o": (40, 34, 20, 255)})
    Image.fromarray(body, "RGBA").save(os.path.join(OUT, "firefly.png"))
    print("effects done")


if __name__ == "__main__":
    main()
