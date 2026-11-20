"""Generates every environment layer of the Little Creek scene.

Run:  python3 tools/art/gen_environment.py  (from the project root)

Outputs (assets/sprites/...):
  environment/bg_forest.png        sky + distant and mid forest (static)
  environment/ground_dry.png       forest floor, stage-1 look (+ creek bed)
  environment/ground_lush.png      forest floor, flourishing look
  rocks/creek_rocks_bare.png       creek rocks above the water
  rocks/creek_rocks_moss.png       same rocks with moss
  water/water_flow.png             RG flow dir, B speed, A water mask
  water/water_meta.png             R fall, G foam, B depth, A sunlight
  water/water_bed.png              bed colors seen through the water
  environment/tree_*.png           framing trees (trunk + canopy layers)
  environment/fg_*.png             foreground framing vegetation
  environment/trail.png            stage-4 trail overlay
  environment/zones.png            R placeable ground, G water, B blocked
  data/scene_points.json           perches, drink spots, trail, fish region
"""
import json
import math
import os
import sys

import numpy as np
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
from palette import *  # noqa
from pixlib import *  # noqa

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SPR = os.path.join(ROOT, "assets", "sprites")
W, H = 800, 360
HORIZON = 164
SAFE_X0, SAFE_X1 = 80, 720  # 16:9 safe area inside the 800px wide world

rng_master = np.random.default_rng(20261120)


def R(seed):
    return np.random.default_rng(seed)


def blend_ramp(r, col, f):
    c = np.array(col, np.float32)
    return [tuple(int(v) for v in (np.array(x, np.float32) * (1 - f) + c * f)) for x in r]


def mix(a, b, f):
    return tuple(int(a[i] * (1 - f) + b[i] * f) for i in range(3))


# ----------------------------------------------------------- light maps
def make_sun_map():
    """Dappled sunlight on the forest floor (0..1), coherent for all layers."""
    rng = R(11)
    n = value_noise(W, H, 26, rng, octaves=3, sx=2.2, sy=1.0)
    xs, ys = grid(W, H)
    # sun from top-right: brighter toward right/center; a broad diagonal band
    band = np.exp(-((xs * 0.55 + ys * 1.0 - 520) / 260.0) ** 2)
    region = np.clip(0.35 + 0.65 * band, 0, 1)
    s = np.clip((n - 0.47) * 5.0, 0, 1) * region
    return s


SUN = make_sun_map()


def sun_at(x, y):
    xi = np.clip(np.asarray(x).astype(int), 0, W - 1)
    yi = np.clip(np.asarray(y).astype(int), 0, H - 1)
    return SUN[yi, xi]


# ----------------------------------------------------------- background
SUN_POS = (610.0, -60.0)


def paint_background():
    cv = Canvas(W, H, (0, 0, 0, 255))
    xs, ys = grid(W, H)
    # sky: hazy light, bright near the sun
    d = np.sqrt((xs - SUN_POS[0]) ** 2 + ((ys - SUN_POS[1]) * 1.4) ** 2)
    sky = np.clip(1.05 - d / 620.0, 0, 1)
    sky_ramp = MIST_COOL[3:] + [LIGHT[0], LIGHT[1]]
    cv.put_ramp(np.ones((H, W), bool), sky * 0.95 + 0.05, sky_ramp, dither=0.9)

    def haze(xx, yy):
        dd = np.sqrt((xx - SUN_POS[0]) ** 2 + ((yy - SUN_POS[1]) * 1.4) ** 2)
        return np.clip(0.55 - dd / 900.0, 0, 0.5)

    # distant layers, far to near
    layers = [
        # (n trunks, width range, value bias, ramp, canopy y range, base y)
        (26, (2, 4), 0.62, MIST_COOL[3:10], (0, 80), HORIZON - 4),
        (20, (3, 6), 0.46, MIST_COOL[2:9], (0, 70), HORIZON - 2),
        (16, (4, 9), 0.30, MIST[1:9], (0, 60), HORIZON + 2),
        (12, (7, 14), 0.10, LEAF_TEAL[1:8], (-10, 48), HORIZON + 6),
    ]
    for li, (n, wr, bias, rmp, cyr, base) in enumerate(layers):
        rng = R(100 + li)
        # canopy masses across the top
        for i in range(int(14 + li * 3)):
            cx = rng.random() * (W + 80) - 40
            cy = cyr[0] + rng.random() * (cyr[1] - cyr[0])
            if li == 3 and abs(cx - 470) < 120:
                cy -= 30
            rx = 40 + rng.random() * 50 - li * 4
            ry = 22 + rng.random() * 20
            foliage_cluster(cv, cx, cy, rx, ry, rmp, rng, blob=(2.0 + li * 0.6, 3.5 + li),
                            bias=bias - 0.12 + 0.1 * li * 0, contrast=0.55 + li * 0.12,
                            density=0.9, shade_fn=lambda xx, yy: haze(xx, yy) * (1 - li * 0.2),
                            dither=0.6)
        # trunks
        xs_tr = np.sort(rng.random(n) * (W + 40) - 20)
        for x in xs_tr:
            if li >= 2 and abs(x - 470) < (150 if li == 3 else 70):
                continue
            wt = wr[0] + rng.random() * (wr[1] - wr[0])
            trunk(cv, x, -10, base + rng.random() * 6, wt * 0.8, wt * 1.15, rmp, rng,
                  lean=(rng.random() - 0.5) * 0.04, bias=bias - 0.15,
                  shade_fn=lambda xx, yy: haze(xx, yy) * 0.6, texture=0.5 + li * 0.2)
        # undergrowth along the horizon
        for i in range(int(30 + li * 6)):
            cx = rng.random() * W
            cy = base - 6 + rng.random() * 10
            foliage_cluster(cv, cx, cy, 12 + rng.random() * 18, 6 + rng.random() * 6, rmp, rng,
                            blob=(1.5 + li * 0.4, 3 + li * 0.5), bias=bias - 0.05,
                            contrast=0.6 + li * 0.1, flat_bottom=0.3,
                            shade_fn=lambda xx, yy: haze(xx, yy) * 0.5, dither=0.6)
        # fog bank between layers (dithered, quantized)
        fog = np.clip(1 - np.abs(ys - (base - 8)) / (24 + li * 4), 0, 1) ** 1.6
        fn = value_noise(W, H, 30, rng, octaves=2, sx=3)
        fogv = fog * (0.55 + fn * 0.5) * (0.85 - li * 0.15)
        b = bayer(W, H)
        fm = (fogv + b * 0.45) > 0.42
        fogcol = mix(MIST[9], LIGHT[0], 0.3)
        sel = fm & (ys < base + 6)
        cur = cv.px[..., :3].astype(np.float32)
        cur[sel] = cur[sel] * 0.45 + np.array(fogcol, np.float32) * 0.55
        cv.px[..., :3] = cur.astype(np.uint8)
    return cv


# ----------------------------------------------------------- creek geometry
# Nodes: (y, center_x, half_width). The creek always flows down-screen (toward
# the viewer), so it can be described per row. Falls: (lip_y, base_y).
CREEK_NODES = [
    (HORIZON - 1, 488, 2.0), (170, 484, 3.5), (178, 478, 5.0), (188, 468, 8.5),
    (198, 452, 14.4), (208, 432, 18.0), (218, 418, 21.6), (228, 414, 24.0),
    (242, 420, 26.4), (254, 436, 36.0), (266, 462, 39.6), (278, 490, 37.2),
    (290, 506, 36.0), (300, 510, 39.6), (312, 502, 44.4), (326, 482, 51.6),
    (342, 458, 60.0), (362, 444, 67.2),
]
FALLS = [(178, 185, 0.6), (226, 243, 1.0), (298, 310, 0.85)]  # lip, base, strength


def catmull(ys_nodes, vals, yq):
    """Monotone-friendly Catmull-Rom interpolation of vals over y."""
    out = np.zeros_like(yq, dtype=np.float32)
    n = len(ys_nodes)
    for i, y in enumerate(yq):
        if y <= ys_nodes[0]:
            out[i] = vals[0]
            continue
        if y >= ys_nodes[-1]:
            out[i] = vals[-1]
            continue
        k = np.searchsorted(ys_nodes, y) - 1
        y0, y1 = ys_nodes[k], ys_nodes[k + 1]
        t = (y - y0) / (y1 - y0)
        p0 = vals[max(k - 1, 0)]
        p1 = vals[k]
        p2 = vals[k + 1]
        p3 = vals[min(k + 2, n - 1)]
        out[i] = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                        + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
    return out


def build_creek():
    ny = np.array([n[0] for n in CREEK_NODES], np.float32)
    nx = np.array([n[1] for n in CREEK_NODES], np.float32)
    nw = np.array([n[2] for n in CREEK_NODES], np.float32)
    yq = np.arange(H, dtype=np.float32)
    cx = catmull(ny, nx, yq)
    hw = catmull(ny, nw, yq)
    rng = R(7)
    # irregular banks (independent noise on each side)
    el = (value_noise(1, H, 5, rng, octaves=3)[:, 0] - 0.5) * 2
    er = (value_noise(1, H, 5, rng, octaves=3)[:, 0] - 0.5) * 2
    left = cx - hw - el * np.clip(hw * 0.22, 0.3, 4)
    right = cx + hw + er * np.clip(hw * 0.22, 0.3, 4)
    xs, ys = grid(W, H)
    L = left[ys.astype(int)]
    Rr = right[ys.astype(int)]
    mask = (xs >= L) & (xs <= Rr) & (ys >= HORIZON - 1)
    # normalized lateral coord -1..1
    c = cx[ys.astype(int)]
    half = np.maximum((Rr - L) / 2, 0.5)
    u = (xs - (L + Rr) / 2) / half
    # flow direction from dcx/dy
    dcx = np.gradient(cx)
    fdx = dcx[ys.astype(int)]
    fdy = np.ones_like(fdx)
    ln = np.sqrt(fdx ** 2 + fdy ** 2)
    fdx, fdy = fdx / ln, fdy / ln
    fall = np.zeros((H, W), np.float32)
    foam = np.zeros((H, W), np.float32)
    for lip, base, strength in FALLS:
        rows = (ys >= lip) & (ys <= base)
        fall = np.where(rows & mask, strength, fall)
        # foam at the base and a little at the lip
        cxb = cx[base]
        hwb = hw[base]
        dd = ((xs - cxb) / (hwb * 0.95)) ** 2 + ((ys - base - 2) / (3 + hwb * 0.14)) ** 2
        foam = np.maximum(foam, np.clip(1.0 - dd, 0, 1) ** 1.3 * strength * 0.85)
        lipm = (np.abs(ys - lip) <= 1)
        foam = np.where(lipm & mask, np.maximum(foam, 0.45 * strength), foam)
    # speed: narrower = faster, pools slower, edges slower
    speed = np.clip(1.2 - half / 40.0, 0.35, 1.0) * (1 - 0.45 * u ** 2)
    speed = np.where(fall > 0, 1.0, speed)
    depth = np.clip(1 - u ** 2, 0, 1) * np.clip(half / 26.0, 0.25, 1.0)
    # perspective: far water looks shallower/lighter
    depth *= np.clip((ys - HORIZON) / 90.0, 0.25, 1.0)
    return dict(mask=mask, u=u, cx=cx, hw=hw, left=left, right=right,
                fdx=fdx, fdy=fdy, fall=fall, foam=foam, speed=speed, depth=depth)


# ----------------------------------------------------------- creek rocks
def creek_rock_list(cr):
    """Rocks lining the banks, framing the falls and breaking the current."""
    rng = R(31)
    rocks = []  # (x, y, rx, ry, seed, in_water)
    left, right, cx, hw = cr["left"], cr["right"], cr["cx"], cr["hw"]
    # bank rocks: walk down both banks; sizes vary a lot (few big, many small)
    y = HORIZON + 6
    while y < H + 8:
        yi = min(int(y), H - 1)
        persp = float(np.clip((y - HORIZON) / 190.0, 0.12, 1.0))
        for side in (-1, 1):
            if rng.random() < 0.55:
                edge = left[yi] if side < 0 else right[yi]
                big = rng.random() < 0.28
                rx = ((13 + rng.random() * 11) if big else (3.5 + rng.random() * 6)) * (0.35 + persp)
                ry = rx * (0.5 + rng.random() * 0.18)
                x = edge + side * rx * (0.05 + rng.random() * 0.45)
                rocks.append((x, y + ry * 0.3, rx, ry, int(rng.integers(1e9)), False))
        y += (4 + rng.random() * 7) * (0.35 + persp)
    # falls: lip boulders on both sides + splitting rocks in the curtain
    for lip, base, strength in FALLS:
        persp = float(np.clip((lip - HORIZON) / 190.0, 0.2, 1.0))
        c = cx[lip]
        h = hw[lip]
        for side in (-1, 1):
            rx = (15 + rng.random() * 10) * (0.45 + persp)
            rocks.append((c + side * (h + rx * 0.35), base - (base - lip) * 0.2, rx,
                          (base - lip) * 0.7 + 4, int(rng.integers(1e9)), False))
        nsplit = 1 if h < 12 else 2
        for k in range(nsplit):
            fx = c + (k - (nsplit - 1) / 2) * h * 0.9 + (rng.random() - 0.5) * 4
            rx = 4 + h * 0.26
            rocks.append((fx, lip + (base - lip) * 0.6, rx, (base - lip) * 0.45 + 1.5,
                          int(rng.integers(1e9)), True))
        for k in range(2 + int(h / 9)):
            yy = base + 7 + rng.random() * 14
            yi = min(int(yy), H - 1)
            xx = cx[yi] + (rng.random() - 0.5) * hw[yi] * 1.5
            r = 2.5 + rng.random() * 4.5
            rocks.append((xx, yy, r, r * 0.6, int(rng.integers(1e9)), True))
    for k in range(9):
        yy = 195 + rng.random() * 160
        yi = min(int(yy), H - 1)
        xx = cx[yi] + (rng.random() - 0.5) * hw[yi] * 1.3
        r = 1.8 + rng.random() * 3.5 * (yy / 300)
        rocks.append((xx, yy, r, r * 0.6, int(rng.integers(1e9)), True))
    rocks.sort(key=lambda r: r[1] + r[3])
    return rocks


def paint_rocks(rocks, mossy):
    cv = Canvas(W, H)
    for (x, y, rx, ry, seed, inw) in rocks:
        rng = R(seed)
        far = float(np.clip(1 - (y - HORIZON) / 110.0, 0, 1))
        rmp = blend_ramp(ROCK, MIST[8], far * 0.6)
        mrmp = blend_ramp(MOSS, MIST[8], far * 0.6)

        def sh(xx, yy, far=far):
            return sun_at(xx, yy) * 0.22 - 0.1 + far * 0.18

        # contact shadow (darken whatever is below: drawn as dark translucent)
        sm = ellipse_mask(int(rx * 2.6) + 4, int(ry * 1.2) + 4,
                          rx * 1.3 + 2, ry * 0.6 + 2, rx * 1.25, ry * 0.55)
        ox, oy = int(x - rx * 1.3 - 2), int(y + ry * 0.55 - ry * 0.6 - 2)
        cv.put_color(sm, (12, 24, 32, 110), ox=ox, oy=oy)
        rock(cv, x, y, rx, ry, rng, ramp_cols=rmp, moss=mrmp if mossy else None,
             moss_amt=(0.5 if mossy else 0.0), wet=0.3 if inw else 0.15, shade_fn=sh,
             flat=0.5)
    return cv


# ----------------------------------------------------------- ground
def terrain_height(cr):
    """Low-frequency relief + banks that slope down into the creek."""
    xs, ys = grid(W, H)
    hgt = value_noise(W, H, 40, R(71), octaves=3, sx=2.5) * 1.0
    # distance to water (in px, horizontal), banks dip toward the creek
    m = cr["mask"]
    dist = ndimage.distance_transform_edt(~m)
    persp = np.clip((ys - HORIZON) / 190.0, 0.15, 1.0)
    bank = np.exp(-dist / (6 + 16 * persp))
    return hgt * 18 * persp - bank * 9 * persp, dist


def paint_ground(cr, lush):
    cv = Canvas(W, H)
    rng = R(51)  # same seed for both versions -> coherent dissolve
    xs, ys = grid(W, H)
    gm = ys >= HORIZON - 3
    far = np.clip(1 - (ys - HORIZON) / 95.0, 0, 1) ** 1.4
    n1 = value_noise(W, H, 16, R(52), octaves=4, sx=2.4)
    n2 = value_noise(W, H, 5, R(53), octaves=2, sx=2.0)
    hgt, dist = terrain_height(cr)
    gy, gx = np.gradient(hgt)
    slope_light = np.clip(gx * 0.9 - gy * 0.6, -1, 1)  # faces right/up -> lit
    sun = SUN
    treeshade = (np.exp(-((xs - 112) / 60.0) ** 2) + np.exp(-((xs - 700) / 70.0) ** 2)) \
        * np.clip((ys - 190) / 170.0, 0, 1)
    v = 0.30 + (n1 - 0.5) * 0.45 + (n2 - 0.5) * 0.18 + sun * 0.42 + slope_light * 0.35 \
        - treeshade * 0.22
    v -= np.clip((ys - 290) / 70.0, 0, 1) * 0.12  # darker near the viewer
    v -= np.exp(-dist / 3.0) * 0.12  # damp soil at the waterline
    base_ramp = GRASS[:9] if lush else LEAF_DRY
    cv.put_ramp(gm, v - (0.07 if lush else 0.0), base_ramp, dither=0.6)
    # dry: dirt/litter patches  |  lush: moss patches
    patch = value_noise(W, H, 11, R(54), octaves=3, sx=2.6)
    pm = gm & (patch > (0.60 if lush else 0.55))
    if lush:
        cv.put_ramp(pm, v * 0.85 + 0.08, MOSS, dither=0.5)
    else:
        cv.put_ramp(pm, v * 0.75 + 0.05, LITTER, dither=0.5)
    # specks (leaves / pebbles / clover)
    ys_i, xs_i = np.nonzero(gm & (ys > HORIZON + 4))
    sel = rng.choice(len(xs_i), len(xs_i) // 12, replace=False)
    spk_ramp = GRASS if lush else LITTER
    for i in sel:
        x, y = xs_i[i], ys_i[i]
        val = 0.2 + rng.random() * 0.45 + sun[y, x] * 0.35
        col = spk_ramp[int(np.clip(val, 0, 0.999) * len(spk_ramp))]
        cv.pixel(x, y, col)
        if rng.random() < 0.6:
            cv.pixel(x + 1, y, col)
    # grass blades (taller near viewer)
    blade_ramp = GRASS if lush else LEAF_DRY
    for (y0, y1, dens, hmin, hmax) in ((HORIZON + 6, 230, 0.05, 1, 2), (230, 290, 0.07, 2, 4),
                                       (290, H, 0.08, 2, 6)):
        bm = gm & (ys >= y0) & (ys < y1) & (dist > 2)
        grass_blades(cv, bm, blade_ramp, rng, density=dens * (1.6 if lush else 0.7),
                     hmin=hmin, hmax=hmax,
                     light_fn=lambda x, y: sun[min(y, H - 1), min(x, W - 1)] * 0.35 - 0.06)
    # clover / small leafy clumps (lush) or twigs + stones (dry)
    for k in range(320):
        x = rng.random() * W
        y = HORIZON + 10 + rng.random() * (H - HORIZON - 10)
        if dist[min(int(y), H - 1), min(int(x), W - 1)] < 4:
            continue
        p = float(np.clip((y - HORIZON) / 190.0, 0.3, 1))
        if lush:
            r = (1.5 + rng.random() * 2) * p
            foliage_cluster(cv, x, y, r * 2.2, r, GRASS, rng, blob=(1.0, 1.8), density=1.2,
                            bias=float(sun_at(x, y)) * 0.3 - 0.02, contrast=0.9, lobes=2,
                            dither=0.3)
        else:
            if rng.random() < 0.45:
                L = int((3 + rng.random() * 5) * p) + 1
                col = WOOD[int(1 + rng.random() * 3)]
                yy = y
                for t in range(L):
                    cv.pixel(x + t, yy, col)
                    if rng.random() < 0.3:
                        yy += rng.choice([-1, 1])
    # fog toward the horizon (quantized blend)
    fogc = np.array(mix(MIST[8], LIGHT[0], 0.25), np.float32)
    b = bayer(W, H)
    f = np.clip(far + b * 0.18, 0, 1)
    f = np.round(f * 5) / 5
    cur = cv.px[..., :3].astype(np.float32)
    cur = cur * (1 - f[..., None] * 0.8) + fogc * f[..., None] * 0.8
    cv.px[..., :3] = np.where(gm[..., None], cur, cv.px[..., :3]).astype(np.uint8)
    # soft top edge: ragged dithered transition into the background undergrowth
    edge = (ys < HORIZON + 4) & ((value_noise(W, H, 3, R(55))[..., None][..., 0] + b * 0.6)
                                 < (HORIZON + 4 - ys) / 7.0)
    cv.px[edge, 3] = 0
    # creek bank: wet dark soil just outside the water
    m = cr["mask"]
    bank = (dist > 0) & (dist <= 2.5)
    bv = 0.12 + n2 * 0.25 + sun * 0.2
    cv.put_ramp(bank & gm, bv, EARTH, dither=0.5)
    cv.px[m, 3] = 0
    return cv


def paint_bed(cr):
    cv = Canvas(W, H)
    m = cr["mask"]
    xs, ys = grid(W, H)
    n = value_noise(W, H, 3, R(61), octaves=3)
    v = 0.3 + (n - 0.5) * 0.8 + SUN * 0.3 - cr["depth"] * 0.25
    cv.put_ramp(m, v, ROCK_COOL, dither=0.6)
    # pebbles
    rng = R(62)
    ys_i, xs_i = np.nonzero(m)
    for i in rng.choice(len(xs_i), len(xs_i) // 30, replace=False):
        x, y = xs_i[i], ys_i[i]
        c = EARTH[int(3 + rng.random() * 4)] if rng.random() < 0.5 else ROCK[int(5 + rng.random() * 5)]
        cv.pixel(x, y, c)
        if rng.random() < 0.5:
            cv.pixel(x + 1, y, c)
    return cv


def water_maps(cr):
    m = cr["mask"]
    flow = np.zeros((H, W, 4), np.uint8)
    flow[..., 0] = np.clip((cr["fdx"] * 0.5 + 0.5) * 255, 0, 255)
    flow[..., 1] = np.clip((cr["fdy"] * 0.5 + 0.5) * 255, 0, 255)
    flow[..., 2] = np.clip(cr["speed"] * 255, 0, 255)
    flow[..., 3] = np.where(m, 255, 0)
    meta = np.zeros((H, W, 4), np.uint8)
    # foam also hugs rocks that sit in the water (computed later)
    meta[..., 0] = np.clip(cr["fall"] * 255, 0, 255)
    meta[..., 1] = np.clip(cr["foam"] * 255, 0, 255)
    meta[..., 2] = np.clip(cr["depth"] * 255, 0, 255)
    meta[..., 3] = np.clip(SUN * 255, 0, 255)
    return flow, meta


# ----------------------------------------------------------- scenery
def fern(cv, bx, by, angle, length, ramp_cols, rng, curl=0.012, leaflet=0.45,
         bias=0.0, droop=1.0):
    """Pixel fern frond: curved stem with alternating, tapering leaflets."""
    a = angle
    x, y = float(bx), float(by)
    pts = []
    for i in range(int(length)):
        pts.append((x, y, a))
        x += math.cos(a)
        y += math.sin(a)
        a += curl * droop * (1 if math.cos(angle) > 0 else -1)
    n = len(pts)
    for i, (x, y, a) in enumerate(pts):
        t = i / max(n - 1, 1)
        lit = 0.42 + 0.25 * (1 - t) + bias
        cv.pixel(x, y, ramp_cols[int(np.clip(lit - 0.1, 0, 0.999) * len(ramp_cols))])
        if i % 2 == 0 and i > 1:
            L = int(length * leaflet * (1 - t) ** 0.8 * (0.35 + 0.65 * math.sin(math.pi * min(1, t * 1.3 + 0.1))))
            for side in (-1, 1):
                la = a + side * 1.05 + 0.35  # leaflets droop downward
                lx, ly = x, y
                for k in range(L):
                    lx += math.cos(la)
                    ly += math.sin(la)
                    s = side * 0.12 + (0.18 if math.sin(la) < 0 else -0.05)
                    v = lit + s + (k / max(L, 1)) * 0.12 + (rng.random() - 0.5) * 0.12
                    cv.pixel(lx, ly, ramp_cols[int(np.clip(v, 0, 0.999) * len(ramp_cols))])


def paint_horizon_bushes(cv, lush, cr):
    rng = R(81)
    rmp_base = LEAF if lush else LEAF_DRY
    dist = ndimage.distance_transform_edt(~cr["mask"])
    for k in range(150):
        x = rng.random() * W
        y = HORIZON - 3 + rng.random() ** 1.6 * 24
        if dist[min(int(y), H - 1), min(int(x), W - 1)] < 5:
            continue
        far = float(np.clip(1 - (y - HORIZON + 4) / 40.0, 0, 1))
        rmp = blend_ramp(rmp_base[1:9], MIST[8], 0.25 + far * 0.45)
        sz = 5 + (y - HORIZON + 4) * 0.5 + rng.random() * 8
        foliage_cluster(cv, x, y - sz * 0.25, sz * (1.1 + rng.random() * 0.6), sz * 0.5, rmp, rng,
                        blob=(1.4, 2.6), flat_bottom=0.35, contrast=0.85,
                        bias=float(sun_at(x, y)) * 0.25 - 0.02, dither=0.5)


MID_TREES = [  # x, base_y, width
    (152, 176, 11), (236, 170, 8), (300, 186, 15), (370, 172, 7),
    (580, 182, 13), (628, 171, 8), (660, 190, 16), (540, 168, 6),
]


def paint_mid_trees():
    cv = Canvas(W, H)
    for i, (x, by, w) in enumerate(MID_TREES):
        rng = R(300 + i)
        far = float(np.clip(1 - (by - HORIZON) / 40.0, 0, 1))
        bark = blend_ramp(BARK, MIST[7], 0.25 + far * 0.4)
        moss = blend_ramp(MOSS[:6], MIST[7], 0.3 + far * 0.4)
        leaf = blend_ramp(LEAF[0:10], MIST[6], 0.08 + far * 0.25)
        # canopy at the top (behind trunk top) + a few side branch clumps
        for k in range(4):
            foliage_cluster(cv, x + (rng.random() - 0.5) * 70, -5 + rng.random() * 35,
                            30 + rng.random() * 25, 16 + rng.random() * 12, leaf, rng,
                            blob=(2.0, 3.8), contrast=1.25, bias=-0.06, dither=0.45)
        trunk(cv, x, -12, by, w * 0.75, w, bark, rng, lean=(rng.random() - 0.5) * 0.03,
              moss=moss, moss_amt=0.3, roots=w * 0.35, texture=1.0,
              shade_fn=lambda xx, yy: sun_at(xx, yy) * 0.15)
    return cv


FRAME_TREES = [  # name, x, base_y, width
    ("tree_frame_left", 106, 352, 34),
    ("tree_frame_right", 706, 338, 28),
]


def paint_frame_tree(x, by, w, seed):
    """Big near tree trunk: dark, mossy, root flare. Returns canvas + origin."""
    rng = R(seed)
    cw = int(w * 3.2)
    ch = by + 14
    cv = Canvas(cw, ch)
    cx = cw / 2
    trunk(cv, cx, -2, by, w * 0.82, w, BARK, rng, lean=(rng.random() - 0.5) * 0.02,
          moss=MOSS[:6], moss_amt=0.4, roots=w * 0.55, texture=1.3, bias=-0.08,
          shade_fn=lambda xx, yy: np.clip((yy - 150) / 300.0, 0, 0.2) * 0
          + sun_at(xx - cx + x, yy) * 0.25)
    # root tendrils
    for side in (-1, 1):
        for k in range(2):
            rx = cx + side * (w * 0.5 + k * 4)
            ry = by - 4 - k * 2
            for t in range(int(10 + rng.random() * 8)):
                for dy in range(2):
                    v = 0.35 + (0.15 if side > 0 else -0.05)
                    cv.pixel(rx + side * t, ry + t * 0.35 + dy, BARK[int(v * len(BARK)) + dy])
    # small fern clumps at the base
    for k in range(4):
        fern(cv, cx + (rng.random() - 0.5) * w * 1.6, by + 2, -math.pi / 2 + (rng.random() - 0.5) * 1.8,
             8 + rng.random() * 8, LEAF_NEAR[2:], rng, bias=0.1)
    return cv, (int(x - cx), 0)


def paint_fg_top():
    cv = Canvas(W, H)
    rng = R(401)
    # heavy masses in the corners, a broken leafy fringe elsewhere (light gets in)
    masses = [(30, 0, 120, 58), (120, -6, 80, 30), (0, 60, 46, 70), (205, -16, 60, 22),
              (700, -4, 110, 50), (790, 26, 64, 76), (610, -18, 70, 24), (470, -24, 50, 18),
              (300, -14, 46, 18), (380, -18, 40, 14), (540, -16, 44, 16)]
    for (cx, cy, rx, ry) in masses:
        foliage_cluster(cv, cx, cy, rx, ry, LEAF_NEAR, rng, blob=(2.2, 4.5), density=1.1,
                        contrast=1.1, bias=-0.06, light=np.array([0.35, 0.94]) * -1,
                        dither=0.4)
    # small hanging sprigs from the masses
    for k in range(16):
        x = rng.random() * W
        if 260 < x < 560:
            continue
        y = 18 + rng.random() * 40
        foliage_cluster(cv, x, y, 6 + rng.random() * 6, 4 + rng.random() * 3, LEAF_NEAR, rng,
                        blob=(1.4, 2.6), lobes=3, density=1.0, bias=-0.02, dither=0.35)
    # backlit glow: bright translucent leaves on the lower edges
    a = cv.px[..., 3] > 0
    below = np.zeros_like(a)
    below[:-1] = a[:-1] & ~a[1:]
    ys, xs = np.nonzero(below)
    for i in range(len(xs)):
        if rng.random() < 0.22:
            cv.pixel(xs[i], ys[i], LEAF[7 + int(rng.random() * 3)])
    return cv


def paint_fg_bottom(lush):
    cv = Canvas(W, H)
    rng = R(501)
    rmp = LEAF_NEAR if lush else blend_ramp(LEAF_DRY[:7], LEAF_NEAR[2], 0.45)
    spots = [(20, 372, 70, 30), (120, 380, 60, 22), (760, 372, 80, 34), (690, 384, 50, 20)]
    for (cx, cy, rx, ry) in spots:
        foliage_cluster(cv, cx, cy, rx, ry, rmp, rng, blob=(2.0, 4.2), density=1.0,
                        contrast=1.0, bias=-0.05, dither=0.4)
    for k in range(18 if lush else 9):
        side = rng.random() < 0.5
        bx = (rng.random() * 140) if side else (W - rng.random() * 150)
        by = H + 4
        ang = -math.pi / 2 + (0.5 if side else -0.5) + (rng.random() - 0.5) * 0.9
        fern(cv, bx, by, ang, 26 + rng.random() * 26, rmp, rng, curl=0.02, bias=0.05)
    return cv


TRAIL = [(60, 318), (120, 306), (190, 296), (262, 290), (320, 282), (362, 270),
         (350, 250), (318, 236), (300, 220), (306, 204), (322, 192)]


def paint_trail(cr):
    cv = Canvas(W, H)
    rng = R(601)
    xs, ys = grid(W, H)
    pts = np.array(TRAIL, np.float32)
    dense = []
    for i in range(len(pts) - 1):
        for t in np.linspace(0, 1, 30, endpoint=False):
            dense.append(pts[i] * (1 - t) + pts[i + 1] * t)
    dense.append(pts[-1])
    dense = np.array(dense)
    mind = np.full((H, W), 1e9, np.float32)
    for p in dense:
        d = np.sqrt(((xs - p[0]) / 1.0) ** 2 + ((ys - p[1]) * 2.2) ** 2)
        mind = np.minimum(mind, d)
    persp = np.clip((ys - HORIZON) / 190.0, 0.15, 1.0)
    half = 8 + 16 * persp
    n = value_noise(W, H, 3, R(602), octaves=2)
    m = (mind < half + (n - 0.5) * 3) & ~cr["mask"]
    v = 0.45 + (n - 0.5) * 0.4 + SUN * 0.3 - (mind / half) * 0.15
    cv.put_ramp(m, v, blend_ramp(EARTH[2:], ROCK[7], 0.35), dither=0.6)
    edge = m & (mind > half - 1.5)
    cv.put_ramp(edge, v - 0.2, EARTH, dither=0.3)
    # edging stones
    for p in dense[::7]:
        for side in (-1, 1):
            if rng.random() < 0.5:
                yy = p[1]
                pp = float(np.clip((yy - HORIZON) / 190.0, 0.15, 1.0))
                rock(cv, p[0] + side * (4 + 9 * pp + 1), yy + side * 1, 1.5 + 1.5 * pp, 1 + pp,
                     rng, ramp_cols=ROCK, cracks=False, shade_fn=lambda a, b: -0.05)
    return cv, m


def scene_points(cr, rmask, trailmask, frame_canvases):
    """Zones + gameplay points derived from the art (keeps logic and art in sync)."""
    m = cr["mask"]
    xs, ys = grid(W, H)
    water_near = ndimage.binary_dilation(m, iterations=4)
    rock_near = ndimage.binary_dilation(rmask, iterations=2)
    blocked = np.zeros((H, W), bool)
    for (name, x, by, w), (cv, (ox, oy)) in zip(FRAME_TREES, frame_canvases):
        blocked |= (np.abs(xs - x) < w * 0.75 + 6) & (ys > by - 40) & (ys < by + 6)
        blocked |= (np.abs(xs - x) < w * 0.6) & (ys <= by)
    ground = (ys >= 206) & (ys <= 352) & ~water_near & ~rock_near & ~blocked \
        & (xs > SAFE_X0 + 6) & (xs < SAFE_X1 - 6)
    meta_ok = (cr["fall"] == 0) & (cr["foam"] < 0.2) & (cr["depth"] > 0.12)
    water_ok = m & ~ndimage.binary_dilation(rmask, iterations=2) & meta_ok & (ys >= 200) \
        & (xs > SAFE_X0) & (xs < SAFE_X1)
    zones = np.zeros((H, W, 4), np.uint8)
    zones[..., 0] = np.where(ground, 255, 0)
    zones[..., 1] = np.where(water_ok, 255, 0)
    zones[..., 2] = np.where(ndimage.binary_dilation(trailmask, iterations=2), 255, 0)
    zones[..., 3] = 255
    # deer drinking spots: the whole body (in perspective) must stand on dry
    # ground while the muzzle reaches the water. Deer sprite: ~32 px long,
    # ~24 px tall, anchored at the feet, muzzle ~16 px ahead.
    dry = ~ndimage.binary_dilation(m, iterations=1) & ~(rmask) & ~blocked & (xs > SAFE_X0 + 20) & (xs < SAFE_X1 - 20)
    drink = []
    def hits_fall(yy, x0, x1):
        for l, b, _s in FALLS:
            fx0, fx1 = cr["cx"][b] - cr["hw"][b] - 8, cr["cx"][b] + cr["hw"][b] + 8
            if yy - 32 <= b + 14 and yy >= l - 4 and x1 >= fx0 and x0 <= fx1:
                return True
        return False

    for yy in range(236, 346, 2):
        for side in (-1, 1):
            f = -side  # face toward the water
            edge = cr["left"][yy] if side < 0 else cr["right"][yy]
            for dd in range(12, 30):
                x = int(round(edge + side * dd))
                x0, x1 = sorted((x - 19 * f, x + 13 * f))
                if x0 < 0 or x1 >= W:
                    continue
                body = dry[yy - 13:yy + 1, x0:x1 + 1]
                if body.size == 0 or body.mean() < 0.88 or hits_fall(yy, x0, x1):
                    continue
                mx, my = x + 21 * f, yy - 9
                near = m[max(my - 3, 0):my + 3, max(mx - 2, 0):mx + 3]
                if near.any():
                    if all(abs(d2["y"] - yy) > 14 or d2["face"] != f for d2 in drink):
                        drink.append({"x": float(x), "y": float(yy), "face": f})
                    break
    # fish swim region: centers of calm water rows
    fish = []
    for yy in range(250, 352, 6):
        if cr["fall"][yy].max() == 0:
            fish.append({"x": float(cr["cx"][yy]), "y": float(yy), "hw": float(cr["hw"][yy] * 0.6)})
    # perches on the frame canopies (in fg_top) and mid-tree branches
    perches = [{"x": 70.0, "y": 64.0}, {"x": 150.0, "y": 30.0}, {"x": 214.0, "y": 22.0},
               {"x": 600.0, "y": 22.0}, {"x": 650.0, "y": 52.0}, {"x": 730.0, "y": 70.0},
               {"x": 108.0, "y": 92.0}, {"x": 690.0, "y": 80.0}]
    return zones, {
        "world_size": [W, H], "safe_x": [SAFE_X0, SAFE_X1], "horizon": HORIZON,
        "frame_trees": [{"name": n, "x": x, "base_y": by, "ox": o[0], "oy": o[1]}
                        for (n, x, by, w), (_, o) in zip(FRAME_TREES, frame_canvases)],
        "drink_spots": drink, "fish_rows": fish, "perches": perches,
        "trail": [{"x": float(x), "y": float(y)} for x, y in TRAIL],
        "falls": [{"lip": l, "base": b, "x": float(cr["cx"][b]), "hw": float(cr["hw"][b])}
                  for l, b, s in FALLS],
        "creek_rows": [{"y": int(y), "l": float(cr["left"][y]), "r": float(cr["right"][y])}
                       for y in range(HORIZON, H, 4)],
    }


def save_png(arr, path):
    Image.fromarray(arr, "RGBA").save(path)


if __name__ == "__main__":
    from PIL import Image
    for d in ("environment", "rocks", "water"):
        os.makedirs(os.path.join(SPR, d), exist_ok=True)
    bg = paint_background()
    bg.save(os.path.join(SPR, "environment", "bg_forest.png"))
    cr = build_creek()
    g_dry = paint_ground(cr, False)
    g_lush = paint_ground(cr, True)
    paint_horizon_bushes(g_dry, False, cr)
    paint_horizon_bushes(g_lush, True, cr)
    g_dry.save(os.path.join(SPR, "environment", "ground_dry.png"))
    g_lush.save(os.path.join(SPR, "environment", "ground_lush.png"))
    paint_bed(cr).save(os.path.join(SPR, "water", "water_bed.png"))
    rocks = creek_rock_list(cr)
    rb = paint_rocks(rocks, False)
    rm = paint_rocks(rocks, True)
    rb.save(os.path.join(SPR, "rocks", "creek_rocks_bare.png"))
    rm.save(os.path.join(SPR, "rocks", "creek_rocks_moss.png"))
    flow, meta = water_maps(cr)
    # foam ring around rocks in the water
    rmask = rb.px[..., 3] > 0
    ring = ndimage.binary_dilation(rmask, iterations=2) & ~rmask & cr["mask"]
    meta[..., 1] = np.maximum(meta[..., 1], np.where(ring, 95, 0)).astype(np.uint8)
    save_png(flow, os.path.join(SPR, "water", "water_flow.png"))
    save_png(meta, os.path.join(SPR, "water", "water_meta.png"))
    paint_mid_trees().save(os.path.join(SPR, "environment", "mid_trees.png"))
    frames = []
    for i, (name, x, by, w) in enumerate(FRAME_TREES):
        cv, o = paint_frame_tree(x, by, w, 700 + i)
        cv.save(os.path.join(SPR, "environment", name + ".png"))
        frames.append((cv, o))
    paint_fg_top().save(os.path.join(SPR, "environment", "fg_top.png"))
    paint_fg_bottom(False).save(os.path.join(SPR, "environment", "fg_bottom_dry.png"))
    paint_fg_bottom(True).save(os.path.join(SPR, "environment", "fg_bottom_lush.png"))
    tr, tmask = paint_trail(cr)
    tr.save(os.path.join(SPR, "environment", "trail.png"))
    zones, pts = scene_points(cr, rmask, tmask, frames)
    save_png(zones, os.path.join(SPR, "environment", "zones.png"))
    with open(os.path.join(ROOT, "data", "scene_points.json"), "w") as f:
        json.dump(pts, f, indent=1)
    print("environment done")
