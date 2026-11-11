"""Versão 0.9: ícones de estado do gladiador, pombos e pássaros do fórum, estandartes
ao vento na arena, grade do portão e o camarote do editor dos jogos."""
from PIL import Image, ImageDraw
from pixel import new_img, finish, darker, lighter, hexc


def status_icons():
    out = {}
    # ferido: atadura com cruz vermelha
    img = new_img(16, 16)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([1, 4, 14, 11], radius=2, fill=hexc("efe6d2"))
    d.rectangle([6, 2, 9, 13], fill=hexc("c0302a"))
    d.rectangle([3, 6, 12, 9], fill=hexc("c0302a"))
    out["st_injured"] = finish(img, light=0.2, dark=0.7)
    # cansado: gota de suor e "z"
    img = new_img(16, 16)
    d = ImageDraw.Draw(img)
    d.polygon([(5, 2), (9, 9), (5, 13), (1, 9)], fill=hexc("6aa8e0"))
    d.line([(9, 3), (14, 3), (9, 8), (14, 8)], fill=hexc("e8e0c8"), width=2)
    out["st_tired"] = finish(img, light=0.2, dark=0.7)
    # motivado: chama
    img = new_img(16, 16)
    d = ImageDraw.Draw(img)
    d.polygon([(8, 1), (13, 8), (12, 13), (8, 15), (4, 13), (3, 8), (6, 5), (7, 8)], fill=hexc("e2602a"))
    d.polygon([(8, 6), (11, 11), (8, 14), (5, 11)], fill=hexc("f8c040"))
    out["st_motivated"] = finish(img, light=0.2, dark=0.7)
    return out


def pigeon_sheet():
    """Pombo 16x12: andar (2), bicar (2), voar (2)."""
    fw, fh = 16, 12
    sheet = new_img(fw * 6, fh)
    for f in range(6):
        img = new_img(fw, fh)
        d = ImageDraw.Draw(img)
        grey, dark, neck = hexc("9a9aa8"), hexc("5a5a6a"), hexc("6a8a7a")
        if f < 4:
            peck = f >= 2 and f % 2 == 1
            d.ellipse([3, 5, 12, 10], fill=grey)
            d.polygon([(3, 7), (0, 6), (1, 9)], fill=dark)  # cauda
            hx, hy = (12, 8) if peck else (11, 3)
            d.ellipse([hx - 2, hy - 1, hx + 2, hy + 3], fill=neck)
            d.point((hx + 3, hy + 1), fill=hexc("e8b040"))
            d.point((hx + 1, hy), fill=hexc("1a1a1a"))
            d.line([(6, 7), (10, 7)], fill=dark)
            step = f % 2 if f < 2 else 0
            d.line([(7, 10), (7 - step, 11)], fill=hexc("c86a5a"))
            d.line([(9, 10), (9 + step, 11)], fill=hexc("c86a5a"))
        else:
            up = f == 4
            d.ellipse([4, 4, 12, 8], fill=grey)
            d.ellipse([11, 3, 15, 7], fill=neck)
            if up:
                d.polygon([(6, 5), (9, 0), (11, 5)], fill=dark)
            else:
                d.polygon([(6, 6), (9, 11), (11, 6)], fill=dark)
            d.polygon([(4, 6), (0, 5), (1, 8)], fill=dark)
        sheet.alpha_composite(finish(img, light=0.25, dark=0.7), (f * fw, 0))
    return sheet


def bird_sheet():
    """Pássaro distante (silhueta) 9x5, 2 quadros."""
    sheet = new_img(18, 5)
    d = ImageDraw.Draw(sheet)
    d.line([(0, 3), (4, 1), (8, 3)], fill=hexc("3a3438"))
    d.line([(9, 1), (13, 3), (17, 1)], fill=hexc("3a3438"))
    return sheet


def banner_wave():
    """Estandarte branco (tingido na cena) 14x33 ondulando, 4 quadros."""
    fw, fh = 16, 34
    sheet = new_img(fw * 4, fh)
    for f in range(4):
        img = new_img(fw, fh)
        d = ImageDraw.Draw(img)
        for y in range(0, 26):
            off = round(1.6 * __import__("math").sin(y / 5 + f * 1.57))
            shade = 255 if (y // 3 + f) % 3 else 225
            d.line([(1 + off, y + 1), (14 + off, y + 1)], fill=(shade, shade, shade))
        off = round(1.6 * __import__("math").sin(26 / 5 + f * 1.57))
        d.polygon([(1 + off, 27), (8 + off, 33), (15 + off, 27)], fill=(240, 240, 240))
        d.rectangle([1, 0, 14, 1], fill=hexc("e8c040"))
        d.ellipse([4 + off // 2, 8, 12 + off // 2, 16], outline=hexc("e8c040"))
        sheet.alpha_composite(img, (f * fw, 0))
    return sheet


def gate_bars():
    """Grade do portão da arena (sobe na entrada dos lutadores)."""
    img = new_img(36, 34)
    d = ImageDraw.Draw(img)
    for x in range(2, 34, 5):
        d.rectangle([x, 0, x + 1, 33], fill=hexc("5a4a3a"))
    for y in range(4, 34, 6):
        d.rectangle([1, y, 34, y + 1], fill=hexc("5a4a3a"))
    for x in range(2, 34, 5):
        d.polygon([(x - 1, 33), (x + 1, 33), (x + 0.5, 35)], fill=hexc("7a6a5a"))
    return finish(img, light=0.25, dark=0.6)


def tribune():
    """Camarote de madeira com toldo (arenas sem pulvinar) 70x44."""
    img = new_img(70, 44)
    d = ImageDraw.Draw(img)
    d.rectangle([4, 14, 65, 43], fill=hexc("7a5230"))
    d.rectangle([4, 30, 65, 43], fill=hexc("6a2a5a"))
    d.rectangle([4, 30, 65, 31], fill=hexc("e8c040"))
    for x in range(8, 64, 8):
        d.rectangle([x, 35, x + 3, 38], fill=hexc("e8c040"))
    d.polygon([(0, 14), (6, 2), (63, 2), (69, 14)], fill=hexc("b8372e"))
    for x in range(6, 64, 8):
        d.polygon([(x, 2), (x + 4, 2), (x + 3, 14), (x - 1, 14)], fill=hexc("efe0c0"))
    d.rectangle([5, 14, 7, 30], fill=hexc("5a3a20"))
    d.rectangle([62, 14, 64, 30], fill=hexc("5a3a20"))
    return finish(img, light=0.25, dark=0.7)
