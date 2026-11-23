package app.broto.screens

import android.view.Gravity
import android.widget.LinearLayout
import app.broto.MainActivity
import app.broto.core.score.Component
import app.broto.core.score.DayScore
import app.broto.ui.*
import kotlin.math.roundToInt

/** Explicação transparente do score do dia. */
object ScoreSheet {
    fun show(act: MainActivity, s: DayScore) {
        val sheet = BottomSheet(act)
        val c = sheet.content
        sheet.title("Seu score de ${Fmt.relative(s.day).lowercase()}", "Um retrato do dia para autoconhecimento — não um julgamento.")
        c.horizontal {
            gravity = Gravity.CENTER_VERTICAL
            val ring = RingView(act, (s.score ?: 0) / 100f, Theme.p.primaryDark, Theme.p.surfaceAlt, 10f)
            ring.centerText = s.score?.toString() ?: "–"; ring.subText = "de 100"
            addView(ring, LinearLayout.LayoutParams(dp(100), dp(100)))
            text(HomeScreen.scoreTitle(s.score), TextStyle.HEADLINE).lp(0, WRAP, 1f, l = 16)
        }
        c.space(10)
        val colors = mapOf(Component.POSITIVE to Theme.p.primaryDark, Component.NEGATIVE to Theme.p.coral, Component.WELLBEING to Theme.p.yellow)
        for (comp in s.components) {
            val pts = s.points(comp.component)
            c.card(padding = 14) {
                horizontal {
                    text(comp.component.label, TextStyle.BODY_BOLD).lp(0, WRAP, 1f)
                    text(if (pts == null) "não avaliado" else "${pts.first.roundToInt()} / ${pts.second.roundToInt()} pts", TextStyle.LABEL, Theme.p.textSoft)
                }
                if (pts != null) progressBar((pts.first / pts.second).toFloat(), colors[comp.component]!!, 8).lp(MATCH, dp(8), t = 8, b = 4)
                text(if (pts == null) when (comp.component) {
                    Component.POSITIVE -> "Nenhum hábito positivo programado — sem penalidade."
                    Component.NEGATIVE -> "Nenhum hábito negativo registrado — informação ausente não conta como resultado."
                    Component.WELLBEING -> "Humor não registrado — não é tratado como humor ruim."
                } else comp.note, TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 4)
                for (hc in comp.habits) {
                    horizontal {
                        lp(MATCH, WRAP, t = 6)
                        text("${hc.habit.emoji} ${hc.habit.name}" + (if (hc.bonus) " (extra)" else "") + (if (hc.unlogged) " · sem registro" else ""), TextStyle.CAPTION).lp(0, WRAP, 1f)
                        text(Fmt.pct(hc.value), TextStyle.LABEL, if (hc.value >= 0.999) Theme.p.primaryDark else Theme.p.textSoft)
                    }
                }
            }
        }
        val w = act.repo.settings.weights
        c.text("Pesos atuais: hábitos positivos ${w.positive.roundToInt()}%, controle dos negativos ${w.negative.roundToInt()}%, bem-estar ${w.wellbeing.roundToInt()}%. Quando um componente não tem registros, os outros são reescalados para somar 100.",
            TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 4, b = 8)
        c.softButton("Ajustar pesos do score", Icon.SETTINGS) { sheet.dismiss(); act.push(ScoreSettingsScreen(act)) }
        sheet.show()
    }
}
