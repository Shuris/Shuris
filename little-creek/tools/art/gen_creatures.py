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


# ------------------------------------------------------------------ deer + humans
# v0.2: anatomical skeletal rigs (tools/art/rig.py) replace the old capsule
# painter. Both are rendered facing right AND left (light stays top-right).
import creatures_deer
import creatures_humans


def rig_sheet(name, frames_, anims, extra, folder):
    cols = 12
    path = os.path.join(folder, name + ".png")
    fw, fh = save_sheet(frames_, path, cols=cols)
    rel = "res://" + os.path.relpath(path, ROOT).replace(os.sep, "/")
    META[name] = {"sheet": rel, "w": fw, "h": fh, "anims": anims, **extra}


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
    for name, male in (("deer_m", True), ("deer_f", False)):
        fr, an, ex = creatures_deer.frames(male)
        rig_sheet(name, fr, an, {k: (list(map(float, v)) if isinstance(v, list) else v) for k, v in ex.items()}, ANI)
    for i in range(3):
        fr, an, ex = creatures_humans.frames(i)
        rig_sheet("visitor_%d" % i, fr, an, ex, HUM)
    with open(os.path.join(ROOT, "data", "creatures.json"), "w") as f:
        json.dump(META, f, indent=1)
    print("creatures done:", ", ".join(META.keys()))


if __name__ == "__main__":
    main()
