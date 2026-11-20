"""Interface art: 9-slice panels, buttons, bars, icons, app icon.

UI textures are painted at art resolution then upscaled x2 (nearest) so the
interface has exactly the same pixel size as the world (1 art px = 2 screen
px at 1280x720). Icons are kept at 1x and scaled by integer factors in-game.
"""
import os
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from palette import *  # noqa
from pixlib import *  # noqa

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
UI = os.path.join(ROOT, "assets", "sprites", "ui")
ICONS = os.path.join(UI, "icons")


def up2(cv):
    return Image.fromarray(cv.px, "RGBA").resize((cv.w * 2, cv.h * 2), Image.NEAREST)


def panel(w, h, body, alpha, border_ramp, moss=True, seed=1):
    """Dark translucent body with a wooden frame and a few moss accents."""
    rng = np.random.default_rng(seed)
    cv = Canvas(w, h)
    xs, ys = grid(w, h)
    inner = (xs >= 2) & (xs < w - 2) & (ys >= 2) & (ys < h - 2)
    cv.put_color(inner, body + (alpha,))
    frame = ~inner & ~(((xs == 0) | (xs == w - 1)) & ((ys == 0) | (ys == h - 1)))
    v = np.where(ys < 2, 0.8, np.where(ys >= h - 2, 0.25, np.where(xs < 2, 0.45, 0.6)))
    v = v + np.where((xs == 0) | (xs == w - 1) | (ys == 0) | (ys == h - 1), -0.25, 0.0)
    cv.put_ramp(frame, v, border_ramp, dither=0)
    # inner highlight line
    hl = (ys == 2) & (xs >= 2) & (xs < w - 2)
    cv.put_color(hl, (255, 255, 255, 18))
    if moss:
        for (x, y) in ((1, 1), (2, 0), (0, 2), (w - 2, h - 2), (w - 3, h - 1), (w - 1, h - 3), (3, 0)):
            cv.pixel(x, y, MOSS[4 + int(rng.random() * 3)])
    return cv


def round_button(r, ring, inner, pressed=False):
    s = r * 2 + 2
    cv = Canvas(s, s)
    xs, ys = grid(s, s)
    d = np.sqrt((xs - r + 0.5) ** 2 + (ys - r + 0.5) ** 2)
    outer = d <= r
    ringm = outer & (d > r - 3)
    core = d <= r - 3
    # ring: wood lit from the top
    v = 0.5 - (ys - r) / r * 0.35
    cv.put_ramp(ringm, v - (0.15 if pressed else 0), ring, dither=0.3)
    cv.put_ramp(core, 0.45 - (ys - r) / r * (0.2 if not pressed else -0.2), inner, dither=0.5)
    edge = outer & (d > r - 1)
    cv.put_color(edge, SHADOW[0] + (255,))
    return cv


def rect_button(w, h, base_ramp, pressed=False):
    cv = Canvas(w, h)
    xs, ys = grid(w, h)
    body = (xs >= 1) & (xs < w - 1) & (ys >= 1) & (ys < h - 1)
    v = 0.62 - ys / h * 0.35 if not pressed else 0.35 + ys / h * 0.15
    cv.put_ramp(body, v + np.zeros_like(xs), base_ramp, dither=0.3)
    top = (ys == 1) & (xs >= 2) & (xs < w - 2)
    if not pressed:
        cv.put_color(top, base_ramp[-1] + (255,))
    edge = ~body & ~(((xs == 0) | (xs == w - 1)) & ((ys == 0) | (ys == h - 1)))
    cv.put_color(edge, SHADOW[0] + (255,))
    return cv


ICON_DEFS = {
    "water": (["....o.......", "...oWo......", "...oWo......", "..oWAwo.....", "..oWAwo.....",
               ".oWAAwwo....", ".oAAAwwo....", ".owAwwwo....", "..owwwo.....", "...ooo......"],
              {"o": WATER[1], "W": WATER[8], "A": WATER[6], "w": WATER[4]}),
    "seed": (["............", ".....oo.....", "....oGGo....", "...oGggo....", "...oGggo....",
              "...ogggo....", "...ogggo....", "....ogo.....", ".....o......", "............"],
             {"o": LITTER[0], "G": LITTER[7], "g": LITTER[5]}),
    "vitality": (["............", ".oo...oo....", "oGGo.oGGo...", "oGgGoGggo...", "oGgggggggo..",
                  ".oggggggo...", "..ogggggo...", "...ogggo....", "....ogo.....", ".....o......"],
                 {"o": LEAF[1], "G": LEAF[9], "g": LEAF[6]}),
    "biodiversity": (["...oo..oo...", "..oGGooGGo..", "..oggooggo..", "...oo..oo...", ".oo......oo.",
                      "oGgo.oo.oGgo", ".oo.oGGo.oo.", "...oGgggo...", "...ogggggo..", "....ooooo..."],
                     {"o": SHADOW[2], "G": FLOWER["orange"][3], "g": FLOWER["orange"][2]}),
    "beauty": (["....oo......", "...oPPo.....", ".oooPPooo...", "oPPPyyPPPo..", ".oPPyyPPo...",
                "..oPPPPo....", ".oPPooPPo...", ".oPo..oPo...", "..o....o....", "............"],
               {"o": FLOWER["pink"][0], "P": FLOWER["pink"][3], "y": FLOWER["yellow"][2]}),
    "quality": (["....o.......", "...oWo..w...", "...oWo.wWw..", "..oWAwo.w...", "..oWAwo.....",
                 ".oWAAwwo....", ".oAAAwwo....", ".owAwwwo....", "..owwwo.....", "...ooo......"],
                {"o": WATER[1], "W": WATER[9], "A": WATER[7], "w": (255, 255, 230)}),
    "reputation": (["............", ".....o......", "....oYo.....", "oooooYYoooo.", "oYYYYyyYYYo.",
                    ".oYYyyyYYo..", "..oYyyyYo...", "..oYYoYYo...", ".oYo...oYo..", ".oo.....oo.."],
                   {"o": FLOWER["orange"][0], "Y": FLOWER["yellow"][3], "y": FLOWER["yellow"][2]}),
    "build": (["......oo....", ".....oGGo...", "..oo.oGgo...", ".oGGooggo...", ".oGggoggo...",
               "..oggggo....", "....ogo.....", "..ooooooo...", "..obbbbbo...", "...ooooo...."],
              {"o": SHADOW[1], "G": LEAF[9], "g": LEAF[6], "b": EARTH[4]}),
    "upgrade": ([".....oo.....", "....oGGo....", "...oGggGo...", "..oGgoogGo..", "..ooogoooo..",
                 "....ogo.....", "....ogo.....", "....ogo.....", "....ogo.....", "....ooo....."],
                {"o": SHADOW[1], "G": FLOWER["yellow"][3], "g": FLOWER["yellow"][2]}),
    "eco": (["............", ".ooooo.ooooo", ".oPPPPoPPPPo", ".oPllPoPllPo", ".oPPPPoPPPPo",
             ".oPllPoPllPo", ".oPPPPoPPPPo", ".oPPPPoPPPPo", ".ooooobooooo", "......b....."],
            {"o": WOOD[1], "P": CREAM[3], "l": LEAF[6], "b": WOOD[3]}),
    "info": (["....oooo....", "..ooWWWWoo..", ".oWWWooWWWo.", ".oWWWWWWWWo.", "oWWWWooWWWWo",
              "oWWWWooWWWWo", ".oWWWooWWWo.", ".oWWWooWWWo.", "..ooWWWWoo..", "....oooo...."],
             {"o": SHADOW[1], "W": WATER[7]}),
    "close": (["............", ".oo....oo...", ".oWo..oWo...", "..oWooWo....", "...oWWo.....",
               "...oWWo.....", "..oWooWo....", ".oWo..oWo...", ".oo....oo...", "............"],
              {"o": SHADOW[0], "W": CREAM[3]}),
    "lock": (["............", "....ooo.....", "...o...o....", "...o...o....", "..ooooooo...",
              "..oYYYYYo...", "..oYYoYYo...", "..oYYoYYo...", "..oYYYYYo...", "..ooooooo..."],
             {"o": SHADOW[0], "Y": ROCK[8]}),
    "check": (["............", "..........oo", ".........oGo", "........oGo.", ".oo....oGo..",
               ".oGo..oGo...", "..oGooGo....", "...oGGo.....", "....oo......", "............"],
              {"o": SHADOW[0], "G": LEAF[9]}),
    "music": (["............", "....oooooo..", "....oWWWWo..", "....oWoooo..", "....oWo..o..",
               "....oWo..o..", "..oooWo.ooo.", ".oWWWWooWWo.", ".oWWWo.oWWo.", "..ooo...oo.."],
              {"o": SHADOW[0], "W": CREAM[3]}),
    "sound": (["............", ".....o......", "....oo...o..", "..ooWo.o..o.", "..oWWo..o.o.",
               "..oWWo..o.o.", "..ooWo.o..o.", "....oo...o..", ".....o......", "............"],
              {"o": CREAM[3], "W": CREAM[1]}),
    "remove": (["......oo....", ".....oWo....", ".....oWo....", ".....oWo....", "....ooWoo...",
                "...oMMMMMo..", "...oMMMMMo..", "...omMMMmo..", "....omMmo...", ".....ooo...."],
               {"o": SHADOW[0], "M": ROCK[9], "m": ROCK[6], "W": WOOD[5]}),
    "clock": (["...oooooo...", "..oWWWWWWo..", ".oWWWoWWWWo.", ".oWWWoWWWWo.", ".oWWWooooWo.",
               ".oWWWWWWWWo.", ".oWWWWWWWWo.", "..oWWWWWWo..", "...oooooo...", "............"],
              {"o": SHADOW[0], "W": CREAM[3]}),
    "journal": (["............", ".oooooooooo.", ".oGGGGoPPPo.", ".oGlGGoPllo.", ".oGllGoPPPo.", ".oGGlGoPllo.",
                 ".oGGGGoPPPo.", ".oooooooooo.", "......o.....", "............"],
                {"o": WOOD[1], "G": LEAF[6], "l": LEAF[9], "P": CREAM[3]}),
    "camera": (["............", "...ooo......", ".oooooooooo.", ".oWWoooWWWo.", ".oWoGGGoWWo.", ".oWoGgGoWWo.",
                ".oWoGGGoWWo.", ".oWWoooWWWo.", ".oooooooooo.", "............"],
               {"o": SHADOW[0], "W": ROCK[8], "G": WATER[5], "g": WATER[8]}),
    "sun": (["............", ".....y......", "..y..y..y...", "...yYYYy....", ".yyYYYYYyy..", "...yYYYy....",
             "..y..y..y...", ".....y......", "............", "............"],
            {"y": FLOWER["yellow"][2], "Y": FLOWER["yellow"][3]}),
    "moon": (["............", "....ooo.....", "...oWWo.....", "..oWWo......", "..oWWo......", "..oWWWo..o..",
              "...oWWWooo..", "....ooooo...", "............", "............"],
             {"o": SHADOW[2], "W": CREAM[3]}),
    "rain": (["............", "...oooo.....", "..oWWWWoo...", ".oWWWWWWWo..", ".ooooooooo..", "..b..b..b...",
              ".b..b..b....", "............", "............", "............"],
             {"o": SHADOW[2], "W": MIST[9], "b": WATER[6]}),
    "fast": (["............", "............", ".oo...oo....", ".oWo..oWo...", ".oWWo.oWWo..",
              ".oWWWooWWWo.", ".oWWo.oWWo..", ".oWo..oWo...", ".oo...oo....", "............"],
             {"o": SHADOW[0], "W": FLOWER["yellow"][3]}),
}


def main():
    os.makedirs(ICONS, exist_ok=True)
    up2(panel(16, 16, SHADOW[1], 228, WOOD, True, 1)).save(os.path.join(UI, "panel.png"))
    up2(panel(16, 16, SHADOW[3], 236, MOSS[:6], False, 2)).save(os.path.join(UI, "card.png"))
    up2(panel(16, 16, SHADOW[4], 240, MOSS[2:], False, 3)).save(os.path.join(UI, "card_hover.png"))
    up2(panel(16, 16, (40, 46, 46), 220, ROCK_COOL[:6], False, 4)).save(os.path.join(UI, "card_locked.png"))
    up2(panel(12, 12, SHADOW[1], 200, BARK[2:8], False, 5)).save(os.path.join(UI, "chip.png"))
    up2(round_button(19, WOOD, LEAF_TEAL)).save(os.path.join(UI, "btn_round.png"))
    up2(round_button(19, WOOD, LEAF_TEAL, True)).save(os.path.join(UI, "btn_round_pressed.png"))
    up2(round_button(19, MOSS, LEAF_TEAL[2:])).save(os.path.join(UI, "btn_round_active.png"))
    up2(rect_button(16, 12, MOSS)).save(os.path.join(UI, "btn.png"))
    up2(rect_button(16, 12, MOSS, True)).save(os.path.join(UI, "btn_pressed.png"))
    up2(rect_button(16, 12, ROCK_COOL[1:7])).save(os.path.join(UI, "btn_disabled.png"))
    up2(rect_button(16, 12, LITTER[2:])).save(os.path.join(UI, "btn_gold.png"))
    # progress bars
    bg = Canvas(12, 6)
    xs, ys = grid(12, 6)
    bg.put_color(np.ones((6, 12), bool), SHADOW[0] + (230,))
    bg.put_color((ys >= 1) & (ys <= 4) & (xs >= 1) & (xs <= 10), SHADOW[2] + (255,))
    up2(bg).save(os.path.join(UI, "bar_bg.png"))
    fill = Canvas(8, 4)
    xs, ys = grid(8, 4)
    fill.put_ramp(np.ones((4, 8), bool), 0.75 - ys / 4 * 0.5 + np.zeros_like(xs), LEAF[4:], dither=0)
    up2(fill).save(os.path.join(UI, "bar_fill.png"))
    fill2 = Canvas(8, 4)
    fill2.put_ramp(np.ones((4, 8), bool), 0.75 - ys / 4 * 0.5 + np.zeros_like(xs), WATER[3:], dither=0)
    up2(fill2).save(os.path.join(UI, "bar_fill_water.png"))
    fill3 = Canvas(8, 4)
    fill3.put_ramp(np.ones((4, 8), bool), 0.75 - ys / 4 * 0.5 + np.zeros_like(xs), FLOWER["yellow"], dither=0)
    up2(fill3).save(os.path.join(UI, "bar_fill_gold.png"))
    # slider grabber
    g = Canvas(7, 9)
    xs, ys = grid(7, 9)
    g.put_ramp((xs >= 1) & (xs <= 5) & (ys >= 1) & (ys <= 7), 0.7 - ys / 9 * 0.4 + np.zeros_like(xs), WOOD, dither=0)
    g.put_color(((xs == 0) | (xs == 6) | (ys == 0) | (ys == 8)) & ~(((xs == 0) | (xs == 6)) & ((ys == 0) | (ys == 8))), SHADOW[0] + (255,))
    up2(g).save(os.path.join(UI, "grabber.png"))
    for name, (rows, cols) in ICON_DEFS.items():
        arr = from_ascii(rows, cols)
        Image.fromarray(arr, "RGBA").save(os.path.join(ICONS, name + ".png"))
    print("ui done")


if __name__ == "__main__":
    main()
