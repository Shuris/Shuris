"""Little Creek master palette (see docs/ART_DIRECTION.md).

Every generated asset samples its colors from these ramps. Ramps are ordered
dark -> light so that a shading value in [0, 1] can be mapped directly.
"""


def hx(s):
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


def ramp(*hexes):
    return [hx(h) for h in hexes]


SHADOW = ramp("#0c1820", "#111d25", "#16222e", "#1e2b34", "#24393c", "#2f4347")

LEAF = ramp("#0f2a22", "#103825", "#144325", "#1f5131", "#2b6631", "#3f7c36",
            "#5d9148", "#7fa94a", "#a3c45a", "#c9da78", "#e6e8a0")
# foreground leaves: darker, cooler ramp (closest plane is in shadow)
LEAF_NEAR = ramp("#0a1519", "#0c1c1c", "#0f2a22", "#123426", "#163f2a", "#1f5131",
                 "#2b6631", "#3f7c36", "#5d9148")
LEAF_TEAL = ramp("#0f2429", "#143835", "#17413c", "#234748", "#32564f", "#386c5d",
                 "#487360", "#5e8a6a", "#7fa77a")
# dry / stage-1 vegetation: olive and ochre, still pleasant
LEAF_DRY = ramp("#1d2418", "#2c3420", "#3f4427", "#56572e", "#6f6a36", "#8b7f41",
                "#a6964f", "#c2ad62", "#d9c47c")

MIST = ramp("#2f4347", "#3b5452", "#475d5a", "#55796b", "#618e95", "#779885",
            "#7f9e8c", "#9fbb95", "#abc79e", "#bbd7b7", "#d6e6c8", "#e9f0d8")
MIST_COOL = ramp("#24393c", "#2f4a4f", "#3d5f63", "#4f7476", "#618e95", "#79a3a4",
                 "#93b8b3", "#afcdc4", "#cfe2d6", "#e9f0e2")
LIGHT = ramp("#f1f3e0", "#fff6d0")

ROCK = ramp("#1e2228", "#2a2d30", "#374043", "#444746", "#555955", "#6d6758",
            "#8a7f66", "#999a7b", "#b7a37a", "#d4ba88", "#ead4a8", "#f5e6c4")
ROCK_COOL = ramp("#16222e", "#1e2b34", "#2a3a40", "#3a4a4c", "#4d5c5a", "#647069",
                 "#7d8879", "#9aa38c", "#b7bc9f")
MOSS = ramp("#173a22", "#1f4d2a", "#2f6431", "#467d38", "#679843", "#8db352",
            "#b4cd68", "#d3df85")

EARTH = ramp("#1a1611", "#2b2219", "#3d2f22", "#574231", "#74583b", "#93714a",
             "#b38d5b", "#cfae78")
LITTER = ramp("#2b2219", "#46321f", "#634528", "#80592f", "#9c6f38", "#b88b48",
              "#d1a85e", "#e3c47c")
GRASS = ramp("#12301f", "#1a4127", "#25542c", "#356a31", "#4c8136", "#67983e",
             "#87b048", "#a9c75a", "#cbdc78", "#e3ea9c")

WATER = ramp("#0f2429", "#153e40", "#1d4f55", "#2b6a70", "#3f8686", "#5aa3a0",
             "#7fc0b8", "#a9dcd0", "#d8f0e6", "#f1f3e0")
WATER_MURKY = ramp("#1f2318", "#2c2f20", "#3d4229", "#545a36", "#6e7445", "#8a8c5a",
                   "#a8a678", "#d6d2b0")

BARK = ramp("#0e1214", "#171b1d", "#22262a", "#2f3134", "#3e3d3b", "#524c44",
            "#6a5f50", "#857560", "#a08d72")
BARK_WARM = ramp("#1a1310", "#2a1d16", "#3b2a1e", "#4f3a28", "#674c33", "#80603f",
                 "#9b784f", "#b89263")
WOOD = ramp("#2a1a10", "#3f2717", "#5a3920", "#774d2b", "#946337", "#b07c45",
            "#c99a5c", "#ddb87a")

FLOWER = {
    "white": ramp("#8f9a86", "#cfd2c0", "#f4f1e6", "#ffffff"),
    "yellow": ramp("#9a6f1c", "#d9a52f", "#f2d35b", "#fff09a"),
    "orange": ramp("#8a3f1a", "#c4602a", "#e98a3b", "#f6b56a"),
    "pink": ramp("#6e2a43", "#a8446a", "#c85a7c", "#eaa0b8"),
    "purple": ramp("#3e2a6e", "#6450a8", "#8c6bc8", "#bca3ec"),
    "red": ramp("#6a1a1e", "#a8302f", "#d94848", "#f08a7a"),
    "blue": ramp("#22336e", "#3a55a8", "#5a7fd6", "#9ab8f0"),
}

# creatures
FUR = ramp("#1e130d", "#36210f", "#553419", "#764a24", "#966131", "#b47b44",
           "#cf9a5e", "#e6bf8a", "#f3dfbd")
FEATHER_BROWN = ramp("#2a1a10", "#4a3220", "#6b4a2e", "#8c6640", "#a98256")
FEATHER_ORANGE = ramp("#7a3410", "#b5541c", "#d9782d", "#f0a24c", "#f8c47a")
CREAM = ramp("#a89a7c", "#d0c29e", "#e8d9b0", "#f6edd2")
SKIN = ramp("#5a3424", "#82503a", "#a8704f", "#c99069", "#e2b48a")
