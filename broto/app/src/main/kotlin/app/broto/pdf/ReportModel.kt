package app.broto.pdf

import app.broto.core.insights.InsightReport
import app.broto.core.insights.InsightsEngine
import app.broto.core.json.Json
import app.broto.core.json.bool
import app.broto.core.json.str
import app.broto.core.model.Goal
import app.broto.core.model.HabitLog
import app.broto.core.model.JournalEntry
import app.broto.core.report.PeriodSummary
import app.broto.core.score.DayScore
import app.broto.core.streak.ConsistencySummary
import app.broto.data.Repo
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.time.temporal.TemporalAdjusters

enum class ReportType(val label: String, val title: String) {
    DAILY("Diário", "Relatório diário"), WEEKLY("Semanal", "Relatório semanal"), MONTHLY("Mensal", "Relatório mensal"),
    YEARLY("Anual", "Relatório anual"), CUSTOM("Personalizado", "Relatório do período");

    /** Período padrão terminando na data de referência. */
    fun defaultRange(ref: LocalDate): Pair<LocalDate, LocalDate> = when (this) {
        DAILY -> Pair(ref, ref)
        WEEKLY -> { val s = ref.with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY)); Pair(s, s.plusDays(6)) }
        MONTHLY -> Pair(ref.withDayOfMonth(1), ref.withDayOfMonth(ref.lengthOfMonth()))
        YEARLY -> Pair(ref.withDayOfYear(1), ref.withDayOfYear(ref.lengthOfYear()))
        CUSTOM -> Pair(ref.minusDays(29), ref)
    }
}

enum class ReportSection(val label: String, val description: String) {
    SUMMARY("Resumo geral", "Score médio, conclusão e comparação com o período anterior"),
    HABITS("Hábitos", "Taxas, frequência, melhores e piores desempenhos, ocorrências negativas"),
    MOOD("Humor e emoções", "Média, distribuição, calendário, energia e estresse"),
    CONSISTENCY("Consistência", "Sequências e calendário de atividades"),
    GOALS("Objetivos", "Concluídos, em andamento e progresso"),
    INSIGHTS("Descobertas", "Padrões e correlações estatísticas"),
    JOURNAL("Diário", "Os textos do seu diário (conteúdo pessoal)");
}

enum class ReportStyle(val label: String) { COLOR("Colorido"), PRINT("Econômico (impressão)") }

data class ReportOptions(
    val type: ReportType,
    val from: LocalDate,
    val to: LocalDate,
    val sections: Set<ReportSection> = ReportSection.values().toSet() - ReportSection.JOURNAL,
    val charts: Boolean = true,
    val style: ReportStyle = ReportStyle.COLOR,
) {
    fun toJson(): String = Json.write(mapOf("type" to type.name, "from" to from.toString(), "to" to to.toString(),
        "sections" to sections.map { it.name }, "charts" to charts, "style" to style.name))

    companion object {
        @Suppress("UNCHECKED_CAST")
        fun fromJson(s: String): ReportOptions? = try {
            val m = Json.parse(s) as Map<String, Any?>
            ReportOptions(ReportType.valueOf(m.str("type")), LocalDate.parse(m.str("from")), LocalDate.parse(m.str("to")),
                (m["sections"] as List<*>).mapNotNull { n -> ReportSection.values().firstOrNull { it.name == n } }.toSet(),
                m.bool("charts", true), ReportStyle.valueOf(m.str("style", "COLOR")))
        } catch (e: Exception) { null }
    }
}

/** Todos os dados necessários para desenhar um relatório (coletados de uma vez, em segundo plano). */
class ReportData(
    val options: ReportOptions,
    val userName: String,
    val generatedAt: LocalDate,
    val today: LocalDate,
    val current: PeriodSummary,
    val previous: PeriodSummary,
    val consistency: ConsistencySummary,
    val goals: List<Goal>,
    val goalProgress: Map<Long, Double>,
    val insights: InsightReport,
    val journal: List<JournalEntry>,
    val dayScores: List<DayScore>,
    val logs: Map<Long, Map<LocalDate, HabitLog>>,
    val bestEver: Pair<LocalDate, Int>?,
) {
    val from get() = options.from
    val to get() = options.to
    val effectiveTo: LocalDate get() = minOf(options.to, today)
    val days: Int get() = (ChronoUnit.DAYS.between(from, to) + 1).toInt()

    companion object {
        fun collect(repo: Repo, o: ReportOptions, today: LocalDate = LocalDate.now()): ReportData {
            val len = ChronoUnit.DAYS.between(o.from, o.to) + 1
            val prevTo = o.from.minusDays(1); val prevFrom = prevTo.minusDays(len - 1)
            val endForData = minOf(o.to, today)
            val goals = repo.goals().filter { !it.createdDay.isAfter(o.to) }
            val insightFrom = if (len >= 60) o.from else endForData.minusDays(179)
            return ReportData(
                o, repo.settings.userName, today, today,
                repo.summary(o.from, o.to, today), repo.summary(prevFrom, prevTo, today),
                repo.consistency(endForData),
                goals, goals.associate { it.id to repo.goalProgress(it, endForData) },
                InsightsEngine.analyze(repo.dayRecords(insightFrom, endForData), repo.habits()),
                if (ReportSection.JOURNAL in o.sections) repo.journal(from = o.from, to = o.to, limit = 1000).reversed() else emptyList(),
                if (len <= 31) repo.scoresInRange(o.from, endForData) else emptyList(),
                repo.logsInRange(o.from, o.to),
                repo.bestScore(),
            )
        }
    }
}
