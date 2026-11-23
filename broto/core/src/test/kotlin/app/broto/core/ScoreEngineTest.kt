package app.broto.core

import app.broto.core.model.*
import app.broto.core.schedule.RestDays
import app.broto.core.score.Component
import app.broto.core.score.ScoreEngine
import java.time.DayOfWeek
import java.time.LocalDate
import kotlin.test.*

class ScoreEngineTest {
    private val day = LocalDate.of(2026, 11, 23) // segunda
    private val start = day.minusDays(30)
    private fun pos(id: Long, tracking: Tracking = Tracking.BOOLEAN, target: Double = 1.0, weekdays: Weekdays = Weekdays.ALL, freq: Frequency = Frequency.DAILY) =
        Habit(id = id, name = "P$id", kind = HabitKind.POSITIVE, tracking = tracking, target = target, weekdays = weekdays, frequency = freq, startDate = start)
    private fun neg(id: Long, tracking: Tracking = Tracking.BOOLEAN, limit: Double = 0.0) =
        Habit(id = id, name = "N$id", kind = HabitKind.NEGATIVE, tracking = tracking, target = limit, startDate = start)
    private fun log(id: Long, v: Double) = id to HabitLog(id, day, v)

    @Test fun noDataMeansNoScore() {
        val s = ScoreEngine.compute(day, emptyList(), emptyMap(), null)
        assertNull(s.score)
    }

    @Test fun perfectDayIs100() {
        val hs = listOf(pos(1), neg(2))
        val s = ScoreEngine.compute(day, hs, mapOf(log(1, 1.0), log(2, 0.0)), MoodEntry(day, 5, 5, 1))
        assertEquals(100, s.score)
    }

    @Test fun missingMoodIsNotBadMood() {
        val hs = listOf(pos(1))
        val s = ScoreEngine.compute(day, hs, mapOf(log(1, 1.0)), null)
        assertEquals(100, s.score) // bem-estar ignorado, pesos renormalizados
        assertFalse(s.component(Component.WELLBEING).present)
    }

    @Test fun quantitativeProgressIsProportional() {
        val hs = listOf(pos(1, Tracking.DURATION, 120.0))
        val s = ScoreEngine.compute(day, hs, mapOf(log(1, 60.0)), null)
        assertEquals(50, s.score)
        val over = ScoreEngine.compute(day, hs, mapOf(log(1, 300.0)), null)
        assertEquals(100, over.score) // nunca passa de 100
    }

    @Test fun unscheduledHabitIsNotPenalized() {
        val onlyWeekend = pos(1, weekdays = Weekdays.of(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY))
        val s = ScoreEngine.compute(day, listOf(onlyWeekend, pos(2)), mapOf(log(2, 1.0)), null)
        assertEquals(100, s.score)
    }

    @Test fun habitBeforeStartIsIgnored() {
        val future = pos(1).copy(startDate = day.plusDays(1))
        val s = ScoreEngine.compute(day, listOf(future, pos(2)), mapOf(log(2, 1.0)), null)
        assertEquals(100, s.score)
    }

    @Test fun weeklyHabitNotLostOnSingleDay() {
        val weekly = pos(1, freq = Frequency.WEEKLY)
        val s = ScoreEngine.compute(day, listOf(weekly, pos(2)), mapOf(log(2, 1.0)), null)
        assertEquals(100, s.score)
        val withWeekly = ScoreEngine.compute(day, listOf(weekly, pos(2)), mapOf(log(2, 1.0), log(1, 1.0)), null)
        assertEquals(100, withWeekly.score)
    }

    @Test fun restDayDoesNotPenalizePositives() {
        val rest = RestDays(weekly = Weekdays.of(DayOfWeek.MONDAY))
        val s = ScoreEngine.compute(day, listOf(pos(1), pos(2)), emptyMap(), MoodEntry(day, 3), rest = rest)
        assertEquals(50, s.score) // só o bem-estar (humor neutro = 0.5)
    }

    @Test fun pausedHabitIsNotPenalized() {
        val paused = pos(1).copy(pauses = listOf(PauseInterval(day.minusDays(2), null)))
        val s = ScoreEngine.compute(day, listOf(paused, pos(2)), mapOf(log(2, 1.0)), null)
        assertEquals(100, s.score)
    }

    @Test fun unloggedNegativeIsUnknownNotAvoided() {
        val s = ScoreEngine.compute(day, listOf(pos(1), neg(2)), mapOf(log(1, 1.0)), null)
        assertFalse(s.component(Component.NEGATIVE).present)
        assertEquals(100, s.score)
    }

    @Test fun singleNegativeCannotDestroyTheDay() {
        val hs = listOf(pos(1), neg(2, Tracking.QUANTITY, 0.0))
        val s = ScoreEngine.compute(day, hs, mapOf(log(1, 1.0), log(2, 50.0)), MoodEntry(day, 4))
        assertTrue(s.score!! >= 60, "score ${s.score}")
    }

    @Test fun negativePenaltyGrowsWithIntensity() {
        val h = neg(2, Tracking.DURATION, 120.0)
        val within = ScoreEngine.negativeHabitValue(h, 60.0)
        val atLimit = ScoreEngine.negativeHabitValue(h, 120.0)
        val over = ScoreEngine.negativeHabitValue(h, 180.0)
        val wayOver = ScoreEngine.negativeHabitValue(h, 400.0)
        assertEquals(1.0, ScoreEngine.negativeHabitValue(h, 0.0))
        assertTrue(within > atLimit && atLimit > over && over > wayOver && wayOver > 0.0)
        val occ = neg(3)
        assertTrue(ScoreEngine.negativeHabitValue(occ, 1.0) > ScoreEngine.negativeHabitValue(occ, 3.0))
    }

    @Test fun weightsAreConfigurableAndScoreClamped() {
        val hs = listOf(pos(1))
        val s = ScoreEngine.compute(day, hs, mapOf(log(1, 0.0)), MoodEntry(day, 5), ScoreWeights(positive = 0.0, negative = 0.0, wellbeing = 10.0))
        assertEquals(100, s.score)
        val s2 = ScoreEngine.compute(day, hs, mapOf(log(1, 0.0)), MoodEntry(day, 1, 1, 5))
        assertEquals(0, s2.score)
    }

    @Test fun explanationMentionsEveryComponent() {
        val s = ScoreEngine.compute(day, listOf(pos(1), pos(2)), mapOf(log(1, 1.0)), null)
        val e = s.explanation()
        assertEquals(3, e.size)
        assertTrue(e[0].contains("1 de 2"))
        assertTrue(e[2].contains("sem penalidade"))
        val pts = s.points(Component.POSITIVE)!!
        assertEquals(100.0, pts.second, 0.001)
    }
}
