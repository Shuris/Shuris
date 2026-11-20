"""Placeable props: vegetation, rocks, logs, aquatic plants, structures.

All sprites are anchored bottom-center (the base sits 2px above the bottom
edge, leaving room for the baked contact shadow). Variants share size.
"""
import os
import sys
import math
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from palette import *  # noqa
from pixlib import *  # noqa
from gen_environment import fern, blend_ramp

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
VEG = os.path.join(ROOT, "assets", "sprites", "vegetation")
RCK = os.path.join(ROOT, "assets", "sprites", "rocks")
STR = os.path.join(ROOT, "assets", "sprites", "environment")
SHADOW_COL = (10, 22, 28, 95)


def R(s):
    return np.random.default_rng(s)


def shadow(cv, cx, cy, rx, ry):
    m = ellipse_mask(cv.w, cv.h, cx, cy, rx, ry)
    m &= cv.px[..., 3] == 0
    cv.put_color(m, SHADOW_COL)


def grass(seed):
    rng = R(seed)
    cv = Canvas(26, 19)
    shadow(cv, 13, 17, 11, 2)
    blades = []
    for k in range(int(16 + rng.random() * 6)):
        x = 3 + rng.random() * 20
        h = 6 + rng.random() * 11 * (1 - abs(x - 13) / 16)
        blades.append((rng.random(), x, h))
    for _, x, h in sorted(blades):
        lean = (x - 13) * 0.09 + (rng.random() - 0.5) * 0.5
        base = 0.25 + rng.random() * 0.3
        for t in range(int(h)):
            v = base + t / h * 0.5
            cv.pixel(x + lean * t + 0.08 * t * t * (lean > 0) - 0.08 * t * t * (lean < 0) * 0.5,
                     17 - t, GRASS[int(np.clip(v, 0, 0.99) * len(GRASS))])
    return cv


def flowers(seed, color):
    rng = R(seed)
    cv = Canvas(32, 24)
    shadow(cv, 16, 22, 13, 2.2)
    foliage_cluster(cv, 16, 17.5, 13, 5.2, GRASS[1:8], rng, blob=(1.2, 2.4), lobes=5,
                    flat_bottom=0.2, dither=0.3)
    fr = FLOWER[color]
    heads = []
    for k in range(int(9 + rng.random() * 5)):
        x = 4 + rng.random() * 24
        top = 3 + rng.random() * 9 + abs(x - 16) * 0.25
        sx = x + (rng.random() - 0.5) * 3
        for y in range(int(top) + 2, 15):
            t = (y - top) / max(15 - top, 1)
            cv.pixel(x + (sx - x) * t, y, GRASS[2 + (y % 3)])
        heads.append((x, top))
        # leaves on the stem
        if rng.random() < 0.6:
            ly = int(top + 4 + rng.random() * 4)
            cv.pixel(x + 1, ly, GRASS[5])
            cv.pixel(x + 2, ly - 1, GRASS[6])
    for x, y in sorted(heads, key=lambda p: p[1]):
        xi, yi = int(x), int(y)
        big = rng.random() < 0.55
        for dx, dy, lv in ((0, -1, 2), (-1, 0, 2), (1, 0, 2), (0, 1, 1)):
            cv.pixel(xi + dx, yi + dy, fr[lv])
        if big:
            for dx, dy, lv in ((-1, -1, 3), (1, -1, 2), (-1, 1, 1), (1, 1, 1), (0, -2, 3), (-2, 0, 2), (2, 0, 2)):
                cv.pixel(xi + dx, yi + dy, fr[lv])
        cv.pixel(xi, yi, FLOWER["yellow"][2] if color not in ("yellow", "orange") else FLOWER["orange"][1])
    return cv


def rock_prop(seed, rx, ry, mossy):
    rng = R(seed)
    w, h = int(rx * 2 + 8), int(ry * 2 + 6)
    cv = Canvas(w, h)
    shadow(cv, w / 2, h - 3, rx * 1.15, ry * 0.45)
    rock(cv, w / 2, h - 3 - ry, rx, ry, rng, ramp_cols=ROCK, moss=MOSS if mossy else None,
         moss_amt=0.7 if mossy else 0, flat=0.5, shade_fn=lambda a, b: 0.0)
    if rx > 10:  # pebbles at the foot of big boulders
        for k in range(4):
            px, py = w / 2 + (rng.random() - 0.5) * rx * 2.2, h - 3 + rng.random() * 1.5
            rock(cv, px, py, 1.6 + rng.random(), 1.1, rng, ramp_cols=ROCK, cracks=False,
                 shade_fn=lambda a, b: -0.05)
    return cv


def fern_prop(seed, lush=True):
    rng = R(seed)
    cv = Canvas(44, 32)
    shadow(cv, 22, 30, 16, 2.4)
    rmp = LEAF[1:10]
    angs = [-2.75, -2.45, -2.15, -1.85, -1.57, -1.3, -1.0, -0.7, -0.4]
    for a in sorted(angs, key=lambda a: -abs(a + 1.57)):
        fern(cv, 22, 29, a + (rng.random() - 0.5) * 0.15, 15 + rng.random() * 6 - abs(a + 1.57) * 2, rmp,
             rng, curl=0.045, leaflet=0.5, bias=0.06)
    return cv


def shrub(seed, berries=False):
    rng = R(seed)
    cv = Canvas(48, 36)
    shadow(cv, 24, 33, 20, 3)
    foliage_cluster(cv, 24, 20, 20, 12.5, LEAF[0:10], rng, blob=(1.8, 3.4), density=1.25,
                    flat_bottom=0.2, contrast=1.15, lobes=7, dither=0.4)
    if berries:
        a = cv.px[..., 3] > 0
        for k in range(22):
            x, y = int(8 + rng.random() * 32), int(10 + rng.random() * 18)
            if a[y, x] and a[y, x + 1]:
                cv.pixel(x, y, FLOWER["red"][2])
                cv.pixel(x + 1, y, FLOWER["red"][1])
                cv.pixel(x, y - 1, FLOWER["red"][3])
    return cv


def log_prop(seed, mossy):
    rng = R(seed)
    cv = Canvas(60, 22)
    shadow(cv, 30, 19, 27, 2.6)
    xs, ys = grid(60, 22)
    cy, r = 11.0, 7.0
    body = (xs >= 4) & (xs <= 50) & (np.abs(ys - cy) <= r - (xs < 6) * 1)
    v = np.clip(-(ys - cy) / r, -1, 1)
    n = value_noise(60, 22, 3, rng, octaves=3, sx=6)
    val = 0.35 + v * 0.34 + (n - 0.5) * 0.4
    cv.put_ramp(body, val, BARK_WARM, dither=0.4)
    # bark cracks
    cr = body & (np.abs(n - 0.5) < 0.03)
    cv.put_ramp(cr, val - 0.25, BARK_WARM, dither=0)
    cap = ((xs - 51) / 3.4) ** 2 + ((ys - cy) / r) ** 2 <= 1
    rings = np.sqrt(((xs - 51) / 3.4) ** 2 + ((ys - cy) / r) ** 2)
    cv.put_ramp(cap, 0.5 + np.sin(rings * 11) * 0.2 - rings * 0.15, WOOD, dither=0.2)
    # broken branch stub
    for t in range(6):
        cv.pixel(20 + t * 0.5, cy - r - t, BARK_WARM[3])
        cv.pixel(21 + t * 0.5, cy - r - t, BARK_WARM[5])
    if mossy:
        mn = value_noise(60, 22, 2, rng, octaves=2)
        mm = body & (ys < cy - 1.0) & (mn > 0.4)
        cv.put_ramp(mm, 0.35 + v * 0.3 + (mn - 0.5), MOSS, dither=0.4)
        for x in (12, 16, 33, 38):  # mushrooms
            cv.pixel(x, cy - r, CREAM[2])
            cv.pixel(x + 1, cy - r, CREAM[3])
            cv.pixel(x - 1, cy - r, CREAM[1])
            cv.pixel(x, cy - r + 1, CREAM[0])
    return cv


def lily(seed):
    rng = R(seed)
    cv = Canvas(32, 12)
    pads = [(8, 7, 6.5, 3), (20, 7.5, 7, 3.2), (14, 4, 5, 2.2), (26, 4.5, 4, 1.8)]
    xs, ys = grid(32, 12)
    for (x, y, rx, ry) in pads:
        m = ellipse_mask(32, 12, x, y, rx, ry)
        notch = (np.abs(np.arctan2(ys - y, xs - x) - (rng.random() * 2 - 1)) < 0.3)
        cv.put_ramp(m & ~notch, 0.45 + (xs - x) * 0.02 - (ys - y) * 0.09, LEAF[2:10], dither=0.4)
        rim = m & ~ellipse_mask(32, 12, x, y, rx - 1, ry - 0.8)
        cv.put_ramp(rim & ~notch, 0.3 + np.zeros_like(xs), LEAF[2:10], dither=0)
    for (fx, fy, col) in ((20, 5, "pink"), (9, 5, "white")):
        f = FLOWER[col]
        for dx, dy, lv in ((0, 0, 3), (-1, 0, 2), (1, 0, 2), (0, -1, 3), (-1, -1, 2), (1, -1, 2), (0, 1, 1)):
            cv.pixel(fx + dx, fy + dy, f[lv])
        cv.pixel(fx, fy, FLOWER["yellow"][2])
    return cv


def reeds(seed):
    rng = R(seed)
    cv = Canvas(20, 38)
    for k in range(10):
        x = 3 + rng.random() * 14
        h = 18 + rng.random() * 16
        lean = (rng.random() - 0.5) * 0.25
        for t in range(int(h)):
            cv.pixel(x + lean * t, 36 - t, GRASS[2 + int(t / h * 6)])
        if k % 3 == 0:  # cattail head
            hx_ = x + lean * h
            for t in range(5):
                cv.pixel(hx_, 36 - h - t, WOOD[3 + (t in (1, 2))])
                cv.pixel(hx_ + 1, 36 - h - t, WOOD[2])
    for x in range(1, 19):
        if rng.random() < 0.7:
            cv.pixel(x, 37, (216, 240, 230, 200))
    return cv


def tree(seed, w, h, trunk_w, crown_rx, crown_ry, crown_cy=None):
    rng = R(seed)
    cv = Canvas(w, h)
    cx = w / 2
    shadow(cv, cx, h - 3, crown_rx * 0.75, 3)
    crown_cy = crown_cy if crown_cy is not None else crown_ry + 2
    trunk(cv, cx, crown_cy, h - 4, trunk_w * 0.65, trunk_w, BARK_WARM, rng, roots=trunk_w * 0.45,
          moss=MOSS[:6], moss_amt=0.25, texture=0.9)
    for side in (-1, 1):  # limbs reaching into the crown
        for t in range(int(crown_rx * 0.7)):
            for k in range(max(1, int(trunk_w / 4))):
                cv.pixel(cx + side * t, crown_cy + crown_ry * 0.55 - t * 0.75 + k, BARK_WARM[2 + k])
    foliage_cluster(cv, cx, crown_cy, crown_rx, crown_ry, LEAF, rng, blob=(2.0, 3.8),
                    density=1.15, contrast=1.15, lobes=9, dither=0.4)
    return cv


def bench():
    cv = Canvas(50, 25)
    shadow(cv, 25, 22, 23, 2.4)
    xs, ys = grid(50, 25)
    seat = (xs >= 3) & (xs <= 46) & (ys >= 12) & (ys <= 14)
    cv.put_ramp(seat, 0.8 - (ys - 12) * 0.18 + np.zeros_like(xs), WOOD, dither=0.2)
    for y0 in (3, 7):
        back = (xs >= 3) & (xs <= 46) & (ys >= y0) & (ys <= y0 + 2)
        cv.put_ramp(back, 0.65 - (ys - y0) * 0.15 + np.zeros_like(xs), WOOD, dither=0.2)
    for x in (5, 44):
        for y in range(2, 22):
            cv.pixel(x, y, WOOD[2])
            cv.pixel(x + 1, y, WOOD[3] if y < 15 else WOOD[1])
    for x in (12, 37):
        for y in range(15, 22):
            cv.pixel(x, y, WOOD[1])
    for x in range(3, 47):
        cv.pixel(x, 15, WOOD[1])
    return cv


def feeder():
    cv = Canvas(22, 46)
    shadow(cv, 11, 43, 6, 1.6)
    for y in range(16, 43):
        cv.pixel(10, y, WOOD[3])
        cv.pixel(11, y, WOOD[2])
        cv.pixel(12, y, WOOD[1])
    for y in range(7, 17):
        for x in range(3, 20):
            edge = x in (3, 19)
            cv.pixel(x, y, WOOD[4] if not edge else WOOD[2])
    for x in range(4, 19):
        cv.pixel(x, 15, LITTER[6])
        cv.pixel(x, 14, LITTER[5] if x % 2 else LITTER[7])
        cv.pixel(x, 13, LITTER[6] if x % 3 else LITTER[4])
    for x in range(6, 17):
        for y in range(9, 12):
            cv.pixel(x, y, WOOD[1])
    for i in range(11):
        for k in range(2):
            cv.pixel(11 - i, 2 + i * 0.5 + k, BARK_WARM[3 - k])
            cv.pixel(11 + i, 2 + i * 0.5 + k, BARK_WARM[5 - k])
    return cv


def deck():
    cv = Canvas(84, 42)
    shadow(cv, 42, 39, 40, 3)
    xs, ys = grid(84, 42)
    floor_ = (xs >= 3) & (xs <= 80) & (ys >= 22) & (ys <= 33)
    planks = ((xs // 5) % 2)
    cv.put_ramp(floor_, 0.62 + planks * 0.12 - (ys - 22) * 0.03, WOOD, dither=0.2)
    for x in range(3, 81):
        cv.pixel(x, 34, WOOD[1])
        cv.pixel(x, 35, WOOD[0])
        cv.pixel(x, 7, WOOD[5])
        cv.pixel(x, 8, WOOD[4])
        cv.pixel(x, 9, WOOD[2])
    for x in (3, 22, 42, 61, 80):
        for y in range(7, 39):
            cv.pixel(x, y, WOOD[3] if y < 34 else WOOD[1])
            cv.pixel(x + 1, y, WOOD[2] if y < 34 else WOOD[0])
    for x in range(5, 80, 4):
        for y in range(10, 22):
            cv.pixel(x, y, WOOD[2])
    return cv


def main():
    for d in (VEG, RCK, STR):
        os.makedirs(d, exist_ok=True)
    for i in range(3):
        grass(10 + i).save(os.path.join(VEG, f"grass_{i}.png"))
    for i, c in enumerate(["white", "yellow", "purple", "pink"]):
        flowers(20 + i, c).save(os.path.join(VEG, f"flowers_{i}.png"))
    for i in range(3):
        rock_prop(30 + i, 7.5, 5.2, False).save(os.path.join(RCK, f"small_rock_{i}.png"))
        rock_prop(30 + i, 7.5, 5.2, True).save(os.path.join(RCK, f"small_rock_{i}_moss.png"))
        rock_prop(40 + i, 17, 11.5, False).save(os.path.join(RCK, f"big_rock_{i}.png"))
        rock_prop(40 + i, 17, 11.5, True).save(os.path.join(RCK, f"big_rock_{i}_moss.png"))
    for i in range(3):
        fern_prop(50 + i).save(os.path.join(VEG, f"fern_{i}.png"))
    for i in range(3):
        shrub(60 + i, berries=(i == 1)).save(os.path.join(VEG, f"shrub_{i}.png"))
    for i in range(2):
        log_prop(70 + i, False).save(os.path.join(VEG, f"log_{i}.png"))
        log_prop(70 + i, True).save(os.path.join(VEG, f"log_{i}_moss.png"))
    lily(80).save(os.path.join(VEG, "aquatic_0.png"))
    reeds(81).save(os.path.join(VEG, "aquatic_1.png"))
    lily(82).save(os.path.join(VEG, "aquatic_2.png"))
    for i in range(3):
        tree(90 + i, 62, 106, 6, 25, 26, 30).save(os.path.join(VEG, f"tree_small_{i}.png"))
    for i in range(2):
        tree(95 + i, 112, 184, 13, 48, 48, 52).save(os.path.join(VEG, f"tree_big_{i}.png"))
    bench().save(os.path.join(STR, "bench_0.png"))
    feeder().save(os.path.join(STR, "feeder_0.png"))
    deck().save(os.path.join(STR, "deck_0.png"))
    print("props done")


if __name__ == "__main__":
    main()
