"""Procedural pixel-art painting toolkit for Little Creek.

Everything is painted at native art resolution (1 array cell = 1 art pixel)
and quantized to palette ramps with low-amplitude ordered dithering, so the
output is crisp pixel art (no blur, no interpolation).
"""
import math
import numpy as np
from PIL import Image

LIGHT_DIR = np.array([0.62, -0.78])  # light comes from the top-right
LIGHT_DIR = LIGHT_DIR / np.linalg.norm(LIGHT_DIR)

BAYER4 = (np.array([[0, 8, 2, 10],
                    [12, 4, 14, 6],
                    [3, 11, 1, 9],
                    [15, 7, 13, 5]], dtype=np.float32) + 0.5) / 16.0 - 0.5


# ---------------------------------------------------------------- noise
def value_noise(w, h, cell, rng, octaves=1, persistence=0.5, sx=1.0, sy=1.0):
    """Smooth fractal value noise in [0,1], shape (h, w).

    sx / sy stretch features (sx>1 -> wider features), used for perspective.
    """
    total = np.zeros((h, w), np.float32)
    amp, norm = 1.0, 0.0
    c = float(cell)
    for _ in range(octaves):
        cw, ch = c * sx, c * sy
        gw, gh = int(w / cw) + 3, int(h / ch) + 3
        grid = rng.random((gh, gw)).astype(np.float32)
        ys = np.arange(h) / ch
        xs = np.arange(w) / cw
        y0 = np.floor(ys).astype(int)
        x0 = np.floor(xs).astype(int)
        fy = ys - y0
        fx = xs - x0
        fy = fy * fy * (3 - 2 * fy)
        fx = fx * fx * (3 - 2 * fx)
        a = grid[y0][:, x0]
        b = grid[y0][:, x0 + 1]
        cc = grid[y0 + 1][:, x0]
        d = grid[y0 + 1][:, x0 + 1]
        top = a + (b - a) * fx[None, :]
        bot = cc + (d - cc) * fx[None, :]
        total += amp * (top + (bot - top) * fy[:, None])
        norm += amp
        amp *= persistence
        c /= 2.0
    return total / norm


def bayer(w, h, ox=0, oy=0):
    reps = (h // 4 + 2, w // 4 + 2)
    t = np.tile(BAYER4, reps)
    return t[oy % 4: oy % 4 + h, ox % 4: ox % 4 + w]


# ---------------------------------------------------------------- canvas
class Canvas:
    """RGBA canvas with helpers. Coordinates are art pixels."""

    def __init__(self, w, h, fill=(0, 0, 0, 0)):
        self.w, self.h = w, h
        self.px = np.zeros((h, w, 4), np.uint8)
        self.px[:, :] = fill

    def put_ramp(self, mask, values, ramp_cols, dither=0.5, alpha=255, ox=0, oy=0):
        """Write ramp colors where mask is true.

        values: float array in [0,1] same shape as mask (or broadcastable).
        dither: ordered dithering amplitude in ramp steps.
        """
        h, w = mask.shape
        values = np.broadcast_to(values, mask.shape)
        # clip to canvas
        x0, y0 = max(ox, 0), max(oy, 0)
        x1, y1 = min(ox + w, self.w), min(oy + h, self.h)
        if x1 <= x0 or y1 <= y0:
            return
        sl = (slice(y0 - oy, y1 - oy), slice(x0 - ox, x1 - ox))
        mask = mask[sl]
        values = values[sl]
        if not np.isscalar(alpha):
            alpha = np.broadcast_to(alpha, (h, w))[sl]
        h, w = mask.shape
        n = len(ramp_cols)
        v = np.clip(values, 0, 1) * (n - 1) + bayer(w, h, x0, y0) * dither
        idx = np.clip(np.round(v), 0, n - 1).astype(int)
        cols = np.array(ramp_cols, np.uint8)[idx]
        region = self.px[y0:y1, x0:x1]
        m = mask
        region[m, :3] = cols[m]
        if np.isscalar(alpha):
            region[m, 3] = alpha
        else:
            region[m, 3] = alpha[m]

    def put_color(self, mask, color, ox=0, oy=0):
        h, w = mask.shape
        x0, y0 = max(ox, 0), max(oy, 0)
        x1, y1 = min(ox + w, self.w), min(oy + h, self.h)
        if x1 <= x0 or y1 <= y0:
            return
        mask = mask[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
        region = self.px[y0:y1, x0:x1]
        region[mask, :3] = color[:3]
        region[mask, 3] = color[3] if len(color) > 3 else 255

    def pixel(self, x, y, color):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y, x, :3] = color[:3]
            self.px[y, x, 3] = color[3] if len(color) > 3 else 255

    def blend_over(self, other, ox=0, oy=0):
        """Alpha-composite another canvas (binary alpha preferred)."""
        h, w = other.h, other.w
        x0, y0 = max(ox, 0), max(oy, 0)
        x1, y1 = min(ox + w, self.w), min(oy + h, self.h)
        if x1 <= x0 or y1 <= y0:
            return
        src = other.px[y0 - oy:y1 - oy, x0 - ox:x1 - ox].astype(np.float32)
        dst = self.px[y0:y1, x0:x1].astype(np.float32)
        a = src[..., 3:4] / 255.0
        out = dst.copy()
        out[..., :3] = src[..., :3] * a + dst[..., :3] * (1 - a)
        out[..., 3:4] = np.maximum(dst[..., 3:4], src[..., 3:4])
        self.px[y0:y1, x0:x1] = out.astype(np.uint8)

    def save(self, path):
        Image.fromarray(self.px, "RGBA").save(path)

    def image(self):
        return Image.fromarray(self.px, "RGBA")


def grid(w, h, ox=0, oy=0):
    ys, xs = np.mgrid[oy:oy + h, ox:ox + w]
    return xs.astype(np.float32), ys.astype(np.float32)


def ellipse_mask(w, h, cx, cy, rx, ry):
    xs, ys = grid(w, h)
    return ((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2 <= 1.0


# ---------------------------------------------------------------- foliage
def foliage_cluster(cv, cx, cy, rx, ry, ramp_cols, rng, blob=(2.0, 4.5),
                    density=1.0, light=LIGHT_DIR, bias=0.0, contrast=1.0,
                    lobes=6, rim=True, dither=0.45, alpha=255, shade_fn=None,
                    flat_bottom=0.0, fill_core=True):
    """Paint a clumpy canopy made of many small shaded leaf tufts.

    The canopy silhouette is a union of random ellipses (lobes). Each tuft is
    shaded by its own local normal plus a global term (lit top-right, dark
    bottom-left) and quantized to `ramp_cols`.
    shade_fn(x, y) -> additive value, lets callers inject e.g. fog or sunlight.
    """
    w, h = cv.w, cv.h
    # lobe centers
    lob = []
    for i in range(lobes):
        a = rng.random() * math.tau
        d = rng.random() ** 0.7 * 0.55
        lob.append((cx + math.cos(a) * rx * d, cy + math.sin(a) * ry * d,
                    rx * (0.45 + rng.random() * 0.35), ry * (0.45 + rng.random() * 0.35)))
    lob.append((cx, cy, rx * 0.7, ry * 0.7))

    def inside(px, py):
        for lx, ly, lrx, lry in lob:
            if ((px - lx) / lrx) ** 2 + ((py - ly) / lry) ** 2 <= 1:
                return True
        return False

    alpha_before = cv.px[..., 3].copy() if fill_core else None
    area = math.pi * rx * ry
    bmean = (blob[0] + blob[1]) / 2
    count = int(area / (bmean * bmean) * 1.6 * density) + 4
    tufts = []
    tries = 0
    while len(tufts) < count and tries < count * 6:
        tries += 1
        px = cx + (rng.random() * 2 - 1) * rx
        py = cy + (rng.random() * 2 - 1) * ry
        if flat_bottom and py > cy + ry * (1 - flat_bottom):
            continue
        if not inside(px, py):
            continue
        r = blob[0] + rng.random() * (blob[1] - blob[0])
        g = ((px - cx) / rx * light[0] + (py - cy) / ry * light[1])
        tufts.append((g + rng.random() * 0.35, px, py, r, g))
    tufts.sort(key=lambda t: t[0])
    for _, px, py, r, g in tufts:
        R = int(math.ceil(r)) + 1
        x0, y0 = int(px) - R, int(py) - R
        x1, y1 = int(px) + R + 1, int(py) + R + 1
        xa, ya = max(x0, 0), max(y0, 0)
        xb, yb = min(x1, w), min(y1, h)
        if xb <= xa or yb <= ya:
            continue
        xs, ys = grid(xb - xa, yb - ya, xa, ya)
        dx, dy = xs - px, ys - py
        ang = np.arctan2(dy, dx)
        # irregular edge: per-tuft angular wobble
        ph = rng.random() * 6.28
        k = 3 + int(rng.random() * 3)
        rr = r * (0.82 + 0.18 * np.sin(ang * k + ph))
        dist = np.sqrt(dx * dx + dy * dy)
        m = dist <= rr
        if not m.any():
            continue
        nx, ny = dx / (rr + 1e-6), dy / (rr + 1e-6)
        local = nx * light[0] + ny * light[1]
        v = 0.5 + 0.28 * local + 0.32 * g + bias
        if shade_fn is not None:
            v = v + shade_fn(xs, ys)
        v = 0.5 + (v - 0.5) * contrast
        if rim:
            edge = (dist > rr - 1.0) & (local < -0.35)
            v = np.where(edge, v - 0.18, v)
        cv.put_ramp(m, v, ramp_cols, dither=dither, alpha=alpha, ox=xa, oy=ya)
    if fill_core:
        # gaps between the ragged tufts get shaded inner leaves (depth), never
        # transparency; the silhouette stays the one drawn by the tufts
        from scipy import ndimage as _nd
        new = (cv.px[..., 3] > 0) & (alpha_before == 0)
        closed = _nd.binary_closing(new, iterations=2)
        gaps = _nd.binary_fill_holes(new | closed) & ~new & (alpha_before == 0)
        gaps &= _nd.binary_erosion(_nd.binary_fill_holes(new | closed), iterations=1)
        if gaps.any():
            gy, gx = np.mgrid[0:h, 0:w].astype(np.float32)
            g = (gx - cx) / rx * light[0] + (gy - cy) / ry * light[1]
            vv = 0.5 + (0.26 + 0.25 * g + bias - 0.5) * contrast
            if shade_fn is not None:
                vv = vv + shade_fn(gx, gy)
            cv.put_ramp(gaps, vv, ramp_cols, dither=dither, alpha=alpha)
    return lob


def trunk(cv, x, y_top, y_bot, w_top, w_bot, ramp_cols, rng, lean=0.0,
          bias=0.0, moss=None, moss_amt=0.0, roots=0, dither=0.4, shade_fn=None,
          texture=1.0):
    """Paint a tree trunk (cylinder shading, lit from the right) with bark."""
    H = int(y_bot - y_top)
    if H <= 0:
        return
    wmax = int(max(w_top, w_bot) + roots * 2 + abs(lean) * H + 8)
    x0 = int(x - wmax)
    xs, ys = grid(wmax * 2, H, x0, int(y_top))
    t = (ys - y_top) / H
    cxl = x + lean * (ys - y_bot) + np.sin(t * 3.1 + x * 0.1) * 1.2
    half = (w_top + (w_bot - w_top) * t) / 2.0
    if roots:
        flare = np.clip((t - 0.82) / 0.18, 0, 1) ** 2
        half = half + flare * roots
    u = (xs - cxl) / (half + 1e-6)  # -1 .. 1 across trunk
    m = np.abs(u) <= 1.0
    nz = np.sqrt(np.clip(1 - u * u, 0, 1))
    shade = u * 0.55 + nz * 0.35  # right side lit
    # bark: vertical streaks
    bark = value_noise(wmax * 2, H, 3, rng, octaves=2, sy=6.0)
    streak = (bark - 0.5) * 0.5 * texture
    v = 0.32 + shade * 0.55 + streak + bias
    if shade_fn is not None:
        v = v + shade_fn(xs, ys)
    # rim darkening on left edge
    v = np.where(u < -0.8, v - 0.12, v)
    cv.put_ramp(m, v, ramp_cols, dither=dither, ox=x0, oy=int(y_top))
    if moss is not None and moss_amt > 0:
        mn = value_noise(wmax * 2, H, 3, rng, octaves=3, sy=4.0)
        # moss grows on the shaded (left) side and thickens toward the base
        grow = moss_amt * (0.55 + 0.6 * t) - np.clip(u, -1, 1) * 0.25
        mm = m & (mn > 1 - grow) & (u < 0.45)
        cv.put_ramp(mm, 0.2 + (u + 1) * 0.22 + (mn - 0.5) * 0.6 + bias, moss, dither=0.5,
                    ox=x0, oy=int(y_top))


def rock(cv, cx, cy, rx, ry, rng, ramp_cols=None, moss=None, moss_amt=0.0,
         bias=0.0, wet=0.0, shade_fn=None, flat=0.35, cracks=True, dither=0.45,
         light3=(0.55, -0.62, 0.56)):
    """Paint an irregular, faceted boulder lit from the top-right.

    Returns the boolean mask (full canvas) of the rock.
    """
    w, h = cv.w, cv.h
    R = int(max(rx, ry) * 1.35) + 2
    xa, ya = max(int(cx - R), 0), max(int(cy - R), 0)
    xb, yb = min(int(cx + R) + 1, w), min(int(cy + R) + 1, h)
    if xb <= xa or yb <= ya:
        return np.zeros((h, w), bool)
    xs, ys = grid(xb - xa, yb - ya, xa, ya)
    dx, dy = (xs - cx) / rx, (ys - cy) / ry
    ang = np.arctan2(dy, dx)
    ph = rng.random(4) * 6.28
    wob = (1 + 0.10 * np.sin(ang * 2 + ph[0]) + 0.07 * np.sin(ang * 3 + ph[1])
           + 0.04 * np.sin(ang * 5 + ph[2]))
    # flatten bottom (rocks sit on the ground)
    dyf = np.where(dy > 0, dy * (1 + flat), dy)
    d = np.sqrt(dx * dx + dyf * dyf) / wob
    m = d <= 1.0
    if not m.any():
        return np.zeros((h, w), bool)
    # height field: dome + facets + noise
    hgt = np.sqrt(np.clip(1 - d * d, 0, 1))
    nz = value_noise(xb - xa, yb - ya, max(2, int(min(rx, ry) / 2)), rng, octaves=3)
    facets = np.zeros_like(hgt)
    for _ in range(3):
        a = rng.random() * 6.28
        facets = np.maximum(facets, (np.cos(a) * dx + np.sin(a) * dy) * 0.35)
    hgt = hgt + nz * 0.35 + facets * 0.4
    gy, gx = np.gradient(hgt)
    nxv, nyv = -gx * rx * 0.9, -gy * ry * 0.9
    nzv = np.ones_like(nxv)
    ln = np.sqrt(nxv ** 2 + nyv ** 2 + nzv ** 2)
    nxv, nyv, nzv = nxv / ln, nyv / ln, nzv / ln
    L = np.array(light3)
    L = L / np.linalg.norm(L)
    lam = nxv * L[0] + nyv * L[1] + nzv * L[2]
    v = 0.12 + lam * 0.75 + bias - np.clip(dy, 0, 1) * 0.18
    if shade_fn is not None:
        v = v + shade_fn(xs, ys)
    # outline: lowest tone on bottom-left rim
    rimm = (d > 0.9) & ((dx * L[0] + dy * L[1]) < 0)
    v = np.where(rimm, v - 0.25, v)
    if wet > 0:
        v = np.where(dy > 1 - wet, v - 0.22, v)
    if ramp_cols is None:
        from palette import ROCK
        ramp_cols = ROCK
    cv.put_ramp(m, v, ramp_cols, dither=dither, ox=xa, oy=ya)
    if cracks:
        cn = value_noise(xb - xa, yb - ya, max(3, int(rx / 2)), rng, octaves=2)
        cm = m & (np.abs(cn - 0.5) < 0.025) & (d < 0.92)
        cv.put_ramp(cm, v - 0.3, ramp_cols, dither=0, ox=xa, oy=ya)
    if moss is not None and moss_amt > 0:
        mn = value_noise(xb - xa, yb - ya, 2, rng, octaves=3)
        up = -nyv  # facing up
        mm = m & (up + (mn - 0.5) * 0.9 > 1.0 - moss_amt * 1.3) & (dy < 0.55)
        mv = 0.35 + lam * 0.5 + (mn - 0.5) * 0.6
        if shade_fn is not None:
            mv = mv + shade_fn(xs, ys) * 0.8
        cv.put_ramp(mm, mv, moss, dither=0.5, ox=xa, oy=ya)
    full = np.zeros((h, w), bool)
    full[ya:yb, xa:xb] = m
    return full


def grass_blades(cv, mask, ramp_cols, rng, density=0.15, hmin=2, hmax=5,
                 light_fn=None, lean_bias=0.0):
    """Scatter small vertical grass blades (1px wide) inside mask."""
    ys, xs = np.nonzero(mask)
    n = int(len(xs) * density)
    if n == 0:
        return
    sel = rng.choice(len(xs), n, replace=False)
    order = np.argsort(ys[sel])
    for i in sel[order]:
        x, y = int(xs[i]), int(ys[i])
        hgt = int(hmin + rng.random() * (hmax - hmin + 1))
        lean = rng.choice([-1, 0, 0, 1]) if rng.random() < 0.5 else 0
        base = 0.35 + rng.random() * 0.25
        if light_fn is not None:
            base += light_fn(x, y)
        for k in range(hgt):
            t = k / max(hgt - 1, 1)
            xx = x + (lean if t > 0.5 else 0)
            v = base + t * 0.35
            idx = int(np.clip(round(v * (len(ramp_cols) - 1)), 0, len(ramp_cols) - 1))
            cv.pixel(xx, y - k, ramp_cols[idx])


def outline_alpha(cv, color, only_bottom_left=False):
    """Add a 1px outline in `color` around opaque pixels (sprites)."""
    a = cv.px[..., 3] > 0
    nb = np.zeros_like(a)
    nb[1:, :] |= a[:-1, :]
    nb[:-1, :] |= a[1:, :]
    nb[:, 1:] |= a[:, :-1]
    nb[:, :-1] |= a[:, 1:]
    o = nb & ~a
    cv.px[o, :3] = color[:3]
    cv.px[o, 3] = 255


def from_ascii(rows, colors):
    """Build an RGBA array from ascii art rows using a char->color map."""
    h = len(rows)
    w = max(len(r) for r in rows)
    arr = np.zeros((h, w, 4), np.uint8)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in colors and colors[ch] is not None:
                c = colors[ch]
                arr[y, x, :3] = c[:3]
                arr[y, x, 3] = c[3] if len(c) > 3 else 255
    return arr


def save_sheet(frames, path, cols=None):
    """Pack equally sized RGBA frames horizontally (or in a grid)."""
    fh, fw = frames[0].shape[:2]
    n = len(frames)
    cols = cols or n
    rows = (n + cols - 1) // cols
    sheet = np.zeros((rows * fh, cols * fw, 4), np.uint8)
    for i, f in enumerate(frames):
        r, c = divmod(i, cols)
        sheet[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw] = f
    Image.fromarray(sheet, "RGBA").save(path)
    return fw, fh


def fill_enclosed_holes(cv):
    """Safety net: transparent pixels fully enclosed by opaque ones get the
    darkest neighbouring colour (inner shadow). Applied to vegetation sprites."""
    from scipy import ndimage as _nd
    a = cv.px[..., 3] > 0
    holes = _nd.binary_fill_holes(a) & ~a
    if not holes.any():
        return 0
    ys, xs = np.nonzero(holes)
    for y, x in zip(ys, xs):
        best = None
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < cv.h and 0 <= xx < cv.w and cv.px[yy, xx, 3] > 0:
                c = cv.px[yy, xx]
                if best is None or int(c[:3].sum()) < int(best[:3].sum()):
                    best = c.copy()
        if best is not None:
            cv.px[y, x] = best
    return int(holes.sum())


def branch_tree(cv, x, y, angle, length, thick, depth, ramp_cols, rng, bias=0.0, bend=0.18,
                children=(2, 3), spread=(0.35, 0.75), shrink=(0.62, 0.8), bounds=None, segs=None):
    """Recursive natural branching (bare winter trees).

    Each limb is drawn as a slightly curving, tapering stroke shaded from the
    right (global light); it forks into 2-3 thinner limbs until 1px twigs.
    bounds(x, y) -> bool keeps growth inside a crown silhouette.
    Returns the list of segments (x0, y0, x1, y1, thickness) for snow caps.
    """
    if segs is None:
        segs = []
    steps = max(2, int(length / 2.5))
    a = angle
    px, py = float(x), float(y)
    n = len(ramp_cols)
    for i in range(steps):
        t = i / steps
        th = max(0.5, thick * (1.0 - 0.45 * t))
        a += (rng.random() - 0.5) * bend
        nx_, ny_ = px + math.cos(a) * length / steps, py + math.sin(a) * length / steps
        if bounds is not None and not bounds(nx_, ny_):
            a += math.copysign(0.35, (rng.random() - 0.5))
            break
        r = th / 2.0
        L = int(max(abs(nx_ - px), abs(ny_ - py)) * 2) + 1
        for k in range(L):
            u = k / max(L - 1, 1)
            cx_, cy_ = px + (nx_ - px) * u, py + (ny_ - py) * u
            ix0, ix1 = int(math.floor(cx_ - r)), int(math.ceil(cx_ + r))
            iy0, iy1 = int(math.floor(cy_ - r)), int(math.ceil(cy_ + r))
            for yy in range(iy0, iy1 + 1):
                for xx in range(ix0, ix1 + 1):
                    dx, dy = xx + 0.5 - cx_, yy + 0.5 - cy_
                    if dx * dx + dy * dy <= r * r + 0.25:
                        # light from the right: right edge lighter, left darker
                        side = dx / max(r, 0.5)
                        v = 0.38 + side * 0.22 + bias + (rng.random() - 0.5) * 0.06
                        idx = int(np.clip(v, 0, 0.999) * n)
                        cv.pixel(xx, yy, ramp_cols[idx])
        segs.append((px, py, nx_, ny_, th))
        px, py = nx_, ny_
    if depth <= 0 or thick < 0.6:
        return segs
    nkids = children[0] + int(rng.random() * (children[1] - children[0] + 1))
    for c in range(nkids):
        off = (spread[0] + rng.random() * (spread[1] - spread[0])) * (1 if c % 2 == 0 else -1)
        if nkids == 3 and c == 2:
            off *= 0.25
        branch_tree(cv, px, py, a + off, length * (shrink[0] + rng.random() * (shrink[1] - shrink[0])),
                    thick * 0.66, depth - 1, ramp_cols, rng, bias, bend, children, spread, shrink, bounds, segs)
    return segs
