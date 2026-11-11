"""Feras da venatio (lobo, javali, urso, leão) e bichos da cidade (cão, gato).

Desenho com volume: cada parte do corpo é pintada com degradê de luz (de cima/esquerda
para baixo/direita) em faixas com retícula, textura de pelo e contorno escuro, no estilo
da referência do urso. O urso luta em pé. Cada fera tem o próprio ataque nos quadros de
ataque (lobo: salto com mordida; javali: investida com as presas; urso: patada em pé;
leão: bote com as garras).

Todas as folhas têm exatamente os mesmos 29 quadros (112x88, pés em 56,83) e a mesma
ordem de animações do gladiador: idle 4, walk 6, attack 4, block 2, hit 2, dodge 3,
victory 4, defeat 4.
"""
import math
import numpy as np
from PIL import Image, ImageDraw
from pixel import new_img, outline, hexc

FW, FH = 112, 88
FEET = (56, 83)
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32) / 16.0

PAL = {
    "bear": dict(base="6e4428", hi="a8703c", lo="3a2214", deep="2a180e", belly="7e5030", muzzle="d8a46c", nose="1a120c", claw="f0e8d8"),
    "wolf": dict(base="8a8892", hi="c4c2c8", lo="4c4a54", deep="2e2c34", belly="d6d0c6", muzzle="d6d0c6", nose="16141a", claw="e8e4dc"),
    "boar": dict(base="5e4636", hi="8a6c54", lo="34261c", deep="22180f", belly="6e5444", muzzle="c88a74", nose="3a2018", claw="f2ead6"),
    "lion": dict(base="c8964e", hi="eec080", lo="8a5c2c", deep="5a3818", belly="e6c48e", muzzle="f0d8a8", nose="5a2a1e", claw="f2ecdc",
                 mane="8a4a1c", mane_hi="b8702e", mane_lo="4e2610"),
    "dog": dict(base="9a4e26", hi="c06a38", lo="6a3218", deep="3a1a0e", belly="a85a30", muzzle="a85a30", nose="2a140a", claw="e8dcc8"),
    "cat": dict(base="d0843c", hi="eeaa62", lo="8e5222", deep="5a3010", belly="f2d6a8", muzzle="f2d6a8", nose="c86a6a", claw="f0e8d8"),
}
CITY_ANIMALS = ("dog", "cat")
KINDS = list(PAL.keys())


def _c(h):
    return np.array(hexc(h), dtype=np.float32)


class Painter:
    """Pinta partes com volume: cada parte vira uma máscara colorida com luz e textura."""

    def __init__(self):
        self.rgba = np.zeros((FH, FW, 4), dtype=np.float32)

    def part(self, draw, base, hi, lo, light=(-0.6, -0.8), fur=0.0, seed=1):
        mask_img = Image.new("L", (FW, FH), 0)
        draw(ImageDraw.Draw(mask_img))
        m = np.asarray(mask_img) > 0
        if not m.any():
            return m
        ys, xs = np.nonzero(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        yy, xx = np.mgrid[0:FH, 0:FW].astype(np.float32)
        # posição relativa dentro da parte (0..1) e direção da luz
        u = (xx - x0) / max(1, x1 - x0) - 0.5
        v = (yy - y0) / max(1, y1 - y0) - 0.5
        t = 0.5 + (u * light[0] + v * light[1]) * 1.1
        # borda da silhueta mais escura (sombra própria)
        er = np.zeros_like(m)
        er[1:-1, 1:-1] = m[1:-1, 1:-1] & m[:-2, 1:-1] & m[2:, 1:-1] & m[1:-1, :-2] & m[1:-1, 2:]
        t = np.where(m & ~er, t - 0.18, t)
        rng = np.random.default_rng(seed)
        if fur:
            t = t + (rng.random((FH, FW)) - 0.5) * fur * 0.45
        # 3 faixas de cor com retícula (pixel art, sem degradê liso)
        th = BAYER[(yy.astype(int) % 4), (xx.astype(int) % 4)]
        q = np.clip(t * 3 + (th - 0.5) * 0.55, 0, 2.999).astype(int)
        cols = np.stack([_c(lo), _c(base), _c(hi)])
        rgb = cols[q]
        self.rgba[m, :3] = rgb[m]
        self.rgba[m, 3] = 255
        return m

    def px(self, x, y, color):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < FW and 0 <= y < FH:
            self.rgba[y, x, :3] = _c(color)
            self.rgba[y, x, 3] = 255

    def line(self, pts, color, width=1):
        img = Image.new("L", (FW, FH), 0)
        ImageDraw.Draw(img).line(pts, fill=255, width=width)
        m = np.asarray(img) > 0
        self.rgba[m, :3] = _c(color)
        self.rgba[m, 3] = 255

    def image(self, ol=True):
        img = Image.fromarray(np.clip(self.rgba, 0, 255).astype(np.uint8), "RGBA")
        return outline(img, factor=0.25) if ol else img


def capsule(d, p0, p1, r0, r1):
    """Membro afinado (cápsula) entre dois pontos."""
    (x0, y0), (x1, y1) = p0, p1
    ang = math.atan2(y1 - y0, x1 - x0) + math.pi / 2
    ca, sa = math.cos(ang), math.sin(ang)
    d.polygon([(x0 + ca * r0, y0 + sa * r0), (x1 + ca * r1, y1 + sa * r1), (x1 - ca * r1, y1 - sa * r1), (x0 - ca * r0, y0 - sa * r0)], fill=255)
    d.ellipse([x0 - r0, y0 - r0, x0 + r0, y0 + r0], fill=255)
    d.ellipse([x1 - r1, y1 - r1, x1 + r1, y1 + r1], fill=255)


# ------------------------------------------------------------------ poses
def _poses(kind):
    """Parâmetros por quadro. Quadrúpedes: dx, lift, crouch, phase/walk, reach, mouth, rear,
    tilt, fall. O urso usa poses próprias (em pé)."""
    p = []
    for i in range(4):
        p.append(dict(breath=math.sin(i / 4 * 2 * math.pi), tail=math.sin(i / 4 * 2 * math.pi)))
    for i in range(6):
        p.append(dict(phase=i / 6 * 2 * math.pi, walk=1, tail=math.sin(i / 3 * math.pi)))
    atk = {
        # lobo: agacha e salta mordendo
        "wolf": [dict(dx=-6, crouch=5, mouth=0.3), dict(dx=3, lift=10, mouth=1, reach=1, stretch=1), dict(dx=11, lift=4, mouth=1, reach=2, stretch=1, bite=1), dict(dx=4, mouth=0.4)],
        # javali: abaixa a cabeça e investe erguendo as presas
        "boar": [dict(dx=-6, head_dy=4, crouch=2), dict(dx=3, head_dy=5, phase=1.5, walk=1), dict(dx=11, head_dy=-3, mouth=0.6, gore=1), dict(dx=5, head_dy=1)],
        # leão: empina e dá o bote com as garras à frente
        "lion": [dict(dx=-6, crouch=4, mouth=0.4), dict(dx=0, rear=10, lift=4, mouth=1, claws=1), dict(dx=8, rear=4, lift=6, mouth=1, reach=1, claws=2), dict(dx=3, mouth=0.4)],
        "dog": [dict(dx=-3, crouch=3), dict(dx=4, lift=4, mouth=1), dict(dx=10, lift=2, mouth=1, reach=1), dict(dx=4)],
        "cat": [dict(dx=-3, crouch=4), dict(dx=4, lift=6, claws=1), dict(dx=10, lift=2, claws=2), dict(dx=4)],
    }
    p += atk.get(kind, atk["dog"])
    p += [dict(dx=-2, crouch=5, head_dy=3, mouth=1), dict(dx=-2, crouch=5, head_dy=3, mouth=0.6)]  # defesa: rosnando
    p += [dict(dx=-6, tilt=7, head_dy=-3, mouth=0.6), dict(dx=-3, tilt=3)]  # atingido
    p += [dict(dx=-8, lift=8, phase=1.2, walk=1), dict(dx=-16, lift=10, phase=2.4, walk=1), dict(dx=-10, lift=2)]  # esquiva
    for i in range(4):  # vitória: rugido
        p.append(dict(head_dy=-5 - (i % 2) * 2, mouth=1 if i % 2 == 0 else 0.7, rear=4 + (i % 2) * 2, tail=1))
    for i in range(4):  # derrota
        p.append(dict(fall=(i + 1) / 4))
    assert len(p) == 29
    return p


def _bear_poses():
    p = []
    for i in range(4):  # em pé, balançando
        p.append(dict(sway=math.sin(i / 4 * 2 * math.pi), arm=0.2 + 0.1 * math.sin(i / 4 * 2 * math.pi)))
    for i in range(6):  # anda em pé, gingando
        p.append(dict(step=math.sin(i / 6 * 2 * math.pi), sway=math.sin(i / 3 * math.pi) * 0.6, arm=0.3))
    # patada: ergue a pata, golpeia de cima para baixo, garras à mostra, volta
    p += [dict(lean=-3, raise_=1.0, mouth=0.4), dict(lean=-4, raise_=1.3, mouth=1), dict(lean=6, swipe=1, mouth=1, dx=6), dict(lean=2, arm=0.4, dx=3)]
    p += [dict(guard=1, mouth=0.8), dict(guard=1, mouth=0.5)]  # defesa: braços à frente
    p += [dict(lean=-6, arm=0.1, mouth=0.7, dx=-4), dict(lean=-3, arm=0.2, dx=-2)]  # atingido
    p += [dict(lean=-4, dx=-8, step=1), dict(lean=-5, dx=-15, step=-1), dict(lean=-2, dx=-9)]  # esquiva
    for i in range(4):  # vitória: ruge com os braços abertos
        p.append(dict(roar=1, mouth=1 if i % 2 == 0 else 0.7, arm=1.2 + 0.2 * (i % 2)))
    for i in range(4):  # derrota: cai de quatro e deita
        p.append(dict(fall=(i + 1) / 4))
    assert len(p) == 29
    return p


# ------------------------------------------------------------------ quadrúpedes
SIZES = {
    #        compr  alt  perna cabeça
    "wolf": (46, 16, 16, 9),
    "boar": (46, 22, 11, 12),
    "lion": (52, 21, 16, 11),
    "dog": (38, 13, 17, 8),
    "cat": (34, 12, 12, 8),
}


def _quadruped(kind, pose):
    c = PAL[kind]
    L, Hh, leg, hs = SIZES[kind]
    fall = pose.get("fall", 0)
    if fall:
        leg = max(2, int(leg * (1 - fall * 0.85)))
        pose = dict(pose, head_dy=pose.get("head_dy", 0) + fall * (leg + 5), dx=pose.get("dx", 0) - fall * 4)
    P = Painter()
    dx = pose.get("dx", 0)
    lift = pose.get("lift", 0)
    crouch = pose.get("crouch", 0)
    rear = pose.get("rear", 0)
    breath = pose.get("breath", 0)
    stretch = pose.get("stretch", 0)
    L2 = L + stretch * 6
    cx = FEET[0] + dx - 4
    ground = FEET[1]
    hip_y = ground - leg - lift + crouch
    top = hip_y - Hh + int(breath)
    phase, walk, reach = pose.get("phase", 0), pose.get("walk", 0), pose.get("reach", 0)
    legs = [(-L2 * 0.33, 0, True), (-L2 * 0.22, math.pi, False), (L2 * 0.27, math.pi, True), (L2 * 0.37, 0, False)]

    def leg_draw(i, lx, ph, far):
        hx = cx + lx
        swing = math.sin(phase + ph) * 6 * walk
        front = i >= 2
        fx = hx + swing + (reach * 5 if front else 0) + (pose.get("claws", 0) * 5 if front else 0)
        fy = ground - max(0, math.cos(phase + ph)) * 3 * walk - lift * (0.9 if front and pose.get("claws") else 0.4)
        hy = hip_y - 3 - (rear if front else 0)
        kx = (hx + fx) / 2 + (3 if not front else -2)
        ky = (hy + fy) / 2
        w = 4 if kind in ("boar", "lion") else 3
        if kind in ("cat", "dog"):
            w = 2.5 if kind == "cat" else 3
        col = (c["lo"], c["deep"], c["lo"]) if far else (c["base"], c["lo"], c["hi"])

        def draw(d):
            capsule(d, (hx, hy), (kx, ky), w + 1.5, w)
            capsule(d, (kx, ky), (fx, fy - 1), w, w - 0.5)
        P.part(draw, col[0], col[2], col[1], fur=0.25, seed=i + 3)
        P.line([(fx - 1, fy), (fx + 3, fy)], c["deep"], 2)
        if pose.get("claws") and front:
            for k in range(3):
                P.px(fx + 3 + k % 2, fy - 2 + k, c["claw"])

    for i, (lx, ph, far) in enumerate(legs):  # pernas do lado de lá
        if far:
            leg_draw(i, lx, ph, True)

    # cauda
    tail = pose.get("tail", 0)
    tx, ty = cx - L2 / 2 + 2, top + 5
    if kind == "lion":
        P.line([(tx, ty), (tx - 9, ty + 7 - tail * 4), (tx - 14, ty + 3 - tail * 5)], c["base"], 2)
        P.part(lambda d: d.ellipse([tx - 18, ty - 1 - tail * 5, tx - 12, ty + 5 - tail * 5], fill=255), c["mane"], c["mane_hi"], c["mane_lo"])
    elif kind in ("wolf",):
        P.part(lambda d: d.polygon([(tx + 2, ty), (tx - 14, ty + 7 - tail * 3), (tx - 16, ty + 11 - tail * 3), (tx - 6, ty + 10), (tx + 2, ty + 6)], fill=255), c["base"], c["hi"], c["lo"], fur=0.3)
    elif kind == "dog":
        P.part(lambda d: capsule(d, (tx + 1, ty + 1), (tx - 4, ty - 10 - tail * 2), 2, 1.5), c["base"], c["hi"], c["lo"])
    elif kind == "cat":
        P.line([(tx, ty + 2), (tx - 6, ty - 5 - tail * 2), (tx - 4, ty - 13 - tail * 2)], c["base"], 3)
    else:
        P.line([(tx, ty), (tx - 4, ty + 5 + tail)], c["deep"], 1)

    # tronco: peito mais alto que o quadril (empina ao atacar)
    def body(d):
        d.polygon([(cx - L2 / 2, top + 3), (cx + L2 / 2 - 6, top - rear - 1), (cx + L2 / 2 + 1, hip_y - 2 - rear / 2), (cx - L2 / 2 + 3, hip_y + 1)], fill=255)
        d.ellipse([cx - L2 / 2 - 4, top + 1, cx - L2 / 2 + 15, hip_y + 2], fill=255)
        d.ellipse([cx + L2 / 2 - 16, top - rear - 3, cx + L2 / 2 + 5, hip_y - rear / 2 + 2], fill=255)
        if kind == "boar":  # cernelha alta
            d.ellipse([cx + L2 / 2 - 20, top - rear - 6, cx + L2 / 2 + 2, top - rear + 8], fill=255)
    P.part(body, c["base"], c["hi"], c["lo"], fur=0.35, seed=11)
    P.part(lambda d: d.polygon([(cx - L2 / 2 + 7, hip_y - 4), (cx + L2 / 2 - 7, hip_y - 5 - rear / 2), (cx + L2 / 2 - 9, hip_y - rear / 2), (cx - L2 / 2 + 9, hip_y + 1)], fill=255),
           c["belly"], c["hi"], c["base"], fur=0.2, seed=12)
    if kind == "boar":  # crina eriçada
        for x in range(int(cx - L2 / 2 + 4), int(cx + L2 / 2 - 2), 2):
            yb = top - rear * ((x - (cx - L2 / 2)) / L2) - (4 if x > cx + L2 / 4 else 1)
            P.line([(x, yb + 2), (x + 1, yb - 1)], c["deep"])
    if kind == "wolf":  # pelagem do pescoço
        P.part(lambda d: d.polygon([(cx + L2 / 2 - 18, top - rear), (cx + L2 / 2, top - rear - 3), (cx + L2 / 2 - 1, top + 9 - rear)], fill=255), c["hi"], c["belly"], c["base"], fur=0.4)

    for i, (lx, ph, far) in enumerate(legs):  # pernas do lado de cá
        if not far:
            leg_draw(i, lx, ph, False)

    # cabeça
    hx = cx + L2 / 2 + 4 + reach * 2
    hy = top - 1 - rear + pose.get("head_dy", 0)
    mouth = pose.get("mouth", 0)
    sn = {"wolf": 10, "boar": 10, "lion": 8, "dog": 7, "cat": 4}[kind]
    if kind == "lion":  # juba volumosa atrás da cabeça
        P.part(lambda d: (d.ellipse([hx - hs - 8, hy - hs - 6, hx + hs - 1, hy + hs + 8], fill=255), d.ellipse([hx - hs - 4, hy - hs - 9, hx + 3, hy], fill=255)),
               c["mane"], c["mane_hi"], c["mane_lo"], fur=0.6, seed=21)
    if kind == "dog":  # orelha de lá, dobrada
        P.part(lambda d: d.polygon([(hx - 7, hy - 6), (hx - 5, hy - 10), (hx - 2, hy - 8), (hx - 3, hy - 4)], fill=255), c["lo"], c["base"], c["deep"])
    if kind == "boar":
        # cabeça em cunha, focinho comprido terminando num disco
        P.part(lambda d: d.polygon([(hx - 8, hy - 9), (hx + 2, hy - 7), (hx + sn + 2, hy - 1), (hx + sn + 2, hy + 5), (hx - 2, hy + 7), (hx - 9, hy + 3)], fill=255), c["base"], c["hi"], c["lo"], fur=0.3, seed=22)
    elif kind == "dog":
        # cabeça quadrada com focinho reto (como a referência)
        P.part(lambda d: d.polygon([(hx - 5, hy - 7), (hx + 3, hy - 7), (hx + 5, hy - 3), (hx + sn + 1, hy - 2), (hx + sn + 1, hy + 3), (hx - 2, hy + 4), (hx - 6, hy + 1)], fill=255), c["base"], c["hi"], c["lo"], seed=22)
    else:
        P.part(lambda d: d.ellipse([hx - hs + 1, hy - hs + 1, hx + hs - 1, hy + hs - 1], fill=255), c["base"], c["hi"], c["lo"], fur=0.3, seed=22)
    # focinho (mandíbula separada abre na mordida)
    if kind == "boar":
        P.part(lambda d: d.ellipse([hx + sn - 1, hy - 1, hx + sn + 4, hy + 5], fill=255), c["muzzle"], "e8a890", c["nose"])
    if kind not in ("boar", "dog"):
        P.part(lambda d: d.polygon([(hx - 1, hy - 3), (hx + sn, hy - 1), (hx + sn + 1, hy + 2), (hx - 1, hy + 3)], fill=255), c["muzzle"], c["hi"], c["base"], seed=23)
    if mouth > 0:
        mo = 1 + mouth * 4
        P.part(lambda d: d.polygon([(hx, hy + 3), (hx + sn, hy + 3 + mo), (hx + sn - 2, hy + 5 + mo), (hx - 1, hy + 6)], fill=255), c["muzzle"], c["hi"], c["base"])
        P.part(lambda d: d.polygon([(hx + 1, hy + 3), (hx + sn, hy + 2), (hx + sn - 1, hy + 2 + mo), (hx + 1, hy + 5)], fill=255), "6a1414", "8a2020", "3a0808", ol=False) if False else \
            P.part(lambda d: d.polygon([(hx + 1, hy + 3), (hx + sn, hy + 2), (hx + sn - 1, hy + 2 + mo), (hx + 1, hy + 5)], fill=255), "6a1414", "8a2020", "3a0808")
        for k in (2, 4):
            P.px(hx + sn - k, hy + 3, c["claw"])
        P.px(hx + sn - 2, hy + 1 + mo, c["claw"])
    P.line([(hx + sn, hy - 2), (hx + sn + 1, hy - 1)], c["nose"], 2)  # nariz
    P.px(hx + 2, hy - 4, "16100c")  # olho
    if kind in ("wolf", "lion", "cat"):
        P.px(hx + 3, hy - 4, "f0c838")
    # orelhas e presas
    if kind == "wolf":
        P.part(lambda d: d.polygon([(hx - 5, hy - 5), (hx - 2, hy - 15), (hx + 2, hy - 5)], fill=255), c["base"], c["hi"], c["lo"])
        P.part(lambda d: d.polygon([(hx - 1, hy - 5), (hx + 2, hy - 13), (hx + 5, hy - 5)], fill=255), c["lo"], c["base"], c["deep"])
    elif kind == "cat":
        P.part(lambda d: d.polygon([(hx - 5, hy - 4), (hx - 4, hy - 11), (hx, hy - 6)], fill=255), c["base"], c["hi"], c["lo"])
        P.part(lambda d: d.polygon([(hx, hy - 5), (hx + 2, hy - 11), (hx + 4, hy - 5)], fill=255), c["base"], c["hi"], c["lo"])
        P.line([(hx + 5, hy + 1), (hx + 9, hy)], "f0e8d8")  # bigodes
    elif kind == "boar":
        P.part(lambda d: d.polygon([(hx - 6, hy - 8), (hx - 5, hy - 13), (hx - 1, hy - 8)], fill=255), c["lo"], c["base"], c["deep"])
        up = pose.get("gore", 0) * 2
        P.line([(hx + sn - 3, hy + 3), (hx + sn + 1, hy - 3 - up)], c["claw"], 2)
    elif kind == "lion":
        P.part(lambda d: d.ellipse([hx - 4, hy - 10, hx + 1, hy - 5], fill=255), c["base"], c["hi"], c["lo"])
    elif kind == "dog":
        P.part(lambda d: d.polygon([(hx - 4, hy - 7), (hx - 1, hy - 11), (hx + 3, hy - 9), (hx + 1, hy - 5)], fill=255), c["base"], c["hi"], c["lo"])
    img = P.image()
    tilt = pose.get("tilt", 0) - fall * 6
    if tilt:
        img = img.rotate(tilt, resample=Image.NEAREST, center=FEET)
    return img


# ------------------------------------------------------------------ urso em pé
def _bear(pose):
    c = PAL["bear"]
    P = Painter()
    fall = pose.get("fall", 0)
    dx = pose.get("dx", 0)
    lean = pose.get("lean", 0) + pose.get("sway", 0)
    step = pose.get("step", 0)
    ground = FEET[1]
    if fall:
        # cai para a frente, de quatro, e deita
        return _bear_fallen(fall)
    cx = FEET[0] + dx - 6
    hip = (cx, ground - 26)
    sh = (cx + lean + 4, ground - 50)  # ombros
    # pernas grossas (de lá e de cá)
    for far, s in ((True, -1), (False, 1)):
        fx = cx + s * 6 + step * 4 * s
        col = (c["lo"], c["deep"], c["base"]) if far else (c["base"], c["lo"], c["hi"])
        P.part(lambda d, fx=fx, s=s: (capsule(d, (hip[0] + s * 4, hip[1]), (fx + 2, ground - 12), 8, 6), capsule(d, (fx + 2, ground - 12), (fx + 3, ground - 3), 6, 5)),
               col[0], col[2], col[1], fur=0.35, seed=31 + far)
        P.part(lambda d, fx=fx: d.ellipse([fx - 3, ground - 5, fx + 9, ground + 1], fill=255), c["deep"], c["lo"], c["deep"])
        for k in range(3):
            P.px(fx + 6 + k, ground - 1, c["claw"])

    def arm(far):
        # braço: ergue (raise_), golpeia (swipe), guarda (guard) ou abre (roar/arm)
        sx, sy = sh[0] + (-6 if far else 6), sh[1] + 4
        a = pose.get("arm", 0.3)
        if pose.get("raise_") and not far:
            r = pose["raise_"]
            ex, ey = sx + 6, sy - 9 * r
            px, py = sx + 12, sy - 18 * r
        elif pose.get("swipe") and not far:
            ex, ey = sx + 14, sy + 2
            px, py = sx + 26, sy + 12
        elif pose.get("guard"):
            ex, ey = sx + 10, sy + 6
            px, py = sx + 14, sy - 4
        elif pose.get("roar"):
            ex, ey = sx + (4 if far else 12), sy - 8 * a
            px, py = sx + (8 if far else 20), sy - 15 * a
        else:
            ex, ey = sx + 11, sy + 9 - a * 6
            px, py = sx + 22, sy + 11 - a * 10
        col = (c["lo"], c["deep"], c["base"]) if far else (c["base"], c["lo"], c["hi"])
        P.part(lambda d: (capsule(d, (sx, sy), (ex, ey), 7, 6), capsule(d, (ex, ey), (px, py), 6, 5)), col[0], col[2], col[1], fur=0.35, seed=41 + far)
        P.part(lambda d: d.ellipse([px - 4, py - 4, px + 5, py + 4], fill=255), c["lo"], c["base"], c["deep"])
        for k in range(4):  # garras
            P.px(px + 5, py - 3 + k * 2, c["claw"])
            P.px(px + 6, py - 2 + k * 2, c["claw"])
        if pose.get("swipe") and not far:  # rastro da patada
            for k in range(5):
                P.line([(px - 4 - k * 3, py - 14 + k), (px + 2 - k * 2, py - 4 + k)], "f4ead8")

    arm(True)
    # tronco alto com corcova e barriga mais clara
    def torso(d):
        d.ellipse([hip[0] - 15, sh[1] - 4, hip[0] + 15 + lean / 2, hip[1] + 8], fill=255)
        d.ellipse([sh[0] - 14, sh[1] - 10, sh[0] + 12, sh[1] + 16], fill=255)  # corcova
    P.part(torso, c["base"], c["hi"], c["lo"], fur=0.4, seed=51)
    P.part(lambda d: d.ellipse([hip[0] - 4 + lean / 2, sh[1] + 10, hip[0] + 14 + lean / 2, hip[1] + 6], fill=255), c["belly"], c["base"], c["lo"], fur=0.3, seed=52)
    arm(False)
    # cabeça com focinho claro e orelhas redondas
    hx, hy = sh[0] + 10, sh[1] - 6 - (4 if pose.get("roar") else 0)
    P.part(lambda d: (d.ellipse([hx - 7, hy - 15, hx - 1, hy - 9], fill=255), d.ellipse([hx + 2, hy - 16, hx + 8, hy - 10], fill=255)), c["base"], c["hi"], c["lo"])
    P.px(hx - 4, hy - 12, c["deep"])
    P.px(hx + 5, hy - 13, c["deep"])
    P.part(lambda d: d.ellipse([hx - 9, hy - 13, hx + 9, hy + 5], fill=255), c["base"], c["hi"], c["lo"], fur=0.3, seed=61)
    P.part(lambda d: d.ellipse([hx + 2, hy - 5, hx + 13, hy + 4], fill=255), c["muzzle"], "f0c890", c["belly"], seed=62)
    P.line([(hx + 11, hy - 4), (hx + 13, hy - 3)], c["nose"], 3)
    P.px(hx + 3, hy - 7, "0e0a08")
    P.px(hx + 4, hy - 7, "0e0a08")
    mouth = pose.get("mouth", 0)
    if mouth > 0:
        mo = 1 + mouth * 3
        P.part(lambda d: d.polygon([(hx + 4, hy + 1), (hx + 12, hy), (hx + 11, hy + 1 + mo), (hx + 5, hy + 2 + mo)], fill=255), "6a1414", "8a2a2a", "3a0808")
        P.px(hx + 10, hy + 1, c["claw"])
        P.px(hx + 6, hy + 1, c["claw"])
    return P.image()


def _bear_fallen(fall):
    """Derrota: o urso tomba de quatro e deita de lado."""
    c = PAL["bear"]
    P = Painter()
    ground = FEET[1]
    cx = FEET[0] - 4
    h = int(26 * (1 - fall * 0.6))
    P.part(lambda d: d.ellipse([cx - 28, ground - h - 6, cx + 22, ground], fill=255), c["base"], c["hi"], c["lo"], fur=0.4, seed=71)
    P.part(lambda d: d.ellipse([cx + 14, ground - h - 4 + int(fall * 6), cx + 34, ground - 2 + int(fall * 4)], fill=255), c["base"], c["hi"], c["lo"], fur=0.3, seed=72)
    P.part(lambda d: d.ellipse([cx + 26, ground - h + int(fall * 7), cx + 37, ground + int(fall * 4) - 4], fill=255), c["muzzle"], "f0c890", c["belly"])
    for x in (cx - 22, cx - 8, cx + 8):
        P.part(lambda d, x=x: d.ellipse([x - 4, ground - 6, x + 6, ground], fill=255), c["lo"], c["base"], c["deep"])
    return P.image()


# ------------------------------------------------------------------ saída
def _draw(kind, pose):
    return _bear(pose) if kind == "bear" else _quadruped(kind, pose)


def sheets():
    out = {}
    for kind in KINDS:
        poses = _bear_poses() if kind == "bear" else _poses(kind)
        sheet = new_img(FW * len(poses), FH)
        for i, pose in enumerate(poses):
            sheet.alpha_composite(_draw(kind, pose), (i * FW, 0))
        out[f"beast_{kind}"] = sheet
    return out


def icons():
    """Ícones 32x32 das feras para o painel."""
    out = {}
    for kind in [k for k in KINDS if k not in CITY_ANIMALS]:
        poses = _bear_poses() if kind == "bear" else _poses(kind)
        frame = _draw(kind, poses[0])
        crop = frame.crop(frame.getbbox())
        crop.thumbnail((32, 32), Image.NEAREST)
        icon = new_img(32, 32)
        icon.alpha_composite(crop, ((32 - crop.width) // 2, 32 - crop.height))
        out[f"beast_{kind}"] = icon
    return out


def portraits():
    """Retratos 48x48 (cabeça rugindo), no mesmo fundo dos retratos dos gladiadores."""
    out = {}
    for kind in [k for k in KINDS if k not in CITY_ANIMALS]:
        poses = _bear_poses() if kind == "bear" else _poses(kind)
        frame = _draw(kind, dict(poses[21], mouth=0.8))
        bbox = frame.getbbox()
        if kind == "bear":
            cx, cy = bbox[2] - 12, bbox[1] + 12
        else:
            cx, cy = bbox[2] - 14, bbox[1] + 12
        crop = frame.crop((cx - 13, cy - 11, cx + 11, cy + 13)).resize((48, 48), Image.NEAREST)
        img = Image.new("RGBA", (48, 48), (80, 59, 46, 255))
        d = ImageDraw.Draw(img)
        for y in range(48):
            d.line([(0, y), (47, y)], fill=(80 - y // 4, 59 - y // 5, 46 - y // 6, 255))
        img.alpha_composite(crop)
        out[f"beast_{kind}"] = img
    return out
