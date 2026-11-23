package app.broto.core.report

import app.broto.core.model.Emotion
import app.broto.core.model.Habit
import app.broto.core.model.HabitLog
import app.broto.core.model.MoodEntry
import app.broto.core.schedule.RestDays
import app.broto.core.stats.HabitPeriodStats
import app.broto.core.stats.HabitStatsCalc
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/** Números consolidados de um período (usados nas análises e nos relatórios). */
data class PeriodSummary(
    val from: LocalDate,
    val to: LocalDate,
    val scores: Map<LocalDate, Int>,
    val moods: Map<LocalDate, MoodEntry>,
    val habitStats: List<HabitPeriodStats>,
    /** Dias com qualquer registro. */
    val registeredDays: Int,
) {
    val days: Int get() = (ChronoUnit.DAYS.between(from, to) + 1).toInt()
    val avgScore: Double? get() = scores.values.takeIf { it.isNotEmpty() }?.average()
    val bestDay: Pair<LocalDate, Int>? get() = scores.maxByOrNull { it.value }?.toPair()
    val worstDay: Pair<LocalDate, Int>? get() = scores.minByOrNull { it.value }?.toPair()

    val positive: List<HabitPeriodStats> get() = habitStats.filter { it.habit.isPositive }
    val negative: List<HabitPeriodStats> get() = habitStats.filter { it.habit.isNegative }
    val positiveDone: Int get() = positive.sumOf { it.successes }
    val positiveOpportunities: Int get() = positive.sumOf { it.opportunities }
    val positiveRate: Double? get() = if (positiveOpportunities == 0) null else positiveDone.toDouble() / positiveOpportunities
    val negativeOccurrenceDays: Int get() = negative.sumOf { it.occurrenceDays }
    val negativeLoggedDays: Int get() = negative.sumOf { it.opportunities }
    /** Fração dos registros de negativos que ficaram dentro do limite. */
    val negativeControlRate: Double? get() = if (negativeLoggedDays == 0) null else negative.sumOf { it.successes }.toDouble() / negativeLoggedDays

    val moodAvg: Double? get() = moods.values.takeIf { it.isNotEmpty() }?.map { it.mood }?.average()
    val energyAvg: Double? get() = moods.values.mapNotNull { it.energy }.takeIf { it.isNotEmpty() }?.average()
    val stressAvg: Double? get() = moods.values.mapNotNull { it.stress }.takeIf { it.isNotEmpty() }?.average()
    val sleepAvg: Double? get() = moods.values.mapNotNull { it.sleep }.takeIf { it.isNotEmpty() }?.average()
    val moodDistribution: IntArray get() = IntArray(5) { i -> moods.values.count { it.mood == i + 1 } }
    val emotionCounts: List<Pair<Emotion, Int>> get() = moods.values.flatMap { it.emotions }.groupingBy { it }.eachCount().entries.sortedByDescending { it.value }.map { it.key to it.value }

    companion object {
        fun build(from: LocalDate, to: LocalDate, today: LocalDate, habits: List<Habit>, logs: Map<Long, Map<LocalDate, HabitLog>>,
                  moods: Map<LocalDate, MoodEntry>, scores: Map<LocalDate, Int>, rest: RestDays): PeriodSummary {
            val stats = habits.filter { !it.startDate.isAfter(minOf(to, today)) }.map { h -> HabitStatsCalc.forPeriod(h, logs[h.id].orEmpty(), maxOf(from, h.startDate), to, today, rest) }
            val reg = HashSet<LocalDate>()
            reg.addAll(moods.keys.filter { !it.isBefore(from) && !it.isAfter(to) })
            for (m in logs.values) for (d in m.keys) if (!d.isBefore(from) && !d.isAfter(to)) reg.add(d)
            return PeriodSummary(from, to, scores.filterKeys { !it.isBefore(from) && !it.isAfter(to) }, moods.filterKeys { !it.isBefore(from) && !it.isAfter(to) }, stats, reg.size)
        }
    }
}
