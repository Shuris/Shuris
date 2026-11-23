package app.broto

import java.time.LocalDate

/** Tarefas de inicialização: score do dia, notificações, snapshot automático e bloqueio. */
object AppInit {
    fun onAppStart(act: MainActivity) {
        val repo = act.repo
        try { repo.recomputeScoresFrom(LocalDate.now().minusDays(7)) } catch (_: Exception) {}
    }

    fun onResume(act: MainActivity) {}
}
