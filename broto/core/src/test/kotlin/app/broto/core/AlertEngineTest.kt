package app.broto.core

import app.broto.core.alerts.*
import app.broto.core.model.*
import app.broto.core.schedule.RestDays
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneOffset
import kotlin.test.*

class AlertEngineTest {
    private val now = LocalDateTime.of(2026, 11, 23, 19, 0) // segunda
    private val today = now.toLocalDate()
    private val read = Habit(id = 1, name = "Leitura", emoji = "📚", startDate = today.minusDays(60))
    private val social = Habit(id = 2, name = "Redes sociais", kind = HabitKind.NEGATIVE, tracking = Tracking.DURATION, unit = "min", target = 120.0, startDate = today.minusDays(60))

    private fun input(logs: Map<Long, Map<LocalDate, HabitLog>> = emptyMap(), moods: Map<LocalDate, MoodEntry> = emptyMap(), lastSent: Map<String, Long> = emptyMap(),
                      sentToday: Int = 0, settings: AlertSettings = AlertSettings(), habits: List<Habit> = listOf(read, social), at: LocalDateTime = now) =
        AlertInput(at, habits, logs, moods, RestDays(), settings, lastSent, sentToday, ZoneOffset.UTC)

    @Test fun lapseAlertAfterThreeMissedDays() {
        val a = AlertEngine.dailyCheck(input())
        assertTrue(a.any { it.key == "pos-lapse:1" })
        assertTrue(a.none { it.text.contains("!") && it.text.contains("falhou") })
    }

    @Test fun noLapseWhenRecentlyDone() {
        val logs = mapOf(1L to mapOf(today.minusDays(2) to HabitLog(1, today.minusDays(2), 1.0)))
        assertTrue(AlertEngine.dailyCheck(input(logs)).none { it.key == "pos-lapse:1" })
    }

    @Test fun noAlertOutsideScheduledDays() {
        val weekendOnly = read.copy(weekdays = Weekdays.of(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY))
        assertTrue(AlertEngine.dailyCheck(input(habits = listOf(weekendOnly))).none { it.key.startsWith("pos-") })
        assertNull(AlertEngine.habitReminder(weekendOnly, input(habits = listOf(weekendOnly))))
    }

    @Test fun limitExceeded() {
        val logs = mapOf(2L to mapOf(today to HabitLog(2, today, 180.0)))
        val a = AlertEngine.dailyCheck(input(logs))
        assertTrue(a.any { it.key.startsWith("neg-limit:2") })
    }

    @Test fun cooldownAvoidsRepetition() {
        val sent = mapOf("pos-lapse:1" to now.minusDays(1).toInstant(ZoneOffset.UTC).toEpochMilli())
        assertTrue(AlertEngine.dailyCheck(input(lastSent = sent)).none { it.key == "pos-lapse:1" })
        val old = mapOf("pos-lapse:1" to now.minusDays(4).toInstant(ZoneOffset.UTC).toEpochMilli())
        assertTrue(AlertEngine.dailyCheck(input(lastSent = old)).any { it.key == "pos-lapse:1" })
    }

    @Test fun respectsDailyLimitAndCategories() {
        assertTrue(AlertEngine.dailyCheck(input(sentToday = 3)).isEmpty())
        val off = AlertSettings(enabled = setOf(AlertCategory.MOOD))
        assertTrue(AlertEngine.dailyCheck(input(settings = off)).isEmpty())
    }

    @Test fun quietHours() {
        assertTrue(AlertEngine.dailyCheck(input(at = now.withHour(23))).isEmpty())
        assertTrue(AlertEngine.inQuietHours(java.time.LocalTime.of(7, 0), AlertSettings()))
        assertFalse(AlertEngine.inQuietHours(java.time.LocalTime.of(12, 0), AlertSettings()))
    }

    @Test fun lowMoodAlert() {
        val moods = HashMap<LocalDate, MoodEntry>()
        for (i in 4..20) moods[today.minusDays(i.toLong())] = MoodEntry(today.minusDays(i.toLong()), 4)
        for (i in 0..3) moods[today.minusDays(i.toLong())] = MoodEntry(today.minusDays(i.toLong()), 2, energy = 1)
        val a = AlertEngine.dailyCheck(input(moods = moods, habits = emptyList()))
        assertTrue(a.any { it.key == "mood-low" })
        assertTrue(a.any { it.key == "energy-low" })
    }

    @Test fun reminderSkipsWhenAlreadyLogged() {
        val logs = mapOf(1L to mapOf(today to HabitLog(1, today, 1.0)))
        assertNull(AlertEngine.habitReminder(read, input(logs)))
        assertNotNull(AlertEngine.habitReminder(read, input()))
        assertNull(AlertEngine.moodReminder(input(moods = mapOf(today to MoodEntry(today, 3)))))
    }
}
