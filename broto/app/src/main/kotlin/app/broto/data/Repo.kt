package app.broto.data

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import app.broto.core.alerts.AlertCategory
import app.broto.core.alerts.AlertSettings
import app.broto.core.insights.DayRecord
import app.broto.core.model.*
import app.broto.core.schedule.RestDays
import app.broto.core.schedule.Schedule
import app.broto.core.score.Component
import app.broto.core.score.DayScore
import app.broto.core.score.ScoreEngine
import app.broto.core.streak.ConsistencyEngine
import app.broto.core.streak.ConsistencySummary
import java.time.LocalDate

/** Acesso aos dados. Todas as escritas usam transações; ouvintes são avisados após mudanças. */
class Repo private constructor(context: Context, dbName: String?) {
    val helper = BrotoDatabase(context.applicationContext, dbName)
    val db: SQLiteDatabase get() = helper.writableDatabase
    val settings = Settings(this)

    private val listeners = ArrayList<() -> Unit>()
    fun addListener(l: () -> Unit) { listeners.add(l) }
    fun removeListener(l: () -> Unit) { listeners.remove(l) }
    fun notifyChanged() { invalidateCaches(); for (l in ArrayList(listeners)) l() }

    inline fun <T> tx(block: () -> T): T {
        val d = db
        d.beginTransaction()
        try { val r = block(); d.setTransactionSuccessful(); return r } finally { d.endTransaction(); invalidateCaches() }
    }

    // ---- Cache de leitura (as telas consultam os mesmos dados várias vezes por renderização).
    // Invalidado em toda escrita (tx) e em toda notificação de mudança.
    private val cacheLock = Any()
    private var habitsCache: List<Habit>? = null
    private var restCache: RestDays? = null
    private val habitLogsCache = HashMap<Long, Map<LocalDate, HabitLog>>()

    fun invalidateCaches() = synchronized(cacheLock) { habitsCache = null; restCache = null; habitLogsCache.clear() }

    // ------------------------------------------------------------------ Hábitos
    fun habits(includeArchived: Boolean = false): List<Habit> {
        val all = synchronized(cacheLock) { habitsCache } ?: loadHabits().also { synchronized(cacheLock) { habitsCache = it } }
        return if (includeArchived) all else all.filter { !it.archived }
    }

    private fun loadHabits(): List<Habit> {
        val pauses = HashMap<Long, MutableList<PauseInterval>>()
        db.rawQuery("SELECT habit_id, from_day, to_day FROM habit_pause", null).use { c ->
            while (c.moveToNext()) pauses.getOrPut(c.getLong(0)) { ArrayList() }.add(PauseInterval(LocalDate.ofEpochDay(c.getLong(1)), if (c.isNull(2)) null else LocalDate.ofEpochDay(c.getLong(2))))
        }
        val out = ArrayList<Habit>()
        db.rawQuery("SELECT * FROM habit ORDER BY archived, sort, id", null).use { c ->
            while (c.moveToNext()) out.add(readHabit(c, pauses[c.long("id")] ?: emptyList()))
        }
        return out
    }

    fun habit(id: Long): Habit? = habits(true).firstOrNull { it.id == id }

    private fun readHabit(c: Cursor, pauses: List<PauseInterval>) = Habit(
        id = c.long("id"), name = c.str("name"), description = c.str("description"),
        category = Category.of(c.str("category")), emoji = c.str("emoji"), color = c.int("color"),
        kind = HabitKind.valueOf(c.str("kind")), tracking = Tracking.valueOf(c.str("tracking")), unit = c.str("unit"),
        target = c.dbl("target"), frequency = Frequency.valueOf(c.str("frequency")), weekdays = Weekdays(c.int("weekdays")),
        timesPerWeek = c.int("times_per_week"), reminderMinutes = c.intOrNull("reminder_min"),
        startDate = LocalDate.ofEpochDay(c.long("start_day")), paused = c.int("paused") == 1, archived = c.int("archived") == 1,
        pauses = pauses, sortOrder = c.int("sort"), demo = c.int("demo") == 1,
    )

    fun saveHabit(h: Habit): Long {
        val cv = ContentValues().apply {
            put("name", h.name.trim()); put("description", h.description.trim()); put("category", h.category.name)
            put("emoji", h.emoji); put("color", h.color); put("kind", h.kind.name); put("tracking", h.tracking.name)
            put("unit", h.unit.trim()); put("target", h.target); put("frequency", h.frequency.name); put("weekdays", h.weekdays.mask)
            put("times_per_week", h.timesPerWeek); if (h.reminderMinutes == null) putNull("reminder_min") else put("reminder_min", h.reminderMinutes)
            put("start_day", h.startDate.toEpochDay()); put("archived", if (h.archived) 1 else 0); put("demo", if (h.demo) 1 else 0)
        }
        val id = tx {
            if (h.id == 0L) {
                cv.put("sort", (db.longQuery("SELECT COALESCE(MAX(sort), 0) + 1 FROM habit") ?: 1L).toInt())
                cv.put("created_at", System.currentTimeMillis()); cv.put("paused", 0)
                db.insertOrThrow("habit", null, cv)
            } else {
                db.update("habit", cv, "id = ?", arrayOf(h.id.toString())); h.id
            }
        }
        recomputeScoresFrom(h.startDate)
        notifyChanged()
        return id
    }

    fun deleteHabit(id: Long) {
        tx { db.delete("habit", "id = ?", arrayOf(id.toString())) }
        recomputeAllScores(); notifyChanged()
    }

    /** Pausar registra um intervalo: os dias pausados não contam como falha. */
    fun setPaused(id: Long, paused: Boolean, today: LocalDate = LocalDate.now()) {
        tx {
            if (paused) {
                db.execSQL("UPDATE habit SET paused = 1 WHERE id = ?", arrayOf<Any>(id))
                db.execSQL("INSERT INTO habit_pause(habit_id, from_day, to_day) VALUES (?, ?, NULL)", arrayOf<Any>(id, today.toEpochDay()))
            } else {
                db.execSQL("UPDATE habit SET paused = 0 WHERE id = ?", arrayOf<Any>(id))
                // Fecha o intervalo aberto no dia anterior (se pausou e retomou no mesmo dia, remove o intervalo).
                db.execSQL("DELETE FROM habit_pause WHERE habit_id = ? AND to_day IS NULL AND from_day >= ?", arrayOf<Any>(id, today.toEpochDay()))
                db.execSQL("UPDATE habit_pause SET to_day = ? WHERE habit_id = ? AND to_day IS NULL", arrayOf<Any>(today.toEpochDay() - 1, id))
            }
        }
        recomputeScoresFrom(today.minusDays(1)); notifyChanged()
    }

    fun setArchived(id: Long, archived: Boolean) {
        tx { db.execSQL("UPDATE habit SET archived = ? WHERE id = ?", arrayOf<Any>(if (archived) 1 else 0, id)) }
        recomputeAllScores(); notifyChanged()
    }

    fun moveHabit(id: Long, up: Boolean) {
        val list = habits(false).toMutableList()
        val i = list.indexOfFirst { it.id == id }
        val j = if (up) i - 1 else i + 1
        if (i < 0 || j < 0 || j >= list.size) return
        val a = list[i]; list[i] = list[j]; list[j] = a
        tx { list.forEachIndexed { idx, h -> db.execSQL("UPDATE habit SET sort = ? WHERE id = ?", arrayOf<Any>(idx, h.id)) } }
        notifyChanged()
    }

    // ------------------------------------------------------------------ Registros de hábitos
    fun logsForDay(day: LocalDate): Map<Long, HabitLog> {
        val m = HashMap<Long, HabitLog>()
        db.rawQuery("SELECT habit_id, day, value, note FROM habit_log WHERE day = ?", arrayOf(day.toEpochDay().toString())).use { c ->
            while (c.moveToNext()) m[c.getLong(0)] = HabitLog(c.getLong(0), LocalDate.ofEpochDay(c.getLong(1)), c.getDouble(2), c.getString(3))
        }
        return m
    }

    /** habitId -> (dia -> registro) */
    fun logsInRange(from: LocalDate, to: LocalDate): Map<Long, Map<LocalDate, HabitLog>> {
        val m = HashMap<Long, HashMap<LocalDate, HabitLog>>()
        db.rawQuery("SELECT habit_id, day, value, note FROM habit_log WHERE day BETWEEN ? AND ?", arrayOf(from.toEpochDay().toString(), to.toEpochDay().toString())).use { c ->
            while (c.moveToNext()) {
                val d = LocalDate.ofEpochDay(c.getLong(1))
                m.getOrPut(c.getLong(0)) { HashMap() }[d] = HabitLog(c.getLong(0), d, c.getDouble(2), c.getString(3))
            }
        }
        return m
    }

    fun logsForHabit(id: Long): Map<LocalDate, HabitLog> {
        synchronized(cacheLock) { habitLogsCache[id] }?.let { return it }
        return loadLogsForHabit(id).also { synchronized(cacheLock) { habitLogsCache[id] = it } }
    }

    private fun loadLogsForHabit(id: Long): Map<LocalDate, HabitLog> {
        val m = HashMap<LocalDate, HabitLog>()
        db.rawQuery("SELECT day, value, note FROM habit_log WHERE habit_id = ?", arrayOf(id.toString())).use { c ->
            while (c.moveToNext()) { val d = LocalDate.ofEpochDay(c.getLong(0)); m[d] = HabitLog(id, d, c.getDouble(1), c.getString(2)) }
        }
        return m
    }

    fun setLog(habitId: Long, day: LocalDate, value: Double, note: String = "") {
        tx {
            db.execSQL("INSERT INTO habit_log(habit_id, day, value, note, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(habit_id, day) DO UPDATE SET value = excluded.value, note = excluded.note, updated_at = excluded.updated_at",
                arrayOf<Any>(habitId, day.toEpochDay(), value.coerceAtLeast(0.0), note, System.currentTimeMillis()))
        }
        recomputeScore(day); notifyChanged()
    }

    fun clearLog(habitId: Long, day: LocalDate) {
        tx { db.delete("habit_log", "habit_id = ? AND day = ?", arrayOf(habitId.toString(), day.toEpochDay().toString())) }
        recomputeScore(day); notifyChanged()
    }

    fun habitLogDays(): Set<LocalDate> = db.daySet("SELECT DISTINCT day FROM habit_log")

    // ------------------------------------------------------------------ Humor
    fun mood(day: LocalDate): MoodEntry? =
        db.rawQuery("SELECT * FROM mood WHERE day = ?", arrayOf(day.toEpochDay().toString())).use { c -> if (c.moveToFirst()) readMood(c) else null }

    fun moodsInRange(from: LocalDate, to: LocalDate): Map<LocalDate, MoodEntry> {
        val m = LinkedHashMap<LocalDate, MoodEntry>()
        db.rawQuery("SELECT * FROM mood WHERE day BETWEEN ? AND ? ORDER BY day", arrayOf(from.toEpochDay().toString(), to.toEpochDay().toString())).use { c ->
            while (c.moveToNext()) { val e = readMood(c); m[e.day] = e }
        }
        return m
    }

    private fun readMood(c: Cursor) = MoodEntry(
        LocalDate.ofEpochDay(c.long("day")), c.int("mood"), c.intOrNull("energy"), c.intOrNull("stress"), c.intOrNull("sleep"),
        Emotion.parseList(c.str("emotions")), c.str("note"), c.int("demo") == 1)

    fun saveMood(e: MoodEntry) {
        tx {
            val cv = ContentValues().apply {
                put("day", e.day.toEpochDay()); put("mood", e.mood.coerceIn(1, 5))
                putOrNull("energy", e.energy); putOrNull("stress", e.stress); putOrNull("sleep", e.sleep)
                put("emotions", Emotion.toCsv(e.emotions)); put("note", e.note); put("updated_at", System.currentTimeMillis()); put("demo", if (e.demo) 1 else 0)
            }
            db.insertWithOnConflict("mood", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
        }
        recomputeScore(e.day); notifyChanged()
    }

    fun deleteMood(day: LocalDate) {
        tx { db.delete("mood", "day = ?", arrayOf(day.toEpochDay().toString())) }
        recomputeScore(day); notifyChanged()
    }

    fun moodDays(): Set<LocalDate> = db.daySet("SELECT day FROM mood")

    // ------------------------------------------------------------------ Diário
    fun journal(query: String = "", from: LocalDate? = null, to: LocalDate? = null, limit: Int = 50, offset: Int = 0): List<JournalEntry> {
        val where = ArrayList<String>(); val args = ArrayList<String>()
        if (query.isNotBlank()) {
            where.add("(title LIKE ? OR body LIKE ? OR tags LIKE ?)")
            val q = "%" + query.trim().replace("%", "") + "%"
            args.add(q); args.add(q); args.add(q)
        }
        if (from != null) { where.add("day >= ?"); args.add(from.toEpochDay().toString()) }
        if (to != null) { where.add("day <= ?"); args.add(to.toEpochDay().toString()) }
        val sql = "SELECT * FROM journal ${if (where.isEmpty()) "" else "WHERE " + where.joinToString(" AND ")} ORDER BY day DESC, created_at DESC LIMIT $limit OFFSET $offset"
        val out = ArrayList<JournalEntry>()
        db.rawQuery(sql, args.toTypedArray()).use { c -> while (c.moveToNext()) out.add(readJournal(c)) }
        return out
    }

    fun journalEntry(id: Long): JournalEntry? =
        db.rawQuery("SELECT * FROM journal WHERE id = ?", arrayOf(id.toString())).use { c -> if (c.moveToFirst()) readJournal(c) else null }

    fun journalCount(): Int = (db.longQuery("SELECT COUNT(*) FROM journal") ?: 0L).toInt()

    private fun readJournal(c: Cursor) = JournalEntry(
        c.long("id"), LocalDate.ofEpochDay(c.long("day")), c.str("title"), c.str("body"), Emotion.parseList(c.str("emotions")),
        c.str("tags").split(',').map { it.trim() }.filter { it.isNotEmpty() }, c.long("created_at"), c.long("updated_at"), c.int("demo") == 1)

    fun saveJournal(e: JournalEntry): Long {
        val now = System.currentTimeMillis()
        val cv = ContentValues().apply {
            put("day", e.day.toEpochDay()); put("title", e.title.trim()); put("body", e.body); put("emotions", Emotion.toCsv(e.emotions))
            put("tags", e.tags.map { it.trim().removePrefix("#") }.filter { it.isNotEmpty() }.distinct().joinToString(",")); put("updated_at", now); put("demo", if (e.demo) 1 else 0)
        }
        val id = tx {
            if (e.id == 0L) { cv.put("created_at", if (e.createdAt > 0) e.createdAt else now); db.insertOrThrow("journal", null, cv) }
            else { db.update("journal", cv, "id = ?", arrayOf(e.id.toString())); e.id }
        }
        notifyChanged(); return id
    }

    fun deleteJournal(id: Long) { tx { db.delete("journal", "id = ?", arrayOf(id.toString())) }; notifyChanged() }

    fun allTags(): List<String> {
        val s = sortedSetOf<String>()
        db.rawQuery("SELECT tags FROM journal WHERE tags != ''", null).use { c -> while (c.moveToNext()) c.getString(0).split(',').map { it.trim() }.filter { it.isNotEmpty() }.forEach { s.add(it) } }
        return s.toList()
    }

    // ------------------------------------------------------------------ Objetivos
    fun goals(): List<Goal> {
        val steps = HashMap<Long, MutableList<GoalStep>>()
        db.rawQuery("SELECT id, goal_id, title, done, sort FROM goal_step ORDER BY sort, id", null).use { c ->
            while (c.moveToNext()) steps.getOrPut(c.getLong(1)) { ArrayList() }.add(GoalStep(c.getLong(0), c.getString(2), c.getInt(3) == 1, c.getInt(4)))
        }
        val links = HashMap<Long, MutableList<Long>>()
        db.rawQuery("SELECT goal_id, habit_id FROM goal_habit", null).use { c -> while (c.moveToNext()) links.getOrPut(c.getLong(0)) { ArrayList() }.add(c.getLong(1)) }
        val out = ArrayList<Goal>()
        db.rawQuery("SELECT * FROM goal ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PAUSED' THEN 1 ELSE 2 END, deadline IS NULL, deadline, id", null).use { c ->
            while (c.moveToNext()) {
                val id = c.long("id")
                out.add(Goal(id, c.str("name"), c.str("description"), Category.of(c.str("category")), GoalHorizon.valueOf(c.str("horizon")),
                    LocalDate.ofEpochDay(c.long("created_day")), c.longOrNull("deadline")?.let { LocalDate.ofEpochDay(it) }, c.dbl("target"), c.dbl("current"),
                    c.str("unit"), GoalProgressMode.valueOf(c.str("mode")), GoalStatus.valueOf(c.str("status")), c.str("emoji"),
                    steps[id] ?: emptyList(), links[id] ?: emptyList(), c.longOrNull("completed_day")?.let { LocalDate.ofEpochDay(it) }, c.int("demo") == 1))
            }
        }
        return out
    }

    fun goal(id: Long): Goal? = goals().firstOrNull { it.id == id }

    fun saveGoal(g: Goal): Long {
        val cv = ContentValues().apply {
            put("name", g.name.trim()); put("description", g.description.trim()); put("category", g.category.name); put("horizon", g.horizon.name)
            put("emoji", g.emoji); put("created_day", g.createdDay.toEpochDay()); putOrNull("deadline", g.deadline?.toEpochDay())
            put("target", g.target); put("current", g.current); put("unit", g.unit.trim()); put("mode", g.mode.name); put("status", g.status.name)
            putOrNull("completed_day", g.completedDay?.toEpochDay()); put("demo", if (g.demo) 1 else 0)
        }
        val id = tx {
            val gid = if (g.id == 0L) db.insertOrThrow("goal", null, cv) else { db.update("goal", cv, "id = ?", arrayOf(g.id.toString())); g.id }
            db.delete("goal_step", "goal_id = ?", arrayOf(gid.toString()))
            g.steps.forEachIndexed { i, s -> db.execSQL("INSERT INTO goal_step(goal_id, title, done, sort) VALUES (?, ?, ?, ?)", arrayOf<Any>(gid, s.title, if (s.done) 1 else 0, i)) }
            db.delete("goal_habit", "goal_id = ?", arrayOf(gid.toString()))
            g.habitIds.distinct().forEach { db.execSQL("INSERT OR IGNORE INTO goal_habit(goal_id, habit_id) VALUES (?, ?)", arrayOf<Any>(gid, it)) }
            gid
        }
        notifyChanged(); return id
    }

    fun deleteGoal(id: Long) { tx { db.delete("goal", "id = ?", arrayOf(id.toString())) }; notifyChanged() }

    /** Progresso 0..1 de um objetivo conforme o modo. */
    fun goalProgress(g: Goal, today: LocalDate = LocalDate.now()): Double = when (g.mode) {
        GoalProgressMode.MANUAL -> if (g.target <= 0) 0.0 else (g.current / g.target).coerceIn(0.0, 1.0)
        GoalProgressMode.STEPS -> if (g.steps.isEmpty()) 0.0 else g.steps.count { it.done }.toDouble() / g.steps.size
        GoalProgressMode.HABITS -> if (g.target <= 0) 0.0 else (goalHabitDays(g, today) / g.target).coerceIn(0.0, 1.0)
    }

    /** Dias (desde a criação do objetivo) em que pelo menos um hábito relacionado foi concluído / evitado. */
    fun goalHabitDays(g: Goal, today: LocalDate = LocalDate.now()): Double {
        if (g.habitIds.isEmpty()) return 0.0
        val hs = habits(true).filter { it.id in g.habitIds }
        val logs = logsInRange(g.createdDay, today)
        val days = HashSet<LocalDate>()
        for (h in hs) for ((d, l) in logs[h.id].orEmpty()) {
            if (h.isPositive && Schedule.isDone(h, l)) days.add(d)
            if (h.isNegative && Schedule.withinLimit(h, l)) days.add(d)
        }
        return days.size.toDouble()
    }

    // ------------------------------------------------------------------ Descanso
    fun restDays(): RestDays = synchronized(cacheLock) { restCache }
        ?: RestDays(Weekdays(settings.restWeekdays), db.daySet("SELECT day FROM rest_day")).also { synchronized(cacheLock) { restCache = it } }

    fun setRestDate(day: LocalDate, rest: Boolean) {
        tx {
            if (rest) db.execSQL("INSERT OR IGNORE INTO rest_day(day) VALUES (?)", arrayOf<Any>(day.toEpochDay()))
            else db.delete("rest_day", "day = ?", arrayOf(day.toEpochDay().toString()))
        }
        recomputeScore(day); notifyChanged()
    }

    // ------------------------------------------------------------------ Score
    fun firstDay(): LocalDate? {
        val a = db.longQuery("SELECT MIN(d) FROM (SELECT MIN(day) d FROM habit_log UNION ALL SELECT MIN(day) FROM mood UNION ALL SELECT MIN(start_day) FROM habit)")
        return a?.let { LocalDate.ofEpochDay(it) }
    }

    fun dayScore(day: LocalDate): DayScore =
        ScoreEngine.compute(day, habits(true), logsForDay(day), mood(day), settings.weights, restDays())

    /** Scores calculados para um intervalo (uma consulta por tabela). */
    fun scoresInRange(from: LocalDate, to: LocalDate): List<DayScore> {
        val hs = habits(true); val logs = logsInRange(from, to); val moods = moodsInRange(from, to)
        val w = settings.weights; val rest = restDays()
        val out = ArrayList<DayScore>()
        var d = from
        while (!d.isAfter(to)) {
            val dayLogs = HashMap<Long, HabitLog>()
            for ((hid, m) in logs) m[d]?.let { dayLogs[hid] = it }
            out.add(ScoreEngine.compute(d, hs, dayLogs, moods[d], w, rest))
            d = d.plusDays(1)
        }
        return out
    }

    fun recomputeScore(day: LocalDate) = storeScores(listOf(dayScore(day)))

    fun recomputeScoresFrom(from: LocalDate) {
        val today = LocalDate.now()
        val start = maxOf(from, firstDay() ?: from)
        if (start.isAfter(today)) return
        storeScores(scoresInRange(start, today))
    }

    fun recomputeAllScores() {
        val first = firstDay() ?: return
        tx { db.delete("daily_score", null, null) }
        recomputeScoresFrom(first)
    }

    private fun storeScores(list: List<DayScore>) {
        tx {
            val now = System.currentTimeMillis()
            for (s in list) {
                if (s.score == null) { db.delete("daily_score", "day = ?", arrayOf(s.day.toEpochDay().toString())); continue }
                val cv = ContentValues().apply {
                    put("day", s.day.toEpochDay()); put("score", s.score)
                    putOrNull("positive", s.component(Component.POSITIVE).value); putOrNull("negative", s.component(Component.NEGATIVE).value)
                    putOrNull("wellbeing", s.component(Component.WELLBEING).value); put("computed_at", now)
                }
                db.insertWithOnConflict("daily_score", null, cv, SQLiteDatabase.CONFLICT_REPLACE)
            }
        }
    }

    /** Histórico de score salvo (dia -> score). */
    fun storedScores(from: LocalDate, to: LocalDate): Map<LocalDate, Int> {
        val m = LinkedHashMap<LocalDate, Int>()
        db.rawQuery("SELECT day, score FROM daily_score WHERE score IS NOT NULL AND day BETWEEN ? AND ? ORDER BY day", arrayOf(from.toEpochDay().toString(), to.toEpochDay().toString())).use { c ->
            while (c.moveToNext()) m[LocalDate.ofEpochDay(c.getLong(0))] = c.getInt(1)
        }
        return m
    }

    fun bestScore(): Pair<LocalDate, Int>? =
        db.rawQuery("SELECT day, score FROM daily_score WHERE score IS NOT NULL ORDER BY score DESC, day DESC LIMIT 1", null).use { c ->
            if (c.moveToFirst()) Pair(LocalDate.ofEpochDay(c.getLong(0)), c.getInt(1)) else null
        }

    // ------------------------------------------------------------------ Consistência
    fun consistency(today: LocalDate = LocalDate.now()): ConsistencySummary =
        ConsistencyEngine.compute(moodDays(), habitLogDays(), settings.streakCriterion, restDays(), today, null)

    // ------------------------------------------------------------------ Análises
    fun dayRecords(from: LocalDate, to: LocalDate): List<DayRecord> {
        val hs = habits(true); val logs = logsInRange(from, to); val moods = moodsInRange(from, to); val rest = restDays()
        val scores = storedScores(from, to)
        val out = ArrayList<DayRecord>()
        var d = from
        while (!d.isAfter(to)) {
            val done = HashMap<Long, Boolean>(); val values = HashMap<Long, Double>()
            var sched = 0; var ok = 0
            for (h in hs) {
                val l = logs[h.id]?.get(d)
                if (l != null) values[h.id] = l.value
                if (h.isPositive) {
                    if (Schedule.isScheduled(h, d, rest)) { val dn = Schedule.isDone(h, l); done[h.id] = dn; sched++; if (dn) ok++ }
                    else if (Schedule.isVisibleOn(h, d) && Schedule.isDone(h, l)) done[h.id] = true
                }
            }
            val m = moods[d]
            val s = scores[d]
            if (m != null || values.isNotEmpty()) {
                out.add(DayRecord(d, m?.mood, m?.energy, m?.stress, m?.sleep, s, if (sched == 0) null else ok.toDouble() / sched, done, values))
            }
            d = d.plusDays(1)
        }
        return out
    }

    fun summary(from: LocalDate, to: LocalDate, today: LocalDate = LocalDate.now()): app.broto.core.report.PeriodSummary {
        val scores = storedScores(from, minOf(to, today))
        return app.broto.core.report.PeriodSummary.build(from, to, today, habits(true).filter { !it.archived || logsInRange(from, to).containsKey(it.id) },
            logsInRange(from, to), moodsInRange(from, to), scores, restDays())
    }

    // ------------------------------------------------------------------ Alertas
    fun lastSentAlerts(): Map<String, Long> {
        val m = HashMap<String, Long>()
        db.rawQuery("SELECT key, MAX(sent_at) FROM alert_log GROUP BY key", null).use { c -> while (c.moveToNext()) m[c.getString(0)] = c.getLong(1) }
        return m
    }

    fun smartAlertsSentSince(since: Long): Int =
        (db.longQuery("SELECT COUNT(*) FROM alert_log WHERE sent_at >= $since AND category NOT IN ('HABIT_REMINDER')") ?: 0L).toInt()

    fun recordAlert(key: String, category: AlertCategory) {
        tx {
            db.execSQL("INSERT INTO alert_log(key, category, sent_at) VALUES (?, ?, ?)", arrayOf<Any>(key, category.name, System.currentTimeMillis()))
            db.execSQL("DELETE FROM alert_log WHERE sent_at < ?", arrayOf<Any>(System.currentTimeMillis() - 90L * 86_400_000L))
        }
    }

    fun alertSettings(): AlertSettings = settings.alertSettings

    // ------------------------------------------------------------------ Demonstração
    fun hasDemoData(): Boolean = (db.longQuery("SELECT (SELECT COUNT(*) FROM habit WHERE demo = 1) + (SELECT COUNT(*) FROM mood WHERE demo = 1) + (SELECT COUNT(*) FROM journal WHERE demo = 1) + (SELECT COUNT(*) FROM goal WHERE demo = 1)") ?: 0L) > 0

    fun clearDemoData() {
        tx {
            db.delete("habit", "demo = 1", null); db.delete("mood", "demo = 1", null)
            db.delete("journal", "demo = 1", null); db.delete("goal", "demo = 1", null)
        }
        recomputeAllScores(); notifyChanged()
    }

    fun counts(): Map<String, Int> = linkedMapOf(
        "Hábitos" to (db.longQuery("SELECT COUNT(*) FROM habit") ?: 0L).toInt(),
        "Registros de hábitos" to (db.longQuery("SELECT COUNT(*) FROM habit_log") ?: 0L).toInt(),
        "Dias de humor" to (db.longQuery("SELECT COUNT(*) FROM mood") ?: 0L).toInt(),
        "Entradas do diário" to journalCount(),
        "Objetivos" to (db.longQuery("SELECT COUNT(*) FROM goal") ?: 0L).toInt(),
    )

    companion object {
        @Volatile private var instance: Repo? = null
        fun get(context: Context): Repo = instance ?: synchronized(this) { instance ?: Repo(context, BrotoDatabase.DB_NAME).also { instance = it } }

        /** Só para testes: banco em memória isolado. */
        fun inMemory(context: Context): Repo = Repo(context, null)

        /** Fecha a instância atual (usado ao restaurar backup). */
        fun reset() = synchronized(this) { instance?.helper?.close(); instance = null }
    }
}

// ---- utilitários de Cursor/ContentValues
fun Cursor.long(col: String): Long = getLong(getColumnIndexOrThrow(col))
fun Cursor.longOrNull(col: String): Long? = getColumnIndexOrThrow(col).let { if (isNull(it)) null else getLong(it) }
fun Cursor.int(col: String): Int = getInt(getColumnIndexOrThrow(col))
fun Cursor.intOrNull(col: String): Int? = getColumnIndexOrThrow(col).let { if (isNull(it)) null else getInt(it) }
fun Cursor.str(col: String): String = getString(getColumnIndexOrThrow(col)) ?: ""
fun Cursor.dbl(col: String): Double = getDouble(getColumnIndexOrThrow(col))
fun ContentValues.putOrNull(k: String, v: Int?) { if (v == null) putNull(k) else put(k, v) }
fun ContentValues.putOrNull(k: String, v: Long?) { if (v == null) putNull(k) else put(k, v) }
fun ContentValues.putOrNull(k: String, v: Double?) { if (v == null) putNull(k) else put(k, v) }
fun SQLiteDatabase.longQuery(sql: String): Long? = rawQuery(sql, null).use { c -> if (c.moveToFirst() && !c.isNull(0)) c.getLong(0) else null }
fun SQLiteDatabase.daySet(sql: String): Set<LocalDate> {
    val s = HashSet<LocalDate>()
    rawQuery(sql, null).use { c -> while (c.moveToNext()) s.add(LocalDate.ofEpochDay(c.getLong(0))) }
    return s
}
