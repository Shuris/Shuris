package app.broto.core.schedule

import app.broto.core.model.Frequency
import app.broto.core.model.Habit
import app.broto.core.model.HabitLog
import app.broto.core.model.Weekdays
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters

/** Dias de descanso: dias da semana fixos + datas avulsas. */
data class RestDays(val weekly: Weekdays = Weekdays.NONE, val dates: Set<LocalDate> = emptySet()) {
    fun isRest(day: LocalDate): Boolean = weekly.contains(day.dayOfWeek) || day in dates
}

object Schedule {
    fun weekStart(day: LocalDate): LocalDate = day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))

    /** O hábito existe e está ativo (não pausado/arquivado) nesse dia? */
    fun isActiveOn(h: Habit, day: LocalDate): Boolean {
        if (day.isBefore(h.startDate)) return false
        if (h.pauses.any { it.covers(day) }) return false
        return true
    }

    /**
     * O hábito está programado para um dia específico (pode ser cobrado nesse dia)?
     * Hábitos semanais ("X vezes por semana") não são programados em um dia específico:
     * nunca são considerados perdidos num dia isolado, só na avaliação da semana.
     */
    fun isScheduled(h: Habit, day: LocalDate, rest: RestDays = RestDays()): Boolean {
        if (h.archived) return false
        if (!isActiveOn(h, day)) return false
        if (h.frequency == Frequency.WEEKLY && h.isPositive) return false
        if (!h.weekdays.contains(day.dayOfWeek)) return false
        if (h.isPositive && rest.isRest(day)) return false
        return true
    }

    /** Deve aparecer na lista do dia (para registrar)? Inclui semanais e dias de descanso. */
    fun isVisibleOn(h: Habit, day: LocalDate): Boolean {
        if (h.archived || !isActiveOn(h, day)) return false
        if (h.frequency == Frequency.WEEKLY && h.isPositive) return true
        return h.weekdays.contains(day.dayOfWeek)
    }

    /** Progresso 0..1 de um registro em relação à meta (hábitos positivos). */
    fun progress(h: Habit, log: HabitLog?): Double {
        if (log == null) return 0.0
        val t = h.effectiveTarget
        if (t <= 0.0) return if (log.value > 0) 1.0 else 0.0
        return (log.value / t).coerceIn(0.0, 1.0)
    }

    fun isDone(h: Habit, log: HabitLog?): Boolean = h.isPositive && progress(h, log) >= 0.999

    /** Para negativos: o registro respeitou o limite? */
    fun withinLimit(h: Habit, log: HabitLog): Boolean = log.value <= h.target + 1e-9

    /** Quantas vezes um hábito semanal foi feito na semana que contém [day]. */
    fun weeklyCount(h: Habit, logs: Map<LocalDate, HabitLog>, day: LocalDate): Int {
        val start = weekStart(day)
        return (0..6).count { i -> isDone(h, logs[start.plusDays(i.toLong())]) }
    }
}
