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
    cv = Canvas(14, 11)
    shadow(cv, 7, 9.5, 6, 1.5)
    for k in range(int(9 + rng.random() * 4)):
        x = 2 + rng.random() * 10
        h = 3 + rng.random() * 6
        lean = (x - 7) * 0.12 + (rng.random() - 0.5) * 0.4
        base = 0.3 + rng.random() * 0.25
        for t in range(int(h)):
            v = base + t / h * 0.5
            cv.pixel(x + lean * t, 9 - t, GRASS[int(np.clip(v, 0, 0.99) * len(GRASS))])
    return cv


def flowers(seed, color):
    rng = R(seed)
    cv = Canvas(15, 13)
    shadow(cv, 7.5, 11.5, 6.5, 1.6)
    foliage_cluster(cv, 7.5, 9.5, 6, 2.2, GRASS[1:8], rng, blob=(1.0, 1.8), lobes=3,
                    flat_bottom=0.2, dither=0.3)
    fr = FLOWER[color]
    heads = []
    for k in range(int(5 + rng.random() * 3)):
        x = 2.5 + rng.random() * 10
        top = 1.5 + rng.random() * 5
        for y in range(int(top) + 1, 10):
            cv.pixel(x, y, GRASS[3 + (y % 2)])
        heads.append((x, top))
    for x, y in sorted(heads, key=lambda p: p[1]):
        xi, yi = int(x), int(y)
        cv.pixel(xi, yi, fr[3])
        cv.pixel(xi - 1, yi, fr[2])
        cv.pixel(xi + 1, yi, fr[2])
        cv.pixel(xi, yi - 1, fr[2])
        cv.pixel(xi, yi + 1, fr[1])
        cv.pixel(xi, yi, FLOWER["yellow"][2] if color not in ("yellow", "orange") else FLOWER["orange"][1])
    return cv


def rock_prop(seed, rx, ry, mossy):
    rng = R(seed)
    w, h = int(rx * 2 + 6), int(ry * 2 + 5)
    cv = Canvas(w, h)
    shadow(cv, w / 2, h - 2.5, rx * 1.1, ry * 0.45)
    rock(cv, w / 2, h - 2 - ry, rx, ry, rng, ramp_cols=ROCK, moss=MOSS if mossy else None,
         moss_amt=0.7 if mossy else 0, flat=0.5, shade_fn=lambda a, b: 0.02)
    return cv


def fern_prop(seed, lush=True):
    rng = R(seed)
    cv = Canvas(24, 17)
    shadow(cv, 12, 15, 9, 1.8)
    rmp = LEAF[1:10]
    angs = [-2.6, -2.2, -1.85, -1.3, -0.95, -0.55, -1.57]
    for a in sorted(angs, key=lambda a: -abs(a + 1.57)):
        fern(cv, 12, 14, a + (rng.random() - 0.5) * 0.2, 9 + rng.random() * 4, rmp, rng,
             curl=0.06, leaflet=0.5, bias=0.08)
    return cv


def shrub(seed, berries=False):
    rng = R(seed)
    cv = Canvas(28, 21)
    shadow(cv, 14, 19, 12, 2.2)
    foliage_cluster(cv, 14, 12.5, 11.5, 7, LEAF[0:10], rng, blob=(1.6, 3.0), density=1.2,
                    flat_bottom=0.25, contrast=1.15, dither=0.4)
    if berries:
        a = cv.px[..., 3] > 0
        for k in range(10):
            x, y = int(6 + rng.random() * 16), int(7 + rng.random() * 10)
            if a[y, x]:
                cv.pixel(x, y, FLOWER["red"][2])
                cv.pixel(x + 1, y, FLOWER["red"][1])
    return cv


def log_prop(seed, mossy):
    rng = R(seed)
    cv = Canvas(34, 13)
    shadow(cv, 17, 11, 15, 2)
    xs, ys = grid(34, 13)
    # horizontal cylinder: y from 2..10, x from 3..29
    cy, r = 6.5, 4.0
    body = (xs >= 3) & (xs <= 28) & (np.abs(ys - cy) <= r)
    v = np.clip(-(ys - cy) / r, -1, 1)
    n = value_noise(34, 13, 3, rng, octaves=2, sx=5)
    val = 0.35 + v * 0.32 + (n - 0.5) * 0.35
    cv.put_ramp(body, val, BARK_WARM, dither=0.4)
    # end cap (rings)
    cap = ((xs - 29) / 2.2) ** 2 + ((ys - cy) / r) ** 2 <= 1
    rings = np.sqrt(((xs - 29) / 2.2) ** 2 + ((ys - cy) / r) ** 2)
    cv.put_ramp(cap, 0.5 + np.sin(rings * 9) * 0.2, WOOD, dither=0.2)
    if mossy:
        mn = value_noise(34, 13, 2, rng, octaves=2)
        mm = body & (ys < cy - 0.5) & (mn > 0.42)
        cv.put_ramp(mm, 0.35 + v * 0.3 + (mn - 0.5), MOSS, dither=0.4)
        # tiny mushrooms
        for x in (8, 11, 20):
            cv.pixel(x, 2, CREAM[2])
            cv.pixel(x + 1, 2, CREAM[3])
            cv.pixel(x - 1, 2, CREAM[1])
            cv.pixel(x, 3, CREAM[0])
    return cv


def lily(seed):
    rng = R(seed)
    cv = Canvas(18, 8)
    pads = [(5, 4.5, 4, 2), (12, 5, 4.5, 2.2), (9, 2.5, 3, 1.5)]
    for (x, y, rx, ry) in pads:
        m = ellipse_mask(18, 8, x, y, rx, ry)
        xs, ys = grid(18, 8)
        notch = (np.abs(np.arctan2(ys - y, xs - x) - (rng.random() * 2 - 1)) < 0.35)
        cv.put_ramp(m & ~notch, 0.45 + (x - xs) * -0.03 - (ys - y) * 0.08, LEAF[2:10], dither=0.4)
    cv.pixel(12, 3, FLOWER["pink"][3])
    cv.pixel(11, 3, FLOWER["pink"][2])
    cv.pixel(13, 3, FLOWER["pink"][2])
    cv.pixel(12, 2, FLOWER["pink"][3])
    cv.pixel(12, 4, FLOWER["yellow"][2])
    return cv


def reeds(seed):
    rng = R(seed)
    cv = Canvas(13, 22)
    for k in range(7):
        x = 2 + rng.random() * 9
        h = 10 + rng.random() * 9
        lean = (rng.random() - 0.5) * 0.25
        for t in range(int(h)):
            cv.pixel(x + lean * t, 20 - t, GRASS[2 + int(t / h * 5)])
        if k % 2 == 0:  # cattail head
            hx = x + lean * h
            for t in range(3):
                cv.pixel(hx, 20 - h - t, WOOD[3 + (t == 1)])
                cv.pixel(hx + 1, 20 - h - t, WOOD[2])
    # water ring at the base
    for x in range(1, 12):
        if rng.random() < 0.7:
            cv.pixel(x, 21, (216, 240, 230, 200))
    return cv


def tree(seed, w, h, trunk_w, crown_rx, crown_ry):
    rng = R(seed)
    cv = Canvas(w, h)
    cx = w / 2
    shadow(cv, cx, h - 2.5, crown_rx * 0.7, 2.5)
    crown_cy = crown_ry + 2
    trunk(cv, cx, crown_cy, h - 3, trunk_w * 0.7, trunk_w, BARK_WARM, rng, roots=trunk_w * 0.4,
          moss=MOSS[:6], moss_amt=0.25, texture=0.8)
    # a couple of branches into the crown
    for side in (-1, 1):
        for t in range(int(crown_rx * 0.6)):
            cv.pixel(cx + side * t, crown_cy + crown_ry * 0.5 - t * 0.7, BARK_WARM[2])
    foliage_cluster(cv, cx, crown_cy, crown_rx, crown_ry, LEAF, rng, blob=(1.8, 3.6),
                    density=1.15, contrast=1.15, lobes=7, dither=0.4)
    return cv


def bench():
    cv = Canvas(24, 13)
    shadow(cv, 12, 11, 11, 1.8)
    xs, ys = grid(24, 13)
    seat = (xs >= 2) & (xs <= 21) & (ys >= 6) & (ys <= 7)
    cv.put_ramp(seat, 0.75 - (ys - 6) * 0.2 + np.zeros_like(xs), WOOD, dither=0.2)
    back = (xs >= 2) & (xs <= 21) & (ys >= 1) & (ys <= 3)
    cv.put_ramp(back, 0.6 - (ys - 1) * 0.12 + np.zeros_like(xs), WOOD, dither=0.2)
    for x in (3, 20):
        for y in range(1, 11):
            cv.pixel(x, y, WOOD[2])
        cv.pixel(x + 1, 10, WOOD[1])
    for x in range(2, 22):
        cv.pixel(x, 8, WOOD[2])
    return cv


def feeder():
    cv = Canvas(13, 26)
    shadow(cv, 6.5, 24, 4, 1.2)
    for y in range(9, 24):
        cv.pixel(6, y, WOOD[3])
        cv.pixel(7, y, WOOD[2])
    # little house
    for y in range(4, 10):
        for x in range(2, 11):
            edge = x in (2, 10)
            cv.pixel(x, y, WOOD[4] if not edge else WOOD[2])
    for x in range(3, 10):
        cv.pixel(x, 8, LITTER[6])  # seeds tray
        cv.pixel(x, 7, LITTER[5] if x % 2 else LITTER[7])
    for i in range(7):  # roof
        cv.pixel(6 - i, 1 + i * 0.5 + 1, BARK_WARM[3])
        cv.pixel(6 + i, 1 + i * 0.5 + 1, BARK_WARM[5])
        cv.pixel(6 - i, 2 + i * 0.5 + 1, BARK_WARM[2])
        cv.pixel(6 + i, 2 + i * 0.5 + 1, BARK_WARM[4])
    return cv


def deck():
    cv = Canvas(44, 22)
    shadow(cv, 22, 20, 20, 2)
    xs, ys = grid(44, 22)
    floor_ = (xs >= 2) & (xs <= 41) & (ys >= 12) & (ys <= 17)
    planks = ((xs // 4) % 2)
    cv.put_ramp(floor_, 0.6 + planks * 0.12 - (ys - 12) * 0.05, WOOD, dither=0.2)
    for x in range(2, 42):
        cv.pixel(x, 18, WOOD[1])
        cv.pixel(x, 4, WOOD[5])
        cv.pixel(x, 5, WOOD[3])
    for x in (2, 12, 22, 32, 41):
        for y in range(4, 20):
            cv.pixel(x, y, WOOD[2] if y > 17 else WOOD[3])
    for x in range(2, 42, 3):
        for y in range(6, 12):
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
        rock_prop(30 + i, 4.2, 3.0, False).save(os.path.join(RCK, f"small_rock_{i}.png"))
        rock_prop(30 + i, 4.2, 3.0, True).save(os.path.join(RCK, f"small_rock_{i}_moss.png"))
        rock_prop(40 + i, 11, 7, False).save(os.path.join(RCK, f"big_rock_{i}.png"))
        rock_prop(40 + i, 11, 7, True).save(os.path.join(RCK, f"big_rock_{i}_moss.png"))
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
        tree(90 + i, 34, 48, 4, 13, 12).save(os.path.join(VEG, f"tree_small_{i}.png"))
    for i in range(2):
        tree(95 + i, 64, 98, 8, 27, 26).save(os.path.join(VEG, f"tree_big_{i}.png"))
    bench().save(os.path.join(STR, "bench_0.png"))
    feeder().save(os.path.join(STR, "feeder_0.png"))
    deck().save(os.path.join(STR, "deck_0.png"))
    print("props done")


if __name__ == "__main__":
    main()
