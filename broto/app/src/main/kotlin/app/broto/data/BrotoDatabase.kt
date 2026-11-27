package app.broto.data

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/** Banco SQLite local. Versão do esquema evolui com migrações em [onUpgrade]. */
class BrotoDatabase(context: Context, name: String? = DB_NAME) : SQLiteOpenHelper(context, name, null, VERSION) {

    init { setWriteAheadLoggingEnabled(true) }

    override fun onConfigure(db: SQLiteDatabase) {
        db.setForeignKeyConstraintsEnabled(true)
    }

    override fun onCreate(db: SQLiteDatabase) {
        for (sql in SCHEMA) db.execSQL(sql)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // v2: apps medidos automaticamente (tempo de tela) por hábito
        if (oldVersion < 2) for (sql in V2) db.execSQL(sql)
    }

    companion object {
        const val DB_NAME = "broto.db"
        const val VERSION = 2

        val V2 = listOf(
            """CREATE TABLE IF NOT EXISTS habit_app (
                habit_id INTEGER NOT NULL REFERENCES habit(id) ON DELETE CASCADE,
                package TEXT NOT NULL,
                PRIMARY KEY (habit_id, package)
            )""",
        )

        val TABLES = listOf("habit", "habit_app", "habit_pause", "habit_log", "mood", "journal", "goal", "goal_step", "goal_habit", "rest_day", "daily_score", "alert_log", "settings")

        val SCHEMA = listOf(
            """CREATE TABLE habit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL,
                emoji TEXT NOT NULL,
                color INTEGER NOT NULL,
                kind TEXT NOT NULL,
                tracking TEXT NOT NULL,
                unit TEXT NOT NULL DEFAULT '',
                target REAL NOT NULL DEFAULT 1,
                frequency TEXT NOT NULL DEFAULT 'DAILY',
                weekdays INTEGER NOT NULL DEFAULT 127,
                times_per_week INTEGER NOT NULL DEFAULT 3,
                reminder_min INTEGER,
                start_day INTEGER NOT NULL,
                paused INTEGER NOT NULL DEFAULT 0,
                archived INTEGER NOT NULL DEFAULT 0,
                sort INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                demo INTEGER NOT NULL DEFAULT 0
            )""",
            """CREATE TABLE habit_pause (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                habit_id INTEGER NOT NULL REFERENCES habit(id) ON DELETE CASCADE,
                from_day INTEGER NOT NULL,
                to_day INTEGER
            )""",
            "CREATE INDEX idx_pause_habit ON habit_pause(habit_id)",
            """CREATE TABLE habit_log (
                habit_id INTEGER NOT NULL REFERENCES habit(id) ON DELETE CASCADE,
                day INTEGER NOT NULL,
                value REAL NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (habit_id, day)
            )""",
            "CREATE INDEX idx_log_day ON habit_log(day)",
            """CREATE TABLE mood (
                day INTEGER PRIMARY KEY,
                mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5),
                energy INTEGER CHECK (energy BETWEEN 1 AND 5),
                stress INTEGER CHECK (stress BETWEEN 1 AND 5),
                sleep INTEGER CHECK (sleep BETWEEN 1 AND 5),
                emotions TEXT NOT NULL DEFAULT '',
                note TEXT NOT NULL DEFAULT '',
                updated_at INTEGER NOT NULL,
                demo INTEGER NOT NULL DEFAULT 0
            )""",
            """CREATE TABLE journal (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                day INTEGER NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                body TEXT NOT NULL,
                emotions TEXT NOT NULL DEFAULT '',
                tags TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                demo INTEGER NOT NULL DEFAULT 0
            )""",
            "CREATE INDEX idx_journal_day ON journal(day)",
            """CREATE TABLE goal (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL,
                horizon TEXT NOT NULL,
                emoji TEXT NOT NULL DEFAULT '🎯',
                created_day INTEGER NOT NULL,
                deadline INTEGER,
                target REAL NOT NULL DEFAULT 100,
                current REAL NOT NULL DEFAULT 0,
                unit TEXT NOT NULL DEFAULT '',
                mode TEXT NOT NULL DEFAULT 'MANUAL',
                status TEXT NOT NULL DEFAULT 'ACTIVE',
                completed_day INTEGER,
                demo INTEGER NOT NULL DEFAULT 0
            )""",
            """CREATE TABLE goal_step (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                goal_id INTEGER NOT NULL REFERENCES goal(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                done INTEGER NOT NULL DEFAULT 0,
                sort INTEGER NOT NULL DEFAULT 0
            )""",
            """CREATE TABLE goal_habit (
                goal_id INTEGER NOT NULL REFERENCES goal(id) ON DELETE CASCADE,
                habit_id INTEGER NOT NULL REFERENCES habit(id) ON DELETE CASCADE,
                PRIMARY KEY (goal_id, habit_id)
            )""",
            "CREATE TABLE rest_day (day INTEGER PRIMARY KEY)",
            """CREATE TABLE daily_score (
                day INTEGER PRIMARY KEY,
                score INTEGER,
                positive REAL,
                negative REAL,
                wellbeing REAL,
                computed_at INTEGER NOT NULL
            )""",
            "CREATE TABLE alert_log (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL, category TEXT NOT NULL, sent_at INTEGER NOT NULL)",
            "CREATE INDEX idx_alert_key ON alert_log(key)",
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
        ) + V2
    }
}
