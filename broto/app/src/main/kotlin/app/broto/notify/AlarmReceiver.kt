package app.broto.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import app.broto.core.alerts.Alert
import app.broto.core.alerts.AlertEngine
import app.broto.core.alerts.AlertInput
import app.broto.data.Repo
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

/** Recebe os alarmes, decide o que notificar (AlertEngine) e reagenda. */
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        Thread {
            try { handle(context.applicationContext, intent) } catch (_: Exception) { } finally {
                try { Scheduler.rescheduleAll(context.applicationContext) } catch (_: Exception) {}
                pending.finish()
            }
        }.start()
    }

    companion object {
        fun buildInput(repo: Repo, now: LocalDateTime = LocalDateTime.now()): AlertInput {
            val today = now.toLocalDate()
            val startOfDay = today.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
            return AlertInput(now, repo.habits(), repo.logsInRange(today.minusDays(35), today), repo.moodsInRange(today.minusDays(60), today),
                repo.restDays(), repo.alertSettings(), repo.lastSentAlerts(), repo.smartAlertsSentSince(startOfDay))
        }

        /** Monta a notificação diária do horário [slot] com os dados atuais. [record]: registra a dica incluída (evita repetir). */
        fun buildCheckIn(ctx: Context, repo: Repo, slot: Int, now: LocalDateTime = LocalDateTime.now(), record: Boolean = true): app.broto.core.alerts.CheckIn? {
            val times = repo.settings.checkInTimes
            if (slot !in times.indices) return null
            val input = buildInput(repo, now)
            val today = now.toLocalDate()
            val cons = repo.consistency(today)
            val screen = try { app.broto.screentime.ScreenTime.todayMinutes(ctx, repo, today) } catch (e: Exception) { emptyMap<Long, Double>() }
            val c = app.broto.core.alerts.CheckInEngine.build(input, slot, slot == times.lastIndex, repo.settings.userName, cons.current, cons.todayDone,
                repo.storedScores(today, today)[today], screen, app.broto.screentime.ScreenTime.autoHabitIds(repo))
            if (record) c.insight?.let { repo.recordAlert(it.key, it.category) }
            return c
        }

        fun handle(ctx: Context, intent: Intent, now: LocalDateTime = LocalDateTime.now()): List<Alert> {
            val repo = Repo.get(ctx)
            if (!repo.settings.notificationsEnabled) return emptyList()
            try { app.broto.screentime.ScreenTime.sync(ctx, repo, now.toLocalDate()) } catch (_: Exception) {}
            val input = buildInput(repo, now)
            val alerts: List<Alert> = when (intent.getStringExtra(Scheduler.EXTRA_KIND)) {
                Scheduler.KIND_CHECKIN -> {
                    val slot = intent.getIntExtra(Scheduler.EXTRA_SLOT, 0)
                    val key = "checkin:${now.toLocalDate()}:$slot"
                    // não repete se o alarme disparar de novo no mesmo dia
                    if (input.lastSent.containsKey(key)) return emptyList()
                    val c = buildCheckIn(ctx, repo, slot, now) ?: return emptyList()
                    Notifier.postCheckIn(ctx, c, slot)
                    repo.recordAlert(key, app.broto.core.alerts.AlertCategory.HABIT_REMINDER)
                    return listOf(Alert(key, app.broto.core.alerts.AlertCategory.HABIT_REMINDER, c.title, c.text, 1, 0))
                }
                Scheduler.KIND_HABIT -> {
                    val h = repo.habit(intent.getLongExtra(Scheduler.EXTRA_HABIT, -1)) ?: return emptyList()
                    val a = AlertEngine.habitReminder(h, input) ?: return emptyList()
                    Notifier.post(ctx, a, app.broto.core.alerts.QuickActions.forHabit(h, input.logs[h.id]?.get(now.toLocalDate())), "reminder")
                    repo.recordAlert(a.key, a.category)
                    return listOf(a)
                }
                Scheduler.KIND_MOOD -> listOfNotNull(AlertEngine.moodReminder(input))
                Scheduler.KIND_CHECK -> AlertEngine.dailyCheck(input)
                Scheduler.KIND_STREAK -> {
                    val c = repo.consistency(now.toLocalDate())
                    listOfNotNull(AlertEngine.streakReminder(c.current, c.todayDone, input))
                }
                else -> emptyList()
            }
            for (a in alerts) {
                Notifier.post(ctx, a)
                repo.recordAlert(a.key, a.category)
            }
            return alerts
        }
    }
}

/** Reagenda tudo após reiniciar o aparelho, trocar horário/fuso ou atualizar o app. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        try { Scheduler.rescheduleAll(context.applicationContext) } catch (_: Exception) {}
    }
}
