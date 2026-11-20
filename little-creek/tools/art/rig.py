"""Skeletal pixel-art renderer for complex characters (deer, humans).

Each body part is an organic closed spline (anatomical contour, not a
primitive shape) attached to a bone. A pose sets bone angles; the renderer
rasterizes every part at 4x supersampling, shades it from a height map
(distance transform -> dome -> normals) lit from the game's global light
(top-right), adds part-local fur/cloth texture (so it does not "boil" between
frames), downsamples to art pixels, quantizes to palette ramps and applies
pixel-art finishing: selective outline, occlusion lines between parts and
hand-placed detail pixels (eyes, nose) and 1px lines (antlers, straps).

Left-facing frames are rendered by mirroring the geometry only, so the light
still comes from the top-right (no flipped lighting in game).
"""
import math

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

SS = 4
LIGHT = np.array([0.55, -0.62, 0.56])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def catmull_closed(pts, n=6):
    pts = list(pts)
    out = []
    N = len(pts)
    for i in range(N):
        p0, p1, p2, p3 = pts[(i - 1) % N], pts[i], pts[(i + 1) % N], pts[(i + 2) % N]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                       + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                       + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    return out


class Part:
    def __init__(self, name, bone, pts, ramp, z, bias=0.0, clip=None, tex=0.06, tex_scale=2.0,
                 vgrad=0.10, dome=1.0, smooth=True, foot=False, offset_bias=None):
        self.name, self.bone, self.pts, self.ramp, self.z = name, bone, pts, ramp, z
        self.bias, self.clip, self.tex, self.tex_scale = bias, clip, tex, tex_scale
        self.vgrad, self.dome, self.smooth, self.foot = vgrad, dome, smooth, foot
        self.pattern = None


class Rig:
    """bones: {name: (parent or None, (px, py) pivot in parent space)}"""

    def __init__(self, bones, parts, lines=(), dots=(), scale=1.0):
        self.scale = scale
        self.bones = bones
        self.parts = sorted(parts, key=lambda p: p.z)
        self.lines = lines  # (bone, [(x,y),...], color, z_after_part or None, condition)
        self.dots = dots    # (bone, (x,y), color)
        self._noise = np.random.default_rng(3).random((64, 64)).astype(np.float32)

    # world transform of every bone: (origin xy, angle radians)
    def solve(self, pose):
        T = {}
        root_pos = pose.get("_root", (0.0, 0.0))

        def get(name):
            if name in T:
                return T[name]
            parent, piv = self.bones[name]
            piv = (piv[0] * self.scale, piv[1] * self.scale)
            ang = math.radians(pose.get(name, 0.0))
            if parent is None:
                T[name] = (np.array(root_pos, float) + np.array(piv, float), ang)
            else:
                po, pa = get(parent)
                c, s = math.cos(pa), math.sin(pa)
                o = po + np.array([c * piv[0] - s * piv[1], s * piv[0] + c * piv[1]])
                T[name] = (o, pa + ang)
            return T[name]

        for b in self.bones:
            get(b)
        return T

    def to_world(self, T, bone, p):
        p = (p[0] * self.scale, p[1] * self.scale)
        o, a = T[bone]
        c, s = math.cos(a), math.sin(a)
        return o + np.array([c * p[0] - s * p[1], s * p[0] + c * p[1]])

    def noise(self, lx, ly, scale):
        gx = (lx / scale) % 64
        gy = (ly / scale) % 64
        x0 = np.floor(gx).astype(int)
        y0 = np.floor(gy).astype(int)
        fx, fy = gx - x0, gy - y0
        n = self._noise
        a = n[y0 % 64, x0 % 64]
        b = n[y0 % 64, (x0 + 1) % 64]
        c = n[(y0 + 1) % 64, x0 % 64]
        d = n[(y0 + 1) % 64, (x0 + 1) % 64]
        return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

    def render(self, pose, size, ground_y, facing=1, auto_ground=True, outline_dark=2,
               lift=0.0):
        W, H = size
        ox = W / 2.0
        T = self.solve(pose)
        # auto-ground: lowest point of foot parts touches ground_y
        dy = 0.0
        if auto_ground:
            lows = []
            for p in self.parts:
                if p.foot:
                    for q in p.pts:
                        lows.append(self.to_world(T, p.bone, q)[1])
            if lows:
                dy = ground_y - max(lows) - lift
        hs, ws = H * SS, W * SS
        label = np.full((hs, ws), -1, np.int32)
        value = np.zeros((hs, ws), np.float32)
        masks = {}
        ys_g, xs_g = np.mgrid[0:hs, 0:ws].astype(np.float32)
        for i, p in enumerate(self.parts):
            pts = catmull_closed(p.pts) if p.smooth else p.pts
            wpts = [self.to_world(T, p.bone, q) for q in pts]
            poly = [((ox + facing * w[0]) * SS, (w[1] + dy) * SS) for w in wpts]
            img = Image.new("L", (ws, hs), 0)
            ImageDraw.Draw(img).polygon(poly, fill=255)
            m = np.asarray(img) > 127
            if p.clip is not None and p.clip in masks:
                m &= masks[p.clip]
            if not m.any():
                masks[p.name] = m
                continue
            masks[p.name] = m
            # part-local coordinates (for texture + vertical gradient)
            o, a = T[p.bone]
            wx = (xs_g / SS - ox) * facing
            wy = ys_g / SS - dy
            c, s = math.cos(-a), math.sin(-a)
            lx = c * (wx - o[0]) - s * (wy - o[1])
            ly = s * (wx - o[0]) + c * (wy - o[1])
            if p.clip is not None and p.clip in masks:
                # markings inherit the shading of the surface they sit on
                base = value.copy()
                v = base + p.bias
            else:
                d = ndimage.distance_transform_edt(m)
                dmax = max(d.max(), 1.0)
                h = np.sqrt(np.clip(1 - (1 - d / dmax) ** 2, 0, 1)) * dmax * p.dome
                gy, gx = np.gradient(h)
                nx, ny = -gx * facing, -gy
                nz = np.ones_like(nx) * 0.9
                ln = np.sqrt(nx * nx + ny * ny + nz * nz)
                lam = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / ln
                # world-up gradient: tops lighter
                wy_rel = np.zeros_like(lam)
                yy = np.nonzero(m)[0]
                if len(yy):
                    y0, y1 = yy.min(), yy.max()
                    wy_rel = 0.5 - (ys_g - y0) / max(y1 - y0, 1)
                v = 0.18 + lam * 0.62 + p.bias + wy_rel * p.vgrad
            if p.tex > 0:
                v = v + (self.noise(lx, ly, p.tex_scale) - 0.5) * 2 * p.tex
            if p.pattern is not None:
                v = v + p.pattern(lx, ly)
            label[m] = i
            value[m] = v[m]
        # downsample
        out = np.zeros((H, W, 4), np.uint8)
        lab_final = np.full((H, W), -1, np.int32)
        val_final = np.zeros((H, W), np.float32)
        lb = label.reshape(H, SS, W, SS).transpose(0, 2, 1, 3).reshape(H, W, SS * SS)
        vb = value.reshape(H, SS, W, SS).transpose(0, 2, 1, 3).reshape(H, W, SS * SS)
        cover = (lb >= 0).sum(-1)
        for yy in range(H):
            for xx in range(W):
                if cover[yy, xx] < SS * SS * 0.45:
                    continue
                cell = lb[yy, xx]
                vals, counts = np.unique(cell[cell >= 0], return_counts=True)
                # front-most part wins ties
                best = vals[np.argmax(counts * 1000 + vals)]
                if counts.max() < SS * SS * 0.25:
                    best = vals.max()
                lab_final[yy, xx] = best
                val_final[yy, xx] = vb[yy, xx][cell == best].mean()
        # occlusion line: pixels of a part touching a FRONT part become darker
        dark = np.zeros((H, W), np.float32)
        for (dyy, dxx) in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nb = np.roll(np.roll(lab_final, dyy, 0), dxx, 1)
            occl = (lab_final >= 0) & (nb > lab_final) & (nb >= 0)
            occl &= ~np.array([[self.parts[l].clip is not None if l >= 0 else False for l in row]
                               for row in nb])
            dark = np.where(occl, np.maximum(dark, 1.0), dark)
        # silhouette: selective outline (darker at bottom/left, softer top/right)
        opaque = lab_final >= 0
        for (dyy, dxx, k) in ((-1, 0, 1.0), (1, 0, float(outline_dark)), (0, -1, float(outline_dark)),
                              (0, 1, 1.0)):
            nb = np.roll(np.roll(opaque, dyy, 0), dxx, 1)
            # neighbour in direction (-dyy,-dxx) is empty
            edge = opaque & ~nb
            if facing < 0 and dxx != 0:
                k = float(outline_dark) if k == 1.0 else 1.0
            dark = np.where(edge, np.maximum(dark, k), dark)
        for i, p in enumerate(self.parts):
            m = lab_final == i
            if not m.any():
                continue
            n = len(p.ramp)
            idx = np.round(np.clip(val_final, 0, 1) * (n - 1)) - dark
            idx = np.clip(idx, 0, n - 1).astype(int)
            cols = np.array(p.ramp, np.uint8)[idx]
            out[m, :3] = cols[m]
            out[m, 3] = 255
        # 1px lines and detail pixels
        for ln in self.lines:
            bone, pts, color = ln[0], ln[1], ln[2]
            cond = ln[3] if len(ln) > 3 else None
            if cond is not None and not cond(pose):
                continue
            wp = [self.to_world(T, bone, q) for q in pts]
            for a_, b_ in zip(wp[:-1], wp[1:]):
                steps = int(max(abs(b_[0] - a_[0]), abs(b_[1] - a_[1])) * 2) + 1
                for t in np.linspace(0, 1, steps):
                    x = int(round(ox + facing * (a_[0] + (b_[0] - a_[0]) * t) - 0.5))
                    y = int(round(a_[1] + (b_[1] - a_[1]) * t + dy - 0.5))
                    if 0 <= x < W and 0 <= y < H:
                        c = color(t) if callable(color) else color
                        out[y, x, :3] = c[:3]
                        out[y, x, 3] = 255
        for dot in self.dots:
            bone, q, color = dot[0], dot[1], dot[2]
            cond = dot[3] if len(dot) > 3 else None
            if cond is not None and not cond(pose):
                continue
            w = self.to_world(T, bone, q)
            x = int(round(ox + facing * w[0] - 0.5))
            y = int(round(w[1] + dy - 0.5))
            if 0 <= x < W and 0 <= y < H and out[y, x, 3] > 0:
                out[y, x, :3] = color[:3]
        # clean isolated pixels
        a = out[..., 3] > 0
        nbc = sum(np.roll(np.roll(a, dy_, 0), dx_, 1) for dy_, dx_ in ((0, 1), (0, -1), (1, 0), (-1, 0)))
        out[a & (nbc == 0)] = 0
        self.last_T, self.last_dy, self.last_ox = T, dy, ox
        return out

    def point(self, bone, q, facing=1):
        """Pixel position of a bone-local point in the last rendered frame."""
        w = self.to_world(self.last_T, bone, q)
        return (self.last_ox + facing * w[0], w[1] + self.last_dy)
