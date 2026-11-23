package app.broto.core.json

/** JSON mínimo (escrita e leitura) usado no backup. Objetos -> LinkedHashMap, arrays -> List. */
object Json {
    fun write(v: Any?): String = StringBuilder().also { write(v, it) }.toString()

    private fun write(v: Any?, sb: StringBuilder) {
        when (v) {
            null -> sb.append("null")
            is String -> quote(v, sb)
            is Boolean -> sb.append(v)
            is Int, is Long, is Short, is Byte -> sb.append(v.toString())
            is Double -> if (v.isNaN() || v.isInfinite()) sb.append("null") else if (v == Math.floor(v) && Math.abs(v) < 1e15) sb.append(v.toLong()) else sb.append(v.toString())
            is Float -> write(v.toDouble(), sb)
            is Map<*, *> -> {
                sb.append('{')
                var first = true
                for ((k, value) in v) {
                    if (!first) sb.append(','); first = false
                    quote(k.toString(), sb); sb.append(':'); write(value, sb)
                }
                sb.append('}')
            }
            is Iterable<*> -> {
                sb.append('[')
                var first = true
                for (x in v) { if (!first) sb.append(','); first = false; write(x, sb) }
                sb.append(']')
            }
            else -> quote(v.toString(), sb)
        }
    }

    private fun quote(s: String, sb: StringBuilder) {
        sb.append('"')
        for (c in s) {
            when (c) {
                '"' -> sb.append("\\\"")
                '\\' -> sb.append("\\\\")
                '\n' -> sb.append("\\n")
                '\r' -> sb.append("\\r")
                '\t' -> sb.append("\\t")
                '\b' -> sb.append("\\b")
                '\u000C' -> sb.append("\\f")
                else -> if (c < ' ') sb.append(String.format("\\u%04x", c.code)) else sb.append(c)
            }
        }
        sb.append('"')
    }

    class ParseException(msg: String) : Exception(msg)

    fun parse(s: String): Any? {
        val p = Parser(s)
        p.ws()
        val v = p.value()
        p.ws()
        if (p.i != s.length) throw ParseException("Conteúdo extra na posição ${p.i}")
        return v
    }

    private class Parser(val s: String) {
        var i = 0
        fun ws() { while (i < s.length && s[i].isWhitespace()) i++ }
        fun value(): Any? {
            if (i >= s.length) throw ParseException("Fim inesperado")
            return when (val c = s[i]) {
                '{' -> obj()
                '[' -> arr()
                '"' -> str()
                't' -> lit("true", true)
                'f' -> lit("false", false)
                'n' -> lit("null", null)
                else -> if (c == '-' || c.isDigit()) num() else throw ParseException("Caractere inesperado '$c' em $i")
            }
        }
        fun lit(w: String, v: Any?): Any? { if (!s.startsWith(w, i)) throw ParseException("Esperado $w em $i"); i += w.length; return v }
        fun num(): Any {
            val st = i
            if (s[i] == '-') i++
            while (i < s.length && (s[i].isDigit() || s[i] in ".eE+-")) i++
            val t = s.substring(st, i)
            return if (t.any { it in ".eE" }) t.toDouble() else t.toLongOrNull() ?: t.toDouble()
        }
        fun str(): String {
            i++
            val sb = StringBuilder()
            while (true) {
                if (i >= s.length) throw ParseException("Texto não terminado")
                val c = s[i++]
                when (c) {
                    '"' -> return sb.toString()
                    '\\' -> {
                        val e = s[i++]
                        when (e) {
                            'n' -> sb.append('\n'); 'r' -> sb.append('\r'); 't' -> sb.append('\t'); 'b' -> sb.append('\b'); 'f' -> sb.append('\u000C')
                            'u' -> { sb.append(s.substring(i, i + 4).toInt(16).toChar()); i += 4 }
                            else -> sb.append(e)
                        }
                    }
                    else -> sb.append(c)
                }
            }
        }
        fun obj(): Map<String, Any?> {
            i++
            val m = LinkedHashMap<String, Any?>()
            ws()
            if (s[i] == '}') { i++; return m }
            while (true) {
                ws(); if (s[i] != '"') throw ParseException("Esperada chave em $i")
                val k = str(); ws()
                if (s[i++] != ':') throw ParseException("Esperado ':' em $i")
                ws(); m[k] = value(); ws()
                when (s[i++]) { ',' -> continue; '}' -> return m; else -> throw ParseException("Esperado ',' ou '}' em $i") }
            }
        }
        fun arr(): List<Any?> {
            i++
            val l = ArrayList<Any?>()
            ws()
            if (s[i] == ']') { i++; return l }
            while (true) {
                ws(); l.add(value()); ws()
                when (s[i++]) { ',' -> continue; ']' -> return l; else -> throw ParseException("Esperado ',' ou ']' em $i") }
            }
        }
    }
}

// Acesso tipado e tolerante a mapas vindos do JSON.
fun Map<String, Any?>.str(k: String, def: String = ""): String = (this[k] as? String) ?: def
fun Map<String, Any?>.strOrNull(k: String): String? = this[k] as? String
fun Map<String, Any?>.long(k: String, def: Long = 0): Long = (this[k] as? Number)?.toLong() ?: def
fun Map<String, Any?>.longOrNull(k: String): Long? = (this[k] as? Number)?.toLong()
fun Map<String, Any?>.int(k: String, def: Int = 0): Int = (this[k] as? Number)?.toInt() ?: def
fun Map<String, Any?>.intOrNull(k: String): Int? = (this[k] as? Number)?.toInt()
fun Map<String, Any?>.dbl(k: String, def: Double = 0.0): Double = (this[k] as? Number)?.toDouble() ?: def
fun Map<String, Any?>.bool(k: String, def: Boolean = false): Boolean = (this[k] as? Boolean) ?: def
@Suppress("UNCHECKED_CAST")
fun Map<String, Any?>.list(k: String): List<Map<String, Any?>> = (this[k] as? List<*>)?.filterIsInstance<Map<String, Any?>>() ?: emptyList()
