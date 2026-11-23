package app.broto.ui

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.*
import android.view.View
import android.view.animation.DecelerateInterpolator

/** Estilo de desenho dos gráficos (a tela e o PDF usam paletas diferentes). */
data class ChartStyle(
    val text: Int, val grid: Int, val typeface: Typeface, val textSize: Float, val density: Float, val surface: Int,
)

class LineSeries(val values: List<Double?>, val color: Int, val fill: Boolean = true, val label: String = "", val dashed: Boolean = false)

object ChartPainter {
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    private val tp = Paint(Paint.ANTI_ALIAS_FLAG)

    /**
     * Gráfico de linhas suavizado. Valores nulos interrompem a linha (dias sem registro não viram zero).
     * [progress] 0..1 anima o desenho da esquerda para a direita.
     */
    fun line(c: Canvas, area: RectF, series: List<LineSeries>, labels: List<String>, yMin: Double, yMax: Double, yTicks: List<Double>, st: ChartStyle,
             progress: Float = 1f, yLabel: (Double) -> String = { Fmt.num(it) }, showDots: Boolean = true, maxLabels: Int = 7) {
        val d = st.density
        tp.typeface = st.typeface; tp.textSize = st.textSize; tp.color = st.text
        val leftPad = if (yTicks.isEmpty()) 0f else yTicks.maxOf { tp.measureText(yLabel(it)) } + 8 * d
        val bottomPad = if (labels.isEmpty()) 0f else st.textSize + 10 * d
        val r = RectF(area.left + leftPad, area.top + 6 * d, area.right - 6 * d, area.bottom - bottomPad)
        val range = (yMax - yMin).takeIf { it > 0 } ?: 1.0
        fun y(v: Double) = (r.bottom - ((v - yMin) / range) * r.height()).toFloat()
        // grade
        p.style = Paint.Style.STROKE; p.strokeWidth = 1 * d; p.color = st.grid
        p.pathEffect = DashPathEffect(floatArrayOf(4 * d, 4 * d), 0f)
        tp.textAlign = Paint.Align.RIGHT
        for (t in yTicks) {
            val yy = y(t); c.drawLine(r.left, yy, r.right, yy, p)
            c.drawText(yLabel(t), r.left - 6 * d, yy + st.textSize * 0.35f, tp)
        }
        p.pathEffect = null
        val n = series.maxOfOrNull { it.values.size } ?: 0
        if (n == 0) return
        fun x(i: Int) = if (n == 1) r.centerX() else r.left + r.width() * i / (n - 1)
        // rótulos do eixo X
        if (labels.isNotEmpty()) {
            tp.textAlign = Paint.Align.CENTER
            val step = maxOf(1, Math.ceil(labels.size / maxLabels.toDouble()).toInt())
            for (i in labels.indices) if (i % step == 0 || i == labels.lastIndex && (labels.lastIndex % step) > step / 2) c.drawText(labels[i], x(i), area.bottom - 2 * d, tp)
        }
        c.save()
        c.clipRect(area.left, area.top - 10 * d, r.left + (r.width() + 12 * d) * progress, area.bottom)
        for (s in series) {
            // segmentos contínuos
            val segs = ArrayList<ArrayList<Pair<Float, Float>>>()
            var cur: ArrayList<Pair<Float, Float>>? = null
            s.values.forEachIndexed { i, v ->
                if (v == null) cur = null
                else { if (cur == null) { cur = ArrayList(); segs.add(cur!!) }; cur!!.add(Pair(x(i), y(v.coerceIn(yMin, yMax)))) }
            }
            for (seg in segs) {
                val path = smooth(seg)
                if (s.fill && seg.size > 1) {
                    val fillPath = Path(path); fillPath.lineTo(seg.last().first, r.bottom); fillPath.lineTo(seg.first().first, r.bottom); fillPath.close()
                    p.style = Paint.Style.FILL
                    p.shader = LinearGradient(0f, r.top, 0f, r.bottom, Theme.alpha(s.color, 0.32f), Theme.alpha(s.color, 0.02f), Shader.TileMode.CLAMP)
                    c.drawPath(fillPath, p); p.shader = null
                }
                p.style = Paint.Style.STROKE; p.strokeWidth = 2.6f * d; p.color = s.color; p.strokeCap = Paint.Cap.ROUND; p.strokeJoin = Paint.Join.ROUND
                p.pathEffect = if (s.dashed) DashPathEffect(floatArrayOf(6 * d, 5 * d), 0f) else null
                c.drawPath(path, p); p.pathEffect = null
                if (showDots && (seg.size <= 31 || seg.size == 1)) {
                    for ((px, py) in seg) {
                        p.style = Paint.Style.FILL; p.color = st.surface; c.drawCircle(px, py, 4.2f * d, p)
                        p.color = s.color; c.drawCircle(px, py, 2.8f * d, p)
                    }
                }
            }
        }
        c.restore()
    }

    private fun smooth(pts: List<Pair<Float, Float>>): Path {
        val path = Path()
        if (pts.isEmpty()) return path
        path.moveTo(pts[0].first, pts[0].second)
        if (pts.size == 1) { path.lineTo(pts[0].first + 0.1f, pts[0].second); return path }
        for (i in 1 until pts.size) {
            val (x0, y0) = pts[i - 1]; val (x1, y1) = pts[i]
            val cx = (x0 + x1) / 2
            path.cubicTo(cx, y0, cx, y1, x1, y1)
        }
        return path
    }

    /** Barras verticais arredondadas. Valores nulos aparecem como "sem dados" (traço). */
    fun bars(c: Canvas, area: RectF, values: List<Double?>, labels: List<String>, maxV: Double, color: (Int) -> Int, st: ChartStyle,
             valueLabel: ((Double) -> String)? = null, progress: Float = 1f, track: Int? = null) {
        val d = st.density
        tp.typeface = st.typeface; tp.textSize = st.textSize; tp.color = st.text; tp.textAlign = Paint.Align.CENTER
        val top = if (valueLabel != null) st.textSize + 6 * d else 0f
        val r = RectF(area.left, area.top + top, area.right, area.bottom - st.textSize - 10 * d)
        val n = values.size
        if (n == 0) return
        val slot = r.width() / n
        val bw = minOf(slot * 0.56f, 34 * d)
        for (i in 0 until n) {
            val cx = r.left + slot * (i + 0.5f)
            if (i < labels.size) c.drawText(labels[i], cx, area.bottom - 2 * d, tp)
            if (track != null) { p.style = Paint.Style.FILL; p.color = track; c.drawRoundRect(cx - bw / 2, r.top, cx + bw / 2, r.bottom, bw / 2, bw / 2, p) }
            val v = values[i]
            if (v == null) {
                p.color = st.grid; p.style = Paint.Style.FILL
                c.drawRoundRect(cx - bw / 2, r.bottom - 3 * d, cx + bw / 2, r.bottom, 2 * d, 2 * d, p)
                continue
            }
            val h = (r.height() * (v / maxV).coerceIn(0.0, 1.0) * progress).toFloat()
            p.style = Paint.Style.FILL; p.color = color(i)
            c.drawRoundRect(cx - bw / 2, r.bottom - maxOf(h, bw * 0.3f), cx + bw / 2, r.bottom, minOf(bw / 2, 10 * d), minOf(bw / 2, 10 * d), p)
            if (valueLabel != null && progress >= 1f) c.drawText(valueLabel(v), cx, r.bottom - maxOf(h, bw * 0.3f) - 5 * d, tp)
        }
    }

    /** Barra horizontal empilhada (distribuição). */
    fun stacked(c: Canvas, area: RectF, parts: List<Pair<Double, Int>>, radius: Float) {
        val total = parts.sumOf { it.first }
        if (total <= 0) { p.style = Paint.Style.FILL; p.color = 0x22000000; c.drawRoundRect(area, radius, radius, p); return }
        c.save()
        val clip = Path(); clip.addRoundRect(area, radius, radius, Path.Direction.CW); c.clipPath(clip)
        var x = area.left
        for ((v, col) in parts) {
            val w = (area.width() * v / total).toFloat()
            p.style = Paint.Style.FILL; p.color = col; c.drawRect(x, area.top, x + w, area.bottom, p)
            x += w
        }
        c.restore()
    }

    /** Anel/donut de distribuição. */
    fun donut(c: Canvas, cx: Float, cy: Float, radius: Float, stroke: Float, parts: List<Pair<Double, Int>>, track: Int) {
        p.style = Paint.Style.STROKE; p.strokeWidth = stroke; p.strokeCap = Paint.Cap.BUTT
        val r = RectF(cx - radius, cy - radius, cx + radius, cy + radius)
        p.color = track; c.drawArc(r, 0f, 360f, false, p)
        val total = parts.sumOf { it.first }
        if (total <= 0) return
        var a = -90f
        for ((v, col) in parts) {
            val sweep = (360 * v / total).toFloat()
            p.color = col; c.drawArc(r, a, maxOf(sweep - 1.5f, 0.5f), false, p)
            a += sweep
        }
    }
}

fun screenChartStyle(ctx: Context) = ChartStyle(Theme.p.textSoft, Theme.p.outline, Fonts.semibold, ctx.dpf(10.5f), ctx.resources.displayMetrics.density, Theme.p.surface)

class LineChartView(context: Context, val series: List<LineSeries>, val labels: List<String>, val yMin: Double, val yMax: Double, val yTicks: List<Double>,
                    val yLabel: (Double) -> String = { Fmt.num(it) }, val showDots: Boolean = true) : View(context) {
    private var prog = 0f
    init { ValueAnimator.ofFloat(0f, 1f).apply { duration = 900; interpolator = DecelerateInterpolator(); addUpdateListener { prog = it.animatedValue as Float; invalidate() }; start() } }
    override fun onDraw(c: Canvas) {
        ChartPainter.line(c, RectF(0f, 0f, width.toFloat(), height.toFloat()), series, labels, yMin, yMax, yTicks, screenChartStyle(context), prog, yLabel, showDots)
    }
}

class BarChartView(context: Context, val values: List<Double?>, val labels: List<String>, val maxV: Double, val color: (Int) -> Int,
                   val valueLabel: ((Double) -> String)? = null, val track: Int? = null) : View(context) {
    private var prog = 0f
    init { ValueAnimator.ofFloat(0f, 1f).apply { duration = 700; interpolator = DecelerateInterpolator(); addUpdateListener { prog = it.animatedValue as Float; invalidate() }; start() } }
    override fun onDraw(c: Canvas) {
        ChartPainter.bars(c, RectF(0f, 0f, width.toFloat(), height.toFloat()), values, labels, maxV, color, screenChartStyle(context), valueLabel, prog, track)
    }
}
