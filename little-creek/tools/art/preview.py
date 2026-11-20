"""Quick static composite of the environment layers (for art iteration)."""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from palette import WATER, LIGHT
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
S = os.path.join(ROOT, "assets", "sprites")
lush = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
out = sys.argv[2] if len(sys.argv) > 2 else "/tmp/preview.png"
def L(p): return Image.open(os.path.join(S, p)).convert("RGBA")
im = L("environment/bg_forest.png")
dry, lu = np.asarray(L("environment/ground_dry.png")), np.asarray(L("environment/ground_lush.png"))
rng = np.random.default_rng(1); thr = rng.random(dry.shape[:2])
g = np.where((thr < lush)[..., None], lu, dry)
im.alpha_composite(Image.fromarray(g.astype(np.uint8)))
flow = np.asarray(L("water/water_flow.png")); meta = np.asarray(L("water/water_meta.png")).astype(float)/255
bed = np.asarray(L("water/water_bed.png")).astype(float)
m = flow[..., 3] > 0
d = meta[..., 2]; v = 0.55 - d*0.45 + meta[..., 3]*0.25
ramp = np.array(WATER, float)
idx = np.clip((v*(len(ramp)-1)).round().astype(int), 0, len(ramp)-1)
col = ramp[idx]*0.75 + bed[..., :3]*0.25*(1-d[..., None])
foam = np.maximum(meta[..., 0]*0.9, meta[..., 1])
col = np.where((foam > 0.45)[..., None], np.array(LIGHT[0], float), col)
w = np.zeros(flow.shape, np.uint8); w[..., :3] = col; w[..., 3] = np.where(m, 255, 0)
im.alpha_composite(Image.fromarray(w))
rb, rmo = np.asarray(L("rocks/creek_rocks_bare.png")), np.asarray(L("rocks/creek_rocks_moss.png"))
r = np.where((thr < lush)[..., None], rmo, rb)
im.alpha_composite(Image.fromarray(r.astype(np.uint8)))
import json
pts = json.load(open(os.path.join(ROOT, "data", "scene_points.json")))
if "trail" in sys.argv[3:]:
    im.alpha_composite(L("environment/trail.png"))
im.alpha_composite(L("environment/mid_trees.png"))
for t in pts["frame_trees"]:
    im.alpha_composite(L("environment/%s.png" % t["name"]), (t["ox"], t["oy"]))
fb = np.where((thr < lush)[..., None], np.asarray(L("environment/fg_bottom_lush.png")), np.asarray(L("environment/fg_bottom_dry.png")))
im.alpha_composite(Image.fromarray(fb.astype(np.uint8)))
im.alpha_composite(L("environment/fg_top.png"))
for extra in sys.argv[3:]:
    p = os.path.join(S, extra)
    if os.path.exists(p): im.alpha_composite(L(extra))
im.crop((80, 0, 720, 360)).resize((1280, 720), Image.NEAREST).save(out)
