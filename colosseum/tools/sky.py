"""Elementos do céu para o ciclo de dia e noite: sol, lua e nuvem."""
import math
from PIL import ImageDraw
from pixel import new_img, hexc


def sun():
    img = new_img(24, 24)
    d = ImageDraw.Draw(img)
    d.ellipse([2, 2, 21, 21], fill=hexc("ffd86a"))
    d.ellipse([5, 5, 18, 18], fill=hexc("fff2b0"))
    return img


def moon():
    img = new_img(18, 18)
    d = ImageDraw.Draw(img)
    d.ellipse([1, 1, 16, 16], fill=hexc("e8e8f0"))
    for (x, y, r) in ((6, 6, 2), (11, 10, 2), (7, 12, 1)):
        d.ellipse([x - r, y - r, x + r, y + r], fill=hexc("c4c4d4"))
    return img


def cloud(rng):
    img = new_img(48, 16)
    d = ImageDraw.Draw(img)
    for k in range(5):
        x = 6 + k * 8
        r = 5 + (k % 2) * 2
        d.ellipse([x - r, 9 - r, x + r, 9 + r // 2], fill=hexc("f4f8fa"))
    d.rectangle([2, 10, 45, 13], fill=hexc("dce8f0"))
    return img
