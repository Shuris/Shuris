package app.broto

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Intent
import app.broto.core.model.*
import app.broto.data.Repo
import app.broto.notify.AlarmReceiver
import app.broto.notify.Scheduler
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.LocalDate
import java.time.LocalDateTime
import kotlin.test.*

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class NotificationTest {
    private val app = RuntimeEnvironment.getApplication()
    private val repo = TestRepo.fresh()

    @Test fun schedulesAlarmsForRemindersAndDailyJobs() {
        repo.saveHabit(Habit(name = "Ler", reminderMinutes = 20 * 60, startDate = LocalDate.now().minusDays(3)))
        repo.saveHabit(Habit(name = "Sem lembrete", startDate = LocalDate.now()))
        Scheduler.rescheduleAll(app)
        val am = shadowOf(app.getSystemService(AlarmManager::class.java))
        assertEquals(4, am.scheduledAlarms.size) // hábito + humor + verificação + consistência
        repo.settings.notificationsEnabled = false
        Scheduler.rescheduleAll(app)
        assertEquals(0, am.scheduledAlarms.size)
    }

    @Test fun nextAtRespectsScheduledDays() {
        val now = LocalDateTime.of(2026, 11, 23, 21, 0) // segunda 21h
        val t = Scheduler.nextAt(now, 20 * 60) { it.dayOfWeek == java.time.DayOfWeek.WEDNESDAY }
        assertEquals(LocalDateTime.of(2026, 11, 25, 20, 0), t)
        assertEquals(LocalDateTime.of(2026, 11, 23, 22, 0), Scheduler.nextAt(now, 22 * 60))
    }

    @Test fun receiverPostsReminderAndAvoidsRepetition() {
        shadowOf(app).grantPermissions(android.Manifest.permission.POST_NOTIFICATIONS)
        val id = repo.saveHabit(Habit(name = "Treino", emoji = "🏃", reminderMinutes = 7 * 60, startDate = LocalDate.now().minusDays(10)))
        val now = LocalDate.now().atTime(12, 0)
        val i = Intent().putExtra(Scheduler.EXTRA_KIND, Scheduler.KIND_HABIT).putExtra(Scheduler.EXTRA_HABIT, id)
        val sent = AlarmReceiver.handle(app, i, now)
        assertEquals(1, sent.size)
        val nm = shadowOf(app.getSystemService(NotificationManager::class.java))
        assertEquals(1, nm.allNotifications.size)
        assertTrue(AlarmReceiver.handle(app, i, now.plusMinutes(5)).isEmpty()) // não repete no mesmo dia
        repo.setLog(id, LocalDate.now(), 1.0)
        assertTrue(AlarmReceiver.handle(app, i, now.plusDays(0)).isEmpty())
    }

    @Test fun dailyCheckSendsGentleLapseAlert() {
        shadowOf(app).grantPermissions(android.Manifest.permission.POST_NOTIFICATIONS)
        repo.saveHabit(Habit(name = "Leitura", startDate = LocalDate.now().minusDays(20)))
        val sent = AlarmReceiver.handle(app, Intent().putExtra(Scheduler.EXTRA_KIND, Scheduler.KIND_CHECK), LocalDate.now().atTime(19, 0))
        assertTrue(sent.any { it.key.startsWith("pos-lapse") }, sent.toString())
        val again = AlarmReceiver.handle(app, Intent().putExtra(Scheduler.EXTRA_KIND, Scheduler.KIND_CHECK), LocalDate.now().atTime(19, 30))
        assertTrue(again.none { it.key.startsWith("pos-lapse") })
    }
}
