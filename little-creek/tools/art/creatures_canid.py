"""Fox (raposa-do-campo) and maned wolf (lobo-guará, rare) on rig.py.

Same skeleton, different proportions: the fox is low with a long bushy tail,
the maned wolf has very long black-stockinged legs, big ears and a dark mane.
"""
import math

from palette import ramp, hx, SHADOW, CREAM
from rig import Part, Rig

NOSE = ramp("#0c1014", "#171b1d", "#2a2d30")
EYE = hx("#0e0c0a")

SPECIES = {
    "fox": {
        "W": 52, "H": 34,
        "coat": ramp("#2a1408", "#4a2410", "#6e3616", "#93491c", "#b25d24", "#c9763a", "#da9456", "#e8b37a"),
        "legs": ramp("#120c0a", "#22160f", "#352418", "#4a3322", "#5e4430"),
        "pale": ramp("#9a8c78", "#c2b59c", "#ddd2bb", "#efe7d6", "#faf6ec"),
        "tail_tip": True, "mane": False,
        "body": 11.0, "leg": 6.6, "neck": 5.0, "head": 1.0, "tail": 15.0, "tail_w": 3.4, "ear": 1.0,
    },
    "wolf": {
        "W": 64, "H": 58,
        "coat": ramp("#3a1a08", "#5e2c10", "#86401a", "#a85522", "#c66c2e", "#da8a44", "#e8a862", "#f0c488"),
        "legs": ramp("#08080a", "#121214", "#1c1c1e", "#2a2a2c", "#3a3836"),
        "pale": ramp("#a89a84", "#cbbfa6", "#e0d6c0", "#f0e9da", "#faf6ec"),
        "tail_tip": True, "mane": True,
        "body": 13.5, "leg": 13.0, "neck": 7.0, "head": 1.15, "tail": 11.0, "tail_w": 2.6, "ear": 1.5,
    },
}


def build(key):
    c = SPECIES[key]
    b, lg, nk, hs, tl, tw, ek = c["body"], c["leg"], c["neck"], c["head"], c["tail"], c["tail_w"], c["ear"]
    bones = {
        "torso": (None, (0.0, -(lg * 2 + 5))),
        "neck": ("torso", (b * 0.75, -1.5)),
        "head": ("neck", (nk, 0.0)),
        "ear_n": ("head", (0.6 * hs, -2.2 * hs)), "ear_f": ("head", (1.6 * hs, -2.4 * hs)),
        "tail": ("torso", (-b * 0.95, -1.0)),
        "fl_u": ("torso", (b * 0.6, 1.5)), "fl_l": ("fl_u", (lg, 0.0)), "fl_p": ("fl_l", (lg * 0.9, 0.0)),
        "ff_u": ("torso", (b * 0.5, 1.2)), "ff_l": ("ff_u", (lg, 0.0)), "ff_p": ("ff_l", (lg * 0.9, 0.0)),
        "hl_u": ("torso", (-b * 0.7, 0.5)), "hl_l": ("hl_u", (lg * 1.05, 0.0)), "hl_p": ("hl_l", (lg * 0.95, 0.0)),
        "hf_u": ("torso", (-b * 0.8, 0.2)), "hf_l": ("hf_u", (lg * 1.05, 0.0)), "hf_p": ("hf_l", (lg * 0.95, 0.0)),
    }
    torso = [(b + 1.5, -1.0), (b * 0.7, -4.0), (0, -4.2), (-b * 0.7, -4.4), (-b - 1.2, -2.6), (-b - 1.4, 1.2),
             (-b * 0.6, 3.6), (0, 3.4), (b * 0.6, 3.8), (b + 1.4, 2.2)]
    belly = [(-b * 0.5, 2.8), (0, 3.6), (b * 0.6, 4.0), (b * 0.4, 2.2), (-b * 0.4, 1.8)]
    neck = [(-1.5, -3.2), (nk * 0.6, -2.6), (nk + 1.2, -1.8), (nk + 1.8, 0.4), (nk + 1, 2.4), (nk * 0.5, 3.0),
            (-1.5, 3.8)]
    throat = [(nk * 0.3, 1.8), (nk + 1.0, 1.0), (nk + 1.0, 2.4), (nk * 0.3, 3.6)]
    mane = [(-2.0, -3.6), (nk * 0.7, -3.4), (nk + 1.0, -2.0), (nk * 0.6, -1.4), (-1.0, -1.6)]
    H = lambda pts: [(x * hs, y * hs) for x, y in pts]
    head = H([(-1.8, -1.8), (0.4, -2.8), (3.0, -2.2), (5.4, -1.2), (7.6, -0.4), (8.0, 0.6), (6.8, 1.4),
              (4.2, 2.0), (1.2, 2.8), (-1.6, 1.8)])
    muzzle_pale = H([(3.2, 0.6), (7.0, 0.8), (6.6, 1.4), (4.0, 2.0), (2.6, 1.8)])
    nose = H([(7.0, -0.6), (8.1, -0.2), (8.2, 0.7), (7.2, 0.7)])
    ear = [(0.0, -1.2 * ek), (2.4 * ek, -1.2 * ek), (4.6 * ek, 0.0), (2.4 * ek, 1.2 * ek), (0.0, 1.2 * ek)]
    ear_in = [(0.8, -0.6 * ek), (2.8 * ek, -0.5 * ek), (3.6 * ek, 0.0), (2.8 * ek, 0.5 * ek), (0.8, 0.5 * ek)]
    tail = [(0.0, -tw * 0.7), (tl * 0.4, -tw * 1.1), (tl * 0.8, -tw * 1.0), (tl + 1.0, 0.0), (tl * 0.8, tw * 1.0),
            (tl * 0.4, tw * 1.1), (0.0, tw * 0.7)]
    tip = [(tl * 0.72, -tw * 1.0), (tl + 1.0, 0.0), (tl * 0.72, tw * 1.0)]
    up = [(-2.5, -2.4), (lg * 0.5, -1.8), (lg, -1.0), (lg + 0.4, 0.0), (lg, 1.1), (lg * 0.5, 1.8), (-2.5, 2.6)]
    lo = [(0.0, -0.9), (lg * 0.9, -0.7), (lg * 0.9 + 0.3, 0.0), (lg * 0.9, 0.7), (0.0, 0.9)]
    paw = [(-0.3, -1.2), (1.2, -1.4), (2.2, -0.4), (2.0, 1.0), (-0.3, 1.0)]
    coat, legs, pale = c["coat"], c["legs"], c["pale"]
    legs_far = legs[:4]
    P = []
    z = 0
    for pre in ("hf", "ff"):
        P += [Part(pre + "_u", pre + "_u", up, coat[:6], z, bias=-0.1, tex=0.05),
              Part(pre + "_l", pre + "_l", lo, legs_far, z + 1, bias=-0.05, tex=0.0, vgrad=0.0),
              Part(pre + "_p", pre + "_p", paw, legs_far, z + 2, bias=-0.05, tex=0.0, foot=True)]
        z += 3
    P.append(Part("ear_f", "ear_f", ear, coat, z, bias=-0.15, tex=0.0))
    z += 1
    P.append(Part("tail", "tail", tail, coat, z, bias=0.05, tex=0.09, tex_scale=1.4))
    if c["tail_tip"]:
        P.append(Part("tip", "tail", tip, pale, z + 1, bias=0.2, clip="tail", tex=0.0))
    z += 2
    P.append(Part("torso", "torso", torso, coat, z, bias=0.04, tex=0.07, tex_scale=1.6, vgrad=0.15))
    P.append(Part("belly", "torso", belly, pale, z + 1, bias=0.1, clip="torso", tex=0.0))
    z += 2
    P.append(Part("neck", "neck", neck, coat, z, bias=0.05, tex=0.06))
    P.append(Part("throat", "neck", throat, pale, z + 1, bias=0.15, clip="neck", tex=0.0))
    if c["mane"]:
        P.append(Part("mane", "neck", mane, legs, z + 2, bias=0.2, clip="neck", tex=0.05))
    z += 3
    P.append(Part("head", "head", head, coat, z, bias=0.08, tex=0.04))
    P.append(Part("muzzle", "head", muzzle_pale, pale, z + 1, bias=0.1, clip="head", tex=0.0))
    P.append(Part("nose", "head", nose, NOSE, z + 2, bias=0.0, clip="head", tex=0.0))
    z += 3
    P.append(Part("ear_n", "ear_n", ear, coat, z, bias=0.02, tex=0.0))
    P.append(Part("ear_in", "ear_n", ear_in, legs if c["mane"] else pale, z + 1, bias=0.1, clip="ear_n", tex=0.0))
    z += 2
    for pre in ("hl", "fl"):
        P += [Part(pre + "_u", pre + "_u", up, coat, z, bias=0.0, tex=0.06),
              Part(pre + "_l", pre + "_l", lo, legs, z + 1, bias=0.05, tex=0.0, vgrad=0.0),
              Part(pre + "_p", pre + "_p", paw, legs, z + 2, bias=0.05, tex=0.0, foot=True)]
        z += 3
    dots = [("head", (3.2 * hs, -0.9 * hs), EYE)]
    return Rig(bones, P, [], dots), c


def base():
    return {"torso": 0.0, "neck": -40.0, "head": 52.0, "ear_n": -145.0, "ear_f": -152.0, "tail": 160.0,
            "fl_u": 88.0, "fl_l": 0.0, "fl_p": -8.0, "ff_u": 90.0, "ff_l": 0.0, "ff_p": -8.0,
            "hl_u": 100.0, "hl_l": -24.0, "hl_p": 16.0, "hf_u": 98.0, "hf_l": -24.0, "hf_p": 16.0}


def mod(**kw):
    p = base()
    for k, v in kw.items():
        p[k] += v
    return p


def walk(ph, trot=False):
    p = base()
    amp = 26 if trot else 20
    for leg, off, front in (("hl", 0.0, False), ("fl", 0.25 if not trot else 0.5, True),
                            ("hf", 0.5, False), ("ff", 0.75 if not trot else 0.0, True)):
        t = (ph + off) % 1.0
        swing = t < 0.4
        s = t / 0.4 if swing else (t - 0.4) / 0.6
        ang = (-amp + 2 * amp * s) if swing else (amp - 2 * amp * s)
        flex = math.sin(s * math.pi) if swing else 0.0
        if front:
            p[leg + "_u"] = 88 - ang
            p[leg + "_l"] = flex * 50
        else:
            p[leg + "_u"] = 100 - ang * 0.8
            p[leg + "_l"] = -24 - flex * 30
    p["tail"] += math.sin(ph * 2 * math.pi) * 5
    p["neck"] += math.sin(ph * 4 * math.pi) * 2
    return p


def frames(key):
    rig, c = build(key)
    W, H = c["W"], c["H"]
    seq = [("idle", base()), ("idle", mod(tail=6, ear_n=10)),
           ("sniff", mod(neck=70, head=-20, tail=-8)), ("sniff", mod(neck=74, head=-14, tail=-4)),
           ("look", mod(neck=-14, head=-8, ear_n=20, ear_f=20)),
           ("sit", mod(neck=-18, head=-10, ear_n=24, ear_f=24, tail=-30))]
    seq += [("walk", walk(i / 8)) for i in range(8)]
    seq += [("trot", walk(i / 6, True)) for i in range(6)]
    out, index = [], {}
    for facing in (1, -1):
        for name, p in seq:
            img = rig.render(p, (W, H), H - 2, facing=facing)
            key2 = name if facing > 0 else name + "_l"
            index.setdefault(key2, []).append(len(out))
            out.append(img)

    def A(k, order, fps, loop):
        return {"frames": [index[k][i] for i in order], "fps": fps, "loop": loop}
    anims = {}
    for sfx in ("", "_l"):
        anims["idle" + sfx] = A("idle" + sfx, [0, 0, 1, 0], 2, True)
        anims["sniff" + sfx] = A("sniff" + sfx, [0, 1, 0, 1, 1, 0], 4, True)
        anims["look" + sfx] = A("look" + sfx, [0], 1, True)
        anims["sit" + sfx] = A("sit" + sfx, [0], 1, True)
        anims["walk" + sfx] = A("walk" + sfx, list(range(8)), 9, True)
        anims["trot" + sfx] = A("trot" + sfx, list(range(6)), 11, True)
    return out, anims, {"shadow": [int(W * 0.55), 5], "directional": True}
