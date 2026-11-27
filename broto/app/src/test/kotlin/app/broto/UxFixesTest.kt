package app.broto

import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import app.broto.core.model.*
import app.broto.screens.*
import app.broto.ui.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowDialog
import java.time.LocalDate
import kotlin.test.*

/** Regressões dos problemas de usabilidade relatados. Toques simulados na posição real dos elementos. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w400dp-h860dp-xhdpi")
class UxFixesTest {
    private fun all(v: View, out: MutableList<View> = ArrayList()): List<View> { out.add(v); if (v is ViewGroup) for (i in 0 until v.childCount) all(v.getChildAt(i), out); return out }
    private fun launch(): MainActivity { val r = TestRepo.fresh(); r.settings.onboarded = true; return Robolectric.buildActivity(MainActivity::class.java).setup().get() }
    private fun top(a: MainActivity): View = a.currentScreen.container
    private fun dialogShowing() = ShadowDialog.getLatestDialog()?.isShowing == true

    /** Toque real (down/up) no centro da view, despachado pela janela — como o dedo faria. */
    private fun tapCenter(a: MainActivity, v: View) {
        // rola até o elemento ficar visível (como uma pessoa faria antes de tocar)
        var anc: View? = v; var offY = 0
        while (anc != null && anc !is android.widget.ScrollView) { offY += anc.top; anc = anc.parent as? View }
        (anc as? android.widget.ScrollView)?.let { sv -> sv.scrollTo(0, (offY - sv.height / 3).coerceAtLeast(0)); Shots.idle(100) }
        val loc = IntArray(2); v.getLocationInWindow(loc)
        val x = loc[0] + v.width / 2f; val y = loc[1] + v.height / 2f
        val t = SystemClock.uptimeMillis()
        val root = v.rootView
        root.dispatchTouchEvent(MotionEvent.obtain(t, t, MotionEvent.ACTION_DOWN, x, y, 0))
        root.dispatchTouchEvent(MotionEvent.obtain(t, t + 50, MotionEvent.ACTION_UP, x, y, 0))
        Shots.idle(500)
    }

    @Test fun streakCriterionSelectableByTappingTheCircle() {
        val a = launch()
        a.push(ScoreSettingsScreen(a), false); Shots.idle()
        for (target in listOf(StreakCriterion.MOOD, StreakCriterion.MOOD_AND_HABIT, StreakCriterion.ANY_CHECKIN)) {
            val title = all(top(a)).filterIsInstance<TextView>().first { it.text == target.label }
            val row = title.parent.parent as ViewGroup
            val circle = all(row).first { it is CheckView }
            tapCenter(a, circle)
            assertEquals(target, a.repo.settings.streakCriterion, "toque no círculo de ${target.label}")
        }
    }

    @Test fun goalStepToggledByTappingTheCircle() {
        val a = launch()
        val id = a.repo.saveGoal(Goal(name = "Projeto", createdDay = LocalDate.now(), mode = GoalProgressMode.STEPS, steps = listOf(GoalStep(title = "Etapa A"), GoalStep(title = "Etapa B"))))
        a.push(GoalDetailScreen(a, id), false); Shots.idle()
        val circle = all(top(a)).filterIsInstance<CheckView>().first()
        tapCenter(a, circle)
        assertTrue(a.repo.goal(id)!!.steps[0].done)
    }

    @Test fun toggleRowsReactToTappingTheText() {
        val a = launch()
        a.push(NotificationSettingsScreen(a), false); Shots.idle()
        val label = all(top(a)).filterIsInstance<TextView>().first { it.text == app.broto.core.alerts.AlertCategory.POSITIVE.label }
        tapCenter(a, label)
        assertFalse(app.broto.core.alerts.AlertCategory.POSITIVE in a.repo.settings.alertSettings.enabled)
        // o interruptor em si continua funcionando
        val t2 = all(top(a)).filterIsInstance<TextView>().first { it.text == app.broto.core.alerts.AlertCategory.POSITIVE.label }
        val toggle = all(t2.parent.parent as View).first { it is Toggle }
        tapCenter(a, toggle)
        assertTrue(app.broto.core.alerts.AlertCategory.POSITIVE in a.repo.settings.alertSettings.enabled)
    }

    @Test fun editorsAskBeforeDiscardingChanges() {
        val a = launch()
        // sem mudanças: volta direto
        a.push(HabitEditorScreen(a, null), false); Shots.idle(); a.back(); Shots.idle()
        assertFalse(a.currentScreen is HabitEditorScreen); assertFalse(dialogShowing())
        // com mudanças: pergunta
        a.push(HabitEditorScreen(a, null), false); Shots.idle()
        all(top(a)).filterIsInstance<EditText>().first().setText("Meditar")
        a.back(); Shots.idle()
        assertTrue(a.currentScreen is HabitEditorScreen); assertTrue(dialogShowing())
        val d = ShadowDialog.getLatestDialog()
        all(d.window!!.decorView).filterIsInstance<TextView>().first { it.text == "Descartar" }.let { var v: View = it; while (!v.isClickable) v = v.parent as View; v.performClick() }
        Shots.idle()
        assertFalse(a.currentScreen is HabitEditorScreen)
        assertTrue(a.repo.habits().isEmpty())
        // humor e objetivo
        a.push(MoodEditorScreen(a, LocalDate.now(), 4), false); Shots.idle(); a.back(); Shots.idle()
        assertTrue(a.currentScreen is MoodEditorScreen && dialogShowing())
        ShadowDialog.getLatestDialog().dismiss(); a.pop(); Shots.idle()
        a.push(GoalEditorScreen(a, null), false); Shots.idle()
        all(top(a)).filterIsInstance<EditText>().first().setText("Ler mais"); a.back(); Shots.idle()
        assertTrue(a.currentScreen is GoalEditorScreen && dialogShowing())
    }

    @Test fun stepperAcceptsTypedValue() {
        val a = launch()
        var v = 0.0
        val st = Stepper(a, 30.0, 15.0) { v = it }
        a.currentScreen.container.addView(st); Shots.idle()
        val label = all(st).filterIsInstance<TextView>().first { it.contentDescription == "Digitar valor" }
        label.performClick(); Shots.idle()
        val d = ShadowDialog.getLatestDialog()
        all(d.window!!.decorView).filterIsInstance<EditText>().first().setText("120")
        all(d.window!!.decorView).filterIsInstance<TextView>().first { it.text == "OK" }.let { (it.parent as View).performClick() }
        Shots.idle()
        assertEquals(120.0, v); assertFalse(d.isShowing)
    }

    @Test fun bottomSheetClosesWhenDraggedDown() {
        val a = launch()
        val s = BottomSheet(a); s.title("Teste"); s.content.text("conteúdo"); s.show(); Shots.idle()
        val handle = (s.window!!.decorView as ViewGroup).let { all(it).first { v -> v.contentDescription == "Arraste para baixo para fechar" } }
        val t = SystemClock.uptimeMillis()
        handle.dispatchTouchEvent(MotionEvent.obtain(t, t, MotionEvent.ACTION_DOWN, 10f, 10f, 0))
        for (i in 1..10) handle.dispatchTouchEvent(MotionEvent.obtain(t, t + i * 16L, MotionEvent.ACTION_MOVE, 10f, 10f + i * 60f, 0))
        handle.dispatchTouchEvent(MotionEvent.obtain(t, t + 200, MotionEvent.ACTION_UP, 10f, 610f, 0))
        Shots.idle(800)
        assertFalse(s.isShowing)
    }

    @Test fun undoRestoresClearedLogAndDeletedHabit() {
        val a = launch()
        val id = a.repo.saveHabit(Habit(name = "Ler", startDate = LocalDate.now().minusDays(5)))
        a.repo.setLog(id, LocalDate.now().minusDays(1), 1.0)
        a.repo.setLog(id, LocalDate.now(), 1.0)
        val snap = a.repo.snapshotHabit(id)!!
        a.repo.deleteHabit(id)
        assertNull(a.repo.habit(id))
        a.repo.restoreHabit(snap)
        assertEquals("Ler", a.repo.habit(id)!!.name)
        assertEquals(2, a.repo.logsForHabit(id).size)
        // desmarcar pela tela mostra "Desfazer"
        a.switchTab(1, false); Shots.idle()
        val check = all(top(a)).first { it.contentDescription == "Desmarcar Ler" }
        tapCenter(a, check)
        assertNull(a.repo.logsForDay(LocalDate.now())[id])
        val undo = all(a.window.decorView).filterIsInstance<TextView>().first { it.text == "Desfazer" }
        undo.performClick(); Shots.idle()
        assertEquals(1.0, a.repo.logsForDay(LocalDate.now())[id]!!.value)
    }

    @Test fun touchTargetsAreAtLeast48dp() {
        val a = launch()
        app.broto.data.DemoData.generate(a.repo, 30)
        val min = a.dp(48); val small = ArrayList<String>()
        fun check(name: String) {
            Shots.idle()
            for (v in all(top(a))) if (v.isShown && v.isClickable && v.hasOnClickListeners() && (v.height < min - 1 || v.width < a.dp(36) - 1))
                small.add("$name: ${v.javaClass.simpleName} ${v.contentDescription ?: (v as? TextView)?.text ?: ""} ${v.width}x${v.height}")
        }
        for (i in 0..4) { a.switchTab(i, false); check("aba $i") }
        for (s in listOf(SettingsScreen(a), NotificationSettingsScreen(a), ScoreSettingsScreen(a), HabitEditorScreen(a, null), GoalEditorScreen(a, null), ReportsScreen(a))) { a.push(s, false); check(s.javaClass.simpleName); a.pop() }
        assertTrue(small.isEmpty(), small.joinToString("\n"))
    }
}
