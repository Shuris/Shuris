package app.broto.notify

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import app.broto.core.alerts.QuickAction
import app.broto.core.model.Mood
import app.broto.core.model.MoodEntry
import app.broto.data.Repo
import java.time.LocalDate

/**
 * Executa as ações tocadas diretamente na notificação (marcar hábito, registrar humor)
 * sem abrir o app, e atualiza a notificação com o que ainda falta.
 */
class ActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        try { handle(context.applicationContext, intent) } catch (_: Exception) {}
    }

    companion object {
        const val ACTION_LOG = "app.broto.ACTION_LOG"
        const val ACTION_MOOD = "app.broto.ACTION_MOOD"

        fun logIntent(ctx: Context, a: QuickAction, notifId: Int, origin: String, index: Int): PendingIntent {
            val i = Intent(ctx, ActionReceiver::class.java).setAction(ACTION_LOG)
                .putExtra("habit", a.habitId).putExtra("mode", a.mode.name).putExtra("amount", a.amount)
                .putExtra("notif", notifId).putExtra("origin", origin).putExtra("day", LocalDate.now().toEpochDay())
            return PendingIntent.getBroadcast(ctx, notifId * 8 + index, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        fun moodIntent(ctx: Context, level: Int, notifId: Int, slot: Int): PendingIntent {
            val i = Intent(ctx, ActionReceiver::class.java).setAction(ACTION_MOOD)
                .putExtra("level", level).putExtra("notif", notifId).putExtra("origin", "checkin:$slot").putExtra("day", LocalDate.now().toEpochDay())
            return PendingIntent.getBroadcast(ctx, notifId * 8 + 3 + level, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        fun handle(ctx: Context, intent: Intent) {
            val repo = Repo.get(ctx)
            // A ação vale para o dia em que a notificação foi criada (tocar depois da meia-noite não registra no dia errado).
            val day = LocalDate.ofEpochDay(intent.getLongExtra("day", LocalDate.now().toEpochDay()))
            val notif = intent.getIntExtra("notif", 0)
            val origin = intent.getStringExtra("origin") ?: ""
            var message: Pair<String, String>? = null
            when (intent.action) {
                ACTION_LOG -> {
                    val h = repo.habit(intent.getLongExtra("habit", -1)) ?: return
                    val amount = intent.getDoubleExtra("amount", 1.0)
                    val current = repo.logsForDay(day)[h.id]?.value ?: 0.0
                    val v = if (intent.getStringExtra("mode") == QuickAction.Mode.ADD.name) current + amount else amount
                    repo.setLog(h.id, day, v)
                    message = Pair("${h.emoji} ${h.name}", if (h.isNegative && v <= 0) "Registrado: não aconteceu 🌿" else "Registrado ✓")
                }
                ACTION_MOOD -> {
                    val lvl = intent.getIntExtra("level", 3).coerceIn(1, 5)
                    val old = repo.mood(day)
                    repo.saveMood(old?.copy(mood = lvl) ?: MoodEntry(day, lvl))
                    message = Pair("Humor registrado: ${Mood.of(lvl).label}", "Toque para adicionar emoções e um relato.")
                }
            }
            // Atualiza a notificação de origem
            if (origin.startsWith("checkin:") && day == LocalDate.now()) {
                val slot = origin.removePrefix("checkin:").toIntOrNull() ?: 0
                val c = AlarmReceiver.buildCheckIn(ctx, repo, slot, record = false)
                if (c != null) {
                    Notifier.postCheckIn(ctx, if (intent.action == ACTION_MOOD) c.copy(text = "✓ ${message!!.first}\n" + c.text) else c, slot, update = true)
                    return
                }
            }
            message?.let { Notifier.confirm(ctx, notif, it.first, it.second, if (intent.action == ACTION_MOOD) "mood" else "habits") }
        }
    }
}
