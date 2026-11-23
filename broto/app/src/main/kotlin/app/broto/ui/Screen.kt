package app.broto.ui

import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import app.broto.MainActivity
import app.broto.data.Repo

/** Uma tela. Reconstrói a própria UI quando os dados mudam (os volumes são pequenos). */
abstract class Screen(val act: MainActivity) {
    val repo: Repo get() = act.repo
    val container = FrameLayout(act)
    private var scroll: ScrollView? = null
    var visible = false
    private var dirty = true

    abstract fun build(): View

    open fun onShow() {}
    open fun onBack(): Boolean = false

    fun render() {
        val y = scroll?.scrollY ?: 0
        container.removeAllViews()
        val v = build()
        container.addView(v, FrameLayout.LayoutParams(MATCH, MATCH))
        scroll = findScroll(v)
        if (y > 0) scroll?.post { scroll?.scrollTo(0, y) }
        dirty = false
    }

    fun invalidate() { if (visible) render() else dirty = true }
    fun renderIfDirty() { if (dirty) render() }

    private fun findScroll(v: View): ScrollView? {
        if (v is ScrollView) return v
        if (v is ViewGroup) for (i in 0 until v.childCount) findScroll(v.getChildAt(i))?.let { return it }
        return null
    }

    /** Margem lateral: 20dp no celular; em telas largas o conteúdo fica centralizado com largura máxima. */
    fun side(): Int = maxOf(20, (act.resources.configuration.screenWidthDp - 680) / 2)
    val narrow: Boolean get() = act.resources.configuration.screenWidthDp < 360

    // ------------------------------------------------------------------ Estrutura padrão de página
    /** Página com barra superior (voltar + título + ações) e conteúdo rolável. */
    fun page(title: String, subtitle: String? = null, back: Boolean = true, bg: Int = Theme.p.bg,
             actions: (LinearLayout.() -> Unit)? = null, content: LinearLayout.() -> Unit): View {
        val root = LinearLayout(act).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(bg) }
        root.horizontal {
            pad(if (back) side() - 12 else side(), 10, side() - 8, 6); minimumHeight = dp(60)
            if (back) iconButton(Icon.BACK, Theme.p.text) { act.back() }
            vertical {
                lp(0, WRAP, 1f, l = if (back) 4 else 0)
                text(title, TextStyle.TITLE).ellipsize()
                if (subtitle != null) text(subtitle, TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 2)
            }
            actions?.invoke(this)
        }
        val body = act.verticalLayout { pad(side(), 6, side(), 32) }
        body.content()
        root.addView(act.scrollContainer(body, bg), LinearLayout.LayoutParams(MATCH, 0, 1f))
        return root
    }

    /** Conteúdo rolável sem barra superior (abas principais). */
    fun scrollPage(bg: Int = Theme.p.bg, content: LinearLayout.() -> Unit): View {
        val body = act.verticalLayout { pad(side(), 14, side(), 28) }
        body.content()
        return act.scrollContainer(body, bg)
    }
}

/** Barra de navegação inferior com 5 abas. */
class BottomNav(private val act: MainActivity, private val onSelect: (Int) -> Unit) : LinearLayout(act) {
    data class Item(val icon: Icon, val label: String)
    val items = listOf(Item(Icon.HOME, "Início"), Item(Icon.HABITS, "Hábitos"), Item(Icon.MOOD, "Humor"), Item(Icon.JOURNAL, "Diário"), Item(Icon.CHART, "Análises"))
    private val pills = ArrayList<FrameLayout>()
    private val icons = ArrayList<IconDrawable>()
    private val labels = ArrayList<android.widget.TextView>()
    var selected = 0; private set

    init {
        orientation = HORIZONTAL
        setBackgroundColor(Theme.p.surface)
        elevation = dpf(8)
        pad(6, 6, 6, 8)
        items.forEachIndexed { i, it ->
            val col = LinearLayout(act).apply { orientation = VERTICAL; gravity = Gravity.CENTER_HORIZONTAL; pad(0, 4) }
            val pill = FrameLayout(act)
            val d = IconDrawable(it.icon, Theme.p.textSoft, dp(24))
            val iv = android.widget.ImageView(act); iv.setImageDrawable(d)
            pill.addView(iv, FrameLayout.LayoutParams(dp(24), dp(24), Gravity.CENTER))
            col.addView(pill, LayoutParams(dp(60), dp(32)))
            val l = col.text(it.label, TextStyle.TINY, Theme.p.textSoft).lp(WRAP, WRAP, t = 3)
            col.layoutParams = LayoutParams(0, WRAP, 1f)
            col.ripple(dpf(20), mask = true)
            col.contentDescription = it.label
            col.onClick { onSelect(i) }
            addView(col)
            pills.add(pill); icons.add(d); labels.add(l)
        }
        select(0, false)
    }

    fun select(i: Int, animate: Boolean = true) {
        selected = i
        pills.forEachIndexed { j, p ->
            val on = i == j
            p.background = if (on) rounded(Theme.p.primarySoft, dpf(16)) else null
            icons[j].color = if (on) Theme.p.deep else Theme.p.textSoft; icons[j].invalidateSelf()
            labels[j].setTextColor(if (on) Theme.p.text else Theme.p.textSoft)
            labels[j].typeface = if (on) Fonts.bold else Fonts.semibold
            if (on && animate) p.pop()
        }
    }
}
