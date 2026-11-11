"""Arte da versão 0.6: arte do menu principal, retratos em pixel art (adversários,
lutadores avulsos, moradores e camadas do retrato do jogador), enfeites do
festival, carroça do mercador, forja do ferreiro, mesa da queda de braço e as
novas ilustrações do jornal."""
import os
import random
import numpy as np
from PIL import Image, ImageDraw
from pixel import new_img, finish, darker, lighter, hexc, mix
from gen_v05 import Composer, _bg, _place, engrave

PW, PH = 48, 48
SKINS = [(238, 190, 148), (200, 142, 98), (140, 92, 60)]
HAIR = [hexc("3a2616"), hexc("6e4422"), hexc("1e1812"), hexc("a87a3e"), hexc("8a3a1e"), hexc("9a958c")]
CLOTH = [hexc("c8483a"), hexc("e8dcc0"), hexc("4a6aa8"), hexc("5a8a4a"), hexc("d8a440"), hexc("7a4a8a")]
BRONZE = (196, 142, 64)
IRON = (140, 144, 156)
STEEL = (196, 200, 210)
LEATHER = (150, 104, 62)
RED = (166, 44, 36)
GOLD = (226, 186, 84)
WHITE = (255, 255, 255)

# ------------------------------------------------------------------ retratos
# Fichas dos retratos: aparência (igual à do jogo) e traços de personalidade.
# helmet: None ou tipo de elmo (aparece aberto no retrato, mostrando o rosto)
PEOPLE = {
    # adversários da escada
    "marcus": dict(skin=0, hair=0, color=1, beard=None, helmet=None, body="tunic", cloth=1, brow="worried", mouth="flat", sweat=True, young=True),
    "cassius": dict(skin=1, hair=2, color=2, beard="full", helmet="cap", body="bare", cloth=0, brow="angry", mouth="grin", scar="cheek"),
    "rufus": dict(skin=2, hair=1, color=2, beard=None, helmet=None, body="net", cloth=2, brow="raised", mouth="smile"),
    "brutus": dict(skin=0, hair=0, color=2, beard="full", helmet="galea", body="bare", cloth=0, brow="angry", mouth="frown", broad=True, scar="nose"),
    "spiculus": dict(skin=1, hair=0, color=0, beard=None, helmet="galea", body="leather", cloth=4, brow="calm", mouth="flat"),
    "crixus": dict(skin=0, hair=1, color=4, beard="full", helmet=None, body="iron", cloth=3, brow="angry", mouth="shout", broad=True, paint=True),
    "verus": dict(skin=1, hair=2, color=0, beard="goatee", helmet="galea", body="leather", cloth=5, brow="cold", mouth="flat", scar="eye"),
    "priscus": dict(skin=2, hair=0, color=2, beard="full", helmet="murmillo", body="iron", cloth=1, brow="tired", mouth="flat", old=True),
    "flamma": dict(skin=1, hair=0, color=0, beard=None, helmet="galea_gold", body="bronze_gold", cloth=4, brow="raised", mouth="grin", laurel=True),
    # lutadores avulsos (desafiantes do dia e torneios)
    "pool_aulus": dict(skin=0, hair=0, color=0, beard="full", helmet="murmillo", body="iron", cloth=0, brow="calm", mouth="flat"),
    "pool_tetraites": dict(skin=1, hair=2, color=2, beard=None, helmet=None, body="leather", cloth=4, brow="angry", mouth="grin", twin=True),
    "pool_celadus": dict(skin=0, hair=1, color=3, beard=None, helmet="galea", body="leather", cloth=2, brow="raised", mouth="smile", young=True),
    "pool_ursus": dict(skin=0, hair=1, color=4, beard="full", helmet="crupellarius", body="scale", cloth=3, brow="angry", mouth="frown", broad=True),
    "pool_hermes": dict(skin=1, hair=0, color=2, beard=None, helmet=None, body="net", cloth=1, brow="raised", mouth="smile"),
    "pool_draco": dict(skin=2, hair=2, color=2, beard="full", helmet="secutor", body="iron", cloth=0, brow="angry", mouth="shout", scar="cheek"),
    "pool_felix": dict(skin=1, hair=0, color=1, beard=None, helmet="provocator", body="cardio", cloth=4, brow="calm", mouth="smile"),
    "pool_columbus": dict(skin=0, hair=0, color=5, beard="full", helmet="secutor", body="iron", cloth=5, brow="tired", mouth="flat", old=True),
    "pool_tigris": dict(skin=2, hair=1, color=2, beard=None, helmet=None, body="leather", cloth=5, brow="cold", mouth="grin", paint=True),
    "pool_decimus": dict(skin=1, hair=0, color=0, beard="full", helmet="galea", body="leather", cloth=2, brow="calm", mouth="flat"),
    "pool_varro": dict(skin=0, hair=2, color=1, beard="goatee", helmet="provocator", body="cardio", cloth=1, brow="angry", mouth="frown"),
    "pool_nubia": dict(skin=2, hair=0, color=2, beard="full", helmet="secutor", body="scale", cloth=3, brow="cold", mouth="flat", broad=True),
    "pool_sextus": dict(skin=1, hair=1, color=0, beard=None, helmet="murmillo", body="iron", cloth=0, brow="worried", mouth="flat", young=True),
    "pool_brennus": dict(skin=0, hair=1, color=3, beard="full", helmet="crupellarius", body="scale", cloth=2, brow="angry", mouth="shout", paint=True),
    "pool_atticus": dict(skin=1, hair=2, color=2, beard="goatee", helmet="galea", body="leather", cloth=4, brow="raised", mouth="smile", scar="nose"),
    "pool_titus": dict(skin=2, hair=0, color=2, beard=None, helmet="secutor", body="iron", cloth=5, brow="calm", mouth="flat"),
    # moradores
    "monk": dict(skin=1, hair=2, color=5, beard="long", helmet="hood", body="robe", cloth=1, brow="calm", mouth="smile", old=True),
    "keeper": dict(skin=0, hair=1, color=4, beard=None, helmet="scarf", body="dress", cloth=0, brow="raised", mouth="smile", woman=True),
    "quintus": dict(skin=0, hair=2, color=5, beard="long", helmet=None, body="tunic", cloth=4, brow="raised", mouth="grin", old=True, bald=True),
    "instructor": dict(skin=1, hair=0, color=5, beard="full", helmet=None, body="tunic", cloth=0, brow="angry", mouth="shout", old=True),
    "doctore": dict(skin=2, hair=2, color=5, beard="goatee", helmet=None, body="leather", cloth=0, brow="cold", mouth="frown", scar="eye", old=True),
    "trainee": dict(skin=1, hair=0, color=1, beard=None, helmet=None, body="bare", cloth=0, brow="worried", mouth="flat", sweat=True, young=True),
    "vendor": dict(skin=1, hair=0, color=2, beard="full", helmet=None, body="tunic", cloth=2, brow="raised", mouth="grin"),
    "patron": dict(skin=0, hair=1, color=1, beard="full", helmet=None, body="tunic", cloth=3, brow="raised", mouth="grin", blush=True),
    "merchant": dict(skin=2, hair=2, color=2, beard="goatee", helmet="turban", body="robe_rich", cloth=5, brow="raised", mouth="smile", earring=True),
    "medic": dict(skin=0, hair=0, color=5, beard="full", helmet=None, body="robe", cloth=1, brow="calm", mouth="flat", old=True),
    "smith": dict(skin=1, hair=2, color=2, beard="full", helmet=None, body="apron", cloth=0, brow="angry", mouth="flat", broad=True, soot=True, bald=True),
}

BG = {"default": (70, 52, 40), "pool": (52, 58, 72), "npc": (60, 72, 54)}


def _backdrop(kind):
    img = new_img(PW, PH)
    a = np.zeros((PH, PW, 4), dtype=np.int32)
    base = BG[kind]
    for y in range(PH):
        k = 0.75 + 0.4 * (1 - y / PH)
        a[y, :, :3] = [int(c * k) for c in base]
    # luz de fundo atrás da cabeça
    yy, xx = np.mgrid[0:PH, 0:PW]
    glow = np.clip(1 - np.hypot(xx - 24, yy - 18) / 26, 0, 1) * 30
    a[..., :3] = np.clip(a[..., :3] + glow[..., None], 0, 255)
    a[..., 3] = 255
    return Image.fromarray(a.astype(np.uint8))


def _shoulders(d, sp, broad=False):
    """Ombros e peito conforme a roupa/armadura."""
    skin = SKINS[sp["skin"]]
    cloth = CLOTH[sp["cloth"]]
    w = 21 if broad else 18
    body = sp["body"]
    # pescoço
    d.rectangle([20, 30, 28, 37], fill=darker(skin, 0.9))
    col = {
        "bare": skin, "tunic": cloth, "robe": cloth, "robe_rich": cloth, "dress": cloth, "apron": (110, 78, 52),
        "leather": LEATHER, "iron": IRON, "scale": IRON, "bronze_gold": GOLD, "cardio": skin, "net": skin,
    }[body]
    d.polygon([(24 - w, 48), (24 - w + 4, 38), (18, 35), (30, 35), (24 + w - 4, 38), (24 + w, 48)], fill=col)
    if body in ("tunic", "robe", "dress", "robe_rich"):
        d.polygon([(19, 35), (24, 41), (29, 35)], fill=darker(skin, 0.95))
    if body == "robe_rich":
        d.line([(19, 36), (24, 42), (29, 36)], fill=GOLD)
    if body == "apron":
        d.polygon([(16, 48), (17, 39), (31, 39), (32, 48)], fill=(140, 100, 66))
        d.line([(17, 39), (20, 35)], fill=(90, 62, 40))
        d.line([(31, 39), (28, 35)], fill=(90, 62, 40))
    if body == "cardio":
        d.line([(10, 40), (36, 47)], fill=LEATHER, width=2)
        d.ellipse([19, 40, 29, 47], fill=BRONZE)
    if body == "net":
        d.line([(30, 36), (14, 48)], fill=(180, 160, 120), width=2)
    if body in ("iron", "scale"):
        # ombreira
        d.ellipse([5, 37, 15, 46], fill=darker(IRON, 0.95))


def _shoulder_details(d, sp):
    body = sp["body"]
    if body == "iron":
        for y in (41, 44, 47):
            d.line([(12, y), (36, y)], fill=darker(IRON, 0.6))
    if body == "scale":
        for i, y in enumerate(range(39, 48, 2)):
            for x in range(10 + (i % 2) * 2, 38, 4):
                d.point((x, y), fill=darker(IRON, 0.55))
                d.point((x, y - 1), fill=lighter(IRON, 0.4))
    if body == "leather":
        d.line([(14, 38), (32, 47)], fill=darker(LEATHER, 0.6))
        for x, y in ((17, 40), (23, 43), (29, 46)):
            d.point((x, y), fill=lighter(LEATHER, 0.5))
    if body == "bronze_gold":
        d.line([(19, 40), (23, 42)], fill=darker(GOLD, 0.6))
        d.line([(29, 40), (25, 42)], fill=darker(GOLD, 0.6))
    if body == "net":
        for x in range(14, 32, 3):
            d.point((x, 47 - (x - 14) // 2), fill=(120, 100, 70))


def _face(d, sp):
    skin = SKINS[sp["skin"]]
    broad = sp.get("broad")
    woman = sp.get("woman")
    # rosto (oval) e orelhas
    w = 9 if broad else 8
    d.ellipse([24 - w, 11, 24 + w, 33 if not woman else 31], fill=skin)
    if broad:
        d.rectangle([16, 24, 32, 30], fill=skin)
    d.ellipse([24 - w - 2, 19, 24 - w + 1, 25], fill=darker(skin, 0.92))
    d.ellipse([24 + w - 1, 19, 24 + w + 2, 25], fill=darker(skin, 0.92))


def _features(d, sp):
    skin = SKINS[sp["skin"]]
    dark = darker(skin, 0.55)
    eye = (34, 26, 22)
    brow = sp.get("brow", "calm")
    hair = HAIR[sp["color"]]
    bcol = darker(hair, 0.8) if not sp.get("old") else (150, 146, 140)
    # olhos
    ly, ry = 21, 21
    for ex in (19, 28):
        d.rectangle([ex, ly, ex + 1, ly + 1], fill=WHITE)
        d.point((ex + (1 if ex == 19 else 0), ly + 1), fill=eye)
        d.point((ex + (1 if ex == 19 else 0), ly), fill=eye)
    # sobrancelhas (personalidade)
    shapes = {
        "calm": [((18, 19), (21, 19)), ((27, 19), (30, 19))],
        "angry": [((18, 18), (21, 20)), ((27, 20), (30, 18))],
        "worried": [((18, 20), (21, 18)), ((27, 18), (30, 20))],
        "raised": [((18, 18), (21, 17)), ((27, 17), (30, 18))],
        "cold": [((18, 19), (21, 20)), ((27, 20), (30, 19))],
        "tired": [((18, 19), (21, 19)), ((27, 19), (30, 19))],
    }[brow]
    for a, b in shapes:
        d.line([a, b], fill=bcol, width=1)
    if brow == "tired":
        d.line([(19, 23), (21, 23)], fill=darker(skin, 0.8))
        d.line([(28, 23), (30, 23)], fill=darker(skin, 0.8))
    # nariz
    d.line([(24, 22), (24, 25)], fill=darker(skin, 0.8))
    d.point((23, 26), fill=dark)
    d.point((25, 26), fill=darker(skin, 0.75))
    # boca
    m = sp.get("mouth", "flat")
    if m == "flat":
        d.line([(22, 29), (26, 29)], fill=dark)
    elif m == "smile":
        d.line([(22, 28), (23, 29), (25, 29), (26, 28)], fill=dark)
    elif m == "grin":
        d.rectangle([22, 28, 26, 29], fill=WHITE)
        d.line([(21, 28), (27, 28)], fill=dark)
        d.line([(22, 30), (26, 30)], fill=dark)
    elif m == "frown":
        d.line([(22, 30), (23, 29), (25, 29), (26, 30)], fill=dark)
    elif m == "shout":
        d.ellipse([22, 27, 26, 31], fill=(70, 20, 18))
        d.line([(23, 27), (25, 27)], fill=WHITE)
    # detalhes de personalidade
    if sp.get("old"):
        d.point((17, 23), fill=darker(skin, 0.75))
        d.point((31, 23), fill=darker(skin, 0.75))
        d.line([(21, 16), (27, 16)], fill=darker(skin, 0.85))
    if sp.get("young"):
        d.point((19, 25), fill=lighter((220, 120, 110), 0.2))
        d.point((29, 25), fill=lighter((220, 120, 110), 0.2))
    if sp.get("blush"):
        d.rectangle([18, 25, 20, 26], fill=(214, 110, 96))
        d.rectangle([28, 25, 30, 26], fill=(214, 110, 96))
    if sp.get("sweat"):
        d.point((32, 17), fill=(170, 210, 240))
        d.point((32, 18), fill=(120, 170, 220))
    scar = sp.get("scar")
    if scar == "cheek":
        d.line([(28, 24), (31, 28)], fill=(170, 80, 70))
    elif scar == "nose":
        d.line([(22, 23), (26, 25)], fill=(170, 80, 70))
    elif scar == "eye":
        d.line([(28, 17), (30, 25)], fill=(170, 80, 70))
    if sp.get("paint"):
        d.line([(17, 22), (20, 25)], fill=(60, 90, 160))
        d.line([(31, 22), (28, 25)], fill=(60, 90, 160))
    if sp.get("soot"):
        for p in ((19, 26), (30, 24), (22, 15), (27, 27)):
            d.point(p, fill=(70, 60, 54))
    if sp.get("earring"):
        d.point((15, 26), fill=GOLD)


def _hair(d, style, color, woman=False, bald=False):
    if bald:
        d.arc([16, 10, 32, 26], 200, 340, fill=lighter(color, 0.0))
        d.rectangle([14, 18, 16, 24], fill=color)
        d.rectangle([32, 18, 34, 24], fill=color)
        return
    if style == 2:  # raspado: sombra curta
        d.chord([16, 10, 32, 22], 180, 360, fill=darker(color, 0.85))
        return
    d.chord([15, 8, 33, 24], 180, 360, fill=color)
    d.rectangle([15, 14, 18, 20], fill=color)
    d.rectangle([30, 14, 33, 20], fill=color)
    if style == 1 or woman:  # longo
        d.rectangle([13, 14, 17, 33], fill=color)
        d.rectangle([31, 14, 35, 33], fill=color)
    # franja
    for x in range(18, 31, 3):
        d.line([(x, 14), (x + 1, 16)], fill=color)


def _hair_detail(d, style, color, bald=False):
    if bald or style == 2:
        return
    for x in range(18, 31, 4):
        d.point((x, 11), fill=lighter(color, 0.35))
    d.line([(20, 10), (26, 9)], fill=lighter(color, 0.3))


def _beard(d, kind, color):
    if kind == "full":
        d.polygon([(16, 24), (18, 31), (21, 34), (27, 34), (30, 31), (32, 24), (30, 27), (27, 31), (21, 31), (18, 27)], fill=color)
        d.line([(21, 27), (27, 27)], fill=color)
    elif kind == "goatee":
        d.polygon([(22, 30), (26, 30), (25, 34), (23, 34)], fill=color)
        d.line([(21, 27), (27, 27)], fill=color)
    elif kind == "long":
        d.polygon([(16, 24), (18, 33), (22, 40), (26, 40), (30, 33), (32, 24), (29, 28), (26, 31), (22, 31), (19, 28)], fill=color)


def _helmet(d, kind, detail=False):
    """Elmos abertos (o retrato mostra o rosto): cúpula, aba e enfeites por tipo."""
    if kind is None:
        return
    if kind in ("galea", "galea_gold", "murmillo"):
        metal = GOLD if kind == "galea_gold" else (BRONZE if kind == "galea" else IRON)
        if not detail:
            d.chord([13, 4, 35, 26], 180, 360, fill=metal)
            d.rectangle([13, 14, 17, 26], fill=metal)
            d.rectangle([31, 14, 35, 26], fill=metal)
            d.rectangle([10, 14, 38, 16], fill=darker(metal, 0.9))
            if kind == "murmillo":
                d.polygon([(18, 6), (22, 0), (30, 0), (33, 6)], fill=lighter(metal, 0.1))
            else:
                for i, x in enumerate(range(16, 33, 3)):
                    d.rectangle([x, 1 + abs(i - 3) // 2, x + 2, 6], fill=RED)
            return
        d.line([(16, 8), (22, 6)], fill=lighter(metal, 0.55))
        d.line([(10, 16), (38, 16)], fill=darker(metal, 0.6))
        for x in (14, 34):
            d.point((x, 20), fill=lighter(metal, 0.5))
        return
    if kind == "cap":
        if not detail:
            d.chord([15, 7, 33, 23], 180, 360, fill=LEATHER)
            d.rectangle([14, 13, 34, 15], fill=darker(LEATHER, 0.85))
            return
        d.line([(17, 11), (31, 11)], fill=darker(LEATHER, 0.6))
        return
    if kind == "provocator":
        if not detail:
            d.chord([14, 5, 34, 25], 180, 360, fill=BRONZE)
            d.rectangle([13, 14, 17, 30], fill=BRONZE)
            d.rectangle([31, 14, 35, 30], fill=BRONZE)
            return
        d.line([(17, 9), (23, 7)], fill=lighter(BRONZE, 0.5))
        for y in (18, 22, 26):
            d.point((15, y), fill=darker(BRONZE, 0.6))
            d.point((33, y), fill=darker(BRONZE, 0.6))
        return
    if kind == "secutor":
        if not detail:
            d.chord([14, 4, 34, 26], 180, 360, fill=IRON)
            d.rectangle([14, 14, 17, 28], fill=IRON)
            d.rectangle([31, 14, 34, 28], fill=IRON)
            d.polygon([(20, 5), (24, 1), (28, 5)], fill=darker(IRON, 0.85))
            return
        d.line([(17, 8), (22, 6)], fill=lighter(IRON, 0.6))
        return
    if kind == "crupellarius":
        if not detail:
            d.rectangle([13, 4, 35, 17], fill=darker(IRON, 0.9))
            d.rectangle([12, 15, 17, 30], fill=darker(IRON, 0.9))
            d.rectangle([31, 15, 36, 30], fill=darker(IRON, 0.9))
            return
        for x in range(15, 34, 4):
            d.point((x, 6), fill=lighter(IRON, 0.4))
            d.point((x, 15), fill=lighter(IRON, 0.4))
        d.line([(13, 11), (35, 11)], fill=darker(IRON, 0.6))
        return
    if kind == "hood":
        if not detail:
            d.chord([11, 5, 37, 34], 180, 360, fill=(120, 96, 70))
            d.rectangle([11, 18, 16, 40], fill=(120, 96, 70))
            d.rectangle([32, 18, 37, 40], fill=(120, 96, 70))
            return
        d.line([(15, 12), (20, 8)], fill=lighter((120, 96, 70), 0.3))
        return
    if kind == "scarf":
        if not detail:
            d.chord([14, 7, 34, 25], 180, 360, fill=(190, 160, 80))
            d.rectangle([13, 14, 17, 22], fill=(190, 160, 80))
            return
        for x in range(17, 32, 4):
            d.point((x, 11), fill=(150, 60, 40))
        return
    if kind == "turban":
        if not detail:
            d.ellipse([12, 2, 36, 18], fill=(220, 210, 180))
            d.ellipse([22, 6, 27, 11], fill=(120, 40, 120))
            return
        for y in (6, 10, 14):
            d.line([(15, y), (33, y - 2)], fill=(190, 178, 146))
        d.point((24, 8), fill=GOLD)


def _laurel(d):
    for i, x in enumerate(range(14, 35, 3)):
        y = 9 + abs(x - 24) // 3
        d.ellipse([x, y, x + 2, y + 1], fill=(90, 150, 60))


def portrait(sp, kind="default"):
    img = _backdrop(kind)
    layer = new_img(PW, PH)
    d = ImageDraw.Draw(layer)
    _shoulders(d, sp, sp.get("broad"))
    _face(d, sp)
    hair = HAIR[sp["color"]]
    if sp.get("old") and sp["color"] != 5:
        hair = mix(hair, (180, 176, 170), 0.6)
    helmet = sp.get("helmet")
    if helmet in (None, "scarf", "laurel"):
        _hair(d, sp["hair"], hair, sp.get("woman"), sp.get("bald"))
    if sp.get("beard"):
        _beard(d, sp["beard"], hair)
    _helmet(d, helmet)
    layer = finish(layer, light=0.22, dark=0.72)
    d = ImageDraw.Draw(layer)
    _shoulder_details(d, sp)
    _features(d, sp)
    if helmet in (None, "scarf"):
        _hair_detail(d, sp["hair"], hair, sp.get("bald"))
    _helmet(d, helmet, True)
    if sp.get("laurel") and helmet is None:
        _laurel(d)
    img.alpha_composite(layer)
    return img


def locked_portrait():
    img = _backdrop("default")
    layer = new_img(PW, PH)
    d = ImageDraw.Draw(layer)
    sil = (34, 26, 22)
    d.polygon([(4, 48), (8, 38), (18, 35), (30, 35), (40, 38), (44, 48)], fill=sil)
    d.ellipse([16, 11, 32, 33], fill=sil)
    d.chord([13, 4, 35, 26], 180, 360, fill=sil)
    d.rectangle([10, 14, 38, 16], fill=sil)
    img.alpha_composite(layer)
    d = ImageDraw.Draw(img)
    d.text((21, 15), "?", fill=(200, 180, 140))
    return img


def player_layers(out):
    """Camadas do retrato do jogador (montadas no jogo com a cor do cabelo)."""
    for skin in range(3):
        sp = dict(skin=skin, hair=0, color=0, beard=None, helmet=None, body="tunic", cloth=1, brow="calm", mouth="flat")
        img = _backdrop("default")
        layer = new_img(PW, PH)
        d = ImageDraw.Draw(layer)
        _shoulders(d, sp)
        _face(d, sp)
        layer = finish(layer, light=0.22, dark=0.72)
        d = ImageDraw.Draw(layer)
        _features(d, dict(sp, brow="angry"))
        img.alpha_composite(layer)
        img.save(os.path.join(out, f"layer_base_{skin}.png"))
    white = (236, 236, 236)
    for style in range(3):
        layer = new_img(PW, PH)
        d = ImageDraw.Draw(layer)
        _hair(d, style, white)
        layer = finish(layer, light=0.15, dark=0.7)
        _hair_detail(ImageDraw.Draw(layer), style, white)
        layer.save(os.path.join(out, f"layer_hair_{style}.png"))
    layer = new_img(PW, PH)
    _beard(ImageDraw.Draw(layer), "full", white)
    finish(layer, light=0.1, dark=0.75).save(os.path.join(out, "layer_beard.png"))
    for kind in ("cap", "galea", "murmillo", "provocator", "secutor", "crupellarius"):
        layer = new_img(PW, PH)
        _helmet(ImageDraw.Draw(layer), kind)
        layer = finish(layer, light=0.25, dark=0.7)
        _helmet(ImageDraw.Draw(layer), kind, True)
        layer.save(os.path.join(out, f"layer_helmet_{kind}.png"))


def portraits(out):
    os.makedirs(out, exist_ok=True)
    for pid, sp in PEOPLE.items():
        kind = "pool" if pid.startswith("pool_") else ("default" if pid in ("marcus", "cassius", "rufus", "brutus", "spiculus", "crixus", "verus", "priscus", "flamma") else "npc")
        portrait(sp, kind).save(os.path.join(out, f"{pid}.png"))
    locked_portrait().save(os.path.join(out, "locked.png"))
    player_layers(out)
    return list(PEOPLE)


# ------------------------------------------------------------------ enfeites e objetos de cena
ARENA_BANNERS = (196, 432)  # estandartes desenhados em gen_arenas.arena


def festival_overlay(theme_y=195):
    """(As flâmulas evitam os estandartes da própria arena, em x≈196 e x≈432.)"""
    """Guirlandas de louro e flâmulas coloridas sobre o muro da arena (dia de festival)."""
    img, W = new_img(640, 360), 640
    d = ImageDraw.Draw(img)
    colors = [(200, 50, 44), (230, 190, 70), (60, 110, 180), (240, 236, 220)]
    for seg in range(0, W, 80):
        pts = []
        for i in range(21):
            x = seg + i * 4
            y = theme_y + 6 * np.sin(np.pi * i / 20)
            pts.append((x, y))
        for i, (x, y) in enumerate(pts):
            d.ellipse([x - 2, y - 1, x + 2, y + 2], fill=(70, 130, 50) if i % 2 else (96, 160, 64))
            if i % 5 == 2:
                d.ellipse([x - 1, y, x + 1, y + 2], fill=colors[(seg // 80 + i) % 4])
        # flâmula pendurada
        fx = seg + 40
        if any(abs(fx - (bx + 7)) < 24 for bx in ARENA_BANNERS):
            continue
        c = colors[(seg // 80) % 3]
        d.polygon([(fx - 5, theme_y + 6), (fx + 5, theme_y + 6), (fx + 5, theme_y + 26), (fx, theme_y + 21), (fx - 5, theme_y + 26)], fill=c)
        d.line([(fx - 4, theme_y + 9), (fx + 4, theme_y + 9)], fill=(240, 220, 120))
    return finish(img, light=0.2, dark=0.75, ol=False)


def merchant_cart():
    """Carroça do mercador viajante com toldo listrado e mercadorias exóticas."""
    img = new_img(84, 62)
    d = ImageDraw.Draw(img)
    wood, wood_d = hexc("8a5a32"), hexc("5a3a20")
    d.rectangle([6, 34, 76, 46], fill=wood)
    d.rectangle([6, 44, 76, 47], fill=wood_d)
    for x in (10, 72):
        d.rectangle([x, 12, x + 2, 36], fill=wood_d)
    # toldo listrado roxo e dourado
    for i, x in enumerate(range(2, 82, 8)):
        d.polygon([(x, 10), (x + 8, 10), (x + 8, 16), (x + 4, 19), (x, 16)], fill=(120, 50, 130) if i % 2 else (220, 180, 70))
    d.rectangle([2, 6, 82, 10], fill=(150, 70, 160))
    # mercadorias: ânforas, tecidos, baú
    d.ellipse([16, 24, 24, 35], fill=hexc("b0563a"))
    d.rectangle([18, 21, 22, 25], fill=hexc("b0563a"))
    d.rectangle([28, 26, 42, 35], fill=(60, 110, 170))
    d.rectangle([30, 22, 40, 27], fill=(200, 60, 50))
    d.rectangle([46, 25, 62, 35], fill=wood_d)
    d.rectangle([46, 24, 62, 27], fill=GOLD)
    d.ellipse([64, 27, 70, 35], fill=(90, 160, 100))
    # rodas
    for cx in (20, 62):
        d.ellipse([cx - 9, 42, cx + 9, 60], fill=wood_d)
        d.ellipse([cx - 6, 45, cx + 6, 57], fill=wood)
        d.ellipse([cx - 2, 49, cx + 2, 53], fill=wood_d)
    img = finish(img, light=0.22, dark=0.72)
    d = ImageDraw.Draw(img)
    for cx in (20, 62):
        d.line([(cx - 5, 51), (cx + 5, 51)], fill=wood_d)
        d.line([(cx, 46), (cx, 56)], fill=wood_d)
    d.point((54, 29), fill=(255, 240, 160))
    d.point((19, 27), fill=lighter(hexc("b0563a"), 0.5))
    return img


def forge():
    """Canto do ferreiro: fornalha de pedra com brasa, bigorna e ferramentas."""
    img = new_img(64, 50)
    d = ImageDraw.Draw(img)
    stone, stone_d = (130, 120, 108), (96, 88, 80)
    d.rectangle([2, 14, 30, 48], fill=stone)
    d.rectangle([6, 4, 22, 14], fill=stone_d)
    d.rectangle([8, 28, 24, 40], fill=(40, 22, 14))
    d.rectangle([10, 34, 22, 40], fill=(230, 110, 40))
    d.rectangle([12, 36, 20, 39], fill=(255, 200, 80))
    # bigorna
    d.rectangle([40, 40, 52, 48], fill=(90, 70, 50))
    d.polygon([(34, 30), (58, 30), (54, 34), (50, 36), (50, 40), (42, 40), (42, 36), (36, 34)], fill=(70, 72, 80))
    # martelo e tenaz encostados
    d.line([(60, 48), (60, 30)], fill=(110, 76, 44), width=2)
    d.rectangle([57, 27, 63, 31], fill=(90, 92, 100))
    img = finish(img, light=0.22, dark=0.72)
    d = ImageDraw.Draw(img)
    for x in range(4, 24, 6):
        d.line([(x, 20), (x + 4, 20)], fill=stone_d)
        d.line([(x + 3, 26), (x + 6, 26)], fill=stone_d)
    d.line([(36, 31), (56, 31)], fill=(160, 164, 176))
    return img


def arm_table():
    """Mesa da queda de braço com velas e uma bolsa de moedas."""
    img = new_img(56, 30)
    d = ImageDraw.Draw(img)
    wood, wood_d = hexc("7a5230"), hexc("5a3a20")
    d.rectangle([2, 8, 54, 14], fill=wood)
    d.rectangle([6, 14, 10, 30], fill=wood_d)
    d.rectangle([46, 14, 50, 30], fill=wood_d)
    d.rectangle([12, 2, 14, 8], fill=(236, 224, 190))
    d.rectangle([42, 2, 44, 8], fill=(236, 224, 190))
    d.ellipse([24, 3, 32, 9], fill=(150, 110, 60))
    img = finish(img, light=0.22, dark=0.72)
    d = ImageDraw.Draw(img)
    d.point((13, 1), fill=(255, 210, 90))
    d.point((43, 1), fill=(255, 210, 90))
    d.point((28, 4), fill=GOLD)
    return img


# ------------------------------------------------------------------ menu principal
def title_art(assets_dir):
    """Arte do menu: o Coliseu ao pôr do sol, o público de pé e dois gladiadores em duelo."""
    bg = os.path.join(assets_dir, "backgrounds")
    comp = Composer(os.path.join(assets_dir, "sprites", "gladiator"))
    arena = Image.open(os.path.join(bg, "arena_rome.png")).convert("RGBA")
    crowd = Image.open(os.path.join(bg, "crowd_rome.png")).convert("RGBA").crop((640 * 3, 0, 640 * 4, 360))
    sky = Image.new("RGBA", (640, 360))
    sd = ImageDraw.Draw(sky)
    for y in range(360):
        k = min(1, y / 170)
        c = mix(hexc("3a2a5a"), hexc("f09048"), k ** 1.3)
        sd.line([(0, y), (640, y)], fill=c + (255,))
    sd.ellipse([440, 96, 520, 176], fill=(255, 214, 140, 255))
    sky.alpha_composite(arena)
    sky.alpha_composite(crowd)
    # luz quente do entardecer
    a = np.asarray(sky).astype(np.float32)
    a[..., 0] *= 1.08
    a[..., 1] *= 0.92
    a[..., 2] *= 0.8
    sky = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    hero = comp.frame("attack", 2, skin=1, gear=("galea", "scutum", "gladius", "medium", "bronze"))
    rival = comp.frame("attack", 0, skin=0, gear=("murmillo", "scutum", "gladius", "heavy", "iron"))
    _place(sky, hero, 150, 350, 3)
    _place(sky, rival.transpose(Image.FLIP_LEFT_RIGHT), 490, 350, 3)
    d = ImageDraw.Draw(sky)
    for i in range(40):
        x = random.Random(i).randint(200, 450)
        y = random.Random(i + 99).randint(300, 340)
        d.point((x, y), fill=(240, 210, 160, 255))
    # vinheta
    a = np.asarray(sky).astype(np.float32)
    yy, xx = np.mgrid[0:360, 0:640]
    v = np.clip(1.15 - np.hypot((xx - 320) / 380, (yy - 200) / 260), 0.35, 1)
    a[..., :3] *= v[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


# ------------------------------------------------------------------ jornal
def news_images_v06(assets_dir, out_dir):
    bg = os.path.join(assets_dir, "backgrounds")
    fx = os.path.join(assets_dir, "sprites", "fx")
    comp = Composer(os.path.join(assets_dir, "sprites", "gladiator"))
    pics = {}
    # festival: arena enfeitada e lotada
    rome = _bg(os.path.join(bg, "arena_rome.png"))
    rome.alpha_composite(Image.open(os.path.join(bg, "crowdfest_rome.png")).convert("RGBA").crop((640 * 3, 0, 640 * 4, 360)))
    rome.alpha_composite(Image.open(os.path.join(fx, "festival.png")).convert("RGBA"))
    pics["festival"] = rome.crop((140, 100, 500, 320)).resize((240, 147), Image.NEAREST)
    # mercador: carroça no mercado
    mk = _bg(os.path.join(bg, "loc_market.png"))
    cart = Image.open(os.path.join(fx, "merchant_cart.png")).convert("RGBA")
    mk.alpha_composite(cart.resize((cart.width * 2, cart.height * 2), Image.NEAREST), (230, 200))
    pics["merchant"] = mk.crop((180, 150, 420, 330))
    # queda de braço: dois homens à mesa na taverna
    tv = _bg(os.path.join(bg, "loc_tavern.png"))
    table = Image.open(os.path.join(fx, "arm_table.png")).convert("RGBA")
    a1 = comp.frame("block", 0, skin=1, gear=(None, None, None, None, None), hair=0)
    a2 = comp.frame("block", 0, skin=0, gear=(None, None, None, None, None), hair=1)
    _place(tv, a1, 296, 320, 2)
    _place(tv, a2.transpose(Image.FLIP_LEFT_RIGHT), 352, 320, 2)
    tv.alpha_composite(table.resize((112, 60), Image.NEAREST), (268, 262))
    pics["armwrestle"] = tv.crop((200, 150, 440, 330))
    # torneio: o campeão com a coroa de louros diante do Coliseu
    tr = _bg(os.path.join(bg, "arena_rome.png"))
    tr.alpha_composite(Image.open(os.path.join(bg, "crowd_rome.png")).convert("RGBA").crop((640 * 4, 0, 640 * 5, 360)))
    champ = comp.frame("victory", 1, skin=2, gear=("galea", "parma", "sica", "light", "bronze"))
    _place(tr, champ, 320, 330, 2)
    pics["tournament"] = tr.crop((200, 150, 440, 330))
    os.makedirs(out_dir, exist_ok=True)
    for name, pic in pics.items():
        engrave(pic).save(os.path.join(out_dir, f"{name}.png"))
    return list(pics)


def crowd_front():
    """Silhuetas do público em primeiro plano (embaixo da tela da luta), 2 quadros:
    braços abaixados e braços erguidos. Ordem: corpos, depois o brilho das cabeças,
    e por último os braços (sempre na frente, sem nada cortando)."""
    rng = random.Random(42)
    W, H = 1280, 44
    sheet = new_img(W * 2, H)
    people = []
    # fileira de trás (um pouco mais alta) e fileira da frente, ombro a ombro: sem vãos
    x = -10
    while x < W + 10:
        people.append((x, rng.randint(9, 13), rng.choice((1, 2, 2)), rng.random()))
        x += rng.randint(10, 13)
    x = -4
    while x < W + 10:
        people.append((x, rng.randint(15, 20), rng.choice((1, 1, 2)), rng.random()))
        x += rng.randint(10, 13)
    for f in range(2):
        img = new_img(W, H)
        d = ImageDraw.Draw(img)
        col_of = lambda ph: (28 + int(ph * 14), 18 + int(ph * 8), 14, 255)
        for (px, top, build, ph) in people:
            sw = 7 + build * 2
            d.ellipse([px - 5, top, px + 5, top + 11], fill=col_of(ph))
            d.rounded_rectangle([px - sw, top + 10, px + sw, H + 4], radius=5, fill=col_of(ph))
        for (px, top, build, ph) in people:
            d.arc([px - 5, top, px + 5, top + 11], 200, 340, fill=(110, 70, 40, 255))
        for (px, top, build, ph) in people:
            sw = 7 + build * 2
            up = (f == 1) == (ph < 0.55)
            if not up:
                continue
            col = col_of(ph)
            side = -1 if ph < 0.3 else 1
            sx, sy = px + side * (sw - 2), top + 13          # ombro
            ex, ey = px + side * (sw + 2), top + 4           # cotovelo
            hx, hy = px + side * (sw + 1), top - 5           # punho
            d.line([(sx, sy), (ex, ey)], fill=col, width=4)
            d.line([(ex, ey), (hx, hy)], fill=col, width=4)
            d.ellipse([hx - 3, hy - 3, hx + 3, hy + 3], fill=col)
        sheet.alpha_composite(img, (f * W, 0))
    return sheet


# ------------------------------------------------------------------ objetos de cena (com colisão)
def _with_shadow(img, w=None):
    """Objeto já sombreado + sombra suave no chão."""
    out = new_img(img.width, img.height + 3)
    d = ImageDraw.Draw(out)
    sw = w or img.width
    d.ellipse([(img.width - sw) // 2, img.height - 3, (img.width + sw) // 2, img.height + 2], fill=(0, 0, 0, 70))
    out.alpha_composite(img, (0, 0))
    return out


def _wood(d, box, base, grain=True):
    x0, y0, x1, y1 = box
    d.rectangle(box, fill=base)
    if grain:
        for y in range(y0 + 2, y1, 3):
            d.line([(x0 + 1, y), (x1 - 1, y)], fill=darker(base, 0.88))


def props():
    out = {}
    W_ = hexc("8a5a32")
    WD = hexc("5e3a1e")
    WL = hexc("a8743e")
    # mesa da taverna (altura da cintura) com caneca, pão e uma jarra
    img = new_img(48, 26)
    d = ImageDraw.Draw(img)
    _wood(d, (1, 6, 46, 11), WL)
    d.rectangle([1, 11, 46, 12], fill=WD)
    for x in (4, 41):
        d.rectangle([x, 12, x + 3, 25], fill=WD)
    d.rectangle([8, 12, 39, 14], fill=W_)
    img = finish(img, light=0.22, dark=0.7)
    d = ImageDraw.Draw(img)
    d.rectangle([9, 1, 14, 6], fill=hexc("8a8a9a"))
    d.point((10, 2), fill=hexc("d8d8e0"))
    d.ellipse([20, 2, 31, 7], fill=hexc("c8903a"))
    d.line([(22, 4), (29, 4)], fill=hexc("e8b860"))
    d.ellipse([35, -1, 42, 7], fill=hexc("b0603a"))
    d.point((37, 1), fill=hexc("e0a080"))
    out["prop_table"] = _with_shadow(img, 44)
    # banquinho
    img = new_img(14, 13)
    d = ImageDraw.Draw(img)
    _wood(d, (1, 2, 12, 5), WL, False)
    for x in (2, 9):
        d.rectangle([x, 5, x + 2, 12], fill=WD)
    out["prop_stool"] = _with_shadow(finish(img, light=0.22), 12)
    # pilha de caixotes
    img = new_img(36, 32)
    d = ImageDraw.Draw(img)
    for (x, y, w) in ((1, 14, 17), (18, 16, 16), (9, 1, 16)):
        _wood(d, (x, y, x + w, y + 15), W_)
        d.line([(x + 1, y + 1), (x + w - 1, y + 14)], fill=WD)
        d.line([(x + 1, y + 14), (x + w - 1, y + 1)], fill=WD)
        d.rectangle([x, y, x + w, y + 15], outline=WD)
    img = finish(img, light=0.24, dark=0.68)
    d = ImageDraw.Draw(img)
    for (x, y) in ((2, 15), (19, 17), (10, 2)):
        d.line([(x, y), (x + 5, y)], fill=WL)
    out["prop_crates"] = _with_shadow(img, 36)
    # cesto de frutas e cesto de pães (vime trançado)
    for key, fruits in (("prop_basket_fruit", (hexc("c84a2a"), hexc("e0b040"), hexc("6a9a3a"), hexc("c84a2a"))), ("prop_basket_bread", (hexc("c8903a"), hexc("b07a30"), hexc("d8a050")))):
        img = new_img(22, 16)
        d = ImageDraw.Draw(img)
        for i, c in enumerate(fruits):
            d.ellipse([2 + i * 5, 1 + (i % 2), 9 + i * 5, 8 + (i % 2)], fill=c)
        d.polygon([(1, 6), (21, 6), (18, 15), (4, 15)], fill=hexc("b89a5a"))
        img = finish(img, light=0.25, dark=0.7)
        d = ImageDraw.Draw(img)
        for y in (8, 11, 14):
            for x in range(3 + (y % 2) * 2, 19, 4):
                d.point((x, y), fill=hexc("8a6a3a"))
        d.line([(2, 6), (20, 6)], fill=hexc("d8be7a"))
        for i in range(len(fruits)):
            d.point((4 + i * 5, 2 + (i % 2)), fill=(255, 240, 210))
        out[key] = _with_shadow(img, 20)
    # barril com aros de ferro
    img = new_img(16, 22)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([1, 1, 14, 21], radius=4, fill=W_)
    for x in (4, 8, 11):
        d.line([(x, 2), (x, 20)], fill=darker(W_, 0.85))
    img = finish(img, light=0.25, dark=0.66)
    d = ImageDraw.Draw(img)
    for y in (5, 16):
        d.line([(1, y), (14, y)], fill=hexc("4a4a52"))
        d.point((3, y - 1), fill=hexc("9a9aa8"))
    d.line([(4, 3), (4, 19)], fill=WL)
    out["prop_barrel"] = _with_shadow(img, 15)
    # sacos de grão
    img = new_img(26, 15)
    d = ImageDraw.Draw(img)
    for (x, y) in ((1, 4), (12, 3)):
        d.rounded_rectangle([x, y, x + 12, y + 11], radius=4, fill=hexc("c8b48a"))
        d.rectangle([x + 4, y - 2, x + 8, y + 1], fill=hexc("b8a47a"))
    img = finish(img, light=0.25, dark=0.72)
    d = ImageDraw.Draw(img)
    d.line([(15, 8), (21, 8)], fill=hexc("9a8460"))
    d.point((6, 7), fill=hexc("8a7450"))
    out["prop_sacks"] = _with_shadow(img, 24)
    # ânforas encostadas
    img = new_img(28, 26)
    d = ImageDraw.Draw(img)
    for i, x in enumerate((2, 10, 18)):
        c = (hexc("b0603a"), hexc("c87a48"), hexc("9a5030"))[i]
        d.ellipse([x, 6, x + 8, 22], fill=c)
        d.rectangle([x + 3, 2, x + 5, 7], fill=c)
        d.polygon([(x + 3, 22), (x + 5, 22), (x + 4, 25)], fill=c)
        d.line([(x + 1, 4), (x + 3, 6)], fill=c)
    img = finish(img, light=0.25, dark=0.7)
    d = ImageDraw.Draw(img)
    for x in (4, 12, 20):
        d.line([(x, 9), (x, 14)], fill=hexc("e0a07a"))
        d.line([(x - 1, 16), (x + 6, 16)], fill=hexc("6a3a20"))
    out["prop_amphorae"] = _with_shadow(img, 26)
    return out


# ------------------------------------------------------------------ objetos do alojamento, termas e ludus
def _shaded_crop(draw, box, shadow=None, light=0.22, dark=0.7):
    """Desenha numa tela 640x360 (coordenadas do cenário), sombreia e recorta a caixa."""
    layer = new_img(640, 360)
    draw(ImageDraw.Draw(layer))
    layer = finish(layer, light=light, dark=dark)
    x0, y0, x1, y1 = box
    img = layer.crop((x0, y0, x1, y1 + 4))
    if shadow:
        out = new_img(img.width, img.height)
        d = ImageDraw.Draw(out)
        sx0, sx1 = shadow
        d.ellipse([sx0 - x0, y1 - y0 - 3, sx1 - x0, y1 - y0 + 3], fill=(0, 0, 0, 70))
        out.alpha_composite(img)
        img = out
    return img


def home_props():
    WOOD = hexc("7a5230")
    WOOD_D = hexc("5a3a20")
    GOLD_ = hexc("d8b04a")
    out = {}

    def amphora(d):
        d.ellipse([186, 286, 200, 308], fill=hexc("b0603a"))
        d.rectangle([190, 280, 196, 288], fill=hexc("b0603a"))
        d.line([(188, 283), (190, 287)], fill=hexc("9a5030"), width=2)
        d.line([(198, 283), (196, 287)], fill=hexc("9a5030"), width=2)
    out["prop_home_amphora"] = _shaded_crop(amphora, (182, 276, 204, 308), (184, 202))

    def table(d):
        d.rectangle([226, 283, 268, 287], fill=hexc("9a6a3e"))
        d.rectangle([229, 287, 233, 307], fill=WOOD_D)
        d.rectangle([261, 287, 265, 307], fill=WOOD_D)
        d.rectangle([232, 289, 262, 291], fill=WOOD)
        # lucerna (lamparina de barro): corpo, bico e alça
        d.ellipse([231, 278, 241, 283], fill=hexc("a0522d"))
        d.polygon([(239, 279), (244, 279), (245, 281), (239, 282)], fill=hexc("a0522d"))
        d.rectangle([229, 279, 231, 281], fill=hexc("8a4426"))
        d.point((235, 279), fill=hexc("4a2414"))
        d.ellipse([247, 278, 257, 284], fill=hexc("c8903a"))
        d.rectangle([259, 277, 264, 283], fill=hexc("8a8a9a"))
    img = _shaded_crop(table, (224, 270, 270, 307), (226, 268))
    d = ImageDraw.Draw(img)
    d.point((244 - 224, 279 - 270), fill=hexc("3a2a1a"))  # pavio
    d.line([(249 - 224, 280 - 270), (255 - 224, 280 - 270)], fill=hexc("e8b860"))
    out["prop_home_table"] = img

    # chama da lucerna (4 quadros de 6x8, animada pela cena)
    sheet = new_img(24, 8)
    sd = ImageDraw.Draw(sheet)
    for f, (sway, h) in enumerate([(0, 7), (1, 8), (0, 6), (-1, 8)]):
        ox = f * 6
        sd.polygon([(ox + 1, 7), (ox + 5, 7), (ox + 4 + sway // 2, 7 - h // 2), (ox + 3 + sway, 7 - h + 1), (ox + 2 + sway // 2, 7 - h // 2)], fill=hexc("e2702a"))
        sd.polygon([(ox + 2, 7), (ox + 4, 7), (ox + 3 + sway, 7 - h + 3)], fill=hexc("f8c040"))
        sd.point((ox + 3, 6), fill=hexc("fff4c0"))
    out["lamp_flame"] = sheet

    def stool(d):
        d.rectangle([269, 293, 285, 297], fill=hexc("9a6a3e"))
        d.line([(271, 297), (270, 307)], fill=WOOD_D, width=2)
        d.line([(283, 297), (284, 307)], fill=WOOD_D, width=2)
    out["prop_home_stool"] = _shaded_crop(stool, (266, 290, 288, 307), (268, 286))

    def chest(d):
        d.rectangle([452, 292, 480, 308], fill=hexc("6a4628"))
        d.rectangle([452, 290, 480, 296], fill=hexc("8a6038"))
        d.rectangle([452, 296, 480, 297], fill=hexc("4a3020"))
        d.rectangle([457, 290, 459, 308], fill=hexc("4a4a52"))
        d.rectangle([473, 290, 475, 308], fill=hexc("4a4a52"))
        d.rectangle([464, 298, 468, 303], fill=GOLD_)
    out["prop_home_chest"] = _shaded_crop(chest, (450, 288, 482, 308), (451, 481))

    # tapete e sandálias: decalques no chão (sem colisão)
    def rug(d):
        d.rectangle([304, 304, 376, 318], fill=hexc("9a5a2a"))
        d.rectangle([307, 306, 373, 316], fill=hexc("c8903a"))
        for x in range(310, 372, 8):
            d.rectangle([x, 309, x + 3, 312], fill=hexc("7a2a1e"))
        d.line([(307, 311), (373, 311)], fill=hexc("b07a30"))
    layer = new_img(640, 360)
    rug(ImageDraw.Draw(layer))
    rimg = finish(layer, light=0.15, dark=0.8, ol=False).crop((302, 302, 378, 320))
    rd = ImageDraw.Draw(rimg)
    for x in range(0, 76, 4):  # franjas
        rd.point((x, 0), fill=hexc("e8d0a0"))
        rd.point((x, 17), fill=hexc("e8d0a0"))
    out["prop_home_rug"] = rimg

    def sandals(d):
        d.rectangle([380, 306, 388, 308], fill=hexc("6a4628"))
        d.rectangle([381, 310, 389, 312], fill=hexc("6a4628"))
        d.line([(382, 306), (382, 305)], fill=hexc("4a3020"))
    out["prop_home_sandals"] = _shaded_crop(sandals, (378, 303, 391, 312))

    # camas: palha (inicial), lã e de nobre — no mesmo lugar (x 386–452)
    def bed_straw(d):
        d.rectangle([390, 292, 448, 298], fill=hexc("6a4628"))
        d.rectangle([390, 285, 394, 308], fill=hexc("5a3a20"))
        d.rectangle([444, 287, 448, 308], fill=hexc("5a3a20"))
        d.rectangle([394, 285, 444, 292], fill=hexc("d8c48a"))
        d.rectangle([414, 283, 444, 292], fill=hexc("8e2b23"))
        d.ellipse([395, 280, 409, 288], fill=hexc("efe6d2"))
    img = _shaded_crop(bed_straw, (380, 250, 458, 308), (386, 452))
    d = ImageDraw.Draw(img)
    for x in range(418 - 380, 444 - 380, 6):
        d.line([(x, 284 - 250), (x, 291 - 250)], fill=hexc("b8473a"))
    for x in range(396 - 380, 412 - 380, 3):
        d.point((x, 291 - 250), fill=hexc("b8a060"))
    out["prop_bed_straw"] = img
    from gen_v05 import bed_overlay
    for kind in ("wool", "noble"):
        full = bed_overlay(kind)
        img = full.crop((380, 250, 458, 312))
        sh = new_img(img.width, img.height)
        ImageDraw.Draw(sh).ellipse([6, 55, 72, 61], fill=(0, 0, 0, 70))
        sh.alpha_composite(img)
        out[f"prop_bed_{kind}"] = sh
    return out


def place_props():
    """Objetos das termas e do ludus."""
    out = {}
    MARB = hexc("e8e2d4")
    MARB_D = hexc("b8b0a0")

    def bench(d):
        d.rectangle([2, 10, 50, 15], fill=MARB)
        d.rectangle([5, 15, 11, 26], fill=MARB_D)
        d.rectangle([41, 15, 47, 26], fill=MARB_D)
        d.rectangle([2, 15, 50, 16], fill=MARB_D)
    layer = new_img(52, 30)
    bench(ImageDraw.Draw(layer))
    out["prop_bench"] = _with_shadow(finish(layer, light=0.25, dark=0.75), 50)

    layer = new_img(22, 18)
    d = ImageDraw.Draw(layer)
    for i, c in enumerate((hexc("efe6d2"), hexc("c8483a"), hexc("efe6d2"), hexc("4a6aa8"))):
        d.rounded_rectangle([1 + (i % 2), 13 - i * 4, 20 - (i % 2), 17 - i * 4], radius=2, fill=c)
    out["prop_towels"] = _with_shadow(finish(layer, light=0.25, dark=0.75), 20)

    layer = new_img(18, 26)
    d = ImageDraw.Draw(layer)
    d.rectangle([4, 18, 14, 25], fill=hexc("b0603a"))
    d.rectangle([3, 16, 15, 19], fill=hexc("9a5030"))
    for (x, y) in ((9, 4), (5, 8), (13, 8), (8, 11), (11, 13), (6, 14)):
        d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=hexc("4a8a44"))
    out["prop_plant"] = _with_shadow(finish(layer, light=0.25, dark=0.72), 14)

    # ludus: suporte de lanças e gládios, escudos encostados, cocho de água
    layer = new_img(56, 72)
    d = ImageDraw.Draw(layer)
    d.rectangle([2, 26, 54, 30], fill=hexc("6a4428"))
    d.rectangle([2, 48, 54, 52], fill=hexc("6a4428"))
    d.rectangle([2, 26, 5, 71], fill=hexc("5a3a20"))
    d.rectangle([51, 26, 54, 71], fill=hexc("5a3a20"))
    for k in range(5):
        x = 8 + k * 10
        d.rectangle([x, 4, x + 2, 70], fill=hexc("8a6a40"))
        d.polygon([(x - 1, 6), (x + 1, 0), (x + 3, 6)], fill=hexc("c4c8d0"))
    img = finish(layer, light=0.24, dark=0.7)
    d = ImageDraw.Draw(img)
    for k in range(5):
        d.point((8 + k * 10, 3), fill=(240, 244, 250))
    out["prop_rack"] = _with_shadow(img, 52)

    layer = new_img(32, 34)
    d = ImageDraw.Draw(layer)
    for sx in (2, 17):
        d.rectangle([sx, 2, sx + 13, 33], fill=hexc("d8b04a"))
        d.rectangle([sx + 1, 3, sx + 12, 32], fill=hexc("a62c24"))
        d.ellipse([sx + 4, 14, sx + 9, 20], fill=hexc("c4c8d0"))
    img = finish(layer, light=0.24, dark=0.7)
    d = ImageDraw.Draw(img)
    for sx in (2, 17):
        d.line([(sx + 6, 5), (sx + 6, 12)], fill=hexc("d8b04a"))
        d.line([(sx + 6, 22), (sx + 6, 29)], fill=hexc("d8b04a"))
    out["prop_shields"] = _with_shadow(img, 30)

    layer = new_img(54, 18)
    d = ImageDraw.Draw(layer)
    d.rectangle([1, 2, 52, 17], fill=hexc("9a9080"))
    d.rectangle([4, 4, 49, 8], fill=hexc("4a7aa0"))
    img = finish(layer, light=0.22, dark=0.72)
    d = ImageDraw.Draw(img)
    d.line([(8, 5), (18, 5)], fill=hexc("8ac0e0"))
    d.line([(28, 6), (40, 6)], fill=hexc("8ac0e0"))
    out["prop_trough"] = _with_shadow(img, 52)
    return out
