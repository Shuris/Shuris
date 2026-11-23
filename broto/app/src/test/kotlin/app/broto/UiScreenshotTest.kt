package app.broto

import app.broto.data.DemoData
import app.broto.data.Repo
import app.broto.screens.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowDialog
import java.time.LocalDate
import kotlin.test.assertTrue

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w400dp-h860dp-xhdpi")
class UiScreenshotTest {
    private fun launch(theme: String = "light", demo: Boolean = true): MainActivity {
        val repo = Repo.get(RuntimeEnvironment.getApplication())
        repo.settings.onboarded = true
        repo.settings.userName = "Ana"
        repo.settings.theme = theme
        if (demo && repo.habits().isEmpty()) DemoData.generate(repo)
        return Robolectric.buildActivity(MainActivity::class.java).setup().get()
    }

    @Test fun stage2Screens() {
        val a = launch()
        Shots.activity(a, "01_home")
        Shots.view((a.tabs[0].container.getChildAt(0)), "01_home_full", fullHeight = true)
        a.switchTab(1, false); Shots.activity(a, "02_habits")
        Shots.view(a.tabs[1].container.getChildAt(0), "02_habits_full", fullHeight = true)
        val h = a.repo.habits().first { it.name == "Ler" }
        a.push(HabitDetailScreen(a, h.id), false); Shots.activity(a, "03_habit_detail")
        a.back(); Shots.idle()
        a.push(HabitEditorScreen(a, null), false); Shots.activity(a, "04_habit_editor")
        a.back(); Shots.idle()
        LogSheet.show(a, a.repo.habits().first { it.name == "Redes sociais" }, LocalDate.now()); Shots.activity(a, "05_negative_sheet")
        ShadowDialog.getLatestDialog().dismiss()
        ScoreSheet.show(a, a.repo.dayScore(LocalDate.now().minusDays(1))); Shots.activity(a, "06_score_sheet")
        ShadowDialog.getLatestDialog().dismiss()
        assertTrue(a.repo.habits().isNotEmpty())
    }

    @Test fun darkHome() {
        val a = launch("dark")
        Shots.activity(a, "07_home_dark")
        a.switchTab(1, false); Shots.activity(a, "08_habits_dark")
    }

    @Test fun emptyState() {
        val a = launch(demo = false)
        Shots.activity(a, "09_home_empty")
    }
}
