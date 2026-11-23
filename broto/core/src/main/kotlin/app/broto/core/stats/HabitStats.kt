package app.broto.core.stats

import app.broto.core.model.Frequency
import app.broto.core.model.Habit
import app.broto.core.model.HabitLog
import app.broto.core.schedule.RestDays
import app.broto.core.schedule.Schedule
import java.time.LocalDate

data class HabitPeriodStats(
    val habit: Habit,
    /** Dias programados no período (até hoje). Para semanais: semanas avaliadas. */
    val opportunities: Int,
    /** Dias concluídos (positivo) ou dias dentro do limite (negativo). Para semanais: semanas com a meta. */
    val successes: Int,
    val loggedDays: Int,
    /** Negativo: dias em que aconteceu (valor > 0). */
    val occurrenceDays: Int = 0,
    /** Negativo: dias acima do limite. */
    val overLimitDays: Int = 0,
    /** Soma dos valores registrados. */
    val total: Double = 0.0,
) {
    /** Taxa 0..1, ou null quando não houve oportunidade. */
    val rate: Double? get() = if (opportunities == 0) null else successes.toDouble() / opportunities
    val averagePerLoggedDay: Double get() = if (loggedDays == 0) 0.0 else total / loggedDays
}

object HabitStatsCalc {
    fun forPeriod(h: Habit, logs: Map<LocalDate, HabitLog>, from: LocalDate, to: LocalDate, today: LocalDate, rest: RestDays): HabitPeriodStats {
        val end = if (to.isAfter(today)) today else to
        var opp = 0; var succ = 0; var logged = 0; var occ = 0; var over = 0; var total = 0.0
        if (h.isPositive && h.frequency == Frequency.WEEKLY) {
            var w = Schedule.weekStart(from)
            while (!w.isAfter(end)) {
                val weekEnd = w.plusDays(6)
                val count = Schedule.weeklyCount(h, logs, w)
                val complete = !weekEnd.isAfter(today)
                val activeWeek = !weekEnd.isBefore(h.startDate) && (0..6).any { Schedule.isActiveOn(h, w.plusDays(it.toLong())) }
                if (activeWeek && (complete || count >= h.timesPerWeek)) {
                    opp++
                    if (count >= h.timesPerWeek) succ++
                }
                w = w.plusWeeks(1)
            }
            var d = from
            while (!d.isAfter(end)) { logs[d]?.let { logged++; total += it.value }; d = d.plusDays(1) }
            return HabitPeriodStats(h, opp, succ, logged, total = total)
        }
        var d = from
        while (!d.isAfter(end)) {
            val log = logs[d]
            if (log != null) { logged++; total += log.value }
            if (h.isPositive) {
                if (Schedule.isScheduled(h, d, rest)) {
                    // Hoje só conta como oportunidade se já foi registrado (o dia ainda não acabou).
                    if (d != today || log != null) {
                        opp++
                        if (Schedule.isDone(h, log)) succ++
                    }
                }
            } else {
                if (Schedule.isActiveOn(h, d) && h.weekdays.contains(d.dayOfWeek) && log != null) {
                    opp++
                    if (Schedule.withinLimit(h, log)) succ++ else over++
                    if (log.value > 0) occ++
                }
            }
            d = d.plusDays(1)
        }
        return HabitPeriodStats(h, opp, succ, logged, occ, over, total)
    }
}
