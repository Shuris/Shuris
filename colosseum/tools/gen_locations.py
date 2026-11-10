"""Locais da cidade (alojamento, mercado, templo, fórum, termas) e o mapa.

Locais ao ar livre têm o céu transparente (desenhado pelo jogo, conforme a hora).
Todos usam o chão a partir de y=240 para o gladiador ficar em y≈312.
"""
import math
import numpy as np
from PIL import ImageDraw
from pixel import darker, lighter, mix, hexc
from gen_scenes import W, H, fill_rect, gradient, noise, to_img

MARBLE = hexc("e8e2d2")
MARBLE_D = hexc("b9b1a0")
TERRA = hexc("b0563a")
TERRA_D = hexc("8a3e2a")
PLASTER = hexc("e6d6b4")
POMP = hexc("a8423a")
GOLD = hexc("d8b04a")
WOOD = hexc("7a5230")
WOOD_D = hexc("5a3a20")
STONE = hexc("a89c88")


def _arr():
    return np.zeros((H, W, 4), dtype=np.int32)


def _paving(a, rng, y0=240, base=hexc("b8ad98")):
    gradient(a, y0, H, base, lighter(base, 0.08))
    for y in range(y0, H, 8):
        off = 0 if (y // 8) % 2 else 8
        fill_rect(a, 0, y, W, y + 1, darker(base, 0.82))
        for x in range(off, W, 16):
            fill_rect(a, x, y, x + 1, y + 8, darker(base, 0.85))
    noise(a, y0, H, [darker(base, 0.92), lighter(base, 0.1)], 0.08, rng)
    for y in range(y0, y0 + 10):
        k = 0.7 + 0.3 * (y - y0) / 10
        a[y, :, :3] = (a[y, :, :3] * k).astype(np.int32)


def _insula(a, x0, x1, top, base_y=240, wall=PLASTER, shop=False):
    fill_rect(a, x0, top, x1, base_y, wall)
    fill_rect(a, x0 - 3, top - 6, x1 + 3, top, TERRA)
    for x in range(x0 - 3, x1 + 3, 4):
        fill_rect(a, x, top - 6, x + 2, top - 5, TERRA_D)
    fill_rect(a, x0, top, x1, top + 2, darker(wall, 0.8))
    for y in range(top + 10, base_y - 40, 26):
        for x in range(x0 + 8, x1 - 10, 22):
            fill_rect(a, x, y, x + 9, y + 12, hexc("3b2a20"))
            fill_rect(a, x, y + 12, x + 9, y + 13, darker(wall, 0.7))
    if shop:
        fill_rect(a, x0 + 6, base_y - 34, x1 - 6, base_y, hexc("3b2a20"))
    fill_rect(a, x1 - 2, top, x1, base_y, darker(wall, 0.75))


def _column(a, x, top, bottom, w=8):
    fill_rect(a, x, top, x + w, bottom, lighter(MARBLE, 0.3))
    fill_rect(a, x + w - 2, top, x + w, bottom, MARBLE_D)
    for k in range(2, w - 2, 3):
        fill_rect(a, x + k, top + 4, x + k + 1, bottom - 4, MARBLE)
    fill_rect(a, x - 2, top, x + w + 2, top + 4, MARBLE)
    fill_rect(a, x - 2, bottom - 4, x + w + 2, bottom, MARBLE_D)


# ------------------------------------------------------------------ alojamento (interior)
def home(rng):
    a = _arr()
    # parede de pedra
    fill_rect(a, 0, 0, W, 240, hexc("7a6e60"))
    for y in range(0, 240, 10):
        off = 0 if (y // 10) % 2 else 12
        fill_rect(a, 0, y, W, y + 1, hexc("5a5046"))
        for x in range(off, W, 24):
            fill_rect(a, x, y, x + 1, y + 10, hexc("5a5046"))
    noise(a, 0, 240, [hexc("847868"), hexc("6e6456")], 0.1, rng)
    # janela (céu visível através dela)
    for (wx, wy) in ((140, 70), (460, 70)):
        fill_rect(a, wx - 4, wy - 4, wx + 48, wy + 44, hexc("4a4038"))
        a[wy:wy + 40, wx:wx + 44, 3] = 0
        fill_rect(a, wx + 21, wy, wx + 23, wy + 40, WOOD_D)
        fill_rect(a, wx, wy + 19, wx + 44, wy + 21, WOOD_D)
    # piso de madeira
    for y in range(240, H):
        col = WOOD if ((y - 240) // 6) % 2 else darker(WOOD, 0.88)
        fill_rect(a, 0, y, W, y + 1, col)
    for y in range(240, H, 6):
        for x in range(((y // 6) % 3) * 40, W, 120):
            fill_rect(a, x, y, x + 1, y + 6, WOOD_D)
    fill_rect(a, 0, 236, W, 242, hexc("4a3a2a"))
    img = to_img(np.clip(a, 0, 255))
    d = ImageDraw.Draw(img)
    # cama de palha
    d.rectangle([380, 278, 520, 300], fill=hexc("6a4628"))
    d.rectangle([384, 268, 516, 282], fill=hexc("d8c48a"))
    d.rectangle([450, 266, 516, 282], fill=hexc("8e2b23"))
    d.rectangle([386, 262, 410, 272], fill=hexc("efe6d2"))
    for x in (382, 512):
        d.rectangle([x, 298, x + 6, 312], fill=WOOD_D)
    # mesa com lamparina, baú, ânfora
    d.rectangle([250, 270, 300, 276], fill=WOOD)
    d.rectangle([254, 276, 258, 304], fill=WOOD_D)
    d.rectangle([292, 276, 296, 304], fill=WOOD_D)
    d.ellipse([268, 262, 284, 270], fill=hexc("c08a3e"))
    d.rectangle([560, 278, 610, 306], fill=hexc("6a4628"))
    d.rectangle([560, 278, 610, 284], fill=hexc("8a6038"))
    d.rectangle([583, 286, 587, 292], fill=GOLD)
    d.ellipse([60, 262, 84, 300], fill=hexc("b0603a"))
    d.rectangle([66, 254, 78, 264], fill=hexc("b0603a"))
    # gládio e escudo pendurados
    d.line([(330, 120), (330, 160)], fill=hexc("c4c8d0"), width=3)
    d.rectangle([324, 160, 336, 163], fill=GOLD)
    d.rectangle([350, 110, 380, 160], fill=GOLD)
    d.rectangle([353, 113, 377, 157], fill=hexc("a62c24"))
    d.ellipse([360, 130, 370, 140], fill=hexc("c4c8d0"))
    return img


# ------------------------------------------------------------------ mercado
def market(rng):
    a = _arr()
    _insula(a, 0, 150, 110, shop=True)
    _insula(a, 160, 330, 90, wall=hexc("e0c8a0"), shop=True)
    _insula(a, 340, 480, 120, shop=True)
    _insula(a, 490, 640, 100, wall=hexc("dcc0a8"), shop=True)
    _paving(a, rng, base=hexc("b8a888"))
    img = to_img(np.clip(a, 0, 255))
    d = ImageDraw.Draw(img)
    stalls = [(30, hexc("b8372e")), (190, hexc("3d5c8c")), (360, hexc("d8a64a")), (510, hexc("5a8a4a"))]
    for sx, col in stalls:
        # toldo listrado
        for k in range(0, 110, 10):
            d.rectangle([sx + k, 200, sx + k + 9, 214], fill=col if (k // 10) % 2 == 0 else hexc("efe6d2"))
        for k in range(0, 110, 10):
            d.pieslice([sx + k, 208, sx + k + 10, 220], 0, 180, fill=col if (k // 10) % 2 == 0 else hexc("efe6d2"))
        d.rectangle([sx, 214, sx + 3, 262], fill=WOOD_D)
        d.rectangle([sx + 106, 214, sx + 109, 262], fill=WOOD_D)
        d.rectangle([sx - 2, 244, sx + 111, 252], fill=WOOD)
    # mercadorias
    for x in range(38, 130, 16):  # frutas
        d.ellipse([x, 236, x + 10, 246], fill=hexc("c84a2a") if x % 32 else hexc("e0b040"))
    for x in (200, 222, 244, 266):  # armas e escudos (armeiro)
        d.line([(x, 220), (x, 244)], fill=hexc("c4c8d0"), width=2)
    d.rectangle([280, 222, 294, 244], fill=GOLD)
    d.rectangle([282, 224, 292, 242], fill=hexc("a62c24"))
    for x in range(370, 460, 18):  # ânforas
        d.ellipse([x, 228, x + 12, 246], fill=hexc("b0603a"))
    for x in range(520, 610, 22):  # tecidos
        d.rectangle([x, 222, x + 16, 244], fill=[hexc("7a4a8a"), hexc("3d5c8c"), hexc("efe6d2"), hexc("b8372e")][(x // 22) % 4])
    return img


# ------------------------------------------------------------------ templo
def temple(rng):
    a = _arr()
    _paving(a, rng, base=hexc("c8beaa"))
    img = to_img(np.clip(a, 0, 255))
    d = ImageDraw.Draw(img)
    cx = 320
    # escadaria / pódio
    for i, y in enumerate(range(204, 240, 6)):
        d.rectangle([cx - 150 - i * 6, y, cx + 150 + i * 6, y + 6], fill=MARBLE if i % 2 == 0 else MARBLE_D)
    # cela
    d.rectangle([cx - 130, 112, cx + 130, 204], fill=hexc("d8d0bc"))
    d.rectangle([cx - 22, 140, cx + 22, 204], fill=hexc("3b2a20"))
    # frontão
    d.polygon([(cx - 150, 112), (cx, 58), (cx + 150, 112)], fill=MARBLE, outline=MARBLE_D)
    d.polygon([(cx - 126, 106), (cx, 66), (cx + 126, 106)], fill=hexc("c8beaa"))
    d.ellipse([cx - 10, 84, cx + 10, 104], fill=GOLD)  # escudo de Marte no frontão
    d.rectangle([cx - 150, 108, cx + 150, 116], fill=MARBLE_D)
    a = np.array(img).astype(np.int32)
    for x in range(cx - 140, cx + 141, 46):
        _column(a, x - 5, 116, 204, 10)
    img = to_img(np.clip(a, 0, 255))
    d = ImageDraw.Draw(img)
    # altar
    d.rectangle([cx - 20, 262, cx + 20, 290], fill=MARBLE)
    d.rectangle([cx - 24, 258, cx + 24, 264], fill=MARBLE_D)
    # estátuas
    for sx in (90, 550):
        d.rectangle([sx - 14, 230, sx + 14, 300], fill=MARBLE_D)
        d.rectangle([sx - 10, 196, sx + 10, 230], fill=hexc("b0a890"))
        d.ellipse([sx - 6, 184, sx + 6, 198], fill=hexc("b0a890"))
        d.line([(sx + 10, 170), (sx + 10, 230)], fill=hexc("8a8270"), width=2)
    return img


# ------------------------------------------------------------------ fórum
def forum(rng):
    a = _arr()
    # colunata ao fundo
    fill_rect(a, 0, 100, W, 110, MARBLE)
    fill_rect(a, 0, 108, W, 110, MARBLE_D)
    fill_rect(a, 0, 110, W, 240, hexc("cfc4ae"))
    for x in range(10, W, 40):
        _column(a, x, 110, 240, 9)
    _paving(a, rng, base=hexc("c0b49c"))
    img = to_img(np.clip(a, 0, 255))
    d = ImageDraw.Draw(img)
    # rostra (tribuna) com proas de navio
    d.rectangle([60, 210, 220, 262], fill=MARBLE)
    d.rectangle([60, 206, 220, 212], fill=MARBLE_D)
    for x in (80, 130, 180):
        d.polygon([(x, 226), (x + 22, 232), (x, 240)], fill=hexc("6a5a40"))
    # quadro de avisos com a Acta Diurna
    d.rectangle([400, 170, 540, 262], fill=WOOD)
    d.rectangle([406, 176, 534, 250], fill=hexc("5a3a20"))
    for i, (px, py) in enumerate(((412, 182), (452, 186), (494, 180), (420, 216), (466, 214), (504, 218))):
        d.rectangle([px, py, px + 30, py + 26], fill=hexc("efe0b8") if i != 1 else hexc("f8f0d8"))
        for ly in range(py + 5, py + 24, 4):
            d.line([(px + 4, ly), (px + 26, ly)], fill=hexc("8a7a5a"))
    d.rectangle([404, 262, 412, 300], fill=WOOD_D)
    d.rectangle([528, 262, 536, 300], fill=WOOD_D)
    d.rectangle([396, 160, 544, 170], fill=TERRA)
    # estátua equestre
    d.rectangle([570, 220, 620, 300], fill=MARBLE_D)
    d.ellipse([574, 186, 616, 214], fill=hexc("6a7a6a"))
    d.rectangle([588, 160, 600, 192], fill=hexc("6a7a6a"))
    return img


# ------------------------------------------------------------------ termas
def baths(rng):
    a = _arr()
    fill_rect(a, 0, 90, W, 240, hexc("d8c8a8"))
    for x in range(0, W, 80):  # arcos
        for y in range(120, 240):
            for xx in range(x + 16, x + 64):
                if y >= 150 or (xx - (x + 40)) ** 2 + (y - 150) ** 2 <= 24 * 24:
                    a[y, xx, :3] = mix(hexc("6a5a4a"), hexc("8a7a62"), (y - 120) / 120)
    fill_rect(a, 0, 90, W, 98, TERRA)
    fill_rect(a, 0, 98, W, 100, TERRA_D)
    # piso de mosaico
    for y in range(240, H):
        for x in range(W):
            c = hexc("e8dcc0") if ((x // 6) + (y // 6)) % 2 else hexc("d0c0a0")
            a[y, x, :3] = c
            a[y, x, 3] = 255
    img = to_img(np.clip(a, 0, 255))
    d = ImageDraw.Draw(img)
    # piscina
    d.rectangle([120, 262, 560, 330], fill=hexc("8a7a62"))
    d.rectangle([126, 268, 554, 324], fill=hexc("3a7ab0"))
    for y in range(274, 322, 8):
        for x in range(134, 548, 24):
            d.line([(x, y), (x + 10, y)], fill=hexc("7ab4e0"))
    d.rectangle([126, 268, 554, 271], fill=hexc("2a5a8a"))
    # vapor
    for (x, y) in ((200, 250), (330, 246), (460, 252)):
        d.ellipse([x, y, x + 30, y + 10], fill=hexc("f4f4f0"))
    return img


# ------------------------------------------------------------------ mapa da cidade
MAP_POS = {
    "home": (86, 138), "baths": (232, 86), "forum": (340, 168), "temple": (500, 78),
    "ludus": (140, 270), "market": (326, 286), "arena": (530, 250),
}


def city_map(rng):
    a = _arr()
    gradient(a, 0, H, hexc("6e9a52"), hexc("648e4a"))
    noise(a, 0, H, [hexc("5e8a46"), hexc("7aa65c")], 0.12, rng)
    img = to_img(np.clip(a, 0, 255))
    d = ImageDraw.Draw(img)
    # rio
    pts = [(0, 200), (80, 196), (160, 214), (240, 206), (300, 222), (390, 214), (460, 226), (640, 214)]
    d.line(pts, fill=hexc("3a7ab0"), width=16)
    d.line(pts, fill=hexc("5a9ad0"), width=8)
    # estradas
    road = hexc("d8c08a")
    hub = MAP_POS["forum"]
    for k, p in MAP_POS.items():
        if k != "forum":
            d.line([p, (hub[0], p[1]), hub], fill=road, width=7)
    d.line([MAP_POS["ludus"], MAP_POS["market"]], fill=road, width=7)
    d.line([MAP_POS["market"], MAP_POS["arena"]], fill=road, width=7)
    # ponte
    d.rectangle([330, 204, 352, 232], fill=hexc("8a7a62"))
    d.rectangle([330, 204, 352, 207], fill=hexc("6a5a4a"))
    d.rectangle([330, 229, 352, 232], fill=hexc("6a5a4a"))
    # árvores
    for _ in range(70):
        x, y = rng.randint(0, W), rng.randint(0, H)
        if any(abs(x - px) < 50 and abs(y - py) < 40 for px, py in MAP_POS.values()) or 190 < y < 236:
            continue
        d.ellipse([x - 6, y - 2, x + 6, y + 4], fill=hexc("3e5a2c"))
        d.ellipse([x - 6, y - 10, x + 6, y + 2], fill=hexc("2f6a34"))
        d.ellipse([x - 3, y - 9, x + 1, y - 5], fill=hexc("4a8a44"))

    def house(cx, cy, w, h, roof=TERRA, wall=PLASTER):
        d.rectangle([cx - w // 2, cy - h // 2 + 6, cx + w // 2, cy + h // 2], fill=wall)
        d.polygon([(cx - w // 2 - 4, cy - h // 2 + 8), (cx - w // 2 + 4, cy - h // 2 - 6), (cx + w // 2 - 4, cy - h // 2 - 6), (cx + w // 2 + 4, cy - h // 2 + 8)], fill=roof)
        d.rectangle([cx - 4, cy + h // 2 - 10, cx + 4, cy + h // 2], fill=hexc("3b2a20"))
        d.rectangle([cx - w // 2, cy + h // 2, cx + w // 2 + 3, cy + h // 2 + 3], fill=hexc("4a6a3a"))

    hx, hy = MAP_POS["home"]
    house(hx, hy, 40, 28)
    house(hx - 30, hy + 10, 22, 20)
    bx, by = MAP_POS["baths"]
    house(bx, by, 64, 30, roof=hexc("8a8a9a"), wall=hexc("d8c8a8"))
    d.ellipse([bx - 12, by - 26, bx + 12, by - 10], fill=hexc("8a8a9a"))
    fx, fy = MAP_POS["forum"]
    d.rectangle([fx - 40, fy - 22, fx + 40, fy + 18], fill=hexc("d8ccb4"))
    for x in range(fx - 36, fx + 40, 10):
        d.rectangle([x, fy - 20, x + 3, fy - 4], fill=MARBLE)
    d.rectangle([fx - 10, fy - 2, fx + 10, fy + 10], fill=hexc("b0a890"))
    tx, ty = MAP_POS["temple"]
    d.rectangle([tx - 34, ty - 4, tx + 34, ty + 20], fill=MARBLE_D)
    for x in range(tx - 30, tx + 32, 10):
        d.rectangle([x, ty - 14, x + 4, ty + 10], fill=lighter(MARBLE, 0.3))
    d.polygon([(tx - 38, ty - 14), (tx, ty - 32), (tx + 38, ty - 14)], fill=MARBLE)
    lx, ly = MAP_POS["ludus"]
    d.rectangle([lx - 44, ly - 26, lx + 44, ly + 22], fill=TERRA)
    d.rectangle([lx - 36, ly - 18, lx + 36, ly + 14], fill=hexc("d9b97c"))
    d.rectangle([lx - 4, ly + 14, lx + 4, ly + 22], fill=hexc("3b2a20"))
    mx, my = MAP_POS["market"]
    for i, col in enumerate((hexc("b8372e"), hexc("3d5c8c"), hexc("d8a64a"), hexc("5a8a4a"))):
        x = mx - 44 + i * 23
        d.rectangle([x, my - 10, x + 18, my + 8], fill=WOOD)
        d.polygon([(x - 2, my - 8), (x + 9, my - 18), (x + 20, my - 8)], fill=col)
    ax, ay = MAP_POS["arena"]
    d.ellipse([ax - 60, ay - 40, ax + 60, ay + 40], fill=hexc("a8916a"))
    d.ellipse([ax - 56, ay - 36, ax + 56, ay + 36], fill=hexc("d8c6a0"))
    for k in range(36):
        ang = k / 36 * math.tau
        x, y = ax + 52 * math.cos(ang), ay + 33 * math.sin(ang)
        d.rectangle([x - 1, y - 1, x + 1, y + 1], fill=hexc("6a5a4a"))
    d.ellipse([ax - 36, ay - 20, ax + 36, ay + 20], fill=hexc("a8916a"))
    d.ellipse([ax - 32, ay - 17, ax + 32, ay + 17], fill=hexc("e0c890"))
    return img
