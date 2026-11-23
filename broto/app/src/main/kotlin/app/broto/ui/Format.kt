package app.broto.ui

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.temporal.ChronoUnit
import java.util.Locale
import kotlin.math.roundToInt

object Fmt {
    val BR: Locale = Locale("pt", "BR")
    private val months = arrayOf("janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro")
    private val monthsShort = arrayOf("jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez")

    fun month(m: Int) = months[m - 1]
    fun monthShort(m: Int) = monthsShort[m - 1]
    fun monthYear(d: LocalDate) = "${month(d.monthValue).replaceFirstChar { it.uppercase() }} de ${d.year}"

    fun dow(d: DayOfWeek): String = when (d) {
        DayOfWeek.MONDAY -> "segunda-feira"; DayOfWeek.TUESDAY -> "terça-feira"; DayOfWeek.WEDNESDAY -> "quarta-feira"
        DayOfWeek.THURSDAY -> "quinta-feira"; DayOfWeek.FRIDAY -> "sexta-feira"; DayOfWeek.SATURDAY -> "sábado"; DayOfWeek.SUNDAY -> "domingo"
    }
    fun dowShort(d: DayOfWeek): String = when (d) {
        DayOfWeek.MONDAY -> "seg"; DayOfWeek.TUESDAY -> "ter"; DayOfWeek.WEDNESDAY -> "qua"; DayOfWeek.THURSDAY -> "qui"
        DayOfWeek.FRIDAY -> "sex"; DayOfWeek.SATURDAY -> "sáb"; DayOfWeek.SUNDAY -> "dom"
    }
    fun dowLetter(d: DayOfWeek): String = when (d) {
        DayOfWeek.MONDAY -> "S"; DayOfWeek.TUESDAY -> "T"; DayOfWeek.WEDNESDAY -> "Q"; DayOfWeek.THURSDAY -> "Q"
        DayOfWeek.FRIDAY -> "S"; DayOfWeek.SATURDAY -> "S"; DayOfWeek.SUNDAY -> "D"
    }

    /** "segunda-feira, 23 de novembro" */
    fun longDate(d: LocalDate) = "${dow(d.dayOfWeek)}, ${d.dayOfMonth} de ${month(d.monthValue)}"
    /** "23 de novembro de 2026" */
    fun fullDate(d: LocalDate) = "${d.dayOfMonth} de ${month(d.monthValue)} de ${d.year}"
    /** "23 nov" */
    fun shortDate(d: LocalDate) = "${d.dayOfMonth} ${monthShort(d.monthValue)}"
    fun numeric(d: LocalDate) = String.format(BR, "%02d/%02d/%04d", d.dayOfMonth, d.monthValue, d.year)

    fun relative(d: LocalDate, today: LocalDate = LocalDate.now()): String = when (ChronoUnit.DAYS.between(d, today)) {
        0L -> "Hoje"; 1L -> "Ontem"; -1L -> "Amanhã"
        else -> longDate(d).replaceFirstChar { it.uppercase() }
    }

    fun range(a: LocalDate, b: LocalDate): String = when {
        a == b -> fullDate(a)
        a.year == b.year && a.month == b.month -> "${a.dayOfMonth} a ${b.dayOfMonth} de ${month(a.monthValue)} de ${a.year}"
        a.year == b.year -> "${a.dayOfMonth} de ${month(a.monthValue)} a ${b.dayOfMonth} de ${month(b.monthValue)} de ${a.year}"
        else -> "${numeric(a)} a ${numeric(b)}"
    }

    fun time(min: Int) = String.format(BR, "%02d:%02d", min / 60, min % 60)
    fun time(t: LocalTime) = time(t.hour * 60 + t.minute)

    fun num(v: Double): String = if (Math.abs(v - Math.rint(v)) < 1e-9) v.toLong().toString() else String.format(BR, "%.1f", v)
    fun pct(v: Double) = "${(v * 100).roundToInt()}%"

    fun minutes(m: Double): String {
        val t = m.roundToInt()
        return when { t < 60 -> "$t min"; t % 60 == 0 -> "${t / 60} h"; else -> "${t / 60} h ${t % 60} min" }
    }

    fun days(n: Int) = if (n == 1) "1 dia" else "$n dias"
    fun times(n: Int) = if (n == 1) "1 vez" else "$n vezes"

    fun greeting(t: LocalTime = LocalTime.now()) = when (t.hour) { in 5..11 -> "Bom dia"; in 12..17 -> "Boa tarde"; else -> "Boa noite" }
}
