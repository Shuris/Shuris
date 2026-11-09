package com.shuris.depthwall;

/**
 * Filtro guiado colorido (He, Sun e Tang, 2010).
 *
 * Usa a foto em alta resolução como "guia" para refinar o mapa de profundidade: as bordas do
 * mapa passam a seguir as bordas reais da foto (ex.: o contorno de uma corda), em vez do
 * contorno borrado e grosseiro que sai da IA.
 *
 * Java puro, sem dependências do Android, para poder ser testado fora do aparelho.
 */
public final class GuidedFilter {

    private GuidedFilter() {
    }

    /**
     * @param guide pixels ARGB da foto (w*h)
     * @param p     mapa a refinar (w*h), valores em [0, 1]
     * @param r     raio da janela em pixels
     * @param eps   regularização: menor = segue mais as bordas da foto
     * @return mapa refinado (w*h)
     */
    public static float[] filter(int[] guide, float[] p, int w, int h, int r, float eps) {
        final int n = w * h;
        float[] ir = new float[n];
        float[] ig = new float[n];
        float[] ib = new float[n];
        for (int i = 0; i < n; i++) {
            int c = guide[i];
            ir[i] = ((c >> 16) & 0xFF) / 255f;
            ig[i] = ((c >> 8) & 0xFF) / 255f;
            ib[i] = (c & 0xFF) / 255f;
        }

        Box box = new Box(w, h, r);
        float[] mR = box.mean(ir);
        float[] mG = box.mean(ig);
        float[] mB = box.mean(ib);
        float[] mP = box.mean(p);

        float[] mRP = box.meanProduct(ir, p);
        float[] mGP = box.meanProduct(ig, p);
        float[] mBP = box.meanProduct(ib, p);

        float[] vRR = box.meanProduct(ir, ir);
        float[] vRG = box.meanProduct(ir, ig);
        float[] vRB = box.meanProduct(ir, ib);
        float[] vGG = box.meanProduct(ig, ig);
        float[] vGB = box.meanProduct(ig, ib);
        float[] vBB = box.meanProduct(ib, ib);

        // Coeficientes lineares por janela: q = a·I + b. Reaproveita os arrays para poupar memória.
        for (int i = 0; i < n; i++) {
            float mr = mR[i], mg = mG[i], mb = mB[i], mp = mP[i];
            float covR = mRP[i] - mr * mp;
            float covG = mGP[i] - mg * mp;
            float covB = mBP[i] - mb * mp;

            float rr = vRR[i] - mr * mr + eps;
            float rg = vRG[i] - mr * mg;
            float rb = vRB[i] - mr * mb;
            float gg = vGG[i] - mg * mg + eps;
            float gb = vGB[i] - mg * mb;
            float bb = vBB[i] - mb * mb + eps;

            // Inversa da matriz de covariância 3x3 (simétrica) pela adjunta.
            float i00 = gg * bb - gb * gb;
            float i01 = rb * gb - rg * bb;
            float i02 = rg * gb - rb * gg;
            float i11 = rr * bb - rb * rb;
            float i12 = rg * rb - rr * gb;
            float i22 = rr * gg - rg * rg;
            float det = rr * i00 + rg * i01 + rb * i02;
            float inv = det != 0f ? 1f / det : 0f;

            float aR = (i00 * covR + i01 * covG + i02 * covB) * inv;
            float aG = (i01 * covR + i11 * covG + i12 * covB) * inv;
            float aB = (i02 * covR + i12 * covG + i22 * covB) * inv;

            mRP[i] = aR;
            mGP[i] = aG;
            mBP[i] = aB;
            mP[i] = mp - aR * mr - aG * mg - aB * mb;
        }
        vRR = vRG = vRB = vGG = vGB = vBB = null;
        mR = mG = mB = null;

        float[] maR = box.mean(mRP);
        float[] maG = box.mean(mGP);
        float[] maB = box.mean(mBP);
        float[] mb = box.mean(mP);

        float[] q = new float[n];
        for (int i = 0; i < n; i++) {
            float v = maR[i] * ir[i] + maG[i] * ig[i] + maB[i] * ib[i] + mb[i];
            q[i] = v < 0f ? 0f : (v > 1f ? 1f : v);
        }
        return q;
    }

    /**
     * "Recorte" das bordas: onde o mapa tem um degrau (frente x fundo) dentro da janela, cada
     * pixel é atribuído à frente ou ao fundo conforme sua cor se parece mais com a cor média de
     * um lado ou do outro. Remove o halo de fundo que acompanharia o objeto ao mover.
     *
     * @param r         raio da janela (deve cobrir a largura do borrão da IA)
     * @param minStep   diferença mínima de profundidade para considerar que há uma borda
     */
    public static float[] snapEdges(int[] guide, float[] p, int w, int h, int r, float minStep) {
        float[] out = p.clone();
        // Pré-calcula as cores em float.
        final int n = w * h;
        float[] cr = new float[n], cg = new float[n], cb = new float[n];
        for (int i = 0; i < n; i++) {
            int c = guide[i];
            cr[i] = ((c >> 16) & 0xFF) / 255f;
            cg[i] = ((c >> 8) & 0xFF) / 255f;
            cb[i] = (c & 0xFF) / 255f;
        }
        // Mínimo e máximo locais (separáveis) para achar rapidamente as regiões de borda.
        // Cores levemente suavizadas (3x3) para decidir frente/fundo sem ruído da textura.
        Box small = new Box(w, h, 1);
        float[] sr = small.mean(cr), sg = small.mean(cg), sb = small.mean(cb);
        float[] mn = minMax(p, w, h, r, false);
        float[] mx = minMax(p, w, h, r, true);
        int step = r > 6 ? 2 : 1; // amostragem da janela: mais rápido sem perder qualidade
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int i = y * w + x;
                float lo = mn[i], hi = mx[i];
                if (hi - lo < minStep) continue;
                float mid = (lo + hi) * 0.5f;
                // Profundidade de cada lado vem só do "miolo" (longe da rampa borrada da IA).
                float hiCore = hi - (hi - lo) * 0.25f, loCore = lo + (hi - lo) * 0.25f;
                float fR = 0, fG = 0, fB = 0, fD = 0, bR = 0, bG = 0, bB = 0, bD = 0;
                int fN = 0, bN = 0, fDN = 0, bDN = 0;
                int y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
                int x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
                for (int yy = y0; yy <= y1; yy += step) {
                    int row = yy * w;
                    for (int xx = x0; xx <= x1; xx += step) {
                        int j = row + xx;
                        float d = p[j];
                        if (d > mid) {
                            fR += cr[j]; fG += cg[j]; fB += cb[j]; fN++;
                            if (d >= hiCore) { fD += d; fDN++; }
                        } else {
                            bR += cr[j]; bG += cg[j]; bB += cb[j]; bN++;
                            if (d <= loCore) { bD += d; bDN++; }
                        }
                    }
                }
                if (fN == 0 || bN == 0 || fDN == 0 || bDN == 0) continue;
                fR /= fN; fG /= fN; fB /= fN; fD /= fDN;
                bR /= bN; bG /= bN; bB /= bN; bD /= bDN;
                float dR = fR - bR, dG = fG - bG, dB = fB - bB;
                float len2 = dR * dR + dG * dG + dB * dB;
                if (len2 < 0.004f) continue; // cores parecidas demais: não dá para separar
                float alpha = ((sr[i] - bR) * dR + (sg[i] - bG) * dG + (sb[i] - bB) * dB) / len2;
                // Transição suave (evita "dentes" duros quando a decisão é incerta).
                float t = Math.max(0f, Math.min(1f, (alpha - 0.15f) / 0.7f));
                t = t * t * (3f - 2f * t);
                float snapped = bD + (fD - bD) * t;
                // Confiança: quanto mais diferentes as cores dos dois lados, mais vale o recorte;
                // com cores parecidas, fica perto do valor original da IA.
                float conf = Math.max(0f, Math.min(1f, (len2 - 0.004f) / 0.026f));
                out[i] = p[i] + (snapped - p[i]) * conf;
            }
        }
        return out;
    }

    private static float[] minMax(float[] src, int w, int h, int r, boolean max) {
        float[] tmp = new float[src.length];
        float[] out = new float[src.length];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                float v = max ? 0f : 1f;
                for (int k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) {
                    float s = src[y * w + k];
                    v = max ? Math.max(v, s) : Math.min(v, s);
                }
                tmp[y * w + x] = v;
            }
        }
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                float v = max ? 0f : 1f;
                for (int k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) {
                    float s = tmp[k * w + x];
                    v = max ? Math.max(v, s) : Math.min(v, s);
                }
                out[y * w + x] = v;
            }
        }
        return out;
    }

    /** Mediana 3x3: remove pontinhos isolados sem borrar as bordas. */
    public static float[] median3(float[] src, int w, int h) {
        float[] out = new float[src.length];
        float[] win = new float[9];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int k = 0;
                for (int dy = -1; dy <= 1; dy++) {
                    int yy = Math.max(0, Math.min(h - 1, y + dy));
                    for (int dx = -1; dx <= 1; dx++) {
                        int xx = Math.max(0, Math.min(w - 1, x + dx));
                        win[k++] = src[yy * w + xx];
                    }
                }
                // Ordenação por inserção (9 elementos).
                for (int i = 1; i < 9; i++) {
                    float v = win[i];
                    int j = i - 1;
                    while (j >= 0 && win[j] > v) {
                        win[j + 1] = win[j];
                        j--;
                    }
                    win[j + 1] = v;
                }
                out[y * w + x] = win[4];
            }
        }
        return out;
    }

    /** Redimensiona um mapa com interpolação bilinear. */
    public static float[] resize(float[] src, int sw, int sh, int dw, int dh) {
        float[] out = new float[dw * dh];
        float fx = (float) sw / dw;
        float fy = (float) sh / dh;
        for (int y = 0; y < dh; y++) {
            float sy = Math.max(0f, Math.min(sh - 1f, (y + 0.5f) * fy - 0.5f));
            int y0 = (int) sy;
            int y1 = Math.min(y0 + 1, sh - 1);
            float ty = sy - y0;
            for (int x = 0; x < dw; x++) {
                float sx = Math.max(0f, Math.min(sw - 1f, (x + 0.5f) * fx - 0.5f));
                int x0 = (int) sx;
                int x1 = Math.min(x0 + 1, sw - 1);
                float tx = sx - x0;
                float a = src[y0 * sw + x0] + (src[y0 * sw + x1] - src[y0 * sw + x0]) * tx;
                float b = src[y1 * sw + x0] + (src[y1 * sw + x1] - src[y1 * sw + x0]) * tx;
                out[y * dw + x] = a + (b - a) * ty;
            }
        }
        return out;
    }

    /** Média em janela quadrada (box filter) em O(n), com bordas tratadas pela contagem real. */
    private static final class Box {
        private final int w, h, r;
        private final float[] tmp;
        private final double[] prefix;

        Box(int w, int h, int r) {
            this.w = w;
            this.h = h;
            this.r = r;
            this.tmp = new float[w * h];
            this.prefix = new double[Math.max(w, h) + 1];
        }

        float[] meanProduct(float[] a, float[] b) {
            float[] ab = new float[a.length];
            for (int i = 0; i < a.length; i++) ab[i] = a[i] * b[i];
            return meanInPlace(ab);
        }

        float[] mean(float[] src) {
            return meanInPlace(src.clone());
        }

        private float[] meanInPlace(float[] data) {
            // Horizontal: data -> tmp
            for (int y = 0; y < h; y++) {
                int row = y * w;
                prefix[0] = 0;
                for (int x = 0; x < w; x++) prefix[x + 1] = prefix[x] + data[row + x];
                for (int x = 0; x < w; x++) {
                    int x0 = Math.max(0, x - r);
                    int x1 = Math.min(w - 1, x + r);
                    tmp[row + x] = (float) ((prefix[x1 + 1] - prefix[x0]) / (x1 - x0 + 1));
                }
            }
            // Vertical: tmp -> data
            for (int x = 0; x < w; x++) {
                prefix[0] = 0;
                for (int y = 0; y < h; y++) prefix[y + 1] = prefix[y] + tmp[y * w + x];
                for (int y = 0; y < h; y++) {
                    int y0 = Math.max(0, y - r);
                    int y1 = Math.min(h - 1, y + r);
                    data[y * w + x] = (float) ((prefix[y1 + 1] - prefix[y0]) / (y1 - y0 + 1));
                }
            }
            return data;
        }
    }
}
