"""Feras da venatio (lutas sazonais contra animais): leão, urso, lobo e javali.

Cada folha tem exatamente os mesmos 29 quadros (112x88, pés em 56,83) e a mesma
ordem de animações das folhas do gladiador, para que a cena da arena toque as
animações das feras sem saber que não são pessoas.
"""
import math
from PIL import Image, ImageDraw
from pixel import new_img, finish, darker, lighter, hexc

FW, FH = 112, 88
FEET = (56, 83)

KINDS = {
    #          corpo     barriga   juba/detalhe  compr. alt. pernas cabeça
    "lion": dict(body="c8984e", belly="e0bc7a", extra="7a4a1e", length=50, height=20, leg=15, head=11),
    "bear": dict(body="5e3e26", belly="7a5638", extra="3e2818", length=52, height=26, leg=14, head=12),
    "wolf": dict(body="7c7a7e", belly="b4b0aa", extra="4e4c52", length=44, height=15, leg=15, head=9),
    "boar": dict(body="4e3c30", belly="6e5646", extra="e8e0c8", length=44, height=20, leg=10, head=11),
}

# (nome, quadros) na mesma ordem do gladiador: idle 4, walk 6, attack 4, block 2,
# hit 2, dodge 3, victory 4, defeat 4
def _poses():
    p = []
    for i in range(4):  # respiração e cauda
        p.append(dict(breath=math.sin(i / 4 * 2 * math.pi), tail=math.sin(i / 4 * 2 * math.pi), phase=0))
    for i in range(6):  # passos
        p.append(dict(phase=i / 6 * 2 * math.pi, walk=1, tail=math.sin(i / 3 * math.pi)))
    p += [  # ataque: agacha, salta com a boca aberta, golpeia, volta
        dict(dx=-4, crouch=4, head_dy=2),
        dict(dx=6, lift=4, mouth=1, reach=1, head_dy=-1),
        dict(dx=14, lift=2, mouth=1, reach=2, claw=1),
        dict(dx=6, mouth=0.5),
    ]
    p += [dict(dx=-2, crouch=5, head_dy=4, mouth=1), dict(dx=-2, crouch=5, head_dy=4, mouth=0.6)]  # defesa: rosnando
    p += [dict(dx=-6, tilt=8, head_dy=-3, mouth=0.6), dict(dx=-3, tilt=4)]  # atingido
    p += [dict(dx=-8, lift=8, phase=1.2, walk=1), dict(dx=-16, lift=10, phase=2.4, walk=1), dict(dx=-10, lift=2)]  # esquiva
    for i in range(4):  # vitória: rugido com a cabeça erguida
        p.append(dict(head_dy=-5 - (i % 2) * 2, mouth=1 if i % 2 == 0 else 0.7, rear=4 + (i % 2) * 2, tail=1))
    for i in range(4):  # derrota: cai de lado
        p.append(dict(fall=(i + 1) / 4))
    assert len(p) == 29
    return p


def _draw(kind, pose):
    k = KINDS[kind]
    body, belly, extra = hexc(k["body"]), hexc(k["belly"]), hexc(k["extra"])
    img = new_img(FW, FH)
    d = ImageDraw.Draw(img)
    L, Hh, leg, hs = k["length"], k["height"], k["leg"], k["head"]
    fall = pose.get("fall", 0)
    if fall:
        # derrota: as pernas dobram, o corpo desce até o chão e a cabeça tomba
        leg = max(2, int(leg * (1 - fall * 0.85)))
        pose = dict(pose, head_dy=pose.get("head_dy", 0) + fall * (leg + 6), dx=pose.get("dx", 0) - fall * 4)
    dx = pose.get("dx", 0)
    lift = pose.get("lift", 0)
    crouch = pose.get("crouch", 0)
    rear = pose.get("rear", 0)
    breath = pose.get("breath", 0)
    cx = FEET[0] + dx - 4
    ground = FEET[1]
    hip_y = ground - leg - lift + crouch
    top = hip_y - Hh + int(breath)
    # pernas (traseiras e dianteiras, cada par com fase oposta)
    phase = pose.get("phase", 0)
    walk = pose.get("walk", 0)
    reach = pose.get("reach", 0)
    legs = [(-L * 0.32, 0), (-L * 0.22, math.pi), (L * 0.26, math.pi), (L * 0.36, 0)]
    for i, (lx, ph) in enumerate(legs):
        hx = cx + lx
        swing = math.sin(phase + ph) * 5 * walk
        fx = hx + swing + (reach * 5 if i >= 2 else 0)
        fy = ground - (max(0, math.cos(phase + ph)) * 3 * walk) - lift * 0.4
        hy = hip_y - 2 - (rear if i >= 2 else 0)
        col = darker(body, 0.78) if i in (1, 2) else body
        d.line([(hx, hy), (fx, fy)], fill=col, width=5 if kind == "bear" else 4)
        d.rectangle([fx - 2, fy - 2, fx + 3, fy], fill=darker(col, 0.7))
        if pose.get("claw") and i == 3:
            for c in range(3):
                d.point((fx + 4, fy - 2 + c), fill=hexc("f0ead8"))
    # cauda
    tail = pose.get("tail", 0)
    tx, ty = cx - L / 2, top + 5
    if kind == "lion":
        ex, ey = tx - 12, ty + 6 - tail * 5
        d.line([(tx, ty), (ex, ey)], fill=body, width=2)
        d.ellipse([ex - 3, ey - 3, ex + 2, ey + 2], fill=extra)
    elif kind == "wolf":
        d.polygon([(tx, ty), (tx - 14, ty + 8 - tail * 3), (tx - 10, ty + 11 - tail * 3), (tx, ty + 6)], fill=darker(body, 0.85))
    elif kind == "boar":
        d.line([(tx, ty), (tx - 4, ty + 6 + tail)], fill=body, width=1)
    else:
        d.ellipse([tx - 4, ty - 1, tx + 2, ty + 4], fill=body)
    # tronco (inclinado ao empinar)
    d.polygon([(cx - L / 2, top + 3), (cx + L / 2 - 4, top - rear), (cx + L / 2, hip_y - 2 - rear / 2), (cx - L / 2 + 2, hip_y)], fill=body)
    d.ellipse([cx - L / 2 - 3, top + 1, cx - L / 2 + 13, hip_y + 1], fill=body)
    d.ellipse([cx + L / 2 - 14, top - rear - 2, cx + L / 2 + 4, hip_y - rear / 2 + 1], fill=body)
    d.polygon([(cx - L / 2 + 6, hip_y - 3), (cx + L / 2 - 6, hip_y - 4 - rear / 2), (cx + L / 2 - 8, hip_y - rear / 2), (cx - L / 2 + 8, hip_y + 1)], fill=belly)
    if kind == "boar":  # crina eriçada
        for x in range(int(cx - L / 2 + 6), int(cx + L / 2 - 4), 3):
            d.line([(x, top + 2), (x + 1, top - 2)], fill=darker(body, 0.6))
    if kind == "wolf":
        d.polygon([(cx + L / 2 - 16, top - rear), (cx + L / 2, top - rear - 2), (cx + L / 2 - 2, top + 6 - rear)], fill=darker(body, 0.85))
    # cabeça
    hx = cx + L / 2 + 4 + reach * 2
    hy = top - 2 - rear + pose.get("head_dy", 0)
    mouth = pose.get("mouth", 0)
    if kind == "lion":
        d.ellipse([hx - hs - 5, hy - hs - 4, hx + hs - 1, hy + hs + 6], fill=extra)  # juba
        d.ellipse([hx - hs - 2, hy - hs - 6, hx + 2, hy - hs + 2], fill=extra)
    d.ellipse([hx - hs + 2, hy - hs + 1, hx + hs - 2, hy + hs - 1], fill=body)
    # focinho
    sn = {"lion": 8, "bear": 8, "wolf": 10, "boar": 11}[kind]
    d.polygon([(hx, hy - 3), (hx + sn, hy - 1), (hx + sn, hy + 4 - mouth * 1), (hx, hy + 5)], fill=lighter(body, 0.12) if kind != "boar" else body)
    if mouth > 0:
        mo = int(2 + mouth * 4)
        d.polygon([(hx + 1, hy + 3), (hx + sn + 1, hy + 3 + mo), (hx + sn - 2, hy + 5 + mo), (hx, hy + 6)], fill=lighter(body, 0.05))
        d.polygon([(hx + 2, hy + 3), (hx + sn, hy + 3), (hx + sn - 1, hy + 2 + mo), (hx + 2, hy + 5)], fill=hexc("5a1a1a"))
        d.point((hx + sn - 1, hy + 3), fill=hexc("f4eee0"))
        d.point((hx + sn - 2, hy + 1 + mo), fill=hexc("f4eee0"))
    d.rectangle([hx + sn - 1, hy - 2, hx + sn + 1, hy], fill=hexc("2a1a14"))  # nariz
    d.rectangle([hx + 2, hy - 4, hx + 3, hy - 3], fill=hexc("1a1210"))  # olho
    if kind in ("lion", "wolf"):
        d.point((hx + 3, hy - 4), fill=hexc("f0d040"))
    # orelhas e presas
    if kind == "wolf":
        d.polygon([(hx - 5, hy - 6), (hx - 2, hy - 14), (hx + 1, hy - 6)], fill=body)
        d.polygon([(hx - 1, hy - 6), (hx + 2, hy - 13), (hx + 4, hy - 6)], fill=darker(body, 0.8))
    elif kind == "bear":
        d.ellipse([hx - 7, hy - 12, hx - 2, hy - 7], fill=body)
        d.ellipse([hx - 1, hy - 13, hx + 4, hy - 8], fill=body)
    elif kind == "boar":
        d.polygon([(hx - 4, hy - 6), (hx - 3, hy - 13), (hx + 1, hy - 6)], fill=darker(body, 0.8))
        d.line([(hx + sn - 3, hy + 4), (hx + sn + 1, hy - 2)], fill=extra, width=2)
    else:
        d.ellipse([hx - 4, hy - 9, hx, hy - 5], fill=body)
    img = finish(img, light=0.26, dark=0.68)
    # inclinação ao ser atingido e queda na derrota (gira em torno dos pés)
    tilt = pose.get("tilt", 0) - fall * 6
    if tilt:
        img = img.rotate(tilt, resample=Image.NEAREST, center=FEET)
    return img


def sheets():
    out = {}
    poses = _poses()
    for kind in KINDS:
        sheet = new_img(FW * len(poses), FH)
        for i, pose in enumerate(poses):
            sheet.alpha_composite(_draw(kind, pose), (i * FW, 0))
        out[f"beast_{kind}"] = sheet
    return out


def icons():
    """Ícones 16x16 das feras (cabeça) para o painel e o HUD."""
    out = {}
    poses = _poses()
    for kind in KINDS:
        frame = _draw(kind, poses[0])
        bbox = frame.getbbox()
        crop = frame.crop(bbox)
        crop.thumbnail((32, 32), Image.NEAREST)
        icon = new_img(32, 32)
        icon.alpha_composite(crop, ((32 - crop.width) // 2, 32 - crop.height))
        out[f"beast_{kind}"] = icon
    return out


def portraits():
    """Retratos 48x48 (cabeça da fera), no mesmo fundo dos retratos dos gladiadores."""
    out = {}
    poses = _poses()
    for kind in KINDS:
        frame = _draw(kind, dict(poses[25 - 4], mouth=0.8))  # vitória: rugindo
        bbox = frame.getbbox()
        # recorte 24x24 centrado na cabeça (canto superior direito do corpo), ampliado 2x
        cx, cy = bbox[2] - 14, bbox[1] + 12
        crop = frame.crop((cx - 13, cy - 11, cx + 11, cy + 13)).resize((48, 48), Image.NEAREST)
        img = Image.new("RGBA", (48, 48), (80, 59, 46, 255))
        d = ImageDraw.Draw(img)
        for y in range(48):  # fundo com leve degradê
            d.line([(0, y), (47, y)], fill=(80 - y // 4, 59 - y // 5, 46 - y // 6, 255))
        img.alpha_composite(crop)
        out[f"beast_{kind}"] = img
    return out
