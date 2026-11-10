"""Cenários em pixel art: arena romana (com público animado), pátio de treino (ludus),
tochas/braseiros, poste de treino (palus)."""
import math
import random
import numpy as np
from PIL import Image, ImageDraw
from pixel import new_img, finish, darker, lighter, mix, hexc, limb, poly

W, H = 640, 360

SKY_TOP = hexc("5f97cf")
SKY_BOT = hexc("bfdcec")
TRAV = hexc("d8c6a0")      # travertino
TRAV_D = hexc("a8916a")
MARBLE = hexc("e8e2d2")
MARBLE_D = hexc("b9b1a0")
POMP_RED = hexc("8e2b23")
GOLD = hexc("d8b04a")
PURPLE = hexc("5b2a6e")
SAND = hexc("d9b97c")
SAND_D = hexc("c4a061")
SAND_L = hexc("e8d0a2")
DARK = hexc("2d1f18")

TUNICS = [hexc(c) for c in ("efe6d2", "e2d6b8", "b8372e", "8e2b23", "3d5c8c", "d8a64a", "6b8e4e", "a05a2c",
                             "f2f0e8", "7a4a8a", "c9b48a", "5a7a9a")]
SKINS = [hexc(c) for c in ("eebe94", "c88e62", "8c5c3c", "e0a878")]
HAIRS = [hexc(c) for c in ("2a1c14", "5a3a20", "8a6a40", "1a1410", "b0a090")]


def fill_rect(a, x0, y0, x1, y1, c):
    a[max(0, y0):min(H, y1), max(0, x0):min(W, x1), :3] = c
    a[max(0, y0):min(H, y1), max(0, x0):min(W, x1), 3] = 255


def gradient(a, y0, y1, c0, c1, x0=0, x1=W):
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0 - 1)
        fill_rect(a, x0, y, x1, y + 1, mix(c0, c1, t))


def noise(a, y0, y1, colors, density, rng, x0=0, x1=W):
    for y in range(y0, y1):
        for x in range(x0, x1):
            if rng.random() < density:
                a[y, x, :3] = rng.choice(colors)


def darken_region(a, mask, k):
    a[mask, :3] = (a[mask, :3] * k).astype(a.dtype)


def to_img(a):
    return Image.fromarray(a.astype(np.uint8))


def brazier_sheet(frames=4):
    """Braseiro em tripé com chama animada (16x32 por quadro)."""
    fw, fh = 16, 32
    sheet = new_img(fw * frames, fh)
    for f in range(frames):
        img = new_img(fw, fh)
        d = ImageDraw.Draw(img)
        # tripé
        d.line([(8, 16), (3, 31)], fill=hexc("4a3a2a"), width=1)
        d.line([(8, 16), (13, 31)], fill=hexc("4a3a2a"), width=1)
        d.line([(8, 16), (8, 31)], fill=hexc("4a3a2a"), width=1)
        d.rectangle([3, 14, 13, 17], fill=hexc("9a7040"))
        d.rectangle([4, 17, 12, 18], fill=hexc("6a4a2a"))
        base = finish(img, light=0.3)
        flame = new_img(fw, fh)
        fd = ImageDraw.Draw(flame)
        sway = [0, 1, 0, -1][f]
        hgt = [11, 12, 10, 12][f]
        fd.polygon([(4, 14), (12, 14), (10 + sway, 14 - hgt // 2), (8 + sway, 14 - hgt), (6 + sway, 14 - hgt // 2)], fill=hexc("e2602a"))
        fd.polygon([(6, 14), (10, 14), (9 + sway, 10), (8 + sway, 14 - hgt + 4), (7 + sway, 10)], fill=hexc("f4b03a"))
        fd.point((8 + sway, 12), fill=hexc("fff0b0"))
        fd.point((7 + sway, 13), fill=hexc("fff0b0"))
        base.alpha_composite(flame)
        sheet.alpha_composite(base, (f * fw, 0))
    return sheet


def glow_sprite():
    """Halo de luz suave (usado em blend ADD) para tochas."""
    s = 48
    img = new_img(s, s)
    a = np.zeros((s, s, 4), dtype=np.uint8)
    for y in range(s):
        for x in range(s):
            r = math.hypot(x - s / 2, y - s / 2) / (s / 2)
            if r < 1:
                v = int(110 * (1 - r) ** 2)
                v = (v // 22) * 22  # degraus (estética pixel)
                a[y, x] = (255, 170, 80, v)
    return Image.fromarray(a)


def palus_sheet():
    """Poste de treino de madeira (palus) — 2 quadros: parado e atingido."""
    fw, fh = 24, 56
    sheet = new_img(fw * 2, fh)
    for f in range(2):
        img = new_img(fw, fh)
        d = ImageDraw.Draw(img)
        off = 1 if f == 1 else 0
        d.rectangle([9 + off, 8, 15 + off, 54], fill=hexc("8a5a32"))
        d.rectangle([6, 50, 18, 55], fill=hexc("6a4a2a"))
        d.rectangle([8 + off, 18, 16 + off, 34], fill=hexc("d8c48a"))  # enchimento de palha
        for y in range(19, 34, 3):
            d.line([(8 + off, y), (16 + off, y)], fill=hexc("b0985a"))
        d.rectangle([9 + off, 4, 15 + off, 9], fill=hexc("7a4a2a"))
        img = finish(img, light=0.25)
        sheet.alpha_composite(img, (f * fw, 0))
    return sheet


# ------------------------------------------------------------------ LUDUS
def ludus(rng):
    a = np.zeros((H, W, 4), dtype=np.int32)
    # céu transparente: desenhado pelo jogo (ciclo de dia e noite)
    # colinas e ciprestes ao fundo
    for x in range(W):
        h = int(96 + 10 * math.sin(x / 70) + 6 * math.sin(x / 23 + 1))
        fill_rect(a, x, h, x + 1, 130, hexc("7c9a6a"))
    for cx in range(30, W, 57):
        hgt = rng.randint(24, 36)
        for y in range(118 - hgt, 122):
            w = int(4 * math.sin(math.pi * (y - (118 - hgt)) / (hgt + 4)) + 1)
            fill_rect(a, cx - w, y, cx + w, y + 1, hexc("2f5a34") if (y % 3) else hexc("3e6e40"))
    # edifício do ludus: telhado
    for y in range(110, 130):
        for x in range(W):
            tile = ((x + (y // 3) * 3) % 8) < 6
            a[y, x, :3] = hexc("b0563a") if tile else hexc("8a3e2a")
            a[y, x, 3] = 255
    fill_rect(a, 0, 128, W, 131, hexc("6e2e1e"))
    # parede
    fill_rect(a, 0, 131, W, 236, hexc("e6d6b4"))
    fill_rect(a, 0, 186, W, 236, hexc("a8423a"))  # rodapé pompeiano
    fill_rect(a, 0, 186, W, 188, GOLD)
    # portas das celas
    for x in range(40, W, 80):
        fill_rect(a, x, 150, x + 22, 236, hexc("4a3020"))
        fill_rect(a, x + 2, 152, x + 20, 236, hexc("6a4428"))
        for yy in range(158, 236, 10):
            fill_rect(a, x + 2, yy, x + 20, yy + 1, hexc("4a3020"))
        fill_rect(a, x - 2, 146, x + 24, 150, MARBLE_D)
    # colunata em primeiro plano (peristilo)
    fill_rect(a, 0, 132, W, 140, MARBLE)
    fill_rect(a, 0, 139, W, 140, MARBLE_D)
    for x in range(0, W, 64):
        fill_rect(a, x + 26, 140, x + 36, 240, lighter(MARBLE, 0.3))
        fill_rect(a, x + 33, 140, x + 36, 240, MARBLE_D)
        fill_rect(a, x + 23, 140, x + 39, 144, MARBLE)
        fill_rect(a, x + 23, 236, x + 39, 240, MARBLE_D)
    # suporte de armas
    rx = 470
    fill_rect(a, rx, 200, rx + 50, 204, hexc("6a4428"))
    fill_rect(a, rx, 222, rx + 50, 226, hexc("6a4428"))
    for k in range(5):
        x = rx + 4 + k * 10
        fill_rect(a, x, 176, x + 2, 240, hexc("8a6a40"))
        fill_rect(a, x - 1, 172, x + 3, 178, hexc("c4c8d0"))
    # escudos encostados
    for k, sx in enumerate((120, 138)):
        fill_rect(a, sx, 210, sx + 12, 240, GOLD)
        fill_rect(a, sx + 1, 211, sx + 11, 239, hexc("a62c24"))
        fill_rect(a, sx + 4, 222, sx + 8, 227, hexc("c4c8d0"))
    # cocho de água
    fill_rect(a, 200, 226, 250, 242, hexc("9a9080"))
    fill_rect(a, 202, 228, 248, 232, hexc("4a7aa0"))
    # chão de areia
    gradient(a, 240, H, SAND, lighter(SAND, 0.05))
    noise(a, 240, H, [SAND_D, SAND_L], 0.15, rng)
    for y in range(240, 252):
        k = 0.7 + 0.3 * (y - 240) / 12
        a[y, :, :3] = (a[y, :, :3] * k).astype(np.int32)
    # sombras das colunas
    for x in range(0, W, 64):
        for y in range(240, 262):
            for xx in range(x + 30 + (y - 240), x + 40 + (y - 240)):
                if 0 <= xx < W:
                    a[y, xx, :3] = (a[y, xx, :3] * 0.85).astype(np.int32)
    return to_img(np.clip(a, 0, 255))
