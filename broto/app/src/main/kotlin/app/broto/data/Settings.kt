package app.broto.data

import app.broto.core.alerts.AlertCategory
import app.broto.core.alerts.AlertSettings
import app.broto.core.model.ScoreWeights
import app.broto.core.model.StreakCriterion

/** Configurações guardadas no próprio banco (entram no backup). */
class Settings(private val repo: Repo) {
    private val cache = HashMap<String, String?>()

    fun get(key: String): String? {
        if (cache.containsKey(key)) return cache[key]
        val v = repo.db.rawQuery("SELECT value FROM settings WHERE key = ?", arrayOf(key)).use { c -> if (c.moveToFirst()) c.getString(0) else null }
        cache[key] = v
        return v
    }

    fun put(key: String, value: String?) {
        if (value == null) repo.db.delete("settings", "key = ?", arrayOf(key))
        else repo.db.execSQL("INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)", arrayOf<Any>(key, value))
        cache[key] = value
        repo.invalidateCaches()
    }

    fun clearCache() = cache.clear()

    fun all(): Map<String, String> {
        val m = LinkedHashMap<String, String>()
        repo.db.rawQuery("SELECT key, value FROM settings ORDER BY key", null).use { c -> while (c.moveToNext()) m[c.getString(0)] = c.getString(1) }
        return m
    }

    private fun int(key: String, def: Int) = get(key)?.toIntOrNull() ?: def
    private fun dbl(key: String, def: Double) = get(key)?.toDoubleOrNull() ?: def
    private fun bool(key: String, def: Boolean) = get(key)?.let { it == "1" } ?: def

    var userName: String
        get() = get("user_name") ?: ""
        set(v) = put("user_name", v.trim())

    /** "system", "light" ou "dark" */
    var theme: String
        get() = get("theme") ?: "system"
        set(v) = put("theme", v)

    var accent: String
        get() = get("accent") ?: "green"
        set(v) = put("accent", v)

    var onboarded: Boolean
        get() = bool("onboarded", false)
        set(v) = put("onboarded", if (v) "1" else "0")

    var weights: ScoreWeights
        get() = ScoreWeights(dbl("w_pos", 45.0), dbl("w_neg", 30.0), dbl("w_wb", 25.0))
        set(v) { put("w_pos", v.positive.toString()); put("w_neg", v.negative.toString()); put("w_wb", v.wellbeing.toString()) }

    var streakCriterion: StreakCriterion
        get() = StreakCriterion.values().firstOrNull { it.name == get("streak_criterion") } ?: StreakCriterion.ANY_CHECKIN
        set(v) = put("streak_criterion", v.name)

    /** Bitmask dos dias da semana de descanso. */
    var restWeekdays: Int
        get() = int("rest_weekdays", 0)
        set(v) = put("rest_weekdays", v.toString())

    var notificationsEnabled: Boolean
        get() = bool("notif_enabled", true)
        set(v) = put("notif_enabled", if (v) "1" else "0")

    var alertSettings: AlertSettings
        get() {
            val en = get("alert_categories")?.split(',')?.mapNotNull { s -> AlertCategory.values().firstOrNull { it.name == s } }?.toSet()
                ?: AlertCategory.values().toSet()
            return AlertSettings(en, int("alert_max_day", 3), int("quiet_start", 22 * 60), int("quiet_end", 8 * 60))
        }
        set(v) {
            put("alert_categories", v.enabled.joinToString(",") { it.name }); put("alert_max_day", v.maxPerDay.toString())
            put("quiet_start", v.quietStart.toString()); put("quiet_end", v.quietEnd.toString())
        }

    /** Horário da verificação diária de padrões (minutos). */
    var dailyCheckMinutes: Int
        get() = int("check_min", 19 * 60)
        set(v) = put("check_min", v.toString())

    /** Lembrete de humor (minutos) ou -1 desativado. */
    var moodReminderMinutes: Int
        get() = int("mood_rem_min", 21 * 60)
        set(v) = put("mood_rem_min", v.toString())

    var streakReminderMinutes: Int
        get() = int("streak_rem_min", 21 * 60 + 30)
        set(v) = put("streak_rem_min", v.toString())

    /** Horários (minutos) das notificações diárias de acompanhamento. Padrão: manhã, tarde e noite. */
    var checkInTimes: List<Int>
        get() = get("checkin_times")?.let { v -> if (v.isBlank()) emptyList() else v.split(',').mapNotNull { it.trim().toIntOrNull() }.filter { it in 0 until 1440 }.sorted() }
            ?: app.broto.core.alerts.CheckInEngine.defaultTimes(3)
        set(v) = put("checkin_times", v.distinct().sorted().joinToString(","))

    var reportIncludeJournal: Boolean
        get() = bool("report_journal", false)
        set(v) = put("report_journal", if (v) "1" else "0")

    var lastAutoSnapshotDay: Long
        get() = get("last_snapshot_day")?.toLongOrNull() ?: 0L
        set(v) = put("last_snapshot_day", v.toString())

    var lastCelebratedStreak: Int
        get() = int("last_celebrated_streak", 0)
        set(v) = put("last_celebrated_streak", v.toString())
}
