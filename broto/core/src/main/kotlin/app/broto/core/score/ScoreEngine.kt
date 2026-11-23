package app.broto.core.score

import app.broto.core.model.Habit
import app.broto.core.model.HabitLog
import app.broto.core.model.MoodEntry
import app.broto.core.model.ScoreWeights
import app.broto.core.model.Tracking
import app.broto.core.schedule.RestDays
import app.broto.core.schedule.Schedule
import java.time.LocalDate
import kotlin.math.roundToInt

enum class Component(val label: String) { POSITIVE("Hábitos positivos"), NEGATIVE("Controle dos hábitos negativos"), WELLBEING("Bem-estar emocional") }

/** Contribuição de um hábito para o score do dia. */
data class HabitContribution(
    val habit: Habit,
    /** 0..1 */
    val value: Double,
    /** true quando não há registro (positivo programado sem registro conta como 0, mas é sinalizado). */
    val unlogged: Boolean,
    val bonus: Boolean = false,
)

data class ComponentResult(
    val component: Component,
    /** 0..1, ou null quando não há dados (componente ignorado sem penalidade). */
    val value: Double?,
    val weight: Double,
    val habits: List<HabitContribution> = emptyList(),
    val note: String = "",
) {
    val present: Boolean get() = value != null
}

data class DayScore(
    val day: LocalDate,
    /** 0..100, ou null quando não há nenhuma informação para avaliar o dia. */
    val score: Int?,
    val components: List<ComponentResult>,
) {
    fun component(c: Component): ComponentResult = components.first { it.component == c }

    /** Pontos obtidos / máximos por componente, já normalizados para somar 100 entre os presentes. */
    fun points(c: Component): Pair<Double, Double>? {
        val present = components.filter { it.present }
        val total = present.sumOf { it.weight }
        val r = component(c)
        if (!r.present || total <= 0) return null
        val max = r.weight / total * 100.0
        return Pair(max * r.value!!, max)
    }

    /** Linhas de explicação em linguagem simples. */
    fun explanation(): List<String> {
        val out = ArrayList<String>()
        for (c in components) {
            val p = points(c.component)
            if (p == null) {
                out.add("${c.component.label}: sem registros — ignorado, sem penalidade.")
            } else {
                out.add("${c.component.label}: ${p.first.roundToInt()} de ${p.second.roundToInt()} pontos. ${c.note}".trim())
            }
        }
        return out
    }
}

object ScoreEngine {
    /** Pontuação 0..1 de um hábito negativo dado o valor registrado e o limite pessoal. */
    fun negativeHabitValue(h: Habit, value: Double): Double {
        val limit = h.target.coerceAtLeast(0.0)
        if (value <= 0.0) return 1.0
        if (limit > 0 && value <= limit) return 1.0 - 0.3 * (value / limit)
        val base = when (h.tracking) {
            Tracking.DURATION -> maxOf(limit, 30.0)
            else -> maxOf(limit, 1.0)
        }
        val over = (value - limit) / base
        return (0.6 / (1.0 + over)).coerceIn(0.0, 0.6)
    }

    fun wellbeingValue(m: MoodEntry): Double {
        var sum = 0.0
        var w = 0.0
        sum += 0.6 * (m.mood.coerceIn(1, 5) - 1) / 4.0; w += 0.6
        m.energy?.let { sum += 0.2 * (it.coerceIn(1, 5) - 1) / 4.0; w += 0.2 }
        m.stress?.let { sum += 0.2 * (5 - it.coerceIn(1, 5)) / 4.0; w += 0.2 }
        return sum / w
    }

    fun compute(
        day: LocalDate,
        habits: List<Habit>,
        logs: Map<Long, HabitLog>,
        mood: MoodEntry?,
        weights: ScoreWeights = ScoreWeights(),
        rest: RestDays = RestDays(),
    ): DayScore {
        // ---- Positivos
        val pos = ArrayList<HabitContribution>()
        for (h in habits) {
            if (!h.isPositive || h.archived || !Schedule.isActiveOn(h, day)) continue
            val log = logs[h.id]
            if (Schedule.isScheduled(h, day, rest)) {
                pos.add(HabitContribution(h, Schedule.progress(h, log), unlogged = log == null))
            } else if (Schedule.isVisibleOn(h, day) && Schedule.progress(h, log) > 0) {
                // Semanal ou dia de descanso: só conta a favor quando foi feito.
                pos.add(HabitContribution(h, Schedule.progress(h, log), unlogged = false, bonus = true))
            }
        }
        val posValue = if (pos.isEmpty()) null else pos.sumOf { it.value } / pos.size
        val done = pos.count { it.value >= 0.999 }
        val posNote = if (pos.isEmpty()) "" else "$done de ${pos.size} concluídos."

        // ---- Negativos (só os registrados; ausência de registro não é tratada como resultado)
        val neg = ArrayList<HabitContribution>()
        for (h in habits) {
            if (!h.isNegative || h.archived || !Schedule.isActiveOn(h, day)) continue
            val log = logs[h.id] ?: continue
            neg.add(HabitContribution(h, negativeHabitValue(h, log.value), unlogged = false))
        }
        val negValue = if (neg.isEmpty()) null else neg.sumOf { it.value } / neg.size
        val avoided = neg.count { it.value >= 0.999 }
        val negNote = if (neg.isEmpty()) "" else "$avoided de ${neg.size} evitados."

        // ---- Bem-estar
        val wb = mood?.let { wellbeingValue(it) }
        val wbNote = mood?.let { "Humor ${it.mood}/5" + (it.energy?.let { e -> ", energia $e/5" } ?: "") + (it.stress?.let { s -> ", estresse $s/5" } ?: "") + "." } ?: ""

        val comps = listOf(
            ComponentResult(Component.POSITIVE, posValue, weights.positive.coerceAtLeast(0.0), pos, posNote),
            ComponentResult(Component.NEGATIVE, negValue, weights.negative.coerceAtLeast(0.0), neg, negNote),
            ComponentResult(Component.WELLBEING, wb, weights.wellbeing.coerceAtLeast(0.0), emptyList(), wbNote),
        )
        val present = comps.filter { it.present && it.weight > 0 }
        val totalW = present.sumOf { it.weight }
        val score = if (present.isEmpty() || totalW <= 0) null
        else (present.sumOf { it.weight * it.value!! } / totalW * 100.0).roundToInt().coerceIn(0, 100)
        return DayScore(day, score, comps)
    }
}
