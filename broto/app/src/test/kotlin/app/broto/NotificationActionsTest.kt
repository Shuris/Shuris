package app.broto

import android.app.AlarmManager
import android.app.AppOpsManager
import android.app.Notification
import android.app.NotificationManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import app.broto.core.alerts.CheckInEngine
import app.broto.core.model.*
import app.broto.data.BrotoDatabase
import app.broto.data.Repo
import app.broto.notify.ActionReceiver
import app.broto.notify.AlarmReceiver
import app.broto.notify.Notifier
import app.broto.notify.Scheduler
import app.broto.screentime.ScreenTime
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.LocalDate
import java.time.ZoneId
import kotlin.test.*

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class NotificationActionsTest {
    private val app = RuntimeEnvironment.getApplication()
    private val today = LocalDate.now()
    private fun nm() = shadowOf(app.getSystemService(NotificationManager::class.java))
    private fun checkin(slot: Int, h: Int, m: Int = 0) = AlarmReceiver.handle(app, Intent().putExtra(Scheduler.EXTRA_KIND, Scheduler.KIND_CHECKIN).putExtra(Scheduler.EXTRA_SLOT, slot), today.atTime(h, m))

    private fun setup(): Repo {
        val r = TestRepo.fresh()
        shadowOf(app).grantPermissions(android.Manifest.permission.POST_NOTIFICATIONS)
        return r
    }

    @Test fun threeDailyNotificationsByDefaultAndConfigurable() {
        val r = setup()
        assertEquals(3, r.settings.checkInTimes.size)
        Scheduler.rescheduleAll(app)
        val am = shadowOf(app.getSystemService(AlarmManager::class.java))
        assertEquals(3, am.scheduledAlarms.size)
        r.settings.checkInTimes = CheckInEngine.defaultTimes(5); Scheduler.rescheduleAll(app)
        assertEquals(5, am.scheduledAlarms.size)
        r.settings.checkInTimes = emptyList(); Scheduler.rescheduleAll(app)
        assertEquals(0, am.scheduledAlarms.size)
        r.settings.checkInTimes = listOf(7 * 60); Scheduler.rescheduleAll(app)
        assertEquals(listOf(7 * 60), r.settings.checkInTimes)
        assertEquals(1, am.scheduledAlarms.size)
    }

    @Test fun morningNotificationHasHabitButtonsThatWork() {
        val r = setup()
        val ler = r.saveHabit(Habit(name = "Ler", startDate = today.minusDays(3)))
        val agua = r.saveHabit(Habit(name = "Beber água", tracking = Tracking.QUANTITY, unit = "copos", target = 8.0, startDate = today.minusDays(3)))
        assertEquals(1, checkin(0, 8, 30).size)
        assertTrue(checkin(0, 8, 40).isEmpty()) // não repete o mesmo horário
        val n = nm().allNotifications.single()
        assertEquals(Notifier.CHANNEL_DAILY, n.channelId)
        assertEquals(2, n.actions.size)
        assertTrue(n.actions[0].title.contains("Ler"))
        // toca no botão "✓ Ler"
        shadowOf(n.actions[0].actionIntent).savedIntent.let { ActionReceiver.handle(app, it) }
        assertEquals(1.0, r.logsForDay(today)[ler]!!.value)
        // a notificação foi atualizada e agora só oferece o que falta
        val updated = nm().allNotifications.single()
        assertEquals(1, updated.actions.size)
        assertTrue(updated.actions[0].title.contains("Beber"))
        shadowOf(updated.actions[0].actionIntent).savedIntent.let { ActionReceiver.handle(app, it) }
        assertEquals(8.0, r.logsForDay(today)[agua]!!.value)
    }

    @Test fun eveningNotificationShowsMoodFacesAndRecordsMood() {
        val r = setup()
        r.saveHabit(Habit(name = "Redes", kind = HabitKind.NEGATIVE, tracking = Tracking.DURATION, unit = "min", target = 120.0, startDate = today.minusDays(3)))
        checkin(2, 20, 30)
        val n = nm().allNotifications.single()
        assertNotNull(n.contentView, "carinhas na notificação compacta")
        assertNotNull(n.bigContentView)
        assertTrue(n.actions.any { it.title.contains("Não: Redes") })
        // toque na carinha "Bom"
        val mood = ActionReceiver.moodIntent(app, 4, Notifier.checkInId(2), 2)
        ActionReceiver.handle(app, shadowOf(mood).savedIntent)
        assertEquals(4, r.mood(today)!!.mood)
        val after = nm().allNotifications.single()
        assertNull(after.contentView) // humor registrado: some a pergunta
        assertTrue(after.extras.getCharSequence(Notification.EXTRA_BIG_TEXT).toString().contains("Humor registrado: Bom"))
    }

    @Test fun habitReminderHasActions() {
        val r = setup()
        val id = r.saveHabit(Habit(name = "Estudar", tracking = Tracking.DURATION, unit = "min", target = 120.0, reminderMinutes = 9 * 60, startDate = today.minusDays(3)))
        AlarmReceiver.handle(app, Intent().putExtra(Scheduler.EXTRA_KIND, Scheduler.KIND_HABIT).putExtra(Scheduler.EXTRA_HABIT, id), today.atTime(9, 0))
        val n = nm().allNotifications.single()
        assertEquals(listOf("✓ Meta (2 h)", "+15 min"), n.actions.map { it.title.toString() })
        ActionReceiver.handle(app, shadowOf(n.actions[1].actionIntent).savedIntent)
        ActionReceiver.handle(app, shadowOf(n.actions[1].actionIntent).savedIntent)
        assertEquals(30.0, r.logsForDay(today)[id]!!.value) // +15 duas vezes
    }

    @Test fun screenTimeComputedFromUsageEvents() {
        val r = setup()
        shadowOf(app.getSystemService(AppOpsManager::class.java)).setMode(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), app.packageName, AppOpsManager.MODE_ALLOWED)
        assertTrue(ScreenTime.hasPermission(app))
        val id = r.saveHabit(Habit(name = "Redes sociais", kind = HabitKind.NEGATIVE, tracking = Tracking.DURATION, unit = "min", target = 60.0, startDate = today.minusDays(10)))
        r.setHabitApps(id, listOf("com.instagram.android", "com.zhiliaoapp.musically"))
        val usm = shadowOf(app.getSystemService(UsageStatsManager::class.java))
        val z = ZoneId.systemDefault()
        fun at(d: LocalDate, h: Int, m: Int) = d.atTime(h, m).atZone(z).toInstant().toEpochMilli()
        val y = today.minusDays(1)
        usm.addEvent("com.instagram.android", at(y, 10, 0), UsageEvents.Event.MOVE_TO_FOREGROUND)
        usm.addEvent("com.instagram.android", at(y, 10, 40), UsageEvents.Event.MOVE_TO_BACKGROUND)   // 40 min
        usm.addEvent("com.zhiliaoapp.musically", at(y, 22, 0), UsageEvents.Event.MOVE_TO_FOREGROUND)
        usm.addEvent("com.zhiliaoapp.musically", at(y, 22, 50), UsageEvents.Event.MOVE_TO_BACKGROUND) // 50 min
        usm.addEvent("com.whatsapp", at(y, 12, 0), UsageEvents.Event.MOVE_TO_FOREGROUND)              // não medido
        usm.addEvent("com.whatsapp", at(y, 13, 0), UsageEvents.Event.MOVE_TO_BACKGROUND)
        // sessão que atravessa a meia-noite: só a parte de hoje conta hoje
        usm.addEvent("com.instagram.android", at(y, 23, 50), UsageEvents.Event.MOVE_TO_FOREGROUND)
        usm.addEvent("com.instagram.android", at(today, 0, 20), UsageEvents.Event.MOVE_TO_BACKGROUND)
        ScreenTime.sync(app, r, today)
        assertEquals(100.0, r.logsForDay(y)[id]!!.value)          // 40 + 50 + 10
        assertEquals(20.0, r.logsForDay(today)[id]!!.value)
        assertEquals(ScreenTime.AUTO, r.logsForDay(y)[id]!!.note)
        // correção manual não é sobrescrita
        r.setLog(id, y, 30.0, ScreenTime.MANUAL)
        ScreenTime.sync(app, r, today)
        assertEquals(30.0, r.logsForDay(y)[id]!!.value)
        // dias sem nenhum evento de uso não são tocados
        assertNull(r.logsForDay(today.minusDays(5))[id])
        // o hábito automático não aparece como "registrar à mão" na notificação, mas o tempo aparece no texto
        checkin(2, 20, 30)
        val text = nm().allNotifications.single().extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
            ?: nm().allNotifications.single().extras.getCharSequence(Notification.EXTRA_TEXT).toString()
        assertTrue(r.settings.checkInTimes.size == 3)
        assertTrue(ScreenTime.autoHabitIds(r).contains(id))
    }

    @Test fun databaseMigratesFromV1KeepingData() {
        Repo.reset()
        app.deleteDatabase(BrotoDatabase.DB_NAME)
        val f = app.getDatabasePath(BrotoDatabase.DB_NAME); f.parentFile!!.mkdirs()
        SQLiteDatabase.openOrCreateDatabase(f, null).use { db ->
            for (sql in BrotoDatabase.SCHEMA.filter { !it.contains("habit_app") }) db.execSQL(sql)
            db.execSQL("INSERT INTO habit(name, category, emoji, color, kind, tracking, start_day, created_at) VALUES ('Antigo', 'OTHER', '✨', 0, 'POSITIVE', 'BOOLEAN', 1, 1)")
            db.version = 1
        }
        val r = Repo.get(app)
        assertEquals("Antigo", r.habits().single().name)
        r.setHabitApps(r.habits().single().id, listOf("com.x"))
        assertEquals(listOf("com.x"), r.habitApps(r.habits().single().id))
    }
}
