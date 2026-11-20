"""Effect textures: seamless noise for shaders, particles, tap splash frames."""
import os
import sys
import math
import json
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from palette import *  # noqa
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
    lc = {"a": LEAF[7], "b": LEAF[5], "c": LEAF_DRY[6], "d": LEAF_DRY[4]}
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
    print("effects done")


if __name__ == "__main__":
    main()
