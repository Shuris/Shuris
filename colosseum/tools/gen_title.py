"""Arte do menu principal (960x540): pôr do sol sobre a areia, o Coliseu ao longe,
um gladiador em guarda com a espada erguida no centro-esquerda e, em primeiro plano
no canto inferior direito, o ombro e o elmo de um adversário em silhueta.

Pintura em pixel art: degradês em faixas com retícula (Bayer), nuvens com luz do sol
por trás, sombras longas na areia. O título, os botões e a versão são HTML por cima
(a parte esquerda e o alto da imagem ficam mais calmos para eles)."""
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from gen_v05 import Composer

W, H = 960, 540
HORIZON = 318
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32) / 16.0


def _c(h):
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def banded(t, stops, xx, yy, levels=10):
    """Degradê em faixas (pixel art): t em 0..1, quantizado com retícula."""
    th = BAYER[yy % 4, xx % 4]
    q = np.clip(np.floor(t * levels + (th - 0.5) * 0.9) / levels, 0, 1)
    pos = np.array([p for p, _ in stops], dtype=np.float32)
    cols = np.stack([_c(c) for _, c in stops])
    out = np.zeros(q.shape + (3,), dtype=np.float32)
    for ch in range(3):
        out[..., ch] = np.interp(q, pos, cols[:, ch])
    return out


def sky_and_ground():
    yy, xx = np.mgrid[0:H, 0:W]
    img = np.zeros((H, W, 3), dtype=np.float32)
    # céu: castanho alaranjado no alto, dourado perto do horizonte, mais claro em volta do sol
    sun = (300, 214)
    d = np.hypot((xx - sun[0]) / 1.4, yy - sun[1])
    t = np.clip(yy / HORIZON, 0, 1) * 0.75 + np.clip(1 - d / 420, 0, 1) * 0.4
    sky = banded(np.clip(t, 0, 1), [(0, "6e2e18"), (0.35, "b4501e"), (0.6, "e07a2a"), (0.82, "f4b040"), (1, "fde08a")], xx, yy, 12)
    # areia: dourada perto do horizonte (luz do sol), mais funda e avermelhada na frente
    g = np.clip((yy - HORIZON) / (H - HORIZON), 0, 1)
    glow = np.clip(1 - np.hypot((xx - sun[0]) / 2.2, (yy - HORIZON) * 1.4) / 380, 0, 1)
    ground = banded(np.clip(1 - g * 0.85 + glow * 0.35, 0, 1), [(0, "8a3a1c"), (0.35, "b4562a"), (0.65, "d47a38"), (0.9, "eca04c"), (1, "f8c46a")], xx, yy, 11)
    img[:] = np.where((yy < HORIZON)[..., None], sky, ground)
    # dunas ao longe: faixas onduladas mais claras e mais escuras (vento na areia)
    for k in range(7):
        base = HORIZON + 6 + k * (8 + k * 4)
        amp = 3 + k * 2.2
        wave = base + np.sin(xx / (60 + k * 22) + k * 1.7) * amp
        band = (yy > wave) & (yy < wave + 2 + k * 0.6)
        lit = np.sin(xx / (40 + k * 13) + k) > 0.1
        img[band & lit] = img[band & lit] * 1.12 + 6
        img[band & ~lit] = img[band & ~lit] * 0.86
    return np.clip(img, 0, 255)


def sun_disc(img):
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.hypot(xx - 300, yy - 214)
    for r, col, a in ((120, (255, 214, 120), 0.18), (86, (255, 226, 150), 0.28), (62, (255, 240, 190), 0.55)):
        m = d < r
        img[m] = img[m] * (1 - a) + np.array(col) * a
    m = d < 46
    img[m] = (255, 250, 228)
    return img


def clouds(img, rng):
    """Bancos de cúmulos à direita (base reta, topo em couve-flor) e faixas finas de
    estratos no alto; a borda virada para o sol fica acesa."""
    yy, xx = np.mgrid[0:H, 0:W]
    shade = np.full((H, W), -1.0, dtype=np.float32)

    def blob(x, y, r, base):
        inside = (((xx - x) / r) ** 2 + ((yy - y) / (r * 0.85)) ** 2 < 1) & (yy < base)
        val = 0.5 - ((xx - x) / r) * 0.45 - ((yy - y) / r) * 0.35
        np.copyto(shade, np.maximum(shade, np.clip(val + 0.25, 0, 1)), where=inside)

    for cx, cy, wid, hgt in ((660, 214, 300, 70), (860, 178, 200, 60), (520, 268, 150, 34), (930, 262, 120, 40)):
        base = cy + hgt * 0.45
        for _ in range(int(wid / 4)):
            x = cx + rng.uniform(-wid / 2, wid / 2)
            edge = 1 - abs(x - cx) / (wid / 2)
            r = rng.uniform(8, 16) + edge * 18
            y = base - r * 0.4 - rng.uniform(0, hgt * edge)
            blob(x, y, r, base)
    # estratos: faixas finas e compridas no alto do céu
    for (x, y, w, h) in ((60, 64, 260, 7), (180, 88, 200, 5), (520, 52, 300, 6), (700, 80, 240, 5), (40, 118, 160, 4)):
        inside = (((xx - x - w / 2) / (w / 2)) ** 2 + ((yy - y) / h) ** 2 < 1)
        np.copyto(shade, np.maximum(shade, 0.55 - (yy - y) / h * 0.3), where=inside)
    m = shade >= 0
    col = banded(np.clip(shade, 0, 1), [(0, "8e4028"), (0.4, "be6434"), (0.7, "e89650"), (1, "fcd08a")], xx, yy, 5)
    img[m] = col[m]
    # contraluz: contorno dourado do lado do sol (esquerda)
    edge = m & ~np.roll(m, 1, axis=1)
    img[edge] = (255, 222, 150)
    top = m & ~np.roll(m, 1, axis=0)
    img[top] = img[top] * 0.4 + np.array((255, 214, 140)) * 0.6
    return img


def colosseum(img):
    """Silhueta do Coliseu ao longe (à esquerda, no horizonte), apagada pela névoa dourada."""
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    x0, x1, top = 30, 300, HORIZON - 64
    col = (196, 104, 52, 255)
    d.rectangle([x0, top + 10, x1, HORIZON], fill=col)
    d.polygon([(x0, top + 10), (x0 + 12, top), (x1 - 40, top - 6), (x1, top + 4), (x1, top + 10)], fill=col)
    dark = (176, 88, 44, 255)
    for row, (y, h, step) in enumerate(((top + 14, 12, 14), (top + 32, 13, 14), (top + 50, 12, 14))):
        for x in range(x0 + 6, x1 - 8, step):
            d.rectangle([x, y + 3, x + 7, y + h], fill=dark)
            d.ellipse([x, y, x + 7, y + 7], fill=dark)
    a = np.asarray(lay).astype(np.float32)
    m = a[..., 3] > 0
    img[m] = img[m] * 0.35 + a[m][:, :3] * 0.65
    return img


def warm(sprite):
    """Luz do entardecer no personagem: tudo mais quente, branco vira dourado, e uma
    borda acesa do lado do sol (esquerda)."""
    a = np.asarray(sprite).astype(np.float32)
    a[..., 0] = a[..., 0] * 1.0 + 8
    a[..., 1] *= 0.8
    a[..., 2] *= 0.6
    al = a[..., 3] > 0
    rim = al & ~np.roll(al, 2, axis=1)
    a[rim, :3] = a[rim, :3] * 0.4 + np.array((255, 210, 130)) * 0.6
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def place(canvas, sprite, x, y, scale):
    s = sprite.resize((sprite.width * scale, sprite.height * scale), Image.NEAREST)
    canvas.alpha_composite(s, (int(x), int(y)))
    return s


def long_shadow(canvas, sprite, foot_x, foot_y, scale):
    """Sombra comprida na areia, esticada para trás e para a direita (sol baixo à esquerda)."""
    s = sprite.resize((sprite.width * scale, sprite.height * scale), Image.NEAREST)
    a = np.asarray(s)[..., 3] > 0
    ys, xs = np.nonzero(a)
    if not len(ys):
        return
    bottom = ys.max()
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = sh.load()
    for y, x in zip(ys, xs):
        k = (bottom - y)  # altura acima dos pés
        nx = int(foot_x + (x - s.width / 2) + k * 0.9)
        ny = int(foot_y + k * 0.32)
        if 0 <= nx < W and 0 <= ny < H:
            px[nx, ny] = (92, 34, 16, 120)
    sh = sh.filter(ImageFilter.MaxFilter(3))
    canvas.alpha_composite(sh)


def build(assets_dir):
    rng = random.Random(7)
    img = sky_and_ground()
    img = sun_disc(img)
    img = colosseum(img)
    img = clouds(img, rng)
    canvas = Image.fromarray(img.astype(np.uint8)).convert("RGBA")
    comp = Composer(os.path.join(assets_dir, "sprites", "gladiator"))
    # gladiador em guarda, espada erguida (quadro de preparação do golpe)
    hero = comp.frame("attack", 0, skin=1, gear=("galea", None, "gladius", "light", "bronze"), full=True, cloth_tint=(150, 82, 46))
    hero = warm(hero)
    hs = 3
    hx, hy = 110, -36
    foot_x, foot_y = hx + 112 * hs, hy + 166 * hs
    long_shadow(canvas, hero, foot_x, foot_y, hs)
    place(canvas, hero, hx, hy, hs)
    # adversário em primeiro plano, em silhueta contra a luz (cortado pela borda da tela)
    rival = comp.frame("block", 0, skin=0, gear=("secutor", "scutum", "gladius", "heavy", "iron"), full=True, cloth_tint=(90, 60, 40)).transpose(Image.FLIP_LEFT_RIGHT)
    big = rival.resize((rival.width * 5, rival.height * 5), Image.NEAREST)
    a = np.asarray(big).astype(np.float32)
    lum = a[..., :3].mean(axis=2, keepdims=True)
    a[..., :3] = a[..., :3] * 0.28 + lum * 0.1 + np.array([30, 14, 8])
    # contraluz: borda esquerda/de cima acesa pelo sol
    alpha = a[..., 3] > 0
    rim = alpha & ~np.roll(alpha, 3, axis=1)
    a[rim, :3] = (240, 160, 80)
    big = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    canvas.alpha_composite(big, (W - big.width + 400, H - big.height + 350))
    # poeira dourada no ar
    d = ImageDraw.Draw(canvas)
    for i in range(140):
        x = rng.randint(0, W - 1)
        y = rng.randint(120, H - 1)
        c = (255, 220, 150, rng.randint(90, 200))
        d.point((x, y), fill=c)
        if rng.random() < 0.2:
            d.point((x + 1, y), fill=c)
    # vinheta suave nas bordas (o lado esquerdo um pouco mais escuro para os botões)
    a = np.asarray(canvas).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W]
    v = np.clip(1.12 - np.hypot((xx - 520) / 700, (yy - 280) / 420), 0.55, 1)
    v *= np.clip(0.78 + xx / W * 0.6, 0.78, 1)
    v = np.maximum(v, np.clip(1 - np.hypot(xx - 300, yy - 214) / 90, 0, 1))
    a[..., :3] *= v[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    assets = os.path.join(here, "..", "src", "renderer", "public", "assets")
    build(assets).save(os.path.join(assets, "ui", "title.png"))
