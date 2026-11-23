package app.broto

import app.broto.core.model.*
import app.broto.data.Repo
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.time.LocalDate
import kotlin.test.*

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class RepoTest {
    private val repo = Repo.inMemory(RuntimeEnvironment.getApplication())
    private val today = LocalDate.now()

    @Test fun habitCrudAndLogs() {
        val id = repo.saveHabit(Habit(name = "Ler", emoji = "📚", tracking = Tracking.QUANTITY, unit = "páginas", target = 20.0, startDate = today.minusDays(5)))
        assertEquals("páginas", repo.habit(id)!!.unit)
        repo.saveHabit(repo.habit(id)!!.copy(name = "Leitura"))
        assertEquals("Leitura", repo.habits().single().name)
        repo.setLog(id, today, 10.0)
        repo.setLog(id, today, 25.0) // upsert
        assertEquals(25.0, repo.logsForDay(today)[id]!!.value)
        assertEquals(100, repo.dayScore(today).score)
        repo.clearLog(id, today)
        assertTrue(repo.logsForDay(today).isEmpty())
        repo.setLog(id, today, 5.0)
        repo.deleteHabit(id)
        assertTrue(repo.habits(true).isEmpty())
        assertTrue(repo.logsForDay(today).isEmpty()) // cascata
    }

    @Test fun pauseCreatesIntervalNotPenalized() {
        val id = repo.saveHabit(Habit(name = "Treino", startDate = today.minusDays(10)))
        repo.setPaused(id, true, today.minusDays(3))
        repo.setPaused(id, false, today)
        val h = repo.habit(id)!!
        assertFalse(h.paused)
        assertEquals(1, h.pauses.size)
        assertEquals(today.minusDays(1), h.pauses[0].to)
        assertNull(repo.dayScore(today.minusDays(2)).score) // pausado: nada a avaliar
    }

    @Test fun moodJournalGoalsAndScoreHistory() {
        repo.saveMood(MoodEntry(today, 4, 3, 2, 4, listOf(Emotion.GRATITUDE, Emotion.CALM), "Dia tranquilo, ação e emoção"))
        val m = repo.mood(today)!!
        assertEquals(listOf(Emotion.GRATITUDE, Emotion.CALM), m.emotions)
        assertEquals("Dia tranquilo, ação e emoção", m.note)
        assertNotNull(repo.storedScores(today, today)[today])

        val jid = repo.saveJournal(JournalEntry(day = today, title = "Hoje", body = "Aprendi algo novo sobre café", tags = listOf("#estudo", "café")))
        assertEquals(listOf("estudo", "café"), repo.journalEntry(jid)!!.tags)
        assertEquals(1, repo.journal("café").size)
        assertEquals(0, repo.journal("inexistente").size)

        val hid = repo.saveHabit(Habit(name = "Ler", startDate = today.minusDays(3)))
        val gid = repo.saveGoal(Goal(name = "Ler 12 livros", createdDay = today.minusDays(3), target = 12.0, current = 3.0, steps = listOf(GoalStep(title = "Escolher livros", done = true), GoalStep(title = "Ler"))  , habitIds = listOf(hid)))
        val g = repo.goal(gid)!!
        assertEquals(2, g.steps.size)
        assertEquals(0.25, repo.goalProgress(g), 1e-9)
        assertEquals(0.5, repo.goalProgress(g.copy(mode = GoalProgressMode.STEPS)), 1e-9)
        repo.setLog(hid, today, 1.0)
        assertEquals(1.0, repo.goalHabitDays(g))
    }

    @Test fun consistencyAndSettings() {
        repo.saveMood(MoodEntry(today.minusDays(1), 3))
        repo.saveMood(MoodEntry(today.minusDays(2), 3))
        assertEquals(2, repo.consistency().current)
        repo.settings.userName = "Ana"
        repo.settings.weights = ScoreWeights(50.0, 25.0, 25.0)
        repo.settings.clearCache()
        assertEquals("Ana", repo.settings.userName)
        assertEquals(50.0, repo.settings.weights.positive)
    }
}
