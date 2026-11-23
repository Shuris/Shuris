package app.broto

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import app.broto.data.Repo
import app.broto.screens.*
import app.broto.ui.*
import java.time.LocalDate

class MainActivity : Activity() {
    lateinit var repo: Repo
    private lateinit var root: FrameLayout
    private lateinit var tabHost: FrameLayout
    private lateinit var overlay: FrameLayout
    private lateinit var snackHost: FrameLayout
    lateinit var nav: BottomNav
    lateinit var tabs: List<Screen>
    private val stack = ArrayList<Screen>()
    private var currentTab = 0
    private var renderedDay: LocalDate = LocalDate.now()
    private val listener: () -> Unit = { onDataChanged() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        repo = Repo.get(this)
        Fonts.load(this)
        Theme.apply(this, repo.settings.theme, repo.settings.accent)
        setTheme(resources.getIdentifier(if (Theme.p.dark) "Theme.Broto.Dark" else "Theme.Broto", "style", packageName))
        styleWindow()
        buildLayout()
        repo.addListener(listener)
        AppInit.onAppStart(this)
        if (!repo.settings.onboarded) push(WelcomeScreen(this), animate = false)
        handleIntent(intent)
        if (savedInstanceState != null) switchTab(savedInstanceState.getInt("tab", 0), false)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putInt("tab", currentTab)
    }

    private fun styleWindow() {
        window.statusBarColor = Theme.p.bg
        window.navigationBarColor = Theme.p.surface
        var flags = 0
        if (!Theme.p.dark) {
            flags = flags or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
            if (Build.VERSION.SDK_INT >= 27) flags = flags or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        }
        window.decorView.systemUiVisibility = flags
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        window.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(Theme.p.bg))
    }

    private fun buildLayout() {
        root = FrameLayout(this)
        val main = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        tabHost = FrameLayout(this)
        main.addView(tabHost, LinearLayout.LayoutParams(MATCH, 0, 1f))
        nav = BottomNav(this) { switchTab(it) }
        main.addView(nav, LinearLayout.LayoutParams(MATCH, WRAP))
        root.addView(main, FrameLayout.LayoutParams(MATCH, MATCH))
        overlay = FrameLayout(this)
        root.addView(overlay, FrameLayout.LayoutParams(MATCH, MATCH))
        snackHost = FrameLayout(this)
        root.addView(snackHost, FrameLayout.LayoutParams(MATCH, WRAP, Gravity.BOTTOM))
        setContentView(root)

        tabs = listOf(HomeScreen(this), HabitsScreen(this), MoodScreen(this), JournalScreen(this), AnalysesScreen(this))
        for (t in tabs) { tabHost.addView(t.container, FrameLayout.LayoutParams(MATCH, MATCH)); t.container.visibility = View.GONE }
        switchTab(0, false)
    }

    fun switchTab(i: Int, animate: Boolean = true) {
        while (stack.isNotEmpty()) popTop(false)
        val old = tabs[currentTab]
        val new = tabs[i]
        if (old !== new) { old.visible = false; old.container.visibility = View.GONE }
        currentTab = i
        new.visible = true
        new.renderIfDirty()
        new.onShow()
        new.container.visibility = View.VISIBLE
        if (animate && old !== new) { new.container.alpha = 0f; new.container.animate().alpha(1f).setDuration(180).start() }
        nav.select(i, animate)
    }

    val currentScreen: Screen get() = stack.lastOrNull() ?: tabs[currentTab]

    fun push(s: Screen, animate: Boolean = true) {
        currentScreen.visible = false
        stack.add(s)
        s.visible = true
        s.render()
        s.container.setBackgroundColor(Theme.p.bg)
        s.container.isClickable = true
        overlay.addView(s.container, FrameLayout.LayoutParams(MATCH, MATCH))
        s.onShow()
        if (animate) {
            s.container.translationX = resources.displayMetrics.widthPixels * 0.25f
            s.container.alpha = 0f
            s.container.animate().translationX(0f).alpha(1f).setDuration(240).setInterpolator(DecelerateInterpolator(1.5f)).start()
        }
    }

    private fun popTop(animate: Boolean) {
        val s = stack.removeLastOrNull() ?: return
        s.visible = false
        if (animate) {
            s.container.animate().translationX(resources.displayMetrics.widthPixels * 0.25f).alpha(0f).setDuration(200)
                .withEndAction { overlay.removeView(s.container) }.start()
        } else overlay.removeView(s.container)
        val top = currentScreen
        top.visible = true
        top.renderIfDirty()
        top.onShow()
    }

    fun back() {
        if (currentScreen.onBack()) return
        if (stack.isNotEmpty()) { popTop(true); return }
        if (currentTab != 0) { switchTab(0); return }
        finish()
    }

    /** Fecha a tela atual e abre outra (ex.: editor -> detalhe). */
    fun replace(s: Screen) { popTop(false); push(s, false) }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() = back()

    private fun onDataChanged() {
        tabs.forEach { it.invalidate() }
        stack.forEach { it.invalidate() }
    }

    override fun onResume() {
        super.onResume()
        val today = LocalDate.now()
        if (today != renderedDay) { renderedDay = today; onDataChanged() }
        AppInit.onResume(this)
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); handleIntent(intent) }

    private fun handleIntent(i: Intent?) {
        val target = i?.getStringExtra(EXTRA_TARGET) ?: return
        i.removeExtra(EXTRA_TARGET)
        navigateTo(target)
    }

    fun navigateTo(target: String) {
        when {
            target == "habits" -> switchTab(1, false)
            target == "mood" -> { switchTab(2, false); push(MoodEditorScreen(this, LocalDate.now())) }
            target.startsWith("habit:") -> {
                switchTab(1, false)
                target.removePrefix("habit:").toLongOrNull()?.let { id -> if (repo.habit(id) != null) push(HabitDetailScreen(this, id)) }
            }
            target == "journal" -> switchTab(3, false)
            target == "analyses" -> switchTab(4, false)
            else -> switchTab(0, false)
        }
    }

    override fun onDestroy() { repo.removeListener(listener); super.onDestroy() }

    /** Mensagem curta na parte inferior, com ação opcional (ex.: desfazer). */
    fun snack(msg: String, action: String? = null, onAction: (() -> Unit)? = null) {
        snackHost.removeAllViews()
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            background = rounded(if (Theme.p.dark) 0xFFE9F0E5.toInt() else 0xFF23332A.toInt(), dpf(18))
            pad(18, 12); elevation = dpf(6)
        }
        val fg = if (Theme.p.dark) 0xFF1C241F.toInt() else 0xFFFFFFFF.toInt()
        bar.addView(TextView(this).apply { text = msg; style(TextStyle.BODY, fg) }, LinearLayout.LayoutParams(0, WRAP, 1f))
        if (action != null) bar.text(action, TextStyle.BODY_BOLD, Theme.p.primary) { pad(12, 4); onClick { snackHost.removeAllViews(); onAction?.invoke() } }
        snackHost.addView(bar, FrameLayout.LayoutParams(MATCH, WRAP).apply { setMargins(dp(16), 0, dp(16), dp(88)) })
        bar.alpha = 0f; bar.translationY = dpf(20)
        bar.animate().alpha(1f).translationY(0f).setDuration(200).start()
        bar.postDelayed({ if (bar.parent != null) bar.animate().alpha(0f).setDuration(200).withEndAction { snackHost.removeView(bar) }.start() }, if (action != null) 4500 else 2600)
    }

    fun restartForTheme() {
        Theme.apply(this, repo.settings.theme, repo.settings.accent)
        recreate()
    }

    companion object {
        const val EXTRA_TARGET = "target"
    }
}
