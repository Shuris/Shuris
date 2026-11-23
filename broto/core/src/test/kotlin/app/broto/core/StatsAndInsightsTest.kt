package app.broto.core

import app.broto.core.insights.Confidence
import app.broto.core.insights.DayRecord
import app.broto.core.insights.InsightsEngine
import app.broto.core.json.Json
import app.broto.core.model.*
import app.broto.core.stats.Stat
import java.time.LocalDate
import kotlin.random.Random
import kotlin.test.*

class StatsAndInsightsTest {
    @Test fun tDistributionMatchesTables() {
        // t = 2.228 com 10 g.l. -> p ≈ 0.05
        assertEquals(0.05, Stat.twoSidedP(2.228, 10.0), 0.002)
        assertEquals(1.0, Stat.twoSidedP(0.0, 10.0), 1e-9)
        assertEquals(0.01, Stat.twoSidedP(2.576, 100000.0), 0.001)
    }

    @Test fun pearsonPerfectAndNone() {
        val x = (1..20).map { it.toDouble() }
        assertEquals(1.0, Stat.pearson(x, x.map { 2 * it + 1 })!!.r, 1e-9)
        assertNull(Stat.pearson(x, x.map { 3.0 })) // sem variação
    }

    private val habit = Habit(id = 1, name = "Exercício", category = Category.EXERCISE, startDate = LocalDate.of(2026, 1, 1))

    @Test fun noInsightsWithoutEnoughData() {
        val start = LocalDate.of(2026, 1, 1)
        val recs = (0 until 8).map { DayRecord(start.plusDays(it.toLong()), mood = 5, habitDone = mapOf(1L to (it % 2 == 0))) }
        val r = InsightsEngine.analyze(recs, listOf(habit))
        assertTrue(r.found.none { it.kind == app.broto.core.insights.InsightKind.CORRELATION })
        assertTrue(r.pending.any { it.id == "pos-mood-1" && it.confidence == Confidence.INSUFFICIENT })
    }

    @Test fun detectsRealAssociation() {
        val rnd = Random(42)
        val start = LocalDate.of(2026, 1, 1)
        val recs = (0 until 40).map {
            val done = rnd.nextBoolean()
            DayRecord(start.plusDays(it.toLong()), mood = if (done) 4 + rnd.nextInt(2) else 2 + rnd.nextInt(2), habitDone = mapOf(1L to done))
        }
        val r = InsightsEngine.analyze(recs, listOf(habit))
        val i = r.found.firstOrNull { it.id == "pos-mood-1" }
        assertNotNull(i)
        assertEquals(1, i.direction)
        assertTrue(i.confidence == Confidence.HIGH || i.confidence == Confidence.MEDIUM)
    }

    @Test fun doesNotInventCorrelationFromNoise() {
        val rnd = Random(7)
        val start = LocalDate.of(2026, 1, 1)
        val recs = (0 until 60).map { DayRecord(start.plusDays(it.toLong()), mood = 3, habitDone = mapOf(1L to rnd.nextBoolean())) }
        val r = InsightsEngine.analyze(recs, listOf(habit))
        assertNull(r.found.firstOrNull { it.id == "pos-mood-1" })
    }

    @Test fun jsonRoundTripWithAccents() {
        val data = mapOf("título" to "Olá \"mundo\"\nção", "n" to 3L, "x" to 1.5, "l" to listOf(1L, null, true), "e" to emptyMap<String, Any>())
        val back = Json.parse(Json.write(data))
        assertEquals(data, back)
    }
}
