"""Creature sprite sheets + data/creatures.json metadata.

Small creatures (birds, butterflies, dragonflies, fish) are hand-authored
pixel grids. The deer and human visitors are painted from a small skeleton
(capsules/ellipses with normal shading) so every animation pose is coherent.
All face RIGHT; the engine flips them horizontally.
"""
import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from palette import *  # noqa
from pixlib import *  # noqa

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ANI = os.path.join(ROOT, "assets", "sprites", "animals")
HUM = os.path.join(ROOT, "assets", "sprites", "humans")
META = {}


def sheet(name, frames, anims, folder):
    path = os.path.join(folder, name + ".png")
    fw, fh = save_sheet(frames, path)
    rel = "res://" + os.path.relpath(path, ROOT).replace(os.sep, "/")
    META[name] = {"sheet": rel, "w": fw, "h": fh, "anims": anims}


# ------------------------------------------------------------------ birds
BIRD = {
    "idle": [
        ".............",
        "......ooo....",
        ".....oBBBo...",
        ".....bBBeByy.",
        "....obbbbcc..",
        "...obbbbrrc..",
        "..odddbbrRr..",
        ".odddddrRRr..",
        "o.o..ddrrro..",
        "......l.l....",
    ],
    "blink": None,  # derived
    "peck": [
        ".............",
        ".............",
        ".............",
        "......ooo....",
        "....obBBBo...",
        "...obbbBBeo..",
        "..odddbbbcByy",
        ".odddddrrRc..",
        "o.o..ddrrro..",
        "......l.l....",
    ],
    "sing": [
        ".............",
        "......ooo..y.",
        ".....oBBBoy..",
        ".....bBBeB...",
        "....obbbbcy..",
        "...obbbbrrcy.",
        "..odddbbrRr..",
        ".odddddrRRr..",
        "o.o..ddrrro..",
        "......l.l....",
    ],
    "fly0": [
        "..oo.........",
        "..oBdo.......",
        "...oBdd.ooo..",
        "....oBddBBeyy",
        ".oddddbbbcc..",
        "o..odbbrRRo..",
        ".....orrro...",
        ".............",
        ".............",
        ".............",
    ],
    "fly1": [
        ".............",
        ".............",
        "........ooo..",
        ".......oBBeyy",
        ".odddddbbcc..",
        "o..oBBBbrRo..",
        ".....orrro...",
        ".............",
        ".............",
        ".............",
    ],
    "fly2": [
        ".............",
        ".............",
        "........ooo..",
        ".......oBBeyy",
        ".oddddbbbcc..",
        "o..odbbrRRo..",
        "....oBddro...",
        "...oBdo......",
        "...oo........",
        ".............",
    ],
}


def bird_frames(colors):
    b = dict(BIRD)
    blink = [r.replace("e", "B") for r in BIRD["idle"]]
    order = ["idle", "blink", "peck", "sing", "fly0", "fly1", "fly2"]
    frames = []
    for k in order:
        rows = blink if k == "blink" else b[k]
        frames.append(from_ascii(rows, colors))
    anims = {
        "idle": {"frames": [0, 0, 0, 1, 0, 0], "fps": 3, "loop": True},
        "peck": {"frames": [0, 2, 2, 0], "fps": 6, "loop": False},
        "sing": {"frames": [3, 0, 3, 0, 3, 3, 0], "fps": 7, "loop": False},
        "fly": {"frames": [4, 5, 6, 5], "fps": 12, "loop": True},
        "glide": {"frames": [5], "fps": 1, "loop": True},
    }
    return frames, anims


SABIA = {"o": FEATHER_BROWN[0], "b": FEATHER_BROWN[2], "B": FEATHER_BROWN[4], "d": FEATHER_BROWN[1],
         "r": FEATHER_ORANGE[2], "R": FEATHER_ORANGE[3], "c": CREAM[2], "y": FLOWER["yellow"][1],
         "e": SHADOW[0], "l": EARTH[3]}
SAIRA = {"o": SHADOW[1], "b": ramp("#1e2b34")[0], "B": hx("#79d4a8"), "d": hx("#2b6a70"),
         "r": FLOWER["blue"][2], "R": FLOWER["blue"][3], "c": hx("#3fa0a8"), "y": SHADOW[3],
         "e": SHADOW[0], "l": SHADOW[3]}


# ------------------------------------------------------------------ butterflies
BFLY = [
    [".ww...ww.",
     "wWWw.wWWw",
     "wWAwbwAWw",
     ".wWWbWWw.",
     ".wAw.wAw.",
     "..w...w.."],
    [".........",
     "..ww.ww..",
     ".wWAbAWw.",
     "..wWbWw..",
     "..wA.Aw..",
     "........."],
    [".........",
     "....w....",
     "...wWb...",
     "...wAb...",
     "....wb...",
     "........."],
]


def butterfly_colors(main):
    r = FLOWER[main]
    return {"w": SHADOW[1] if main != "white" else r[0], "W": r[2], "A": r[3], "b": SHADOW[0]}


# ------------------------------------------------------------------ dragonfly / fish
DFLY = [
    ["..wW..Ww..",
     "...wWWw...",
     "ttttttbbh.",
     ".........."],
    ["..........",
     "ttttttbbh.",
     "...wWWw...",
     "..wW..Ww.."],
]
DFLY_C = {"w": (216, 240, 230, 150), "W": (255, 255, 255, 200), "t": FLOWER["blue"][1],
          "b": hx("#2b6a70"), "h": SHADOW[2]}

FISH = [
    ["t...sss...",
     ".tssSSSSse",
     "t...sss..."],
    ["....sss...",
     "ttssSSSSse",
     "....sss..."],
    [".t..sss...",
     "..ssSSSSse",
     ".t..sss..."],
]
FISH_C = {"s": hx("#647069"), "S": hx("#b7bc9f"), "t": FEATHER_ORANGE[2], "e": SHADOW[0]}


# ------------------------------------------------------------------ skeleton painter
class Body:
    """Accumulates shaded primitives into a value+mask buffer, then quantizes."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.val = np.zeros((h, w), np.float32)
        self.ramp_id = np.full((h, w), -1, np.int32)
        self.ramps = []
        self.xs, self.ys = grid(w, h)

    def _ramp(self, r):
        for i, rr in enumerate(self.ramps):
            if rr is r:
                return i
        self.ramps.append(r)
        return len(self.ramps) - 1

    def capsule(self, a, b, r0, r1, ramp_cols, bias=0.0, light=(0.55, -0.83)):
        ax, ay = a
        bx, by = b
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy + 1e-6
        t = np.clip(((self.xs - ax) * dx + (self.ys - ay) * dy) / L2, 0, 1)
        cx, cy = ax + t * dx, ay + t * dy
        r = r0 + (r1 - r0) * t
        ddx, ddy = self.xs - cx, self.ys - cy
        d = np.sqrt(ddx ** 2 + ddy ** 2)
        m = d <= r
        nx, ny = ddx / (r + 1e-6), ddy / (r + 1e-6)
        v = 0.5 + 0.35 * (nx * light[0] + ny * light[1]) + bias
        self.val[m] = v[m]
        self.ramp_id[m] = self._ramp(ramp_cols)

    def ellipse(self, c, rx, ry, ramp_cols, bias=0.0, rot=0.0, light=(0.55, -0.83), belly=None):
        ca, sa = math.cos(rot), math.sin(rot)
        dx, dy = self.xs - c[0], self.ys - c[1]
        u = (dx * ca + dy * sa) / rx
        w = (-dx * sa + dy * ca) / ry
        m = u * u + w * w <= 1.0
        nx = u * ca - w * sa
        ny = u * sa + w * ca
        v = 0.5 + 0.35 * (nx * light[0] + ny * light[1]) + bias
        self.val[m] = v[m]
        rid = self._ramp(ramp_cols)
        self.ramp_id[m] = rid
        if belly is not None:
            bm = m & (w > 0.35)
            self.ramp_id[bm] = self._ramp(belly)
            self.val[bm] = (0.55 + 0.2 * (1 - w))[bm]

    def px(self, x, y, ramp_cols, v):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h:
            self.val[y, x] = v
            self.ramp_id[y, x] = self._ramp(ramp_cols)

    def render(self, outline=None):
        out = np.zeros((self.h, self.w, 4), np.uint8)
        for i, r in enumerate(self.ramps):
            m = self.ramp_id == i
            n = len(r)
            idx = np.clip(np.round(np.clip(self.val, 0, 1) * (n - 1)), 0, n - 1).astype(int)
            cols = np.array(r, np.uint8)[idx]
            out[m, :3] = cols[m]
            out[m, 3] = 255
        if outline is not None:
            a = out[..., 3] > 0
            nb = np.zeros_like(a)
            nb[1:, :] |= a[:-1, :]
            nb[:-1, :] |= a[1:, :]
            nb[:, 1:] |= a[:, :-1]
            nb[:, :-1] |= a[:, 1:]
            o = nb & ~a
            out[o, :3] = outline
            out[o, 3] = 255
        return out


def polar(origin, ang, length):
    return (origin[0] + math.cos(ang) * length, origin[1] + math.sin(ang) * length)


# ------------------------------------------------------------------ deer
DEER_FUR = FUR[1:8]
DEER_DARK = FUR[0:6]
DEER_BELLY = CREAM


def deer_frame(legs, neck_ang, head_tilt=0.0, ear=0.0, tail=0.0, bob=0.0):
    """legs: 4 tuples (upper_ang, lower_ang) in radians from vertical; order
    far_back, far_front, near_back, near_front."""
    b = Body(34, 30)
    gy = 27
    body_c = (15.0, 15.0 + bob)
    hip = (9.5, 15.5 + bob)
    shoulder = (20.0, 15.0 + bob)

    def leg(base, ua, la, ramp_cols, bias):
        knee = polar(base, math.pi / 2 + ua, 5.6)
        foot = polar(knee, math.pi / 2 + la, 5.4)
        b.capsule(base, knee, 1.5, 1.0, ramp_cols, bias)
        b.capsule(knee, foot, 0.85, 0.6, ramp_cols, bias)
        b.px(foot[0], foot[1], FUR[:3], 0.1)

    leg((hip[0] + 1, hip[1] + 1), *legs[0], DEER_DARK, -0.05)
    leg((shoulder[0] - 1, shoulder[1] + 1), *legs[1], DEER_DARK, -0.05)
    # tail
    b.ellipse((5.2, 11.5 + bob + tail), 1.4, 2.0, DEER_FUR, 0.0, rot=-0.5)
    b.px(4.6, 12.8 + bob + tail, CREAM, 0.9)
    b.ellipse(body_c, 9.0, 4.6, DEER_FUR, 0.02, belly=DEER_BELLY)
    b.ellipse((8.5, 13.5 + bob), 3.8, 4.0, DEER_FUR, 0.03)  # rump
    b.ellipse((20.0, 14.0 + bob), 3.6, 4.2, DEER_FUR, 0.0)  # chest
    # neck + head
    nb = (21.5, 12.0 + bob)
    head = polar(nb, neck_ang, 8.0)
    b.capsule(nb, head, 2.6, 1.8, DEER_FUR, 0.05)
    ha = neck_ang + 1.2 + head_tilt  # head points forward/down relative to neck
    snout = polar(head, ha, 3.4)
    b.ellipse(head, 2.6, 2.1, DEER_FUR, 0.08, rot=ha)
    b.capsule(head, snout, 1.6, 1.0, DEER_FUR, 0.1)
    b.px(snout[0] + math.cos(ha) * 0.6, snout[1] + math.sin(ha) * 0.6, FUR[:2], 0.0)
    eye = polar(head, ha - 1.7, 1.1)
    b.px(eye[0] + 0.3, eye[1], SHADOW, 0.0)
    # ears
    ea = ha + math.pi + 0.55 + ear
    e1 = polar(head, ea, 3.4)
    b.capsule(polar(head, ea, 1.0), e1, 0.9, 0.7, DEER_FUR, 0.1)
    b.px(polar(head, ea, 2.2)[0], polar(head, ea, 2.2)[1], FUR[6:8], 0.6)
    leg((hip[0], hip[1] + 1.5), *legs[2], DEER_FUR, 0.0)
    leg((shoulder[0], shoulder[1] + 1.5), *legs[3], DEER_FUR, 0.0)
    return b.render(outline=FUR[0])


def deer_sheet():
    frames = []
    st = [(0.0, 0.0)] * 4
    up = -1.05
    frames.append(deer_frame(st, up))                       # 0 idle
    frames.append(deer_frame(st, up, ear=0.35))             # 1 ear flick
    frames.append(deer_frame(st, up, tail=-1.0))            # 2 tail flick
    frames.append(deer_frame(st, -1.35, head_tilt=-0.15))   # 3 alert/look
    for i in range(6):                                      # 4..9 walk
        ph = i / 6 * math.tau
        a = 0.42
        legs = [
            (math.sin(ph + math.pi) * a, max(0, math.sin(ph + math.pi * 0.5)) * 0.6),
            (math.sin(ph) * a, max(0, math.sin(ph - math.pi * 0.5)) * 0.6),
            (math.sin(ph) * a, max(0, math.sin(ph + math.pi * 1.5)) * 0.6),
            (math.sin(ph + math.pi) * a, max(0, math.sin(ph + math.pi * 0.5)) * 0.6),
        ]
        frames.append(deer_frame(legs, up + math.sin(ph * 2) * 0.05, bob=round(abs(math.sin(ph)) * 0.6)))
    frames.append(deer_frame(st, -0.2, head_tilt=0.2))      # 10 lowering
    frames.append(deer_frame([(0.1, 0), (-0.25, 0.1), (0.1, 0), (-0.25, 0.1)], 0.75, head_tilt=0.3))  # 11 drink
    frames.append(deer_frame([(0.1, 0), (-0.25, 0.1), (0.1, 0), (-0.25, 0.1)], 0.85, head_tilt=0.35))  # 12 drink
    anims = {
        "idle": {"frames": [0, 0, 0, 1, 0, 0, 2, 0], "fps": 3, "loop": True},
        "look": {"frames": [3], "fps": 1, "loop": True},
        "walk": {"frames": [4, 5, 6, 7, 8, 9], "fps": 8, "loop": True},
        "lower": {"frames": [10, 11], "fps": 4, "loop": False},
        "raise": {"frames": [11, 10, 0], "fps": 5, "loop": False},
        "drink": {"frames": [11, 12, 12, 11, 12], "fps": 3, "loop": True},
    }
    sheet("deer", frames, anims, ANI)


# ------------------------------------------------------------------ humans
HUMAN_VARIANTS = [
    {"shirt": ramp("#163f2a", "#1f5131", "#2b6631", "#3f7c36", "#5d9148"),
     "pants": ramp("#3d2f22", "#574231", "#74583b", "#93714a"),
     "hair": ramp("#2a1a10", "#4a3220", "#6b4a2e"), "skin": SKIN, "hat": None, "pack": True},
    {"shirt": ramp("#6a2a12", "#8a3f1a", "#c4602a", "#e98a3b", "#f6b56a"),
     "pants": ramp("#1a2240", "#22336e", "#3a55a8", "#5a7fd6"),
     "hair": ramp("#0c1014", "#171b1d", "#2f3134"), "skin": SKIN[:4], "hat": ramp("#9a7b3c", "#c2a35a", "#e0c27a"), "pack": False},
    {"shirt": ramp("#7a5a10", "#9a6f1c", "#d9a52f", "#f2d35b", "#fff09a"),
     "pants": ramp("#171b1d", "#22262a", "#2f3134", "#3e3d3b"),
     "hair": ramp("#8a6a30", "#b8924a", "#d9b870"), "skin": SKIN[1:], "hat": None, "pack": False},
]


def human_frame(v, legs=((0, 0), (0, 0)), arms=((0.15, 0.2), (0.15, 0.2)), sit=False, bob=0.0,
                camera=False, head_dy=0.0):
    b = Body(16, 28)
    gy = 26
    hip = (8.0, 16.0 + bob) if not sit else (7.0, 18.5)
    sh = (8.0, 9.6 + bob) if not sit else (7.5, 12.0)

    def leg(ang, knee_ang, rr, bias):
        if sit:
            knee = (hip[0] + 4.2, hip[1] + 0.3)
            foot = (knee[0] + 0.3, knee[1] + 6.0)
        else:
            knee = polar(hip, math.pi / 2 + ang, 5.0)
            foot = polar(knee, math.pi / 2 + ang + knee_ang, 5.2)
        b.capsule(hip, knee, 1.4, 1.2, rr, bias)
        b.capsule(knee, foot, 1.2, 1.0, rr, bias)
        b.px(foot[0] + 1, foot[1], SHADOW, 0.2)
        b.px(foot[0], foot[1], SHADOW, 0.3)

    def arm(a1, a2, bias, rr):
        elbow = polar(sh, math.pi / 2 + a1, 3.6)
        hand = polar(elbow, math.pi / 2 + a2, 3.4)
        b.capsule(sh, elbow, 1.1, 0.95, rr, bias)
        b.capsule(elbow, hand, 0.95, 0.8, rr, bias)
        b.px(hand[0], hand[1], v["skin"], 0.6)
        return hand

    leg(legs[0][0], legs[0][1], v["pants"], -0.12)
    arm(arms[0][0], arms[0][1], -0.15, v["shirt"])
    if v["pack"]:
        b.ellipse((5.2, 12.5 + bob if not sit else 14.5), 2.2, 3.0, ramp("#3b2a1e", "#4f3a28", "#674c33", "#80603f"))
    # torso
    b.capsule(sh, hip, 2.6, 2.3, v["shirt"], 0.05)
    leg(legs[1][0], legs[1][1], v["pants"], 0.0)
    # head
    hc = (8.4, 5.2 + bob + head_dy) if not sit else (7.9, 7.6)
    b.ellipse(hc, 2.6, 2.8, v["skin"], 0.08)
    # hair: back + top
    b.ellipse((hc[0] - 0.9, hc[1] - 1.0), 2.4, 1.9, v["hair"], 0.0)
    b.px(hc[0] + 1.6, hc[1] - 0.2, SHADOW, 0.0)  # eye
    if v["hat"] is not None:
        b.capsule((hc[0] - 3.2, hc[1] - 1.8), (hc[0] + 3.2, hc[1] - 1.8), 0.6, 0.6, v["hat"], 0.1)
        b.ellipse((hc[0], hc[1] - 2.8), 2.0, 1.3, v["hat"], 0.1)
    hand = arm(arms[1][0], arms[1][1], 0.05, v["shirt"])
    if camera:
        b.px(hand[0] + 0.5, hand[1] - 0.5, SHADOW, 0.1)
        b.px(hand[0] + 1.5, hand[1] - 0.5, SHADOW, 0.3)
        b.px(hand[0] + 0.5, hand[1] - 1.5, SHADOW, 0.3)
    return b.render(outline=SHADOW[1])


def human_sheet(i, v):
    frames = []
    frames.append(human_frame(v))                                          # 0 idle
    frames.append(human_frame(v, bob=0.4))                                 # 1 breathe
    for k in range(6):                                                     # 2..7 walk
        ph = k / 6 * math.tau
        a = 0.45
        frames.append(human_frame(
            v,
            legs=((math.sin(ph) * a, max(0, -math.sin(ph + 0.6)) * 0.7),
                  (-math.sin(ph) * a, max(0, math.sin(ph + 0.6)) * 0.7)),
            arms=((-math.sin(ph) * 0.5, -math.sin(ph) * 0.3 + 0.2), (math.sin(ph) * 0.5, math.sin(ph) * 0.3 + 0.2)),
            bob=round(abs(math.cos(ph)) * 0.6)))
    frames.append(human_frame(v, sit=True, arms=((-0.6, -0.9), (-0.7, -1.0))))  # 8 sit
    frames.append(human_frame(v, sit=True, arms=((-0.6, -0.9), (-0.9, -1.4))))  # 9 sit (gesture)
    # photo: arms raised to the face holding camera
    frames.append(human_frame(v, arms=((-1.2, -2.6), (-1.4, -2.9)), camera=True))  # 10
    frames.append(human_frame(v, arms=((-1.2, -2.6), (-1.4, -2.9)), camera=True, head_dy=0.4))  # 11
    # feed: toss seeds forward
    frames.append(human_frame(v, arms=((0.1, 0.2), (-0.4, -0.6))))   # 12
    frames.append(human_frame(v, arms=((0.1, 0.2), (-1.2, -1.6))))   # 13
    frames.append(human_frame(v, arms=((0.1, 0.2), (-1.7, -1.9))))   # 14
    # look: hand shading the eyes
    frames.append(human_frame(v, arms=((0.15, 0.2), (-1.6, -3.3))))  # 15
    anims = {
        "idle": {"frames": [0, 0, 1, 1], "fps": 2, "loop": True},
        "walk": {"frames": [2, 3, 4, 5, 6, 7], "fps": 7, "loop": True},
        "sit": {"frames": [8, 8, 8, 9, 8, 8], "fps": 1.5, "loop": True},
        "photo": {"frames": [10, 11, 10], "fps": 2, "loop": False},
        "feed": {"frames": [12, 13, 14, 13, 12], "fps": 6, "loop": False},
        "look": {"frames": [15], "fps": 1, "loop": True},
    }
    sheet("visitor_%d" % i, frames, anims, HUM)


def main():
    os.makedirs(ANI, exist_ok=True)
    os.makedirs(HUM, exist_ok=True)
    for name, cols in (("bird_sabia", SABIA), ("bird_saira", SAIRA)):
        fr, an = bird_frames(cols)
        sheet(name, fr, an, ANI)
    for main_col in ("orange", "blue", "yellow", "white"):
        c = butterfly_colors(main_col)
        fr = [from_ascii(f, c) for f in BFLY]
        sheet("butterfly_" + main_col, fr, {
            "fly": {"frames": [0, 1, 2, 1], "fps": 14, "loop": True},
            "rest": {"frames": [2, 2, 1, 0, 1, 2, 2, 2], "fps": 3, "loop": True},
        }, ANI)
    sheet("dragonfly", [from_ascii(f, DFLY_C) for f in DFLY],
          {"fly": {"frames": [0, 1], "fps": 24, "loop": True}}, ANI)
    sheet("fish", [from_ascii(f, FISH_C) for f in FISH],
          {"swim": {"frames": [0, 1, 2, 1], "fps": 6, "loop": True},
           "dart": {"frames": [0, 1, 2, 1], "fps": 16, "loop": True}}, ANI)
    deer_sheet()
    for i, v in enumerate(HUMAN_VARIANTS):
        human_sheet(i, v)
    with open(os.path.join(ROOT, "data", "creatures.json"), "w") as f:
        json.dump(META, f, indent=1)
    print("creatures done:", ", ".join(META.keys()))


if __name__ == "__main__":
    main()
