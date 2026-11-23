package app.broto.data

import app.broto.core.model.*
import java.time.DayOfWeek
import java.time.LocalDate
import kotlin.random.Random

/**
 * Dados de demonstração claramente identificados (coluna demo = 1) e removíveis em Ajustes › Dados.
 * Os padrões são plausíveis (ex.: exercício costuma coincidir com humor melhor) para exercitar as análises.
 */
object DemoData {
    fun generate(repo: Repo, days: Int = 75, seed: Int = 2026, today: LocalDate = LocalDate.now()) {
        val rnd = Random(seed)
        val start = today.minusDays(days.toLong() - 1)
        fun hb(h: Habit) = repo.saveHabit(h.copy(demo = true, startDate = start))
        val read = hb(Habit(name = "Ler", emoji = "📚", category = Category.PERSONAL, tracking = Tracking.QUANTITY, unit = "páginas", target = 20.0, color = 0xFF9FD3F0.toInt(), reminderMinutes = 21 * 60, startDate = start))
        val study = hb(Habit(name = "Estudar", emoji = "🧠", category = Category.STUDY, tracking = Tracking.DURATION, unit = "min", target = 120.0, weekdays = Weekdays.WEEKDAYS, color = 0xFFAFC3F5.toInt(), startDate = start))
        val gym = hb(Habit(name = "Exercício físico", emoji = "🏃", category = Category.EXERCISE, weekdays = Weekdays.of(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY), color = 0xFF7CC7A0.toInt(), reminderMinutes = 7 * 60, startDate = start))
        val water = hb(Habit(name = "Beber água", emoji = "💧", category = Category.HEALTH, tracking = Tracking.QUANTITY, unit = "copos", target = 8.0, color = 0xFF8ED8C3.toInt(), startDate = start))
        val pray = hb(Habit(name = "Momento espiritual", emoji = "🙏", category = Category.SPIRITUALITY, color = 0xFFFFDF69.toInt(), startDate = start))
        val swim = hb(Habit(name = "Natação", emoji = "🏊", category = Category.EXERCISE, frequency = Frequency.WEEKLY, timesPerWeek = 2, color = 0xFF9FD3F0.toInt(), startDate = start))
        val social = hb(Habit(name = "Redes sociais", emoji = "📱", category = Category.PRODUCTIVITY, kind = HabitKind.NEGATIVE, tracking = Tracking.DURATION, unit = "min", target = 120.0, color = 0xFFFFB4A2.toInt(), startDate = start))
        val games = hb(Habit(name = "Jogar videogame", emoji = "🎮", category = Category.OTHER, kind = HabitKind.NEGATIVE, tracking = Tracking.DURATION, unit = "min", target = 180.0, color = 0xFFC9B8F0.toInt(), startDate = start))
        val late = hb(Habit(name = "Dormir depois da meia-noite", emoji = "🌙", category = Category.SLEEP, kind = HabitKind.NEGATIVE, tracking = Tracking.BOOLEAN, target = 0.0, color = 0xFFD8C8A8.toInt(), startDate = start))

        val db = repo.db
        db.beginTransaction()
        try {
            for (i in 0 until days) {
                val d = start.plusDays(i.toLong())
                val isToday = d == today
                if (!isToday && rnd.nextDouble() < 0.07) continue // alguns dias sem nenhum registro
                val trend = i / days.toDouble() // evolução gradual
                val wentGym = d.dayOfWeek in setOf(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY) && rnd.nextDouble() < 0.45 + 0.35 * trend
                val sleptLate = rnd.nextDouble() < 0.45 - 0.25 * trend
                val socialMin = (40 + rnd.nextInt(160) - (60 * trend).toInt() + if (sleptLate) 50 else 0).coerceAtLeast(0)
                fun log(h: Long, v: Double) = db.execSQL("INSERT OR REPLACE INTO habit_log(habit_id, day, value, note, updated_at) VALUES (?, ?, ?, '', ?)", arrayOf<Any>(h, d.toEpochDay(), v, System.currentTimeMillis()))
                if (isToday) { log(water, 3.0); log(pray, 1.0); log(social, 35.0) } else {
                    if (rnd.nextDouble() < 0.8) log(read, if (rnd.nextDouble() < 0.6 + 0.2 * trend) 20.0 + rnd.nextInt(15) else rnd.nextInt(15).toDouble())
                    if (d.dayOfWeek.value <= 5 && rnd.nextDouble() < 0.85) log(study, (if (socialMin > 150) 30 + rnd.nextInt(60) else 70 + rnd.nextInt(80)).toDouble())
                    if (wentGym) log(gym, 1.0) else if (d.dayOfWeek in setOf(DayOfWeek.MONDAY, DayOfWeek.THURSDAY) && rnd.nextDouble() < 0.3) log(gym, 0.0)
                    log(water, (4 + rnd.nextInt(6)).toDouble())
                    if (rnd.nextDouble() < 0.7) log(pray, 1.0)
                    if (d.dayOfWeek in setOf(DayOfWeek.WEDNESDAY, DayOfWeek.SUNDAY) && rnd.nextDouble() < 0.7) log(swim, 1.0)
                    log(social, socialMin.toDouble())
                    if (rnd.nextDouble() < 0.75) log(games, if (d.dayOfWeek.value >= 6) (90 + rnd.nextInt(180)).toDouble() else if (rnd.nextBoolean()) 0.0 else (30 + rnd.nextInt(90)).toDouble())
                    log(late, if (sleptLate) 1.0 else 0.0)
                }
                // humor
                if (isToday) continue
                if (rnd.nextDouble() < 0.9) {
                    var mood = 3.0 + (if (wentGym) 0.9 else -0.2) + (if (sleptLate) -0.6 else 0.3) + (if (socialMin > 150) -0.4 else 0.1) + rnd.nextDouble() * 1.4 - 0.7 + trend * 0.4
                    val m = mood.toInt().coerceIn(1, 5)
                    val sleep = (if (sleptLate) 2 + rnd.nextInt(2) else 3 + rnd.nextInt(3)).coerceIn(1, 5)
                    val energy = (sleep - 1 + rnd.nextInt(3) + if (wentGym) 1 else 0).coerceIn(1, 5)
                    val stress = (5 - m + rnd.nextInt(2)).coerceIn(1, 5)
                    val pool = if (m >= 4) listOf(Emotion.HAPPINESS, Emotion.MOTIVATION, Emotion.CALM, Emotion.GRATITUDE, Emotion.EXCITEMENT)
                    else if (m == 3) listOf(Emotion.CALM, Emotion.ANXIETY, Emotion.MOTIVATION, Emotion.GRATITUDE)
                    else listOf(Emotion.SADNESS, Emotion.ANXIETY, Emotion.DISCOURAGEMENT, Emotion.IRRITATION, Emotion.FRUSTRATION, Emotion.LONELINESS)
                    val emos = pool.shuffled(rnd).take(1 + rnd.nextInt(2))
                    val notes = if (m >= 4) listOf("Dia produtivo, consegui focar nos estudos.", "O treino de manhã me deixou com energia.", "Conversei com amigos, me senti leve.", "Tarde tranquila lendo.", "")
                        else if (m == 3) listOf("Dia normal, sem grandes novidades.", "Acordei cansado, mas o treino ajudou.", "Tarde tranquila lendo.", "")
                        else listOf("Muita coisa no trabalho hoje.", "Passei tempo demais no celular.", "Dormi mal e fiquei sem energia.", "")
                    db.execSQL("INSERT OR REPLACE INTO mood(day, mood, energy, stress, sleep, emotions, note, updated_at, demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
                        arrayOf<Any>(d.toEpochDay(), m, energy, stress, sleep, Emotion.toCsv(emos), notes[rnd.nextInt(notes.size)], System.currentTimeMillis()))
                }
            }
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }

        val entries = listOf(
            Triple(1L, "Um bom começo", "Hoje comecei a usar o app. Quero entender melhor como meus hábitos afetam meu humor.\n\nDo que me orgulho: ter organizado minha semana."),
            Triple(4L, "Treino e energia", "Percebi que nos dias em que treino de manhã eu fico mais disposto à tarde. Vou tentar manter."),
            Triple(9L, "", "Dia difícil. Dormi tarde e passei muito tempo nas redes sociais. Amanhã quero desligar o celular às 23h."),
            Triple(15L, "Gratidão", "Pelo que sou grato: minha família, a saúde e as pequenas conquistas da semana."),
            Triple(23L, "O que aprendi", "Aprendi que metas menores funcionam melhor para mim. 20 páginas por dia é mais fácil que um capítulo inteiro."),
        )
        for ((ago, title, body) in entries) repo.saveJournal(JournalEntry(day = today.minusDays(ago), title = title, body = body, emotions = listOf(Emotion.GRATITUDE, Emotion.CALM).take(1 + (ago % 2).toInt()), tags = listOf("reflexão"), demo = true))

        repo.saveGoal(Goal(name = "Ler 12 livros", description = "Um livro por mês", category = Category.PERSONAL, horizon = GoalHorizon.LONG, createdDay = start, deadline = LocalDate.of(today.year, 12, 31), target = 12.0, current = 4.0, unit = "livros", emoji = "📚", habitIds = listOf(read), demo = true))
        repo.saveGoal(Goal(name = "Estudar 100 horas", category = Category.STUDY, horizon = GoalHorizon.MEDIUM, createdDay = start, deadline = today.plusDays(45), target = 100.0, current = 58.0, unit = "horas", emoji = "🧠", habitIds = listOf(study), demo = true))
        repo.saveGoal(Goal(name = "30 dias de exercício", category = Category.EXERCISE, horizon = GoalHorizon.SHORT, createdDay = start, target = 30.0, mode = GoalProgressMode.HABITS, emoji = "🏃", habitIds = listOf(gym), demo = true))
        repo.saveGoal(Goal(name = "Projeto pessoal", description = "Construir meu portfólio", category = Category.PRODUCTIVITY, horizon = GoalHorizon.MEDIUM, createdDay = start, mode = GoalProgressMode.STEPS, emoji = "💻",
            steps = listOf(GoalStep(title = "Definir o escopo", done = true), GoalStep(title = "Fazer o protótipo", done = true), GoalStep(title = "Escrever os textos"), GoalStep(title = "Publicar")), demo = true))
        repo.saveGoal(Goal(name = "Reduzir redes sociais", category = Category.PRODUCTIVITY, horizon = GoalHorizon.SHORT, createdDay = start, target = 20.0, mode = GoalProgressMode.HABITS, emoji = "📵", habitIds = listOf(social), demo = true))
        repo.recomputeAllScores()
        repo.notifyChanged()
    }
}
