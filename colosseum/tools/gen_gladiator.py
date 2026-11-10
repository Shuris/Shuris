"""Gera as spritesheets em camadas do gladiador (corpo + equipamentos).

Todas as folhas compartilham a mesma grade de quadros (FW x FH) e a mesma ordem
de animações, de forma que o jogo empilha as camadas e toca o mesmo quadro em
todas. Para substituir por arte feita à mão, basta manter a grade/ordem descrita
em manifest.json.
"""
import math
from PIL import Image, ImageDraw
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
    # ATTACK: preparação (espada erguida atrás), golpe por cima, impacto (braço
    # estendido à frente do escudo) e acompanhamento do golpe
    attack = [
        P(hip=(55, 46), neck=(54, 33), bha=(48, 25), wang=-140, fha=(64, 41), bft=(48, 67), fft=(63, 67)),
        P(hip=(57, 46), neck=(58, 33), bha=(62, 24), wang=-62, fha=(62, 43), bft=(49, 67), fft=(66, 67)),
        P(hip=(59, 46), neck=(62, 34), bha=(73, 37), wang=4, fha=(59, 44), fft=(72, 67), bft=(48, 67)),
        P(hip=(58, 46), neck=(59, 33), bha=(68, 44), wang=32, fha=(61, 43), fft=(68, 67), bft=(49, 67)),
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


def _frame_index(anim, i):
    start = 0
    for name, frames, _, _ in ANIMS:
        if name == anim:
            return start + i
        start += len(frames)
    raise KeyError(anim)


# quadros em que o braço da arma e a arma passam à frente do escudo
WEAPON_TOP = [_frame_index("attack", i) for i in (1, 2, 3)]


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


def layer_arm_top(s, skin):
    """Braço da arma desenhado acima do escudo durante o golpe (legibilidade)."""
    if s.get("_idx") not in WEAPON_TOP:
        return new_img(FW, FH)
    return part_arm(s, "b", darker(skin, 0.95))


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


def draw_weapon(d, hand, ang, kind, detail=False):
    """Desenha arma na mão; 'ang' em graus (0 = para frente/direita).
    Primeiro passe: formas (recebem sombreamento e contorno). Segundo passe
    (detail=True): fio da lâmina, sulco central, empunhadura enrolada, rebites."""
    a = lambda t, s=0: along(hand, ang, t, s)
    if kind in ("gladius", "shortsword", "rudis", "sica"):
        blade = {"gladius": 13, "shortsword": 10, "rudis": 12, "sica": 12}[kind]
        if not detail:
            grip_c = WOOD if kind != "rudis" else darker(WOOD, 0.9)
            limb(d, a(-4), a(1), 2, grip_c)
            pm = R(a(-5))
            d.ellipse([pm[0] - 1, pm[1] - 1, pm[0] + 1, pm[1] + 1], fill=BRONZE if kind != "rudis" else WOOD)
            if kind == "rudis":
                poly(d, [a(1.5, -1.6), a(1.5, 1.6), a(blade, 1.3), a(blade + 1.5, 0), a(blade, -1.3)], lighter(WOOD, 0.15))
            elif kind == "sica":
                limb(d, a(1, -2.5), a(1, 2.5), 2, BRONZE)
                # lâmina curva trácia
                pts_top = [a(2, -1.4), a(5, -1.8), a(8, -1.2), a(11, 0.6), a(13, 3.2)]
                pts_bot = [a(12, 3.6), a(10, 2.4), a(7, 1.3), a(4, 1.2), a(2, 1.3)]
                poly(d, pts_top + pts_bot, STEEL)
            else:
                limb(d, a(1, -3), a(1, 3), 2, BRONZE)
                tipw = 1.6 if kind == "gladius" else 1.3
                poly(d, [a(2.2, -1.6), a(2.2, 1.6), a(blade - 3, tipw), a(blade + 1, 0), a(blade - 3, -tipw)], STEEL)
            return
        # detalhes
        for t in (-3, -1):
            px(d, a(t), darker(WOOD, 0.55))
        if kind == "rudis":
            for t in range(3, blade, 3):
                px(d, a(t, 0.5), darker(WOOD, 0.7))
            return
        px(d, a(-5), lighter(BRONZE, 0.5))
        px(d, a(1, -2), lighter(BRONZE, 0.55))
        if kind == "sica":
            for t, sd in ((3, -1), (5, -1.4), (7, -0.8), (9, 0.3), (11, 1.6)):
                px(d, a(t, sd), (240, 244, 250))
            return
        # fio superior brilhante, sulco central escuro e fio inferior
        for t in range(3, blade - 1):
            px(d, a(t, -1.2 + max(0, t - (blade - 4)) * 0.4), (244, 247, 252))
        for t in range(3, blade - 3):
            px(d, a(t, 0), darker(STEEL, 0.72))
        px(d, a(blade, 0), (255, 255, 255))
    elif kind == "spear":
        if not detail:
            limb(d, a(-10), a(25), 2, WOOD)
            poly(d, [a(24, -1.6), a(27, -2.6), a(31, -1.6), a(35, 0), a(31, 1.6), a(27, 2.6), a(24, 1.6)], STEEL)
            limb(d, a(22.5), a(24.5), 3, BRONZE)
            limb(d, a(-11), a(-9), 3, BRONZE)
            return
        for t in range(-6, 22, 4):
            px(d, a(t, -0.5), lighter(WOOD, 0.25))
        for t in range(25, 34):
            px(d, a(t, 0), darker(STEEL, 0.72) if t < 32 else (255, 255, 255))
        px(d, a(27, -2), (244, 247, 252))
        px(d, a(23.5, -1), lighter(BRONZE, 0.5))
    elif kind == "trident":
        if not detail:
            limb(d, a(-10), a(23), 2, WOOD)
            limb(d, a(23, -4), a(23, 4), 2, IRON)
            for sd in (-3.5, 0, 3.5):
                limb(d, a(23, sd), a(30 if sd == 0 else 28.5, sd), 1, STEEL)
                poly(d, [a(30.5 if sd == 0 else 29, sd - 1.2), a(33 if sd == 0 else 31.5, sd), a(30.5 if sd == 0 else 29, sd + 1.2)], STEEL)
            limb(d, a(21), a(22.5), 3, BRONZE)
            return
        for t in range(-6, 20, 4):
            px(d, a(t, -0.5), lighter(WOOD, 0.25))
        px(d, a(22, -1), lighter(BRONZE, 0.5))
        for sd in (-3.5, 0, 3.5):
            px(d, a(26, sd - 0.4), (244, 247, 252))


def draw_shield(d, center, kind, detail=False):
    cx, cy = R(center)
    if kind == "scutum":
        if not detail:
            d.rounded_rectangle([cx - 5, cy - 12, cx + 5, cy + 12], radius=2, fill=GOLD)
            d.rectangle([cx - 4, cy - 11, cx + 4, cy + 11], fill=RED)
            return
        # curvatura: borda esquerda iluminada, direita na sombra
        d.line([(cx - 3, cy - 10), (cx - 3, cy + 10)], fill=lighter(RED, 0.25))
        d.line([(cx + 3, cy - 10), (cx + 3, cy + 10)], fill=darker(RED, 0.62))
        d.line([(cx + 4, cy - 11), (cx + 4, cy + 11)], fill=darker(RED, 0.5))
        # asas e raios de Júpiter em dourado
        d.line([(cx, cy - 9), (cx, cy - 4)], fill=GOLD)
        d.line([(cx, cy + 4), (cx, cy + 9)], fill=GOLD)
        for dy in (-7, 7):
            sgn = -1 if dy < 0 else 1
            d.line([(cx - 3, cy + dy - sgn), (cx, cy + dy), (cx + 3, cy + dy - sgn)], fill=GOLD)
        px(d, (cx - 2, cy - 3), GOLD)
        px(d, (cx + 2, cy + 3), GOLD)
        # umbo (bossa de metal) com brilho
        d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=STEEL)
        px(d, (cx + 1, cy + 1), darker(STEEL, 0.6))
        px(d, (cx - 1, cy - 1), (255, 255, 255))
        # rebites da borda
        for (x, y) in ((cx - 4, cy - 11), (cx + 4, cy - 11), (cx - 4, cy + 11), (cx + 4, cy + 11), (cx - 4, cy), (cx + 4, cy)):
            px(d, (x, y), lighter(GOLD, 0.5))
    elif kind == "parma":
        if not detail:
            d.rounded_rectangle([cx - 5, cy - 7, cx + 5, cy + 7], radius=1, fill=BRONZE)
            d.rectangle([cx - 4, cy - 6, cx + 4, cy + 6], fill=lighter(BRONZE, 0.12))
            return
        d.line([(cx - 3, cy - 5), (cx - 3, cy + 5)], fill=lighter(BRONZE, 0.45))
        d.line([(cx + 3, cy - 5), (cx + 3, cy + 5)], fill=darker(BRONZE, 0.65))
        d.line([(cx - 2, cy - 4), (cx + 2, cy + 4)], fill=darker(BRONZE, 0.75))
        d.line([(cx + 2, cy - 4), (cx - 2, cy + 4)], fill=darker(BRONZE, 0.75))
        d.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=STEEL)
        px(d, (cx - 1, cy - 1), (255, 255, 255))
    else:  # parmula (redonda de madeira)
        if not detail:
            d.ellipse([cx - 5, cy - 6, cx + 5, cy + 6], fill=BRONZE)
            d.ellipse([cx - 4, cy - 5, cx + 4, cy + 5], fill=WOOD)
            return
        for x in (cx - 2, cx + 1):
            d.line([(x, cy - 4), (x, cy + 4)], fill=darker(WOOD, 0.72))
        d.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=STEEL)
        px(d, (cx - 1, cy - 1), (255, 255, 255))
        for (x, y) in ((cx, cy - 5), (cx, cy + 5), (cx - 4, cy), (cx + 4, cy)):
            px(d, (x, y), lighter(BRONZE, 0.5))


def layer_shield(s, kind):
    img, d = draw_canvas(FW, FH)
    hx, hy = s["fha"]
    draw_shield(d, (hx + 2, hy), kind)
    img = finish(img, light=0.2)
    draw_shield(ImageDraw.Draw(img), (hx + 2, hy), kind, True)
    return img


def draw_helmet(d, head, kind, detail=False):
    hx, hy = R(head)
    if kind == "cap":
        if not detail:
            poly(d, [(hx - 4, hy + 1), (hx - 4, hy - 3), (hx - 2, hy - 5), (hx + 2, hy - 5), (hx + 5, hy - 2),
                     (hx + 5, hy - 1), (hx - 1, hy - 1), (hx - 2, hy + 1)], LEATHER)
            return
        d.line([(hx - 3, hy - 2), (hx + 4, hy - 2)], fill=darker(LEATHER, 0.65))
        for x in (hx - 2, hx + 1, hx + 3):
            px(d, (x, hy - 4), lighter(LEATHER, 0.35))
        return
    metal = BRONZE if kind in ("galea",) else IRON
    if not detail:
        d.ellipse([hx - 4, hy - 6, hx + 5, hy + 3], fill=metal)          # cúpula
        d.line([(hx - 6, hy + 1), (hx + 6, hy + 1)], fill=metal, width=2)  # aba larga
        d.rectangle([hx + 1, hy - 2, hx + 5, hy + 3], fill=darker(metal, 0.5))  # viseira
        if kind == "galea":
            for i, (ox, oy) in enumerate([(-5, -5), (-4, -7), (-2, -8), (0, -9), (2, -9), (4, -8), (5, -7)]):
                d.rectangle([hx + ox, hy + oy - 1, hx + ox + 1, hy + oy + 1], fill=RED)
        else:  # mirmilão: crista alta em forma de peixe
            poly(d, [(hx - 4, hy - 5), (hx - 2, hy - 10), (hx + 1, hy - 11), (hx + 3, hy - 9), (hx + 3, hy - 6)], lighter(metal, 0.1))
            d.line([(hx - 7, hy + 1), (hx + 7, hy + 1)], fill=metal, width=2)
        return
    # grade da viseira (furos) e brilho da cúpula
    for yy in range(hy - 1, hy + 3, 2):
        for xx in range(hx + 2, hx + 5, 2):
            px(d, (xx, yy), (20, 16, 14))
    d.line([(hx + 1, hy - 2), (hx + 5, hy - 2)], fill=lighter(metal, 0.35))
    px(d, (hx - 2, hy - 4), lighter(metal, 0.6))
    px(d, (hx - 1, hy - 5), lighter(metal, 0.6))
    px(d, (hx + 3, hy - 4), darker(metal, 0.7))
    d.line([(hx - 5, hy + 2), (hx + 5, hy + 2)], fill=darker(metal, 0.6))
    if kind == "galea":
        for (ox, oy) in [(-4, -7), (0, -9), (4, -8)]:
            px(d, (hx + ox, hy + oy), (220, 80, 60))
        for (ox, oy) in [(-2, -8), (2, -9)]:
            px(d, (hx + ox, hy + oy + 1), darker(RED, 0.65))
    else:
        for i in range(3):
            px(d, (hx - 2 + i * 2, hy - 8 + (1 if i == 2 else 0)), darker(metal, 0.65))
        px(d, (hx - 2, hy - 9), lighter(metal, 0.5))


def layer_helmet(s, kind):
    img, d = draw_canvas(FW, FH)
    draw_helmet(d, s["head"], kind)
    img = finish(img, light=0.3)
    draw_helmet(ImageDraw.Draw(img), s["head"], kind, True)
    return img


def layer_armor(s, kind):
    img, d = draw_canvas(FW, FH)
    col = {"light": LEATHER, "medium": IRON, "heavy": BRONZE}[kind]
    if kind == "light":
        poly(d, torso_poly(s, 5, 4, top=1, bottom=2), LEATHER)
    elif kind == "medium":
        poly(d, torso_poly(s, 5.2, 4.4, top=1, bottom=0.5), IRON)
    else:
        poly(d, torso_poly(s, 5.4, 4.4, top=0.5, bottom=1), BRONZE)
    hx, hy = s["hip"]
    nx, ny = s["neck"]
    # ptéruges (tiras de couro penduradas da cintura) nas armaduras média e pesada
    if kind != "light":
        for k in (-3, -1, 1, 3):
            x = hx + k
            d.rectangle([R((x - 0.5, hy))[0], R((x, hy))[1], R((x + 0.5, hy))[0], R((x, hy + 5))[1]], fill=LEATHER)
    # ombreira (lado de trás visível sobre o ombro)
    sh = R(s["bsh"])
    if kind == "medium":
        d.ellipse([sh[0] - 3, sh[1] - 2, sh[0] + 2, sh[1] + 2], fill=IRON)
    else:
        d.ellipse([sh[0] - 2, sh[1] - 2, sh[0] + 2, sh[1] + 1], fill=col)
    img = finish(img, light=0.28)
    d = ImageDraw.Draw(img)
    lerp = lambda t, o=0.0: (nx + (hx - nx) * t + o, ny + (hy - ny) * t)
    if kind == "light":
        # cintas cruzadas com rebites
        d.line([R((nx - 2, ny + 3)), R((hx + 2, hy - 3))], fill=darker(LEATHER, 0.55))
        for t in (0.25, 0.5, 0.75):
            px(d, lerp(t, -2), lighter(LEATHER, 0.45))
            px(d, lerp(t, 2), lighter(LEATHER, 0.45))
        px(d, lerp(0.92, 0), darker(LEATHER, 0.5))
    elif kind == "medium":
        # lorica segmentata: faixas horizontais com brilho e sombra
        for t in (0.22, 0.38, 0.54, 0.7, 0.86):
            a, b = lerp(t, -4), lerp(t, 4)
            d.line([R(a), R(b)], fill=darker(IRON, 0.55))
            a2, b2 = lerp(t + 0.06, -3), lerp(t + 0.06, 3)
            d.line([R(a2), R(b2)], fill=lighter(IRON, 0.35))
        px(d, (sh[0] - 1, sh[1] - 1), lighter(IRON, 0.6))
        d.line([(sh[0] - 3, sh[1] + 1), (sh[0] + 1, sh[1] + 1)], fill=darker(IRON, 0.55))
    else:
        # couraça musculada: peitorais, abdômen e borda inferior
        mus = darker(BRONZE, 0.62)
        d.line([R(lerp(0.3, -2)), R(lerp(0.36, 1))], fill=mus)
        d.line([R(lerp(0.3, 4)), R(lerp(0.36, 1))], fill=mus)
        for t in (0.52, 0.66, 0.8):
            px(d, lerp(t, 0), mus)
            px(d, lerp(t, 2), mus)
        px(d, lerp(0.2, 3), lighter(BRONZE, 0.6))
        px(d, lerp(0.2, -1), lighter(BRONZE, 0.45))
        d.line([R(lerp(0.97, -4)), R(lerp(0.97, 4))], fill=lighter(BRONZE, 0.35))
    if kind != "light":
        for k in (-3, -1, 1, 3):
            px(d, (hx + k, hy + 4), darker(LEATHER, 0.6))
    return img


def layer_greave(s, side, kind):
    img, d = draw_canvas(FW, FH)
    kn, ft = s[side + "kn"], s[side + "ft"]
    col = IRON if kind == "iron" else BRONZE
    col = col if side == "f" else darker(col, 0.85)
    a = (kn[0] + (ft[0] - kn[0]) * 0.1, kn[1] + (ft[1] - kn[1]) * 0.1)
    b = (kn[0] + (ft[0] - kn[0]) * 0.85, kn[1] + (ft[1] - kn[1]) * 0.85)
    limb(d, a, b, 4, col)
    k = R(kn)
    d.ellipse([k[0] - 2, k[1] - 2, k[0] + 2, k[1] + 1], fill=col)
    img = finish(img, light=0.32)
    d = ImageDraw.Draw(img)
    # correias de couro e brilho vertical
    for t in (0.35, 0.7):
        p = (kn[0] + (ft[0] - kn[0]) * t, kn[1] + (ft[1] - kn[1]) * t)
        d.line([R((p[0] - 1.5, p[1])), R((p[0] + 1.5, p[1]))], fill=darker(LEATHER, 0.7))
    for t in (0.2, 0.5, 0.8):
        p = (kn[0] + (ft[0] - kn[0]) * t, kn[1] + (ft[1] - kn[1]) * t)
        px(d, (p[0] - 1, p[1] - 1), lighter(col, 0.45))
    px(d, (k[0], k[1] - 1), lighter(col, 0.6))
    return img


# ---------------------------------------------------------------- folhas
SKINS = [(238, 190, 148), (200, 142, 98), (140, 92, 60)]

SHEETS = {}
for i, sk in enumerate(SKINS):
    SHEETS[f"body_back_{i}"] = ("body_back", lambda s, sk=sk: layer_body_back(s, sk))
    SHEETS[f"body_main_{i}"] = ("body_main", lambda s, sk=sk: layer_body_main(s, sk))
    SHEETS[f"body_front_{i}"] = ("body_front", lambda s, sk=sk: layer_body_front(s, sk))
for i, sk in enumerate(SKINS):
    SHEETS[f"arm_top_{i}"] = ("arm_top", lambda s, sk=sk: layer_arm_top(s, sk))
SHEETS["cloth"] = ("cloth", layer_cloth)
SHEETS["tunic"] = ("tunic", lambda s: layer_tunic(s))
SHEETS["robe"] = ("tunic", lambda s: layer_tunic(s, True))
SHEETS["belt"] = ("belt", layer_belt)
for st in range(3):
    SHEETS[f"hair_{st}"] = ("hair", lambda s, st=st: layer_hair(s, st))
SHEETS["beard"] = ("beard", layer_beard)
WEAPON_KINDS = ("rudis", "gladius", "shortsword", "sica", "spear", "trident")
WEAPON_CANVAS = (56, 14)
WEAPON_GRIP = (12, 7)


def weapon_image(kind):
    """Arma desenhada UMA vez, apontando para a direita. O jogo apenas a gira na
    mão do gladiador, então a lâmina é sempre rígida (não muda de forma)."""
    img, d = draw_canvas(*WEAPON_CANVAS)
    draw_weapon(d, WEAPON_GRIP, 0, kind)
    img = finish(img, light=0.35)
    draw_weapon(ImageDraw.Draw(img), WEAPON_GRIP, 0, kind, True)
    return img
for sh in ("parmula", "parma", "scutum"):
    SHEETS[f"shield_{sh}"] = ("shield", lambda s, sh=sh: layer_shield(s, sh))
for h in ("cap", "galea", "murmillo"):
    SHEETS[f"helmet_{h}"] = ("helmet", lambda s, h=h: layer_helmet(s, h))
for a in ("light", "medium", "heavy"):
    SHEETS[f"armor_{a}"] = ("armor", lambda s, a=a: layer_armor(s, a))
for g in ("iron", "bronze"):
    SHEETS[f"legsb_{g}"] = ("legs_back", lambda s, g=g: layer_greave(s, "b", g))
    SHEETS[f"legsf_{g}"] = ("legs_front", lambda s, g=g: layer_greave(s, "f", g))

LAYER_ORDER = ["body_back", "legs_back", "weapon", "body_main", "cloth", "tunic", "belt", "legs_front",
               "armor", "hair", "beard", "helmet", "body_front", "shield", "arm_top"]


def generate(outdir):
    import os, json
    os.makedirs(outdir, exist_ok=True)
    skels = [skeleton(p) for p in FRAMES]
    for i, sk in enumerate(skels):
        sk["_idx"] = i
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
        "weaponTop": WEAPON_TOP,
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
    def two_pass(size, fn):
        img, d = dc(*size)
        fn(d, False)
        img = finish(img, light=0.3)
        fn(ImageDraw.Draw(img), True)
        return img

    for w in WEAPON_KINDS:
        if w in ("spear", "trident"):
            big = two_pass((44, 44), lambda d, det, w=w: draw_weapon(d, (8, 36), -45, w, det))
            result[f"weapon_{w}"] = big.crop((18, 2, 42, 26))
        else:
            result[f"weapon_{w}"] = two_pass((24, 24), lambda d, det, w=w: draw_weapon(d, (7, 17), -45, w, det))
    for sh in ("parmula", "parma", "scutum"):
        result[f"shield_{sh}"] = two_pass((24, 24), lambda d, det, sh=sh: draw_shield(d, (12, 12), sh, det))
    for h in ("cap", "galea", "murmillo"):
        result[f"helmet_{h}"] = two_pass((24, 24), lambda d, det, h=h: draw_helmet(d, (11, 15), h, det))
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
