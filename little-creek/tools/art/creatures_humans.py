"""Three visitors with their own identity, built on rig.py.

  0  Seu Antonio - birdwatcher: safari hat, grey beard, olive vest over a cream
     shirt, khaki cargo pants, leather boots, binoculars.
  1  Lia - photographer: dark ponytail, coral windbreaker, black leggings,
     white sneakers, camera on a strap.
  2  Davi - hiker: curly hair, teal plaid shirt, jeans, big backpack with a
     rolled mat, hiking boots.
Proportions: ~6 heads tall, ~40 art px (about half the visible trunk of an
adult tree), feet anchored on the ground line.
"""
import math

import numpy as np

from palette import ramp, hx, SHADOW
from rig import Part, Rig

W, H = 36, 54
GROUND = H - 3

SKIN_L = ramp("#5e3a2a", "#7d5038", "#9c6a4b", "#b9845f", "#d29f78", "#e6bc96")
SKIN_M = ramp("#4f2f22", "#6b4130", "#8a5940", "#a87253", "#c18c69", "#d6a783")
SKIN_D = ramp("#2a1812", "#3d241a", "#553424", "#6e4630", "#875a3f", "#9f6f51")
EYE = hx("#10161a")


def plaid(lx, ly):
    a = (np.floor(lx / 2.6) % 2 == 0)
    b = (np.floor(ly / 2.6) % 2 == 0)
    return np.where(a & b, -0.24, np.where(a | b, -0.11, 0.0))


CHARS = [
    {  # Seu Antonio
        "skin": SKIN_L, "hair": ramp("#3e3d3b", "#6a655c", "#948d80", "#bdb6a6", "#d9d3c4"),
        "shirt": ramp("#6e6650", "#958b6c", "#b8ad8a", "#d4c9a6", "#e8dfc2"),
        "vest": ramp("#22301c", "#2f4226", "#3f5631", "#536c3e", "#6a844d", "#839c60"),
        "pants": ramp("#3f3524", "#5a4b32", "#776442", "#927c53", "#ab9466", "#c3ad7d"),
        "shoes": ramp("#1e140e", "#2f1f15", "#47301f", "#62432b", "#7c5737"),
        "sole": ramp("#141414", "#262422", "#3a3632"),
        "hat": ramp("#5e553f", "#857a5b", "#a99c77", "#c7ba92", "#ddd1aa"),
        "torso_len": 13.6, "thigh": 8.6, "shin": 8.4, "width": 1.08,
    },
    {  # Lia
        "skin": SKIN_M, "hair": ramp("#120d0b", "#211612", "#33221b", "#4a3226", "#634433"),
        "shirt": ramp("#6a2620", "#93372b", "#bb4c37", "#d96a4c", "#ec8d6a", "#f6b08f"),
        "pants": ramp("#0d1014", "#171b20", "#232930", "#323a42", "#434d56"),
        "shoes": ramp("#8f9590", "#b8bdb6", "#d8dcd3", "#eef0e8", "#ffffff"),
        "sole": ramp("#5a5e5c", "#7d827e", "#9fa49f"),
        "torso_len": 12.8, "thigh": 8.2, "shin": 8.0, "width": 0.9,
    },
    {  # Davi
        "skin": SKIN_D, "hair": ramp("#08090b", "#111316", "#1c1f23", "#2a2e33"),
        "shirt": ramp("#0f2c2e", "#174044", "#22585b", "#2f7272", "#448c88", "#5fa59c"),
        "pants": ramp("#121c30", "#1c2a48", "#283c63", "#36507d", "#4a6694", "#6481aa"),
        "shoes": ramp("#1c2019", "#2a3026", "#3b4335", "#4f5946", "#646f58"),
        "sole": ramp("#111111", "#22201e", "#34302c"),
        "pack": ramp("#4a2a14", "#663a1c", "#844d25", "#a1612f", "#b9773e", "#cf9054"),
        "mat": ramp("#24361c", "#344c27", "#466434", "#5b7d43"),
        "torso_len": 14.2, "thigh": 9.0, "shin": 8.8, "width": 1.0,
    },
]


CHARS.append({  # child of the family (shown with Lia and Davi)
    "skin": SKIN_M, "hair": ramp("#2a1a10", "#4a3220", "#6b4a2e", "#8c6640"),
    "shirt": ramp("#6e5a10", "#9a7f1c", "#c9a42f", "#e8c64e", "#f6df8a"),
    "pants": ramp("#1a3a2a", "#25543a", "#326e4b", "#43895d"),
    "shoes": ramp("#5a1a1a", "#8a2a26", "#b8443a", "#d96a5a"),
    "sole": ramp("#5a5e5c", "#7d827e", "#9fa49f"),
    "torso_len": 12.0, "thigh": 8.0, "shin": 7.8, "width": 1.0, "scale": 0.66,
})


def build(ci):
    c = CHARS[ci]
    tl, th, sh, wf = c["torso_len"], c["thigh"], c["shin"], c["width"]
    bones = {
        "pelvis": (None, (0.0, -20.0)),
        "torso": ("pelvis", (0.0, 0.0)),
        "neck": ("torso", (tl, 0.3)),
        "head": ("neck", (2.0, 0.0)),
        "pony": ("head", (3.6, -3.0)),
        "arm_f_u": ("torso", (tl - 1.4, -0.7)), "arm_f_l": ("arm_f_u", (6.3, 0.0)), "hand_f": ("arm_f_l", (5.7, 0.0)),
        "arm_n_u": ("torso", (tl - 1.4, 0.0)), "arm_n_l": ("arm_n_u", (6.3, 0.0)), "hand_n": ("arm_n_l", (5.7, 0.0)),
        "leg_f_u": ("pelvis", (-0.5, 0.2)), "leg_f_l": ("leg_f_u", (th, 0.0)), "foot_f": ("leg_f_l", (sh, 0.0)),
        "leg_n_u": ("pelvis", (0.5, 0.5)), "leg_n_l": ("leg_n_u", (th, 0.0)), "foot_n": ("leg_n_l", (sh, 0.0)),
    }
    k = wf
    torso = [(0.0, -3.0 * k), (3.0, -3.1 * k), (7.0, -2.6 * k), (tl - 3, -3.2 * k), (tl - 0.2, -2.5 * k),
             (tl + 0.6, -0.7), (tl + 0.4, 1.2), (tl - 1.2, 2.9 * k), (tl - 4.5, 3.4 * k), (6.0, 2.6 * k),
             (2.0, 2.8 * k), (0.0, 2.7 * k), (-0.9, 0.0)]
    neck = [(-0.5, -1.1), (2.4, -1.0), (2.4, 1.1), (-0.5, 1.2)]
    head = [(0.0, -1.6), (1.5, -2.9), (4.2, -3.2), (6.6, -1.8), (7.0, 0.4), (6.0, 2.4), (4.4, 3.0),
            (3.5, 3.7), (2.7, 3.1), (1.8, 3.1), (0.6, 2.7), (-0.2, 1.4), (0.2, 0.0)]
    up_arm = [(-1.2, -1.6 * k), (3.0, -1.45 * k), (6.3, -1.15 * k), (6.6, 0.1), (6.3, 1.2 * k), (3.0, 1.45 * k),
              (-1.2, 1.6 * k)]
    fore = [(0.0, -1.1 * k), (5.7, -0.9 * k), (5.9, 0.0), (5.7, 0.9 * k), (0.0, 1.1 * k)]
    hand = [(-0.2, -0.9), (1.6, -1.0), (2.4, -0.2), (2.0, 0.9), (0.0, 0.9)]
    thigh = [(-1.4, -2.3 * k), (4.0, -2.05 * k), (th, -1.55 * k), (th + 0.2, 0.0), (th, 1.55 * k), (4.0, 1.95 * k),
             (-1.4, 2.4 * k)]
    shin = [(0.0, -1.5 * k), (4.0, -1.3 * k), (sh, -1.1 * k), (sh + 0.2, 0.0), (sh, 1.1 * k), (4.0, 1.75 * k),
            (0.0, 1.55 * k)]
    shoe = [(-1.4, -1.1), (0.9, -1.3), (3.2, -0.6), (3.9, 0.6), (3.7, 1.5), (-1.6, 1.5)]
    sole = [(-1.8, 0.9), (4.2, 0.9), (4.2, 1.8), (-1.8, 1.8)]

    P = []
    sk, top, pants, shoes, sole_r = c["skin"], c["shirt"], c["pants"], c["shoes"], c["sole"]
    sleeve = top
    z = 0

    def limb_set(side, bias, zz):
        parts = [Part("leg_%s_u" % side, "leg_%s_u" % side, thigh, pants, zz, bias=bias, tex=0.03),
                 Part("leg_%s_l" % side, "leg_%s_l" % side, shin, pants, zz + 1, bias=bias, tex=0.03),
                 Part("foot_%s" % side, "foot_%s" % side, shoe, shoes, zz + 2, bias=bias + 0.05, tex=0.0, foot=True),
                 Part("sole_%s" % side, "foot_%s" % side, sole, sole_r, zz + 3, bias=0.0, clip="foot_%s" % side, tex=0.0)]
        return parts

    def arm_set(side, bias, zz):
        return [Part("arm_%s_u" % side, "arm_%s_u" % side, up_arm, sleeve, zz, bias=bias, tex=0.03),
                Part("arm_%s_l" % side, "arm_%s_l" % side, fore, sleeve, zz + 1, bias=bias, tex=0.03),
                Part("hand_%s" % side, "hand_%s" % side, hand, sk, zz + 2, bias=bias + 0.05, tex=0.0, vgrad=0.0)]

    P += limb_set("f", -0.12, z)
    z += 4
    P += arm_set("f", -0.14, z)
    z += 3
    if ci == 2:  # backpack behind the body + rolled mat
        pack = [(2.5, -1.5), (3.0, -6.8), (8.0, -7.8), (tl + 1.8, -7.2), (tl + 2.4, -3.0), (tl + 1.0, -1.0)]
        P.append(Part("pack", "torso", pack, c["pack"], z, bias=0.0, tex=0.04))
        P.append(Part("pack_pocket", "torso", [(4.0, -4.0), (4.2, -7.6), (8.5, -8.1), (8.6, -4.4)],
                      c["pack"], z + 1, bias=-0.12, clip="pack", tex=0.0))
        mat = [(tl + 1.6, -7.8), (tl + 4.4, -7.9), (tl + 4.6, -1.8), (tl + 1.8, -1.6)]
        P.append(Part("mat", "torso", mat, c["mat"], z + 2, bias=0.05, tex=0.0))
        z += 3
    P.append(Part("torso", "torso", torso, top, z, bias=0.04, tex=0.03, vgrad=0.12,
                  ))
    if ci == 2:
        P[-1].tex = 0.0
    z += 1
    if ci == 0:
        vest = [(1.2, -3.3), (tl - 0.6, -2.8), (tl - 0.2, -1.0), (tl - 3.2, 1.6), (tl - 4.6, 3.6), (1.2, 3.1)]
        P.append(Part("vest", "torso", vest, c["vest"], z, bias=0.02, clip="torso", tex=0.02))
        P.append(Part("pocket1", "torso", [(5.0, 1.0), (7.6, 1.0), (7.6, 3.4), (5.0, 3.4)], c["vest"], z + 1,
                      bias=-0.14, clip="vest", tex=0.0))
        P.append(Part("pocket2", "torso", [(8.6, 1.4), (10.6, 1.4), (10.6, 3.4), (8.6, 3.4)], c["vest"], z + 2,
                      bias=-0.14, clip="vest", tex=0.0))
        z += 3
    if ci == 1:
        P.append(Part("zip", "torso", [(1.0, 2.0), (tl - 0.6, 0.9), (tl - 0.6, 1.5), (1.0, 2.6)], top, z,
                      bias=0.22, clip="torso", tex=0.0))
        P.append(Part("hood", "torso", [(tl - 2.2, -3.4), (tl + 0.8, -3.8), (tl + 1.2, -1.6), (tl - 1.0, -1.8)],
                      top, z + 1, bias=-0.06, tex=0.0))
        z += 2
    if ci == 2:
        P.append(Part("strap", "torso", [(tl - 0.2, -1.6), (tl - 0.1, -0.6), (5.8, 2.9), (5.0, 2.1)],
                      c["pack"], z, bias=-0.15, clip="torso", tex=0.0))
        z += 1
    # belt/waist band of the trousers
    P.append(Part("waist", "torso", [(-1.0, -3.2), (1.6, -3.2), (1.6, 3.0), (-1.0, 3.0)], pants, z,
                  bias=-0.05, clip="torso", tex=0.0))
    z += 1
    P.append(Part("neck", "neck", neck, sk, z, bias=-0.1, tex=0.0))
    z += 1
    if ci == 1:  # ponytail behind the head
        P.append(Part("pony", "pony", [(0.0, -1.0), (2.0, -1.6), (5.2, -0.4), (6.0, 1.0), (3.0, 1.4), (0.0, 1.2)],
                      c["hair"], z, bias=0.0, tex=0.03))
        z += 1
    if ci == 2:  # curly volume outside the head outline
        curls = [(2.4, -3.5), (4.8, -4.2), (7.2, -3.0), (8.4, -0.8), (8.2, 1.6), (6.8, 3.0), (5.6, 1.8),
                 (3.0, -1.6)]
        P.append(Part("curls_back", "head", curls, c["hair"], z, bias=0.05, tex=0.1, tex_scale=0.9))
        z += 1
    P.append(Part("head", "head", head, sk, z, bias=0.06, tex=0.0, vgrad=0.05))
    z += 1
    hair_cap = {
        0: [(3.4, -3.6), (6.9, -2.2), (7.4, 0.6), (6.3, 1.6), (5.4, -0.4), (4.2, -1.6), (2.4, -3.2)],
        1: [(1.0, -3.4), (4.4, -3.6), (6.9, -2.0), (7.4, 0.6), (6.6, 2.5), (5.6, 1.2), (4.8, -0.8), (2.4, -1.2),
            (0.6, -2.0)],
        2: [(2.4, -3.6), (5.2, -3.8), (7.6, -2.0), (8.0, 1.0), (6.9, 2.7), (5.8, 1.6), (4.8, -0.6), (2.6, -1.6)],
        3: [(1.4, -3.4), (4.6, -3.7), (7.2, -2.2), (7.6, 0.8), (6.6, 2.2), (5.6, 0.8), (4.6, -1.0), (2.2, -1.4)],
    }[ci]
    P.append(Part("hair", "head", hair_cap, c["hair"], z, bias=0.04, tex=0.08 if ci == 2 else 0.03,
                  tex_scale=0.9 if ci == 2 else 2.0, clip=None if ci == 2 else "head"))
    z += 1
    if ci == 0:
        beard = [(0.2, -0.6), (1.2, 1.0), (2.1, 3.3), (0.8, 3.0), (-0.3, 1.8)]
        P.append(Part("beard", "head", beard, c["hair"], z, bias=0.06, clip="head", tex=0.05))
        P.append(Part("hat_crown", "head", [(5.6, -3.1), (8.8, -2.6), (9.1, 2.0), (6.0, 2.6)], c["hat"], z + 1,
                      bias=0.05, tex=0.02))
        P.append(Part("hat_brim", "head", [(5.4, -4.9), (6.4, -4.9), (6.6, 5.0), (5.6, 5.0)], c["hat"], z + 2,
                      bias=0.12, tex=0.0, smooth=False))
        P.append(Part("hat_band", "head", [(6.0, -3.0), (7.0, -3.0), (7.1, 2.4), (6.1, 2.4)], c["vest"], z + 3,
                      bias=-0.1, clip="hat_crown", tex=0.0, smooth=False))
        z += 4
    P += limb_set("n", 0.0, z)
    z += 4
    P += arm_set("n", 0.02, z)
    z += 3
    # cloth patterns
    for p in P:
        if ci == 2 and p.name in ("torso", "arm_n_u", "arm_f_u", "arm_n_l", "arm_f_l"):
            p.pattern = plaid
    dots = [("head", (4.3, 1.9), EYE), ("head", (5.1, 2.0), c["hair"][1]), ("head", (3.2, -0.4), sk[1])]
    lines = []
    if ci == 0:  # binoculars strap + binoculars on the chest
        lines.append(("torso", [(tl + 0.2, 0.9), (tl - 5.0, 2.6)], hx("#2a2018")))
        dots += [("torso", (tl - 5.0, 3.0), SHADOW[0]), ("torso", (tl - 5.8, 3.0), SHADOW[1]),
                 ("torso", (tl - 5.0, 3.8), SHADOW[2])]
    if ci == 1:  # camera on the strap
        lines.append(("torso", [(tl + 0.2, 1.0), (tl - 5.5, 2.9)], hx("#141414")))
        dots += [("torso", (tl - 5.6, 3.2), SHADOW[0]), ("torso", (tl - 6.4, 3.2), SHADOW[1]),
                 ("torso", (tl - 5.6, 4.0), hx("#5a7fd6"))]
    return Rig(bones, P, lines, dots, scale=c.get("scale", 1.0))


# ------------------------------------------------------------------ poses
def base():
    return {"pelvis": 0.0, "torso": -90.0, "neck": 0.0, "head": 0.0, "pony": 160.0,
            "arm_n_u": 178.0, "arm_n_l": -12.0, "hand_n": -8.0,
            "arm_f_u": 176.0, "arm_f_l": -14.0, "hand_f": -8.0,
            "leg_n_u": 90.0, "leg_n_l": 0.0, "foot_n": -90.0,
            "leg_f_u": 90.0, "leg_f_l": 0.0, "foot_f": -90.0}


def mod(**kw):
    p = base()
    for k, v in kw.items():
        p[k] = p[k] + v if k in p else v
    return p


def walk(ph):
    p = base()
    s = math.sin(ph * 2 * math.pi)
    for side, sg in (("n", 1), ("f", -1)):
        t = (ph + (0 if side == "n" else 0.5)) % 1.0
        swing = t < 0.45
        ang = 24 * math.sin(t * 2 * math.pi + math.pi / 2) * -1  # forward/back
        flex = math.sin(t / 0.45 * math.pi) * 42 if swing else 4.0
        p["leg_%s_u" % side] = 90 - ang
        p["leg_%s_l" % side] = flex
        p["foot_%s" % side] = -90 - flex * 0.35 + (ang * 0.3 if not swing else 0)
        p["arm_%s_u" % side] = 180 + ang * 0.8
        p["arm_%s_l" % side] = -14 - max(0.0, -ang) * 0.6
    p["torso"] = -86.0
    p["head"] = -4.0
    p["pony"] = 160 + 12 * s
    return p


def poses(ci):
    seq = []
    seq += [("idle", base()), ("idle", mod(head=-2, arm_n_l=-3, arm_f_l=-3, pony=4))]
    seq += [("walk", walk(i / 8)) for i in range(8)]
    sit = mod(torso=-3, leg_n_u=-88, leg_n_l=88, foot_n=0, leg_f_u=-84, leg_f_l=84, foot_f=0,
              arm_n_u=-30, arm_n_l=-6, arm_f_u=-28, arm_f_l=-8, pony=-30)
    seq += [("sit", sit), ("sit", dict(sit, head=6.0))]
    if ci == 3:  # child: points at things
        look = mod(arm_n_u=-96, arm_n_l=-6, head=-4)
        seq += [("look", look), ("look", dict(look, head=-8.0))]
    elif ci == 0:  # observe with binoculars
        look = mod(arm_n_u=-94, arm_n_l=-104, arm_f_u=-98, arm_f_l=-100, head=4)
        seq += [("look", look), ("look", dict(look, head=7.0))]
    else:  # hand shading the eyes
        look = mod(arm_n_u=-128, arm_n_l=-118, head=5)
        seq += [("look", look), ("look", dict(look, head=8.0))]
    photo = mod(arm_n_u=-96, arm_n_l=-100, arm_f_u=-100, arm_f_l=-98, head=2)
    seq += [("photo", photo), ("photo", dict(photo, head=6.0, torso=-89.0))]
    seq += [("feed", mod(arm_n_u=-6, arm_n_l=-55)), ("feed", mod(arm_n_u=-62, arm_n_l=-40)),
            ("feed", mod(arm_n_u=-86, arm_n_l=-8, head=3)), ("feed", mod(arm_n_u=-72, arm_n_l=12, head=3))]
    return seq


def frames(ci):
    rig = build(ci)
    seq = poses(ci)
    out, index = [], {}
    for facing in (1, -1):
        for name, p in seq:
            img = rig.render(p, (W, H), GROUND, facing=facing, outline_dark=2)
            # hand-held camera / binoculars in front of the face
            if name in ("photo",) or (name == "look" and ci == 0):
                hx_, hy_ = rig.point("hand_n", (1.4, 0.0), facing)
                gear = [(0, 0, SHADOW[0]), (1, 0, SHADOW[1]), (0, 1, SHADOW[1]), (1, 1, SHADOW[2]),
                        (-1, 0, SHADOW[1]), (-1, 1, SHADOW[0])]
                for dx, dy, col in gear:
                    x, y = int(round(hx_ + dx * facing)), int(round(hy_ + dy - 1))
                    if 0 <= x < W and 0 <= y < H:
                        img[y, x, :3] = col
                        img[y, x, 3] = 255
                if name == "photo":
                    x, y = int(round(hx_ + 2 * facing)), int(round(hy_ - 1))
                    if 0 <= x < W and 0 <= y < H:
                        img[y, x, :3] = hx("#5a7fd6")
                        img[y, x, 3] = 255
            key = name if facing > 0 else name + "_l"
            index.setdefault(key, []).append(len(out))
            out.append(img)

    def A(key, order, fps, loop):
        return {"frames": [index[key][i] for i in order], "fps": fps, "loop": loop}
    anims = {}
    for sfx in ("", "_l"):
        anims["idle" + sfx] = A("idle" + sfx, [0, 0, 1, 1], 2, True)
        anims["walk" + sfx] = A("walk" + sfx, list(range(8)), 9, True)
        anims["sit" + sfx] = A("sit" + sfx, [0, 0, 0, 1, 0, 0], 1.5, True)
        anims["look" + sfx] = A("look" + sfx, [0, 0, 1, 1], 1.5, True)
        anims["photo" + sfx] = A("photo" + sfx, [0, 1, 0], 2, False)
        anims["feed" + sfx] = A("feed" + sfx, [0, 1, 2, 3, 2, 1, 0], 7, False)
    return out, anims, {"shadow": [16, 5], "directional": True}
