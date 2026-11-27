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
        val repo = TestRepo.fresh()
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

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w400dp-h860dp-xhdpi")
class Stage3ScreenshotTest {
    @Test fun moodAndJournal() {
        val repo = TestRepo.fresh()
        repo.settings.onboarded = true; repo.settings.userName = "Ana"
        DemoData.generate(repo)
        val a = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        a.switchTab(2, false); Shots.activity(a, "10_mood")
        Shots.view(a.tabs[2].container.getChildAt(0), "10_mood_full", fullHeight = true)
        MoodDaySheet.show(a, LocalDate.now().minusDays(1)); Shots.activity(a, "11_mood_day")
        ShadowDialog.getLatestDialog().dismiss()
        a.push(MoodEditorScreen(a, LocalDate.now(), 4), false); Shots.activity(a, "12_mood_editor")
        Shots.view(a.currentScreen.container.getChildAt(0), "12_mood_editor_full", fullHeight = true)
        a.pop(); Shots.idle()
        a.switchTab(3, false); Shots.activity(a, "13_journal")
        val id = repo.journal().first().id
        a.push(JournalEntryScreen(a, id), false); Shots.activity(a, "14_journal_entry")
        a.push(JournalEditorScreen(a, null), false); Shots.activity(a, "15_journal_editor")
    }

    @Test fun welcome() {
        val a = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        Shots.activity(a, "16_welcome")
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w400dp-h860dp-xhdpi")
class Stage4ScreenshotTest {
    @Test fun analysesGoalsConsistency() {
        val repo = TestRepo.fresh()
        repo.settings.onboarded = true; repo.settings.userName = "Ana"
        DemoData.generate(repo)
        val a = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        a.switchTab(4, false)
        Shots.view(a.tabs[4].container.getChildAt(0), "20_analyses_full", fullHeight = true)
        a.push(InsightsScreen(a), false); Shots.view(a.currentScreen.container.getChildAt(0), "21_insights_full", fullHeight = true)
        a.back(); a.push(ConsistencyScreen(a), false); Shots.view(a.currentScreen.container.getChildAt(0), "22_consistency_full", fullHeight = true)
        a.back(); a.push(GoalsScreen(a), false); Shots.activity(a, "23_goals")
        val g = repo.goals().first { it.mode == app.broto.core.model.GoalProgressMode.STEPS }
        a.push(GoalDetailScreen(a, g.id), false); Shots.activity(a, "24_goal_detail")
        a.push(GoalEditorScreen(a, null), false); Shots.activity(a, "25_goal_editor")
        a.back(); a.back(); a.back(); a.push(ScoreSettingsScreen(a), false); Shots.activity(a, "26_score_settings")
        AppEvents.celebrate(a, 7); Shots.activity(a, "27_celebrate")
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w400dp-h860dp-xhdpi")
class Stage7ScreenshotTest {
    @Test fun settingsScreens() {
        val repo = TestRepo.fresh()
        repo.settings.onboarded = true; repo.settings.userName = "Ana"
        DemoData.generate(repo)
        val a = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        a.push(SettingsScreen(a), false); Shots.activity(a, "30_settings")
        a.push(BackupScreen(a), false); Shots.view(a.currentScreen.container.getChildAt(0), "31_backup_full", fullHeight = true)
        a.back(); a.push(SecurityScreen(a), false); Shots.activity(a, "32_security")
        a.back(); a.push(NotificationSettingsScreen(a), false); Shots.view(a.currentScreen.container.getChildAt(0), "33_notifications_full", fullHeight = true)
        a.back(); a.push(ReportsScreen(a), false); Shots.view(a.currentScreen.container.getChildAt(0), "34_reports_full", fullHeight = true)
        a.back(); a.push(AboutScreen(a), false); Shots.activity(a, "35_about")
        a.security.setPin("1234"); a.showLock(); Shots.activity(a, "36_lock")
    }
}
