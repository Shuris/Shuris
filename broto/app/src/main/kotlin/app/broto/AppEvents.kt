package app.broto

import android.view.Gravity
import android.widget.LinearLayout
import app.broto.core.streak.FlameLevel
import app.broto.ui.*

/** Reações a eventos do usuário (ex.: celebrar uma nova conquista de sequência). */
object AppEvents {
    private val milestones = listOf(3, 7, 14, 30, 50, 100, 150, 200, 365)

    fun afterCheckIn(act: MainActivity) {
        val repo = act.repo
        val c = repo.consistency()
        val last = repo.settings.lastCelebratedStreak
        if (c.current < last) { if (c.current == 0) repo.settings.lastCelebratedStreak = 0; return }
        val reached = milestones.lastOrNull { c.current >= it && last < it } ?: return
        repo.settings.lastCelebratedStreak = reached
        celebrate(act, reached)
    }

    fun celebrate(act: MainActivity, days: Int) {
        val s = BottomSheet(act)
        val lvl = FlameLevel.of(days)
        s.content.gravity = Gravity.CENTER_HORIZONTAL
        val fv = FlameView(act, lvl)
        s.content.addView(fv, LinearLayout.LayoutParams(act.dp(150), act.dp(150)).apply { gravity = Gravity.CENTER_HORIZONTAL; topMargin = act.dp(12) })
        fv.scaleX = 0.3f; fv.scaleY = 0.3f
        fv.animate().scaleX(1f).scaleY(1f).setDuration(700).setInterpolator(android.view.animation.OvershootInterpolator(2.2f)).start()
        s.content.text("$days dias de consistência!", TextStyle.TITLE) { gravity = Gravity.CENTER }.lp(MATCH, WRAP, t = 8)
        s.content.text("${lvl.label} conquistada. O mais importante é continuar se acompanhando com carinho — não a perfeição. 💚",
            TextStyle.BODY, Theme.p.textSoft) { gravity = Gravity.CENTER }.lp(MATCH, WRAP, t = 8, b = 14)
        s.content.primaryButton("Obrigado! 🌱") { s.dismiss() }
        s.show()
    }
}
