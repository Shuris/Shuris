package app.broto.notify

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import app.broto.core.model.Frequency
import app.broto.core.schedule.Schedule
import app.broto.data.Repo
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * Agenda os alarmes locais (funcionam com o app fechado):
 *  - lembrete de cada hábito com horário definido (só em dias programados);
 *  - lembrete diário de humor;
 *  - verificação diária de padrões (alertas inteligentes);
 *  - lembrete de consistência à noite.
 * Após disparar, cada alarme é reagendado para a próxima ocorrência.
 */
object Scheduler {
    const val ACTION = "app.broto.ALARM"
    const val EXTRA_KIND = "kind"
    const val EXTRA_HABIT = "habit"
    const val KIND_HABIT = "habit"; const val KIND_MOOD = "mood"; const val KIND_CHECK = "check"; const val KIND_STREAK = "streak"
    const val KIND_CHECKIN = "checkin"
    const val EXTRA_SLOT = "slot"
    private const val PREFS = "broto_alarms"

    fun canExact(ctx: Context): Boolean {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return false
        return Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()
    }

    private fun pi(ctx: Context, code: Int, kind: String, habitId: Long = 0, slot: Int = 0): PendingIntent {
        val i = Intent(ctx, AlarmReceiver::class.java).setAction(ACTION).putExtra(EXTRA_KIND, kind).putExtra(EXTRA_HABIT, habitId).putExtra(EXTRA_SLOT, slot)
        return PendingIntent.getBroadcast(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun set(ctx: Context, at: LocalDateTime, p: PendingIntent) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val ms = at.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        try {
            if (canExact(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ms, p)
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ms, p)
        } catch (e: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ms, p)
        }
    }

    /** Próximo horário (hoje ou depois) em que [minutes] cai num dia aceito por [accept]. */
    fun nextAt(now: LocalDateTime, minutes: Int, accept: (LocalDate) -> Boolean = { true }): LocalDateTime? {
        for (i in 0..14) {
            val d = now.toLocalDate().plusDays(i.toLong())
            val t = d.atStartOfDay().plusMinutes(minutes.toLong())
            if (t.isAfter(now.plusSeconds(5)) && accept(d)) return t
        }
        return null
    }

    fun rescheduleAll(ctx: Context) {
        val app = ctx.applicationContext
        val repo = Repo.get(app)
        val am = app.getSystemService(AlarmManager::class.java) ?: return
        val prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        // cancela lembretes de hábitos antigos
        val old = prefs.getStringSet("habits", emptySet()).orEmpty()
        for (id in old) am.cancel(pi(app, 10_000 + id.toInt(), KIND_HABIT, id.toLong()))
        // alarmes da versão anterior (humor/verificação/sequência separados) e notificações diárias
        for ((code, kind) in listOf(1 to KIND_MOOD, 2 to KIND_CHECK, 3 to KIND_STREAK)) am.cancel(pi(app, code, kind))
        for (i in 0 until 6) am.cancel(pi(app, 20 + i, KIND_CHECKIN, slot = i))
        val s = repo.settings
        if (!s.notificationsEnabled) { prefs.edit().putStringSet("habits", emptySet()).apply(); return }
        val now = LocalDateTime.now()
        val rest = repo.restDays()
        val scheduled = HashSet<String>()
        for (h in repo.habits()) {
            val m = h.reminderMinutes ?: continue
            if (h.paused || h.archived) continue
            val at = nextAt(now, m) { d -> if (h.isPositive) Schedule.isScheduled(h, d, rest) || Schedule.isVisibleOn(h, d) && h.frequency == Frequency.WEEKLY else Schedule.isActiveOn(h, d) && h.weekdays.contains(d.dayOfWeek) } ?: continue
            set(app, at, pi(app, 10_000 + h.id.toInt(), KIND_HABIT, h.id))
            scheduled.add(h.id.toString())
        }
        prefs.edit().putStringSet("habits", scheduled).apply()
        // Notificações diárias (manhã/tarde/noite por padrão). Humor, sequência e dicas de padrões vão dentro delas.
        s.checkInTimes.take(6).forEachIndexed { i, m -> nextAt(now, m)?.let { set(app, it, pi(app, 20 + i, KIND_CHECKIN, slot = i)) } }
    }
}
