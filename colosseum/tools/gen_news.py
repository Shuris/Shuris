"""Ilustrações em preto e branco do jornal (estilo gravura).

Cada cena é montada com o cenário do jogo e os personagens em destaque. Na
conversão para "tinta de jornal" o fundo fica claro, com poucas hachuras, e os
personagens ganham contraste cheio, contorno grosso e um halo de papel em volta,
para a figura nunca se perder no cenário."""
import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from pixel import new_img, hexc
from gen_v05 import Composer, _bg

PAPER = np.array([238, 226, 196], dtype=np.float32)
INK = np.array([34, 25, 18], dtype=np.float32)
S = 2           # ampliação antes das hachuras
CW, CH = 260, 160  # tamanho da cena (antes da ampliação)


def _lum(img):
    a = np.asarray(img.convert("RGB"), dtype=np.float32) / 255
    return a[..., 0] * 0.3 + a[..., 1] * 0.55 + a[..., 2] * 0.15


def _up(m):
    return np.kron(m, np.ones((S, S)))


def _hatch(big, levels):
    h, w = big.shape
    yy, xx = np.mgrid[0:h, 0:w]
    d1 = (xx + yy) % 4 == 0
    d2 = (xx - yy) % 4 == 0
    d3 = (xx + yy) % 2 == 0
    t0, t1, t2, t3 = levels
    ink = big < t0
    ink |= (big < t1) & (d3 | d1)
    ink |= (big < t2) & (d1 | d2)
    ink |= (big < t3) & d1 & (yy % 2 == 0)
    return ink


def _edges(l, mask=None):
    p = np.pad(l, 1, mode="edge")
    e = np.maximum(np.abs(p[1:-1, 2:] - l), np.abs(p[2:, 1:-1] - l))
    return e * mask if mask is not None else e


def _dilate(m, n):
    out = m.copy()
    for _ in range(n):
        g = out.copy()
        g[1:, :] |= out[:-1, :]
        g[:-1, :] |= out[1:, :]
        g[:, 1:] |= out[:, :-1]
        g[:, :-1] |= out[:, 1:]
        out = g
    return out


class Scene:
    """Cena de 640x360 (coordenadas do jogo) com fundo e figuras em camadas."""

    def __init__(self, bg):
        self.bg = bg.convert("RGBA")
        self.fig = new_img(*self.bg.size)
        self.mid = new_img(*self.bg.size)  # camada intermediária (público, objetos) sem contorno

    def put(self, sprite, x, y, scale=3, flip=False, layer="fig"):
        """Coloca um quadro do gladiador (112x88) com os pés em (x, y)."""
        s = sprite.transpose(Image.FLIP_LEFT_RIGHT) if flip else sprite
        s = s.resize((s.width * scale, s.height * scale), Image.NEAREST)
        dst = self.fig if layer == "fig" else self.mid
        dst.alpha_composite(s, (int(x - 56 * scale), int(y - 83 * scale)))

    def obj(self, img, x, y, scale=1, layer="fig"):
        """Objeto qualquer com o canto inferior central em (x, y)."""
        s = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
        dst = self.fig if layer == "fig" else self.mid
        dst.alpha_composite(s, (int(x - s.width / 2), int(y - s.height)))

    def render(self, cx, cy, zoom=1):
        """Corta a cena em volta de (cx, cy) e converte para tinta."""
        w, h = CW // zoom, CH // zoom
        box = (int(cx - w / 2), int(cy - h / 2), int(cx + w / 2), int(cy + h / 2))
        bg = self.bg.crop(box)
        mid = self.mid.crop(box)
        fig = self.fig.crop(box)
        if zoom > 1:
            bg, mid, fig = (i.resize((CW, CH), Image.NEAREST) for i in (bg, mid, fig))
        # fundo: suavizado e clareado
        lb = _lum(bg.filter(ImageFilter.BoxBlur(0.5)))
        lo, hi = np.percentile(lb, 3), np.percentile(lb, 97)
        lb = 0.45 + 0.55 * np.clip((lb - lo) / max(1e-3, hi - lo), 0, 1)
        ink = _hatch(_up(lb), (0.2, 0.52, 0.7, 0.86)) | (_up(_edges(lb)) > 0.16)
        # camada intermediária: tons médios, sem contorno
        am = np.asarray(mid)[..., 3] > 0
        if am.any():
            lm = np.clip(_lum(mid) * 0.9, 0, 1)
            big_m = _up(am).astype(bool)
            ink = np.where(big_m, _hatch(_up(lm), (0.22, 0.42, 0.62, 0.8)) | (_up(_edges(lm, am)) > 0.25), ink)
        # personagens: contraste cheio, contorno e halo
        af = np.asarray(fig)[..., 3] > 0
        if af.any():
            lf = np.clip((_lum(fig) - 0.1) / 0.75, 0, 1) ** 1.2
            big_a = _up(af).astype(bool)
            fink = _hatch(_up(lf), (0.16, 0.36, 0.56, 0.78)) | (_up(_edges(lf, af)) > 0.2)
            ink = np.where(big_a, fink, ink)
            g1 = _dilate(big_a, 2)
            g2 = _dilate(big_a, 5)
            ink[g2 & ~g1] = False
            ink[g1 & ~big_a] = True
        out = np.where(ink[..., None], INK, PAPER).astype(np.uint8)
        img = Image.fromarray(out)
        ImageDraw.Draw(img).rectangle([0, 0, img.width - 1, img.height - 1], outline=tuple(int(v) for v in INK))
        return img


def _person(comp, frame=("idle", 0), skin=1, hair=0, robe=False, flip=False):
    return comp.frame(frame[0], frame[1], skin=skin, gear=(None, None, None, None, None), hair=hair, extra=["robe" if robe else "tunic"])


def _colosseum_exterior():
    """O anfiteatro visto de fora: três andares de arcos e o ático."""
    img = Image.new("RGBA", (640, 360), (214, 222, 228, 255))
    d = ImageDraw.Draw(img)
    for y in range(0, 200):
        k = y / 200
        d.line([(0, y), (640, y)], fill=(int(170 + 60 * k), int(190 + 40 * k), int(210 + 25 * k), 255))
    stone, shade, dark = hexc("d8c8a4"), hexc("b8a47e"), hexc("4a3a2a")
    base_y, top_y = 300, 110
    d.rectangle([60, top_y, 580, base_y], fill=stone)
    tiers = [(top_y + 28, top_y + 92), (top_y + 102, top_y + 160), (top_y + 168, base_y - 6)]
    d.rectangle([60, top_y, 580, top_y + 22], fill=shade)  # ático
    for x in range(74, 570, 26):
        d.rectangle([x, top_y + 8, x + 6, top_y + 14], fill=dark)
    for (t0, t1) in tiers:
        d.rectangle([60, t0 - 6, 580, t0 - 2], fill=shade)
        for x in range(70, 572, 26):
            d.rectangle([x, t0 + 12, x + 16, t1], fill=dark)
            d.ellipse([x, t0 + 4, x + 16, t0 + 20], fill=dark)
            d.rectangle([x - 5, t0, x - 2, t1], fill=shade)
    d.rectangle([0, base_y, 640, 360], fill=hexc("c8b48a"))
    for x in range(20, 620, 22):
        d.rectangle([x, base_y + 22, x + 3, base_y + 30], fill=dark)
        d.ellipse([x - 2, base_y + 16, x + 5, base_y + 22], fill=dark)
    return img


def news_images(assets_dir, out_dir):
    bgd = os.path.join(assets_dir, "backgrounds")
    fx = os.path.join(assets_dir, "sprites", "fx")
    comp = Composer(os.path.join(assets_dir, "sprites", "gladiator"))
    bg = lambda name: _bg(os.path.join(bgd, name))
    crowd = lambda name, f: Image.open(os.path.join(bgd, name)).convert("RGBA").crop((640 * f, 0, 640 * (f + 1), 360))
    sprite = lambda name, box=None: (lambda im: im.crop(box) if box else im)(Image.open(os.path.join(fx, name)).convert("RGBA"))
    hero = dict(skin=1, gear=("galea", "scutum", "gladius", "medium", "bronze"))
    pics = {}

    def arena(fest=False, frame=3):
        s = Scene(bg("arena_rome.png"))
        s.mid.alpha_composite(crowd("crowdfest_rome.png" if fest else "crowd_rome.png", frame))
        if fest:
            s.mid.alpha_composite(Image.open(os.path.join(fx, "festival.png")).convert("RGBA"))
        return s

    # vitória: o vencedor ergue a espada diante do público de pé
    s = arena()
    s.put(comp.frame("victory", 1, **hero), 320, 330, scale=2)
    pics["victory"] = s.render(320, 262)
    # derrota: de joelhos diante do rival
    s = arena(frame=1)
    s.put(comp.frame("defeat", 3, skin=0, gear=(None, "parmula", "rudis", None, None), hair=1), 296, 330, scale=2)
    s.put(comp.frame("victory", 0, skin=2, gear=("murmillo", "scutum", "gladius", "heavy", "bronze")), 356, 330, scale=2, flip=True)
    pics["defeat"] = s.render(326, 262)
    # público: arquibancada de pé (close)
    s = arena(frame=4)
    pics["crowd"] = s.render(170, 150, zoom=2)
    # o anfiteatro visto de fora
    ext = _colosseum_exterior().resize((284, 160), Image.NEAREST)
    canvas = Image.new("RGBA", (640, 360), ext.getpixel((2, 2)))
    canvas.alpha_composite(ext, (178, 100))
    s = Scene(canvas)
    pics["colosseum"] = s.render(320, 180)
    # estreia: o novato com a rúdis no ludus
    s = Scene(bg("ludus.png"))
    s.put(comp.frame("idle", 0, skin=1, gear=(None, None, "rudis", None, None), hair=0), 306, 318, scale=2)
    s.put(_person(comp, skin=2, hair=2, robe=True), 370, 314, flip=True, scale=2, layer="mid")
    pics["newcomer"] = s.render(334, 252)
    # treino no palus (poste na mesma escala do gladiador)
    s = Scene(bg("ludus.png"))
    s.obj(sprite("palus.png", (0, 0, 24, 56)), 356, 318, scale=2, layer="mid")
    s.put(comp.frame("attack", 2, skin=1, gear=(None, "parmula", "gladius", "light", None), hair=2), 318, 318, scale=2)
    pics["training"] = s.render(334, 252)
    # o rival: retrato em close
    s = Scene(Image.new("RGBA", (640, 360), (120, 110, 96, 255)))
    pr = Image.open(os.path.join(assets_dir, "portraits", "brutus.png")).convert("RGBA")
    s.obj(pr, 320, 260, scale=3)
    pics["rival"] = s.render(320, 188)
    # estátua no fórum
    forum = bg("loc_forum.png")
    s = Scene(forum)
    statue = comp.frame("victory", 1, skin=0, gear=("galea", "scutum", "gladius", "heavy", "bronze"))
    a = np.asarray(statue.convert("LA").convert("RGBA")).astype(np.float32)
    a[..., :3] = a[..., :3] * 0.45 + 125
    statue = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    pedestal = Image.new("RGBA", (60, 44), (205, 198, 182, 255))
    ImageDraw.Draw(pedestal).rectangle([0, 0, 59, 6], fill=(180, 172, 156, 255))
    s.obj(pedestal, 320, 318, layer="mid")
    s.put(statue, 320, 276, scale=2)
    s.put(_person(comp, skin=0, hair=1), 250, 318, scale=2, layer="mid")
    s.put(_person(comp, skin=2, robe=True), 392, 318, scale=2, flip=True, layer="mid")
    pics["statue"] = s.render(320, 226)
    # fórum com gente
    s = Scene(forum)
    for x, sk, rb, f in ((150, 0, True, False), (230, 1, False, True), (300, 2, True, False), (420, 1, False, True), (480, 0, True, True)):
        s.put(_person(comp, skin=sk, hair=sk, robe=rb), x, 318, scale=2, flip=f, layer="mid")
    pics["forum"] = s.render(320, 230)
    # chuva sobre a cidade (gente apressada)
    s = Scene(forum)
    s.put(_person(comp, ("walk", 2), skin=1, robe=True), 280, 318, scale=2, layer="mid")
    s.put(_person(comp, ("walk", 4), skin=0), 380, 318, scale=2, flip=True, layer="mid")
    rain = s.render(320, 230)
    rd = ImageDraw.Draw(rain)
    for i in range(170):
        x, y = (i * 47) % rain.width, (i * 71) % rain.height
        rd.line([(x, y), (x - 3, y + 11)], fill=tuple(int(v) for v in INK))
    pics["rain"] = rain
    # mercado com vendedores e fregueses
    market = bg("loc_market.png")
    s = Scene(market)
    for x, sk, rb, f, fr in ((228, 0, True, False, ("idle", 0)), (300, 1, False, True, ("walk", 1)), (404, 2, True, True, ("idle", 0)), (350, 0, False, False, ("walk", 3))):
        s.put(_person(comp, fr, skin=sk, hair=sk, robe=rb), x, 312, scale=2, flip=f, layer="mid")
    pics["market"] = s.render(320, 236)
    # mercador viajante com a carroça
    s = Scene(market)
    s.obj(sprite("merchant_cart.png"), 280, 318, scale=2, layer="mid")
    s.put(_person(comp, skin=2, hair=2, robe=True), 370, 316, scale=2, flip=True)
    pics["merchant"] = s.render(320, 240)
    # termas
    s = Scene(bg("loc_baths.png"))
    s.put(_person(comp, skin=0, hair=1, robe=True), 268, 262, scale=2, layer="mid")
    s.put(_person(comp, skin=1), 398, 262, scale=2, flip=True, layer="mid")
    pics["baths"] = s.render(330, 236)
    # templo de Marte com o monge
    s = Scene(bg("loc_temple.png"))
    monk = sprite("monk.png", (0, 0, 48, 44))
    s.obj(monk, 360, 318, scale=2)
    pics["temple"] = s.render(340, 250)
    # taverna cheia
    tav = bg("loc_tavern.png")
    s = Scene(tav)
    for x, sk, f in ((230, 0, False), (290, 2, True), (420, 1, True)):
        s.put(_person(comp, skin=sk, hair=sk), x, 312, scale=2, flip=f, layer="mid")
    pics["tavern"] = s.render(330, 236)
    # queda de braço (close na mesa)
    s = Scene(tav)
    a1 = comp.frame("block", 0, skin=1, gear=(None, None, None, None, None), hair=0)
    a2 = comp.frame("block", 0, skin=0, gear=(None, None, None, None, None), hair=1)
    s.put(a1, 306, 326, scale=2)
    s.put(a2, 350, 326, scale=2, flip=True)
    s.obj(sprite("arm_table.png"), 328, 336, scale=2)
    pics["armwrestle"] = s.render(328, 262)
    # festival: arena enfeitada e lotada
    s = arena(fest=True, frame=3)
    s.put(comp.frame("victory", 1, **hero), 320, 330, scale=2)
    pics["festival"] = s.render(320, 250)
    # torneio: o campeão com a coroa de louros
    s = arena(frame=4)
    s.put(comp.frame("victory", 1, skin=2, gear=("galea", "parma", "sica", "light", "bronze")), 320, 330, scale=2)
    pics["tournament"] = s.render(320, 262)
    # navio no porto e teatro (desenhos próprios)
    ship = Image.new("RGBA", (640, 360), (200, 214, 226, 255))
    sd = ImageDraw.Draw(ship)
    sd.rectangle([0, 240, 640, 360], fill=(70, 110, 150, 255))
    for y in range(246, 360, 8):
        sd.line([(0, y), (640, y)], fill=(110, 150, 190, 255))
    sd.polygon([(200, 230), (440, 230), (414, 262), (226, 262)], fill=(100, 64, 36, 255))
    sd.line([(320, 120), (320, 230)], fill=(60, 40, 24, 255), width=4)
    sd.polygon([(270, 130), (370, 130), (362, 206), (278, 206)], fill=(176, 150, 118, 255))
    for x in range(282, 362, 14):
        sd.line([(x, 132), (x, 204)], fill=(150, 126, 100, 255))
    for x in range(232, 412, 16):
        sd.line([(x, 258), (x - 8, 278)], fill=(60, 40, 24, 255), width=2)
    sd.polygon([(434, 230), (462, 204), (450, 234)], fill=(100, 64, 36, 255))
    s = Scene(ship)
    pics["ship"] = s.render(320, 196)
    th = Image.new("RGBA", (640, 360), (210, 216, 222, 255))
    td = ImageDraw.Draw(th)
    for k in range(7):
        r = 230 - k * 22
        td.pieslice([320 - r, 300 - r * 0.55, 320 + r, 300 + r * 0.55], 180, 360, fill=(200 - k * 9, 190 - k * 9, 170 - k * 9, 255), outline=(110, 100, 86, 255))
    td.rectangle([180, 270, 460, 330], fill=(150, 120, 84, 255))
    for x in range(190, 460, 30):
        td.rectangle([x, 232, x + 7, 270], fill=(230, 224, 210, 255))
    s = Scene(th)
    s.put(comp.frame("victory", 0, skin=1, gear=(None, None, None, None, None), hair=1, extra=["robe"]), 290, 300, scale=2)
    s.put(comp.frame("victory", 2, skin=0, gear=(None, None, None, None, None), hair=0, extra=["tunic"]), 350, 300, scale=2, flip=True)
    pics["theater"] = s.render(320, 236)

    os.makedirs(out_dir, exist_ok=True)
    for name, pic in pics.items():
        pic.save(os.path.join(out_dir, f"{name}.png"))
    return list(pics)
