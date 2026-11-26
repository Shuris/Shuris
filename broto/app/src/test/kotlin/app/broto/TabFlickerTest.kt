package app.broto

import android.view.View
import android.view.ViewGroup
import app.broto.data.DemoData
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLooper
import java.time.LocalDate

/** Diagnóstico: mede o estado visual logo após cada troca de aba (antes de qualquer animação avançar). */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w400dp-h860dp-xhdpi")
class TabFlickerTest {
    private fun all(v: View, out: MutableList<View> = ArrayList()): List<View> { out.add(v); if (v is ViewGroup) for (i in 0 until v.childCount) all(v.getChildAt(i), out); return out }

    /** Problemas visíveis no primeiro quadro após a troca. */
    private fun frameProblems(a: MainActivity, tab: Int): List<String> {
        val p = ArrayList<String>()
        a.tabs.forEachIndexed { i, s ->
            val shown = s.container.visibility == View.VISIBLE
            if (i == tab && !shown) p.add("aba $i não visível")
            if (i != tab && shown) p.add("aba $i visível junto (sobreposição)")
        }
        val c = a.tabs[tab].container
        if (c.alpha < 1f) p.add("container com alpha ${c.alpha}")
        if (c.childCount == 0) p.add("container vazio")
        val anyFaded = all(c).count { it.isShown && it.alpha < 0.99f && it.translationY != 0f }
        if (anyFaded > 0) p.add("$anyFaded views ainda surgindo (alpha+deslocamento)")
        if (a.nav.selected != tab) p.add("aba selecionada dessincronizada")
        return p
    }

    @Test fun rapidAndSlowToggling() {
        val repo = TestRepo.fresh(); repo.settings.onboarded = true
        DemoData.generate(repo)
        val a = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        for (i in 0..4) { a.switchTab(i); ShadowLooper.idleMainLooper(2, java.util.concurrent.TimeUnit.SECONDS) } // primeira visita
        a.switchTab(0); ShadowLooper.idleMainLooper(2, java.util.concurrent.TimeUnit.SECONDS)
        val report = StringBuilder()
        var problems = 0
        val pairs = (0..4).flatMap { x -> (x + 1..4).map { y -> x to y } }   // os 10 pares possíveis
        for ((x, y) in pairs) for (speed in listOf("rápido", "lento")) {
            val rendersBefore = a.tabs.map { it.renderCount }
            var maxMs = 0.0
            val times = ArrayList<Double>()
            for (n in 0 until 30) {
                val t = if (n % 2 == 0) y else x
                if (n == 10) { val h = repo.habits().first(); repo.setLog(h.id, LocalDate.now(), 1.0) }   // mudança de dados no meio
                if (n == 20) { val h = repo.habits().first(); repo.clearLog(h.id, LocalDate.now()) }
                val t0 = System.nanoTime()
                val anim0 = app.broto.ui.Motion.started
                a.switchTab(t)
                val anims = app.broto.ui.Motion.started - anim0
                val ms = (System.nanoTime() - t0) / 1e6; times.add(ms)
                maxMs = maxOf(maxMs, ms)
                val pr = frameProblems(a, t) + (if (anims > 0) listOf("$anims animações de entrada disparadas") else emptyList())
                if (pr.isNotEmpty()) { problems++; if (problems <= 12) report.append("  $x↔$y ($speed) clique ${n + 1}: ${pr.joinToString("; ")}\n") }
                ShadowLooper.idleMainLooper(if (speed == "rápido") 40 else 700, java.util.concurrent.TimeUnit.MILLISECONDS)
            }
            val renders = a.tabs.mapIndexed { i, s -> s.renderCount - rendersBefore[i] }
            report.append("$x↔$y ($speed): renders por aba=$renders, troca mediana=${"%.1f".format(times.sorted()[times.size / 2])} ms, mais lenta=${"%.0f".format(maxMs)} ms (com re-render após mudança de dados)\n")
        }
        // ciclo rápido por todas as abas
        repeat(6) { for (t in listOf(0, 1, 2, 3, 4, 3, 2, 1)) {
            a.switchTab(t); val pr = frameProblems(a, t); if (pr.isNotEmpty()) { problems++; report.append("  ciclo aba $t: ${pr.joinToString()}\n") }
            ShadowLooper.idleMainLooper(16, java.util.concurrent.TimeUnit.MILLISECONDS)
        } }
        val errors = org.robolectric.shadows.ShadowLog.getLogs().filter { it.type >= android.util.Log.ERROR || it.throwable != null }
        report.append("erros no log: ${errors.size}${errors.take(5).joinToString("") { "\n  ${it.tag}: ${it.msg}" }}\n")
        problems += errors.size
        println("=== RELATÓRIO DE FLICKER ===\nquadros com problema: $problems\n$report")
        kotlin.test.assertEquals(0, problems, report.toString())
    }
}
