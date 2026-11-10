"""Cinco anfiteatros diferentes (um a cada dois adversários).

O céu fica TRANSPARENTE: o jogo desenha o céu dinamicamente (ciclo de dia e noite).
Todas as arenas compartilham a mesma geometria básica (pódio em y=200..240, areia
a partir de y=240) para que o combate e os braseiros fiquem no mesmo lugar.
"""
import math
import numpy as np
from PIL import ImageDraw
from pixel import new_img, darker, lighter, mix, hexc
from gen_scenes import (W, H, fill_rect, gradient, noise, darken_region, to_img,
                        TUNICS, SKINS, HAIRS, GOLD, PURPLE, DARK)

THEMES = {
    "capua": dict(
        name="Arena de Cápua", style="wood", seat_top=136, balteus=[], velarium=None, upper="fence",
        stone="9a6a3e", podium="7a5230", panel=None, trim="5a3a20", floor="c4a272", banner="8a3a22",
        crowd=0.22, scenery="hills", pulvinar=False,
    ),
    "pompeii": dict(
        name="Anfiteatro de Pompeia", style="stone", seat_top=118, balteus=[158], velarium=("b8372e", "efe0c0"),
        velarium_partial=True, upper="parapet", stone="bca98a", podium="e2d6bc", panel="2a2420", trim="a8322a",
        floor="d4b47a", banner="a8322a", crowd=0.42, scenery="vesuvius", pulvinar=False,
    ),
    "verona": dict(
        name="Arena de Verona", style="stone", seat_top=113, balteus=[142, 172], velarium=("3e6e40", "efe0c0"),
        upper="arcade", arcade_top=58, stone="d8a898", podium="efe4dc", panel="3e6e40", trim="d8b04a",
        floor="dcbf88", banner="3e6e40", crowd=0.62, scenery="cypress", pulvinar=False,
    ),
    "leptis": dict(
        name="Anfiteatro de Leptis Magna", style="stone", seat_top=113, balteus=[142, 172], velarium=("2a5a9a", "f2ecd8"),
        velarium_partial=True, upper="arcade", arcade_top=74, stone="e2c48a", podium="f2e8d0", panel="2a5a9a",
        trim="d8b04a", floor="e6c88a", banner="2a5a9a", crowd=0.8, scenery="palms", pulvinar=False,
    ),
    "rome": dict(
        name="Coliseu de Roma", style="stone", seat_top=113, balteus=[142, 172], velarium=("b8372e", "efe0c0"),
        upper="attic", arcade_top=66, stone="d8c6a0", podium="e8e2d2", panel="8e2b23", trim="d8b04a",
        floor="d9b97c", banner="a8322a", crowd=0.96, scenery=None, pulvinar=True,
    ),
}
ORDER = ["capua", "pompeii", "verona", "leptis", "rome"]


def _scenery(a, kind, rng):
    if kind == "hills":
        for x in range(W):
            h1 = int(96 + 12 * math.sin(x / 80) + 5 * math.sin(x / 23 + 2))
            fill_rect(a, x, h1, x + 1, 140, hexc("6e8e5a"))
            h2 = int(112 + 8 * math.sin(x / 50 + 1))
            fill_rect(a, x, h2, x + 1, 140, hexc("5a7a48"))
        for cx in range(20, W, 70):
            for y in range(100, 118):
                w = int(3 * math.sin(math.pi * (y - 100) / 20) + 1)
                fill_rect(a, cx - w, y, cx + w, y + 1, hexc("2f5a34"))
    elif kind == "vesuvius":
        for x in range(W):
            d = abs(x - 430)
            peak = 34 + int(d * 0.42) if d > 22 else 44
            fill_rect(a, x, max(peak, 30), x + 1, 120, mix(hexc("6a6a7a"), hexc("8a8a8a"), min(1, d / 300)))
        for x in range(W):
            h = int(92 + 6 * math.sin(x / 40))
            fill_rect(a, x, h, x + 1, 120, hexc("6e8a5a"))
        for i in range(10):  # fumaça
            cx, cy, r = 430 + i * 3, 36 - i * 3, 4 + i // 2
            for y in range(cy - r, cy + r):
                for x in range(cx - r, cx + r):
                    if 0 <= y and (x - cx) ** 2 + (y - cy) ** 2 < r * r:
                        a[y, x, :3] = hexc("b0aaa4")
                        a[y, x, 3] = 255
    elif kind == "cypress":
        for cx in range(14, W, 46):
            top = rng.randint(22, 36)
            for y in range(top, 60):
                w = int(4 * math.sin(math.pi * (y - top) / (64 - top)) + 1)
                fill_rect(a, cx - w, y, cx + w, y + 1, hexc("2f5a34") if y % 3 else hexc("3e6e40"))
    elif kind == "palms":
        fill_rect(a, 0, 64, W, 74, hexc("3a7ab0"))  # mar ao longe
        fill_rect(a, 0, 64, W, 65, hexc("8ac0e0"))
        img = to_img(a)
        d = ImageDraw.Draw(img)
        for cx in range(30, W, 90):
            top = rng.randint(26, 40)
            d.line([(cx, 80), (cx + 4, top)], fill=hexc("6a4a2a"), width=3)
            for ang in range(-160, 30, 38):
                r = math.radians(ang)
                d.line([(cx + 4, top), (cx + 4 + 14 * math.cos(r), top + 10 + 8 * math.sin(r))], fill=hexc("3e7a3a"), width=2)
        a[:] = np.array(img).astype(np.int32)


def _velarium(a, c1, c2, partial):
    for x in range(0, W):
        if partial and 200 <= x < 440:
            continue
        col = hexc(c1) if (x // 16) % 2 == 0 else hexc(c2)
        h = 18 + int(3 * math.sin(x / 16 * math.pi) ** 2)
        for y in range(0, h):
            k = 1.0 - 0.15 * (y / h)
            a[y, x, :3] = [int(v * k) for v in col]
            a[y, x, 3] = 255
        a[h, x, :3] = darker(col, 0.5)
        a[h, x, 3] = 255


def _arcade(a, top, stone, stone_d, marble, marble_d):
    fill_rect(a, 0, top, W, 112, stone)
    arch_h = 112 - top - 10
    for x in range(0, W, 30):
        ax = x + 6
        spring = top + 8 + 9
        for y in range(top + 8, 108):
            for xx in range(ax, min(W, ax + 18)):
                inside = y >= spring or (xx - (ax + 9)) ** 2 + (y - spring) ** 2 <= 81
                if inside:
                    a[y, xx, :3] = mix(hexc("3b2a20"), hexc("5a4030"), (y - top) / max(1, arch_h))
        fill_rect(a, x + 1, top + 2, x + 5, 110, lighter(stone, 0.25))
        fill_rect(a, x + 4, top + 2, x + 5, 110, stone_d)
        fill_rect(a, x, top + 2, x + 6, top + 4, marble)
        fill_rect(a, x, 108, x + 6, 110, marble_d)
    fill_rect(a, 0, top, W, top + 2, stone_d)
    fill_rect(a, 0, 110, W, 113, darker(stone, 0.7))


def arena(theme_id, rng):
    t = THEMES[theme_id]
    a = np.zeros((H, W, 4), dtype=np.int32)  # alfa 0 = céu
    stone = hexc(t["stone"])
    stone_d = darker(stone, 0.78)
    podium = hexc(t["podium"])
    podium_d = darker(podium, 0.8)
    trim = hexc(t["trim"])
    if t["scenery"]:
        _scenery(a, t["scenery"], rng)

    # ---- estrutura superior
    if t["upper"] == "attic":
        fill_rect(a, 0, 40, W, 66, stone)
        fill_rect(a, 0, 40, W, 42, lighter(stone, 0.3))
        fill_rect(a, 0, 64, W, 66, stone_d)
        for x in range(8, W, 32):
            fill_rect(a, x, 42, x + 4, 64, lighter(stone, 0.15))
            fill_rect(a, x + 4, 42, x + 5, 64, stone_d)
            fill_rect(a, x + 14, 48, x + 20, 58, darker(stone, 0.45))
        for x in range(20, W, 64):
            fill_rect(a, x, 4, x + 2, 42, hexc("6a4a2a"))
        _arcade(a, 66, stone, stone_d, podium, podium_d)
    elif t["upper"] == "arcade":
        top = t["arcade_top"]
        fill_rect(a, 0, top - 6, W, top, lighter(stone, 0.2))
        for x in range(0, W, 12):
            fill_rect(a, x, top - 10, x + 6, top - 6, lighter(stone, 0.2))  # ameias
        for x in range(20, W, 64):
            fill_rect(a, x, 4, x + 2, top - 6, hexc("6a4a2a"))
        _arcade(a, top, stone, stone_d, podium, podium_d)
    elif t["upper"] == "parapet":
        fill_rect(a, 0, 104, W, 118, stone)
        fill_rect(a, 0, 104, W, 106, lighter(stone, 0.25))
        for x in range(0, W, 40):
            fill_rect(a, x + 2, 98, x + 8, 104, stone_d)
        for x in (30, 600):
            fill_rect(a, x, 4, x + 2, 104, hexc("6a4a2a"))
        for x in (180, 460):
            fill_rect(a, x, 4, x + 2, 104, hexc("6a4a2a"))
    elif t["upper"] == "fence":
        fill_rect(a, 0, 126, W, 136, hexc("5a3a20"))
        for x in range(0, W, 24):
            fill_rect(a, x, 112, x + 4, 136, hexc("6a4628"))
            fill_rect(a, x, 112, x + 4, 114, hexc("8a6038"))
        fill_rect(a, 0, 118, W, 120, hexc("7a5230"))

    if t["velarium"]:
        _velarium(a, t["velarium"][0], t["velarium"][1], t.get("velarium_partial", False))

    # ---- arquibancadas
    seat_top = t["seat_top"]
    wood = t["style"] == "wood"
    for y in range(seat_top, 200):
        if any(b <= y <= b + 2 for b in t["balteus"]):
            fill_rect(a, 0, y, W, y + 1, podium if y in t["balteus"] else podium_d)
            continue
        step = (y - seat_top) % 6
        base = hexc("8a5a32") if wood else stone
        col = base if step < 4 else darker(base, 0.72)
        fill_rect(a, 0, y, W, y + 1, col)
    if wood:
        for x in range(0, W, 40):
            fill_rect(a, x, seat_top, x + 3, 200, hexc("5a3a20"))
    else:
        for x in range(52, W, 96):
            for yb in range(seat_top + 7, 190, 30):
                fill_rect(a, x, yb, x + 10, yb + 14, hexc("3b2a20"))
                fill_rect(a, x, yb, x + 10, yb + 2, darker(stone, 0.5))

    yy, xx = np.mgrid[0:H, 0:W]
    shadow = np.zeros((H, W), dtype=bool)
    if t["velarium"]:
        shadow = (yy > 18) & (yy < 200) & (xx < 300 - (yy - 18) * 1.2) & (a[..., 3] > 0)
        if t.get("velarium_partial"):
            shadow &= xx < 200
        darken_region(a, shadow, 0.8)

    # ---- pódio
    if wood:
        fill_rect(a, 0, 196, W, 240, hexc("6a4628"))
        for x in range(0, W, 7):
            col = hexc("7a5230") if (x // 7) % 2 else hexc("6e4a2a")
            fill_rect(a, x, 194, x + 6, 240, col)
            fill_rect(a, x, 194, x + 6, 196, lighter(col, 0.25))
            fill_rect(a, x + 5, 196, x + 6, 240, darker(col, 0.7))
        fill_rect(a, 0, 210, W, 213, hexc("4a2e18"))
        fill_rect(a, 0, 228, W, 231, hexc("4a2e18"))
    else:
        fill_rect(a, 0, 200, W, 240, podium)
        fill_rect(a, 0, 200, W, 203, trim)
        fill_rect(a, 0, 203, W, 204, darker(trim, 0.6))
        fill_rect(a, 0, 236, W, 240, podium_d)
        panel = hexc(t["panel"])
        for x in range(6, W, 48):
            fill_rect(a, x, 208, x + 40, 232, trim)
            fill_rect(a, x + 1, 209, x + 39, 231, panel)
            fill_rect(a, x + 1, 209, x + 39, 210, lighter(panel, 0.2))
            for k in range(4, 36, 6):
                fill_rect(a, x + k, 219, x + k + 3, 220, darker(trim, 0.8))
                fill_rect(a, x + k + 2, 216, x + k + 3, 220, darker(trim, 0.8))
        for x in range(0, W, 3):
            fill_rect(a, x, 196, x + 1, 200, hexc("4a3a2a"))
        fill_rect(a, 0, 195, W, 196, hexc("4a3a2a"))
    # portões
    for gx in (36, 568):
        for y in range(206, 240):
            for x in range(gx, gx + 36):
                if y >= 218 or (x - (gx + 18)) ** 2 + (y - 218) ** 2 <= 18 * 18:
                    a[y, x, :3] = DARK
        for x in range(gx + 3, gx + 34, 5):
            fill_rect(a, x, 214, x + 2, 240, hexc("5a4a3a"))
        for y in range(220, 240, 6):
            fill_rect(a, gx + 2, y, gx + 34, y + 1, hexc("5a4a3a"))
        fill_rect(a, gx - 3, 204, gx, 240, podium_d if not wood else hexc("4a2e18"))
        fill_rect(a, gx + 36, 204, gx + 39, 240, podium_d if not wood else hexc("4a2e18"))
    # camarote imperial
    if t["pulvinar"]:
        px0, px1 = 280, 360
        fill_rect(a, px0, 160, px1, 204, podium)
        img = to_img(np.clip(a, 0, 255))
        d = ImageDraw.Draw(img)
        d.polygon([(px0 - 4, 162), (320, 146), (px1 + 4, 162)], fill=podium, outline=podium_d)
        d.polygon([(px0 + 8, 160), (320, 150), (px1 - 8, 160)], fill=hexc("8e2b23"))
        a = np.array(img).astype(np.int32)
        fill_rect(a, px0 - 4, 162, px1 + 4, 165, podium_d)
        for cx in range(px0 + 2, px1, 19):
            fill_rect(a, cx, 165, cx + 4, 204, lighter(podium, 0.4))
            fill_rect(a, cx + 3, 165, cx + 4, 204, podium_d)
        for i, x in enumerate(range(px0, px1)):
            drop = 6 + int(3 * abs(math.sin(i / 6.5)))
            for y in range(165, 165 + drop):
                a[y, x, :3] = PURPLE if (x // 3) % 2 else darker(PURPLE, 0.8)
            a[165 + drop, x, :3] = GOLD
        fill_rect(a, px0, 188, px1, 204, PURPLE)
        fill_rect(a, px0, 188, px1, 190, GOLD)
        for x in range(px0 + 4, px1 - 4, 8):
            fill_rect(a, x, 194, x + 4, 198, GOLD)
    # estandartes
    banner = hexc(t["banner"])
    img = to_img(np.clip(a, 0, 255))
    d = ImageDraw.Draw(img)
    for bx in (196, 432):
        d.rectangle([bx, 204, bx + 13, 229], fill=banner)
        d.rectangle([bx, 204, bx + 13, 205], fill=GOLD)
        d.polygon([(bx, 230), (bx + 7, 236), (bx + 14, 230)], fill=banner)
        d.ellipse([bx + 3, 212, bx + 11, 220], outline=GOLD)
        d.line([(bx + 13, 206), (bx + 13, 231)], fill=darker(banner, 0.6))
    a = np.array(img).astype(np.int32)

    # ---- areia
    floor = hexc(t["floor"])
    gradient(a, 240, H, floor, lighter(floor, 0.06))
    noise(a, 240, H, [darker(floor, 0.9), lighter(floor, 0.15), darker(floor, 0.95)], 0.16, rng)
    for _ in range(70):
        cx, cy = rng.randint(0, W), rng.randint(250, H)
        rx, ry = rng.randint(6, 22), rng.randint(2, 5)
        col = darker(floor, 0.94) if rng.random() < 0.6 else lighter(floor, 0.08)
        for y in range(cy - ry, cy + ry):
            for x in range(cx - rx, cx + rx):
                if 0 <= x < W and 240 <= y < H and ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 and rng.random() < 0.7:
                    a[y, x, :3] = col
    for _ in range(140):
        x, y = rng.randint(0, W - 2), rng.randint(244, H - 2)
        a[y, x, :3] = hexc("9c8a70")
        a[y, x + 1, :3] = hexc("c2b49a")
    for y in range(240, 256):
        k = 0.62 + 0.38 * (y - 240) / 16
        a[y, :, :3] = (a[y, :, :3] * k).astype(np.int32)
    for x in range(W):
        k = 1 - 0.18 * max(0, abs(x - W / 2) / (W / 2) - 0.55) / 0.45
        a[200:, x, :3] = (a[200:, x, :3] * k).astype(np.int32)
    a[240:, :, 3] = 255
    return to_img(np.clip(a, 0, 255)), shadow


def crowd(theme_id, rng, shadow, frames=5, density=None):
    """Público: quadros 0-2 = sentados/torcendo; 3-4 = de pé, braços para cima
    (ovação). `density` lota a arquibancada (dia de festival)."""
    t = dict(THEMES[theme_id])
    if density is not None:
        t["crowd"] = density
    people = []
    y = t["seat_top"] + 3
    vom = []
    if t["style"] != "wood":
        vom = [(x, yb) for x in range(52, W, 96) for yb in range(t["seat_top"] + 7, 190, 30)]
    while y < 197:
        if not any(b - 2 <= y <= b + 4 for b in t["balteus"]):
            x = rng.randint(0, 3)
            while x < W - 3:
                blocked = any(vx - 2 <= x <= vx + 11 and vy <= y <= vy + 14 for vx, vy in vom)
                if t["pulvinar"] and 276 <= x <= 364 and y > 150:
                    blocked = True
                if not blocked and rng.random() < t["crowd"]:
                    people.append((x, y, rng.choice(SKINS), rng.choice(HAIRS), rng.choice(TUNICS), rng.random()))
                x += rng.choice((4, 4, 5))
        y += 6
    if t["upper"] in ("attic", "arcade"):
        for x in range(0, W, 30):
            for k in range(3):
                if rng.random() < t["crowd"] - 0.1:
                    people.append((x + 8 + k * 5, 102, rng.choice(SKINS), rng.choice(HAIRS), rng.choice(TUNICS), rng.random()))
    sheet = new_img(W * frames, H)
    for f in range(frames):
        a = np.zeros((H, W, 4), dtype=np.int32)
        for (x, y, skin, hair, tunic, ph) in people:
            standing = f >= 3
            cheer = standing and ((f == 3) == (ph < 0.5) or ph > 0.85) or (f == 1 and ph < 0.35) or (f == 2 and 0.35 <= ph < 0.6)
            by = y - 4 + (-1 if cheer else 0) + (-1 if standing else 0)
            fill_rect(a, x, by + 2, x + 3, by + 5, tunic)
            fill_rect(a, x, by + 4, x + 3, by + 5, darker(tunic, 0.75))
            fill_rect(a, x, by, x + 2, by + 2, skin)
            fill_rect(a, x, by, x + 2, by + 1, hair)
            if cheer:
                lift = 2 if standing else 1
                fill_rect(a, x - 1, by - lift, x, by + 2, skin)
                fill_rect(a, x + 3, by - lift, x + 4, by + 2, skin)
            if standing and ph < 0.08:
                # alguns acenam com panos coloridos
                fill_rect(a, x + 3, by - 4, x + 6, by - 2, (230, 220, 200) if ph < 0.04 else (200, 60, 50))
        m = shadow & (a[..., 3] > 0)
        a[m, :3] = (a[m, :3] * 0.8).astype(np.int32)
        sheet.alpha_composite(to_img(np.clip(a, 0, 255)), (f * W, 0))
    return sheet
