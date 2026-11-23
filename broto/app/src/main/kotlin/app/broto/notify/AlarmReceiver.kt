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

        fun handle(ctx: Context, intent: Intent, now: LocalDateTime = LocalDateTime.now()): List<Alert> {
            val repo = Repo.get(ctx)
            if (!repo.settings.notificationsEnabled) return emptyList()
            val input = buildInput(repo, now)
            val alerts: List<Alert> = when (intent.getStringExtra(Scheduler.EXTRA_KIND)) {
                Scheduler.KIND_HABIT -> {
                    val h = repo.habit(intent.getLongExtra(Scheduler.EXTRA_HABIT, -1)) ?: return emptyList()
                    listOfNotNull(AlertEngine.habitReminder(h, input))
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
