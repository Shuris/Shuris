package app.broto.core

import app.broto.core.alerts.*
import app.broto.core.model.*
import app.broto.core.schedule.RestDays
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneOffset
import kotlin.test.*

class CheckInTest {
    private val day = LocalDate.of(2026, 11, 23) // segunda
    private val read = Habit(id = 1, name = "Ler", startDate = day.minusDays(30))
    private val study = Habit(id = 2, name = "Estudar", tracking = Tracking.DURATION, unit = "min", target = 120.0, startDate = day.minusDays(30))
    private val social = Habit(id = 3, name = "Redes sociais", kind = HabitKind.NEGATIVE, tracking = Tracking.DURATION, unit = "min", target = 120.0, startDate = day.minusDays(30))
    private val weekend = Habit(id = 4, name = "Faxina", weekdays = Weekdays.of(DayOfWeek.SATURDAY), startDate = day.minusDays(30))

    private fun input(h: Int, m: Int = 0, logs: Map<Long, Map<LocalDate, HabitLog>> = emptyMap(), moods: Map<LocalDate, MoodEntry> = emptyMap(), rest: RestDays = RestDays()) =
        AlertInput(day.atTime(h, m), listOf(read, study, social, weekend), logs, moods, rest, AlertSettings(), emptyMap(), 0, ZoneOffset.UTC)

    @Test fun defaultsAreMorningAfternoonEvening() {
        val t = CheckInEngine.defaultTimes(3)
        assertEquals(listOf(DayPart.MORNING, DayPart.AFTERNOON, DayPart.EVENING), t.map { CheckInEngine.partOf(it) })
        assertEquals(0, CheckInEngine.defaultTimes(0).size)
        assertEquals(6, CheckInEngine.defaultTimes(10).size)
        for (n in 1..6) { val l = CheckInEngine.defaultTimes(n); assertEquals(n, l.size); assertEquals(l.sorted(), l) }
    }

    @Test fun morningListsTodaysHabitsWithButtons() {
        val c = CheckInEngine.build(input(8, 30), 0, false, "Ana Maria")
        assertEquals(DayPart.MORNING, c.part)
        assertTrue(c.title.contains("Ana"))
        assertTrue(c.text.contains("Ler") && c.text.contains("Estudar"))
        assertFalse(c.text.contains("Faxina")) // não programado hoje
        assertTrue(c.actions.size in 1..3)
        assertEquals(1L, c.actions.first().habitId)
        assertFalse(c.askMood)
    }

    @Test fun afternoonShowsProgressAndSkipsDoneHabits() {
        val logs = mapOf(1L to mapOf(day to HabitLog(1, day, 1.0)))
        val c = CheckInEngine.build(input(13, 30, logs), 1, false)
        assertTrue(c.text.contains("1 de 2"), c.text)
        assertTrue(c.actions.none { it.habitId == 1L })
        assertTrue(c.actions.any { it.habitId == 2L })
    }

    @Test fun eveningAsksMoodAndPrioritizesNegatives() {
        val c = CheckInEngine.build(input(20, 30), 2, true, streak = 5, todayDone = false)
        assertTrue(c.askMood)
        assertEquals(3L, c.actions.first().habitId)
        assertEquals(QuickAction.Mode.SET, c.actions.first().mode); assertEquals(0.0, c.actions.first().amount)
        assertTrue(c.text.contains("sequência de 5 dias"))
    }

    @Test fun moodAlreadyRegisteredNoFaces() {
        val c = CheckInEngine.build(input(20, 30, moods = mapOf(day to MoodEntry(day, 4))), 2, true, score = 77)
        assertFalse(c.askMood)
        assertTrue(c.text.contains("Score de hoje: 77"))
    }

    @Test fun everythingDone() {
        val logs = mapOf(1L to mapOf(day to HabitLog(1, day, 1.0)), 2L to mapOf(day to HabitLog(2, day, 130.0)), 3L to mapOf(day to HabitLog(3, day, 0.0)))
        val c = CheckInEngine.build(input(20, 30, logs, mapOf(day to MoodEntry(day, 5))), 2, true)
        assertTrue(c.allDone); assertTrue(c.actions.isEmpty())
        assertTrue(c.text.contains("concluiu tudo"))
    }

    @Test fun restDayDoesNotPush() {
        val c = CheckInEngine.build(input(8, 30, rest = RestDays(dates = setOf(day))), 0, false)
        assertTrue(c.text.contains("descanso")); assertTrue(c.actions.isEmpty())
    }

    @Test fun screenTimeLineAndAutoHabitsNotAskedManually() {
        val c = CheckInEngine.build(input(20, 30), 2, true, screenTime = mapOf(3L to 150.0), autoHabits = setOf(3L))
        assertTrue(c.text.contains("Redes sociais hoje: 2 h 30") && c.text.contains("acima do limite"), c.text)
        assertTrue(c.actions.none { it.habitId == 3L })
    }

    @Test fun quickActionsByType() {
        assertEquals(listOf("✓ Feito"), QuickActions.forHabit(read, null).map { it.label })
        val s = QuickActions.forHabit(study, null)
        assertEquals(listOf("✓ Meta (2 h)", "+15 min"), s.map { it.label })
        assertEquals(QuickAction.Mode.ADD, s[1].mode)
        assertEquals("🌿 Não aconteceu", QuickActions.forHabit(social, null).first().label)
        val occ = social.copy(tracking = Tracking.BOOLEAN, target = 0.0)
        assertEquals(2, QuickActions.forHabit(occ, null).size)
    }
}
