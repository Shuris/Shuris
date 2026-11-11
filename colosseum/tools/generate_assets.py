#!/usr/bin/env python3
"""Gera todos os assets em pixel art do COLOSSEUM.

Uso:  python3 tools/generate_assets.py   (requer Pillow e numpy)

Saída:
  src/renderer/public/assets/sprites/gladiator/*.png + manifest.json
  src/renderer/public/assets/sprites/fx/*.png
  src/renderer/public/assets/backgrounds/*.png
  src/renderer/public/assets/ui/icons/*.png, ui/panel.png
  build/icon.png, build/icon.ico (ícone do instalador/aplicativo)

Os PNGs gerados são versionados no repositório; regenere apenas quando alterar
a arte procedural. Para usar arte desenhada à mão, substitua os PNGs mantendo
os mesmos nomes e a mesma grade descrita em manifest.json.
"""
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))

from PIL import Image  # noqa: E402
import gen_gladiator  # noqa: E402
import gen_scenes  # noqa: E402
import gen_ui  # noqa: E402
import gen_arenas  # noqa: E402
import sky  # noqa: E402
import gen_locations  # noqa: E402
import gen_v05  # noqa: E402
import gen_v06  # noqa: E402
import gen_news  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS = os.path.join(ROOT, "src", "renderer", "public", "assets")


def main():
    rng = random.Random(1337)
    gl_dir = os.path.join(ASSETS, "sprites", "gladiator")
    manifest, _ = gen_gladiator.generate(gl_dir)
    print(f"gladiador: {len(manifest['sheets'])} folhas x {manifest['frameCount']} quadros")
    gen_gladiator.icons(os.path.join(ASSETS, "ui", "items"))

    bg = os.path.join(ASSETS, "backgrounds")
    os.makedirs(bg, exist_ok=True)
    for old in ("arena.png", "crowd.png"):
        if os.path.exists(os.path.join(bg, old)):
            os.remove(os.path.join(bg, old))
    for tid in gen_arenas.ORDER:
        img, shadow = gen_arenas.arena(tid, rng)
        img.save(os.path.join(bg, f"arena_{tid}.png"))
        gen_arenas.crowd(tid, rng, shadow).save(os.path.join(bg, f"crowd_{tid}.png"))
        # dia de festival: arquibancada lotada
        gen_arenas.crowd(tid, random.Random(tid), shadow, density=0.99).save(os.path.join(bg, f"crowdfest_{tid}.png"))
    gen_scenes.ludus(rng).save(os.path.join(bg, "ludus.png"))
    for loc in ("home", "market", "temple", "forum", "baths"):
        getattr(gen_locations, loc)(rng).save(os.path.join(bg, f"loc_{loc}.png"))
    gen_locations.city_map(rng).save(os.path.join(bg, "map.png"))
    fx = os.path.join(ASSETS, "sprites", "fx")
    os.makedirs(fx, exist_ok=True)
    gen_scenes.brazier_sheet().save(os.path.join(fx, "brazier.png"))
    gen_scenes.glow_sprite().save(os.path.join(fx, "glow.png"))
    gen_scenes.palus_sheet().save(os.path.join(fx, "palus.png"))
    gen_locations.monk_sheet().save(os.path.join(fx, "monk.png"))
    sky.sun().save(os.path.join(fx, "sun.png"))
    sky.moon().save(os.path.join(fx, "moon.png"))
    sky.cloud(rng).save(os.path.join(fx, "cloud.png"))

    icons = os.path.join(ASSETS, "ui", "icons")
    os.makedirs(icons, exist_ok=True)
    for name, fn in gen_ui.ICONS.items():
        fn().save(os.path.join(icons, name + ".png"))
    gen_ui.panel_9slice().save(os.path.join(ASSETS, "ui", "panel.png"))

    build = os.path.join(ROOT, "build")
    os.makedirs(build, exist_ok=True)
    icon = gen_ui.app_icon()
    big = icon.resize((256, 256), Image.NEAREST)
    big.save(os.path.join(build, "icon.png"))
    big.save(os.path.join(ASSETS, "ui", "app-icon.png"))
    big.save(os.path.join(build, "icon.ico"), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    icon.resize((32, 32), Image.NEAREST).save(os.path.join(build, "tray.png"))

    # versão 0.5: taverna, camas, equipamentos do ludus, ícones e jornal
    gen_v05.tavern(rng).save(os.path.join(bg, "loc_tavern.png"))
    gen_v05.tavern_front().save(os.path.join(fx, "tavern_front.png"))
    gen_v05.palus_iron_sheet().save(os.path.join(fx, "palus_iron.png"))
    gen_v05.up_weights().save(os.path.join(fx, "up_weights.png"))
    gen_v05.up_stakes().save(os.path.join(fx, "up_stakes.png"))
    gen_v05.up_track().save(os.path.join(fx, "up_track.png"))
    for name, fn in gen_v05.UPGRADE_ICONS.items():
        fn().save(os.path.join(icons, name + ".png"))

    # versão 0.6: festival, mercador, forja, queda de braço, retratos, menu e jornal
    gen_v06.festival_overlay().save(os.path.join(fx, "festival.png"))
    gen_v06.merchant_cart().save(os.path.join(fx, "merchant_cart.png"))
    gen_v06.forge().save(os.path.join(fx, "forge.png"))
    gen_v06.arm_table().save(os.path.join(fx, "arm_table.png"))
    gen_v06.crowd_front().save(os.path.join(fx, "crowd_front.png"))
    for name, img in {**gen_v06.props(), **gen_v06.home_props(), **gen_v06.place_props()}.items():
        img.save(os.path.join(fx, name + ".png"))
    people = gen_v06.portraits(os.path.join(ASSETS, "portraits"))
    print(f"retratos: {len(people)}")
    gen_v06.title_art(ASSETS).save(os.path.join(ASSETS, "ui", "title.png"))
    # jornal: ilustrações em estilo gravura (depois de toda a arte, que elas usam)
    pics = gen_news.news_images(ASSETS, os.path.join(ASSETS, "news"))
    print(f"jornal: {len(pics)} ilustrações")
    print("assets gerados em", ASSETS)


if __name__ == "__main__":
    main()
