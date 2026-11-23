package app.broto.core.model

import java.time.DayOfWeek
import java.time.LocalDate

enum class HabitKind { POSITIVE, NEGATIVE }

/** Como o hábito é medido. */
enum class Tracking(val label: String) {
    BOOLEAN("Sim ou não"),
    QUANTITY("Quantidade"),
    DURATION("Tempo (minutos)");
}

/** Para hábitos positivos: diário em dias da semana escolhidos ou X vezes por semana. */
enum class Frequency { DAILY, WEEKLY }

enum class Category(val label: String, val emoji: String) {
    HEALTH("Saúde", "💚"),
    EXERCISE("Exercícios físicos", "🏃"),
    STUDY("Estudos", "📚"),
    PRODUCTIVITY("Produtividade", "✅"),
    PERSONAL("Desenvolvimento pessoal", "🌱"),
    SPIRITUALITY("Espiritualidade", "🙏"),
    FOOD("Alimentação", "🍎"),
    SLEEP("Sono", "😴"),
    SOCIAL("Social", "🤝"),
    OTHER("Outros", "✨");

    companion object { fun of(name: String?): Category = values().firstOrNull { it.name == name } ?: OTHER }
}

/** Conjunto de dias da semana guardado como bitmask (bit 0 = segunda ... bit 6 = domingo). */
data class Weekdays(val mask: Int) {
    fun contains(d: DayOfWeek): Boolean = mask and (1 shl (d.value - 1)) != 0
    fun with(d: DayOfWeek, on: Boolean): Weekdays =
        Weekdays(if (on) mask or (1 shl (d.value - 1)) else mask and (1 shl (d.value - 1)).inv())
    val count: Int get() = Integer.bitCount(mask and 0x7F)
    val isEmpty: Boolean get() = mask and 0x7F == 0
    fun days(): List<DayOfWeek> = DayOfWeek.values().filter { contains(it) }

    companion object {
        val ALL = Weekdays(0x7F)
        val WEEKDAYS = Weekdays(0x1F)
        val NONE = Weekdays(0)
        fun of(vararg d: DayOfWeek): Weekdays = d.fold(NONE) { acc, x -> acc.with(x, true) }
    }
}

data class PauseInterval(val from: LocalDate, val to: LocalDate?) {
    fun covers(day: LocalDate): Boolean = !day.isBefore(from) && (to == null || !day.isAfter(to))
}

data class Habit(
    val id: Long = 0,
    val name: String,
    val description: String = "",
    val category: Category = Category.OTHER,
    val emoji: String = "✨",
    val color: Int = 0xFFA5D879.toInt(),
    val kind: HabitKind = HabitKind.POSITIVE,
    val tracking: Tracking = Tracking.BOOLEAN,
    val unit: String = "",
    /** Positivo: meta por dia (QUANTITY/DURATION). Negativo: limite pessoal por dia (0 = nenhuma ocorrência). */
    val target: Double = 1.0,
    val frequency: Frequency = Frequency.DAILY,
    val weekdays: Weekdays = Weekdays.ALL,
    /** Para Frequency.WEEKLY: quantas vezes por semana. */
    val timesPerWeek: Int = 3,
    /** Minutos desde 00:00, ou null. */
    val reminderMinutes: Int? = null,
    val startDate: LocalDate,
    val paused: Boolean = false,
    val archived: Boolean = false,
    val pauses: List<PauseInterval> = emptyList(),
    val sortOrder: Int = 0,
    val demo: Boolean = false,
) {
    val isPositive: Boolean get() = kind == HabitKind.POSITIVE
    val isNegative: Boolean get() = kind == HabitKind.NEGATIVE

    /** Meta efetiva usada para calcular progresso (sim/não sempre vale 1). */
    val effectiveTarget: Double get() = if (tracking == Tracking.BOOLEAN) 1.0 else target.coerceAtLeast(0.0)
}

data class HabitLog(
    val habitId: Long,
    val day: LocalDate,
    /** Positivo BOOLEAN: 1 = feito, 0 = marcado como não feito. Negativo: nº de ocorrências ou quantidade/minutos (0 = não aconteceu). */
    val value: Double,
    val note: String = "",
)

enum class Mood(val level: Int, val label: String) {
    AWFUL(1, "Péssimo"), BAD(2, "Ruim"), NEUTRAL(3, "Neutro"), GOOD(4, "Bom"), GREAT(5, "Excelente");
    companion object { fun of(level: Int): Mood = values().first { it.level == level.coerceIn(1, 5) } }
}

enum class Emotion(val label: String, val emoji: String, val positive: Boolean) {
    HAPPINESS("Felicidade", "😊", true),
    SADNESS("Tristeza", "😢", false),
    ANXIETY("Ansiedade", "😰", false),
    MOTIVATION("Motivação", "💪", true),
    DISCOURAGEMENT("Desânimo", "😞", false),
    CALM("Tranquilidade", "😌", true),
    IRRITATION("Irritação", "😤", false),
    GRATITUDE("Gratidão", "🙏", true),
    LONELINESS("Solidão", "🥀", false),
    EXCITEMENT("Empolgação", "🤩", true),
    FEAR("Medo", "😨", false),
    FRUSTRATION("Frustração", "😣", false);

    companion object {
        fun parseList(csv: String?): List<Emotion> =
            csv.orEmpty().split(',').mapNotNull { s -> values().firstOrNull { it.name == s.trim() } }
        fun toCsv(list: Collection<Emotion>): String = list.joinToString(",") { it.name }
    }
}

data class MoodEntry(
    val day: LocalDate,
    val mood: Int,
    val energy: Int? = null,
    val stress: Int? = null,
    /** Qualidade do sono 1–5. */
    val sleep: Int? = null,
    val emotions: List<Emotion> = emptyList(),
    val note: String = "",
    val demo: Boolean = false,
)

data class JournalEntry(
    val id: Long = 0,
    val day: LocalDate,
    val title: String = "",
    val body: String,
    val emotions: List<Emotion> = emptyList(),
    val tags: List<String> = emptyList(),
    val createdAt: Long = 0,
    val updatedAt: Long = 0,
    val demo: Boolean = false,
)

enum class GoalHorizon(val label: String) { SHORT("Curto prazo"), MEDIUM("Médio prazo"), LONG("Longo prazo") }
enum class GoalStatus(val label: String) { ACTIVE("Em andamento"), PAUSED("Pausado"), DONE("Concluído") }

/** Como o progresso de um objetivo é calculado. */
enum class GoalProgressMode(val label: String) {
    MANUAL("Valor numérico"),
    STEPS("Etapas concluídas"),
    HABITS("Dias de hábitos relacionados");
}

data class GoalStep(val id: Long = 0, val title: String, val done: Boolean = false, val sortOrder: Int = 0)

data class Goal(
    val id: Long = 0,
    val name: String,
    val description: String = "",
    val category: Category = Category.OTHER,
    val horizon: GoalHorizon = GoalHorizon.SHORT,
    val createdDay: LocalDate,
    val deadline: LocalDate? = null,
    val target: Double = 100.0,
    val current: Double = 0.0,
    val unit: String = "",
    val mode: GoalProgressMode = GoalProgressMode.MANUAL,
    val status: GoalStatus = GoalStatus.ACTIVE,
    val emoji: String = "🎯",
    val steps: List<GoalStep> = emptyList(),
    val habitIds: List<Long> = emptyList(),
    val completedDay: LocalDate? = null,
    val demo: Boolean = false,
)

/** Pesos do score (somam qualquer valor > 0; são normalizados). */
data class ScoreWeights(val positive: Double = 45.0, val negative: Double = 30.0, val wellbeing: Double = 25.0) {
    val total: Double get() = positive + negative + wellbeing
}

/** Critério para um dia contar na sequência de consistência. */
enum class StreakCriterion(val label: String, val description: String) {
    ANY_CHECKIN("Qualquer registro", "Registrar o humor ou pelo menos um hábito"),
    MOOD("Humor registrado", "Registrar o humor do dia"),
    MOOD_AND_HABIT("Humor + um hábito", "Registrar o humor e pelo menos um hábito");
}
