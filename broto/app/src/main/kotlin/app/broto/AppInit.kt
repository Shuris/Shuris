package app.broto

import android.os.Build
import app.broto.notify.Notifier
import app.broto.notify.Scheduler
import java.time.LocalDate

/** Tarefas de inicialização: score recente, notificações, snapshot automático e bloqueio. */
object AppInit {
    fun onAppStart(act: MainActivity) {
        val repo = act.repo
        try { repo.recomputeScoresFrom(LocalDate.now().minusDays(7)) } catch (_: Exception) {}
        try { Notifier.ensureChannels(act); Scheduler.rescheduleAll(act) } catch (_: Exception) {}
    }

    fun onResume(act: MainActivity) {}

    /** Pede a permissão de notificações (Android 13+) uma única vez, depois das boas-vindas. */
    fun maybeAskNotificationPermission(act: MainActivity) {
        if (Build.VERSION.SDK_INT < 33) return
        val prefs = act.getSharedPreferences("broto_ui", 0)
        if (prefs.getBoolean("asked_notif", false)) return
        if (act.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED) return
        prefs.edit().putBoolean("asked_notif", true).apply()
        act.requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 7)
    }
}
