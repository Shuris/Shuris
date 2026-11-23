package app.broto.core.streak

import app.broto.core.model.Frequency
import app.broto.core.model.Habit
import app.broto.core.model.HabitLog
import app.broto.core.model.StreakCriterion
import app.broto.core.schedule.RestDays
import app.broto.core.schedule.Schedule
import java.time.LocalDate
import java.time.temporal.ChronoUnit

enum class DayStatus { VALID, REST, MISSED, PENDING, BEFORE_START }

data class StreakRun(val start: LocalDate, val end: LocalDate, val length: Int)

enum class FlameLevel(val minDays: Int, val label: String) {
    NONE(0, "Sem chama"),
    SPARK(1, "Faísca"),
    SMALL(3, "Chama"),
    SPECIAL(7, "Chama especial"),
    ADVANCED(30, "Chama avançada"),
    LEGEND(100, "Conquista especial");

    val next: FlameLevel? get() = values().getOrNull(ordinal + 1)

    companion object {
        fun of(days: Int): FlameLevel = values().last { days >= it.minDays }
    }
}

data class ConsistencySummary(
    val current: Int,
    val best: Int,
    val totalValidDays: Int,
    val runs: List<StreakRun>,
    val statusByDay: Map<LocalDate, DayStatus>,
    val todayDone: Boolean,
) {
    val flame: FlameLevel get() = FlameLevel.of(current)
}

object ConsistencyEngine {
    /**
     * Um dia é válido conforme o critério escolhido. Dias de descanso não contam e também não quebram a sequência.
     * O dia de hoje, se ainda não foi registrado, fica PENDING e não quebra a sequência.
     */
    fun compute(
        moodDays: Set<LocalDate>,
        habitLogDays: Set<LocalDate>,
        criterion: StreakCriterion,
        rest: RestDays,
        today: LocalDate,
        firstDay: LocalDate?,
    ): ConsistencySummary {
        fun valid(d: LocalDate): Boolean = when (criterion) {
            StreakCriterion.ANY_CHECKIN -> d in moodDays || d in habitLogDays
            StreakCriterion.MOOD -> d in moodDays
            StreakCriterion.MOOD_AND_HABIT -> d in moodDays && d in habitLogDays
        }
        val start = firstDay ?: (moodDays + habitLogDays).minOrNull()
        val status = LinkedHashMap<LocalDate, DayStatus>()
        if (start == null || start.isAfter(today)) {
            return ConsistencySummary(0, 0, 0, emptyList(), status, false)
        }
        val runs = ArrayList<StreakRun>()
        var runStart: LocalDate? = null
        var runLast: LocalDate? = null
        var runLen = 0
        var total = 0
        var d: LocalDate = start
        while (!d.isAfter(today)) {
            val st = when {
                valid(d) -> DayStatus.VALID
                rest.isRest(d) -> DayStatus.REST
                d == today -> DayStatus.PENDING
                else -> DayStatus.MISSED
            }
            status[d] = st
            when (st) {
                DayStatus.VALID -> {
                    total++
                    if (runStart == null) runStart = d
                    runLast = d; runLen++
                }
                DayStatus.MISSED -> {
                    if (runStart != null) runs.add(StreakRun(runStart, runLast!!, runLen))
                    runStart = null; runLast = null; runLen = 0
                }
                else -> {}
            }
            d = d.plusDays(1)
        }
        if (runStart != null) runs.add(StreakRun(runStart, runLast!!, runLen))
        // Sequência atual: a última sequência é "atual" se não houve dia perdido depois dela.
        val lastMissed = status.entries.lastOrNull { it.value == DayStatus.MISSED }?.key
        val current = runs.lastOrNull()?.takeIf { lastMissed == null || it.start.isAfter(lastMissed) }?.length ?: 0
        return ConsistencySummary(
            current = current,
            best = runs.maxOfOrNull { it.length } ?: 0,
            totalValidDays = total,
            runs = runs,
            statusByDay = status,
            todayDone = status[today] == DayStatus.VALID,
        )
    }

    /**
     * Sequência de um hábito: dias programados consecutivos concluídos (positivo) ou dentro do limite (negativo).
     * Dias não programados são ignorados. Hoje sem registro não quebra.
     * Hábitos semanais: semanas consecutivas atingindo a meta semanal.
     */
    fun habitStreak(h: Habit, logs: Map<LocalDate, HabitLog>, rest: RestDays, today: LocalDate): Int {
        if (h.isPositive && h.frequency == Frequency.WEEKLY) {
            var week = Schedule.weekStart(today)
            var count = 0
            var first = true
            while (!week.plusDays(6).isBefore(h.startDate)) {
                val met = Schedule.weeklyCount(h, logs, week) >= h.timesPerWeek
                if (met) count++ else if (!first) break
                first = false
                week = week.minusWeeks(1)
            }
            return count
        }
        var d = today
        var count = 0
        var guard = 0
        while (!d.isBefore(h.startDate) && guard < 3660) {
            guard++
            val scheduled = if (h.isPositive) Schedule.isScheduled(h, d, rest) else (Schedule.isActiveOn(h, d) && h.weekdays.contains(d.dayOfWeek))
            if (scheduled) {
                val log = logs[d]
                val ok = if (h.isPositive) Schedule.isDone(h, log) else (log != null && Schedule.withinLimit(h, log))
                if (ok) count++
                else if (d != today || log != null) break
            }
            d = d.minusDays(1)
        }
        return count
    }

    fun daysBetween(a: LocalDate, b: LocalDate): Long = ChronoUnit.DAYS.between(a, b)
}
