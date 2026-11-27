package app.broto.screens

import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import app.broto.MainActivity
import app.broto.core.insights.Confidence
import app.broto.core.insights.Insight
import app.broto.core.insights.InsightsEngine
import app.broto.core.model.Tracking
import app.broto.core.report.PeriodSummary
import app.broto.ui.*
import java.time.LocalDate
import kotlin.math.roundToInt

class AnalysesScreen(act: MainActivity) : Screen(act) {
    enum class Range(val label: String, val days: Int) { WEEK("7 dias", 7), MONTH("30 dias", 30), QUARTER("90 dias", 90), YEAR("1 ano", 365) }
    private var range = Range.WEEK

    override fun build(): View {
        val today = LocalDate.now()
        val from = today.minusDays(range.days - 1L)
        val prevTo = from.minusDays(1); val prevFrom = prevTo.minusDays(range.days - 1L)
        val cur = repo.summary(from, today)
        val prev = repo.summary(prevFrom, prevTo)
        return page("Análises", "Sua evolução", back = false, actions = {
            iconButton(Icon.DOC, Theme.p.text) { act.push(ReportsScreen(act)) }
        }) {
            segmented(Range.values().toList(), range, { it.label }) { range = it; render() }
            space(14)
            // atalhos
            horizontal {
                lp(MATCH, WRAP, b = 14)
                entry("💡", "Descobertas\nsobre mim") { act.push(InsightsScreen(act)) }
                entry("🔥", "Minha\nConsistência") { act.push(ConsistencyScreen(act)) }
                entry("🎯", "Meus\nObjetivos") { act.push(GoalsScreen(act)) }
            }
            if (cur.registeredDays == 0 && prev.registeredDays == 0) {
                card { emptyState("Ainda sem dados", "Registre hábitos e humor por alguns dias para ver sua evolução aqui.", 3) }
                return@page
            }
            scoreCard(cur, prev, from, today)
            habitsCard(cur, prev)
            negativesCard(cur, prev)
            moodCard(cur, prev, from, today)
            insightsPreview()
            card(color = Theme.p.surfaceAlt, padding = 16) {
                horizontal {
                    icon(Icon.DOC, Theme.p.primaryDark, 26)
                    vertical { lp(0, WRAP, 1f, l = 12)
                        text("Relatórios em PDF", TextStyle.BODY_BOLD)
                        text("Gere um documento completo deste período", TextStyle.CAPTION, Theme.p.textSoft) }
                    icon(Icon.RIGHT, Theme.p.textSoft, 20)
                }
            }.clickable { act.push(ReportsScreen(act)) }
        }
    }

    private fun LinearLayout.entry(emoji: String, label: String, f: () -> Unit) {
        vertical {
            lp(0, WRAP, 1f); gravity = Gravity.CENTER_HORIZONTAL
            background = rounded(Theme.p.surface, dpf(22)); pad(6, 14)
            (layoutParams as LinearLayout.LayoutParams).setMargins(dp(4), 0, dp(4), 0)
            text(emoji, TextStyle.TITLE)
            text(label, TextStyle.LABEL) { gravity = Gravity.CENTER }.lp(WRAP, WRAP, t = 6)
            ripple(dpf(22), Theme.p.surface); onClick { f() }
        }
    }

    private fun LinearLayout.delta(cur: Double?, prev: Double?, unit: String = "", invert: Boolean = false, pct: Boolean = false) {
        if (cur == null || prev == null) { text("sem comparação", TextStyle.TINY, Theme.p.textFaint); return }
        var d = cur - prev
        if ((pct && Math.abs(d * 100) < 0.5) || (!pct && Math.abs(d) < 0.05)) d = 0.0
        val good = if (invert) d < 0 else d > 0
        val txt = if (pct) "${(Math.abs(d) * 100).roundToInt()} p.p." else Fmt.num(Math.round(Math.abs(d) * 10) / 10.0) + unit
        val col = if (Math.abs(d) < 1e-9) Theme.p.textSoft else if (good) Theme.p.primaryDark else Theme.p.coral
        text((if (d > 0) "▲ " else if (d < 0) "▼ " else "= ") + txt + " vs. anterior", TextStyle.TINY, col)
    }

    private fun LinearLayout.kpi(label: String, value: String, deltaF: LinearLayout.() -> Unit) {
        vertical {
            lp(0, WRAP, 1f); background = rounded(Theme.p.surfaceAlt, dpf(18)); pad(12, 12)
            (layoutParams as LinearLayout.LayoutParams).setMargins(dp(3), 0, dp(3), 0)
            text(label, TextStyle.TINY, Theme.p.textSoft)
            text(value, TextStyle.TITLE).lp(WRAP, WRAP, t = 4, b = 4)
            deltaF()
        }
    }

    private fun LinearLayout.scoreCard(cur: PeriodSummary, prev: PeriodSummary, from: LocalDate, today: LocalDate) {
        card {
            text("Score", TextStyle.HEADLINE)
            text("Média diária do período e evolução ao longo do tempo", TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 2, b = 12)
            horizontal {
                kpi("Média", cur.avgScore?.roundToInt()?.toString() ?: "–") { delta(cur.avgScore, prev.avgScore, " pts") }
                val best = repo.bestScore()
                kpi("Melhor histórico", best?.second?.toString() ?: "–") { text(best?.let { Fmt.shortDate(it.first) } ?: "", TextStyle.TINY, Theme.p.textSoft) }
            }
            val n = range.days
            if (n <= 90) {
                val vals = (0 until n).map { cur.scores[from.plusDays(it.toLong())]?.toDouble() }
                val ma = if (n >= 30) movingAvg(vals, 7) else null
                val labels = (0 until n).map { val d = from.plusDays(it.toLong()); if (n == 7) Fmt.dowShort(d.dayOfWeek) else "${d.dayOfMonth}/${d.monthValue}" }
                val series = arrayListOf(LineSeries(vals, Theme.p.primaryDark, fill = ma == null, label = "Score"))
                if (ma != null) series.add(0, LineSeries(ma, Theme.p.primary, fill = true, label = "média 7d"))
                addView(LineChartView(act, series, labels, 0.0, 100.0, listOf(0.0, 25.0, 50.0, 75.0, 100.0), showDots = n <= 31), LinearLayout.LayoutParams(MATCH, dp(170)).apply { topMargin = dp(14) })
                if (ma != null) horizontal { lp(MATCH, WRAP, t = 6); legend(Theme.p.primaryDark, "Score diário"); legend(Theme.p.primary, "Média móvel de 7 dias") }
            } else {
                // ano: médias mensais
                val months = (11 downTo 0).map { today.withDayOfMonth(1).minusMonths(it.toLong()) }
                val vals = months.map { m -> cur.scores.filterKeys { it.year == m.year && it.month == m.month }.values.takeIf { it.isNotEmpty() }?.average() }
                text("Média mensal", TextStyle.LABEL, Theme.p.textSoft).lp(WRAP, WRAP, t = 14)
                addView(BarChartView(act, vals, months.map { Fmt.monthShort(it.monthValue) }, 100.0, { Theme.p.primary }, { it.roundToInt().toString() }),
                    LinearLayout.LayoutParams(MATCH, dp(170)).apply { topMargin = dp(8) })
            }
            if (range.days >= 30) {
                val weeks = cur.scores.entries.groupBy { app.broto.core.schedule.Schedule.weekStart(it.key) }.toSortedMap()
                if (weeks.size >= 2) {
                    val avgs = weeks.mapValues { e -> e.value.map { it.value }.average() }
                    val best = avgs.maxByOrNull { it.value }!!
                    text("Média semanal mais alta: ${best.value.roundToInt()} (semana de ${Fmt.shortDate(best.key)})", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 10)
                }
            }
        }.enter()
    }

    private fun movingAvg(v: List<Double?>, w: Int): List<Double?> = v.indices.map { i ->
        val win = v.subList(maxOf(0, i - w + 1), i + 1).filterNotNull()
        if (win.size >= 3) win.average() else null
    }

    private fun LinearLayout.habitsCard(cur: PeriodSummary, prev: PeriodSummary) {
        if (cur.positive.isEmpty()) return
        card {
            text("Hábitos positivos", TextStyle.HEADLINE)
            horizontal {
                lp(MATCH, WRAP, t = 12, b = 12)
                kpi("Taxa de conclusão", cur.positiveRate?.let { Fmt.pct(it) } ?: "–") { delta(cur.positiveRate, prev.positiveRate, pct = true) }
                kpi("Realizados", cur.positiveDone.toString()) { text("de ${cur.positiveOpportunities} oportunidades", TextStyle.TINY, Theme.p.textSoft) }
            }
            val sorted = cur.positive.filter { it.rate != null }.sortedByDescending { it.rate }
            for (s in sorted) {
                val p = prev.positive.firstOrNull { it.habit.id == s.habit.id }?.rate
                horizontal {
                    lp(MATCH, WRAP, t = 8)
                    text(s.habit.emoji, TextStyle.SUBTITLE).lp(dp(30), WRAP)
                    vertical {
                        lp(0, WRAP, 1f)
                        horizontal {
                            text(s.habit.name, TextStyle.LABEL).ellipsize().lp(0, WRAP, 1f)
                            text(Fmt.pct(s.rate!!) + (p?.let { val d = ((s.rate!! - it) * 100).roundToInt(); if (d > 0) "  ▲$d" else if (d < 0) "  ▼${-d}" else "" } ?: ""),
                                TextStyle.LABEL, Theme.p.textSoft)
                        }
                        progressBar(s.rate!!.toFloat(), s.habit.color.let { Theme.deepen(it, 0.15f) }, 8).lp(MATCH, dp(8), t = 5)
                    }
                }
            }
            if (sorted.size >= 2) {
                text("💪 Mais consistente: ${sorted.first().habit.name} · 🌱 Mais desafiador: ${sorted.last().habit.name}", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 12)
            }
        }.enter(40)
    }

    private fun LinearLayout.negativesCard(cur: PeriodSummary, prev: PeriodSummary) {
        if (cur.negative.isEmpty()) return
        card {
            text("Hábitos para reduzir", TextStyle.HEADLINE)
            text("Comparação com o período anterior de mesmo tamanho", TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 2, b = 8)
            for (s in cur.negative) {
                val p = prev.negative.firstOrNull { it.habit.id == s.habit.id }
                card(color = Theme.p.surfaceAlt, padding = 14) {
                    lp(MATCH, WRAP, b = 8)
                    horizontal {
                        text(s.habit.emoji + "  " + s.habit.name, TextStyle.BODY_BOLD).lp(0, WRAP, 1f)
                        text(s.rate?.let { "${Fmt.pct(it)} no limite" } ?: "sem registros", TextStyle.LABEL, Theme.p.textSoft)
                    }
                    val avg = s.averagePerLoggedDay; val pavg = p?.averagePerLoggedDay
                    val what = if (s.habit.tracking == Tracking.BOOLEAN) "Aconteceu em ${Fmt.days(s.occurrenceDays)} de ${s.opportunities} registrados"
                        else "Média por dia registrado: ${HabitText.amount(s.habit, avg)} · total ${HabitText.amount(s.habit, s.total)}"
                    text(what, TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 6)
                    if (p != null && p.loggedDays > 0 && s.loggedDays > 0) {
                        val a = if (s.habit.tracking == Tracking.BOOLEAN) s.occurrenceDays.toDouble() / s.loggedDays else avg
                        val b = if (s.habit.tracking == Tracking.BOOLEAN) p.occurrenceDays.toDouble() / p.loggedDays else pavg!!
                        if (b > 0) {
                            val ch = ((a / b - 1) * 100).roundToInt()
                            text(if (ch < 0) "▼ ${-ch}% em relação ao período anterior 🎉" else if (ch > 0) "▲ $ch% em relação ao período anterior" else "Estável em relação ao período anterior",
                                TextStyle.LABEL, if (ch <= 0) Theme.p.primaryDark else Theme.p.coral).lp(WRAP, WRAP, t = 6)
                        }
                    }
                }
            }
        }.enter(80)
    }

    private fun LinearLayout.moodCard(cur: PeriodSummary, prev: PeriodSummary, from: LocalDate, today: LocalDate) {
        if (cur.moods.isEmpty()) return
        card {
            text("Humor e energia", TextStyle.HEADLINE)
            horizontal {
                lp(MATCH, WRAP, t = 12, b = 4)
                kpi("Humor médio", cur.moodAvg?.let { Fmt.num(Math.round(it * 10) / 10.0) } ?: "–") { delta(cur.moodAvg, prev.moodAvg) }
                kpi("Energia", cur.energyAvg?.let { Fmt.num(Math.round(it * 10) / 10.0) } ?: "–") { delta(cur.energyAvg, prev.energyAvg) }
                kpi("Estresse", cur.stressAvg?.let { Fmt.num(Math.round(it * 10) / 10.0) } ?: "–") { delta(cur.stressAvg, prev.stressAvg, invert = true) }
            }
            if (range.days <= 90) {
                val n = range.days
                val mood = (0 until n).map { cur.moods[from.plusDays(it.toLong())]?.mood?.toDouble() }
                val energy = (0 until n).map { cur.moods[from.plusDays(it.toLong())]?.energy?.toDouble() }
                val labels = (0 until n).map { val d = from.plusDays(it.toLong()); if (n == 7) Fmt.dowShort(d.dayOfWeek) else "${d.dayOfMonth}/${d.monthValue}" }
                addView(LineChartView(act, listOf(LineSeries(energy, Theme.p.yellow, fill = false, dashed = true), LineSeries(mood, Theme.moodColor(4).let { Theme.deepen(it, 0.2f) }, fill = true)),
                    labels, 1.0, 5.0, listOf(1.0, 2.0, 3.0, 4.0, 5.0), showDots = n <= 31), LinearLayout.LayoutParams(MATCH, dp(150)).apply { topMargin = dp(12) })
                horizontal { lp(MATCH, WRAP, t = 6); legend(Theme.deepen(Theme.moodColor(4), 0.2f), "Humor"); legend(Theme.p.yellow, "Energia") }
            }
            text("Distribuição dos dias", TextStyle.LABEL, Theme.p.textSoft).lp(WRAP, WRAP, t = 14, b = 8)
            val dist = cur.moodDistribution
            horizontal {
                for (lvl in 5 downTo 1) {
                    vertical {
                        lp(0, WRAP, 1f); gravity = Gravity.CENTER_HORIZONTAL
                        val iv = android.widget.ImageView(context); iv.setImageDrawable(MoodFaceDrawable(lvl, dp(34))); iv.alpha = if (dist[lvl - 1] == 0) 0.35f else 1f
                        addView(iv, LinearLayout.LayoutParams(dp(34), dp(34)))
                        text(Fmt.pct(dist[lvl - 1] / cur.moods.size.toDouble()), TextStyle.TINY, Theme.p.textSoft).lp(WRAP, WRAP, t = 2)
                    }
                }
            }
        }.enter(120)
    }

    private fun LinearLayout.insightsPreview() {
        val today = LocalDate.now()
        val report = InsightsEngine.analyze(repo.dayRecords(today.minusDays(179), today), repo.habits())
        card {
            horizontal {
                text("💡 Descobertas sobre mim", TextStyle.HEADLINE).lp(0, WRAP, 1f)
                text("Ver todas ›", TextStyle.LABEL, Theme.p.primaryDark) { pad(8, 6); minHeight = dp(48); gravity = Gravity.CENTER_VERTICAL }
            }
            val top = report.found.take(2)
            if (top.isEmpty()) text("Ainda não há dados suficientes para apontar padrões com segurança. Continue registrando! 🌱", TextStyle.BODY, Theme.p.textSoft).lp(MATCH, WRAP, t = 8)
            for (i in top) {
                horizontal {
                    lp(MATCH, WRAP, t = 10); gravity = Gravity.TOP
                    text(i.emoji, TextStyle.TITLE)
                    vertical { lp(0, WRAP, 1f, l = 10)
                        text(i.title, TextStyle.BODY_BOLD)
                        text(i.confidence.label + " · ${i.sampleSize} dias", TextStyle.TINY, Theme.p.textSoft).lp(WRAP, WRAP, t = 2) }
                }
            }
        }.clickable { act.push(InsightsScreen(act)) }.enter(160)
    }
}

class InsightsScreen(act: MainActivity) : Screen(act) {
    private var days = 180

    override fun build(): View {
        val today = LocalDate.now()
        val from = if (days > 0) today.minusDays(days - 1L) else (repo.firstDay() ?: today)
        val r = InsightsEngine.analyze(repo.dayRecords(from, today), repo.habits())
        return page("Descobertas sobre mim", "Análise estatística local dos seus registros") {
            choiceChips(listOf(30, 90, 180, 0), days, { if (it == 0) "Tudo" else "$it dias" }) { days = it; render() }
            space(12)
            card(color = Theme.p.surfaceAlt, padding = 16) {
                horizontal {
                    gravity = Gravity.TOP
                    icon(Icon.INFO, Theme.p.primaryDark, 22)
                    text(InsightsEngine.DISCLAIMER + " Só mostramos padrões com uma quantidade mínima de registros e significância estatística.", TextStyle.CAPTION, Theme.p.text).lp(0, WRAP, 1f, l = 10)
                }
            }
            text(if (r.from != null) "Período analisado: ${Fmt.range(r.from!!, r.to!!)} · ${Fmt.days(r.daysAnalyzed)} com registros" else "Nenhum registro no período", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, b = 12)
            if (r.found.isEmpty()) card { emptyState("Nenhum padrão claro ainda", "Isso é normal no começo: com mais registros, as descobertas aparecem aqui — sem inventar conclusões.", 3) }
            r.found.forEachIndexed { i, ins -> addView(insightCard(ins).also { it.enter(i * 40L) }) }
            if (r.pending.isNotEmpty()) {
                section("⏳ Ainda coletando dados")
                for (p in r.pending.take(8)) {
                    card(padding = 14) {
                        horizontal {
                            text(p.emoji, TextStyle.SUBTITLE)
                            vertical { lp(0, WRAP, 1f, l = 10)
                                text(p.title, TextStyle.BODY_BOLD)
                                text(p.description, TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 3)
                                val total = p.sampleSize + p.needed
                                if (total > 0) progressBar(p.sampleSize / total.toFloat(), Theme.p.primary, 6).lp(MATCH, dp(6), t = 8)
                                text(p.evidence.joinToString(" · "), TextStyle.TINY, Theme.p.textFaint).lp(WRAP, WRAP, t = 5)
                            }
                        }
                    }
                }
            }
        }
    }

    private fun insightCard(i: Insight): View {
        val wrap = act.verticalLayout()
        wrap.card {
            horizontal {
                gravity = Gravity.TOP
                text(i.emoji, TextStyle.TITLE) { gravity = Gravity.CENTER; background = rounded(Theme.p.surfaceAlt, dpf(16)) }.lp(dp(48), dp(48))
                vertical { lp(0, WRAP, 1f, l = 12)
                    text(i.title, TextStyle.SUBTITLE)
                    val col = when (i.confidence) { Confidence.HIGH -> Theme.p.primaryDark; Confidence.MEDIUM -> Theme.deepen(Theme.p.yellow, 0.35f); else -> Theme.p.textSoft }
                    text(i.confidence.label, TextStyle.TINY, col) { background = rounded(Theme.alpha(col, 0.12f), dpf(10)); pad(8, 3) }.lp(WRAP, WRAP, t = 6)
                }
            }
            text(i.description, TextStyle.BODY).lp(MATCH, WRAP, t = 10)
            val ev = vertical {
                lp(MATCH, WRAP, t = 8); background = rounded(Theme.p.surfaceAlt, dpf(14)); pad(12, 10)
                for (e in i.evidence) text("• $e", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 2)
            }
            text("${Fmt.range(i.from, i.to)} · ${i.sampleSize} registros analisados", TextStyle.TINY, Theme.p.textFaint).lp(WRAP, WRAP, t = 8)
        }
        return wrap
    }
}
