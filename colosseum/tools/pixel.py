"""Pequena biblioteca de pixel art usada pelo gerador de assets do COLOSSEUM.

Fornece: criação de camadas, sombreamento automático (luz vinda do alto/esquerda),
contorno escuro ("selout"), cinemática inversa simples para membros e utilidades
de desenho sem anti-aliasing.
"""
import math
import numpy as np
from PIL import Image, ImageDraw


def new_img(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def _neighbors(mask):
    up = np.zeros_like(mask)
    up[1:, :] = mask[:-1, :]
    down = np.zeros_like(mask)
    down[:-1, :] = mask[1:, :]
    left = np.zeros_like(mask)
    left[:, 1:] = mask[:, :-1]
    right = np.zeros_like(mask)
    right[:, :-1] = mask[:, 1:]
    return up, down, left, right


def shade(img, light=0.24, dark=0.70):
    """Ilumina bordas superiores/esquerdas e escurece bordas inferiores/direitas."""
    a = np.array(img).astype(np.float32)
    mask = a[..., 3] > 0
    up, down, left, right = _neighbors(mask)
    lit = mask & (~up | ~left)
    shd = mask & (~down | ~right) & ~lit
    rgb = a[..., :3]
    rgb[lit] = rgb[lit] + (255 - rgb[lit]) * light
    rgb[shd] = rgb[shd] * dark
    a[..., :3] = rgb
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def outline(img, factor=0.30, color=None):
    """Adiciona contorno de 1px usando a cor escurecida do vizinho."""
    a = np.array(img).astype(np.float32)
    mask = a[..., 3] > 0
    out = a.copy()
    filled = np.zeros_like(mask)
    shifts = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    for dy, dx in shifts:
        src = np.zeros_like(a)
        smask = np.zeros_like(mask)
        ys = slice(max(dy, 0), a.shape[0] + min(dy, 0))
        yd = slice(max(-dy, 0), a.shape[0] + min(-dy, 0))
        xs = slice(max(dx, 0), a.shape[1] + min(dx, 0))
        xd = slice(max(-dx, 0), a.shape[1] + min(-dx, 0))
        src[ys, xs] = a[yd, xd]
        smask[ys, xs] = mask[yd, xd]
        target = ~mask & smask & ~filled
        if color is None:
            out[target, :3] = src[target, :3] * factor
        else:
            out[target, :3] = color
        out[target, 3] = 255
        filled |= target
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def finish(img, light=0.24, dark=0.70, ol=True):
    img = shade(img, light, dark)
    if ol:
        img = outline(img)
    return img


def ik(root, end, l1, l2, prefer="fwd"):
    """Resolve a articulação do meio (joelho/cotovelo). Retorna (meio, fim_ajustado)."""
    dx, dy = end[0] - root[0], end[1] - root[1]
    d = math.hypot(dx, dy)
    if d < 1e-6:
        return (root[0], root[1] + l1), end
    if d >= l1 + l2 - 0.05:
        k = (l1 + l2 - 0.05) / d
        end = (root[0] + dx * k, root[1] + dy * k)
        dx, dy = end[0] - root[0], end[1] - root[1]
        d = math.hypot(dx, dy)
    if d < abs(l1 - l2) + 0.05:
        d = abs(l1 - l2) + 0.05
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    mx, my = root[0] + a * dx / d, root[1] + a * dy / d
    p1 = (mx + h * dy / d, my - h * dx / d)
    p2 = (mx - h * dy / d, my + h * dx / d)
    if prefer == "fwd":
        mid = p1 if p1[0] >= p2[0] else p2
    elif prefer == "back":
        mid = p1 if p1[0] < p2[0] else p2
    elif prefer == "down":
        mid = p1 if p1[1] >= p2[1] else p2
    else:
        mid = p1 if p1[1] < p2[1] else p2
    return mid, end


def R(p):
    return (int(round(p[0])), int(round(p[1])))


def limb(d, a, b, width, color):
    """Segmento grosso com juntas arredondadas."""
    a, b = R(a), R(b)
    d.line([a, b], fill=color, width=width)
    r = (width - 1) / 2
    for p in (a, b):
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=color)


def poly(d, pts, color):
    d.polygon([R(p) for p in pts], fill=color)


def px(d, p, color):
    d.point(R(p), fill=color)


def mix(c1, c2, t):
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * t)) for i in range(3))


def darker(c, k=0.75):
    return tuple(int(v * k) for v in c[:3])


def lighter(c, k=0.3):
    return tuple(int(v + (255 - v) * k) for v in c[:3])


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def vec(ang_deg):
    a = math.radians(ang_deg)
    return math.cos(a), math.sin(a)


def along(origin, ang, t, s=0.0):
    c, sn = vec(ang)
    nx, ny = -sn, c
    return (origin[0] + c * t + nx * s, origin[1] + sn * t + ny * s)


def draw_canvas(w, h):
    img = new_img(w, h)
    return img, ImageDraw.Draw(img)
