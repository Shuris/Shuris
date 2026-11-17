"""Monta os recursos gráficos da versão Godot a partir dos geradores da versão atual.

- Personagens: as mesmas camadas do gladiador, mas na resolução nativa (1x), sem a
  passada de resolução dupla: no Godot o jogo inteiro é desenhado numa grade de
  640x360 pixels e ampliado em escala inteira, então cada pixel da arte é um pixel
  da tela (visual mais pixelado e coerente).
- Cenários, efeitos, retratos e ícones: copiados da versão atual.
- Paleta: as cores de toda a arte são reduzidas a uma paleta única (k-médias), usada
  pelo filtro de pós-processamento para que tudo pertença ao mesmo conjunto de cores.
- Menu: a arte do menu é gerada na grade de 640x360.
- Fontes em pixel (VT323 e Pixelify Sans, licença OFL).

Uso: python3 tools/build_assets.py  (a partir da pasta colosseum-godot)
"""
import glob
import os
import shutil
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "..", "colosseum")
SRC_TOOLS = os.path.join(SRC, "tools")
SRC_ASSETS = os.path.join(SRC, "src", "renderer", "public", "assets")
OUT = os.path.join(ROOT, "assets")
sys.path.insert(0, SRC_TOOLS)


def halve(img):
    """Reduz pela metade escolhendo, em cada bloco 2x2, a cor que mais aparece (o pixel
    original do Scale2x); transparente só se a maioria do bloco for transparente."""
    a = np.asarray(img.convert("RGBA"))
    h, w = a.shape[0] // 2, a.shape[1] // 2
    blocks = a[: h * 2, : w * 2].reshape(h, 2, w, 2, 4).transpose(0, 2, 1, 3, 4).reshape(h, w, 4, 4)
    out = np.zeros((h, w, 4), dtype=np.uint8)
    # chave de cor para votar
    key = (blocks[..., 0].astype(np.int64) << 24) | (blocks[..., 1].astype(np.int64) << 16) | (blocks[..., 2].astype(np.int64) << 8) | blocks[..., 3]
    opaque = blocks[..., 3] > 0
    for i in range(4):
        same = (key == key[..., i:i + 1]).sum(-1)
        if i == 0:
            best, best_n = np.zeros((h, w), dtype=np.int64), same * opaque[..., 0]
        else:
            better = (same * opaque[..., i]) > best_n
            best = np.where(better, i, best)
            best_n = np.where(better, same * opaque[..., i], best_n)
    pick = np.take_along_axis(blocks, best[..., None, None].repeat(4, -1), axis=2)[:, :, 0]
    out[:] = pick
    out[opaque.sum(-1) < 2, 3] = 0
    out[out[..., 3] > 0, 3] = 255
    return Image.fromarray(out, "RGBA")


def characters():
    """Folhas do gladiador e das feras em 1x (metade das folhas 2x da versão atual)."""
    import json
    src = os.path.join(SRC_ASSETS, "sprites", "gladiator")
    out = os.path.join(OUT, "sprites", "gladiator")
    os.makedirs(out, exist_ok=True)
    m = json.load(open(os.path.join(src, "manifest.json")))
    res = m.get("res", 1)
    for f in glob.glob(os.path.join(src, "*.png")):
        img = Image.open(f)
        (halve(img) if res == 2 else img).save(os.path.join(out, os.path.basename(f)))
    if res == 2:
        m["frameWidth"] //= 2
        m["frameHeight"] //= 2
        m["originX"] //= 2
        m["originY"] //= 2
        for w in m["weapons"].values():
            w["gripX"] = w["gripX"] // 2
            w["gripY"] = w["gripY"] // 2
        m["hands"] = [[h[0] / 2, h[1] / 2, h[2]] for h in m["hands"]]
        m["res"] = 1
    json.dump(m, open(os.path.join(out, "manifest.json"), "w"))


def copy_tree(rel, pattern="*.png"):
    src = os.path.join(SRC_ASSETS, rel)
    dst = os.path.join(OUT, rel)
    os.makedirs(dst, exist_ok=True)
    for f in glob.glob(os.path.join(src, pattern)):
        shutil.copy2(f, dst)


def title_art():
    import gen_title
    img = gen_title.build_small(SRC_ASSETS)
    img.save(os.path.join(OUT, "ui", "title.png"))


def palette(n=48):
    """Paleta única por k-médias sobre as cores de toda a arte (pixels opacos)."""
    cols = []
    for f in glob.glob(os.path.join(OUT, "**", "*.png"), recursive=True):
        if "palette" in f:
            continue
        a = np.asarray(Image.open(f).convert("RGBA")).reshape(-1, 4)
        a = a[a[:, 3] > 200][:, :3]
        if len(a) > 4000:
            a = a[np.random.default_rng(1).choice(len(a), 4000, replace=False)]
        cols.append(a)
    data = np.concatenate(cols).astype(np.float32)
    rng = np.random.default_rng(7)
    cent = data[rng.choice(len(data), n, replace=False)]
    for _ in range(25):
        d = ((data[:, None, :] - cent[None, :, :]) ** 2).sum(-1)
        lab = d.argmin(1)
        for k in range(n):
            m = lab == k
            if m.any():
                cent[k] = data[m].mean(0)
    # garante os extremos (contorno quase preto e realce quase branco)
    cent[np.argmin(cent.sum(1))] = (20, 12, 10)
    cent[np.argmax(cent.sum(1))] = (252, 244, 226)
    cent = cent[np.argsort(cent.sum(1))]
    img = Image.fromarray(np.clip(cent, 0, 255).astype(np.uint8).reshape(1, n, 3), "RGB")
    img.save(os.path.join(OUT, "palette.png"))


def fonts():
    dst = os.path.join(OUT, "fonts")
    os.makedirs(dst, exist_ok=True)
    fs = os.path.join(SRC, "node_modules", "@fontsource")
    for pkg, files in (("vt323", ["vt323-latin-400-normal.woff2", "vt323-latin-ext-400-normal.woff2"]),
                       ("pixelify-sans", ["pixelify-sans-latin-700-normal.woff2", "pixelify-sans-latin-400-normal.woff2"])):
        for f in files:
            shutil.copy2(os.path.join(fs, pkg, "files", f), dst)
        lic = os.path.join(fs, pkg, "LICENSE")
        if os.path.exists(lic):
            shutil.copy2(lic, os.path.join(dst, f"{pkg}-LICENSE.txt"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    characters()
    for rel in ("backgrounds", "sprites/fx", "sprites/beasts", "portraits", "ui", "ui/items", "news"):
        copy_tree(rel)
    title_art()
    fonts()
    shutil.copy2(os.path.join(SRC, "build", "icon.png"), os.path.join(ROOT, "icon.png"))
    palette()
    print("ok")
