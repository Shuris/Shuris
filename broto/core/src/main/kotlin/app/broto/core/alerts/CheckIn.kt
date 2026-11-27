package app.broto.core.alerts

import app.broto.core.model.Frequency
import app.broto.core.model.Habit
import app.broto.core.model.HabitLog
import app.broto.core.model.Tracking
import app.broto.core.schedule.Schedule
import java.time.LocalDate

enum class DayPart(val label: String) { MORNING("Manhã"), AFTERNOON("Tarde"), EVENING("Noite") }

/** Ação rápida que pode ser executada direto da notificação. */
data class QuickAction(val habitId: Long, val label: String, val mode: Mode, val amount: Double) {
    enum class Mode { SET, ADD }
}

/** Notificação diária de acompanhamento (manhã, tarde ou noite). */
data class CheckIn(
    val key: String,
    val part: DayPart,
    val title: String,
    val text: String,
    val actions: List<QuickAction>,
    /** Mostrar as carinhas de humor na notificação. */
    val askMood: Boolean,
    /** Chave do alerta de padrão incluído no texto (para registrar e não repetir). */
    val insight: Alert?,
    /** Nada mais a registrar hoje. */
    val allDone: Boolean,
)

object QuickActions {
    /** Ações oferecidas para um hábito, conforme o tipo e o registro atual. */
    fun forHabit(h: Habit, log: HabitLog?): List<QuickAction> {
        val step = when (h.tracking) {
            Tracking.DURATION -> if (h.target >= 60) 15.0 else 5.0
            Tracking.QUANTITY -> if (h.target >= 50) 10.0 else if (h.target >= 10) 5.0 else 1.0
            Tracking.BOOLEAN -> 1.0
        }
        fun amount(v: Double) = if (h.tracking == Tracking.DURATION) fmtMin(v) else fmt(v) + if (h.unit.isNotBlank() && h.unit.length <= 8) " ${h.unit}" else ""
        return if (h.isPositive) {
            when (h.tracking) {
                Tracking.BOOLEAN -> listOf(QuickAction(h.id, if (h.frequency == Frequency.WEEKLY) "✓ Fiz hoje" else "✓ Feito", QuickAction.Mode.SET, 1.0))
                else -> listOf(
                    QuickAction(h.id, "✓ Meta (${amount(h.target)})", QuickAction.Mode.SET, maxOf(h.target, log?.value ?: 0.0)),
                    QuickAction(h.id, "+${amount(step)}", QuickAction.Mode.ADD, step),
                )
            }
        } else {
            val l = listOf(QuickAction(h.id, "🌿 Não aconteceu", QuickAction.Mode.SET, 0.0))
            if (h.tracking == Tracking.BOOLEAN) l + QuickAction(h.id, "Aconteceu", QuickAction.Mode.ADD, 1.0) else l
        }
    }

    /** Uma única ação principal (usada quando vários hábitos dividem os botões). */
    fun primary(h: Habit, log: HabitLog?): QuickAction {
        val a = forHabit(h, log).first()
        // Rótulos curtos: o Android corta botões longos.
        val name = if (h.name.length > 16) h.name.take(15).trimEnd() + "…" else h.name
        val label = when {
            h.isNegative -> "🌿 Não: $name"
            h.tracking == Tracking.BOOLEAN -> "✓ $name"
            else -> "✓ $name"
        }
        return a.copy(label = label)
    }

    fun fmt(v: Double): String = if (Math.abs(v - Math.rint(v)) < 1e-9) v.toLong().toString() else String.format(java.util.Locale("pt", "BR"), "%.1f", v)
    fun fmtMin(m: Double): String {
        val t = Math.round(m).toInt()
        return when { t < 60 -> "$t min"; t % 60 == 0 -> "${t / 60} h"; else -> "${t / 60} h ${t % 60}" }
    }
}

object CheckInEngine {
    const val MAX_PER_DAY = 6

    /** Horários padrão (minutos do dia) distribuídos entre manhã, tarde e noite. */
    fun defaultTimes(n: Int): List<Int> = when (n.coerceIn(0, MAX_PER_DAY)) {
        0 -> emptyList()
        1 -> listOf(20 * 60 + 30)
        2 -> listOf(9 * 60, 20 * 60 + 30)
        3 -> listOf(8 * 60 + 30, 13 * 60 + 30, 20 * 60 + 30)
        4 -> listOf(8 * 60 + 30, 12 * 60 + 30, 16 * 60 + 30, 20 * 60 + 30)
        5 -> listOf(8 * 60, 11 * 60, 14 * 60, 17 * 60, 20 * 60 + 30)
        else -> listOf(8 * 60, 10 * 60 + 30, 13 * 60, 15 * 60 + 30, 18 * 60, 20 * 60 + 30)
    }

    fun partOf(minutes: Int): DayPart = when { minutes < 12 * 60 -> DayPart.MORNING; minutes < 18 * 60 -> DayPart.AFTERNOON; else -> DayPart.EVENING }

    /**
     * Monta a notificação do horário [slot].
     * [isLastSlot]: último horário do dia (pergunta o humor e fala da sequência).
     * [screenTime]: minutos medidos automaticamente hoje por hábito.
     */
    fun build(
        input: AlertInput, slot: Int, isLastSlot: Boolean, userName: String = "",
        streak: Int = 0, todayDone: Boolean = false, score: Int? = null,
        screenTime: Map<Long, Double> = emptyMap(), autoHabits: Set<Long> = emptySet(),
    ): CheckIn {
        val now = input.now
        val today = now.toLocalDate()
        val part = partOf(now.hour * 60 + now.minute)
        val logs = input.logs
        fun log(h: Habit) = logs[h.id]?.get(today)
        val active = input.habits.filter { !it.archived && Schedule.isActiveOn(it, today) }
        val positives = active.filter { it.isPositive && (Schedule.isScheduled(it, today, input.rest) || (it.frequency == Frequency.WEEKLY && Schedule.isVisibleOn(it, today))) }
        val pendingPos = positives.filter { h ->
            if (h.frequency == Frequency.WEEKLY) !Schedule.isDone(h, log(h)) && Schedule.weeklyCount(h, logs[h.id].orEmpty(), today) < h.timesPerWeek
            else !Schedule.isDone(h, log(h))
        }
        val dailyPositives = positives.filter { it.frequency == Frequency.DAILY }
        val doneCount = dailyPositives.count { Schedule.isDone(it, log(it)) }
        val pendingNeg = active.filter { it.isNegative && it.weekdays.contains(today.dayOfWeek) && log(it) == null && it.id !in autoHabits }
        val moodMissing = !input.moods.containsKey(today)
        val askMood = moodMissing && (isLastSlot || part == DayPart.EVENING)
        val rest = input.rest.isRest(today)
        val first = userName.trim().split(" ").firstOrNull().orEmpty()

        fun names(l: List<Habit>, max: Int = 3) = l.take(max).joinToString(", ") { it.name } + if (l.size > max) " e mais ${l.size - max}" else ""

        val lines = ArrayList<String>()
        val title: String
        when (part) {
            DayPart.MORNING -> {
                title = if (first.isNotEmpty()) "Bom dia, $first! ☀️" else "Bom dia! ☀️"
                lines.add(when {
                    rest -> "Hoje é dia de descanso 🌿 Nada de cobranças, só cuidado."
                    positives.isEmpty() -> "Um novo dia para cuidar de você."
                    pendingPos.isEmpty() -> "Tudo o que estava planejado para hoje já foi feito. ✨"
                    else -> { val n = positives.size; "Hoje: ${if (n == 1) "1 hábito" else "$n hábitos"} — ${names(pendingPos)}." }
                })
            }
            DayPart.AFTERNOON -> {
                title = "Como vai o dia? 🌿"
                lines.add(when {
                    rest -> "Dia de descanso: aproveite com leveza."
                    dailyPositives.isEmpty() && pendingPos.isEmpty() -> if (moodMissing) "Que tal registrar como você está?" else "Tudo tranquilo por aqui."
                    pendingPos.isEmpty() -> "Tudo concluído por hoje! ✨ ($doneCount de ${dailyPositives.size})"
                    else -> "$doneCount de ${dailyPositives.size} concluídos. Faltam: ${names(pendingPos)}."
                })
            }
            DayPart.EVENING -> {
                title = if (moodMissing) "Como foi seu dia? 🌙" else "Fechando o dia 🌙"
                lines.add(when {
                    pendingPos.isEmpty() && pendingNeg.isEmpty() -> if (dailyPositives.isEmpty()) "Que bom ter você por aqui." else "Você concluiu tudo hoje! ✨"
                    pendingPos.isEmpty() -> "Hábitos concluídos ✨ Falta registrar: ${names(pendingNeg)}."
                    else -> "$doneCount de ${dailyPositives.size} concluídos. Ainda dá tempo: ${names(pendingPos)}." + if (pendingNeg.isNotEmpty()) " Registre também: ${names(pendingNeg, 2)}." else ""
                })
                if (!moodMissing && score != null) lines.add("Score de hoje: $score")
                if (streak >= 2 && !todayDone && AlertCategory.STREAK in input.settings.enabled) lines.add("🔥 Sua sequência de $streak dias continua com um registro hoje.")
            }
        }
        // tempo de tela medido automaticamente
        for (h in active.filter { it.id in screenTime }) {
            val m = screenTime[h.id] ?: continue
            if (part == DayPart.MORNING && m < 1) continue
            val lim = if (h.isNegative && h.target > 0) " (limite ${QuickActions.fmtMin(h.target)})" else ""
            lines.add("📱 ${h.name} hoje: ${QuickActions.fmtMin(m)}$lim" + if (h.isNegative && m > h.target) " — acima do limite" else "")
        }
        // dica de padrão (no máximo uma, respeitando categorias, cooldown e limite)
        val insight = AlertEngine.dailyCheck(input.copy(settings = input.settings.copy(maxPerDay = 1), sentToday = 0)).firstOrNull()
        if (insight != null) lines.add("💡 ${insight.title.dropWhile { !it.isLetter() && it != '"' }.trim()}: ${insight.text}")

        // botões: no máximo 3
        val actions = ArrayList<QuickAction>()
        val ordered = if (part == DayPart.EVENING) pendingNeg + pendingPos else pendingPos + pendingNeg
        if (!rest || part == DayPart.EVENING) for (h in ordered) { if (actions.size >= 3) break; actions.add(QuickActions.primary(h, log(h))) }

        val allDone = pendingPos.isEmpty() && pendingNeg.isEmpty() && !moodMissing
        return CheckIn("checkin:$today:$slot", part, title, lines.joinToString("\n"), actions, askMood, insight, allDone)
    }
}
