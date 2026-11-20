"""Coelhos (tapiti-like wild rabbits) on rig.py: brown, grey, white-and-brown.

Anatomy: egg-shaped body with a heavy rump, big folded hind leg (thigh +
long foot), short front legs, round head, long upright ears, small cotton
tail. Poses: sit, ear twitch, look (alert, upright), nibble (head down),
hop cycle (crouch, push, airborne, land), loaf (resting, ears flat).
"""
import math

from palette import ramp, hx, SHADOW
from rig import Part, Rig

W, H = 30, 26
GROUND = H - 2

COATS = [
    {"fur": ramp("#2a1a10", "#3e2716", "#56381f", "#6e4a2a", "#875e38", "#a07648", "#b88f5f", "#cfaa7c"),
     "belly": ramp("#8a7a62", "#b3a283", "#d0c09c", "#e8dcbc"), "patch": None},
    {"fur": ramp("#1e1f20", "#2e3032", "#44464a", "#5b5e61", "#74777a", "#8e9193", "#a8aaab", "#c3c4c3"),
     "belly": ramp("#8c8c86", "#b2b1aa", "#d2d0c8", "#ecebe4"), "patch": None},
    {"fur": ramp("#8f8a80", "#b3aea3", "#cdc8bd", "#e2ddd2", "#efebe2", "#f7f4ee", "#fbf9f5", "#ffffff"),
     "belly": ramp("#a8a398", "#cbc6ba", "#e4dfd4", "#f6f3ec"),
     "patch": ramp("#2a1a10", "#3e2716", "#56381f", "#6e4a2a", "#875e38", "#a07648", "#b88f5f")},
]
EAR_IN = ramp("#7a4e44", "#a06a5c", "#c48a7a", "#dcaa98")
EYE = hx("#0c0a08")

BONES = {
    "body": (None, (0.0, -6.5)),
    "head": ("body", (6.0, -3.0)),
    "ear_f": ("head", (-0.4, -2.2)),
    "ear_n": ("head", (0.6, -2.4)),
    "tail": ("body", (-6.6, -1.2)),
    "thigh": ("body", (-3.0, 1.0)),
    "foot": ("thigh", (4.2, 0.0)),
    "fl_f": ("body", (3.6, 2.0)),
    "fl_n": ("body", (4.4, 2.2)),
}

BODY = [(6.4, -1.8), (4.6, -4.2), (1.0, -4.8), (-3.0, -4.9), (-6.0, -3.6), (-7.2, -0.6), (-6.4, 2.6),
        (-3.2, 4.0), (1.0, 3.8), (4.8, 3.0), (6.8, 1.0)]
BELLY = [(-3.0, 2.8), (1.0, 3.9), (4.8, 3.1), (4.2, 1.6), (0.0, 1.8), (-3.2, 1.4)]
PATCH = [(-6.4, -2.6), (-3.2, -4.6), (0.4, -4.4), (0.8, -1.4), (-2.4, 0.4), (-5.6, 0.0)]
HEAD = [(-1.6, -1.4), (0.2, -2.6), (2.6, -2.2), (4.2, -0.8), (4.8, 0.6), (4.0, 1.8), (2.0, 2.4),
        (-0.4, 2.2), (-1.8, 0.8)]
CHEEK = [(1.2, 0.6), (3.6, 0.4), (4.4, 1.4), (2.4, 2.2), (0.8, 1.8)]
EAR = [(0.0, -0.8), (2.4, -1.1), (5.6, -0.9), (7.4, 0.0), (5.6, 0.9), (2.4, 1.1), (0.0, 0.8)]
EAR_INNER = [(1.2, -0.4), (5.4, -0.4), (6.6, 0.0), (5.4, 0.4), (1.2, 0.4)]
TAIL = [(-0.2, -1.4), (1.4, -1.6), (2.4, -0.2), (1.6, 1.4), (-0.2, 1.2)]
THIGH = [(-2.4, -2.6), (1.6, -3.0), (4.4, -1.2), (4.8, 0.8), (2.0, 2.4), (-2.0, 2.4)]
FOOT = [(-0.6, -1.0), (3.6, -0.8), (5.6, -0.2), (5.6, 0.8), (-0.6, 0.9)]
FLEG = [(-0.6, -0.8), (3.6, -0.6), (3.8, 0.6), (-0.6, 0.8)]


def build(ci):
    c = COATS[ci]
    fur, belly = c["fur"], c["belly"]
    P = [Part("fl_f", "fl_f", FLEG, fur[:6], 0, bias=-0.12, tex=0.0, foot=True),
         Part("ear_f", "ear_f", EAR, fur, 1, bias=-0.1, tex=0.0),
         Part("tail", "tail", TAIL, belly, 2, bias=0.25, tex=0.0),
         Part("body", "body", BODY, fur, 3, bias=0.04, tex=0.08, tex_scale=1.2, vgrad=0.16),
         Part("belly", "body", BELLY, belly, 4, bias=0.15, clip="body", tex=0.0)]
    if c["patch"] is not None:
        P.append(Part("patch", "body", PATCH, c["patch"], 5, bias=0.05, clip="body", tex=0.05, tex_scale=1.2))
    P += [Part("thigh", "thigh", THIGH, fur, 6, bias=0.06, tex=0.07, tex_scale=1.2),
          Part("foot", "foot", FOOT, fur, 7, bias=0.0, tex=0.0, foot=True),
          Part("head", "head", HEAD, fur, 8, bias=0.08, tex=0.05, tex_scale=1.2),
          Part("cheek", "head", CHEEK, belly, 9, bias=0.05, clip="head", tex=0.0),
          Part("ear_n", "ear_n", EAR, fur, 10, bias=0.05, tex=0.0),
          Part("ear_in", "ear_n", EAR_INNER, EAR_IN, 11, bias=0.0, clip="ear_n", tex=0.0),
          Part("fl_n", "fl_n", FLEG, fur, 12, bias=0.0, tex=0.0, foot=True)]
    if c["patch"] is not None:
        P.append(Part("ear_p", "ear_n", EAR, c["patch"], 10.5, bias=0.05, tex=0.0))
        P.sort(key=lambda p: p.z)
    dots = [("head", (2.4, -0.6), EYE), ("head", (4.7, 0.6), hx("#5a3a34"))]
    return Rig(BONES, P, [], dots)


def base():
    return {"body": -8.0, "head": 18.0, "ear_f": -112.0, "ear_n": -104.0, "tail": 0.0,
            "thigh": 74.0, "foot": -74.0, "fl_f": 84.0, "fl_n": 82.0}


def mod(**kw):
    p = base()
    for k, v in kw.items():
        p[k] += v
    return p


def frames(ci):
    rig = build(ci)
    seq = [
        ("idle", base()),
        ("idle", mod(ear_n=6, ear_f=4)),
        ("ears", mod(ear_n=-14)), ("ears", mod(ear_f=-12, ear_n=8)),
        ("look", mod(body=-26, head=24, ear_n=-10, ear_f=-10, fl_f=12, fl_n=14, thigh=6, foot=-4)),
        ("eat", mod(body=10, head=40, ear_n=26, ear_f=22, fl_f=-10, fl_n=-8)),
        ("eat", mod(body=10, head=46, ear_n=28, ear_f=24, fl_f=-10, fl_n=-8)),
        ("rest", mod(body=6, head=-4, ear_n=72, ear_f=70, thigh=12, foot=-10, fl_f=40, fl_n=40)),
        # hop: crouch, push off, airborne (stretched), land
        ("hop", mod(body=6, head=-4, thigh=10, foot=-8)),
        ("hop", mod(body=-20, head=8, thigh=-60, foot=40, fl_f=-30, fl_n=-26, ear_n=14, ear_f=14)),
        ("hop", mod(body=-4, head=0, thigh=-40, foot=30, fl_f=-60, fl_n=-56, ear_n=24, ear_f=24)),
        ("hop", mod(body=14, head=-10, thigh=20, foot=-20, fl_f=-20, fl_n=-18, ear_n=10, ear_f=10)),
    ]
    lifts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1.5, 4.0, 0.5]
    out, index = [], {}
    for facing in (1, -1):
        for (name, p), lift in zip(seq, lifts):
            img = rig.render(p, (W, H), GROUND, facing=facing, lift=lift)
            key = name if facing > 0 else name + "_l"
            index.setdefault(key, []).append(len(out))
            out.append(img)

    def A(k, order, fps, loop):
        return {"frames": [index[k][i] for i in order], "fps": fps, "loop": loop}
    anims = {}
    for sfx in ("", "_l"):
        anims["idle" + sfx] = A("idle" + sfx, [0, 0, 0, 1, 0, 0], 3, True)
        anims["ears" + sfx] = A("ears" + sfx, [0, 1, 0], 7, False)
        anims["look" + sfx] = A("look" + sfx, [0], 1, True)
        anims["eat" + sfx] = A("eat" + sfx, [0, 1, 0, 1, 1, 0], 5, True)
        anims["rest" + sfx] = A("rest" + sfx, [0], 1, True)
        anims["hop" + sfx] = A("hop" + sfx, [0, 1, 2, 3], 10, True)
    return out, anims, {"shadow": [14, 4], "directional": True}
