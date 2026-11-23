package app.broto

import app.broto.core.model.*
import app.broto.data.Backup
import app.broto.data.DemoData
import app.broto.security.Security
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.time.LocalDate
import kotlin.test.*

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class BackupSecurityTest {
    @Test fun fullRoundTrip() {
        val repo = TestRepo.fresh()
        DemoData.generate(repo)
        repo.settings.userName = "Ana"; repo.settings.weights = ScoreWeights(50.0, 25.0, 25.0)
        repo.saveJournal(JournalEntry(day = LocalDate.now(), title = "Título \"especial\"", body = "Linha 1\nLinha 2 — ação, emoção 🌱"))
        val before = repo.counts()
        val habitsBefore = repo.habits(true); val moodsBefore = repo.moodsInRange(LocalDate.now().minusDays(100), LocalDate.now())
        val scoresBefore = repo.storedScores(LocalDate.now().minusDays(100), LocalDate.now())
        val json = Backup.export(repo)
        // apaga e muda tudo
        repo.clearDemoData(); repo.settings.userName = "Outro"
        assertNotEquals(before, repo.counts())
        Backup.restore(repo, json)
        assertEquals(before, repo.counts())
        assertEquals(habitsBefore, repo.habits(true))
        assertEquals(moodsBefore, repo.moodsInRange(LocalDate.now().minusDays(100), LocalDate.now()))
        assertEquals(scoresBefore, repo.storedScores(LocalDate.now().minusDays(100), LocalDate.now()))
        assertEquals("Ana", repo.settings.userName)
        assertEquals(50.0, repo.settings.weights.positive)
        assertEquals("Linha 1\nLinha 2 — ação, emoção 🌱", repo.journal("Linha").first().body)
        assertEquals(repo.goals().size, 5)
    }

    @Test fun encryptedBackup() {
        val repo = TestRepo.fresh()
        repo.saveHabit(Habit(name = "Ler", startDate = LocalDate.now()))
        val enc = Backup.encrypt(Backup.export(repo), "segredo123")
        assertTrue(Backup.isEncrypted(enc))
        assertFalse(enc.contains("Ler"))
        assertFailsWith<Backup.PasswordRequired> { Backup.restore(repo, enc, null) }
        val e = assertFailsWith<Backup.BackupException> { Backup.restore(repo, enc, "errada") }
        assertEquals("Senha incorreta.", e.message)
        repo.deleteHabit(repo.habits().first().id)
        Backup.restore(repo, enc, "segredo123")
        assertEquals("Ler", repo.habits().single().name)
    }

    @Test fun invalidBackupDoesNotTouchData() {
        val repo = TestRepo.fresh()
        repo.saveHabit(Habit(name = "Treino", startDate = LocalDate.now()))
        assertFailsWith<Backup.BackupException> { Backup.restore(repo, "{\"foo\":1}") }
        assertFailsWith<Backup.BackupException> { Backup.restore(repo, "isso não é json") }
        // backup com referência quebrada (log de hábito inexistente) -> rollback
        val bad = "{\"app\":\"Broto\",\"format\":1,\"schema\":1,\"tables\":{\"habit\":[],\"mood\":[],\"habit_log\":[{\"habit_id\":999,\"day\":1,\"value\":1,\"note\":\"\",\"updated_at\":1}]}}"
        assertFailsWith<Backup.BackupException> { Backup.restore(repo, bad) }
        assertEquals("Treino", repo.habits().single().name)
    }

    @Test fun snapshotsAndCsv() {
        val repo = TestRepo.fresh()
        val ctx = RuntimeEnvironment.getApplication()
        DemoData.generate(repo, days = 20)
        assertNotNull(Backup.autoSnapshot(ctx, repo))
        assertNull(Backup.autoSnapshot(ctx, repo)) // uma por dia
        assertTrue(Backup.integrityOk(repo))
        val csv = Backup.csv(repo)
        assertTrue(csv.lines().size >= 20)
        assertTrue(csv.lines()[0].contains("humor"))
    }

    @Test fun pinAndLockout() {
        val s = Security(RuntimeEnvironment.getApplication())
        assertFalse(s.pinEnabled)
        s.setPin("2468")
        assertTrue(s.pinEnabled); assertEquals(4, s.pinLength)
        assertTrue(s.check("2468"))
        repeat(5) { assertFalse(s.check("0000")) }
        assertTrue(s.lockoutRemaining() > 0)
        assertFalse(s.check("2468")) // bloqueado temporariamente
        s.clearPin(); assertFalse(s.pinEnabled)
    }
}
