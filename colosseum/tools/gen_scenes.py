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


# ------------------------------------------------------------------ ARENA
def arena(rng):
    a = np.zeros((H, W, 4), dtype=np.int32)
    gradient(a, 0, 64, SKY_TOP, SKY_BOT)
    # nuvens
    for _ in range(6):
        cx, cy = rng.randint(0, W), rng.randint(26, 50)
        for k in range(rng.randint(3, 6)):
            r = rng.randint(4, 8)
            x, y = cx + k * 7, cy + rng.randint(-2, 2)
            for yy in range(y - r // 2, y + r // 2):
                for xx in range(x - r, x + r):
                    if 0 <= xx < W and 0 <= yy < H and (xx - x) ** 2 / r ** 2 + (yy - y) ** 2 / (r / 2) ** 2 < 1:
                        a[yy, xx, :3] = (244, 248, 250) if yy < y else (220, 232, 240)
    # ático (parede superior externa)
    fill_rect(a, 0, 40, W, 66, TRAV)
    fill_rect(a, 0, 40, W, 42, lighter(TRAV, 0.3))
    fill_rect(a, 0, 64, W, 66, TRAV_D)
    for x in range(8, W, 32):
        fill_rect(a, x, 42, x + 4, 64, lighter(TRAV, 0.15))   # pilastras
        fill_rect(a, x + 4, 42, x + 5, 64, TRAV_D)
        fill_rect(a, x + 14, 48, x + 20, 58, darker(TRAV, 0.45))  # janelas
        fill_rect(a, x + 14, 48, x + 20, 49, darker(TRAV, 0.3))
    # mastros e velário
    for x in range(20, W, 64):
        fill_rect(a, x, 4, x + 2, 42, hexc("6a4a2c"))
    for x in range(0, W):
        band = (x // 16) % 2
        col = hexc("b8372e") if band == 0 else hexc("efe0c0")
        h = 18 + int(3 * math.sin(x / 16 * math.pi) ** 2)
        for y in range(0, h):
            shade = 1.0 - 0.15 * (y / h)
            a[y, x, :3] = [int(v * shade) for v in col]
            a[y, x, 3] = 255
        a[h, x, :3] = darker(col, 0.5)
    # arcada superior
    fill_rect(a, 0, 66, W, 112, TRAV)
    for x in range(0, W, 30):
        ax = x + 6
        for y in range(74, 108):
            for xx in range(ax, min(W, ax + 18)):
                inside = y >= 82 or (xx - (ax + 9)) ** 2 + (y - 82) ** 2 <= 81
                if inside:
                    a[y, xx, :3] = mix(hexc("3b2a20"), hexc("5a4030"), (y - 74) / 34)
        fill_rect(a, x + 1, 68, x + 5, 110, lighter(TRAV, 0.25))  # colunas
        fill_rect(a, x + 4, 68, x + 5, 110, TRAV_D)
        fill_rect(a, x, 68, x + 6, 70, MARBLE)
        fill_rect(a, x, 108, x + 6, 110, MARBLE_D)
    fill_rect(a, 0, 66, W, 68, TRAV_D)
    fill_rect(a, 0, 110, W, 113, darker(TRAV, 0.7))
    # arquibancadas (cavea)
    y = 113
    while y < 200:
        if y in (142, 143, 144, 172, 173, 174):
            fill_rect(a, 0, y, W, y + 1, MARBLE if y in (142, 172) else MARBLE_D)
            y += 1
            continue
        step = (y - 113) % 6
        col = TRAV if step < 4 else darker(TRAV, 0.78)
        fill_rect(a, 0, y, W, y + 1, col)
        y += 1
    # vomitórios (entradas)
    for x in range(52, W, 96):
        for yb in (120, 150, 180):
            fill_rect(a, x, yb, x + 10, yb + 14, hexc("3b2a20"))
            fill_rect(a, x, yb, x + 10, yb + 2, darker(TRAV, 0.5))
    # sombra do velário sobre as arquibancadas (luz vindo da direita)
    yy, xx = np.mgrid[0:H, 0:W]
    shadow = (yy > 18) & (yy < 200) & (xx < 300 - (yy - 18) * 1.2)
    darken_region(a, shadow, 0.78)
    # pódio
    fill_rect(a, 0, 200, W, 240, MARBLE)
    fill_rect(a, 0, 200, W, 203, GOLD)
    fill_rect(a, 0, 203, W, 204, darker(GOLD, 0.6))
    fill_rect(a, 0, 236, W, 240, MARBLE_D)
    for x in range(6, W, 48):
        fill_rect(a, x, 208, x + 40, 232, GOLD)
        fill_rect(a, x + 1, 209, x + 39, 231, POMP_RED)
        fill_rect(a, x + 1, 209, x + 39, 210, lighter(POMP_RED, 0.2))
        # motivo grego
        for k in range(4, 36, 6):
            fill_rect(a, x + k, 219, x + k + 3, 220, darker(GOLD, 0.8))
            fill_rect(a, x + k + 2, 216, x + k + 3, 220, darker(GOLD, 0.8))
    # grade de proteção sobre o pódio
    for x in range(0, W, 3):
        fill_rect(a, x, 196, x + 1, 200, hexc("4a3a2a"))
    fill_rect(a, 0, 195, W, 196, hexc("4a3a2a"))
    # portões
    for gx in (36, 568):
        for y in range(206, 240):
            for x in range(gx, gx + 36):
                inside = y >= 218 or (x - (gx + 18)) ** 2 + (y - 218) ** 2 <= 18 * 18
                if inside:
                    a[y, x, :3] = DARK
        for x in range(gx + 3, gx + 34, 5):
            fill_rect(a, x, 214, x + 2, 240, hexc("5a4a3a"))
        for y in range(220, 240, 6):
            fill_rect(a, gx + 2, y, gx + 34, y + 1, hexc("5a4a3a"))
        fill_rect(a, gx - 3, 204, gx, 240, MARBLE_D)
        fill_rect(a, gx + 36, 204, gx + 39, 240, MARBLE_D)
    # camarote imperial (pulvinar)
    px0, px1 = 280, 360
    fill_rect(a, px0, 160, px1, 204, MARBLE)
    poly_pts = [(px0 - 4, 162), (320, 146), (px1 + 4, 162)]
    img = to_img(a)
    d = ImageDraw.Draw(img)
    d.polygon(poly_pts, fill=MARBLE, outline=MARBLE_D)
    d.polygon([(px0 + 8, 160), (320, 150), (px1 - 8, 160)], fill=POMP_RED)
    a = np.array(img).astype(np.int32)
    fill_rect(a, px0 - 4, 162, px1 + 4, 165, MARBLE_D)
    for cx in range(px0 + 2, px1, 19):
        fill_rect(a, cx, 165, cx + 4, 204, lighter(MARBLE, 0.4))
        fill_rect(a, cx + 3, 165, cx + 4, 204, MARBLE_D)
    for i, x in enumerate(range(px0, px1)):
        drop = 6 + int(3 * abs(math.sin(i / 6.5)))
        for y in range(165, 165 + drop):
            a[y, x, :3] = PURPLE if (x // 3) % 2 else darker(PURPLE, 0.8)
        a[165 + drop, x, :3] = GOLD
    fill_rect(a, px0, 188, px1, 204, PURPLE)
    fill_rect(a, px0, 188, px1, 190, GOLD)
    for x in range(px0 + 4, px1 - 4, 8):
        fill_rect(a, x, 194, x + 4, 198, GOLD)
    # estandartes vermelhos
    for bx in (196, 432):
        fill_rect(a, bx, 204, bx + 14, 230, hexc("a8322a"))
        fill_rect(a, bx, 204, bx + 14, 206, GOLD)
        img = to_img(a)
        d = ImageDraw.Draw(img)
        d.polygon([(bx, 230), (bx + 7, 236), (bx + 14, 230)], fill=hexc("a8322a"))
        d.ellipse([bx + 3, 212, bx + 11, 220], outline=GOLD)
        a = np.array(img).astype(np.int32)
        fill_rect(a, bx + 13, 206, bx + 14, 232, darker(hexc("a8322a"), 0.6))
    # chão de areia
    gradient(a, 240, H, SAND, lighter(SAND, 0.06))
    noise(a, 240, H, [SAND_D, SAND_L, darker(SAND, 0.92)], 0.16, rng)
    for _ in range(70):
        cx, cy = rng.randint(0, W), rng.randint(250, H)
        rx, ry = rng.randint(6, 22), rng.randint(2, 5)
        col = darker(SAND, 0.94) if rng.random() < 0.6 else lighter(SAND, 0.08)
        for y in range(cy - ry, cy + ry):
            for x in range(cx - rx, cx + rx):
                if 0 <= x < W and 240 <= y < H and ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 and rng.random() < 0.7:
                    a[y, x, :3] = col
    # marcas de rastelo
    for y in range(256, H, 9):
        for x in range(0, W):
            if (x + y * 3) % 11 < 6 and rng.random() < 0.5:
                a[y, x, :3] = darker(a[y, x, :3], 0.95)
    # pedrinhas
    for _ in range(140):
        x, y = rng.randint(0, W - 2), rng.randint(244, H - 2)
        a[y, x, :3] = hexc("9c8a70")
        a[y, x + 1, :3] = hexc("c2b49a")
    # sombra do pódio na areia
    for y in range(240, 256):
        k = 0.62 + 0.38 * (y - 240) / 16
        a[y, :, :3] = (a[y, :, :3] * k).astype(np.int32)
    # vinheta lateral
    for x in range(W):
        k = 1 - 0.18 * max(0, abs(x - W / 2) / (W / 2) - 0.55) / 0.45
        a[200:, x, :3] = (a[200:, x, :3] * k).astype(np.int32)
    a[..., 3] = 255
    return to_img(np.clip(a, 0, 255))


def crowd_layer(rng, frames=3):
    """Camada do público (transparente), com quadros de animação de torcida."""
    people = []
    rows = []
    y = 116
    while y < 196:
        if not (140 <= y <= 146 or 170 <= y <= 176):
            rows.append(y)
        y += 6
    for ry in rows:
        x = rng.randint(0, 3)
        while x < W - 3:
            vom = any(vx - 2 <= x <= vx + 11 and vy <= ry <= vy + 14 for vx in range(52, W, 96) for vy in (120, 150, 180))
            if 280 <= x <= 360 and ry > 150:
                vom = True
            if not vom and rng.random() < 0.88:
                people.append((x, ry, rng.choice(SKINS), rng.choice(HAIRS), rng.choice(TUNICS), rng.random()))
            x += rng.choice((4, 4, 5))
    # pessoas nas arcadas
    for x in range(0, W, 30):
        for k in range(3):
            if rng.random() < 0.8:
                people.append((x + 8 + k * 5, 102, rng.choice(SKINS), rng.choice(HAIRS), rng.choice(TUNICS), rng.random()))
    yy, xx = np.mgrid[0:H, 0:W]
    shadow = (yy > 18) & (yy < 200) & (xx < 300 - (yy - 18) * 1.2)
    imgs = []
    for f in range(frames):
        a = np.zeros((H, W, 4), dtype=np.int32)
        for (x, y, skin, hair, tunic, ph) in people:
            cheer = (f == 1 and ph < 0.35) or (f == 2 and 0.35 <= ph < 0.6)
            dy = -1 if cheer else 0
            by = y - 4 + dy
            # corpo
            fill_rect(a, x, by + 2, x + 3, by + 5, tunic)
            fill_rect(a, x, by + 4, x + 3, by + 5, darker(tunic, 0.75))
            # cabeça
            fill_rect(a, x, by, x + 2, by + 2, skin)
            fill_rect(a, x, by, x + 2, by + 1, hair)
            if cheer:
                fill_rect(a, x - 1, by - 1, x, by + 2, skin)
                fill_rect(a, x + 3, by - 1, x + 4, by + 2, skin)
        m = shadow & (a[..., 3] > 0)
        a[m, :3] = (a[m, :3] * 0.78).astype(np.int32)
        imgs.append(to_img(np.clip(a, 0, 255)))
    sheet = new_img(W * frames, H)
    for i, im in enumerate(imgs):
        sheet.alpha_composite(im, (i * W, 0))
    return sheet


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
    gradient(a, 0, 120, hexc("6da2d6"), hexc("d4e6ee"))
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
    a[..., 3] = 255
    return to_img(np.clip(a, 0, 255))
