"""Mapa da cidade de Cápua (640x360) em pixel art: cidade murada com torres e
portões, rio com ponte e barcos, ruas de pedra (cardo e decumano), quarteirões
de casas, campos e vinhedos fora dos muros, o anfiteatro do lado de fora,
rosa dos ventos e moldura. As posições dos locais ficam em MAP_POS (as mesmas
de src/renderer/core/data/locations.ts)."""
import math
import random
import numpy as np
from PIL import Image, ImageDraw
from pixel import new_img, finish, darker, lighter, hexc, mix

W, H = 640, 360

MAP_POS = {
    "home": (100, 112), "baths": (212, 70), "temple": (414, 72), "forum": (300, 150),
    "tavern": (404, 172), "ludus": (122, 276), "market": (300, 280), "arena": (562, 262),
}

GRASS = hexc("6e9a52")
GRASS_D = hexc("5c8644")
GRASS_L = hexc("82ac62")
WATER = hexc("3e7cb4")
WATER_L = hexc("6aa4d8")
WATER_D = hexc("2c5c8c")
ROAD = hexc("cdb586")
ROAD_D = hexc("a8915e")
STONE = hexc("b8ac94")
STONE_D = hexc("8a7e68")
TERRA = hexc("b0563a")
TERRA_D = hexc("86402a")
PLASTER = hexc("e6d8b8")
MARBLE = hexc("f0ece0")
MARBLE_D = hexc("c8c2b2")
WOOD = hexc("7a5230")
DOOR = hexc("3b2a20")
SAND = hexc("e0c890")

WALL = (32, 30, 482, 334)  # muralha da cidade
DECUMANUS = 132           # rua leste-oeste
CARDO = 300               # rua norte-sul
SOUTH_ST = 252            # rua do sul (ludus, mercado, portão do anfiteatro)
SIDE_ST = 196             # rua que cruza a ponte oeste


def _river_y(x):
    return 214 + 6 * math.sin(x / 70) + 3 * math.sin(x / 23)


def _terrain(rng):
    a = np.zeros((H, W, 4), dtype=np.int32)
    a[..., 3] = 255
    yy, xx = np.mgrid[0:H, 0:W]
    base = np.array(GRASS)
    a[..., :3] = base
    # manchas de relva clara e escura
    n = rng.random((H // 4 + 1, W // 4 + 1))
    n = np.kron(n, np.ones((4, 4)))[:H, :W]
    a[n > 0.82, :3] = GRASS_L
    a[n < 0.16, :3] = GRASS_D
    # colina do templo (sombreada)
    hill = ((xx - 420) / 92) ** 2 + ((yy - 84) / 54) ** 2 < 1
    a[hill, :3] = (a[hill, :3] * 0.92 + np.array(hexc("8aa064")) * 0.08).astype(np.int32)
    return a


FIELDS = [(492, 20, 584, 110), (500, 300, 630, 352), (492, 118, 540, 180), (586, 20, 634, 84)]


def _fields(d, rng):
    """Campos e vinhedos fora da muralha."""
    plots = [(492, 20, 584, 110, "wheat"), (500, 300, 630, 352, "vine"), (492, 118, 540, 180, "vine")]
    for x0, y0, x1, y1, kind in plots:
        if kind == "wheat":
            d.rectangle([x0, y0, x1, y1], fill=hexc("c8b060"))
            for y in range(y0 + 2, y1, 4):
                d.line([(x0 + 1, y), (x1 - 1, y)], fill=hexc("a89048"))
        else:
            d.rectangle([x0, y0, x1, y1], fill=hexc("7a8a4a"))
            for x in range(x0 + 3, x1, 6):
                for y in range(y0 + 3, y1, 5):
                    d.rectangle([x, y, x + 2, y + 2], fill=hexc("4a6a2c"))
        d.rectangle([x0, y0, x1, y1], outline=hexc("8a7a4a"))


def _river(d):
    pts = [(x, _river_y(x)) for x in range(-4, W + 6, 4)]
    d.line(pts, fill=hexc("5a7a4a"), width=26)  # margens
    d.line(pts, fill=WATER_D, width=20)
    d.line(pts, fill=WATER, width=16)
    for x in range(0, W, 14):
        y = _river_y(x)
        d.line([(x, y - 3 + (x // 14) % 3), (x + 5, y - 3 + (x // 14) % 3)], fill=WATER_L)


def _road(d, pts, width=7):
    d.line(pts, fill=ROAD_D, width=width + 2, joint="curve")
    d.line(pts, fill=ROAD, width=width, joint="curve")


def _cobbles(img, rng):
    """Textura de pedras nas ruas."""
    a = np.array(img)
    road = np.all(a[..., :3] == ROAD, axis=-1)
    ys, xs = np.nonzero(road)
    pick = rng.random(len(ys)) < 0.14
    a[ys[pick], xs[pick], :3] = ROAD_D
    return Image.fromarray(a)


def _wall(d):
    x0, y0, x1, y1 = WALL
    gates = {("top", CARDO), ("bottom", CARDO), ("left", DECUMANUS), ("right", DECUMANUS), ("right", SOUTH_ST), ("left", SOUTH_ST)}
    c, cd = hexc("a89a80"), hexc("7a6e58")

    def seg(a, b):
        d.line([a, b], fill=cd, width=7)
        d.line([a, b], fill=c, width=5)

    def gap(side, v):
        return any(s == side and abs(g - v) < 9 for s, g in gates)

    for x in range(x0, x1, 4):
        if not gap("top", x):
            seg((x, y0), (x + 4, y0))
        if not gap("bottom", x):
            seg((x, y1), (x + 4, y1))
    for y in range(y0, y1, 4):
        if not gap("left", y) and abs(y - _river_y(x0)) > 9:
            seg((x0, y), (x0, y + 4))
        if not gap("right", y) and abs(y - _river_y(x1)) > 9:
            seg((x1, y), (x1, y + 4))
    # ameias
    for x in range(x0, x1, 4):
        if not gap("top", x):
            d.point((x, y0 - 3), fill=cd)
        if not gap("bottom", x):
            d.point((x, y1 - 3), fill=cd)
    # torres nos cantos e entre elas
    towers = [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]
    towers += [(x, y0) for x in range(x0 + 75, x1 - 20, 75) if not gap("top", x)]
    towers += [(x, y1) for x in range(x0 + 75, x1 - 20, 75) if not gap("bottom", x)]
    towers += [(x0, y) for y in (80, 300) if not gap("left", y)] + [(x1, y) for y in (80, 300) if not gap("right", y)]
    for tx, ty in towers:
        d.rectangle([tx - 6, ty - 8, tx + 6, ty + 5], fill=cd)
        d.rectangle([tx - 5, ty - 7, tx + 5, ty + 4], fill=c)
        for k in (-4, 0, 4):
            d.rectangle([tx + k - 1, ty - 10, tx + k, ty - 8], fill=c)
        d.rectangle([tx - 1, ty - 4, tx, ty - 2], fill=hexc("3a3028"))
    # portões (duas torres e o arco)
    for side, v in gates:
        if side in ("top", "bottom"):
            y = y0 if side == "top" else y1
            for tx in (v - 11, v + 11):
                d.rectangle([tx - 4, y - 9, tx + 4, y + 5], fill=cd)
                d.rectangle([tx - 3, y - 8, tx + 3, y + 4], fill=c)
        else:
            x = x0 if side == "left" else x1
            for ty in (v - 11, v + 11):
                d.rectangle([x - 5, ty - 6, x + 5, ty + 4], fill=cd)
                d.rectangle([x - 4, ty - 5, x + 4, ty + 3], fill=c)


def _bridge(d, x, w=22):
    y = _river_y(x)
    d.rectangle([x - w // 2, y - 15, x + w // 2, y + 15], fill=STONE_D)
    d.rectangle([x - w // 2 + 1, y - 14, x + w // 2 - 1, y + 14], fill=STONE)
    for yy in range(int(y - 12), int(y + 13), 4):
        d.line([(x - w // 2 + 2, yy), (x + w // 2 - 2, yy)], fill=hexc("a49880"))
    d.rectangle([x - w // 2, y - 15, x - w // 2 + 1, y + 15], fill=STONE_D)
    d.rectangle([x + w // 2 - 1, y - 15, x + w // 2, y + 15], fill=STONE_D)


def _boat(d, x, y, flip=False):
    s = -1 if flip else 1
    d.polygon([(x - 9, y), (x + 9, y), (x + 6 * s if not flip else x - 6, y + 4), (x - 6, y + 4)], fill=hexc("6a4428"))
    d.line([(x, y - 9), (x, y)], fill=hexc("4a3020"))
    d.polygon([(x + 1, y - 9), (x + 7, y - 4), (x + 1, y - 2)], fill=hexc("e8dcc0"))


def _tree(d, x, y, kind="round"):
    if kind == "cypress":
        d.ellipse([x - 2, y - 12, x + 2, y + 1], fill=hexc("2a5a30"))
        d.line([(x - 1, y - 9), (x - 1, y - 3)], fill=hexc("3e7a40"))
        d.point((x, y + 2), fill=hexc("3e5a2c"))
        return
    d.ellipse([x - 5, y - 1, x + 5, y + 3], fill=hexc("3e5a2c"))
    d.ellipse([x - 5, y - 9, x + 5, y + 1], fill=hexc("2f6a34"))
    d.ellipse([x - 3, y - 8, x + 1, y - 4], fill=hexc("4a8a44"))


def _house(d, x, y, w, h, roof=TERRA):
    """Casa vista de cima em 3/4: telhado e a parede da frente."""
    d.rectangle([x, y + h - 4, x + w, y + h], fill=PLASTER)
    d.rectangle([x, y, x + w, y + h - 4], fill=roof)
    d.line([(x + 1, y + (h - 4) // 2), (x + w - 1, y + (h - 4) // 2)], fill=darker(roof, 0.8))
    if w >= 10:
        d.point((x + w // 2, y + h - 2), fill=DOOR)


# ------------------------------------------------------------------ prédios dos locais
def _forum(d, cx, cy):
    # praça calçada com colunata e a basílica ao fundo
    d.rectangle([cx - 46, cy - 26, cx + 46, cy + 22], fill=hexc("d8ccb0"))
    for x in range(cx - 44, cx + 46, 6):
        d.line([(x, cy - 25), (x, cy + 21)], fill=hexc("cabe9e"))
    d.rectangle([cx - 46, cy - 36, cx + 46, cy - 24], fill=TERRA)
    d.rectangle([cx - 46, cy - 26, cx + 46, cy - 22], fill=MARBLE_D)
    for x in range(cx - 42, cx + 46, 7):
        d.rectangle([x, cy - 22, x + 2, cy - 14], fill=MARBLE)
        d.rectangle([x, cy + 14, x + 2, cy + 22], fill=MARBLE)
    d.rectangle([cx - 46, cy + 22, cx + 46, cy + 25], fill=MARBLE_D)
    # estátua no meio
    d.rectangle([cx - 4, cy - 2, cx + 4, cy + 6], fill=MARBLE_D)
    d.rectangle([cx - 1, cy - 9, cx + 1, cy - 2], fill=hexc("6a7a6a"))
    d.ellipse([cx - 2, cy - 12, cx + 2, cy - 8], fill=hexc("6a7a6a"))


def _temple(d, cx, cy):
    d.rectangle([cx - 36, cy + 6, cx + 36, cy + 24], fill=MARBLE_D)  # pódio
    for k in range(4):  # escadaria
        d.rectangle([cx - 16 + k * 2, cy + 24 + k * 2, cx + 16 - k * 2, cy + 26 + k * 2], fill=lighter(MARBLE_D, 0.2 * k))
    d.rectangle([cx - 32, cy - 10, cx + 32, cy + 6], fill=MARBLE)
    for x in range(cx - 30, cx + 32, 8):
        d.rectangle([x, cy - 10, x + 3, cy + 6], fill=lighter(MARBLE, 0.4))
        d.line([(x + 3, cy - 10), (x + 3, cy + 6)], fill=MARBLE_D)
    d.polygon([(cx - 36, cy - 10), (cx, cy - 28), (cx + 36, cy - 10)], fill=TERRA)
    d.polygon([(cx - 28, cy - 12), (cx, cy - 24), (cx + 28, cy - 12)], fill=MARBLE)
    d.ellipse([cx - 3, cy - 20, cx + 3, cy - 15], fill=hexc("d8b04a"))


def _baths(d, cx, cy):
    d.rectangle([cx - 40, cy - 14, cx + 40, cy + 20], fill=hexc("d8c8a8"))
    d.rectangle([cx - 40, cy - 22, cx + 40, cy - 12], fill=hexc("8a8a9a"))
    for x in (cx - 22, cx, cx + 22):
        d.ellipse([x - 9, cy - 34, x + 9, cy - 16], fill=hexc("9a9aaa"))
        d.ellipse([x - 3, cy - 32, x + 1, cy - 28], fill=hexc("c0c0cc"))
    d.rectangle([cx - 30, cy + 4, cx + 30, cy + 16], fill=WATER_D)
    d.rectangle([cx - 28, cy + 6, cx + 28, cy + 14], fill=WATER)
    for x in range(cx - 24, cx + 26, 10):
        d.line([(x, cy + 9), (x + 4, cy + 9)], fill=WATER_L)
    for x in range(cx - 38, cx + 40, 9):
        d.rectangle([x, cy - 12, x + 2, cy + 2], fill=MARBLE)
    # vapor
    for (x, y) in ((cx - 18, cy - 42), (cx + 6, cy - 46), (cx + 26, cy - 40)):
        d.ellipse([x, y, x + 8, y + 4], fill=hexc("f4f4f0"))


def _home(d, cx, cy):
    # alojamento dos gladiadores: duas alas com pátio
    _house(d, cx - 34, cy - 20, 30, 26)
    _house(d, cx + 4, cy - 20, 30, 26, roof=TERRA_D)
    d.rectangle([cx - 30, cy + 6, cx + 30, cy + 20], fill=hexc("d0bc90"))
    d.rectangle([cx - 30, cy + 6, cx + 30, cy + 8], fill=PLASTER)
    for x in range(cx - 26, cx + 30, 10):
        d.rectangle([x, cy + 9, x + 4, cy + 15], fill=DOOR)
    d.rectangle([cx - 4, cy + 14, cx + 4, cy + 20], fill=WOOD)


def _tavern(d, cx, cy):
    d.rectangle([cx - 24, cy - 6, cx + 24, cy + 14], fill=hexc("d8c4a0"))
    d.rectangle([cx - 26, cy - 20, cx + 26, cy - 4], fill=hexc("8a3e2a"))
    d.line([(cx - 25, cy - 12), (cx + 25, cy - 12)], fill=darker(hexc("8a3e2a"), 0.8))
    d.rectangle([cx - 4, cy + 2, cx + 4, cy + 14], fill=DOOR)
    d.rectangle([cx - 18, cy + 1, cx - 10, cy + 7], fill=hexc("3a2a20"))
    d.rectangle([cx + 10, cy + 1, cx + 18, cy + 7], fill=hexc("3a2a20"))
    # toldo, placa do javali e barris
    for i, x in enumerate(range(cx - 22, cx + 22, 6)):
        d.rectangle([x, cy - 5, x + 5, cy - 2], fill=hexc("c8483a") if i % 2 else hexc("e8dcc0"))
    d.rectangle([cx + 26, cy - 4, cx + 34, cy + 4], fill=WOOD)
    d.ellipse([cx + 27, cy - 2, cx + 33, cy + 2], fill=hexc("3a2418"))
    for bx in (cx - 34, cx - 28):
        d.ellipse([bx, cy + 6, bx + 5, cy + 13], fill=WOOD)
    d.rectangle([cx + 30, cy + 9, cx + 40, cy + 11], fill=WOOD)  # mesa na rua


def _ludus(d, cx, cy):
    d.rectangle([cx - 50, cy - 30, cx + 50, cy + 26], fill=TERRA_D)
    d.rectangle([cx - 46, cy - 26, cx + 46, cy + 22], fill=TERRA)
    d.rectangle([cx - 38, cy - 18, cx + 38, cy + 14], fill=SAND)
    for x in range(cx - 36, cx + 38, 8):
        d.rectangle([x, cy - 18, x + 2, cy - 14], fill=MARBLE)
        d.rectangle([x, cy + 10, x + 2, cy + 14], fill=MARBLE)
    # postes de treino e gladiadores (pontinhos)
    for px in (cx - 22, cx + 18):
        d.rectangle([px, cy - 6, px + 2, cy + 4], fill=WOOD)
    for (gx, gy, c) in ((cx - 14, cy - 2, "c8483a"), (cx - 8, cy, "4a6aa8"), (cx + 8, cy - 4, "d8a440"), (cx + 26, cy + 2, "c8483a")):
        d.rectangle([gx, gy - 3, gx + 1, gy - 2], fill=hexc("c88e62"))
        d.rectangle([gx, gy - 1, gx + 1, gy + 1], fill=hexc(c))
    d.rectangle([cx - 5, cy + 22, cx + 5, cy + 26], fill=DOOR)


def _market(d, cx, cy):
    d.rectangle([cx - 48, cy - 22, cx + 48, cy + 20], fill=hexc("d6c49c"))
    cols = [hexc("b8372e"), hexc("3d5c8c"), hexc("d8a64a"), hexc("5a8a4a"), hexc("8a4a9a")]
    for row, y in enumerate((cy - 18, cy + 4)):
        for i in range(5):
            x = cx - 44 + i * 18
            d.rectangle([x, y + 6, x + 14, y + 14], fill=WOOD)
            col = cols[(i + row * 2) % 5]
            d.rectangle([x - 1, y, x + 15, y + 6], fill=col)
            for k in range(x, x + 15, 4):
                d.rectangle([k, y + 6, k + 1, y + 7], fill=col)
            d.point((x + 4, y + 9), fill=hexc("e8c060"))
            d.point((x + 9, y + 10), fill=hexc("c84a3a"))
    # caixotes
    d.rectangle([cx + 40, cy + 14, cx + 46, cy + 19], fill=WOOD)


def _arena(d, cx, cy):
    rx, ry = 66, 42
    d.ellipse([cx - rx - 2, cy - ry + 2, cx + rx + 2, cy + ry + 6], fill=hexc("6a5a44"))  # sombra
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=hexc("b8a27a"))
    # arcos da fachada
    for k in range(48):
        a = k / 48 * math.tau
        x, y = cx + (rx - 3) * math.cos(a), cy + (ry - 3) * math.sin(a)
        d.rectangle([x - 1, y - 1, x + 1, y + 1], fill=hexc("5a4a38"))
    # arquibancadas (anéis)
    for i, c in enumerate(("d8c6a0", "c8b48c", "d8c6a0")):
        r1, r2 = rx - 8 - i * 7, ry - 6 - i * 5
        d.ellipse([cx - r1, cy - r2, cx + r1, cy + r2], fill=hexc(c))
        for k in range(36):
            a = k / 36 * math.tau
            d.point((cx + (r1 - 2) * math.cos(a), cy + (r2 - 2) * math.sin(a)), fill=hexc(("a8916a", "c84a3a", "4a6aa8", "e8dcc0")[(k + i) % 4]))
    d.ellipse([cx - 36, cy - 20, cx + 36, cy + 20], fill=hexc("8a7458"))
    d.ellipse([cx - 33, cy - 18, cx + 33, cy + 18], fill=SAND)
    for (x, y) in ((cx - 8, cy - 2), (cx + 6, cy + 2)):
        d.rectangle([x, y, x + 1, y + 2], fill=hexc("3a2a20"))


def _compass(d, x, y):
    d.ellipse([x - 14, y - 14, x + 14, y + 14], outline=hexc("6a5030"))
    d.ellipse([x - 11, y - 11, x + 11, y + 11], outline=hexc("8a7040"))
    d.polygon([(x, y - 16), (x + 3, y), (x, y + 16), (x - 3, y)], fill=hexc("3a2a1a"))
    d.polygon([(x - 16, y), (x, y - 3), (x + 16, y), (x, y + 3)], fill=hexc("6a5030"))
    d.polygon([(x, y - 16), (x + 3, y), (x - 3, y)], fill=hexc("c8483a"))
    d.rectangle([x - 2, y - 24, x + 2, y - 19], fill=hexc("3a2a1a"))  # N
    d.point((x - 1, y - 22), fill=hexc("e8dcc0"))
    d.point((x + 1, y - 21), fill=hexc("e8dcc0"))


def _frame(img):
    d = ImageDraw.Draw(img)
    c1, c2, c3 = hexc("3a2614"), hexc("8a6430"), hexc("d8b06a")
    d.rectangle([0, 0, W - 1, H - 1], outline=c1, width=3)
    d.rectangle([3, 3, W - 4, H - 4], outline=c2)
    d.rectangle([4, 4, W - 5, H - 5], outline=c3)
    d.rectangle([5, 5, W - 6, H - 6], outline=c1)
    for (x, y) in ((6, 6), (W - 13, 6), (6, H - 13), (W - 13, H - 13)):
        d.rectangle([x, y, x + 6, y + 6], fill=c2)
        d.rectangle([x + 2, y + 2, x + 4, y + 4], fill=c3)


def city_map(seed_rng):
    # o mapa antigo consumia 140 sorteios do gerador compartilhado; consome igual
    # para os cenários gerados depois (como a taverna) continuarem idênticos
    from gen_scenes import noise
    noise(np.zeros((H, W, 4), dtype=np.int32), 0, H, [hexc("5e8a46"), hexc("7aa65c")], 0.12, seed_rng)
    for _ in range(70):
        seed_rng.randint(0, W), seed_rng.randint(0, H)
    rng = np.random.default_rng(7)
    prng = random.Random(11)
    img = Image.fromarray(np.clip(_terrain(rng), 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    _fields(d, prng)
    _river(d)
    x0, y0, x1, y1 = WALL
    # ruas: decumano, cardo, rua do sul e acessos
    _road(d, [(0, DECUMANUS), (W, DECUMANUS)], 8)
    _road(d, [(CARDO, 0), (CARDO, H)], 8)
    _road(d, [(x0 - 20, SOUTH_ST), (x1 + 20, SOUTH_ST), (520, SOUTH_ST), MAP_POS["arena"]], 7)
    _road(d, [(MAP_POS["home"][0], DECUMANUS), (MAP_POS["home"][0], MAP_POS["home"][1] + 16)], 5)
    _road(d, [(MAP_POS["baths"][0], DECUMANUS), (MAP_POS["baths"][0], MAP_POS["baths"][1] + 20)], 5)
    _road(d, [(MAP_POS["temple"][0], DECUMANUS), (MAP_POS["temple"][0], MAP_POS["temple"][1] + 30)], 5)
    _road(d, [(SIDE_ST, DECUMANUS), (SIDE_ST, SOUTH_ST)], 5)
    _road(d, [(MAP_POS["ludus"][0], SOUTH_ST), (MAP_POS["ludus"][0], MAP_POS["ludus"][1] + 26)], 5)
    _road(d, [(MAP_POS["tavern"][0], DECUMANUS), (MAP_POS["tavern"][0], MAP_POS["tavern"][1] - 20)], 5)
    img = _cobbles(img, rng)
    d = ImageDraw.Draw(img)
    _bridge(d, CARDO)
    _bridge(d, SIDE_ST, 16)
    _boat(d, 220, int(_river_y(220)) - 1)
    _boat(d, 452, int(_river_y(452)) - 1, flip=True)
    _boat(d, 590, int(_river_y(590)) - 1)
    # casas preenchendo os quarteirões (sem cobrir ruas, rio e locais)
    occupied = []
    for k, (px, py) in MAP_POS.items():
        hw = {"arena": 74, "ludus": 56, "market": 54, "forum": 52, "temple": 44, "baths": 46, "home": 40, "tavern": 44}[k]
        occupied.append((px - hw, py - 46, px + hw, py + 40))

    def free(x, y, w, h, pad=3):
        if x < x0 + 8 or x + w > x1 - 8 or y < y0 + 8 or y + h > y1 - 8:
            return False
        for ax, ay, bx, by in occupied:
            if x < bx + pad and x + w > ax - pad and y < by + pad and y + h > ay - pad:
                return False
        for line in (DECUMANUS, SOUTH_ST):
            if y - 6 < line < y + h + 6:
                return False
        if x - 6 < CARDO < x + w + 6 or (x - 5 < SIDE_ST < x + w + 5 and y < SOUTH_ST):
            return False
        if any(abs(yy - _river_y(xx)) < 16 for xx in (x, x + w) for yy in (y, y + h)):
            return False
        return True

    layer = new_img(W, H)
    ld = ImageDraw.Draw(layer)
    for _ in range(700):
        w, h = prng.choice((10, 12, 14, 16)), prng.choice((10, 12, 14))
        x, y = prng.randint(x0 + 8, x1 - 24), prng.randint(y0 + 8, y1 - 20)
        if free(x, y, w, h):
            _house(ld, x, y, w, h, roof=prng.choice((TERRA, TERRA, TERRA_D, hexc("c06848"))))
            occupied.append((x, y, x + w, y + h))
    # árvores: jardins dentro, bosques e ciprestes fora
    for _ in range(320):
        x, y = prng.randint(8, W - 8), prng.randint(14, H - 8)
        inside = x0 - 8 < x < x1 + 8 and y0 - 8 < y < y1 + 8
        if abs(y - _river_y(x)) < 18 or (inside and not free(x - 5, y - 9, 10, 12, 1)):
            continue
        if not inside and any(ax - 6 < x < bx + 6 and ay - 6 < y < by + 6 for ax, ay, bx, by in occupied[:8]):
            continue
        if abs(y - DECUMANUS) < 8 or abs(x - CARDO) < 8 or abs(y - SOUTH_ST) < 8 or abs(x - SIDE_ST) < 7:
            continue
        if any(fx0 - 6 < x < fx1 + 6 and fy0 - 4 < y < fy1 + 10 for fx0, fy0, fx1, fy1 in FIELDS):
            continue
        if (inside and prng.random() < 0.4) or not inside:
            _tree(ld, x, y, "cypress" if prng.random() < (0.5 if not inside else 0.2) else "round")
            occupied.append((x - 5, y - 9, x + 5, y + 3))
    # prédios dos locais
    _forum(ld, *MAP_POS["forum"])
    _temple(ld, *MAP_POS["temple"])
    _baths(ld, *MAP_POS["baths"])
    _home(ld, *MAP_POS["home"])
    _tavern(ld, *MAP_POS["tavern"])
    _ludus(ld, *MAP_POS["ludus"])
    _market(ld, *MAP_POS["market"])
    _arena(ld, *MAP_POS["arena"])
    img.alpha_composite(finish(layer, light=0.18, dark=0.74))
    d = ImageDraw.Draw(img)
    _wall(d)
    _compass(d, 610, 50)
    _frame(img)
    return img
