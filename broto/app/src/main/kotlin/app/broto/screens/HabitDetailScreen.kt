package app.broto.screens

import android.graphics.Paint
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import app.broto.MainActivity
import app.broto.core.model.Frequency
import app.broto.core.model.Tracking
import app.broto.core.schedule.Schedule
import app.broto.core.stats.HabitStatsCalc
import app.broto.core.streak.ConsistencyEngine
import app.broto.ui.*
import java.time.LocalDate

class HabitDetailScreen(act: MainActivity, private val habitId: Long) : Screen(act) {
    private var month: LocalDate = LocalDate.now().withDayOfMonth(1)

    override fun build(): View {
        val h = repo.habit(habitId) ?: return act.verticalLayout().also { it.post { if (visible) act.back() } }
        val today = LocalDate.now()
        val logs = repo.logsForHabit(h.id)
        val rest = repo.restDays()
        val streak = ConsistencyEngine.habitStreak(h, logs, rest, today)
        val s30 = HabitStatsCalc.forPeriod(h, logs, today.minusDays(29), today, today, rest)
        val sAll = HabitStatsCalc.forPeriod(h, logs, h.startDate, today, today, rest)
        return page(h.name, (if (h.isPositive) "Para cultivar" else "Para reduzir") + " · " + h.category.label, actions = {
            iconButton(Icon.EDIT, Theme.p.text) { act.push(HabitEditorScreen(act, h.id)) }
        }) {
            card(color = Theme.blend(Theme.p.surface, h.color, if (Theme.p.dark) 0.25f else 0.3f)) {
                horizontal {
                    emojiBubble(h.emoji, h.color, 60)
                    vertical { lp(0, WRAP, 1f, l = 14)
                        text(HabitText.goal(h), TextStyle.BODY_BOLD)
                        if (h.description.isNotBlank()) text(h.description, TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 4)
                        text("Desde ${Fmt.fullDate(h.startDate)}" + (h.reminderMinutes?.let { " · lembrete ${Fmt.time(it)}" } ?: ""), TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 4)
                        if (h.paused) text("⏸ Pausado — não conta como falha", TextStyle.LABEL, Theme.p.coral).lp(WRAP, WRAP, t = 6)
                    }
                }
            }
            horizontal {
                lp(MATCH, WRAP, b = 14)
                stat(if (h.frequency == Frequency.WEEKLY && h.isPositive) "semanas seguidas" else if (h.isPositive) "dias seguidos" else "dias no controle", "🔥 $streak")
                stat(if (h.isPositive) "conclusão (30 dias)" else "dentro do limite (30d)", s30.rate?.let { Fmt.pct(it) } ?: "–")
                stat(if (h.isPositive) "conclusão total" else "ocorrências (30d)", if (h.isPositive) (sAll.rate?.let { Fmt.pct(it) } ?: "–") else s30.occurrenceDays.toString())
            }
            // calendário
            card {
                horizontal {
                    iconButton(Icon.LEFT, Theme.p.textSoft, null, 36, 18) { month = month.minusMonths(1); render() }
                    text(Fmt.monthYear(month), TextStyle.SUBTITLE) { gravity = Gravity.CENTER }.lp(0, WRAP, 1f)
                    val canNext = month.plusMonths(1) <= today
                    iconButton(Icon.RIGHT, if (canNext) Theme.p.textSoft else Theme.p.outline, null, 36, 18) { if (canNext) { month = month.plusMonths(1); render() } }
                }
                space(8)
                addView(MonthGrid.build(act, month, 42) { cell, d ->
                    if (d == null) return@build
                    val log = logs[d]
                    val active = Schedule.isActiveOn(h, d)
                    val sched = if (h.isPositive) Schedule.isScheduled(h, d, rest) || (Schedule.isVisibleOn(h, d) && h.frequency == Frequency.WEEKLY) else active && h.weekdays.contains(d.dayOfWeek)
                    val state = when {
                        d.isAfter(today) || !active -> 0
                        h.isPositive && Schedule.isDone(h, log) -> 3
                        h.isPositive && log != null && log.value > 0 -> 2
                        h.isNegative && log != null && log.value <= 0 -> 3
                        h.isNegative && log != null && Schedule.withinLimit(h, log) -> 2
                        h.isNegative && log != null -> 1
                        sched && d != today && h.isPositive && h.frequency == Frequency.DAILY -> 1
                        else -> 0
                    }
                    cell.addView(DrawView(act) { c, w, hh ->
                        val p = Paint(Paint.ANTI_ALIAS_FLAG)
                        val r = minOf(w, hh) / 2f - dpf(3)
                        val col = when (state) { 3 -> Theme.p.primary; 2 -> Theme.p.primarySoft; 1 -> Theme.p.coralSoft; else -> 0 }
                        if (col != 0) { p.color = col; c.drawCircle(w / 2f, hh / 2f, r, p) }
                        if (d == today) { p.style = Paint.Style.STROKE; p.strokeWidth = dpf(1.5f); p.color = Theme.p.primaryDark; c.drawCircle(w / 2f, hh / 2f, r, p); p.style = Paint.Style.FILL }
                        p.textAlign = Paint.Align.CENTER; p.typeface = Fonts.semibold; p.textSize = dpf(12)
                        p.color = if (!active || d.isAfter(today) || (!sched && log == null)) Theme.p.textFaint else Theme.p.text
                        c.drawText(d.dayOfMonth.toString(), w / 2f, hh / 2f + dpf(4), p)
                    }, LinearLayout.LayoutParams(dp(38), dp(38)))
                    if (!d.isAfter(today) && active) cell.onClick { LogSheet.show(act, h, d) }
                })
                horizontal {
                    lp(MATCH, WRAP, t = 10)
                    legend(Theme.p.primary, if (h.isPositive) "Concluído" else "Evitado")
                    legend(Theme.p.primarySoft, if (h.isPositive) "Parcial" else "No limite")
                    legend(Theme.p.coralSoft, if (h.isPositive) "Não feito" else "Acima")
                }
                text("Toque em um dia para registrar ou corrigir.", TextStyle.CAPTION, Theme.p.textFaint).lp(WRAP, WRAP, t = 8)
            }
            // gráfico de valores
            if (h.tracking != Tracking.BOOLEAN) {
                card {
                    text("Últimos 30 dias", TextStyle.SUBTITLE)
                    val vals = (29 downTo 0).map { logs[today.minusDays(it.toLong())]?.value }
                    val maxV = maxOf(h.target * 1.3, vals.filterNotNull().maxOrNull() ?: 1.0)
                    val labels = (29 downTo 0).map { val d = today.minusDays(it.toLong()); if (d.dayOfMonth % 5 == 0) d.dayOfMonth.toString() else "" }
                    addView(BarChartView(act, vals, labels, maxV, { i ->
                        val v = vals[i] ?: 0.0
                        if (h.isPositive) (if (v >= h.target) Theme.p.primaryDark else Theme.p.primary) else (if (v <= h.target) Theme.p.primary else Theme.p.coral)
                    }), LinearLayout.LayoutParams(MATCH, dp(140)).apply { topMargin = dp(10) })
                    text("${if (h.isPositive) "Meta" else "Limite"}: ${HabitText.amount(h, h.target)} · média nos dias registrados: ${HabitText.amount(h, s30.averagePerLoggedDay)}", TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 6)
                }
            }
            // histórico
            card {
                text("Histórico recente", TextStyle.SUBTITLE).lp(WRAP, WRAP, b = 6)
                val recent = logs.values.sortedByDescending { it.day }.take(14)
                if (recent.isEmpty()) text("Nenhum registro ainda.", TextStyle.BODY, Theme.p.textSoft)
                recent.forEachIndexed { i, l ->
                    if (i > 0) divider()
                    horizontal {
                        pad(2, 4)
                        text(Fmt.relative(l.day), TextStyle.BODY).lp(0, WRAP, 1f)
                        val ok = if (h.isPositive) Schedule.isDone(h, l) else Schedule.withinLimit(h, l)
                        text(if (h.isNegative && l.value <= 0) "Não aconteceu" else HabitText.amount(h, l.value), TextStyle.BODY_BOLD, if (ok) Theme.p.primaryDark else Theme.p.coral)
                        ripple(dpf(10)); onClick { LogSheet.show(act, h, l.day) }
                    }
                }
            }
            horizontal {
                softButton(if (h.paused) "Retomar" else "Pausar", if (h.paused) Icon.PLAY else Icon.PAUSE, Theme.p.surfaceAlt, Theme.p.text) {
                    repo.setPaused(h.id, !h.paused); app.broto.notify.Scheduler.rescheduleAll(act)
                }.lp(0, WRAP, 1f, r = 6)
                softButton("Editar", Icon.EDIT) { act.push(HabitEditorScreen(act, h.id)) }.lp(0, WRAP, 1f, l = 6)
            }
        }
    }

    private fun LinearLayout.stat(label: String, value: String) {
        vertical {
            lp(0, WRAP, 1f); gravity = Gravity.CENTER_HORIZONTAL
            background = rounded(Theme.p.surface, dpf(20)); pad(6, 14)
            (layoutParams as LinearLayout.LayoutParams).setMargins(dp(4), 0, dp(4), 0)
            text(value, TextStyle.HEADLINE)
            text(label, TextStyle.TINY, Theme.p.textSoft) { gravity = Gravity.CENTER }.lp(WRAP, WRAP, t = 4)
        }
    }
}

fun LinearLayout.legend(color: Int, label: String) {
    horizontal {
        lp(WRAP, WRAP, r = 14)
        addView(View(context).apply { background = rounded(color, dpf(6)) }, LinearLayout.LayoutParams(dp(12), dp(12)))
        text(label, TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, l = 6)
    }
}
