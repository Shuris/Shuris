package app.broto

import android.os.Build
import app.broto.data.Backup
import app.broto.notify.Notifier
import app.broto.notify.Scheduler
import app.broto.ui.*
import java.time.LocalDate

/** Inicialização: score recente, notificações, verificação de integridade e cópia automática diária. */
object AppInit {
    fun onAppStart(act: MainActivity) {
        val repo = act.repo
        try { repo.recomputeScoresFrom(LocalDate.now().minusDays(7)) } catch (_: Exception) {}
        try { Notifier.ensureChannels(act); Scheduler.rescheduleAll(act) } catch (_: Exception) {}
        if (!Backup.integrityOk(repo)) {
            act.window.decorView.post { offerRecovery(act) }
            return
        }
        Thread { try { Backup.autoSnapshot(act.applicationContext, repo) } catch (_: Exception) {} }.start()
    }

    private fun offerRecovery(act: MainActivity) {
        val snap = Backup.snapshots(act).firstOrNull()
        val s = BottomSheet(act)
        s.title("Encontramos um problema nos dados", "O banco de dados pode estar danificado." + if (snap != null) " Você pode restaurar a cópia automática mais recente." else " Restaure um backup em Ajustes › Backup.")
        if (snap != null) s.content.primaryButton("Restaurar cópia automática") {
            try { Backup.restore(act.repo, snap.readText()); act.snack("Dados restaurados.") } catch (e: Exception) { act.snack(e.message ?: "Falha ao restaurar.") }
            s.dismiss()
        }
        s.content.ghostButton("Agora não", Theme.p.textSoft) { s.dismiss() }
        s.show()
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
