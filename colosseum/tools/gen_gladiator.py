"""Gera as spritesheets em camadas do gladiador (corpo + equipamentos).

Todas as folhas compartilham a mesma grade de quadros (FW x FH) e a mesma ordem
de animações, de forma que o jogo empilha as camadas e toca o mesmo quadro em
todas. Para substituir por arte feita à mão, basta manter a grade/ordem descrita
em manifest.json.
"""
import math
from PIL import Image
from pixel import (new_img, draw_canvas, finish, ik, limb, poly, px, R, along,
                   darker, lighter, hexc, mix)

FW, FH = 112, 88
OY = 16  # margem superior para armas erguidas
ORIGIN = (56, 67 + OY)

ARM_L1, ARM_L2 = 6, 6
LEG_L1, LEG_L2 = 11, 12

BASE = dict(hip=(56, 46), neck=(57, 33), bha=(59, 38), fha=(65, 42),
            bft=(49, 67), fft=(64, 67), wang=-30)


def P(**kw):
    p = dict(BASE)
    p.update(kw)
    return p


def shifted(p, dx=0, dy=0, keys=("neck", "bha", "fha")):
    q = dict(p)
    for k in keys:
        if k in q and q[k] is not None:
            q[k] = (q[k][0] + dx, q[k][1] + dy)
    return q


def build_animations():
    anims = []
    # IDLE
    idle = [P(), shifted(P(hip=(56, 47)), 0, 1), shifted(P(hip=(56, 47)), 0, 1), P()]
    anims.append(("idle", idle, 5, True))
    # WALK
    walk = []
    for i in range(6):
        ph = i / 6 * 2 * math.pi
        s, c = math.sin(ph), math.cos(ph)
        bob = -1 if i % 3 == 0 else 0
        fft = (58 + 7 * s, 67 - 3 * max(0.0, c))
        bft = (53 - 7 * s, 67 - 3 * max(0.0, -c))
        p = P(hip=(56, 46 + bob), fft=fft, bft=bft, wang=-30)
        p = shifted(p, 0, bob)
        p["bha"] = (p["bha"][0] - 2 * s, p["bha"][1])
        walk.append(p)
    anims.append(("walk", walk, 10, True))
    # ATTACK: preparação, golpe, impacto, recuperação
    attack = [
        P(hip=(55, 46), neck=(55, 33), bha=(50, 31), wang=-110, fha=(66, 40)),
        P(hip=(57, 46), neck=(58, 33), bha=(61, 36), wang=-35, fha=(66, 41)),
        P(hip=(59, 46), neck=(62, 34), bha=(71, 38), wang=-4, fha=(64, 44), fft=(71, 67), bft=(49, 67)),
        P(hip=(57, 46), neck=(58, 33), bha=(63, 41), wang=-25, fft=(66, 67)),
    ]
    anims.append(("attack", attack, 10, False))
    block = [
        P(hip=(55, 47), neck=(55, 34), bha=(53, 43), wang=-70, fha=(68, 37), bft=(47, 67), fft=(63, 67)),
        P(hip=(55, 47), neck=(55, 35), bha=(53, 44), wang=-68, fha=(68, 36), bft=(47, 67), fft=(63, 67)),
    ]
    anims.append(("block", block, 6, True))
    hit = [
        P(hip=(54, 46), neck=(51, 33), head=(51, 28), bha=(49, 40), wang=-130, fha=(60, 37), fft=(62, 67)),
        P(hip=(55, 46), neck=(53, 33), bha=(51, 42), wang=-100, fha=(62, 39), fft=(63, 67)),
    ]
    anims.append(("hit", hit, 8, False))
    dodge = [
        P(hip=(53, 48), neck=(50, 36), bha=(49, 42), wang=-60, fha=(58, 41), bft=(45, 67), fft=(60, 67)),
        P(hip=(50, 44), neck=(47, 32), bha=(46, 38), wang=-60, fha=(55, 37), bft=(42, 63), fft=(55, 64)),
        P(hip=(53, 47), neck=(52, 34), bha=(50, 42), wang=-55, fha=(60, 40), bft=(46, 67), fft=(60, 67)),
    ]
    anims.append(("dodge", dodge, 9, False))
    victory = [
        P(neck=(56, 33), bha=(57, 20), wang=-85, fha=(62, 44), elbow_b="back"),
        P(hip=(56, 45), neck=(56, 32), bha=(58, 18), wang=-88, fha=(62, 43), elbow_b="back"),
        P(neck=(56, 33), bha=(57, 20), wang=-85, fha=(62, 44), elbow_b="back"),
        P(hip=(56, 45), neck=(56, 32), bha=(58, 18), wang=-88, fha=(63, 42), elbow_b="back"),
    ]
    anims.append(("victory", victory, 4, True))
    kneel = dict(hip=(54, 55), bkn=(47, 64), bft=(39, 66), fft=(62, 67), bha=(61, 57), wang=8, fha=(60, 52))
    defeat = [
        P(hip=(54, 47), neck=(52, 35), bha=(50, 44), wang=30, fha=(58, 44)),
        P(neck=(56, 42), **kneel),
        P(neck=(57, 43), head=(59, 39), **kneel),
        P(neck=(57, 43), head=(59, 40), **kneel),
    ]
    anims.append(("defeat", defeat, 4, False))
    return anims


ANIMS = build_animations()
FRAMES = [p for _, frames, _, _ in ANIMS for p in frames]


def skeleton(p, oy=OY):
    p = {k: ((v[0], v[1] + oy) if isinstance(v, tuple) else v) for k, v in p.items()}
    s = dict(p)
    neck, hip = p["neck"], p["hip"]
    s["head"] = p.get("head") or (neck[0] + 1, neck[1] - 5)
    s["bsh"] = (neck[0] - 1.5, neck[1] + 2)
    s["fsh"] = (neck[0] + 1.5, neck[1] + 2)
    s["bel"], s["bha"] = ik(s["bsh"], p["bha"], ARM_L1, ARM_L2, p.get("elbow_b", "down"))
    s["fel"], s["fha"] = ik(s["fsh"], p["fha"], ARM_L1, ARM_L2, p.get("elbow_f", "down"))
    s["bhip"] = (hip[0] - 1, hip[1])
    s["fhip"] = (hip[0] + 1, hip[1])
    if p.get("bkn"):
        s["bkn"], s["bft"] = p["bkn"], p["bft"]
    else:
        s["bkn"], s["bft"] = ik(s["bhip"], p["bft"], LEG_L1, LEG_L2, "fwd")
    if p.get("fkn"):
        s["fkn"], s["fft"] = p["fkn"], p["fft"]
    else:
        s["fkn"], s["fft"] = ik(s["fhip"], p["fft"], LEG_L1, LEG_L2, "fwd")
    return s


def torso_poly(s, w1=4.5, w2=3.5, inset=0.0, top=0.0, bottom=0.0):
    nx, ny = s["neck"]
    hx, hy = s["hip"]
    dx, dy = hx - nx, hy - ny
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    px_, py_ = -uy, ux  # perpendicular (aponta para a esquerda/"costas")
    n = (nx + ux * top, ny + uy * top)
    h = (hx - ux * bottom, hy - uy * bottom)
    return [(n[0] + px_ * (w1 - inset), n[1] + py_ * (w1 - inset)),
            (n[0] - px_ * (w1 - inset) + 0.5, n[1] - py_ * (w1 - inset)),
            (h[0] - px_ * (w2 - inset), h[1] - py_ * (w2 - inset)),
            (h[0] + px_ * (w2 - inset), h[1] + py_ * (w2 - inset))]


# ---------------------------------------------------------------- partes do corpo
SANDAL = (112, 72, 42)


def part_leg(s, side, skin):
    img, d = draw_canvas(FW, FH)
    hip, kn, ft = s[side + "hip"], s[side + "kn"], s[side + "ft"]
    limb(d, hip, kn, 4, skin)
    limb(d, kn, ft, 3, skin)
    f = R(ft)
    d.rectangle([f[0] - 1, f[1] - 1, f[0] + 3, f[1]], fill=SANDAL)
    px(d, (f[0], f[1] - 2), SANDAL)
    return finish(img)


def part_arm(s, side, skin):
    img, d = draw_canvas(FW, FH)
    sh, el, ha = s[side + "sh"], s[side + "el"], s[side + "ha"]
    limb(d, sh, el, 3, skin)
    limb(d, el, ha, 3, skin)
    h = R(ha)
    d.ellipse([h[0] - 1, h[1] - 1, h[0] + 1, h[1] + 1], fill=darker(skin, 0.95))
    return finish(img)


def part_torso(s, skin):
    img, d = draw_canvas(FW, FH)
    poly(d, torso_poly(s), skin)
    img = finish(img, ol=False)
    d = __import__("PIL.ImageDraw", fromlist=["ImageDraw"]).Draw(img)
    # musculatura: peitoral e abdômen
    nx, ny = s["neck"]
    hx, hy = s["hip"]
    mus = darker(skin, 0.80)
    for t in (0.35, 0.6, 0.8):
        x = nx + (hx - nx) * t + 1.5
        y = ny + (hy - ny) * t
        px(d, (x, y), mus)
    px(d, (nx + (hx - nx) * 0.22 + 3, ny + (hy - ny) * 0.22 + 1), mus)
    px(d, (nx + (hx - nx) * 0.22 + 2, ny + (hy - ny) * 0.22 + 2), mus)
    from pixel import outline
    return outline(img)


def part_head(s, skin):
    img, d = draw_canvas(FW, FH)
    hx, hy = R(s["head"])
    limb(d, s["neck"], (hx, hy + 3), 3, skin)
    d.ellipse([hx - 3, hy - 4, hx + 4, hy + 4], fill=skin)
    px(d, (hx + 4, hy + 3), skin)  # queixo
    px(d, (hx + 5, hy + 1), skin)  # nariz
    img = finish(img, ol=False)
    d = __import__("PIL.ImageDraw", fromlist=["ImageDraw"]).Draw(img)
    px(d, (hx + 2, hy - 1), (30, 20, 16))  # olho
    px(d, (hx + 3, hy - 2), darker(skin, 0.6))  # sobrancelha
    px(d, (hx - 1, hy), darker(skin, 0.7))  # orelha
    px(d, (hx + 3, hy + 2), darker(skin, 0.75))  # boca
    from pixel import outline
    return outline(img)


def layer_body_back(s, skin):
    img = new_img(FW, FH)
    img.alpha_composite(part_leg(s, "b", darker(skin, 0.9)))
    img.alpha_composite(part_arm(s, "b", darker(skin, 0.9)))
    return img


def layer_body_main(s, skin):
    img = new_img(FW, FH)
    img.alpha_composite(part_torso(s, skin))
    img.alpha_composite(part_leg(s, "f", skin))
    img.alpha_composite(part_head(s, skin))
    return img


def layer_body_front(s, skin):
    return part_arm(s, "f", skin)


def layer_cloth(s):
    img, d = draw_canvas(FW, FH)
    hx, hy = R(s["hip"])
    g = (215, 215, 215)
    poly(d, [(hx - 4, hy - 1), (hx + 4, hy - 1), (hx + 4, hy + 3), (hx + 2, hy + 7),
             (hx - 1, hy + 6), (hx - 4, hy + 3)], g)
    img = finish(img)
    d = __import__("PIL.ImageDraw", fromlist=["ImageDraw"]).Draw(img)
    px(d, (hx + 1, hy + 2), (170, 170, 170))
    px(d, (hx + 1, hy + 4), (170, 170, 170))
    return img


def layer_tunic(s, long=False):
    """Túnica (ou estola longa) dos moradores da cidade — tons de cinza para tingir."""
    img, d = draw_canvas(FW, FH)
    g = (214, 214, 214)
    poly(d, torso_poly(s, 5.5, 5.5, top=0.5, bottom=-1), g)
    hx, hy = R(s["hip"])
    hem = 20 if long else 9
    poly(d, [(hx - 6, hy - 2), (hx + 6, hy - 2), (hx + 7 + (1 if long else 0), hy + hem), (hx - 7 - (1 if long else 0), hy + hem)], g)
    sh = R(s["fsh"])
    d.ellipse([sh[0] - 2, sh[1] - 2, sh[0] + 3, sh[1] + 2], fill=g)  # manga curta
    img = finish(img, light=0.22)
    d = __import__("PIL.ImageDraw", fromlist=["ImageDraw"]).Draw(img)
    d.line([(hx - 1, hy + 1), (hx - 1, hy + hem - 1)], fill=(176, 176, 176))
    return img


def layer_belt(s):
    img, d = draw_canvas(FW, FH)
    hx, hy = R(s["hip"])
    d.rectangle([hx - 4, hy - 3, hx + 4, hy - 1], fill=(184, 136, 60))
    img = finish(img)
    d = __import__("PIL.ImageDraw", fromlist=["ImageDraw"]).Draw(img)
    for x in (hx - 2, hx + 1, hx + 3):
        px(d, (x, hy - 2), (240, 210, 120))
    return img


def layer_hair(s, style):
    img, d = draw_canvas(FW, FH)
    hx, hy = R(s["head"])
    g = (205, 205, 205)
    if style == 0:  # curto
        poly(d, [(hx - 4, hy + 2), (hx - 4, hy - 3), (hx - 2, hy - 5), (hx + 2, hy - 5),
                 (hx + 4, hy - 3), (hx + 4, hy - 2), (hx + 1, hy - 3), (hx - 1, hy - 1), (hx - 2, hy + 2)], g)
    elif style == 1:  # longo / encaracolado
        poly(d, [(hx - 5, hy + 5), (hx - 5, hy - 3), (hx - 2, hy - 6), (hx + 2, hy - 6),
                 (hx + 5, hy - 3), (hx + 4, hy - 1), (hx + 1, hy - 3), (hx - 1, hy), (hx - 2, hy + 5)], g)
    else:  # raspado com topete
        poly(d, [(hx - 3, hy - 3), (hx - 1, hy - 5), (hx + 2, hy - 5), (hx + 3, hy - 4), (hx - 2, hy - 3)], g)
    img = finish(img)
    if style == 1:
        d = __import__("PIL.ImageDraw", fromlist=["ImageDraw"]).Draw(img)
        for p in ((hx - 3, hy - 2), (hx - 4, hy + 1), (hx, hy - 4), (hx - 3, hy + 3)):
            px(d, p, (150, 150, 150))
    return img


def layer_beard(s):
    img, d = draw_canvas(FW, FH)
    hx, hy = R(s["head"])
    g = (205, 205, 205)
    poly(d, [(hx, hy + 1), (hx + 1, hy + 2), (hx + 4, hy + 2), (hx + 5, hy + 4), (hx + 2, hy + 6), (hx - 1, hy + 4)], g)
    return finish(img, ol=False)


# ---------------------------------------------------------------- equipamentos
STEEL = (196, 200, 210)
IRON = (140, 144, 156)
BRONZE = (196, 142, 64)
GOLD = (226, 186, 84)
WOOD = (134, 90, 52)
LEATHER = (150, 104, 62)
RED = (166, 44, 36)


def draw_weapon(d, hand, ang, kind):
    """Desenha arma na mão; 'ang' em graus (0 = para frente/direita)."""
    a = lambda t, s=0: along(hand, ang, t, s)
    if kind in ("gladius", "shortsword", "rudis"):
        blade = {"gladius": 12, "shortsword": 9, "rudis": 11}[kind]
        grip_c = WOOD if kind != "rudis" else darker(WOOD, 0.9)
        limb(d, a(-3), a(1), 2, grip_c)
        px(d, a(-4), BRONZE if kind != "rudis" else WOOD)
        if kind == "rudis":
            poly(d, [a(1.5, -1.5), a(1.5, 1.5), a(blade, 1.2), a(blade + 1.5, 0), a(blade, -1.2)], lighter(WOOD, 0.15))
        else:
            limb(d, a(1.5, -2.5), a(1.5, 2.5), 2, BRONZE)
            tipw = 1.2 if kind == "gladius" else 1.0
            poly(d, [a(2.5, -1.4), a(2.5, 1.4), a(blade - 2, tipw + 0.2), a(blade + 1, 0), a(blade - 2, -tipw - 0.2)], STEEL)
    elif kind == "spear":
        limb(d, a(-10), a(26), 2, WOOD)
        poly(d, [a(25, -1.8), a(27, -2.2), a(33, 0), a(27, 2.2), a(25, 1.8)], STEEL)
    elif kind == "trident":
        limb(d, a(-10), a(24), 2, WOOD)
        limb(d, a(24, -3.5), a(24, 3.5), 2, IRON)
        for sd in (-3, 0, 3):
            limb(d, a(24, sd), a(30 if sd == 0 else 29, sd), 1, STEEL)
            px(d, a(31 if sd == 0 else 30, sd), STEEL)



def draw_shield(d, center, kind):
    cx, cy = R(center)
    if kind == "scutum":
        d.rectangle([cx - 4, cy - 11, cx + 4, cy + 11], fill=GOLD)
        d.rectangle([cx - 3, cy - 10, cx + 3, cy + 10], fill=RED)
        d.rectangle([cx + 3, cy - 10, cx + 3, cy + 10], fill=darker(RED, 0.7))
        d.line([(cx, cy - 9), (cx, cy + 9)], fill=GOLD)
        for dy in (-7, 7):
            d.line([(cx - 2, cy + dy - 1), (cx, cy + dy), (cx + 2, cy + dy - 1)], fill=GOLD)
        d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=STEEL)
    else:  # parmula
        d.rounded_rectangle([cx - 4, cy - 5, cx + 4, cy + 5], radius=2, fill=BRONZE)
        d.rounded_rectangle([cx - 3, cy - 4, cx + 3, cy + 4], radius=2, fill=WOOD)
        d.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=STEEL)


def layer_shield(s, kind):
    img, d = draw_canvas(FW, FH)
    hx, hy = s["fha"]
    draw_shield(d, (hx + 2, hy), kind)
    return finish(img, light=0.2)


def draw_helmet(d, head, kind):
    hx, hy = R(head)
    if kind == "cap":
        poly(d, [(hx - 4, hy + 1), (hx - 4, hy - 3), (hx - 2, hy - 5), (hx + 2, hy - 5), (hx + 5, hy - 2),
                 (hx + 5, hy - 1), (hx - 1, hy - 1), (hx - 2, hy + 1)], LEATHER)
        return
    metal = BRONZE if kind == "galea" else IRON
    # cúpula
    d.ellipse([hx - 4, hy - 6, hx + 5, hy + 3], fill=metal)
    # aba larga
    d.line([(hx - 6, hy + 1), (hx + 6, hy + 1)], fill=metal, width=2)
    # grade facial
    d.rectangle([hx + 1, hy - 2, hx + 5, hy + 3], fill=darker(metal, 0.55))
    for yy in range(hy - 2, hy + 4, 2):
        d.line([(hx + 1, yy), (hx + 5, yy)], fill=lighter(metal, 0.2))
    for xx in (hx + 2, hx + 4):
        d.line([(xx, hy - 2), (xx, hy + 3)], fill=lighter(metal, 0.2))
    if kind == "galea":
        # penacho vermelho
        for i, (ox, oy) in enumerate([(-5, -5), (-4, -7), (-2, -8), (0, -9), (2, -9), (4, -8), (5, -7)]):
            d.rectangle([hx + ox, hy + oy - 1, hx + ox + 1, hy + oy + 1], fill=RED)
    else:  # mirmilão: crista de metal alta
        poly(d, [(hx - 3, hy - 5), (hx - 1, hy - 9), (hx + 2, hy - 9), (hx + 3, hy - 6)], lighter(metal, 0.1))
        d.line([(hx - 7, hy + 1), (hx + 7, hy + 1)], fill=metal, width=2)


def layer_helmet(s, kind):
    img, d = draw_canvas(FW, FH)
    draw_helmet(d, s["head"], kind)
    return finish(img, light=0.3)


def layer_armor(s, kind):
    img, d = draw_canvas(FW, FH)
    if kind == "light":
        poly(d, torso_poly(s, 5, 4, top=1, bottom=2), LEATHER)
    elif kind == "medium":
        poly(d, torso_poly(s, 5, 4.2, top=1, bottom=1), IRON)
    else:
        poly(d, torso_poly(s, 5.2, 4.2, top=0.5, bottom=2), BRONZE)
    # ombreira (lado de trás visível sobre o ombro)
    sh = R(s["bsh"])
    d.ellipse([sh[0] - 2, sh[1] - 2, sh[0] + 2, sh[1] + 1], fill={"light": LEATHER, "medium": IRON, "heavy": BRONZE}[kind])
    img = finish(img, light=0.28)
    d = __import__("PIL.ImageDraw", fromlist=["ImageDraw"]).Draw(img)
    nx, ny = s["neck"]
    hx, hy = s["hip"]
    if kind == "light":
        for t in (0.3, 0.55, 0.8):
            px(d, (nx + (hx - nx) * t, ny + (hy - ny) * t + 0.5), darker(LEATHER, 0.65))
            px(d, (nx + (hx - nx) * t + 2, ny + (hy - ny) * t + 0.5), darker(LEATHER, 0.65))
        d.line([R((nx - 2, ny + 3)), R((hx + 2, hy - 4))], fill=darker(LEATHER, 0.55))
    elif kind == "medium":
        for t in range(2, 12, 2):
            for k in range(-3, 4, 2):
                x = nx + (hx - nx) * t / 13 + k + (1 if (t // 2) % 2 else 0)
                y = ny + (hy - ny) * t / 13
                px(d, (x, y), darker(IRON, 0.6))
    else:
        mus = darker(BRONZE, 0.65)
        for t in (0.3, 0.5, 0.7):
            px(d, (nx + (hx - nx) * t + 2, ny + (hy - ny) * t), mus)
            px(d, (nx + (hx - nx) * t, ny + (hy - ny) * t), mus)
        px(d, (nx + (hx - nx) * 0.18 + 3, ny + (hy - ny) * 0.18 + 1), lighter(BRONZE, 0.5))
    from pixel import outline
    return outline(img)


def layer_greave(s, side, kind):
    img, d = draw_canvas(FW, FH)
    kn, ft = s[side + "kn"], s[side + "ft"]
    col = IRON if kind == "iron" else BRONZE
    a = (kn[0] + (ft[0] - kn[0]) * 0.15, kn[1] + (ft[1] - kn[1]) * 0.15)
    b = (kn[0] + (ft[0] - kn[0]) * 0.85, kn[1] + (ft[1] - kn[1]) * 0.85)
    limb(d, a, b, 4, col if side == "f" else darker(col, 0.85))
    if kind == "bronze":
        k = R(kn)
        d.ellipse([k[0] - 2, k[1] - 2, k[0] + 2, k[1] + 1], fill=col if side == "f" else darker(col, 0.85))
    return finish(img, light=0.32)


# ---------------------------------------------------------------- folhas
SKINS = [(238, 190, 148), (200, 142, 98), (140, 92, 60)]

SHEETS = {}
for i, sk in enumerate(SKINS):
    SHEETS[f"body_back_{i}"] = ("body_back", lambda s, sk=sk: layer_body_back(s, sk))
    SHEETS[f"body_main_{i}"] = ("body_main", lambda s, sk=sk: layer_body_main(s, sk))
    SHEETS[f"body_front_{i}"] = ("body_front", lambda s, sk=sk: layer_body_front(s, sk))
SHEETS["cloth"] = ("cloth", layer_cloth)
SHEETS["tunic"] = ("tunic", lambda s: layer_tunic(s))
SHEETS["robe"] = ("tunic", lambda s: layer_tunic(s, True))
SHEETS["belt"] = ("belt", layer_belt)
for st in range(3):
    SHEETS[f"hair_{st}"] = ("hair", lambda s, st=st: layer_hair(s, st))
SHEETS["beard"] = ("beard", layer_beard)
WEAPON_KINDS = ("rudis", "gladius", "shortsword", "spear", "trident")
WEAPON_CANVAS = (56, 14)
WEAPON_GRIP = (12, 7)


def weapon_image(kind):
    """Arma desenhada UMA vez, apontando para a direita. O jogo apenas a gira na
    mão do gladiador, então a lâmina é sempre rígida (não muda de forma)."""
    img, d = draw_canvas(*WEAPON_CANVAS)
    draw_weapon(d, WEAPON_GRIP, 0, kind)
    return finish(img, light=0.35)
for sh in ("parmula", "scutum"):
    SHEETS[f"shield_{sh}"] = ("shield", lambda s, sh=sh: layer_shield(s, sh))
for h in ("cap", "galea", "murmillo"):
    SHEETS[f"helmet_{h}"] = ("helmet", lambda s, h=h: layer_helmet(s, h))
for a in ("light", "medium", "heavy"):
    SHEETS[f"armor_{a}"] = ("armor", lambda s, a=a: layer_armor(s, a))
for g in ("iron", "bronze"):
    SHEETS[f"legsb_{g}"] = ("legs_back", lambda s, g=g: layer_greave(s, "b", g))
    SHEETS[f"legsf_{g}"] = ("legs_front", lambda s, g=g: layer_greave(s, "f", g))

LAYER_ORDER = ["body_back", "legs_back", "weapon", "body_main", "cloth", "tunic", "belt", "legs_front",
               "armor", "hair", "beard", "helmet", "body_front", "shield"]


def generate(outdir):
    import os, json
    os.makedirs(outdir, exist_ok=True)
    skels = [skeleton(p) for p in FRAMES]
    for key, (layer, fn) in SHEETS.items():
        sheet = new_img(FW * len(skels), FH)
        for i, s in enumerate(skels):
            sheet.alpha_composite(fn(s), (i * FW, 0))
        sheet.save(os.path.join(outdir, key + ".png"))
    for w in WEAPON_KINDS:
        weapon_image(w).save(os.path.join(outdir, f"weapon_{w}.png"))
    anims, start = {}, 0
    for name, frames, fps, loop in ANIMS:
        anims[name] = {"start": start, "count": len(frames), "fps": fps, "loop": loop}
        start += len(frames)
    manifest = {
        "frameWidth": FW, "frameHeight": FH, "originX": ORIGIN[0], "originY": ORIGIN[1],
        "frameCount": len(skels), "animations": anims, "layerOrder": LAYER_ORDER,
        "sheets": {k: {"file": f"sprites/gladiator/{k}.png", "layer": v[0]} for k, v in SHEETS.items()},
        "weapons": {w: {"file": f"sprites/gladiator/weapon_{w}.png", "gripX": WEAPON_GRIP[0], "gripY": WEAPON_GRIP[1]}
                    for w in WEAPON_KINDS},
        # posição da mão (no quadro) e ângulo da arma em graus, para cada quadro
        "hands": [[round(s["bha"][0], 2), round(s["bha"][1], 2), s["wang"]] for s in skels],
    }
    with open(os.path.join(outdir, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    return manifest, skels


def icons(outdir):
    """Ícones 24x24 de cada visual de equipamento (usados no inventário)."""
    import os
    os.makedirs(outdir, exist_ok=True)
    from pixel import draw_canvas as dc
    result = {}
    for w in ("rudis", "gladius", "shortsword", "spear", "trident"):
        img, d = dc(24, 24)
        if w in ("spear", "trident"):
            big, bd = dc(44, 44)
            draw_weapon(bd, (8, 36), -45, w)
            img = big.crop((18, 2, 42, 26))
        else:
            draw_weapon(d, (6, 18), -45, w)
        result[f"weapon_{w}"] = finish(img, light=0.35)
    for sh in ("parmula", "scutum"):
        img, d = dc(24, 24)
        draw_shield(d, (12, 12), sh)
        result[f"shield_{sh}"] = finish(img, light=0.2)
    for h in ("cap", "galea", "murmillo"):
        img, d = dc(24, 24)
        draw_helmet(d, (11, 15), h)
        result[f"helmet_{h}"] = finish(img, light=0.3)
    s = skeleton(P(neck=(12, 4), hip=(12, 19)), oy=0)
    for a in ("light", "medium", "heavy"):
        full = layer_armor(s, a)
        img = full.crop((0, 0, 24, 24))
        result[f"armor_{a}"] = img
    for g in ("iron", "bronze"):
        img, d = dc(24, 24)
        col = IRON if g == "iron" else BRONZE
        limb(d, (9, 6), (9, 19), 4, col)
        limb(d, (15, 6), (15, 19), 4, darker(col, 0.85))
        if g == "bronze":
            d.ellipse([7, 3, 11, 7], fill=col)
            d.ellipse([13, 3, 17, 7], fill=darker(col, 0.85))
        result[f"legs_{g}"] = finish(img, light=0.32)
    for k, img in result.items():
        img.save(os.path.join(outdir, k + ".png"))
    return result
