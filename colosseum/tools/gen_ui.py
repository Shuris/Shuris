"""Ícones da interface (16x16), moldura 9-slice e ícone do aplicativo."""
import math
from PIL import Image, ImageDraw
from pixel import new_img, finish, darker, lighter, hexc, limb, poly, along
from gen_gladiator import draw_weapon, draw_helmet, draw_shield

GOLD = hexc("d8b04a")
RED = hexc("b8322a")
GREEN = hexc("5a8a3a")
STEEL = hexc("c4c8d0")
STONE = hexc("9a9488")
BLUE = hexc("4a78b0")


def canvas(s=16):
    img = new_img(s, s)
    return img, ImageDraw.Draw(img)


def ic_str():  # halteres (pesos de pedra romanos)
    img, d = canvas()
    d.rectangle([5, 7, 10, 8], fill=hexc("7a5a3a"))
    d.ellipse([1, 4, 6, 11], fill=STONE)
    d.ellipse([9, 4, 14, 11], fill=STONE)
    return finish(img)


def ic_vit():  # coração
    img, d = canvas()
    d.ellipse([2, 3, 8, 9], fill=RED)
    d.ellipse([7, 3, 13, 9], fill=RED)
    d.polygon([(2, 7), (13, 7), (7.5, 13)], fill=RED)
    return finish(img, light=0.35)


def ic_res():  # couraça
    img, d = canvas()
    d.polygon([(3, 3), (12, 3), (13, 6), (11, 13), (4, 13), (2, 6)], fill=hexc("c08a3e"))
    img = finish(img, light=0.3)
    d = ImageDraw.Draw(img)
    d.point((6, 7), fill=hexc("8a5a2a"))
    d.point((9, 7), fill=hexc("8a5a2a"))
    d.line([(7, 9), (8, 9)], fill=hexc("8a5a2a"))
    return img


def ic_agi():  # pena / asa
    img, d = canvas()
    d.polygon([(3, 13), (5, 8), (9, 4), (13, 2), (11, 7), (7, 11)], fill=hexc("e8e4d8"))
    img = finish(img, light=0.2)
    d = ImageDraw.Draw(img)
    d.line([(3, 13), (12, 3)], fill=hexc("8a8478"))
    return img


def ic_prec():  # alvo
    img, d = canvas()
    d.ellipse([1, 1, 14, 14], fill=RED)
    d.ellipse([4, 4, 11, 11], fill=hexc("efe6d2"))
    d.ellipse([6, 6, 9, 9], fill=RED)
    return finish(img, light=0.2)


def ic_tech():  # espadas cruzadas
    img, d = canvas()
    draw_weapon(d, (3, 13), -45, "shortsword")
    draw_weapon(d, (13, 13), -135, "shortsword")
    return finish(img, light=0.35)


def ic_coin():
    img, d = canvas()
    d.ellipse([2, 2, 13, 13], fill=GOLD)
    d.ellipse([4, 4, 11, 11], outline=darker(GOLD, 0.75))
    img = finish(img, light=0.35)
    d = ImageDraw.Draw(img)
    d.line([(7, 5), (7, 10)], fill=darker(GOLD, 0.6))
    d.point((8, 6), fill=darker(GOLD, 0.6))
    return img


def ic_laurel():
    img, d = canvas()
    for i in range(5):
        ang = math.radians(-80 + i * 32)  # de baixo para cima
        for sgn in (-1, 1):
            x = 7.5 + sgn * 5.5 * math.cos(ang)
            y = 8 - 5.5 * math.sin(ang)
            d.ellipse([x - 1.2, y - 1.2, x + 1.2, y + 1.2], fill=GREEN)
    return finish(img, light=0.3)


def ic_xp():  # pergaminho
    img, d = canvas()
    d.rectangle([3, 3, 12, 12], fill=hexc("e8d6a8"))
    d.rectangle([2, 2, 13, 4], fill=hexc("b89a60"))
    d.rectangle([2, 11, 13, 13], fill=hexc("b89a60"))
    img = finish(img, light=0.2)
    d = ImageDraw.Draw(img)
    for y in (6, 8, 10):
        d.line([(5, y), (10, y)], fill=hexc("8a7448"))
    return img


def ic_skill_power():
    img, d = canvas()
    for k in range(8):
        a = k * math.pi / 4
        d.line([(10, 6), (10 + 5 * math.cos(a), 6 + 5 * math.sin(a))], fill=hexc("f4b03a"))
    draw_weapon(d, (3, 13), -45, "gladius")
    return finish(img, light=0.35)


def ic_skill_guard():
    img, d = canvas()
    draw_shield(d, (7, 8), "scutum")
    img = img.resize((16, 16))
    img = finish(img, light=0.2)
    d = ImageDraw.Draw(img)
    d.rectangle([11, 2, 12, 7], fill=hexc("f4e070"))
    d.rectangle([9, 4, 14, 5], fill=hexc("f4e070"))
    return img


def ic_skill_quick():
    img, d = canvas()
    for y, l in ((5, 5), (8, 7), (11, 4)):
        d.line([(1, y), (1 + l, y)], fill=hexc("e8e4d8"))
    draw_weapon(d, (7, 9), -15, "shortsword")
    return finish(img, light=0.35)


def ic_skill_counter():
    img, d = canvas()
    d.arc([2, 2, 13, 13], 200, 340, fill=hexc("f4b03a"), width=2)
    d.polygon([(11, 2), (14, 6), (10, 7)], fill=hexc("f4b03a"))
    draw_weapon(d, (4, 13), -60, "shortsword")
    return finish(img, light=0.35)


ICONS = {
    "attr_str": ic_str, "attr_vit": ic_vit, "attr_res": ic_res, "attr_agi": ic_agi,
    "attr_prec": ic_prec, "attr_tech": ic_tech, "coin": ic_coin, "laurel": ic_laurel, "xp": ic_xp,
    "skill_power_strike": ic_skill_power, "skill_iron_guard": ic_skill_guard,
    "skill_quick_strike": ic_skill_quick, "skill_counter": ic_skill_counter,
}


def panel_9slice():
    """Moldura 48x48 (borda de 16px) bronze sobre madeira escura."""
    s = 48
    img = new_img(s, s)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, s - 1, s - 1], fill=hexc("1a110c"))
    d.rectangle([1, 1, s - 2, s - 2], fill=hexc("8a6a2e"))
    d.rectangle([2, 2, s - 3, s - 3], fill=hexc("d8b04a"))
    d.rectangle([3, 3, s - 4, s - 4], fill=hexc("a07a32"))
    d.rectangle([4, 4, s - 5, s - 5], fill=hexc("1a110c"))
    d.rectangle([5, 5, s - 6, s - 6], fill=hexc("2e2018"))
    # rebites nos cantos
    for cx, cy in ((7, 7), (s - 8, 7), (7, s - 8), (s - 8, s - 8)):
        d.rectangle([cx - 1, cy - 1, cx + 1, cy + 1], fill=hexc("d8b04a"))
        d.point((cx - 1, cy - 1), fill=hexc("fff0b0"))
    # linha clara superior
    d.line([(2, 2), (s - 3, 2)], fill=hexc("f4dc8a"))
    return img


def app_icon():
    s = 32
    img = new_img(s, s)
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, 31, 31], fill=hexc("d8b04a"))
    d.ellipse([2, 2, 29, 29], fill=hexc("7a1e18"))
    sw = new_img(s, s)
    sd = ImageDraw.Draw(sw)
    draw_weapon(sd, (7, 25), -45, "gladius")
    draw_weapon(sd, (25, 25), -135, "gladius")
    sw = finish(sw, light=0.35)
    img.alpha_composite(sw)
    hl = new_img(s, s)
    hd = ImageDraw.Draw(hl)
    draw_helmet(hd, (15, 17), "galea")
    hl = finish(hl, light=0.3)
    img.alpha_composite(hl)
    return img
