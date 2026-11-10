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
# O gladiador tem ~44 px de altura (pés em y=312, cabeça em ~268): móveis nessa escala.
def home(rng):
    a = _arr()
    # parede: reboco claro em cima, barra pompeiana vermelha embaixo
    fill_rect(a, 0, 0, W, 252, hexc("dccbaa"))
    noise(a, 0, 252, [hexc("d4c2a0"), hexc("e2d2b2")], 0.12, rng)
    fill_rect(a, 0, 214, W, 252, POMP)
    fill_rect(a, 0, 212, W, 214, hexc("2e2018"))
    fill_rect(a, 0, 250, W, 254, hexc("2e2018"))
    for x in range(20, W, 70):  # painéis decorativos na barra
        fill_rect(a, x, 220, x + 40, 246, darker(POMP, 0.85))
        fill_rect(a, x + 2, 222, x + 38, 244, POMP)
    fill_rect(a, 0, 120, W, 123, hexc("b8a888"))  # friso
    # janela na altura da cabeça (céu visível através dela)
    wx, wy, ww, wh = 204, 176, 34, 30
    fill_rect(a, wx - 3, wy - 3, wx + ww + 3, wy + wh + 4, hexc("6a4a2a"))
    a[wy:wy + wh, wx:wx + ww, 3] = 0
    fill_rect(a, wx + ww // 2 - 1, wy, wx + ww // 2 + 1, wy + wh, hexc("6a4a2a"))
    fill_rect(a, wx - 12, wy - 2, wx - 3, wy + wh + 2, hexc("8a5a32"))  # venezianas abertas
    fill_rect(a, wx + ww + 3, wy - 2, wx + ww + 12, wy + wh + 2, hexc("8a5a32"))
    for yy in range(wy + 1, wy + wh, 4):
        fill_rect(a, wx - 11, yy, wx - 4, yy + 1, hexc("6a4428"))
        fill_rect(a, wx + ww + 4, yy, wx + ww + 11, yy + 1, hexc("6a4428"))
    fill_rect(a, wx - 5, wy + wh + 2, wx + ww + 5, wy + wh + 5, hexc("b8a888"))  # parapeito
    # piso de tábuas
    for y in range(254, H):
        col = WOOD if ((y - 254) // 5) % 2 else darker(WOOD, 0.9)
        fill_rect(a, 0, y, W, y + 1, col)
    for y in range(254, H, 5):
        for x in range(((y // 5) % 3) * 23, W, 70):
            fill_rect(a, x, y, x + 1, y + 5, WOOD_D)
    img = to_img(np.clip(a, 0, 255))
    d = ImageDraw.Draw(img)
    # larário (altar doméstico) com estatuetas
    lx = 300
    d.rectangle([lx, 176, lx + 30, 202], fill=hexc("efe6d2"))
    d.polygon([(lx - 3, 176), (lx + 15, 164), (lx + 33, 176)], fill=hexc("efe6d2"), outline=hexc("b9b1a0"))
    d.rectangle([lx + 4, 180, lx + 26, 200], fill=hexc("6a2a20"))
    for fx_ in (lx + 9, lx + 19):
        d.rectangle([fx_, 188, fx_ + 3, 198], fill=GOLD)
        d.ellipse([fx_, 184, fx_ + 3, 188], fill=GOLD)
    d.rectangle([lx - 2, 202, lx + 32, 205], fill=hexc("b9b1a0"))
    # gládio e escudo pendurados
    d.line([(352, 178), (352, 204)], fill=hexc("c4c8d0"), width=2)
    d.rectangle([348, 204, 356, 206], fill=GOLD)
    d.rectangle([362, 172, 380, 204], fill=GOLD)
    d.rectangle([364, 174, 378, 202], fill=hexc("a62c24"))
    d.ellipse([368, 184, 374, 190], fill=hexc("c4c8d0"))
    # prateleira com potes e tigela
    d.rectangle([408, 196, 456, 199], fill=WOOD)
    d.line([(412, 199), (416, 205)], fill=WOOD_D, width=2)
    d.line([(452, 199), (448, 205)], fill=WOOD_D, width=2)
    d.ellipse([412, 184, 422, 196], fill=hexc("b0603a"))
    d.rectangle([415, 181, 419, 185], fill=hexc("b0603a"))
    d.ellipse([426, 186, 436, 196], fill=hexc("c8b48a"))
    d.ellipse([440, 191, 454, 197], fill=hexc("8a5a32"))
    # capa vermelha num cabide
    d.rectangle([466, 178, 469, 181], fill=WOOD_D)
    d.polygon([(462, 181), (473, 181), (476, 214), (459, 214)], fill=hexc("9c2a22"))
    d.line([(467, 184), (467, 212)], fill=hexc("7a1e18"))
    # tapete sob o gladiador
    d.rectangle([306, 304, 374, 318], fill=hexc("9a5a2a"))
    d.rectangle([309, 306, 371, 316], fill=hexc("c8903a"))
    for x in range(312, 370, 8):
        d.rectangle([x, 309, x + 3, 312], fill=hexc("7a2a1e"))
    # mesa com lamparina, pão e caneca (proporcional)
    d.rectangle([228, 284, 266, 287], fill=hexc("8a5a32"))
    d.rectangle([230, 287, 233, 306], fill=WOOD_D)
    d.rectangle([261, 287, 264, 306], fill=WOOD_D)
    d.ellipse([233, 278, 243, 284], fill=hexc("c08a3e"))  # lamparina
    d.rectangle([241, 278, 244, 281], fill=hexc("c08a3e"))
    d.ellipse([247, 279, 257, 285], fill=hexc("c8903a"))  # pão
    d.line([(249, 281), (255, 281)], fill=hexc("9a6a2a"))
    d.rectangle([259, 278, 263, 284], fill=hexc("8a8a9a"))  # caneca
    # banquinho
    d.rectangle([270, 294, 284, 297], fill=hexc("8a5a32"))
    d.line([(272, 297), (271, 306)], fill=WOOD_D, width=2)
    d.line([(282, 297), (283, 306)], fill=WOOD_D, width=2)
    # cama na escala do gladiador (~54 px de comprimento)
    d.rectangle([392, 292, 446, 297], fill=hexc("6a4628"))
    d.rectangle([392, 286, 395, 306], fill=hexc("5a3a20"))
    d.rectangle([443, 288, 446, 306], fill=hexc("5a3a20"))
    d.rectangle([396, 286, 442, 292], fill=hexc("d8c48a"))  # colchão de palha
    d.rectangle([414, 284, 442, 292], fill=hexc("8e2b23"))  # cobertor
    for x in range(416, 442, 6):
        d.line([(x, 284), (x, 292)], fill=hexc("b8473a"))
    d.ellipse([396, 282, 408, 289], fill=hexc("efe6d2"))  # travesseiro
    # sandálias ao lado da cama e baú
    d.rectangle([382, 306, 388, 308], fill=hexc("6a4628"))
    d.rectangle([382, 310, 388, 312], fill=hexc("6a4628"))
    d.rectangle([454, 292, 478, 308], fill=hexc("6a4628"))
    d.rectangle([454, 292, 478, 296], fill=hexc("8a6038"))
    d.rectangle([465, 298, 467, 302], fill=GOLD)
    # ânfora no canto
    d.ellipse([186, 286, 200, 308], fill=hexc("b0603a"))
    d.rectangle([190, 280, 196, 288], fill=hexc("b0603a"))
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
    # lanternas penduradas nos toldos
    for x in (60, 120, 220, 280, 390, 450, 540, 600):
        d.line([(x, 220), (x, 226)], fill=WOOD_D)
        d.rectangle([x - 2, 226, x + 2, 231], fill=hexc("e0a040"))
    # fonte pública
    fx0 = 430
    d.rectangle([fx0 - 22, 296, fx0 + 22, 312], fill=hexc("c8beaa"))
    d.rectangle([fx0 - 20, 298, fx0 + 20, 304], fill=hexc("3a7ab0"))
    d.rectangle([fx0 - 3, 274, fx0 + 3, 298], fill=hexc("b9b1a0"))
    d.ellipse([fx0 - 6, 270, fx0 + 6, 276], fill=hexc("c8beaa"))
    d.line([(fx0 - 1, 276), (fx0 - 8, 298)], fill=hexc("8ac0e0"))
    d.line([(fx0 + 1, 276), (fx0 + 8, 298)], fill=hexc("8ac0e0"))
    # caixotes, barris e cestos
    for (x, y) in ((196, 286), (208, 278), (220, 288)):
        d.rectangle([x, y, x + 12, y + 12], fill=hexc("9a6a3a"))
        d.line([(x, y), (x + 12, y + 12)], fill=hexc("6a4428"))
        d.rectangle([x, y, x + 12, y + 12], outline=hexc("6a4428"))
    for x in (480, 494):
        d.rounded_rectangle([x, 282, x + 12, 302], radius=3, fill=hexc("7a5230"))
        d.line([(x, 287), (x + 12, 287)], fill=hexc("4a3a2a"))
        d.line([(x, 297), (x + 12, 297)], fill=hexc("4a3a2a"))
    for x in (250, 268):
        d.ellipse([x, 300, x + 14, 310], fill=hexc("b89a5a"))
        for k in range(3):
            d.ellipse([x + 2 + k * 4, 297, x + 6 + k * 4, 302], fill=[hexc("c84a2a"), hexc("e0b040"), hexc("6a9a3a")][k])
    # pombos
    for (x, y) in ((300, 330), (306, 333), (360, 326)):
        d.ellipse([x, y, x + 4, y + 3], fill=hexc("8a8a92"))
        d.point((x + 4, y), fill=hexc("6a6a72"))
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
# (versão 0.6.2: o mapa fica em gen_map.py)
from gen_map import MAP_POS, city_map  # noqa: E402,F401


# ------------------------------------------------------------------ monge do templo
def monk_sheet():
    """Monge de Marte sentado de pernas cruzadas (2 quadros: respiração)."""
    from PIL import Image
    from pixel import new_img, finish
    fw, fh = 48, 44
    sheet = new_img(fw * 2, fh)
    for f in range(2):
        img = new_img(fw, fh)
        d = ImageDraw.Draw(img)
        b = 1 if f == 1 else 0
        # esteira
        d.rectangle([4, 38, 44, 42], fill=hexc("b89a5a"))
        for x in range(6, 44, 4):
            d.line([(x, 38), (x, 42)], fill=hexc("9a7a40"))
        robe = hexc("8e2b23")
        # pernas cruzadas
        d.ellipse([8, 30, 40, 40], fill=darker(robe, 0.85))
        d.ellipse([10, 32, 22, 38], fill=hexc("c88e62"))  # pé
        d.ellipse([28, 32, 38, 38], fill=hexc("c88e62"))
        # tronco (manto)
        d.polygon([(16, 14 + b), (32, 14 + b), (35, 34), (13, 34)], fill=robe)
        d.line([(24, 15 + b), (20, 33)], fill=hexc("d8b04a"))  # faixa dourada
        # braços com mãos sobre os joelhos
        d.line([(16, 18 + b), (12, 30)], fill=darker(robe, 0.9), width=4)
        d.line([(32, 18 + b), (36, 30)], fill=darker(robe, 0.9), width=4)
        d.ellipse([10, 29, 15, 33], fill=hexc("c88e62"))
        d.ellipse([34, 29, 39, 33], fill=hexc("c88e62"))
        # cabeça calva com barba grisalha
        d.ellipse([18, 3 + b, 30, 15 + b], fill=hexc("c88e62"))
        d.polygon([(19, 11 + b), (29, 11 + b), (27, 18 + b), (21, 18 + b)], fill=hexc("c8c4bc"))
        d.point((21, 8 + b), fill=hexc("2a1c14"))
        d.point((26, 8 + b), fill=hexc("2a1c14"))
        img = finish(img, light=0.2)
        sheet.alpha_composite(img, (f * fw, 0))
    return sheet
