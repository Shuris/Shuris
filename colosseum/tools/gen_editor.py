"""Camarote do editor dos jogos (organizador das lutas), em pixel art no tamanho da cena.

O editor, gordo e arrogante, recostado num divã de almofadas vermelhas, com coroa de
louros e toga de borda púrpura, entre duas cortesãs: uma inclinada para ele, a outra
assistindo à luta com uma taça dourada. Folha com 4 quadros (72x50):
  0-1 assistindo (respiração, a cortesã bebe), 2-3 aplaudindo a vitória do jogador.
Duas versões: com camarote de madeira e toldo (arenas sem pulvinar) e só o grupo
(arenas que já têm o camarote imperial desenhado no cenário).
"""
from PIL import Image, ImageDraw
from pixel import new_img, finish, darker, lighter, hexc

FW, FH = 72, 50

GOLD, GOLD_D, GOLD_L = hexc("d8a838"), hexc("9a7020"), hexc("f4d878")
RED, RED_D = hexc("a8222a"), hexc("6e1418")
PURPLE = hexc("5a1e6a")
SKIN_M, SKIN_W1, SKIN_W2 = hexc("c8875a"), hexc("e0aa80"), hexc("b87850")
TOGA, TOGA_D = hexc("f2ece0"), hexc("cfc6b4")


def _part(draw, light=0.22, dark=0.7, ol=True):
    layer = new_img(FW, FH)
    draw(ImageDraw.Draw(layer))
    return finish(layer, light=light, dark=dark, ol=ol)


def _couch(d):
    # divã com moldura dourada, encosto e almofadas vermelhas
    d.rectangle([5, 23, 66, 36], fill=RED)
    d.rectangle([5, 23, 66, 25], fill=lighter(RED, 0.15))
    for x in range(9, 64, 9):  # capitonê
        d.point((x, 29), fill=RED_D)
    d.rectangle([3, 20, 6, 38], fill=GOLD)  # cabeceiras
    d.rectangle([65, 20, 68, 38], fill=GOLD)
    d.ellipse([2, 17, 7, 22], fill=GOLD)
    d.ellipse([64, 17, 69, 22], fill=GOLD)


def _bolsters(d):
    d.ellipse([6, 26, 15, 34], fill=RED)  # almofadas roliças
    d.ellipse([56, 26, 65, 34], fill=RED)
    d.line([(8, 30), (13, 30)], fill=GOLD)
    d.line([(58, 30), (63, 30)], fill=GOLD)


def _editor(d, f):
    cx = 36
    cheer = f >= 2
    breath = 1 if f in (1, 3) else 0
    # corpo largo, toga branca com borda púrpura
    d.ellipse([cx - 12, 21 - breath, cx + 12, 42], fill=TOGA)
    d.polygon([(cx - 9, 26), (cx + 4, 22), (cx + 9, 30), (cx - 2, 33)], fill=TOGA_D)  # dobra
    d.line([(cx - 8, 25), (cx + 5, 37)], fill=PURPLE, width=2)  # borda púrpura em diagonal
    # pescoço gordo e cabeça erguida (queixo para cima: arrogante)
    d.rectangle([cx - 3, 17, cx + 3, 22], fill=SKIN_M)
    d.ellipse([cx - 5, 9, cx + 5, 20], fill=SKIN_M)
    d.ellipse([cx - 4, 16, cx + 4, 21], fill=darker(SKIN_M, 0.92))  # papada
    # cabelo curto e coroa de louros dourada
    d.rectangle([cx - 5, 10, cx + 5, 12], fill=hexc("3a2a1e"))
    for k, x in enumerate(range(cx - 6, cx + 7, 2)):
        d.point((x, 10 - (1 if k % 2 else 0)), fill=GOLD_L)
        d.point((x, 11), fill=hexc("6a8a2a"))
    # olhos semicerrados, sobrancelha arqueada e sorriso de canto
    d.line([(cx - 3, 14), (cx - 1, 14)], fill=hexc("2a1a12"))
    d.line([(cx + 1, 14), (cx + 3, 14)], fill=hexc("2a1a12"))
    d.line([(cx + 1, 12), (cx + 3, 13)], fill=hexc("2a1a12"))
    d.point((cx + 1, 18), fill=hexc("7a3a2a"))
    d.line([(cx - 1, 18), (cx + 2, 17)], fill=hexc("7a3a2a"))
    if cheer:
        # levanta a mão com o anel: aprova o vencedor
        up = 2 if f == 2 else 0
        d.line([(cx + 8, 25), (cx + 8, 9 - up)], fill=TOGA, width=3)
        d.ellipse([cx + 6, 4 - up, cx + 10, 8 - up], fill=SKIN_M)
        d.line([(cx + 8, 4 - up), (cx + 8, 2 - up)], fill=SKIN_M)  # polegar para cima
        d.point((cx + 7, 7 - up), fill=GOLD_L)
    else:
        # mão pousada na barriga, anel de ouro
        d.ellipse([cx + 1, 29, cx + 5, 32], fill=SKIN_M)
        d.point((cx + 3, 30), fill=GOLD_L)


def _courtesan_left(d, f):
    # inclinada para o editor: cabelos escuros presos, diadema, ombros à mostra
    lean = 1 if f in (1, 3) else 0
    hx = 18 + lean
    d.polygon([(7, 40), (9, 27), (14, 23), (21, 25), (23, 40)], fill=hexc("4a9a9a"))  # estola turquesa
    d.line([(10, 33), (22, 31)], fill=GOLD)  # cinto
    d.polygon([(11, 24), (15, 22), (21, 24), (22, 27), (10, 27)], fill=SKIN_W1)  # ombros nus
    d.line([(15, 22), (16, 27)], fill=hexc("4a9a9a"))  # alça drapeada num ombro só
    d.rectangle([hx - 1, 19, hx + 1, 23], fill=SKIN_W1)  # pescoço
    d.ellipse([hx - 3, 12, hx + 4, 20], fill=SKIN_W1)  # rosto inclinado
    d.ellipse([hx - 4, 9, hx + 2, 15], fill=hexc("2a1a14"))  # coque alto
    d.ellipse([hx - 6, 8, hx - 1, 13], fill=hexc("2a1a14"))
    d.line([(hx - 3, 12), (hx + 3, 11)], fill=GOLD_L)  # diadema
    d.point((hx + 2, 15), fill=hexc("2a1a12"))  # olhar de lado, para o editor
    d.point((hx + 3, 17), fill=hexc("b0403a"))  # lábios
    d.point((hx - 2, 17), fill=GOLD_L)  # brinco
    d.line([(13, 24), (19, 24)], fill=GOLD_L)  # colar
    # braço apoiado no ombro do editor
    d.line([(20, 26), (29 + lean, 24)], fill=SKIN_W1, width=2)
    d.point((22, 25), fill=GOLD)  # bracelete


def _courtesan_right(d, f):
    # assiste à luta com a taça dourada; cabelos ruivos trançados com fitas
    cx = 56
    sip = f in (1,)
    d.polygon([(48, 40), (50, 27), (54, 23), (59, 23), (64, 27), (65, 40)], fill=hexc("e8b84a"))  # vestido açafrão
    d.line([(50, 33), (64, 33)], fill=GOLD_D)
    d.polygon([(51, 25), (55, 22), (59, 22), (63, 25), (63, 27), (51, 27)], fill=SKIN_W2)  # ombros nus
    d.line([(60, 22), (59, 27)], fill=hexc("e8b84a"))
    d.rectangle([cx - 1, 19, cx + 1, 23], fill=SKIN_W2)
    d.ellipse([cx - 4, 11, cx + 3, 20], fill=SKIN_W2)
    d.ellipse([cx - 4, 8, cx + 4, 14], fill=hexc("8a3a1a"))  # penteado ruivo
    d.ellipse([cx + 1, 9, cx + 6, 15], fill=hexc("8a3a1a"))
    d.point((cx + 4, 10), fill=hexc("e0e0f0"))  # fita
    d.line([(cx - 3, 12), (cx + 2, 12)], fill=GOLD_L)
    d.point((cx - 2, 15), fill=hexc("2a1a12"))  # olhando para a arena
    d.point((cx, 15), fill=hexc("2a1a12"))
    d.point((cx - 1, 18), fill=hexc("b0403a"))
    d.line([(53, 23), (59, 23)], fill=GOLD_L)  # colar
    # taça dourada (perto da boca quando bebe)
    tx, ty = (cx - 4, 16) if sip else (cx - 7, 22)
    d.line([(cx + 3, 26), (tx + 2, ty + 3)], fill=SKIN_W2, width=2)
    d.polygon([(tx - 2, ty), (tx + 2, ty), (tx + 1, ty + 2), (tx - 1, ty + 2)], fill=GOLD)
    d.line([(tx, ty + 2), (tx, ty + 4)], fill=GOLD_D)
    d.point((tx - 1, ty), fill=hexc("6a1020"))  # vinho
    d.point((cx + 4, 28), fill=GOLD)  # bracelete


def _front(d):
    # parapeito do camarote: mármore, pano púrpura com franja dourada
    d.rectangle([0, 38, 71, 49], fill=hexc("e8e0d0"))
    d.rectangle([0, 38, 71, 40], fill=GOLD)
    d.rectangle([2, 41, 69, 47], fill=PURPLE)
    for x in range(4, 68, 6):
        d.rectangle([x, 43, x + 2, 44], fill=GOLD)
    for x in range(2, 70, 2):
        d.point((x, 47), fill=GOLD_L)


def _canopy(img):
    """Toldo listrado e colunas douradas (camarote de madeira das arenas menores)."""
    out = new_img(FW + 8, FH + 14)
    lay = new_img(FW + 8, FH + 14)
    d = ImageDraw.Draw(lay)
    d.rectangle([2, 12, FW + 5, FH + 10], fill=hexc("6a4428"))  # fundo do camarote
    d.polygon([(0, 13), (6, 1), (FW + 2, 1), (FW + 7, 13)], fill=RED)
    for x in range(6, FW + 2, 8):
        d.polygon([(x, 1), (x + 4, 1), (x + 3, 13), (x - 1, 13)], fill=hexc("efe0c0"))
    for x in range(1, FW + 7, 4):  # franja do toldo
        d.point((x, 14), fill=GOLD)
    d.rectangle([3, 14, 5, FH + 10], fill=GOLD)
    d.rectangle([FW + 2, 14, FW + 4, FH + 10], fill=GOLD)
    out.alpha_composite(finish(lay, light=0.2, dark=0.7))
    out.alpha_composite(img, (4, 12))
    return out


SCALE = 0.5  # as figuras ficam com metade do tamanho dentro do camarote


def _occupants(f):
    """Divã, editor e cortesãs no tamanho de desenho (reduzidos depois)."""
    img = new_img(FW, FH)
    for draw in (_couch, _bolsters):
        img.alpha_composite(_part(draw))
    img.alpha_composite(_part(lambda d: _courtesan_left(d, f)))
    img.alpha_composite(_part(lambda d: _courtesan_right(d, f)))
    img.alpha_composite(_part(lambda d: _editor(d, f)))
    return img.crop((0, 0, FW, 40))


def _shrink(img, k):
    """Reduz mantendo o pixel art: média por bloco e transparência binária."""
    w, h = round(img.width * k), round(img.height * k)
    small = img.resize((w, h), Image.BOX)
    px = small.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 110:
                px[x, y] = (0, 0, 0, 0)
            else:
                f = 255 / a  # desfaz a pré-multiplicação da média
                px[x, y] = (min(255, round(r * f)) if a < 255 else r, min(255, round(g * f)) if a < 255 else g, min(255, round(b * f)) if a < 255 else b, 255)
    return small


def _interior(d):
    # parede do fundo do camarote: cortina vermelha com borlas douradas e dois candelabros
    d.rectangle([1, 4, FW - 2, 40], fill=hexc("5a1418"))
    for x in range(1, FW - 1, 6):
        d.line([(x, 4), (x, 40)], fill=hexc("6e1a20"))
    for x in range(1, FW - 1, 4):  # sanefa dourada
        d.rectangle([x, 4, x + 2, 6], fill=GOLD)
        d.point((x + 1, 7), fill=GOLD_D)
    for cx in (8, FW - 9):
        d.rectangle([cx, 16, cx + 1, 38], fill=GOLD_D)  # haste do candelabro
        d.rectangle([cx - 2, 15, cx + 3, 16], fill=GOLD)
        d.point((cx, 13), fill=hexc("f8c040"))
        d.point((cx + 1, 14), fill=hexc("f08030"))
        d.rectangle([cx - 2, 37, cx + 3, 38], fill=GOLD)
    # mesinha com frutas e uma jarra de vinho ao lado do divã
    d.rectangle([FW - 22, 31, FW - 14, 32], fill=GOLD)
    d.line([(FW - 18, 33), (FW - 18, 38)], fill=GOLD_D)
    d.ellipse([FW - 22, 28, FW - 19, 31], fill=hexc("7a2a6a"))
    d.ellipse([FW - 19, 28, FW - 16, 31], fill=hexc("6a8a2a"))
    d.polygon([(FW - 15, 31), (FW - 14, 26), (FW - 13, 31)], fill=GOLD)


def frame(f):
    img = new_img(FW, FH)
    img.alpha_composite(_part(_interior, light=0.15, dark=0.75, ol=False))
    occ = _shrink(_occupants(f), SCALE)
    img.alpha_composite(occ, ((FW - occ.width) // 2, 38 - occ.height + 2))
    img.alpha_composite(_part(_front, light=0.25, dark=0.65))
    return img

def sheets():
    frames = [frame(f) for f in range(4)]
    group = new_img(FW * 4, FH)
    for i, fr in enumerate(frames):
        group.alpha_composite(fr, (i * FW, 0))
    boxed = [_canopy(fr) for fr in frames]
    bw, bh = boxed[0].size
    box = new_img(bw * 4, bh)
    for i, fr in enumerate(boxed):
        box.alpha_composite(fr, (i * bw, 0))
    return {"editor_group": group, "editor_box": box}, (FW, FH), (bw, bh)
