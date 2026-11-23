package app.broto.core.insights

import app.broto.core.model.Category
import app.broto.core.model.Habit
import app.broto.core.model.Tracking
import app.broto.core.stats.Stat
import java.time.DayOfWeek
import java.time.LocalDate
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

/** Um dia consolidado para análise. */
data class DayRecord(
    val day: LocalDate,
    val mood: Int? = null,
    val energy: Int? = null,
    val stress: Int? = null,
    val sleep: Int? = null,
    val score: Int? = null,
    /** Fração dos positivos programados concluídos (null se não havia nenhum). */
    val positiveRate: Double? = null,
    /** Positivos avaliáveis no dia (programados, ou feitos) -> concluído? */
    val habitDone: Map<Long, Boolean> = emptyMap(),
    /** Valores registrados por hábito. */
    val habitValue: Map<Long, Double> = emptyMap(),
)

enum class Confidence(val label: String) {
    HIGH("Confiança alta"), MEDIUM("Confiança média"), LOW("Indício fraco"), INSUFFICIENT("Dados insuficientes")
}

enum class InsightKind { CORRELATION, PATTERN, DESCRIPTIVE }

data class Insight(
    val id: String,
    val title: String,
    val description: String,
    val evidence: List<String>,
    val from: LocalDate,
    val to: LocalDate,
    val sampleSize: Int,
    val confidence: Confidence,
    val kind: InsightKind,
    val emoji: String,
    /** +1 associação favorável, -1 desfavorável, 0 neutra. */
    val direction: Int = 0,
    /** Para cartões de "dados insuficientes": quantos registros faltam. */
    val needed: Int = 0,
)

data class InsightReport(val found: List<Insight>, val pending: List<Insight>, val from: LocalDate?, val to: LocalDate?, val daysAnalyzed: Int)

object InsightsEngine {
    const val MIN_GROUP = 5
    const val MIN_TOTAL = 14
    const val MIN_CORR = 10
    const val DISCLAIMER = "Correlação não é causalidade: estes padrões mostram o que costuma acontecer junto nos seus registros, não o que causa o quê."

    private fun f1(x: Double) = String.format(Locale("pt", "BR"), "%.1f", x)
    private fun pct(x: Double) = "${(x * 100).roundToInt()}%"

    private fun confidence(p: Double, n: Int): Confidence = when {
        p < 0.01 && n >= 30 -> Confidence.HIGH
        p < 0.05 -> Confidence.MEDIUM
        p < 0.10 -> Confidence.LOW
        else -> Confidence.INSUFFICIENT
    }

    fun analyze(records: List<DayRecord>, habits: List<Habit>): InsightReport {
        val recs = records.sortedBy { it.day }
        if (recs.isEmpty()) return InsightReport(emptyList(), listOf(
            Insight("start", "Ainda não há registros", "Registre seu humor e seus hábitos por algumas semanas. As descobertas aparecem aqui quando houver dados suficientes.",
                emptyList(), LocalDate.now(), LocalDate.now(), 0, Confidence.INSUFFICIENT, InsightKind.DESCRIPTIVE, "🌱", needed = MIN_TOTAL)
        ), null, null, 0)
        val from = recs.first().day
        val to = recs.last().day
        val found = ArrayList<Insight>()
        val pending = ArrayList<Insight>()

        fun groupTest(id: String, emoji: String, habitName: String, metricName: String, metric: (DayRecord) -> Int?, habitId: Long, negative: Boolean) {
            val yes = ArrayList<Double>(); val no = ArrayList<Double>()
            for (r in recs) {
                val m = metric(r) ?: continue
                val flag: Boolean? = if (negative) r.habitValue[habitId]?.let { it > 0 } else r.habitDone[habitId]
                when (flag) { true -> yes.add(m.toDouble()); false -> no.add(m.toDouble()); null -> {} }
            }
            val n = yes.size + no.size
            val label = if (negative) "em que \"$habitName\" aconteceu" else "em que você fez \"$habitName\""
            val labelNo = if (negative) "sem \"$habitName\"" else "sem \"$habitName\""
            if (yes.size < MIN_GROUP || no.size < MIN_GROUP || n < MIN_TOTAL) {
                val need = maxOf(MIN_TOTAL - n, MIN_GROUP - yes.size, MIN_GROUP - no.size, 0)
                pending.add(Insight(id, "$habitName × $metricName", "Precisamos de pelo menos $MIN_GROUP dias $label e $MIN_GROUP dias $labelNo, com $metricName registrado.",
                    listOf("Dias $label: ${yes.size}", "Dias $labelNo: ${no.size}"), from, to, n, Confidence.INSUFFICIENT, InsightKind.CORRELATION, emoji, needed = need))
                return
            }
            val t = Stat.welch(yes, no) ?: return
            val conf = confidence(t.p, n)
            if (conf == Confidence.INSUFFICIENT || abs(t.diff) < 0.3) return
            val higher = t.diff > 0
            val dir = when { negative -> if (higher) 1 else -1; else -> if (higher) 1 else -1 }
            val adj = if (higher) "maior" else "menor"
            found.add(Insight(
                id, "$metricName ${if (higher) "mais alto" else "mais baixo"} ${if (negative) "quando \"$habitName\" acontece" else "nos dias de \"$habitName\""}",
                "Nos dias $label, seu nível de ${metricName.lowercase()} costuma ser $adj (${f1(Stat.mean(yes))} contra ${f1(Stat.mean(no))}, numa escala de 1 a 5).",
                listOf(
                    "Média nos dias $label: ${f1(Stat.mean(yes))} (${yes.size} dias)",
                    "Média nos dias $labelNo: ${f1(Stat.mean(no))} (${no.size} dias)",
                    "Diferença: ${if (higher) "+" else ""}${f1(t.diff)} · tamanho do efeito d = ${f1(t.cohenD)} · p = ${String.format(Locale.US, "%.3f", t.p)}",
                ), from, to, n, conf, InsightKind.CORRELATION, emoji, dir))
        }

        // 1) Hábitos positivos × humor / energia
        for (h in habits.filter { it.isPositive && !it.archived && it.frequency == app.broto.core.model.Frequency.DAILY }) {
            groupTest("pos-mood-${h.id}", h.emoji, h.name, "Humor", { it.mood }, h.id, false)
            if (h.category == Category.EXERCISE || h.category == Category.SLEEP || h.category == Category.HEALTH || h.category == Category.FOOD)
                groupTest("pos-energy-${h.id}", h.emoji, h.name, "Energia", { it.energy }, h.id, false)
        }
        // 2) Hábitos negativos × humor e × conclusão dos positivos
        for (h in habits.filter { it.isNegative && !it.archived }) {
            groupTest("neg-mood-${h.id}", h.emoji, h.name, "Humor", { it.mood }, h.id, true)
            val yes = ArrayList<Double>(); val no = ArrayList<Double>()
            for (r in recs) {
                val rate = r.positiveRate ?: continue
                val v = r.habitValue[h.id] ?: continue
                if (v > 0) yes.add(rate) else no.add(rate)
            }
            val n = yes.size + no.size
            if (yes.size >= MIN_GROUP && no.size >= MIN_GROUP && n >= MIN_TOTAL) {
                val t = Stat.welch(yes, no)
                if (t != null && abs(t.diff) >= 0.10) {
                    val conf = confidence(t.p, n)
                    if (conf != Confidence.INSUFFICIENT) found.add(Insight(
                        "neg-prod-${h.id}", if (t.diff < 0) "Dias com \"${h.name}\" tendem a ser menos produtivos" else "\"${h.name}\" não parece atrapalhar seus hábitos",
                        "Nos dias em que \"${h.name}\" aconteceu, você concluiu em média ${pct(Stat.mean(yes))} dos hábitos positivos, contra ${pct(Stat.mean(no))} nos outros dias.",
                        listOf("Com ocorrência: ${pct(Stat.mean(yes))} (${yes.size} dias)", "Sem ocorrência: ${pct(Stat.mean(no))} (${no.size} dias)", "p = ${String.format(Locale.US, "%.3f", t.p)}"),
                        from, to, n, conf, InsightKind.CORRELATION, h.emoji, if (t.diff < 0) -1 else 1))
                }
            }
        }
        // 3) Correlações entre indicadores
        fun corr(id: String, emoji: String, title: String, xName: String, yName: String, x: (DayRecord) -> Number?, y: (DayRecord) -> Number?) {
            val xs = ArrayList<Double>(); val ys = ArrayList<Double>()
            for (r in recs) { val a = x(r) ?: continue; val b = y(r) ?: continue; xs.add(a.toDouble()); ys.add(b.toDouble()) }
            if (xs.size < MIN_CORR) {
                pending.add(Insight(id, title, "Precisamos de pelo menos $MIN_CORR dias com $xName e $yName registrados.", listOf("Dias com os dois registros: ${xs.size}"),
                    from, to, xs.size, Confidence.INSUFFICIENT, InsightKind.CORRELATION, emoji, needed = MIN_CORR - xs.size))
                return
            }
            val c = Stat.pearson(xs, ys) ?: return
            val conf = confidence(c.p, c.n)
            if (conf == Confidence.INSUFFICIENT || abs(c.r) < 0.25) return
            val strength = when { abs(c.r) >= 0.6 -> "forte"; abs(c.r) >= 0.4 -> "moderada"; else -> "fraca" }
            val together = if (c.r > 0) "costumam subir juntos" else "costumam andar em sentidos opostos"
            found.add(Insight(id, title, "${xName.replaceFirstChar { it.uppercase() }} e $yName $together nos seus registros (relação $strength).",
                listOf("Coeficiente de correlação r = ${String.format(Locale.US, "%.2f", c.r)}", "Dias analisados: ${c.n}", "p = ${String.format(Locale.US, "%.3f", c.p)}"),
                from, to, c.n, conf, InsightKind.CORRELATION, emoji, if (c.r > 0) 1 else -1))
        }
        corr("sleep-energy", "😴", "Sono e energia", "qualidade do sono", "energia", { it.sleep }, { it.energy })
        corr("sleep-mood", "🌙", "Sono e humor", "qualidade do sono", "humor", { it.sleep }, { it.mood })
        corr("stress-mood", "🌧️", "Estresse e humor", "estresse", "humor", { it.stress }, { it.mood })
        corr("energy-mood", "⚡", "Energia e humor", "energia", "humor", { it.energy }, { it.mood })
        for (h in habits.filter { it.isPositive && it.category == Category.STUDY && it.tracking != Tracking.BOOLEAN && !it.archived }) {
            corr("study-mood-${h.id}", h.emoji, "${h.name} e humor", "a quantidade de \"${h.name}\"", "o humor", { r -> r.habitValue[h.id] }, { it.mood })
        }

        // 4) Dias da semana
        val byDow = recs.filter { it.score != null }.groupBy { it.day.dayOfWeek }
        val scored = recs.count { it.score != null }
        if (scored >= 21 && byDow.size == 7 && byDow.values.all { it.size >= 2 }) {
            val avg = byDow.mapValues { e -> e.value.map { it.score!!.toDouble() }.average() }
            val best = avg.maxByOrNull { it.value }!!
            val worst = avg.minByOrNull { it.value }!!
            if (best.value - worst.value >= 5) {
                found.add(Insight("weekday", "${dowName(best.key).replaceFirstChar { it.uppercase() }} é seu melhor dia",
                    "Seu score médio é mais alto às ${dowPlural(best.key)} e mais baixo às ${dowPlural(worst.key)}.",
                    DayOfWeek.values().map { "${dowName(it).replaceFirstChar { c -> c.uppercase() }}: ${avg[it]!!.roundToInt()} pts (${byDow[it]!!.size} dias)" },
                    from, to, scored, if (scored >= 42) Confidence.MEDIUM else Confidence.LOW, InsightKind.PATTERN, "📅", 0))
            }
        } else {
            pending.add(Insight("weekday", "Melhores dias da semana", "Precisamos de pelo menos 3 semanas com score, com cada dia da semana aparecendo duas vezes.",
                listOf("Dias com score: $scored de 21"), from, to, scored, Confidence.INSUFFICIENT, InsightKind.PATTERN, "📅", needed = maxOf(21 - scored, 1)))
        }

        // 5) Consistência dos hábitos (descritivo)
        val rates = habits.filter { it.isPositive && !it.archived && it.frequency == app.broto.core.model.Frequency.DAILY }.mapNotNull { h ->
            val vals = recs.mapNotNull { it.habitDone[h.id] }
            if (vals.size >= MIN_TOTAL) h to (vals.count { it }.toDouble() / vals.size) to vals.size else null
        }
        if (rates.isNotEmpty()) {
            val sorted = rates.sortedByDescending { it.first.second }
            val top = sorted.first()
            found.add(Insight("consistency", "\"${top.first.first.name}\" é seu hábito mais consistente",
                "Você concluiu \"${top.first.first.name}\" em ${pct(top.first.second)} dos dias em que ele estava programado.",
                sorted.take(5).map { "${it.first.first.emoji} ${it.first.first.name}: ${pct(it.first.second)} (${it.second} dias)" },
                from, to, top.second, Confidence.HIGH, InsightKind.DESCRIPTIVE, top.first.first.emoji, 1))
        }
        val order = listOf(Confidence.HIGH, Confidence.MEDIUM, Confidence.LOW)
        return InsightReport(found.sortedWith(compareByDescending<Insight> { it.kind == InsightKind.CORRELATION }.thenBy { order.indexOf(it.confidence) }),
            pending.sortedBy { it.needed }, from, to, recs.size)
    }

    fun dowName(d: DayOfWeek): String = when (d) {
        DayOfWeek.MONDAY -> "segunda"; DayOfWeek.TUESDAY -> "terça"; DayOfWeek.WEDNESDAY -> "quarta"; DayOfWeek.THURSDAY -> "quinta"
        DayOfWeek.FRIDAY -> "sexta"; DayOfWeek.SATURDAY -> "sábado"; DayOfWeek.SUNDAY -> "domingo"
    }

    private fun dowPlural(d: DayOfWeek): String = when (d) {
        DayOfWeek.SATURDAY -> "sábados"; DayOfWeek.SUNDAY -> "domingos"; else -> dowName(d) + "s"
    }
}
