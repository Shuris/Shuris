package app.broto.core.stats

import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.sqrt

/** Estatística básica, implementada localmente (sem bibliotecas externas). */
object Stat {
    fun mean(x: List<Double>): Double = if (x.isEmpty()) Double.NaN else x.sum() / x.size

    fun variance(x: List<Double>): Double {
        if (x.size < 2) return 0.0
        val m = mean(x)
        return x.sumOf { (it - m) * (it - m) } / (x.size - 1)
    }

    fun sd(x: List<Double>): Double = sqrt(variance(x))

    data class TTest(val diff: Double, val t: Double, val df: Double, val p: Double, val cohenD: Double)

    /** Teste t de Welch (bicaudal) para diferença de médias a - b. */
    fun welch(a: List<Double>, b: List<Double>): TTest? {
        if (a.size < 2 || b.size < 2) return null
        val ma = mean(a); val mb = mean(b)
        val va = variance(a); val vb = variance(b)
        val se2 = va / a.size + vb / b.size
        val diff = ma - mb
        val pooled = sqrt(((a.size - 1) * va + (b.size - 1) * vb) / (a.size + b.size - 2))
        val d = if (pooled > 0) diff / pooled else 0.0
        if (se2 <= 1e-12) {
            // Sem variação: só há evidência se as médias diferirem.
            return TTest(diff, if (abs(diff) < 1e-9) 0.0 else Double.POSITIVE_INFINITY, (a.size + b.size - 2).toDouble(), if (abs(diff) < 1e-9) 1.0 else 0.0, d)
        }
        val t = diff / sqrt(se2)
        val df = se2 * se2 / ((va / a.size) * (va / a.size) / (a.size - 1) + (vb / b.size) * (vb / b.size) / (b.size - 1))
        return TTest(diff, t, df, twoSidedP(t, df), d)
    }

    data class Correlation(val r: Double, val n: Int, val p: Double)

    fun pearson(x: List<Double>, y: List<Double>): Correlation? {
        val n = minOf(x.size, y.size)
        if (n < 3) return null
        val mx = mean(x.take(n)); val my = mean(y.take(n))
        var sxy = 0.0; var sxx = 0.0; var syy = 0.0
        for (i in 0 until n) {
            val dx = x[i] - mx; val dy = y[i] - my
            sxy += dx * dy; sxx += dx * dx; syy += dy * dy
        }
        if (sxx <= 1e-12 || syy <= 1e-12) return null
        val r = (sxy / sqrt(sxx * syy)).coerceIn(-1.0, 1.0)
        val p = if (abs(r) >= 0.999999) 0.0 else twoSidedP(r * sqrt((n - 2) / (1 - r * r)), (n - 2).toDouble())
        return Correlation(r, n, p)
    }

    /** p bicaudal da distribuição t de Student. */
    fun twoSidedP(t: Double, df: Double): Double {
        if (t.isInfinite()) return 0.0
        if (df <= 0) return 1.0
        val x = df / (df + t * t)
        return regIncBeta(df / 2.0, 0.5, x).coerceIn(0.0, 1.0)
    }

    // ---- Função beta incompleta regularizada (Numerical Recipes, frações contínuas)
    fun regIncBeta(a: Double, b: Double, x: Double): Double {
        if (x <= 0.0) return 0.0
        if (x >= 1.0) return 1.0
        val bt = exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * ln(x) + b * ln(1.0 - x))
        return if (x < (a + 1.0) / (a + b + 2.0)) bt * betaCf(a, b, x) / a
        else 1.0 - bt * betaCf(b, a, 1.0 - x) / b
    }

    private fun betaCf(a: Double, b: Double, x: Double): Double {
        val fpmin = 1e-300
        val qab = a + b; val qap = a + 1.0; val qam = a - 1.0
        var c = 1.0
        var d = 1.0 - qab * x / qap
        if (abs(d) < fpmin) d = fpmin
        d = 1.0 / d
        var h = d
        for (m in 1..300) {
            val m2 = 2 * m
            var aa = m * (b - m) * x / ((qam + m2) * (a + m2))
            d = 1.0 + aa * d; if (abs(d) < fpmin) d = fpmin
            c = 1.0 + aa / c; if (abs(c) < fpmin) c = fpmin
            d = 1.0 / d; h *= d * c
            aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
            d = 1.0 + aa * d; if (abs(d) < fpmin) d = fpmin
            c = 1.0 + aa / c; if (abs(c) < fpmin) c = fpmin
            d = 1.0 / d
            val del = d * c
            h *= del
            if (abs(del - 1.0) < 3e-12) break
        }
        return h
    }

    fun lnGamma(xx: Double): Double {
        val cof = doubleArrayOf(76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5)
        var y = xx
        val x = xx
        var tmp = x + 5.5
        tmp -= (x + 0.5) * ln(tmp)
        var ser = 1.000000000190015
        for (c in cof) { y += 1.0; ser += c / y }
        return -tmp + ln(2.5066282746310005 * ser / x)
    }
}
