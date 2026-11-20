"""Veado-catingueiro (male with short antlers, and female) built on rig.py.

Anatomy follows the reference deer (docs/references): long thin legs with
the backward-pointing hock, deep chest, arched back rising to the croup,
proportional neck, wedge head with dark muzzle, big ears, white tail
underside. Colours come from the master palette family (warm grey-brown fur).
"""
import math

from palette import hx, ramp, CREAM, SHADOW
from rig import Part, Rig

FUR = ramp("#1d150f", "#2c2016", "#3f2e1f", "#553e29", "#6c5034", "#846341", "#9b774f", "#b18c62",
           "#c6a37a", "#d9bb93")
FUR_F = FUR[:8]  # far limbs (in shade)
BELLY = ramp("#8f8065", "#b3a283", "#d0c09c", "#e8dcbc", "#f4ecd6")
HOOF = ramp("#120d0a", "#1d150f", "#2c2016", "#3f2e1f")
NOSE = ramp("#0c1014", "#171b1d", "#2a2d30")
EAR_IN = ramp("#7a5c45", "#a07c60", "#c39e80", "#dcbfa2")
ANTLER = [hx("#5a4a36"), hx("#8d7a5c"), hx("#c2ae8a"), hx("#e3d4b4")]

W, H = 76, 64
GROUND = H - 3

BONES = {
    "torso": (None, (0.0, -24.0)),
    "neck": ("torso", (12.0, -3.5)),
    "head": ("neck", (15.0, 0.0)),
    "ear_n": ("head", (0.4, -2.8)),
    "ear_f": ("head", (1.4, -3.0)),
    "tail": ("torso", (-16.2, -5.0)),
    "fl_u": ("torso", (10.0, 2.0)), "fl_l": ("fl_u", (9.4, 0.0)), "fl_p": ("fl_l", (10.2, 0.0)), "fl_h": ("fl_p", (2.8, 0.0)),
    "ff_u": ("torso", (8.0, 1.6)), "ff_l": ("ff_u", (9.4, 0.0)), "ff_p": ("ff_l", (10.2, 0.0)), "ff_h": ("ff_p", (2.8, 0.0)),
    "hl_u": ("torso", (-10.0, 0.0)), "hl_l": ("hl_u", (11.0, 0.0)), "hl_p": ("hl_l", (11.4, 0.0)), "hl_h": ("hl_p", (2.8, 0.0)),
    "hf_u": ("torso", (-12.0, -0.4)), "hf_l": ("hf_u", (11.0, 0.0)), "hf_p": ("hf_l", (11.4, 0.0)), "hf_h": ("hf_p", (2.8, 0.0)),
}

# --- contours (bone-local; for limbs local -y is the FRONT of the animal)
TORSO = [(16.5, -1.0), (14.0, -5.6), (8.5, -7.6), (2.0, -6.6), (-5.0, -6.9), (-11.0, -7.9), (-15.0, -7.2),
         (-17.8, -3.8), (-18.0, 1.0), (-15.0, 4.4), (-9.5, 4.4), (-3.0, 6.2), (5.0, 7.4), (10.5, 6.8),
         (14.5, 4.4), (17.0, 1.6)]
BELLY_MARK = [(-9.0, 5.0), (-3.0, 6.8), (5.0, 7.3), (9.0, 6.8), (6.0, 5.0), (-2.0, 5.3), (-8.0, 4.0)]
DORSAL = [(12.0, -6.4), (6.0, -7.6), (-2.0, -6.8), (-10.0, -8.0), (-14.0, -7.6), (-10.0, -6.6), (-2.0, -5.6),
          (6.0, -6.4)]
NECK = [(-2.0, -5.2), (4.5, -4.2), (10.0, -2.9), (15.0, -2.1), (16.4, 0.2), (15.0, 2.5), (10.0, 3.4),
        (4.5, 4.9), (-2.0, 7.0)]
THROAT = [(6.0, 3.4), (11.0, 2.4), (14.8, 2.0), (14.4, 3.0), (10.0, 3.9), (6.0, 4.7)]
HEAD = [(-2.6, -1.6), (-0.2, -3.6), (3.2, -3.4), (6.8, -2.3), (9.8, -1.5), (11.6, -0.6), (12.2, 0.7),
        (11.3, 1.9), (8.6, 2.3), (5.0, 3.6), (1.4, 4.4), (-1.6, 3.2), (-3.1, 1.0)]
MUZZLE = [(9.8, -1.3), (11.7, -0.6), (12.3, 0.8), (11.4, 2.0), (9.7, 1.8)]
CHIN = [(8.0, 2.0), (11.0, 2.0), (10.2, 2.6), (8.2, 2.7)]
BROW = [(1.5, -2.6), (4.8, -2.4), (6.6, -1.7), (4.6, -1.3), (1.8, -1.6)]
EAR = [(0.0, -1.3), (2.3, -2.0), (5.0, -1.8), (7.0, 0.0), (5.0, 1.8), (2.3, 2.0), (0.0, 1.3)]
EAR_INNER = [(1.4, -0.7), (4.4, -0.8), (5.8, 0.0), (4.4, 0.6), (1.4, 0.5)]
TAIL = [(0.0, -1.8), (3.2, -2.3), (6.6, -1.1), (7.1, 0.6), (3.6, 2.2), (0.0, 1.8)]
TAIL_WHITE = [(1.0, 0.4), (3.6, 1.0), (6.8, 0.4), (6.9, 1.0), (3.6, 2.4), (0.6, 1.9)]
# front: forearm (big muscle at top, overlapping the chest), cannon, pastern, hoof
F_UP = [(-3.5, -3.8), (2.5, -3.0), (6.5, -1.6), (9.6, -1.2), (9.9, 1.0), (6.0, 1.6), (1.0, 2.5), (-3.5, 3.6)]
F_LO = [(0.0, -1.1), (5.0, -0.85), (10.3, -0.75), (10.5, 0.75), (5.0, 0.85), (0.0, 1.1)]
PAST = [(-0.2, -0.8), (3.0, -0.75), (3.1, 0.75), (-0.2, 0.8)]
HOOFP = [(0.0, -1.0), (1.4, -1.9), (2.6, -1.6), (2.7, 1.0), (0.3, 1.2)]
# hind: thigh+gaskin (haunch), cannon, pastern, hoof
H_UP = [(-4.5, -5.2), (2.0, -5.8), (6.5, -3.2), (9.6, -1.5), (11.4, -1.0), (11.8, 1.3), (7.5, 2.3),
        (2.0, 5.0), (-4.0, 6.0)]
H_LO = [(0.0, -1.1), (5.5, -0.85), (11.5, -0.75), (11.7, 0.75), (5.5, 0.9), (0.0, 1.4)]


def build(male=True):
    P = []
    z = 0
    # far limbs and far ear first
    for pre in ("hf", "ff"):
        up = H_UP if pre == "hf" else F_UP
        lo = H_LO if pre == "hf" else F_LO
        P += [Part(pre + "_u", pre + "_u", up, FUR_F, z, bias=-0.10, tex=0.05),
              Part(pre + "_l", pre + "_l", lo, FUR_F, z + 1, bias=-0.10, tex=0.03, vgrad=0.0),
              Part(pre + "_p", pre + "_p", PAST, FUR_F, z + 2, bias=-0.14, tex=0.0, vgrad=0.0),
              Part(pre + "_h", pre + "_h", HOOFP, HOOF, z + 3, bias=0.0, tex=0.0, vgrad=0.0, foot=True)]
        z += 4
    P.append(Part("ear_f", "ear_f", EAR, FUR, z, bias=-0.12, tex=0.02))
    z += 1
    P.append(Part("tail", "tail", TAIL, FUR, z, bias=0.05, tex=0.03))
    P.append(Part("tail_w", "tail", TAIL_WHITE, BELLY, z + 1, bias=0.25, clip="tail", tex=0.0))
    z += 2
    P.append(Part("torso", "torso", TORSO, FUR, z, bias=0.02, tex=0.07, tex_scale=2.2, vgrad=0.18))
    P.append(Part("dorsal", "torso", DORSAL, FUR, z + 1, bias=-0.12, clip="torso", tex=0.03))
    P.append(Part("belly", "torso", BELLY_MARK, BELLY, z + 2, bias=0.30, clip="torso", tex=0.02))
    z += 3
    P.append(Part("neck", "neck", NECK, FUR, z, bias=0.04, tex=0.06, vgrad=0.08))
    P.append(Part("throat", "neck", THROAT, BELLY, z + 1, bias=0.25, clip="neck", tex=0.0))
    z += 2
    P.append(Part("head", "head", HEAD, FUR, z, bias=0.06, tex=0.04, vgrad=0.08))
    P.append(Part("brow", "head", BROW, FUR, z + 1, bias=0.10, clip="head", tex=0.0))
    P.append(Part("muzzle", "head", MUZZLE, NOSE, z + 2, bias=-0.05, clip="head", tex=0.0))
    P.append(Part("chin", "head", CHIN, BELLY, z + 3, bias=0.30, clip="head", tex=0.0))
    z += 4
    P.append(Part("ear_n", "ear_n", EAR, FUR, z, bias=0.02, tex=0.02))
    P.append(Part("ear_in", "ear_n", EAR_INNER, EAR_IN, z + 1, bias=0.05, clip="ear_n", tex=0.0))
    z += 2
    for pre in ("hl", "fl"):
        up = H_UP if pre == "hl" else F_UP
        lo = H_LO if pre == "hl" else F_LO
        P += [Part(pre + "_u", pre + "_u", up, FUR, z, bias=0.0, tex=0.06, vgrad=0.10),
              Part(pre + "_l", pre + "_l", lo, FUR, z + 1, bias=-0.02, tex=0.03, vgrad=0.0),
              Part(pre + "_p", pre + "_p", PAST, FUR, z + 2, bias=-0.06, tex=0.0, vgrad=0.0),
              Part(pre + "_h", pre + "_h", HOOFP, HOOF, z + 3, bias=0.05, tex=0.0, vgrad=0.0, foot=True)]
        z += 4
    lines = []
    if male:
        # short forked antlers (catingueiro bucks carry small spikes)
        col = lambda t: ANTLER[1] if t < 0.3 else (ANTLER[2] if t < 0.8 else ANTLER[3])
        lines += [("head", [(1.2, -3.2), (0.8, -6.2), (-0.6, -9.6)], col),
                  ("head", [(0.9, -5.6), (2.8, -7.6)], col),
                  ("head", [(2.4, -3.0), (2.4, -5.8), (1.6, -8.6)], col)]
    dots = [("head", (4.4, -1.0), NOSE[0]), ("head", (5.0, -1.4), FUR[9]),
            ("head", (12.0, 0.4), NOSE[2])]
    return Rig(BONES, P, lines, dots)


# ------------------------------------------------------------------ poses
def base_pose():
    return {
        "torso": 0.0, "neck": -54.0, "head": 82.0, "ear_n": -150.0, "ear_f": -160.0, "tail": 118.0,
        "fl_u": 90.0, "fl_l": 0.0, "fl_p": -22.0, "fl_h": 22.0,
        "ff_u": 92.0, "ff_l": -2.0, "ff_p": -22.0, "ff_h": 22.0,
        "hl_u": 104.0, "hl_l": -30.0, "hl_p": -12.0, "hl_h": 28.0,
        "hf_u": 100.0, "hf_l": -28.0, "hf_p": -12.0, "hf_h": 28.0,
    }


def pose(**kw):
    p = base_pose()
    for k, v in kw.items():
        p[k] = p.get(k, 0.0) + v
    return p


def walk_pose(ph):
    """Lateral-sequence walk; ph in [0,1)."""
    p = base_pose()
    for leg, off, front in (("hl", 0.0, False), ("fl", 0.25, True), ("hf", 0.5, False), ("ff", 0.75, True)):
        t = (ph + off) % 1.0
        swing = t < 0.4  # 40% swing, 60% stance
        if swing:
            s = t / 0.4
            ang = -16 + 32 * s  # leg travels back -> forward (relative to vertical)
            flex = math.sin(s * math.pi)
        else:
            s = (t - 0.4) / 0.6
            ang = 16 - 32 * s
            flex = 0.0
        if front:
            p[leg + "_u"] = 90 - ang
            p[leg + "_l"] = flex * 55  # knee folds backward
            p[leg + "_p"] = -22 + flex * 25
        else:
            p[leg + "_u"] = 104 - ang * 0.8
            p[leg + "_l"] = -30 - flex * 30  # hock flexes
            p[leg + "_p"] = -12 + flex * 30
    p["neck"] += math.sin(ph * 4 * math.pi) * 2.5
    p["head"] -= math.sin(ph * 4 * math.pi) * 2.0
    p["tail"] += math.sin(ph * 2 * math.pi) * 6
    return p


def run_pose(ph):
    """Bounding flight gait (fleeing), tail raised showing the white flag."""
    p = base_pose()
    s = math.sin(ph * 2 * math.pi)
    c = math.cos(ph * 2 * math.pi)
    p["torso"] = -6 * s
    p["neck"] = -40 + 6 * s
    p["head"] = 70
    p["ear_n"] = -175
    p["ear_f"] = -180
    p["tail"] = -95  # raised
    reach = 0.5 + 0.5 * s  # 1 = fully extended
    p["fl_u"] = 90 - 45 * reach + 18 * (1 - reach)
    p["ff_u"] = 90 - 38 * reach + 22 * (1 - reach)
    p["fl_l"] = 45 * (1 - reach)
    p["ff_l"] = 50 * (1 - reach)
    p["hl_u"] = 104 + 38 * reach - 18 * (1 - reach)
    p["hf_u"] = 104 + 32 * reach - 22 * (1 - reach)
    p["hl_l"] = -30 + 20 * reach - 22 * (1 - reach)
    p["hf_l"] = -30 + 20 * reach - 22 * (1 - reach)
    return p, 3.0 * max(0.0, c)


DRINK = dict(neck=84.0, head=-26.0, fl_u=-32.0, fl_l=22.0, fl_p=-4.0, ff_u=-24.0, ff_l=16.0, hl_u=8.0,
             hf_u=8.0, torso=11.0, ear_n=-20.0, ear_f=-20.0, tail=-10.0)


def blend(a, b, t):
    return {k: a.get(k, 0.0) * (1 - t) + b.get(k, 0.0) * t for k in set(a) | set(b)}


def frames(male=True):
    rig = build(male)
    seq = []  # (anim, pose, lift)
    idle = base_pose()
    seq += [("idle", idle, 0), ("idle", pose(ear_n=14, ear_f=10), 0), ("idle", pose(tail=-22), 0),
            ("idle", pose(tail=-38), 0)]
    seq += [("look", pose(neck=-14, head=-12, ear_n=40, ear_f=36), 0),
            ("look", pose(neck=-14, head=-18, ear_n=40, ear_f=36), 0)]
    seq += [("alert", pose(neck=-20, head=-16, ear_n=48, ear_f=46, tail=-200), 0)]
    seq += [("ears", pose(ear_n=30), 0), ("ears", pose(ear_n=-8, ear_f=26), 0)]
    seq += [("tail", pose(tail=-30), 0), ("tail", pose(tail=-55), 0)]
    for i in range(8):
        seq.append(("walk", walk_pose(i / 8), 0))
    for i in range(6):
        p, lift = run_pose(i / 6)
        seq.append(("run", p, lift))
    dp = pose(**DRINK)
    seq += [("lower", blend(idle, dp, 0.35), 0), ("lower", blend(idle, dp, 0.7), 0), ("drink", dp, 0),
            ("drink", pose(**{**DRINK, "head": DRINK["head"] + 6, "neck": DRINK["neck"] + 2}), 0)]
    out, index = [], {}
    meta_extra = {}
    for facing in (1, -1):
        for name, p, lift in seq:
            img = rig.render(p, (W, H), GROUND, facing=facing, lift=lift)
            key = name if facing > 0 else name + "_l"
            index.setdefault(key, []).append(len(out))
            out.append(img)
            if name == "drink" and facing > 0 and "muzzle" not in meta_extra:
                mx, my = rig.point("head", (12.0, 0.8))
                meta_extra["muzzle"] = [round(mx - W / 2, 1), round(my - (H - 1), 1)]
    def A(key, order, fps, loop):
        fr = index[key]
        return {"frames": [fr[i] for i in order], "fps": fps, "loop": loop}
    anims = {}
    for sfx in ("", "_l"):
        anims["idle" + sfx] = A("idle" + sfx, [0, 0, 0, 1, 0, 0, 2, 3, 2, 0], 3, True)
        anims["look" + sfx] = A("look" + sfx, [0, 0, 0, 1, 1, 0], 2, True)
        anims["alert" + sfx] = A("alert" + sfx, [0], 1, True)
        anims["ears" + sfx] = A("ears" + sfx, [0, 1, 0], 6, False)
        anims["tail" + sfx] = A("tail" + sfx, [0, 1, 0, 1, 0], 8, False)
        anims["walk" + sfx] = A("walk" + sfx, list(range(8)), 9, True)
        anims["run" + sfx] = A("run" + sfx, list(range(6)), 12, True)
        anims["lower" + sfx] = A("lower" + sfx, [0, 1], 5, False)
        anims["drink" + sfx] = A("drink" + sfx, [0, 1, 1, 0, 1, 0, 0], 3, True)
        anims["raise" + sfx] = {"frames": [index["lower" + sfx][1], index["lower" + sfx][0], index["idle" + sfx][0]],
                                "fps": 5, "loop": False}
    meta_extra["shadow"] = [36, 7]
    meta_extra["directional"] = True
    return out, anims, meta_extra
