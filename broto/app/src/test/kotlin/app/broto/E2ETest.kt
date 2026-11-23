package app.broto

import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import app.broto.core.model.*
import app.broto.screens.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowDialog
import java.time.LocalDate
import kotlin.test.*

/** Fluxos reais tocando nos botões da interface. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w400dp-h860dp-xhdpi")
class E2ETest {
    private fun all(v: View, out: MutableList<View> = ArrayList()): List<View> { out.add(v); if (v is ViewGroup) for (i in 0 until v.childCount) all(v.getChildAt(i), out); return out }
    private fun root(a: MainActivity): View = ShadowDialog.getLatestDialog()?.takeIf { it.isShowing }?.window?.decorView
        ?: all(a.window.decorView).firstOrNull { it is app.broto.security.LockView } ?: a.currentScreen.container
    private fun findText(a: MainActivity, t: String, exact: Boolean = true): TextView =
        all(root(a)).filterIsInstance<TextView>().firstOrNull { if (exact) it.text.toString() == t else it.text.toString().contains(t) && it.isShown }
            ?: error("Texto não encontrado: $t em ${a.currentScreen}: " + all(root(a)).filterIsInstance<TextView>().map { it.text }.takeLast(12))
    private fun click(a: MainActivity, t: String, exact: Boolean = true) {
        var v: View? = findText(a, t, exact)
        while (v != null && !v.isClickable) v = v.parent as? View
        assertNotNull(v, "nada clicável para $t").performClick()
        Shots.idle(600)
    }
    private fun launch(): MainActivity {
        val repo = TestRepo.fresh()
        repo.settings.onboarded = true
        return Robolectric.buildActivity(MainActivity::class.java).setup().get()
    }

    @Test fun onboardingFlow() {
        TestRepo.fresh()
        val a = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        val name = all(a.currentScreen.container).filterIsInstance<EditText>().first()
        name.setText("Bia")
        click(a, "Começar")
        assertTrue(a.repo.settings.onboarded)
        assertEquals("Bia", a.repo.settings.userName)
    }

    @Test fun createHabitFromTemplateAndCheckIt() {
        val a = launch()
        a.push(HabitEditorScreen(a, null), false); Shots.idle()
        click(a, "🏃 Exercício físico")
        click(a, "Criar hábito")
        val h = a.repo.habits().single()
        assertEquals("Exercício físico", h.name)
        // marca como feito pela tela de hábitos (num dia programado: segunda)
        val day = LocalDate.now()
        a.switchTab(1, false); Shots.idle()
        if (h.weekdays.contains(day.dayOfWeek)) {
            val check = all(a.currentScreen.container).first { it.contentDescription == "Marcar ${h.name}" }
            check.performClick(); Shots.idle()
            assertEquals(1.0, a.repo.logsForDay(day)[h.id]?.value)
            check.let { all(a.currentScreen.container).first { v -> v.contentDescription == "Marcar ${h.name}" }.performClick() }; Shots.idle()
            assertNull(a.repo.logsForDay(day)[h.id]) // desmarcar
        }
    }

    @Test fun negativeHabitLogging() {
        val a = launch()
        val id = a.repo.saveHabit(Habit(name = "Procrastinar", kind = HabitKind.NEGATIVE, target = 0.0, startDate = LocalDate.now().minusDays(2)))
        LogSheet.show(a, a.repo.habit(id)!!, LocalDate.now()); Shots.idle()
        click(a, "Não aconteceu 🌿")
        assertEquals(0.0, a.repo.logsForDay(LocalDate.now())[id]!!.value)
        LogSheet.show(a, a.repo.habit(id)!!, LocalDate.now()); Shots.idle()
        click(a, "Aconteceu uma vez")
        assertEquals(1.0, a.repo.logsForDay(LocalDate.now())[id]!!.value)
        assertTrue(a.repo.dayScore(LocalDate.now()).score!! in 1..99)
    }

    @Test fun moodEntryFromHome() {
        val a = launch()
        click(a, "Bom")  // carinha na tela inicial
        assertTrue(a.currentScreen is MoodEditorScreen)
        click(a, "😌 Tranquilidade")
        val note = all(a.currentScreen.container).filterIsInstance<EditText>().last(); note.setText("Dia leve, ação!")
        click(a, "Salvar registro")
        val m = a.repo.mood(LocalDate.now())!!
        assertEquals(4, m.mood); assertEquals(listOf(Emotion.CALM), m.emotions); assertEquals("Dia leve, ação!", m.note)
    }

    @Test fun journalAndGoalCreation() {
        val a = launch()
        a.push(JournalEditorScreen(a, null), false); Shots.idle()
        val fields = all(a.currentScreen.container).filterIsInstance<EditText>()
        fields[0].setText("Meu dia"); fields[1].setText("Texto do diário")
        click(a, "Pelo que sou grato?")
        click(a, "Salvar")
        val e = a.repo.journal().single()
        assertTrue(e.body.contains("Pelo que sou grato?"))
        a.push(GoalEditorScreen(a, null), false); Shots.idle()
        all(a.currentScreen.container).filterIsInstance<EditText>().first().setText("Ler 12 livros")
        click(a, "Criar objetivo")
        assertEquals("Ler 12 livros", a.repo.goals().single().name)
    }

    @Test fun lockScreenUnlocksWithPin() {
        val a = launch()
        a.security.setPin("1357")
        a.showLock(); Shots.idle()
        for (d in listOf("1", "3", "5", "7")) click(a, d)
        Shots.idle(800)
        assertTrue(all(a.window.decorView).none { it is app.broto.security.LockView })
    }

    @Test fun themeSwitchAndAllTabsRender() {
        val a = launch()
        app.broto.data.DemoData.generate(a.repo, 40)
        for (i in 0..4) { a.switchTab(i, false); Shots.idle(300) }
        a.repo.settings.theme = "dark"
        for (s in listOf(SettingsScreen(a), BackupScreen(a), SecurityScreen(a), NotificationSettingsScreen(a), ReportsScreen(a), GoalsScreen(a), ConsistencyScreen(a), InsightsScreen(a), ManageHabitsScreen(a))) {
            a.push(s, false); Shots.idle(200); a.back(); Shots.idle(300)
        }
    }
}
