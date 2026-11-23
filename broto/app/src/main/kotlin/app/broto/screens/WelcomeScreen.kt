package app.broto.screens

import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import app.broto.MainActivity
import app.broto.data.DemoData
import app.broto.ui.*

/** Primeira abertura: nome e explicação curta. Nenhuma conta é necessária. */
class WelcomeScreen(act: MainActivity) : Screen(act) {
    private var name = ""

    override fun onBack(): Boolean { finish(); return true }

    private fun finish() {
        repo.settings.userName = name
        repo.settings.onboarded = true
        act.pop()
        app.broto.AppInit.maybeAskNotificationPermission(act)
    }

    override fun build(): View = scrollPage(Theme.p.bg) {
        gravity = Gravity.CENTER_HORIZONTAL
        drawing(-1, 210) { c, w, h ->
            val sz = dpf(150)
            Decor.sprig(c, w / 2f - dpf(110), h.toFloat(), dpf(90), Theme.alpha(Theme.p.primary, 0.6f), -20f, true)
            Decor.sprig(c, w / 2f + dpf(110), h.toFloat(), dpf(80), Theme.alpha(Theme.p.primaryDark, 0.35f), 20f)
            Decor.flower(c, w / 2f + dpf(90), dpf(40), dpf(6), Theme.p.yellow, 0xFFFFFFFF.toInt())
            Decor.flower(c, w / 2f - dpf(100), dpf(70), dpf(4.5f), 0xFFFFB4C6.toInt(), 0xFFFFFFFF.toInt())
            MoodArt.draw(c, 5, (w - sz) / 2f, h - sz - dpf(10), sz)
        }
        text("Olá! Eu sou o Broto 🌱", TextStyle.DISPLAY) { gravity = Gravity.CENTER }.lp(MATCH, WRAP, t = 8)
        text("Seu cantinho para acompanhar hábitos, humor, diário e objetivos — e descobrir, com carinho, como você evolui.",
            TextStyle.BODY, Theme.p.textSoft) { gravity = Gravity.CENTER }.lp(MATCH, WRAP, t = 10, b = 20)
        card {
            for ((e, t) in listOf("🔒" to "Tudo fica só no seu aparelho. Sem conta, sem envio de dados.", "🌿" to "Registros rápidos: marque hábitos e humor em segundos.",
                "📊" to "Score, descobertas e relatórios em PDF para se conhecer melhor.")) {
                horizontal {
                    lp(MATCH, WRAP, b = 10)
                    text(e, TextStyle.TITLE)
                    text(t, TextStyle.BODY).lp(0, WRAP, 1f, l = 12)
                }
            }
        }
        card {
            text("Como podemos te chamar?", TextStyle.SUBTITLE)
            val f = field("Seu nome ou apelido (opcional)", name)
            f.addTextChangedListener(watcher { name = it })
        }
        primaryButton("Começar", Icon.CHECK) { finish() }
        ghostButton("Explorar com dados de demonstração", Theme.p.textSoft) {
            DemoData.generate(repo)
            finish()
            act.snack("Dados de demonstração criados. Remova em Ajustes › Dados.")
        }
    }
}
