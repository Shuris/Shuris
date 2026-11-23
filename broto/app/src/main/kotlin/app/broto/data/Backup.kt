package app.broto.data

import android.content.Context
import android.database.Cursor
import app.broto.core.json.Json
import java.io.File
import java.security.SecureRandom
import java.time.LocalDate
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * Backup completo em JSON (todas as tabelas, incluindo histórico de score e configurações).
 * Opcionalmente criptografado com senha (AES-256-GCM, chave derivada por PBKDF2).
 * A restauração acontece numa única transação: se algo falhar, nada é alterado.
 */
object Backup {
    const val FORMAT = 1
    class BackupException(msg: String) : Exception(msg)
    class PasswordRequired : Exception("Este backup está protegido por senha.")

    data class Info(val exportedAt: String, val schema: Int, val counts: Map<String, Int>, val encrypted: Boolean)

    fun export(repo: Repo): String {
        val db = repo.db
        val tables = LinkedHashMap<String, Any?>()
        for (t in BrotoDatabase.TABLES) {
            val rows = ArrayList<Map<String, Any?>>()
            db.rawQuery("SELECT * FROM $t", null).use { c -> while (c.moveToNext()) rows.add(row(c)) }
            tables[t] = rows
        }
        return Json.write(linkedMapOf("app" to "Broto", "format" to FORMAT, "schema" to BrotoDatabase.VERSION,
            "exportedAt" to java.time.LocalDateTime.now().withNano(0).toString(), "tables" to tables))
    }

    private fun row(c: Cursor): Map<String, Any?> {
        val m = LinkedHashMap<String, Any?>()
        for (i in 0 until c.columnCount) {
            m[c.getColumnName(i)] = when (c.getType(i)) {
                Cursor.FIELD_TYPE_NULL -> null
                Cursor.FIELD_TYPE_INTEGER -> c.getLong(i)
                Cursor.FIELD_TYPE_FLOAT -> c.getDouble(i)
                else -> c.getString(i)
            }
        }
        return m
    }

    // ------------------------------------------------------------------ criptografia
    private const val ITER = 120_000

    private fun key(password: String, salt: ByteArray): SecretKeySpec {
        val f = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        return SecretKeySpec(f.generateSecret(PBEKeySpec(password.toCharArray(), salt, ITER, 256)).encoded, "AES")
    }

    fun encrypt(plain: String, password: String): String {
        val rnd = SecureRandom()
        val salt = ByteArray(16).also { rnd.nextBytes(it) }
        val iv = ByteArray(12).also { rnd.nextBytes(it) }
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, key(password, salt), GCMParameterSpec(128, iv))
        val enc = c.doFinal(plain.toByteArray(Charsets.UTF_8))
        val b64 = Base64.getEncoder()
        return Json.write(linkedMapOf("app" to "Broto", "format" to FORMAT, "encrypted" to true, "kdf" to "PBKDF2WithHmacSHA256", "iterations" to ITER,
            "salt" to b64.encodeToString(salt), "iv" to b64.encodeToString(iv), "data" to b64.encodeToString(enc)))
    }

    @Suppress("UNCHECKED_CAST")
    private fun decryptIfNeeded(text: String, password: String?): Map<String, Any?> {
        val root = try { Json.parse(text) as? Map<String, Any?> } catch (e: Exception) { null } ?: throw BackupException("O arquivo não é um backup válido do Broto.")
        if (root["app"] != "Broto") throw BackupException("O arquivo não é um backup do Broto.")
        if (root["encrypted"] != true) return root
        if (password.isNullOrEmpty()) throw PasswordRequired()
        val b64 = Base64.getDecoder()
        try {
            val c = Cipher.getInstance("AES/GCM/NoPadding")
            c.init(Cipher.DECRYPT_MODE, key(password, b64.decode(root["salt"] as String)), GCMParameterSpec(128, b64.decode(root["iv"] as String)))
            val plain = String(c.doFinal(b64.decode(root["data"] as String)), Charsets.UTF_8)
            return Json.parse(plain) as Map<String, Any?>
        } catch (e: javax.crypto.AEADBadTagException) {
            throw BackupException("Senha incorreta.")
        } catch (e: Exception) {
            throw BackupException("Não foi possível descriptografar o backup.")
        }
    }

    fun isEncrypted(text: String): Boolean = try { (Json.parse(text) as? Map<*, *>)?.get("encrypted") == true } catch (e: Exception) { false }

    @Suppress("UNCHECKED_CAST")
    fun inspect(text: String, password: String? = null): Info {
        val root = decryptIfNeeded(text, password)
        val tables = root["tables"] as? Map<String, Any?> ?: throw BackupException("Backup sem dados.")
        return Info(root["exportedAt"] as? String ?: "?", (root["schema"] as? Number)?.toInt() ?: 0,
            tables.mapValues { (it.value as? List<*>)?.size ?: 0 }, isEncrypted(text))
    }

    /** Substitui todos os dados pelos do backup, numa transação. */
    @Suppress("UNCHECKED_CAST")
    fun restore(repo: Repo, text: String, password: String? = null) {
        val root = decryptIfNeeded(text, password)
        val format = (root["format"] as? Number)?.toInt() ?: 0
        if (format > FORMAT) throw BackupException("Este backup foi feito por uma versão mais nova do app.")
        val schema = (root["schema"] as? Number)?.toInt() ?: 0
        if (schema > BrotoDatabase.VERSION) throw BackupException("Este backup foi feito por uma versão mais nova do app.")
        val tables = root["tables"] as? Map<String, Any?> ?: throw BackupException("Backup sem dados.")
        if ("habit" !in tables || "mood" !in tables) throw BackupException("Backup incompleto.")
        val db = repo.db
        val columns = BrotoDatabase.TABLES.associateWith { t -> db.rawQuery("PRAGMA table_info($t)", null).use { c -> val s = HashSet<String>(); while (c.moveToNext()) s.add(c.getString(1)); s } }
        db.beginTransaction()
        try {
            for (t in BrotoDatabase.TABLES.reversed()) db.delete(t, null, null)
            for (t in BrotoDatabase.TABLES) {
                val rows = tables[t] as? List<*> ?: continue
                for (r in rows) {
                    val m = r as? Map<String, Any?> ?: throw BackupException("Linha inválida em $t.")
                    val cols = m.keys.filter { it in columns[t]!! }
                    if (cols.isEmpty()) continue
                    val sql = "INSERT INTO $t (${cols.joinToString(",")}) VALUES (${cols.joinToString(",") { "?" }})"
                    val st = db.compileStatement(sql)
                    cols.forEachIndexed { i, k ->
                        when (val v = m[k]) {
                            null -> st.bindNull(i + 1)
                            is Long -> st.bindLong(i + 1, v)
                            is Int -> st.bindLong(i + 1, v.toLong())
                            is Double -> st.bindDouble(i + 1, v)
                            is Boolean -> st.bindLong(i + 1, if (v) 1 else 0)
                            else -> st.bindString(i + 1, v.toString())
                        }
                    }
                    st.executeInsert(); st.close()
                }
            }
            // valida integridade referencial antes de confirmar
            db.rawQuery("PRAGMA foreign_key_check", null).use { c -> if (c.moveToFirst()) throw BackupException("O backup tem referências inconsistentes (${c.getString(0)}).") }
            db.setTransactionSuccessful()
        } catch (e: BackupException) { throw e
        } catch (e: Exception) { throw BackupException("Falha ao restaurar: ${e.message}")
        } finally { db.endTransaction() }
        repo.settings.clearCache()
        repo.notifyChanged()
    }

    // ------------------------------------------------------------------ cópias automáticas
    fun snapshotDir(ctx: Context) = File(ctx.filesDir, "snapshots").also { it.mkdirs() }

    fun snapshots(ctx: Context): List<File> = snapshotDir(ctx).listFiles { f -> f.name.endsWith(".json") }.orEmpty().sortedByDescending { it.name }

    /** Cópia local automática (uma por dia, mantém as 7 mais recentes). */
    fun autoSnapshot(ctx: Context, repo: Repo, force: Boolean = false, tag: String = "") : File? {
        val today = LocalDate.now()
        if (!force && repo.settings.lastAutoSnapshotDay == today.toEpochDay()) return null
        if (repo.counts().values.sum() == 0) return null
        val f = File(snapshotDir(ctx), "snapshot-$today${if (tag.isNotEmpty()) "-$tag" else ""}-${System.currentTimeMillis() % 100000}.json")
        val tmp = File(f.path + ".tmp")
        tmp.writeText(export(repo)); tmp.renameTo(f)
        repo.settings.lastAutoSnapshotDay = today.toEpochDay()
        snapshots(ctx).drop(7).forEach { it.delete() }
        return f
    }

    fun integrityOk(repo: Repo): Boolean = try {
        repo.db.rawQuery("PRAGMA quick_check", null).use { c -> c.moveToFirst() && c.getString(0) == "ok" }
    } catch (e: Exception) { false }

    // ------------------------------------------------------------------ CSV
    fun csv(repo: Repo): String {
        val first = repo.firstDay() ?: return "data\n"
        val today = LocalDate.now()
        val habits = repo.habits(true)
        val logs = repo.logsInRange(first, today); val moods = repo.moodsInRange(first, today); val scores = repo.storedScores(first, today)
        fun q(s: String) = "\"" + s.replace("\"", "\"\"") + "\""
        val sb = StringBuilder()
        sb.append((listOf("data", "score", "humor", "energia", "estresse", "sono", "emocoes", "relato") + habits.map { q(it.name) }).joinToString(";")).append('\n')
        var d = first
        while (!d.isAfter(today)) {
            val m = moods[d]
            val row = listOf(d.toString(), scores[d]?.toString() ?: "", m?.mood?.toString() ?: "", m?.energy?.toString() ?: "", m?.stress?.toString() ?: "", m?.sleep?.toString() ?: "",
                q(m?.emotions?.joinToString(", ") { it.label } ?: ""), q(m?.note ?: "")) + habits.map { h -> logs[h.id]?.get(d)?.value?.let { app.broto.ui.Fmt.num(it) } ?: "" }
            sb.append(row.joinToString(";")).append('\n')
            d = d.plusDays(1)
        }
        return "﻿" + sb.toString()
    }
}
