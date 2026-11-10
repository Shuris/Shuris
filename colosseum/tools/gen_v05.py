"""Arte da versão 0.5: taverna, camas e equipamentos comprados, ícones das
melhorias e as ilustrações em preto e branco do jornal Cápua Times."""
import json
import math
import os
import numpy as np
from PIL import Image, ImageDraw
from pixel import new_img, finish, darker, lighter, hexc
from gen_scenes import W, H, fill_rect, gradient, noise, to_img

WOOD = hexc("7a5230")
WOOD_D = hexc("5a3a20")
WOOD_L = hexc("9a6a3e")
GOLD = hexc("d8b04a")
TERRA = hexc("b0563a")
STONE = hexc("9a9488")
IRON = hexc("8c909c")


# ------------------------------------------------------------------ taverna
def tavern(rng):
    """Interior da Taverna do Javali (o balcão fica numa camada à frente da taverneira)."""
    a = np.zeros((H, W, 4), dtype=np.int32)
    # parede de pedra embaixo, reboco em cima, vigas de madeira
    fill_rect(a, 0, 0, W, 250, hexc("cdb894"))
    noise(a, 0, 250, [hexc("c4ae88"), hexc("d6c29e")], 0.14, rng)
    for y in range(176, 250, 12):  # pedras
        off = 0 if (y // 12) % 2 else 14
        fill_rect(a, 0, y, W, y + 1, hexc("8a7458"))
        for x in range(off, W, 28):
            fill_rect(a, x, y, x + 1, y + 12, hexc("8a7458"))
    fill_rect(a, 0, 174, W, 177, hexc("5a4030"))
    for x in range(0, W, 96):  # vigas verticais
        fill_rect(a, x + 40, 0, x + 50, 250, WOOD_D)
        fill_rect(a, x + 41, 0, x + 43, 250, WOOD)
    fill_rect(a, 0, 120, W, 128, WOOD_D)  # viga horizontal
    fill_rect(a, 0, 120, W, 122, WOOD)
    # piso de lajotas de barro
    gradient(a, 250, H, hexc("9a5a3a"), hexc("a8664a"))
    for y in range(250, H, 10):
        off = 0 if (y // 10) % 2 else 10
        fill_rect(a, 0, y, W, y + 1, hexc("6e3a24"))
        for x in range(off, W, 20):
            fill_rect(a, x, y, x + 1, y + 10, hexc("6e3a24"))
    noise(a, 250, H, [hexc("8e5034"), hexc("b0704e")], 0.06, rng)
    for y in range(250, 260):
        a[y, :, :3] = (a[y, :, :3] * (0.7 + 0.03 * (y - 250))).astype(np.int32)
    img = to_img(np.clip(a, 0, 255))
    d = ImageDraw.Draw(img)
    # placa com o javali pintado
    d.rectangle([286, 132, 354, 166], fill=WOOD_D)
    d.rectangle([289, 135, 351, 163], fill=hexc("e2cc98"))
    d.ellipse([302, 141, 336, 159], fill=hexc("4a3020"))  # corpo
    d.ellipse([328, 143, 342, 155], fill=hexc("4a3020"))  # cabeça
    d.polygon([(341, 150), (346, 152), (341, 153)], fill=hexc("e8e0d0"))  # presa
    for x in (306, 314, 324, 330):
        d.rectangle([x, 157, x + 2, 161], fill=hexc("4a3020"))
    d.point((337, 147), fill=hexc("c83a2a"))
    # lareira com caldeirão (à esquerda)
    d.rectangle([118, 186, 186, 252], fill=hexc("7a6a5a"))
    d.rectangle([126, 206, 178, 252], fill=hexc("2a1c14"))
    d.rectangle([114, 180, 190, 188], fill=hexc("6a5a4a"))
    for i, col in enumerate((hexc("f0a030"), hexc("e05a20"), hexc("f8d070"))):
        d.polygon([(136 + i * 10, 250), (142 + i * 10, 232 - i * 3), (148 + i * 10, 250)], fill=col)
    d.ellipse([138, 222, 168, 242], fill=hexc("3a3a40"))
    d.line([(152, 206), (152, 222)], fill=hexc("3a3a40"), width=2)
    # prateleiras com ânforas e jarras atrás do balcão
    for y in (150, 186):
        d.rectangle([372, y, 486, y + 3], fill=WOOD)
        for k, x in enumerate(range(378, 482, 13)):
            col = (hexc("b0603a"), hexc("c8b48a"), hexc("8a5a32"))[k % 3]
            d.ellipse([x, y - 14, x + 9, y], fill=col)
            d.rectangle([x + 3, y - 18, x + 6, y - 13], fill=col)
    # barris de vinho
    for bx in (500, 532):
        d.ellipse([bx, 214, bx + 28, 252], fill=WOOD)
        for yy in (220, 233, 246):
            d.line([(bx + 2, yy), (bx + 26, yy)], fill=hexc("4a3a30"), width=2)
        d.ellipse([bx + 11, 230, bx + 17, 236], fill=WOOD_D)
    # mesas e banquinhos (esquerda e centro)
    for tx in (196, 268):
        d.rectangle([tx, 284, tx + 40, 288], fill=WOOD_L)
        d.rectangle([tx + 3, 288, tx + 6, 304], fill=WOOD_D)
        d.rectangle([tx + 34, 288, tx + 37, 304], fill=WOOD_D)
        d.rectangle([tx + 8, 279, tx + 13, 284], fill=hexc("8a8a9a"))  # caneca
        d.ellipse([tx + 18, 280, tx + 30, 285], fill=hexc("c8903a"))  # pão
        d.rectangle([tx - 12, 294, tx - 2, 297], fill=WOOD)
        d.line([(tx - 10, 297), (tx - 10, 306)], fill=WOOD_D, width=2)
        d.line([(tx - 4, 297), (tx - 4, 306)], fill=WOOD_D, width=2)
    # lamparinas penduradas
    for lx in (262, 430):
        d.line([(lx, 128), (lx, 226)], fill=hexc("3a2a20"))
        d.ellipse([lx - 6, 226, lx + 6, 234], fill=hexc("c08a3e"))
        d.rectangle([lx + 5, 227, lx + 8, 230], fill=hexc("c08a3e"))
    # cachos de alho e presunto pendurados na viga
    for hx in (80, 586, 610):
        d.line([(hx, 128), (hx, 140)], fill=hexc("3a2a20"))
        d.ellipse([hx - 5, 140, hx + 5, 156], fill=hexc("a85a40"))
    return img


def tavern_front():
    """Frente do balcão (camada acima da taverneira, que fica atrás dele)."""
    img = new_img(W, H)
    d = ImageDraw.Draw(img)
    x0, x1, top = 360, 482, 274
    d.rectangle([x0, top, x1, 306], fill=WOOD)
    d.rectangle([x0 - 3, top - 4, x1 + 3, top], fill=WOOD_L)
    for x in range(x0 + 6, x1, 20):  # painéis
        d.rectangle([x, top + 6, x + 14, 302], fill=darker(WOOD, 0.85))
    d.rectangle([x0, 304, x1, 308], fill=WOOD_D)
    # jarras, canecas e uma tigela sobre o balcão
    d.ellipse([368, top - 13, 378, top - 3], fill=hexc("b0603a"))
    d.rectangle([371, top - 16, 375, top - 12], fill=hexc("b0603a"))
    for x in (440, 448):
        d.rectangle([x, top - 8, x + 5, top - 3], fill=hexc("8a8a9a"))
    d.ellipse([456, top - 7, 472, top - 2], fill=hexc("c8b48a"))
    return finish(img, light=0.15)


# ------------------------------------------------------------------ alojamento: camas melhores
def bed_overlay(kind):
    """Cama nova desenhada sobre a cama de palha do alojamento (x 392–446)."""
    img = new_img(W, H)
    d = ImageDraw.Draw(img)
    # apaga a cama antiga com a cor do piso por trás (a camada cobre a área inteira)
    if kind == "wool":
        frame, legs = hexc("8a5a32"), hexc("6a4628")
        d.rectangle([389, 290, 449, 297], fill=frame)
        d.rectangle([389, 282, 393, 307], fill=legs)
        d.rectangle([445, 285, 449, 307], fill=legs)
        d.rectangle([393, 281, 445, 291], fill=hexc("efe2c0"))  # colchão de lã alto
        d.rectangle([410, 279, 445, 291], fill=hexc("4a6aa8"))  # cobertor de lã
        for x in range(412, 445, 5):
            d.line([(x, 279), (x, 291)], fill=hexc("6a8ac8"))
        d.line([(410, 285), (445, 285)], fill=hexc("e8dcc0"))
        d.ellipse([394, 276, 409, 285], fill=hexc("f6eedc"))
        return finish(img, light=0.18)
    # leito de nobre: madeira escura entalhada, cabeceira alta, almofadas
    frame = hexc("4a2c1a")
    d.rectangle([386, 262, 394, 307], fill=frame)  # cabeceira
    d.ellipse([384, 256, 396, 266], fill=frame)
    d.rectangle([447, 276, 452, 307], fill=frame)
    d.rectangle([386, 290, 452, 298], fill=frame)
    for x in range(398, 446, 8):
        d.rectangle([x, 294, x + 3, 296], fill=GOLD)
    d.rectangle([394, 279, 447, 291], fill=hexc("f2e8d2"))
    d.rectangle([414, 277, 447, 291], fill=hexc("7a2a5a"))  # colcha púrpura
    d.line([(414, 283), (447, 283)], fill=GOLD)
    d.ellipse([395, 272, 410, 283], fill=hexc("c8483a"))
    d.ellipse([401, 275, 416, 285], fill=hexc("e8c860"))
    d.rectangle([389, 268, 391, 288], fill=GOLD)
    img = finish(img, light=0.2)
    d = ImageDraw.Draw(img)
    d.point((390, 260), fill=lighter(GOLD, 0.5))
    return img


# ------------------------------------------------------------------ ludus: equipamentos comprados
def palus_iron_sheet():
    from gen_scenes import palus_sheet
    sheet = palus_sheet()
    d = ImageDraw.Draw(sheet)
    for f in range(2):
        off = f * 24 + (1 if f == 1 else 0)
        for y in (12, 37, 46):
            d.rectangle([off + 8, y, off + 16, y + 2], fill=IRON)
            d.point((off + 9, y), fill=lighter(IRON, 0.5))
        d.rectangle([off + 8, 18, off + 16, 34], fill=hexc("6a4a2a"))  # couro no lugar da palha
        for y in range(20, 34, 4):
            d.point((off + 12, y), fill=GOLD)
    return sheet


def up_weights():
    img = new_img(40, 26)
    d = ImageDraw.Draw(img)
    d.rectangle([2, 8, 37, 10], fill=WOOD)
    d.rectangle([3, 10, 5, 25], fill=WOOD_D)
    d.rectangle([34, 10, 36, 25], fill=WOOD_D)
    for x in (8, 18, 28):  # halteres no suporte
        d.rectangle([x, 4, x + 5, 5], fill=WOOD_D)
        d.ellipse([x - 2, 1, x + 2, 8], fill=STONE)
        d.ellipse([x + 4, 1, x + 8, 8], fill=STONE)
    for k, x in enumerate((9, 20)):  # discos de pedra no chão
        d.ellipse([x, 17 - k, x + 10, 25], fill=darker(STONE, 0.9))
        d.ellipse([x + 4, 20 - k, x + 6, 22 - k], fill=hexc("5a5048"))
    return finish(img, light=0.25)


def up_stakes():
    img = new_img(64, 30)
    d = ImageDraw.Draw(img)
    for k, x in enumerate(range(4, 62, 12)):
        h = 14 + (k % 2) * 8
        d.rectangle([x, 29 - h, x + 3, 29], fill=WOOD if k % 2 else WOOD_L)
        d.polygon([(x, 29 - h), (x + 1.5, 26 - h), (x + 3, 29 - h)], fill=WOOD_D)
    d.line([(5, 16), (17, 10), (29, 16), (41, 10), (53, 16)], fill=hexc("c8b07a"))
    return finish(img, light=0.25)


def up_track():
    img = new_img(240, 14)
    d = ImageDraw.Draw(img)
    for x in range(2, 240, 34):
        d.rectangle([x, 2, x + 2, 13], fill=WOOD)
        d.rectangle([x - 1, 1, x + 3, 3], fill=hexc("c83a2a") if (x // 34) % 2 else GOLD)
    d.line([(2, 5), (238, 5)], fill=hexc("d8c08a"))
    d.line([(2, 9), (238, 9)], fill=hexc("c8b07a"))
    return finish(img, light=0.2)


# ------------------------------------------------------------------ ícones das melhorias (16x16)
def _ic():
    img = new_img(16, 16)
    return img, ImageDraw.Draw(img)


def ic_bed(noble=False):
    img, d = _ic()
    frame = hexc("4a2c1a") if noble else hexc("8a5a32")
    d.rectangle([1, 9, 14, 11], fill=frame)
    d.rectangle([1, 5 if noble else 7, 2, 14], fill=frame)
    d.rectangle([13, 8, 14, 14], fill=frame)
    d.rectangle([3, 7, 13, 9], fill=hexc("efe2c0"))
    d.rectangle([7, 6, 13, 9], fill=hexc("7a2a5a") if noble else hexc("4a6aa8"))
    d.ellipse([3, 5, 7, 8], fill=hexc("e8c860") if noble else hexc("f6eedc"))
    return finish(img, light=0.25)


def ic_weights():
    img, d = _ic()
    d.rectangle([5, 7, 10, 8], fill=WOOD)
    d.ellipse([0, 3, 6, 12], fill=STONE)
    d.ellipse([9, 3, 15, 12], fill=STONE)
    d.point((2, 5), fill=lighter(STONE, 0.5))
    return finish(img)


def ic_track():
    img, d = _ic()
    d.rectangle([2, 3, 3, 14], fill=WOOD)
    d.polygon([(4, 3), (12, 5), (4, 8)], fill=hexc("c83a2a"))
    d.line([(1, 13), (15, 13)], fill=hexc("d8c08a"))
    d.line([(1, 11), (15, 11)], fill=hexc("c8b07a"))
    return finish(img)


def ic_stakes():
    img, d = _ic()
    for k, x in enumerate((2, 7, 12)):
        h = 8 + (k % 2) * 4
        d.rectangle([x, 15 - h, x + 2, 15], fill=WOOD if k % 2 else WOOD_L)
    return finish(img)


def ic_palus():
    img, d = _ic()
    d.rectangle([6, 1, 10, 15], fill=WOOD)
    for y in (3, 8, 12):
        d.rectangle([5, y, 11, y + 1], fill=IRON)
    return finish(img)


def ic_doctore():
    img, d = _ic()
    d.line([(3, 14), (12, 2)], fill=hexc("8a5a32"), width=2)  # vara do instrutor (vitis)
    d.ellipse([9, 1, 14, 6], fill=hexc("8a5a32"))
    d.arc([1, 4, 11, 15], 100, 260, fill=hexc("5a8a3a"), width=2)  # louro
    return finish(img)


UPGRADE_ICONS = {
    "up_bed": lambda: ic_bed(False), "up_bed2": lambda: ic_bed(True), "up_weights": ic_weights,
    "up_track": ic_track, "up_stakes": ic_stakes, "up_palus": ic_palus, "up_doctore": ic_doctore,
}


# ------------------------------------------------------------------ mapa: a taverna
def map_tavern(img, pos):
    d = ImageDraw.Draw(img)
    cx, cy = pos
    d.rectangle([cx - 22, cy - 8, cx + 22, cy + 14], fill=hexc("d8c4a0"))
    d.polygon([(cx - 26, cy - 6), (cx - 18, cy - 20), (cx + 18, cy - 20), (cx + 26, cy - 6)], fill=hexc("8a3e2a"))
    d.rectangle([cx - 4, cy + 2, cx + 4, cy + 14], fill=hexc("3b2a20"))
    d.rectangle([cx + 8, cy - 2, cx + 16, cy + 6], fill=WOOD)  # placa
    d.ellipse([cx + 9, cy, cx + 15, cy + 4], fill=hexc("3a2418"))
    for bx in (cx - 18, cx - 12):  # barris na porta
        d.ellipse([bx, cy + 6, bx + 5, cy + 13], fill=WOOD)
    d.rectangle([cx - 22, cy + 14, cx + 25, cy + 17], fill=hexc("4a6a3a"))


# ------------------------------------------------------------------ ilustrações do jornal
PAPER = np.array([239, 227, 196], dtype=np.float32)
INK = np.array([30, 22, 16], dtype=np.float32)
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32) / 16.0


def engrave(img, scale=2, contrast=1.7):
    """Converte para "foto de jornal": cinza, retícula ordenada (Bayer) em duas tintas."""
    a = np.asarray(img.convert("RGB"), dtype=np.float32)
    lum = (a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11) / 255.0
    lum = np.clip((lum ** 1.5 - 0.42) * contrast + 0.5, 0, 1)
    h, w = lum.shape
    big = np.kron(lum, np.ones((scale, scale)))
    th = np.tile(BAYER, (big.shape[0] // 4 + 1, big.shape[1] // 4 + 1))[: big.shape[0], : big.shape[1]]
    # três níveis: tinta, retícula e papel
    on = big > th
    out = np.where(on[..., None], PAPER, INK)
    return Image.fromarray(out.astype(np.uint8))


class Composer:
    """Monta gladiadores a partir das folhas geradas (mesmo empilhamento do jogo)."""

    def __init__(self, gl_dir):
        self.dir = gl_dir
        with open(os.path.join(gl_dir, "manifest.json")) as f:
            self.m = json.load(f)
        self.cache = {}

    def sheet(self, name):
        if name not in self.cache:
            self.cache[name] = Image.open(os.path.join(self.dir, name + ".png")).convert("RGBA")
        return self.cache[name]

    def frame(self, anim, idx, skin=1, gear=("galea", "scutum", "gladius", "medium", "bronze"), hair=0, extra=None):
        m = self.m
        f = m["animations"][anim]["start"] + idx
        helmet, shield, weapon, armor, legs = gear
        sheets = [f"body_back_{skin}", f"body_main_{skin}", "cloth", "belt", f"body_front_{skin}", f"arm_top_{skin}"]
        if helmet:
            sheets.append(f"helmet_{helmet}")
        else:
            sheets.append(f"hair_{hair}")
        if shield:
            sheets.append(f"shield_{shield}")
        if armor:
            sheets.append(f"armor_{armor}")
        if legs:
            sheets += [f"legsb_{legs}", f"legsf_{legs}"]
        if extra:
            sheets += extra
        order = m["layerOrder"]
        sheets.sort(key=lambda s: order.index(m["sheets"][s]["layer"]))
        out = new_img(m["frameWidth"], m["frameHeight"])

        def put_weapon():
            if not weapon:
                return
            w = Image.open(os.path.join(self.dir, f"weapon_{weapon}.png")).convert("RGBA")
            hx, hy, ang = m["hands"][f]
            gx, gy = m["weapons"][weapon]["gripX"], m["weapons"][weapon]["gripY"]
            rot = w.rotate(-ang, center=(gx, gy), resample=Image.NEAREST)
            layer = new_img(m["frameWidth"], m["frameHeight"])
            layer.alpha_composite(rot, (int(round(hx - gx)), int(round(hy - gy))))
            out.alpha_composite(layer)

        top = f in m.get("weaponTop", [])
        for s in sheets:
            if m["sheets"][s]["layer"] == "body_main" and not top:
                put_weapon()
            out.alpha_composite(self.sheet(s).crop((f * m["frameWidth"], 0, (f + 1) * m["frameWidth"], m["frameHeight"])))
        if top:
            put_weapon()
        return out


def _bg(path, sky=(214, 222, 228)):
    """Cenário com o céu preenchido (os PNGs do jogo têm o céu transparente)."""
    img = Image.open(path).convert("RGBA")
    base = Image.new("RGBA", img.size, sky + (255,))
    grad = ImageDraw.Draw(base)
    for y in range(0, 160):
        k = y / 160
        grad.line([(0, y), (img.width, y)], fill=(int(150 + 70 * k), int(176 + 50 * k), int(200 + 30 * k), 255))
    base.alpha_composite(img)
    return base


def _place(canvas, sprite, x, y, scale):
    s = sprite.resize((sprite.width * scale, sprite.height * scale), Image.NEAREST)
    canvas.alpha_composite(s, (int(x - 56 * scale), int(y - 83 * scale)))


def news_images(assets_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    bg = os.path.join(assets_dir, "backgrounds")
    comp = Composer(os.path.join(assets_dir, "sprites", "gladiator"))
    crop = lambda img, box: img.crop(box)
    pics = {}

    rome = _bg(os.path.join(bg, "arena_rome.png"))
    crowd = Image.open(os.path.join(bg, "crowd_rome.png")).convert("RGBA").crop((0, 0, 640, 360))
    rome.alpha_composite(crowd)
    # vitória: o vencedor ergue a espada na arena lotada
    v = rome.copy()
    _place(v, comp.frame("victory", 1), 320, 330, 2)
    pics["victory"] = crop(v, (200, 150, 440, 330))
    # derrota: de joelhos diante do rival
    dft = rome.copy()
    _place(dft, comp.frame("defeat", 3, skin=0, gear=(None, "parmula", "rudis", None, None), hair=1), 290, 330, 2)
    rival = comp.frame("victory", 0, skin=2, gear=("murmillo", "scutum", "gladius", "heavy", "bronze"))
    _place(dft, rival.transpose(Image.FLIP_LEFT_RIGHT), 368, 330, 2)
    pics["defeat"] = crop(dft, (200, 150, 440, 330))
    pics["crowd"] = crop(rome, (120, 40, 360, 220))
    pics["colosseum"] = crop(rome, (0, 0, 640, 360)).resize((320, 180), Image.NEAREST)

    ludus = _bg(os.path.join(bg, "ludus.png"))
    nc = ludus.copy()
    _place(nc, comp.frame("idle", 0, skin=1, gear=(None, None, "rudis", None, None), hair=0), 320, 318, 2)
    pics["newcomer"] = crop(nc, (200, 150, 440, 330))
    tr = ludus.copy()
    palus = Image.open(os.path.join(assets_dir, "sprites", "fx", "palus.png")).convert("RGBA").crop((0, 0, 24, 56))
    tr.alpha_composite(palus.resize((48, 112), Image.NEAREST), (338, 206))
    _place(tr, comp.frame("attack", 2, skin=1, gear=(None, "parmula", "gladius", "light", None), hair=2), 300, 318, 2)
    pics["training"] = crop(tr, (200, 150, 440, 330))

    # retrato do rival (fundo escuro, close)
    rv = Image.new("RGBA", (240, 180), (70, 60, 50, 255))
    _place(rv, comp.frame("idle", 0, skin=0, gear=("galea", "scutum", "gladius", "medium", "iron")), 116, 178, 3)
    pics["rival"] = rv

    forum = _bg(os.path.join(bg, "loc_forum.png"))
    st = forum.copy()
    statue = comp.frame("victory", 1, skin=0, gear=("galea", "scutum", "gladius", "heavy", "bronze"))
    g = statue.convert("LA").convert("RGBA")
    arr = np.asarray(g).astype(np.float32)
    arr[..., :3] = arr[..., :3] * 0.5 + 120
    statue = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    sd = ImageDraw.Draw(st)
    sd.rectangle([292, 262, 348, 300], fill=(210, 204, 190, 255))
    sd.rectangle([286, 256, 354, 263], fill=(190, 184, 170, 255))
    _place(st, statue, 320, 258, 2)
    pics["statue"] = crop(st, (200, 100, 440, 300))
    pics["forum"] = crop(forum, (40, 80, 400, 300)).resize((240, 147), Image.NEAREST)
    rain = forum.copy()
    rd = ImageDraw.Draw(rain)
    for i in range(260):
        x = (i * 37) % 640
        y = (i * 53) % 360
        rd.line([(x, y), (x - 4, y + 12)], fill=(60, 60, 70, 255))
    pics["rain"] = crop(rain, (100, 60, 460, 300)).resize((240, 160), Image.NEAREST)

    pics["market"] = crop(_bg(os.path.join(bg, "loc_market.png")), (60, 110, 420, 330)).resize((240, 147), Image.NEAREST)
    pics["baths"] = crop(_bg(os.path.join(bg, "loc_baths.png")), (80, 100, 440, 320)).resize((240, 147), Image.NEAREST)
    pics["temple"] = crop(_bg(os.path.join(bg, "loc_temple.png")), (80, 30, 560, 330)).resize((240, 150), Image.NEAREST)
    pics["tavern"] = crop(_bg(os.path.join(bg, "loc_tavern.png")), (100, 110, 520, 330)).resize((240, 126), Image.NEAREST)

    # navio no porto
    ship = Image.new("RGBA", (240, 150), (200, 214, 226, 255))
    sd = ImageDraw.Draw(ship)
    sd.rectangle([0, 104, 240, 150], fill=(70, 110, 150, 255))
    for y in range(108, 150, 6):
        sd.line([(0, y), (240, y)], fill=(110, 150, 190, 255))
    sd.polygon([(40, 96), (200, 96), (182, 116), (58, 116)], fill=(100, 64, 36, 255))
    sd.line([(120, 30), (120, 96)], fill=(60, 40, 24, 255), width=3)
    sd.polygon([(84, 38), (156, 38), (150, 86), (90, 86)], fill=(176, 150, 120, 255))
    for x in range(92, 150, 10):
        sd.line([(x, 40), (x, 84)], fill=(140, 116, 90, 255))
    sd.line([(84, 38), (156, 38)], fill=(60, 40, 24, 255), width=2)
    for x in range(64, 180, 12):
        sd.line([(x, 112), (x - 6, 126)], fill=(60, 40, 24, 255))
    sd.polygon([(196, 96), (214, 78), (206, 98)], fill=(100, 64, 36, 255))
    pics["ship"] = ship

    # teatro: degraus em semicírculo e atores no palco
    th = Image.new("RGBA", (240, 150), (210, 216, 222, 255))
    td = ImageDraw.Draw(th)
    for k in range(7):
        r = 150 - k * 14
        td.pieslice([120 - r, 140 - r * 0.6, 120 + r, 140 + r * 0.6], 180, 360, fill=(196 - k * 8, 186 - k * 8, 166 - k * 8, 255), outline=(120, 110, 96, 255))
    td.rectangle([40, 118, 200, 150], fill=(150, 120, 84, 255))
    for x in range(48, 200, 22):
        td.rectangle([x, 96, x + 5, 118], fill=(230, 224, 210, 255))
    for x, flip in ((104, False), (140, True)):
        actor = comp.frame("victory", 0, skin=1, gear=(None, None, None, None, None), hair=1, extra=["tunic"])
        if flip:
            actor = actor.transpose(Image.FLIP_LEFT_RIGHT)
        _place(th, actor, x, 150, 1)
    pics["theater"] = th

    for name, pic in pics.items():
        engrave(pic).save(os.path.join(out_dir, f"{name}.png"))
    return list(pics)
