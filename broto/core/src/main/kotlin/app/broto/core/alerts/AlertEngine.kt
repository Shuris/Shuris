package app.broto.core.alerts

import app.broto.core.model.Frequency
import app.broto.core.model.Habit
import app.broto.core.model.HabitLog
import app.broto.core.model.MoodEntry
import app.broto.core.model.Tracking
import app.broto.core.schedule.RestDays
import app.broto.core.schedule.Schedule
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import kotlin.math.roundToInt

enum class AlertCategory(val label: String, val description: String) {
    HABIT_REMINDER("Lembretes de hábitos", "No horário que você escolheu para cada hábito"),
    POSITIVE("Dicas: hábitos positivos", "Quando um hábito fica parado ou irregular"),
    NEGATIVE("Dicas: hábitos negativos", "Quando um comportamento que você quer reduzir aumenta"),
    MOOD("Dicas: humor e bem-estar", "Cuidado em dias de humor ou energia baixos"),
    STREAK("Consistência", "Lembrar da sequência na notificação da noite");
}

data class Alert(
    /** Chave para evitar repetição (ex.: "pos-lapse:12"). */
    val key: String,
    val category: AlertCategory,
    val title: String,
    val text: String,
    /** Dias mínimos entre dois alertas com a mesma chave. */
    val cooldownDays: Int,
    /** Prioridade: maior = mais importante. */
    val priority: Int,
    /** Para onde o toque leva: "habits", "mood", "habit:<id>", "home". */
    val target: String = "home",
)

data class AlertSettings(
    val enabled: Set<AlertCategory> = AlertCategory.values().toSet(),
    val maxPerDay: Int = 3,
    /** Horário silencioso (minutos do dia). Se start > end, atravessa a meia-noite. */
    val quietStart: Int = 22 * 60,
    val quietEnd: Int = 8 * 60,
)

data class AlertInput(
    val now: LocalDateTime,
    val habits: List<Habit>,
    /** Registros por hábito e dia (pelo menos os últimos 28 dias). */
    val logs: Map<Long, Map<LocalDate, HabitLog>>,
    val moods: Map<LocalDate, MoodEntry>,
    val rest: RestDays,
    val settings: AlertSettings,
    /** Última vez (epoch millis) que cada chave foi enviada. */
    val lastSent: Map<String, Long>,
    /** Quantos alertas "inteligentes" já foram enviados hoje. */
    val sentToday: Int,
    val zone: ZoneId = ZoneId.systemDefault(),
)

object AlertEngine {
    fun inQuietHours(t: LocalTime, s: AlertSettings): Boolean {
        val m = t.hour * 60 + t.minute
        return if (s.quietStart == s.quietEnd) false
        else if (s.quietStart < s.quietEnd) m >= s.quietStart && m < s.quietEnd
        else m >= s.quietStart || m < s.quietEnd
    }

    private fun canSend(key: String, cooldownDays: Int, input: AlertInput): Boolean {
        val last = input.lastSent[key] ?: return true
        val nowMs = input.now.atZone(input.zone).toInstant().toEpochMilli()
        // Pequena folga (2h) para não perder o alerta por diferenças de horário do alarme.
        return nowMs - last >= cooldownDays * 86_400_000L - 2 * 3_600_000L
    }

    /** Lembrete de um hábito no horário configurado. Retorna null se não for o caso. */
    fun habitReminder(h: Habit, input: AlertInput): Alert? {
        if (AlertCategory.HABIT_REMINDER !in input.settings.enabled) return null
        val today = input.now.toLocalDate()
        if (h.archived || !Schedule.isActiveOn(h, today)) return null
        val log = input.logs[h.id]?.get(today)
        val text: String
        if (h.isPositive) {
            if (h.frequency == Frequency.WEEKLY) {
                val c = Schedule.weeklyCount(h, input.logs[h.id].orEmpty(), today)
                if (c >= h.timesPerWeek || Schedule.isDone(h, log)) return null
                text = "Esta semana: $c de ${h.timesPerWeek}. Que tal hoje?"
            } else {
                if (!Schedule.isScheduled(h, today, input.rest)) return null
                if (log != null) return null
                text = when (h.tracking) {
                    Tracking.BOOLEAN -> "Você ainda não registrou \"${h.name}\" hoje."
                    else -> "Meta de hoje: ${fmt(h.target)} ${h.unit}. Você ainda não registrou \"${h.name}\"."
                }
            }
        } else {
            if (!h.weekdays.contains(today.dayOfWeek) || log != null) return null
            text = "Como foi com \"${h.name}\" hoje? Registrar ajuda a perceber padrões."
        }
        val key = "rem:${h.id}:$today"
        if (!canSend(key, 1, input)) return null
        return Alert(key, AlertCategory.HABIT_REMINDER, "${h.emoji} ${h.name}", text, 1, 10, "habit:${h.id}")
    }

    fun moodReminder(input: AlertInput): Alert? {
        if (AlertCategory.MOOD !in input.settings.enabled) return null
        val today = input.now.toLocalDate()
        if (input.moods.containsKey(today)) return null
        val key = "mood-rem:$today"
        if (!canSend(key, 1, input)) return null
        return Alert(key, AlertCategory.MOOD, "Como você está se sentindo hoje? 🌱", "Leva só alguns segundos para registrar seu humor.", 1, 9, "mood")
    }

    /** Verificação diária de padrões. Respeita categorias, horário silencioso, cooldown e limite diário. */
    fun dailyCheck(input: AlertInput): List<Alert> {
        if (inQuietHours(input.now.toLocalTime(), input.settings)) return emptyList()
        val today = input.now.toLocalDate()
        val out = ArrayList<Alert>()
        val en = input.settings.enabled

        for (h in input.habits.filter { !it.archived && Schedule.isActiveOn(it, today) }) {
            val logs = input.logs[h.id].orEmpty()
            if (h.isPositive && AlertCategory.POSITIVE in en && h.frequency == Frequency.DAILY) {
                // Últimas 3 ocasiões programadas antes de hoje, todas sem conclusão.
                val sched = ArrayList<LocalDate>()
                var d = today.minusDays(1)
                var guard = 0
                while (sched.size < 3 && guard < 30 && !d.isBefore(h.startDate)) {
                    if (Schedule.isScheduled(h, d, input.rest)) sched.add(d)
                    d = d.minusDays(1); guard++
                }
                if (sched.size == 3 && sched.none { Schedule.isDone(h, logs[it]) } && Schedule.isScheduled(h, today, input.rest) && !Schedule.isDone(h, logs[today])) {
                    out.add(Alert("pos-lapse:${h.id}", AlertCategory.POSITIVE, "${h.emoji} Sentimos falta de \"${h.name}\"",
                        "Faz alguns dias que \"${h.name}\" não aparece por aqui. Um passo pequeno hoje já conta.", 3, 6, "habit:${h.id}"))
                    continue
                }
                // Irregularidade: taxa dos últimos 14 dias caiu 30 p.p. em relação aos 14 anteriores.
                val r1 = rate(h, logs, today.minusDays(14), today.minusDays(1), input.rest)
                val r0 = rate(h, logs, today.minusDays(28), today.minusDays(15), input.rest)
                if (r1 != null && r0 != null && r0 - r1 >= 0.30) {
                    out.add(Alert("pos-irregular:${h.id}", AlertCategory.POSITIVE, "${h.emoji} \"${h.name}\" está mais irregular",
                        "Nas últimas duas semanas você concluiu ${(r1 * 100).roundToInt()}% das vezes, contra ${(r0 * 100).roundToInt()}% antes. Quer ajustar a meta ou o horário?", 7, 5, "habit:${h.id}"))
                }
            }
            if (h.isNegative && AlertCategory.NEGATIVE in en) {
                val todayLog = logs[today]
                if (todayLog != null && todayLog.value > h.target + 1e-9) {
                    val what = if (h.tracking == Tracking.BOOLEAN || h.unit.isBlank()) "" else " (${fmt(todayLog.value)} ${h.unit}, limite ${fmt(h.target)})"
                    out.add(Alert("neg-limit:${h.id}:$today", AlertCategory.NEGATIVE, "${h.emoji} Limite de \"${h.name}\" ultrapassado",
                        "Hoje passou do limite que você definiu$what. Tudo bem: amanhã é um novo dia.", 1, 7, "habit:${h.id}"))
                    continue
                }
                // Aumento semanal: últimos 7 dias vs 7 anteriores (+30% e pelo menos 2 dias registrados em cada).
                val w1 = sum(logs, today.minusDays(6), today); val w0 = sum(logs, today.minusDays(13), today.minusDays(7))
                if (w1.second >= 2 && w0.second >= 2 && w0.first > 0 && w1.first >= w0.first * 1.3) {
                    val inc = ((w1.first / w0.first - 1) * 100).roundToInt()
                    out.add(Alert("neg-increase:${h.id}", AlertCategory.NEGATIVE, "${h.emoji} \"${h.name}\" aumentou nesta semana",
                        "Foi cerca de $inc% a mais do que na semana anterior. Perceber isso já é um ótimo começo.", 7, 5, "habit:${h.id}"))
                    continue
                }
                // Repetição: aconteceu em pelo menos 3 dos últimos 4 dias registrados.
                val last4 = (0..3).mapNotNull { logs[today.minusDays(it.toLong())] }
                if (last4.size >= 3 && last4.count { it.value > 0 } >= 3) {
                    out.add(Alert("neg-repeat:${h.id}", AlertCategory.NEGATIVE, "${h.emoji} Um padrão para observar",
                        "\"${h.name}\" apareceu em vários dos últimos dias. Que tal pensar no que costuma levar a isso?", 5, 4, "habit:${h.id}"))
                }
            }
        }

        if (AlertCategory.MOOD in en) {
            val recent = (0..6).mapNotNull { input.moods[today.minusDays(it.toLong())] }
            val all = input.moods.values
            if (recent.size >= 3 && all.size >= 10) {
                val avgRecent = recent.take(4).map { it.mood }.average()
                val avgAll = all.map { it.mood }.average()
                if (avgRecent <= avgAll - 0.8 && avgRecent <= 3.0) {
                    out.add(Alert("mood-low", AlertCategory.MOOD, "Um abraço daqui 💚",
                        "Seu humor esteve abaixo do seu habitual nos últimos dias. Que tal reservar um momento só para você?", 4, 8, "mood"))
                }
            }
            val energyLow = recent.take(4).count { (it.energy ?: 5) <= 2 }
            if (energyLow >= 3) {
                out.add(Alert("energy-low", AlertCategory.MOOD, "Pouca energia ultimamente",
                    "Você registrou vários dias de baixa energia. Descanso também faz parte da evolução. 🌿", 4, 7, "mood"))
            }
        }

        val fresh = out.filter { canSend(it.key, it.cooldownDays, input) }.sortedByDescending { it.priority }
        val room = (input.settings.maxPerDay - input.sentToday).coerceAtLeast(0)
        return fresh.take(room)
    }

    /** Lembrete para não perder a sequência (enviado à noite se o dia ainda não foi registrado). */
    fun streakReminder(currentStreak: Int, todayDone: Boolean, input: AlertInput): Alert? {
        if (AlertCategory.STREAK !in input.settings.enabled || todayDone || currentStreak < 2) return null
        if (input.rest.isRest(input.now.toLocalDate())) return null
        val key = "streak:${input.now.toLocalDate()}"
        if (!canSend(key, 1, input)) return null
        return Alert(key, AlertCategory.STREAK, "🔥 Sua sequência de $currentStreak dias",
            "Um registro rápido hoje mantém sua chama acesa. Sem pressão: o importante é o acompanhamento.", 1, 6, "home")
    }

    private fun rate(h: Habit, logs: Map<LocalDate, HabitLog>, from: LocalDate, to: LocalDate, rest: RestDays): Double? {
        var opp = 0; var ok = 0
        var d = from
        while (!d.isAfter(to)) {
            if (Schedule.isScheduled(h, d, rest)) { opp++; if (Schedule.isDone(h, logs[d])) ok++ }
            d = d.plusDays(1)
        }
        return if (opp < 4) null else ok.toDouble() / opp
    }

    private fun sum(logs: Map<LocalDate, HabitLog>, from: LocalDate, to: LocalDate): Pair<Double, Int> {
        var s = 0.0; var n = 0
        var d = from
        while (!d.isAfter(to)) { logs[d]?.let { s += it.value; n++ }; d = d.plusDays(1) }
        return Pair(s, n)
    }

    fun fmt(v: Double): String = if (v == Math.floor(v)) v.toLong().toString() else String.format(java.util.Locale("pt", "BR"), "%.1f", v)
}
