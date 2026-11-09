package com.shuris.depthwall;

/**
 * Camada de fundo para preencher o que aparece "atrás" dos objetos quando eles se movem.
 *
 * Perto de cada borda de um objeto próximo, estima a profundidade do fundo (erosão do mapa) e
 * reconstrói as cores do fundo escondido preenchendo a região a partir dos arredores
 * (inpainting por pirâmide "push-pull"). No shader, quando um objeto se desloca e revela uma
 * faixa que a foto não tem, essa faixa é desenhada com esta camada em vez de esticar pixels.
 *
 * Java puro, sem dependências do Android, para poder ser testado fora do aparelho.
 */
public final class BackgroundLayer {

    public static final class Result {
        public final int[] color;   // ARGB, w*h
        public final float[] depth; // [0, 1], w*h
        public final boolean[] hole; // pixels reconstruídos (útil para depuração)

        Result(int[] color, float[] depth, boolean[] hole) {
            this.color = color;
            this.depth = depth;
            this.hole = hole;
        }
    }

    private BackgroundLayer() {
    }

    /**
     * @param radius   até que distância de uma borda o fundo é reconstruído (em pixels); deve ser
     *                 maior que o maior deslocamento do parallax
     * @param minStep  quanto um pixel precisa estar à frente do fundo local para ser escondido
     */
    public static Result build(int[] rgb, float[] depth, int w, int h, int radius, float minStep) {
        final int n = w * h;
        // Profundidade do fundo: o mais longe que existe por perto, suavizado.
        float[] bgDepth = minFilter(depth, w, h, radius);
        bgDepth = boxBlur(bgDepth, w, h, Math.max(1, radius / 2));
        for (int i = 0; i < n; i++) if (bgDepth[i] > depth[i]) bgDepth[i] = depth[i];

        boolean[] hole = new boolean[n];
        for (int i = 0; i < n; i++) hole[i] = depth[i] - bgDepth[i] > minStep;

        int[] color = pushPull(rgb, hole, w, h);
        return new Result(color, bgDepth, hole);
    }

    /** Preenche os pixels marcados em "hole" com cores suaves vindas dos pixels válidos ao redor. */
    static int[] pushPull(int[] rgb, boolean[] hole, int w, int h) {
        // Níveis da pirâmide: cor normalizada (r, g, b) e peso em [0, 1].
        int levels = 1;
        for (int s = Math.max(w, h); s > 1; s = (s + 1) / 2) levels++;
        float[][] lr = new float[levels][], lg = new float[levels][], lb = new float[levels][], lw = new float[levels][];
        int[] lwid = new int[levels], lhei = new int[levels];

        int n = w * h;
        lr[0] = new float[n];
        lg[0] = new float[n];
        lb[0] = new float[n];
        lw[0] = new float[n];
        lwid[0] = w;
        lhei[0] = h;
        for (int i = 0; i < n; i++) {
            int c = rgb[i];
            lr[0][i] = (c >> 16) & 0xFF;
            lg[0][i] = (c >> 8) & 0xFF;
            lb[0][i] = c & 0xFF;
            lw[0][i] = hole[i] ? 0f : 1f;
        }

        // Push: reduz pela metade somando blocos 2x2 ponderados.
        for (int l = 1; l < levels; l++) {
            int pw = lwid[l - 1], ph = lhei[l - 1];
            int cw = (pw + 1) / 2, ch = (ph + 1) / 2;
            lwid[l] = cw;
            lhei[l] = ch;
            float[] r = new float[cw * ch], g = new float[cw * ch], b = new float[cw * ch], wt = new float[cw * ch];
            for (int y = 0; y < ch; y++) {
                for (int x = 0; x < cw; x++) {
                    float sr = 0, sg = 0, sb = 0, sw = 0;
                    for (int dy = 0; dy < 2; dy++) {
                        int yy = Math.min(ph - 1, 2 * y + dy);
                        for (int dx = 0; dx < 2; dx++) {
                            int xx = Math.min(pw - 1, 2 * x + dx);
                            int j = yy * pw + xx;
                            float ww = lw[l - 1][j];
                            sr += lr[l - 1][j] * ww;
                            sg += lg[l - 1][j] * ww;
                            sb += lb[l - 1][j] * ww;
                            sw += ww;
                        }
                    }
                    int i = y * cw + x;
                    if (sw > 0) {
                        r[i] = sr / sw;
                        g[i] = sg / sw;
                        b[i] = sb / sw;
                    }
                    wt[i] = Math.min(1f, sw);
                }
            }
            lr[l] = r;
            lg[l] = g;
            lb[l] = b;
            lw[l] = wt;
        }

        // Pull: do mais grosso para o mais fino, completa o que falta com o nível de cima.
        for (int l = levels - 2; l >= 0; l--) {
            int fw = lwid[l], fh = lhei[l], cw = lwid[l + 1], chh = lhei[l + 1];
            for (int y = 0; y < fh; y++) {
                float cy = Math.max(0f, Math.min(chh - 1f, (y + 0.5f) / 2f - 0.5f));
                int y0 = (int) cy, y1 = Math.min(y0 + 1, chh - 1);
                float ty = cy - y0;
                for (int x = 0; x < fw; x++) {
                    int i = y * fw + x;
                    float wt = lw[l][i];
                    if (wt >= 1f) continue;
                    float cx = Math.max(0f, Math.min(cw - 1f, (x + 0.5f) / 2f - 0.5f));
                    int x0 = (int) cx, x1 = Math.min(x0 + 1, cw - 1);
                    float tx = cx - x0;
                    float ur = bilerp(lr[l + 1], cw, x0, x1, y0, y1, tx, ty);
                    float ug = bilerp(lg[l + 1], cw, x0, x1, y0, y1, tx, ty);
                    float ub = bilerp(lb[l + 1], cw, x0, x1, y0, y1, tx, ty);
                    lr[l][i] = lr[l][i] * wt + ur * (1f - wt);
                    lg[l][i] = lg[l][i] * wt + ug * (1f - wt);
                    lb[l][i] = lb[l][i] * wt + ub * (1f - wt);
                    lw[l][i] = 1f;
                }
            }
        }

        int[] out = new int[n];
        for (int i = 0; i < n; i++) {
            if (!hole[i]) {
                out[i] = rgb[i] | 0xFF000000;
                continue;
            }
            int r = clamp255(lr[0][i]), g = clamp255(lg[0][i]), b = clamp255(lb[0][i]);
            out[i] = 0xFF000000 | (r << 16) | (g << 8) | b;
        }
        return out;
    }

    private static float bilerp(float[] a, int w, int x0, int x1, int y0, int y1, float tx, float ty) {
        float top = a[y0 * w + x0] + (a[y0 * w + x1] - a[y0 * w + x0]) * tx;
        float bot = a[y1 * w + x0] + (a[y1 * w + x1] - a[y1 * w + x0]) * tx;
        return top + (bot - top) * ty;
    }

    private static int clamp255(float v) {
        return v < 0 ? 0 : (v > 255 ? 255 : (int) v);
    }

    /** Mínimo em janela quadrada, separável, com fila monotônica: O(n) independente do raio. */
    static float[] minFilter(float[] src, int w, int h, int r) {
        float[] tmp = new float[src.length];
        float[] out = new float[src.length];
        int[] q = new int[Math.max(w, h)];
        for (int y = 0; y < h; y++) slidingMin(src, tmp, y * w, 1, w, r, q);
        for (int x = 0; x < w; x++) slidingMin(tmp, out, x, w, h, r, q);
        return out;
    }

    private static void slidingMin(float[] src, float[] dst, int start, int stride, int len, int r, int[] q) {
        int head = 0, tail = 0;
        int next = 0; // próximo índice a entrar na janela
        for (int i = 0; i < len; i++) {
            int hi = Math.min(len - 1, i + r);
            while (next <= hi) {
                float v = src[start + next * stride];
                while (tail > head && src[start + q[tail - 1] * stride] >= v) tail--;
                q[tail++] = next++;
            }
            while (q[head] < i - r) head++;
            dst[start + i * stride] = src[start + q[head] * stride];
        }
    }

    static float[] boxBlur(float[] src, int w, int h, int r) {
        float[] tmp = new float[src.length];
        float[] out = new float[src.length];
        double[] pre = new double[Math.max(w, h) + 1];
        for (int y = 0; y < h; y++) {
            pre[0] = 0;
            for (int x = 0; x < w; x++) pre[x + 1] = pre[x] + src[y * w + x];
            for (int x = 0; x < w; x++) {
                int a = Math.max(0, x - r), b = Math.min(w - 1, x + r);
                tmp[y * w + x] = (float) ((pre[b + 1] - pre[a]) / (b - a + 1));
            }
        }
        for (int x = 0; x < w; x++) {
            pre[0] = 0;
            for (int y = 0; y < h; y++) pre[y + 1] = pre[y] + tmp[y * w + x];
            for (int y = 0; y < h; y++) {
                int a = Math.max(0, y - r), b = Math.min(h - 1, y + r);
                out[y * w + x] = (float) ((pre[b + 1] - pre[a]) / (b - a + 1));
            }
        }
        return out;
    }
}
