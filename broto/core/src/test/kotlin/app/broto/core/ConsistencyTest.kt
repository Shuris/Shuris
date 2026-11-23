package app.broto.core

import app.broto.core.model.*
import app.broto.core.schedule.RestDays
import app.broto.core.streak.ConsistencyEngine
import app.broto.core.streak.DayStatus
import app.broto.core.streak.FlameLevel
import java.time.DayOfWeek
import java.time.LocalDate
import kotlin.test.*

class ConsistencyTest {
    private val today = LocalDate.of(2026, 11, 23)
    private fun days(vararg ago: Int) = ago.map { today.minusDays(it.toLong()) }.toSet()

    @Test fun todayPendingDoesNotBreak() {
        val s = ConsistencyEngine.compute(days(1, 2, 3), emptySet(), StreakCriterion.ANY_CHECKIN, RestDays(), today, null)
        assertEquals(3, s.current)
        assertEquals(DayStatus.PENDING, s.statusByDay[today])
        assertFalse(s.todayDone)
    }

    @Test fun missedDayBreaks() {
        val s = ConsistencyEngine.compute(days(0, 1, 3, 4, 5, 6), emptySet(), StreakCriterion.ANY_CHECKIN, RestDays(), today, null)
        assertEquals(2, s.current)
        assertEquals(4, s.best)
        assertEquals(2, s.runs.size)
    }

    @Test fun restDayBridges() {
        val rest = RestDays(dates = setOf(today.minusDays(2)))
        val s = ConsistencyEngine.compute(days(0, 1, 3, 4), emptySet(), StreakCriterion.ANY_CHECKIN, rest, today, null)
        assertEquals(4, s.current)
    }

    @Test fun criterionMoodAndHabit() {
        val s = ConsistencyEngine.compute(days(0, 1, 2), days(0, 2), StreakCriterion.MOOD_AND_HABIT, RestDays(), today, null)
        assertEquals(1, s.current)
        val any = ConsistencyEngine.compute(days(0, 1, 2), days(0, 2), StreakCriterion.ANY_CHECKIN, RestDays(), today, null)
        assertEquals(3, any.current)
    }

    @Test fun incompleteHabitsDoNotBreakStreak() {
        // Registrou humor todos os dias, mas não concluiu hábitos: a sequência continua (critério padrão).
        val s = ConsistencyEngine.compute(days(0, 1, 2, 3, 4, 5, 6), emptySet(), StreakCriterion.ANY_CHECKIN, RestDays(), today, null)
        assertEquals(7, s.current)
        assertEquals(FlameLevel.SPECIAL, s.flame)
    }

    @Test fun flameLevels() {
        assertEquals(FlameLevel.NONE, FlameLevel.of(0))
        assertEquals(FlameLevel.SPARK, FlameLevel.of(1))
        assertEquals(FlameLevel.SMALL, FlameLevel.of(3))
        assertEquals(FlameLevel.SPECIAL, FlameLevel.of(7))
        assertEquals(FlameLevel.ADVANCED, FlameLevel.of(30))
        assertEquals(FlameLevel.LEGEND, FlameLevel.of(150))
    }

    @Test fun habitStreakSkipsUnscheduledDays() {
        val h = Habit(id = 1, name = "Treino", weekdays = Weekdays.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY), startDate = today.minusDays(30))
        // hoje é segunda; registros nas últimas sexta e quarta
        val logs = listOf(today.minusDays(3), today.minusDays(5), today.minusDays(7)).associateWith { HabitLog(1, it, 1.0) }
        assertEquals(3, ConsistencyEngine.habitStreak(h, logs, RestDays(), today))
    }

    @Test fun negativeHabitStreakCountsDaysWithinLimit() {
        val h = Habit(id = 2, name = "Redes", kind = HabitKind.NEGATIVE, tracking = Tracking.DURATION, target = 60.0, startDate = today.minusDays(30))
        val logs = mapOf(today.minusDays(1) to HabitLog(2, today.minusDays(1), 30.0), today.minusDays(2) to HabitLog(2, today.minusDays(2), 0.0),
            today.minusDays(3) to HabitLog(2, today.minusDays(3), 200.0))
        assertEquals(2, ConsistencyEngine.habitStreak(h, logs, RestDays(), today))
    }

    @Test fun weeklyHabitStreakCountsWeeks() {
        val h = Habit(id = 3, name = "Natação", frequency = Frequency.WEEKLY, timesPerWeek = 2, startDate = today.minusDays(60))
        val logs = listOf(1, 3, 8, 10).map { today.minusDays(it.toLong()) }.associateWith { HabitLog(3, it, 1.0) }
        assertEquals(2, ConsistencyEngine.habitStreak(h, logs, RestDays(), today)) // semana atual pendente
    }
}
