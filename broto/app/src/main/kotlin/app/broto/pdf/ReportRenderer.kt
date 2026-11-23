package app.broto.pdf

import android.content.Context
import android.graphics.*
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.text.TextUtils
import app.broto.core.insights.Confidence
import app.broto.core.insights.InsightsEngine
import app.broto.core.model.*
import app.broto.core.schedule.Schedule
import app.broto.core.score.Component
import app.broto.core.streak.DayStatus
import app.broto.core.streak.FlameLevel
import app.broto.screens.HabitText
import app.broto.ui.*
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.roundToInt

/** Destino das páginas: PdfDocument no aparelho, bitmaps nos testes. */
interface PageSink {
    fun begin(number: Int, width: Int, height: Int): Canvas
    fun end()
}

/** Paleta do relatório. */
class ReportPalette(val color: Boolean) {
    val ink = 0xFF23332A.toInt()
    val soft = 0xFF5F6B63.toInt()
    val faint = 0xFF9AA39C.toInt()
    val line = 0xFFE3E8DC.toInt()
    val accent = if (color) 0xFF188B5B.toInt() else 0xFF3C4A41.toInt()
    val accentSoft = if (color) 0xFFDDEFCB.toInt() else 0xFFEDEFEC.toInt()
    val brand = if (color) 0xFFA5D879.toInt() else 0xFF8C9890.toInt()
    val brandSoft = if (color) 0xFFC7E8A8.toInt() else 0xFFE4E7E3.toInt()
    val card = if (color) 0xFFF5F8EF.toInt() else 0xFFFFFFFF.toInt()
    val cardStroke = if (color) 0 else 0xFFD9DED9.toInt()
    val yellow = if (color) 0xFFF7C948.toInt() else 0xFF9AA39C.toInt()
    val coral = if (color) 0xFFE58E7E.toInt() else 0xFF6F7771.toInt()
    val cream = if (color) 0xFFF7F7EF.toInt() else 0xFFFFFFFF.toInt()
    fun mood(l: Int) = if (color) Theme.moodColor(l) else intArrayOf(0xFFB9BEBA.toInt(), 0xFFA2A9A4.toInt(), 0xFF8A938D.toInt(), 0xFF6E7872.toInt(), 0xFF4F5A53.toInt())[l - 1]
}

class ReportRenderer(private val ctx: Context, private val d: ReportData, private val sink: PageSink) {
    companion object { const val W = 595f; const val H = 842f; const val M = 44f; const val TOP = 70f; const val BOTTOM = H - 52f }
    private val pal = ReportPalette(d.options.style == ReportStyle.COLOR)
    private val cw = W - 2 * M
    private var c: Canvas? = null
    private var page = 0
    private var y = TOP
    private var running = ""
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val opts = d.options
    private val title = if (opts.type == ReportType.CUSTOM) "Relatório do período" else opts.type.title

    init { Fonts.load(ctx) }

    private fun tp(size: Float, color: Int = pal.ink, weight: Int = 0): TextPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = size; this.color = color; typeface = when (weight) { 0 -> Fonts.regular; 1 -> Fonts.semibold; 2 -> Fonts.bold; else -> Fonts.extrabold }
    }

    private val chartStyle get() = ChartStyle(pal.soft, pal.line, Fonts.semibold, 7.5f, 0.75f, 0xFFFFFFFF.toInt())

    // ------------------------------------------------------------------ páginas
    fun render(): Int {
        cover()
        val s = opts.sections
        if (ReportSection.SUMMARY in s) summary()
        if (ReportSection.HABITS in s) habits()
        if (ReportSection.MOOD in s) mood()
        if (ReportSection.CONSISTENCY in s) consistency()
        if (ReportSection.GOALS in s) goals()
        if (ReportSection.INSIGHTS in s) insights()
        if (ReportSection.JOURNAL in s) journal()
        closing()
        endPage()
        return page
    }

    private fun canvas(): Canvas = c ?: newPage()

    private fun newPage(): Canvas {
        endPage()
        page++
        val cv = sink.begin(page, W.toInt(), H.toInt())
        c = cv
        cv.drawColor(0xFFFFFFFF.toInt())
        if (page > 1) {
            // cabeçalho
            fill.color = pal.brand; cv.drawCircle(M + 5, 34f, 5f, fill)
            cv.drawText("Broto", M + 15, 37.5f, tp(9f, pal.accent, 3))
            val t = tp(8f, pal.faint, 1); t.textAlign = Paint.Align.RIGHT
            cv.drawText("$title · ${Fmt.range(d.from, d.to)}", W - M, 37f, t)
            stroke.color = pal.line; stroke.strokeWidth = 0.8f; cv.drawLine(M, 48f, W - M, 48f, stroke)
            if (running.isNotEmpty()) { /* título corrente já aparece no topo da seção */ }
        }
        y = TOP
        return cv
    }

    private fun endPage() {
        val cv = c ?: return
        if (page > 1) {
            val t = tp(7.5f, pal.faint, 1)
            cv.drawText("Documento pessoal · gerado em ${Fmt.fullDate(d.generatedAt)} pelo app Broto", M, H - 26f, t)
            t.textAlign = Paint.Align.RIGHT
            cv.drawText("Página $page", W - M, H - 26f, t)
        }
        sink.end()
        c = null
    }

    private fun ensure(h: Float) { if (c == null || y + h > BOTTOM) newPage() }

    // ------------------------------------------------------------------ blocos básicos
    private fun layout(text: CharSequence, paint: TextPaint, width: Float, align: Layout.Alignment = Layout.Alignment.ALIGN_NORMAL, spacing: Float = 1.25f, maxLines: Int = Int.MAX_VALUE): StaticLayout =
        StaticLayout.Builder.obtain(text, 0, text.length, paint, width.toInt()).setAlignment(align).setLineSpacing(0f, spacing).setIncludePad(false)
            .setMaxLines(maxLines).setEllipsize(if (maxLines != Int.MAX_VALUE) TextUtils.TruncateAt.END else null).build()

    /** Parágrafo que continua na página seguinte quando necessário. */
    private fun para(text: CharSequence, size: Float = 10f, color: Int = pal.ink, weight: Int = 0, x: Float = M, width: Float = cw, after: Float = 8f, spacing: Float = 1.3f) {
        if (text.isEmpty()) return
        val l = layout(text, tp(size, color, weight), width, spacing = spacing)
        var line = 0
        while (line < l.lineCount) {
            ensure(l.getLineBottom(line) - l.getLineTop(line).toFloat())
            val avail = BOTTOM - y
            val startTop = l.getLineTop(line)
            var last = line
            while (last + 1 < l.lineCount && l.getLineBottom(last + 1) - startTop <= avail) last++
            val cv = canvas()
            cv.save()
            cv.clipRect(x - 2, y, x + width + 2, y + (l.getLineBottom(last) - startTop) + 1)
            cv.translate(x, y - startTop)
            l.draw(cv)
            cv.restore()
            y += (l.getLineBottom(last) - startTop).toFloat()
            line = last + 1
            if (line < l.lineCount) newPage()
        }
        y += after
    }

    private fun textAt(cv: Canvas, s: String, x: Float, baseline: Float, paint: TextPaint, maxW: Float? = null) {
        val t = if (maxW != null) TextUtils.ellipsize(s, paint, maxW, TextUtils.TruncateAt.END).toString() else s
        cv.drawText(t, x, baseline, paint)
    }

    private fun section(t: String, sub: String? = null, emoji: String = "") {
        running = t
        ensure(110f)
        if (y > TOP + 1) y += 10
        val cv = canvas()
        fill.color = pal.accentSoft
        cv.drawRoundRect(M, y, M + 30f, y + 30f, 10f, 10f, fill)
        val e = tp(14f); e.textAlign = Paint.Align.CENTER
        cv.drawText(emoji, M + 15f, y + 20.5f, e)
        cv.drawText(t, M + 42f, y + 21f, tp(18f, pal.ink, 3))
        y += 38f
        if (sub != null) para(sub, 9f, pal.soft, after = 4f)
        stroke.color = pal.brand; stroke.strokeWidth = 2f; stroke.strokeCap = Paint.Cap.ROUND
        cv.drawLine(M, y + 2, M + 40, y + 2, stroke)
        stroke.strokeCap = Paint.Cap.BUTT
        y += 14f
    }

    private fun subTitle(t: String, need: Float = 0f) { ensure(40f + need); y += 4f; canvas().drawText(t, M, y + 11f, tp(12f, pal.ink, 2)); y += 20f }

    private fun box(x: Float, top: Float, w: Float, h: Float, color: Int = pal.card, r: Float = 12f) {
        val cv = canvas()
        fill.color = color; cv.drawRoundRect(x, top, x + w, top + h, r, r, fill)
        if (pal.cardStroke != 0) { stroke.color = pal.cardStroke; stroke.strokeWidth = 0.8f; cv.drawRoundRect(x, top, x + w, top + h, r, r, stroke) }
    }

    data class Kpi(val label: String, val value: String, val sub: String = "", val subColor: Int = 0)

    private fun kpis(items: List<Kpi>, perRow: Int = 3) {
        val gap = 10f; val h = 66f
        val w = (cw - gap * (perRow - 1)) / perRow
        for (row in items.chunked(perRow)) {
            ensure(h + 10)
            val cv = canvas()
            row.forEachIndexed { i, k ->
                val x = M + i * (w + gap)
                box(x, y, w, h)
                textAt(cv, k.label, x + 12, y + 18, tp(8f, pal.soft, 1), w - 20)
                textAt(cv, k.value, x + 12, y + 42, tp(19f, pal.ink, 3), w - 20)
                if (k.sub.isNotEmpty()) textAt(cv, k.sub, x + 12, y + 57, tp(7.5f, if (k.subColor != 0) k.subColor else pal.soft, 1), w - 20)
            }
            y += h + 10
        }
    }

    private fun chart(height: Float, draw: (Canvas, RectF) -> Unit) {
        if (!opts.charts) return
        ensure(height + 24)
        box(M, y, cw, height + 20)
        draw(canvas(), RectF(M + 12, y + 10, M + cw - 12, y + 10 + height))
        y += height + 30
    }

    private fun bar(x: Float, top: Float, w: Float, h: Float, pct: Double, color: Int) {
        val cv = canvas()
        fill.color = pal.line; cv.drawRoundRect(x, top, x + w, top + h, h / 2, h / 2, fill)
        if (pct > 0) { fill.color = color; cv.drawRoundRect(x, top, x + maxOf(h, (w * pct.coerceIn(0.0, 1.0)).toFloat()), top + h, h / 2, h / 2, fill) }
    }

    /** Tabela simples com quebra de página e cabeçalho repetido. */
    private fun table(headers: List<String>, weights: List<Float>, rows: List<List<String>>, colors: (Int, Int) -> Int? = { _, _ -> null }, aligns: List<Paint.Align> = emptyList()) {
        val total = weights.sum()
        val widths = weights.map { it / total * cw }
        val rowH = 21f
        fun header() {
            ensure(rowH * 2)
            val cv = canvas()
            fill.color = pal.accentSoft; cv.drawRoundRect(M, y, M + cw, y + rowH, 8f, 8f, fill)
            var x = M
            headers.forEachIndexed { i, h ->
                val p = tp(7.5f, pal.accent, 2); val al = aligns.getOrNull(i) ?: Paint.Align.LEFT
                p.textAlign = al
                textAt(cv, h.uppercase(), if (al == Paint.Align.RIGHT) x + widths[i] - 8 else x + 8, y + 14, p, widths[i] - 12)
                x += widths[i]
            }
            y += rowH
        }
        header()
        rows.forEachIndexed { r, row ->
            if (y + rowH > BOTTOM) { newPage(); header() }
            val cv = canvas()
            if (r % 2 == 1) { fill.color = if (pal.color) 0xFFFAFBF7.toInt() else 0xFFF7F7F7.toInt(); cv.drawRect(M, y, M + cw, y + rowH, fill) }
            var x = M
            row.forEachIndexed { i, cell ->
                val p = tp(8.5f, colors(r, i) ?: pal.ink, if (i == 0) 1 else 0); val al = aligns.getOrNull(i) ?: Paint.Align.LEFT
                p.textAlign = al
                textAt(cv, cell, if (al == Paint.Align.RIGHT) x + widths[i] - 8 else x + 8, y + 14, p, widths[i] - 12)
                x += widths[i]
            }
            stroke.color = pal.line; stroke.strokeWidth = 0.5f; cv.drawLine(M, y + rowH, M + cw, y + rowH, stroke)
            y += rowH
        }
        y += 12f
    }

    private fun note(text: String) {
        val l = layout(text, tp(8.5f, pal.soft), cw - 28)
        ensure(l.height + 20f)
        box(M, y, cw, l.height + 16f, if (pal.color) 0xFFFFF8DE.toInt() else 0xFFF4F4F4.toInt(), 10f)
        val cv = canvas(); cv.save(); cv.translate(M + 14, y + 8); l.draw(cv); cv.restore()
        y += l.height + 26f
    }

    // ------------------------------------------------------------------ capa
    private fun cover() {
        val cv = newPage()
        fill.color = pal.cream; cv.drawRect(0f, 0f, W, H, fill)
        // forma orgânica superior
        val blob = Path()
        blob.moveTo(0f, 0f); blob.lineTo(W, 0f); blob.lineTo(W, 380f)
        blob.cubicTo(W * 0.72f, 450f, W * 0.36f, 330f, 0f, 420f); blob.close()
        fill.shader = LinearGradient(0f, 0f, 0f, 440f, pal.brandSoft, if (pal.color) 0xFFE4F3D3.toInt() else 0xFFF0F1EF.toInt(), Shader.TileMode.CLAMP)
        cv.drawPath(blob, fill); fill.shader = null
        Decor.sprig(cv, 70f, 420f, 150f, Theme.alpha(pal.accent, 0.35f), -18f, true)
        Decor.sprig(cv, W - 60f, 395f, 170f, Theme.alpha(pal.brand, 0.8f), 16f)
        Decor.sprig(cv, W - 110f, 405f, 100f, Theme.alpha(pal.accent, 0.25f), -10f, true)
        if (pal.color) {
            Decor.flower(cv, W - 150f, 92f, 7f, 0xFFFFDF69.toInt(), 0xFFFFFFFF.toInt())
            Decor.flower(cv, 120f, 120f, 5f, 0xFFFFB4C6.toInt(), 0xFFFFFFFF.toInt())
            Decor.dot(cv, 180f, 70f, 3f, Theme.alpha(pal.accent, 0.4f)); Decor.dot(cv, W - 90f, 170f, 4f, 0x99FFFFFF.toInt())
        }
        val face = if ((d.current.moodAvg ?: 5.0) >= 4.3) 5 else 4
        if (pal.color) MoodArt.draw(cv, face, W / 2 - 95f, 120f, 190f)
        else {
            val gray = Paint().apply { colorFilter = ColorMatrixColorFilter(ColorMatrix().apply { setSaturation(0f) }) }
            cv.saveLayer(W / 2 - 100f, 110f, W / 2 + 100f, 320f, gray)
            MoodArt.draw(cv, face, W / 2 - 95f, 120f, 190f)
            cv.restore()
        }
        // marca
        val brand = tp(12f, pal.accent, 3); brand.letterSpacing = 0.25f
        cv.drawText("BROTO", M, 60f, brand)
        cv.drawText("hábitos · humor · evolução", M, 75f, tp(9f, pal.soft, 1))
        // título
        var ty = 500f
        cv.drawText(title, M, ty, tp(34f, pal.ink, 3)); ty += 30f
        cv.drawText(Fmt.range(d.from, d.to).replaceFirstChar { it.uppercase() }, M, ty, tp(15f, pal.accent, 2)); ty += 40f
        if (d.userName.isNotBlank()) { cv.drawText("Preparado para ${d.userName}", M, ty, tp(11f, pal.soft, 1)); ty += 18f }
        cv.drawText("Gerado em ${Fmt.fullDate(d.generatedAt)}", M, ty, tp(11f, pal.soft, 1)); ty += 40f
        // destaques da capa
        val s = d.current
        val items = listOf(
            "Score médio" to (s.avgScore?.roundToInt()?.toString() ?: "–"),
            "Hábitos concluídos" to s.positiveDone.toString(),
            "Dias registrados" to "${s.registeredDays}/${ChronoUnit.DAYS.between(d.from, d.effectiveTo).toInt() + 1}",
        )
        val w = (cw - 20) / 3
        items.forEachIndexed { i, (l, v) ->
            val x = M + i * (w + 10)
            fill.color = 0xFFFFFFFF.toInt(); cv.drawRoundRect(x, ty, x + w, ty + 70, 16f, 16f, fill)
            if (!pal.color) { stroke.color = pal.cardStroke; stroke.strokeWidth = 0.8f; cv.drawRoundRect(x, ty, x + w, ty + 70, 16f, 16f, stroke) }
            cv.drawText(v, x + 14, ty + 38, tp(22f, pal.ink, 3))
            cv.drawText(l, x + 14, ty + 56, tp(8.5f, pal.soft, 1))
        }
        val foot = tp(8f, pal.faint, 1)
        cv.drawText("Documento pessoal e privado, gerado offline no seu aparelho.", M, H - 40f, foot)
        y = BOTTOM
    }

    // ------------------------------------------------------------------ resumo
    private fun delta(cur: Double?, prev: Double?, unit: String = "", pct: Boolean = false, invert: Boolean = false): Pair<String, Int> {
        if (cur == null || prev == null) return Pair("sem período anterior para comparar", 0)
        val diff = cur - prev
        if ((pct && Math.abs(diff) < 0.005) || (!pct && Math.abs(diff) < 0.05)) return Pair("= estável vs. período anterior", pal.soft)
        val good = if (invert) diff < 0 else diff > 0
        val txt = if (pct) "${(Math.abs(diff) * 100).roundToInt()} p.p." else Fmt.num(Math.round(Math.abs(diff) * 10) / 10.0) + unit
        return Pair((if (diff > 0) "▲ " else "▼ ") + txt + " vs. período anterior", if (good) pal.accent else pal.coral)
    }

    private fun summary() {
        newPage()
        val s = d.current; val p = d.previous
        section("Resumo geral", if (d.days == 1) Fmt.longDate(d.from).replaceFirstChar { it.uppercase() } else "Visão geral de ${Fmt.range(d.from, d.to)}", "🌱")
        val sc = delta(s.avgScore, p.avgScore, " pts"); val pr = delta(s.positiveRate, p.positiveRate, pct = true); val md = delta(s.moodAvg, p.moodAvg)
        kpis(listOf(
            Kpi(if (d.days == 1) "Score do dia" else "Score médio", s.avgScore?.roundToInt()?.toString() ?: "–", sc.first, sc.second),
            Kpi("Hábitos realizados", s.positiveDone.toString(), "de ${s.positiveOpportunities} oportunidades"),
            Kpi("Taxa de conclusão", s.positiveRate?.let { Fmt.pct(it) } ?: "–", pr.first, pr.second),
            Kpi("Registros de humor", s.moods.size.toString(), "${Fmt.days(s.registeredDays)} com algum registro"),
            Kpi(if (d.days == 1) "Humor do dia" else "Humor médio", s.moodAvg?.let { Fmt.num(Math.round(it * 10) / 10.0) + "/5" } ?: "–", md.first, md.second),
            Kpi("Controle dos negativos", s.negativeControlRate?.let { Fmt.pct(it) } ?: "–", "dos registros dentro do limite"),
        ))
        para(narrative(), 10f, pal.ink, after = 12f)
        if (d.days == 1) {
            dayBreakdown()
        } else if (d.days <= 92) {
            subTitle("Evolução do score")
            val n = d.days
            val vals = (0 until n).map { s.scores[d.from.plusDays(it.toLong())]?.toDouble() }
            val labels = (0 until n).map { val x = d.from.plusDays(it.toLong()); if (n <= 7) Fmt.dowShort(x.dayOfWeek) else "${x.dayOfMonth}/${x.monthValue}" }
            chart(150f) { cv, r -> ChartPainter.line(cv, r, listOf(LineSeries(vals, pal.accent)), labels, 0.0, 100.0, listOf(0.0, 25.0, 50.0, 75.0, 100.0), chartStyle, showDots = n <= 31, maxLabels = 8) }
        } else {
            subTitle("Score médio por mês")
            val months = monthsInPeriod()
            val vals = months.map { m -> s.scores.filterKeys { it.year == m.year && it.month == m.month }.values.takeIf { it.isNotEmpty() }?.average() }
            chart(150f) { cv, r -> ChartPainter.bars(cv, r, vals, months.map { Fmt.monthShort(it.monthValue) }, 100.0, { pal.brand }, chartStyle, { it.roundToInt().toString() }) }
        }
        val best = s.bestDay; val worst = s.worstDay
        if (best != null && d.days > 1) {
            para("Melhor dia do período: ${Fmt.longDate(best.first)} (${best.second} pontos)." + (worst?.let { " Dia mais desafiador: ${Fmt.longDate(it.first)} (${it.second} pontos)." } ?: "") +
                (d.bestEver?.let { " Melhor pontuação histórica: ${it.second} em ${Fmt.fullDate(it.first)}." } ?: ""), 9f, pal.soft)
        }
    }

    private fun monthsInPeriod(): List<LocalDate> {
        val out = ArrayList<LocalDate>()
        var m = d.from.withDayOfMonth(1)
        while (!m.isAfter(d.to)) { out.add(m); m = m.plusMonths(1) }
        return out
    }

    private fun narrative(): String {
        val s = d.current; val p = d.previous
        val parts = ArrayList<String>()
        s.avgScore?.let { a ->
            var t = "Seu score ${if (d.days == 1) "foi" else "médio foi"} de ${a.roundToInt()} pontos"
            p.avgScore?.let { b -> val df = (a - b).roundToInt(); t += if (df > 0) ", $df acima do período anterior" else if (df < 0) ", ${-df} abaixo do período anterior" else ", igual ao período anterior" }
            parts.add("$t.")
        }
        s.positiveRate?.let { parts.add("Você concluiu ${Fmt.pct(it)} dos hábitos positivos programados (${s.positiveDone} de ${s.positiveOpportunities}).") }
        if (s.negativeLoggedDays > 0) parts.add("Nos hábitos que você quer reduzir, ${Fmt.pct(s.negativeControlRate ?: 0.0)} dos registros ficaram dentro do limite pessoal.")
        s.moodAvg?.let { parts.add("O humor foi registrado em ${Fmt.days(s.moods.size)}, com média ${Fmt.num(Math.round(it * 10) / 10.0)} (${Mood.of(it.roundToInt()).label.lowercase()}).") }
        if (parts.isEmpty()) parts.add("Não há registros suficientes neste período para um resumo. Continue registrando seus dias — cada registro conta.")
        parts.add("Lembre-se: estes números são um instrumento de autoconhecimento, não um julgamento.")
        return parts.joinToString(" ")
    }

    private fun dayBreakdown() {
        val ds = d.dayScores.firstOrNull() ?: return
        subTitle("Como o score foi formado")
        for (comp in ds.components) {
            ensure(30f)
            val pts = ds.points(comp.component)
            val cv = canvas()
            textAt(cv, comp.component.label, M, y + 10, tp(9.5f, pal.ink, 1), 200f)
            val right = tp(9f, pal.soft, 1); right.textAlign = Paint.Align.RIGHT
            cv.drawText(if (pts == null) "sem registros (sem penalidade)" else "${pts.first.roundToInt()} de ${pts.second.roundToInt()} pts", W - M, y + 10, right)
            if (pts != null) bar(M, y + 16, cw, 6f, pts.first / pts.second, when (comp.component) { Component.POSITIVE -> pal.accent; Component.NEGATIVE -> pal.coral; else -> pal.yellow })
            y += 30
        }
        y += 6
    }

    // ------------------------------------------------------------------ hábitos
    private fun habits() {
        val s = d.current
        if (s.habitStats.isEmpty()) return
        newPage()
        section("Hábitos", "Desempenho de cada hábito no período. Dias antes do início, pausados ou fora da programação não contam como falha.", "✅")
        if (d.days == 1) {
            val day = d.from
            val rows = s.habitStats.map { st ->
                val h = st.habit; val l = d.logs[h.id]?.get(day)
                val status = when {
                    l == null -> "Sem registro"
                    h.isPositive -> if (Schedule.isDone(h, l)) "Concluído" + if (h.tracking != Tracking.BOOLEAN) " (${HabitText.amount(h, l.value)})" else "" else if (l.value > 0) "Parcial: ${HabitText.amount(h, l.value)}" else "Não feito"
                    l.value <= 0 -> "Não aconteceu"
                    else -> HabitText.amount(h, l.value) + if (Schedule.withinLimit(h, l)) " (no limite)" else " (acima do limite)"
                }
                listOf("${h.emoji} ${h.name}", if (h.isPositive) "Cultivar" else "Reduzir", HabitText.goal(h), status)
            }
            table(listOf("Hábito", "Tipo", "Meta / limite", "Hoje"), listOf(3f, 1.3f, 3f, 2.8f), rows)
            return
        }
        val pos = s.positive.filter { it.opportunities > 0 || it.loggedDays > 0 }
        if (pos.isNotEmpty()) {
            subTitle("Hábitos positivos")
            val rows = pos.sortedByDescending { it.rate ?: -1.0 }.map { st ->
                val prev = d.previous.positive.firstOrNull { it.habit.id == st.habit.id }?.rate
                val ch = if (st.rate != null && prev != null) ((st.rate!! - prev) * 100).roundToInt().let { if (it > 0) "▲ $it" else if (it < 0) "▼ ${-it}" else "=" } else "–"
                listOf("${st.habit.emoji} ${st.habit.name}", HabitText.goal(st.habit), "${st.successes}/${st.opportunities}", st.rate?.let { Fmt.pct(it) } ?: "–", ch)
            }
            table(listOf("Hábito", "Meta e frequência", "Feitos", "Taxa", "Variação"), listOf(3f, 3.4f, 1.2f, 1.1f, 1.3f), rows,
                colors = { r, col -> if (col == 4) rows[r][4].let { if (it.startsWith("▲")) pal.accent else if (it.startsWith("▼")) pal.coral else null } else null },
                aligns = listOf(Paint.Align.LEFT, Paint.Align.LEFT, Paint.Align.RIGHT, Paint.Align.RIGHT, Paint.Align.RIGHT))
            if (opts.charts) {
                val rated = pos.filter { it.rate != null }.sortedByDescending { it.rate }
                if (rated.isNotEmpty()) {
                    ensure(24f + rated.size * 22f)
                    for (st in rated) {
                        ensure(22f)
                        val cv = canvas()
                        textAt(cv, "${st.habit.emoji} ${st.habit.name}", M, y + 10, tp(8.5f, pal.ink, 1), 150f)
                        bar(M + 160, y + 4, cw - 210, 7f, st.rate!!, if (pal.color) Theme.blend(st.habit.color, 0xFF1F3A2A.toInt(), 0.12f) else pal.accent)
                        val r = tp(8.5f, pal.soft, 2); r.textAlign = Paint.Align.RIGHT
                        cv.drawText(Fmt.pct(st.rate!!), W - M, y + 11, r)
                        y += 20f
                    }
                    y += 8f
                }
            }
            val rated = pos.filter { it.rate != null && it.opportunities >= 3 }.sortedByDescending { it.rate }
            if (rated.size >= 2) para("Melhor desempenho: ${rated.first().habit.name} (${Fmt.pct(rated.first().rate!!)}). Maior oportunidade de melhoria: ${rated.last().habit.name} (${Fmt.pct(rated.last().rate!!)}).", 9.5f, pal.soft)
        }
        val neg = s.negative.filter { it.loggedDays > 0 }
        if (neg.isNotEmpty()) {
            subTitle("Hábitos para reduzir")
            val rows = neg.map { st ->
                val h = st.habit
                listOf("${h.emoji} ${h.name}", HabitText.goal(h), "${st.occurrenceDays}/${st.loggedDays}", "${st.overLimitDays}",
                    if (h.tracking == Tracking.BOOLEAN) Fmt.times(st.total.toInt()) else HabitText.amount(h, st.total))
            }
            table(listOf("Hábito", "Limite", "Ocorreu", "Acima", "Total"), listOf(3f, 2.8f, 1.2f, 1f, 1.8f), rows,
                aligns = listOf(Paint.Align.LEFT, Paint.Align.LEFT, Paint.Align.RIGHT, Paint.Align.RIGHT, Paint.Align.RIGHT))
            para("\"Ocorreu\" = dias com ocorrência / dias registrados. Dias sem registro não são considerados nem como ocorrência nem como dia evitado.", 8f, pal.faint)
            // histórico de ocorrências
            if (opts.charts && d.days <= 62) {
                for (st in neg) {
                    val h = st.habit
                    val vals = (0 until d.days).map { d.logs[h.id]?.get(d.from.plusDays(it.toLong()))?.value }
                    val maxV = maxOf(h.target * 1.4, vals.filterNotNull().maxOrNull() ?: 1.0, 1.0)
                    ensure(120f)
                    canvas().drawText("${h.emoji} ${h.name} — histórico de ocorrências", M, y + 10, tp(9.5f, pal.ink, 2)); y += 16f
                    val labels = (0 until d.days).map { val x = d.from.plusDays(it.toLong()); if (d.days <= 7) Fmt.dowShort(x.dayOfWeek) else if (x.dayOfMonth % 5 == 0 || it == 0) x.dayOfMonth.toString() else "" }
                    chart(80f) { cv, r ->
                        ChartPainter.bars(cv, r, vals, labels, maxV, { i -> if ((vals[i] ?: 0.0) <= h.target) pal.brand else pal.coral }, chartStyle)
                        if (h.target > 0) {
                            val ly = r.bottom - (7.5f + 7.5f) - (r.height() - 15f) * (h.target / maxV).toFloat()
                            stroke.color = pal.coral; stroke.strokeWidth = 0.8f; stroke.pathEffect = DashPathEffect(floatArrayOf(3f, 3f), 0f)
                            cv.drawLine(r.left, ly, r.right, ly, stroke); stroke.pathEffect = null
                        }
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------ humor
    private fun mood() {
        val s = d.current; val p = d.previous
        newPage()
        section("Humor e emoções", "Como você se sentiu ao longo do período.", "😊")
        if (s.moods.isEmpty()) { para("Nenhum registro de humor neste período. A ausência de registro não é tratada como humor ruim.", 10f, pal.soft); return }
        val md = delta(s.moodAvg, p.moodAvg); val en = delta(s.energyAvg, p.energyAvg); val st = delta(s.stressAvg, p.stressAvg, invert = true)
        kpis(listOf(
            Kpi("Humor médio", s.moodAvg?.let { Fmt.num(Math.round(it * 10) / 10.0) + "/5" } ?: "–", md.first, md.second),
            Kpi("Energia média", s.energyAvg?.let { Fmt.num(Math.round(it * 10) / 10.0) + "/5" } ?: "–", en.first, en.second),
            Kpi("Estresse médio", s.stressAvg?.let { Fmt.num(Math.round(it * 10) / 10.0) + "/5" } ?: "–", st.first, st.second),
        ))
        // distribuição
        subTitle("Distribuição dos estados emocionais")
        ensure(90f)
        val dist = s.moodDistribution
        val cv = canvas()
        box(M, y, cw, 82f)
        val slot = cw / 5
        for (lvl in 5 downTo 1) {
            val i = 5 - lvl
            val x = M + slot * i
            if (pal.color) MoodArt.draw(cv, lvl, x + slot / 2 - 18, y + 6, 36f)
            else { fill.color = pal.mood(lvl); cv.drawCircle(x + slot / 2, y + 26, 14f, fill) }
            val t = tp(11f, pal.ink, 3); t.textAlign = Paint.Align.CENTER
            cv.drawText("${dist[lvl - 1]}", x + slot / 2, y + 56, t)
            val t2 = tp(7.5f, pal.soft, 1); t2.textAlign = Paint.Align.CENTER
            cv.drawText("${Mood.of(lvl).label} · ${Fmt.pct(dist[lvl - 1] / s.moods.size.toDouble())}", x + slot / 2, y + 70, t2)
        }
        y += 92f
        ChartPainter.stacked(canvas(), RectF(M, y, M + cw, y + 10f), (5 downTo 1).map { Pair(dist[it - 1].toDouble(), pal.mood(it)) }, 5f)
        y += 22f
        // emoções
        val emo = s.emotionCounts.take(8)
        if (emo.isNotEmpty()) {
            subTitle("Emoções mais frequentes")
            val max = emo.first().second.toDouble()
            for ((e, n) in emo) {
                ensure(20f)
                val c2 = canvas()
                textAt(c2, "${e.emoji} ${e.label}", M, y + 10, tp(9f, pal.ink, 1), 140f)
                bar(M + 150, y + 4, cw - 190, 7f, n / max, if (e.positive) pal.brand else pal.coral)
                val r = tp(8.5f, pal.soft, 2); r.textAlign = Paint.Align.RIGHT
                c2.drawText("$n", W - M, y + 11, r)
                y += 19f
            }
            y += 8f
        }
        // evolução
        if (d.days in 2..92) {
            subTitle("Evolução do humor e da energia")
            val n = d.days
            val mv = (0 until n).map { s.moods[d.from.plusDays(it.toLong())]?.mood?.toDouble() }
            val ev = (0 until n).map { s.moods[d.from.plusDays(it.toLong())]?.energy?.toDouble() }
            val sv = (0 until n).map { s.moods[d.from.plusDays(it.toLong())]?.stress?.toDouble() }
            val labels = (0 until n).map { val x = d.from.plusDays(it.toLong()); if (n <= 7) Fmt.dowShort(x.dayOfWeek) else "${x.dayOfMonth}/${x.monthValue}" }
            chart(130f) { c3, r ->
                ChartPainter.line(c3, r, listOf(LineSeries(sv, pal.coral, fill = false, dashed = true), LineSeries(ev, pal.yellow, fill = false, dashed = true), LineSeries(mv, pal.accent, fill = true)),
                    labels, 1.0, 5.0, listOf(1.0, 2.0, 3.0, 4.0, 5.0), chartStyle, showDots = n <= 31, maxLabels = 8)
            }
            legendRow(listOf(pal.accent to "Humor", pal.yellow to "Energia", pal.coral to "Estresse"))
        }
        // calendário
        if (d.days > 1) moodCalendars()
        if (d.days == 1) {
            val m = s.moods[d.from]
            if (m != null && m.note.isNotBlank()) { subTitle("Relato do dia"); para(m.note, 10f) }
        }
    }

    private fun legendRow(items: List<Pair<Int, String>>) {
        ensure(16f)
        var x = M
        val cv = canvas()
        for ((col, l) in items) {
            fill.color = col; cv.drawRoundRect(x, y, x + 9f, y + 9f, 3f, 3f, fill)
            val t = tp(8f, pal.soft, 1); cv.drawText(l, x + 13f, y + 8f, t)
            x += 26f + t.measureText(l)
        }
        y += 18f
    }

    private fun moodCalendars() {
        val months = monthsInPeriod()
        subTitle("Calendário de humor", if (months.size <= 3) 230f else 140f)
        if (months.size <= 3) {
            for (m in months) monthGrid(m, 24f) { cv, day, cx, cy, sz ->
                val e = d.current.moods[day]
                if (e != null) { if (pal.color) MoodArt.draw(cv, e.mood, cx - sz / 2, cy - sz / 2 - 2, sz) else { fill.color = pal.mood(e.mood); cv.drawCircle(cx, cy, sz * 0.36f, fill) } }
                else { fill.color = 0xFFF0F2EE.toInt(); cv.drawCircle(cx, cy + 1, sz * 0.32f, fill) }
                val t = tp(6.5f, pal.faint, 1); t.textAlign = Paint.Align.CENTER
                cv.drawText(day.dayOfMonth.toString(), cx, cy + sz * 0.62f + 4, t)
            }
        } else miniMonths(months) { day -> d.current.moods[day]?.let { pal.mood(it.mood) } }
    }

    /** Grade mensal grande. */
    private fun monthGrid(m: LocalDate, cell: Float, drawCell: (Canvas, LocalDate, Float, Float, Float) -> Unit) {
        val weeks = Math.ceil((m.withDayOfMonth(1).dayOfWeek.value - 1 + m.lengthOfMonth()) / 7.0).toInt()
        val rowH = cell + 12f
        val h = 44f + weeks * rowH
        ensure(h + 10)
        val cv = canvas()
        box(M, y, cw, h)
        cv.drawText(Fmt.monthYear(m), M + 12, y + 18, tp(10f, pal.ink, 2))
        val colW = (cw - 24) / 7
        DayOfWeek.values().forEachIndexed { i, dw -> val t = tp(7f, pal.faint, 1); t.textAlign = Paint.Align.CENTER; cv.drawText(Fmt.dowShort(dw), M + 12 + colW * (i + 0.5f), y + 34, t) }
        // nomes dos dias ficam alinhados à direita do título; desloca a grade para baixo
        val offset = m.withDayOfMonth(1).dayOfWeek.value - 1
        for (i in 0 until m.lengthOfMonth()) {
            val day = m.plusDays(i.toLong())
            if (day.isBefore(d.from) || day.isAfter(d.to)) continue
            val idx = i + offset
            val cx = M + 12 + colW * (idx % 7 + 0.5f)
            val cy = y + 44f + (idx / 7) * rowH + cell / 2
            drawCell(cv, day, cx, cy, cell)
        }
        y += h + 10
    }

    /** Até 12 meses pequenos em grade 4×3 (para relatórios longos). */
    private fun miniMonths(months: List<LocalDate>, color: (LocalDate) -> Int?) {
        val cols = 4; val gap = 8f
        val w = (cw - gap * (cols - 1)) / cols
        val cell = (w - 12) / 7
        val h = 22f + 6 * cell + 6
        for (row in months.chunked(cols)) {
            ensure(h + gap)
            val cv = canvas()
            row.forEachIndexed { i, m ->
                val x = M + i * (w + gap)
                box(x, y, w, h, r = 10f)
                cv.drawText(Fmt.month(m.monthValue).replaceFirstChar { it.uppercase() } + " " + m.year.toString().takeLast(2), x + 6, y + 14, tp(8f, pal.ink, 2))
                val off = m.withDayOfMonth(1).dayOfWeek.value - 1
                for (k in 0 until m.lengthOfMonth()) {
                    val day = m.plusDays(k.toLong())
                    val idx = k + off
                    val cx = x + 6 + cell * (idx % 7 + 0.5f); val cy = y + 22 + cell * (idx / 7 + 0.5f)
                    val col = if (day.isBefore(d.from) || day.isAfter(d.to)) null else color(day)
                    fill.color = col ?: 0xFFEDEFEA.toInt()
                    cv.drawCircle(cx, cy, cell * 0.38f, fill)
                }
            }
            y += h + gap
        }
        y += 4f
    }

    // ------------------------------------------------------------------ consistência
    private fun consistency() {
        val c = d.consistency
        newPage()
        section("Consistência", "Um dia conta quando há o registro essencial — não é preciso cumprir 100% dos hábitos.", "🔥")
        val inPeriod = c.statusByDay.filterKeys { !it.isBefore(d.from) && !it.isAfter(d.to) }
        val valid = inPeriod.count { it.value == DayStatus.VALID }
        val periodRuns = c.runs.filter { !it.end.isBefore(d.from) && !it.start.isAfter(d.to) }
        val bestInPeriod = periodRuns.maxOfOrNull { r ->
            (ChronoUnit.DAYS.between(maxOf(r.start, d.from), minOf(r.end, d.to)) + 1).toInt().coerceAtMost(r.length)
        } ?: 0
        ensure(110f)
        val cv = canvas()
        box(M, y, cw, 100f)
        FlameArt.draw(cv, if (pal.color) c.flame else FlameLevel.NONE, M + 10, y + 8, 84f)
        cv.drawText(Fmt.days(c.current), M + 110, y + 42, tp(24f, pal.ink, 3))
        cv.drawText("sequência atual (${c.flame.label.lowercase()})", M + 110, y + 60, tp(9f, pal.soft, 1))
        cv.drawText("Melhor sequência de todas: ${Fmt.days(c.best)}", M + 110, y + 80, tp(9f, pal.soft, 1))
        y += 112f
        kpis(listOf(
            Kpi("Dias registrados", "$valid", "de ${inPeriod.size} dias do período"),
            Kpi("Maior sequência no período", "$bestInPeriod", "dias seguidos"),
            Kpi("Dias de descanso", "${inPeriod.count { it.value == DayStatus.REST }}", "não quebram a sequência"),
        ))
        subTitle("Calendário de atividades", 200f)
        val months = monthsInPeriod()
        val colorOf: (LocalDate) -> Int? = { day -> when (c.statusByDay[day]) { DayStatus.VALID -> pal.yellow; DayStatus.REST -> pal.brandSoft; DayStatus.MISSED -> 0xFFF3E3DF.toInt(); else -> null } }
        if (months.size <= 3) {
            for (m in months) monthGrid(m, 18f) { cv2, day, cx, cy, sz ->
                val col = colorOf(day)
                fill.color = col ?: 0xFFF0F2EE.toInt(); cv2.drawCircle(cx, cy, sz * 0.48f, fill)
                val t = tp(7f, if (c.statusByDay[day] == DayStatus.VALID) 0xFF5A3A00.toInt() else pal.soft, 2); t.textAlign = Paint.Align.CENTER
                cv2.drawText(day.dayOfMonth.toString(), cx, cy + 2.5f, t)
            }
        } else miniMonths(months, colorOf)
        legendRow(listOf(pal.yellow to "Registrado", pal.brandSoft to "Descanso", 0xFFF3E3DF.toInt() to "Sem registro"))
        if (periodRuns.isNotEmpty()) {
            subTitle("Sequências no período")
            table(listOf("Início", "Fim", "Dias"), listOf(3f, 3f, 1.5f), periodRuns.sortedByDescending { it.length }.take(8).map { listOf(Fmt.fullDate(it.start), Fmt.fullDate(it.end), it.length.toString()) },
                aligns = listOf(Paint.Align.LEFT, Paint.Align.LEFT, Paint.Align.RIGHT))
        }
    }

    // ------------------------------------------------------------------ objetivos
    private fun goals() {
        newPage()
        section("Objetivos", "Seus objetivos de curto, médio e longo prazo.", "🎯")
        if (d.goals.isEmpty()) { para("Nenhum objetivo cadastrado.", 10f, pal.soft); return }
        val done = d.goals.filter { it.status == GoalStatus.DONE && it.completedDay != null && !it.completedDay!!.isBefore(d.from) && !it.completedDay!!.isAfter(d.to) }
        val active = d.goals.filter { it.status == GoalStatus.ACTIVE }
        kpis(listOf(
            Kpi("Concluídos no período", done.size.toString()),
            Kpi("Em andamento", active.size.toString()),
            Kpi("Progresso médio", if (active.isEmpty()) "–" else Fmt.pct(active.map { d.goalProgress[it.id] ?: 0.0 }.average())),
        ))
        for (g in d.goals.sortedBy { it.status.ordinal }) {
            ensure(52f)
            val cv = canvas()
            box(M, y, cw, 46f)
            val pr = d.goalProgress[g.id] ?: 0.0
            cv.drawText(g.emoji, M + 12, y + 28, tp(16f))
            textAt(cv, g.name, M + 40, y + 19, tp(10f, pal.ink, 2), cw - 160)
            val sub = "${g.status.label} · ${g.horizon.label}" + (g.deadline?.let { " · prazo ${Fmt.shortDate(it)} ${it.year}" } ?: "")
            textAt(cv, sub, M + 40, y + 32, tp(7.5f, pal.soft, 1), cw - 160)
            bar(W - M - 120, y + 18, 80f, 7f, pr, if (g.status == GoalStatus.DONE) pal.accent else pal.yellow)
            val t = tp(10f, pal.ink, 3); t.textAlign = Paint.Align.RIGHT
            cv.drawText(Fmt.pct(pr), W - M - 10, y + 26, t)
            y += 52f
        }
    }

    // ------------------------------------------------------------------ descobertas
    private fun insights() {
        newPage()
        section("Descobertas", "Padrões encontrados por análise estatística local dos seus registros.", "💡")
        val win = d.insights.from?.let { " Para ter dados suficientes, a análise considera ${Fmt.range(it, d.insights.to!!)}." } ?: ""
        note(InsightsEngine.DISCLAIMER + " Só são exibidos padrões com quantidade mínima de registros e significância estatística." + win)
        val found = d.insights.found
        if (found.isEmpty()) {
            para("Ainda não há dados suficientes para apontar padrões com segurança. Isso é esperado no início — continue registrando.", 10f, pal.soft)
        }
        for (i in found.take(10)) {
            val desc = layout(i.description, tp(9f, pal.ink), cw - 70)
            val ev = layout(i.evidence.joinToString("\n") { "• $it" }, tp(7.5f, pal.soft), cw - 70)
            val h = 40f + desc.height + 8 + ev.height + 18
            ensure(h + 8)
            val cv = canvas()
            box(M, y, cw, h)
            cv.drawText(i.emoji, M + 14, y + 26, tp(18f))
            textAt(cv, i.title, M + 50, y + 20, tp(10.5f, pal.ink, 2), cw - 160)
            val conf = tp(7.5f, when (i.confidence) { Confidence.HIGH -> pal.accent; Confidence.MEDIUM -> 0xFFB7860B.toInt(); else -> pal.soft }, 2)
            conf.textAlign = Paint.Align.RIGHT
            cv.drawText(i.confidence.label.uppercase(), W - M - 12, y + 20, conf)
            cv.save(); cv.translate(M + 50, y + 30); desc.draw(cv); cv.translate(0f, desc.height + 8f); ev.draw(cv); cv.restore()
            cv.drawText("${Fmt.range(i.from, i.to)} · ${i.sampleSize} registros", M + 50, y + h - 8, tp(7f, pal.faint, 1))
            y += h + 8
        }
        val pend = d.insights.pending.take(6)
        if (pend.isNotEmpty()) {
            subTitle("Ainda coletando dados")
            for (p in pend) para("${p.emoji} ${p.title}: ${p.evidence.joinToString(" · ")}", 8.5f, pal.soft, after = 3f)
        }
    }

    // ------------------------------------------------------------------ diário
    private fun journal() {
        newPage()
        section("Diário", "Seus textos pessoais deste período.", "📖")
        if (d.journal.isEmpty()) { para("Nenhuma entrada no diário neste período.", 10f, pal.soft); return }
        for (e in d.journal) {
            ensure(60f)
            val cv = canvas()
            fill.color = pal.brand; cv.drawCircle(M + 4, y + 7, 4f, fill)
            cv.drawText(Fmt.longDate(e.day).replaceFirstChar { it.uppercase() }, M + 14, y + 10.5f, tp(9f, pal.accent, 2))
            y += 18f
            if (e.title.isNotBlank()) para(e.title, 12f, pal.ink, 2, after = 4f)
            para(e.body, 9.5f, pal.ink, after = 4f, spacing = 1.4f)
            val meta = (e.emotions.map { "${it.emoji} ${it.label}" } + e.tags.map { "#$it" }).joinToString("   ")
            if (meta.isNotEmpty()) para(meta, 8f, pal.soft, after = 4f)
            ensure(14f); stroke.color = pal.line; stroke.strokeWidth = 0.6f; canvas().drawLine(M, y + 4, W - M, y + 4, stroke); y += 14f
        }
    }

    private fun closing() {
        ensure(80f)
        y += 10f
        val cv = canvas()
        box(M, y, cw, 60f, pal.accentSoft, 14f)
        if (pal.color) MoodArt.draw(cv, 4, M + 10, y + 6, 48f)
        cv.drawText("Continue cultivando, um dia de cada vez. 🌱", M + 66, y + 27, tp(11f, pal.ink, 2))
        cv.drawText("Cada registro é um passo de autoconhecimento — não um julgamento.", M + 66, y + 42, tp(8.5f, pal.soft, 1))
        y += 70f
    }
}
