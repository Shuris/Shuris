package app.broto.screens

import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import app.broto.MainActivity
import app.broto.screentime.ScreenTime
import app.broto.ui.*

/** Escolha dos apps cujo tempo de uso será medido para um hábito. */
object AppPicker {
    fun show(act: MainActivity, selected: Set<String>, onDone: (Set<String>) -> Unit) {
        val apps = ScreenTime.launchableApps(act)
        val sel = LinkedHashSet(selected)
        val s = BottomSheet(act)
        s.title("Quais apps medir?", "O tempo em primeiro plano desses apps é somado todos os dias.")
        var query = ""
        val list = LinearLayout(act).apply { orientation = LinearLayout.VERTICAL }
        fun fill() {
            list.removeAllViews()
            val shown = apps.filter { query.isBlank() || it.label.contains(query, true) }
            if (shown.isEmpty()) list.text("Nenhum app encontrado.", TextStyle.BODY, Theme.p.textSoft).lp(WRAP, WRAP, t = 8)
            for (a in shown) {
                list.horizontal {
                    pad(4, 4); minimumHeight = dp(56)
                    val iv = ImageView(act); iv.setImageDrawable(a.icon); addView(iv, LinearLayout.LayoutParams(dp(36), dp(36)))
                    vertical { lp(0, WRAP, 1f, l = 12)
                        text(a.label, TextStyle.BODY_BOLD).ellipsize()
                        if (a.isGame || a.pkg in ScreenTime.SOCIAL) text(if (a.isGame) "Jogo" else "Rede social", TextStyle.TINY, Theme.p.textSoft)
                    }
                    addView(CheckView(act, if (a.pkg in sel) 2 else 0).apply { layoutParams = LinearLayout.LayoutParams(dp(40), dp(40)) })
                    contentDescription = a.label + if (a.pkg in sel) ", selecionado" else ""
                    ripple(dpf(12))
                    onClick { it.haptic(); if (a.pkg in sel) sel.remove(a.pkg) else sel.add(a.pkg); fill() }
                }
            }
        }
        val f = s.content.field("Buscar app…", "")
        f.addTextChangedListener(watcher { query = it; fill() })
        s.content.flow {
            addView(Chip(act, "📱 Redes sociais", false).apply { onClick { sel.addAll(apps.filter { it.pkg in ScreenTime.SOCIAL }.map { it.pkg }); fill() } })
            addView(Chip(act, "🎮 Jogos", false).apply { onClick { sel.addAll(apps.filter { it.isGame }.map { it.pkg }); fill() } })
            addView(Chip(act, "Limpar", false).apply { onClick { sel.clear(); fill() } })
        }
        s.content.addView(list, LinearLayout.LayoutParams(MATCH, WRAP))
        fill()
        s.content.primaryButton("Concluir") { s.dismiss(); onDone(sel) }
        s.show()
    }
}
