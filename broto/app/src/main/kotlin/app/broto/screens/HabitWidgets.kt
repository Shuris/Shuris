package app.broto.screens

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import app.broto.MainActivity
import app.broto.core.model.Frequency
import app.broto.core.model.Habit
import app.broto.core.model.HabitLog
import app.broto.core.model.Tracking
import app.broto.core.schedule.Schedule
import app.broto.core.streak.ConsistencyEngine
import app.broto.ui.*
import java.time.LocalDate

object HabitText {
    fun amount(h: Habit, v: Double): String = when (h.tracking) {
        Tracking.DURATION -> Fmt.minutes(v)
        Tracking.QUANTITY -> "${Fmt.num(v)}${if (h.unit.isNotBlank()) " " + h.unit else ""}"
        Tracking.BOOLEAN -> if (h.isNegative) Fmt.times(v.toInt()) else if (v > 0) "Feito" else "Não feito"
    }

    fun goal(h: Habit): String = if (h.isPositive) {
        val freq = if (h.frequency == Frequency.WEEKLY) "${h.timesPerWeek}x por semana" else if (h.weekdays.count == 7) "Todos os dias" else h.weekdays.days().joinToString(", ") { Fmt.dowShort(it) }
        when (h.tracking) {
            Tracking.BOOLEAN -> freq
            else -> "${amount(h, h.target)} · $freq"
        }
    } else {
        when {
            h.target <= 0 -> "Meta: evitar"
            h.tracking == Tracking.BOOLEAN -> "Limite: ${Fmt.times(h.target.toInt())} por dia"
            else -> "Limite: ${amount(h, h.target)} por dia"
        }
    }

    fun step(h: Habit): Double = when (h.tracking) {
        Tracking.DURATION -> if (h.target >= 60) 15.0 else 5.0
        Tracking.QUANTITY -> if (h.target >= 50) 10.0 else if (h.target >= 10) 5.0 else if (h.target < 3 && h.target != Math.floor(h.target)) 0.5 else 1.0
        Tracking.BOOLEAN -> 1.0
    }
}

/** Linha de hábito com o controle rápido adequado ao tipo. */
object HabitRow {
    fun build(act: MainActivity, h: Habit, day: LocalDate, log: HabitLog?, compact: Boolean = false): View {
        val repo = act.repo
        val row = LinearLayout(act).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        row.pad(0, if (compact) 7 else 10)
        row.emojiBubble(h.emoji, h.color, if (compact) 40 else 48)
        val texts = row.vertical {
            lp(0, WRAP, 1f, l = 12)
            text(h.name, if (compact) TextStyle.BODY_BOLD else TextStyle.SUBTITLE).ellipsize()
            val sub = subtitle(act, h, day, log)
            text(sub, TextStyle.CAPTION, Theme.p.textSoft).ellipsize().lp(WRAP, WRAP, t = 3)
        }
        texts.minimumHeight = act.dp(48); texts.gravity = Gravity.CENTER_VERTICAL
        texts.ripple(act.dpf(12)); texts.onClick { act.push(HabitDetailScreen(act, h.id)) }
        val ctl = control(act, h, day, log)
        row.addView(ctl)
        row.setOnLongClickListener { row.haptic(true); LogSheet.show(act, h, day); true }
        texts.setOnLongClickListener { texts.haptic(true); LogSheet.show(act, h, day); true }
        return row
    }

    private fun subtitle(act: MainActivity, h: Habit, day: LocalDate, log: HabitLog?): String {
        val repo = act.repo
        val parts = ArrayList<String>()
        if (h.isPositive) {
            if (h.frequency == Frequency.WEEKLY) {
                val c = Schedule.weeklyCount(h, repo.logsForHabit(h.id), day)
                parts.add("$c de ${h.timesPerWeek} nesta semana")
            } else if (h.tracking != Tracking.BOOLEAN) {
                parts.add("${HabitText.amount(h, log?.value ?: 0.0)} de ${HabitText.amount(h, h.target)}")
            } else parts.add(if (log == null) "Sem registro" else if (log.value > 0) "Concluído" else "Não feito")
        } else {
            parts.add(when {
                log == null -> HabitText.goal(h)
                log.value <= 0 -> "Não aconteceu 🌿"
                Schedule.withinLimit(h, log) -> "${HabitText.amount(h, log.value)} · dentro do limite"
                else -> "${HabitText.amount(h, log.value)} · acima do limite"
            })
        }
        val streak = ConsistencyEngine.habitStreak(h, repo.logsForHabit(h.id), repo.restDays(), day)
        if (streak >= 2) parts.add("🔥 $streak")
        return parts.joinToString("  ·  ")
    }

    private fun control(act: MainActivity, h: Habit, day: LocalDate, log: HabitLog?): View {
        val repo = act.repo
        if (h.isPositive && h.tracking == Tracking.BOOLEAN) {
            val done = log != null && log.value > 0
            val missed = log != null && log.value <= 0
            val v = CheckView(act, if (done) 2 else if (missed) 1 else 0)
            v.layoutParams = LinearLayout.LayoutParams(act.dp(48), act.dp(48))
            v.contentDescription = if (done) "Desmarcar ${h.name}" else "Marcar ${h.name}"
            v.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
            v.ripple(act.dpf(22), mask = true)
            v.setOnClickListener {
                v.haptic()
                if (done) {
                    val prev = log!!
                    repo.clearLog(h.id, day)
                    act.snack("${h.name} desmarcado.", "Desfazer") { repo.setLog(h.id, day, prev.value, prev.note) }
                } else { repo.setLog(h.id, day, 1.0); act.snack("${h.emoji} ${h.name} concluído!") }
            }
            v.setOnLongClickListener { v.haptic(true); LogSheet.show(act, h, day); true }
            return v
        }
        if (h.isPositive) {
            val box = LinearLayout(act).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
            val pr = Schedule.progress(h, log).toFloat()
            val ring = RingView(act, pr, if (pr >= 1f) Theme.p.primaryDark else Theme.p.primary, Theme.p.surfaceAlt, 5f)
            ring.centerText = if (pr >= 1f) "✓" else "${(pr * 100).toInt()}%"; ring.centerTextSp = 10f
            ring.setPadding(act.dp(3), act.dp(3), act.dp(3), act.dp(3))   // círculo de 42dp visível, área de toque de 48dp
            box.addView(ring, LinearLayout.LayoutParams(act.dp(48), act.dp(48)))
            box.iconButton(Icon.PLUS, Theme.p.deep, Theme.p.primarySoft, 38, 18) {
                val nv = (log?.value ?: 0.0) + HabitText.step(h)
                repo.setLog(h.id, day, nv)
                if ((log?.value ?: 0.0) < h.target && nv >= h.target) act.snack("${h.emoji} Meta de ${h.name} atingida! 🎉")
            }.lp(act.dp(48), act.dp(48), l = 2)
            ring.ripple(act.dpf(21)); ring.contentDescription = "Registrar quantidade de ${h.name}"
            ring.setOnClickListener { LogSheet.show(act, h, day) }
            return box
        }
        // negativo
        val t = TextView(act)
        val (label, bg, fg) = when {
            log == null -> Triple("Registrar", Theme.p.surfaceAlt, Theme.p.textSoft)
            log.value <= 0 -> Triple("✓ Evitado", Theme.p.primarySoft, Theme.p.deep)
            Schedule.withinLimit(h, log) -> Triple(shortAmount(h, log.value), Theme.blend(Theme.p.surface, Theme.p.yellow, 0.5f), Theme.p.text)
            else -> Triple(shortAmount(h, log.value) + " !", Theme.p.coralSoft, Theme.deepen(Theme.p.coral, 0.3f).let { if (Theme.p.dark) Theme.p.coral else it })
        }
        t.text = label; t.style(TextStyle.LABEL, fg); t.gravity = Gravity.CENTER
        t.background = android.graphics.drawable.InsetDrawable(rounded(bg, act.dpf(16)), 0, act.dp(6), 0, act.dp(6)); t.pad(12, 15); t.minWidth = act.dp(78); t.minHeight = act.dp(48)
        t.contentDescription = "Registrar ${h.name}: $label"
        t.setOnClickListener { LogSheet.show(act, h, day) }
        return t
    }

    private fun shortAmount(h: Habit, v: Double) = when (h.tracking) {
        Tracking.DURATION -> Fmt.minutes(v)
        Tracking.QUANTITY -> Fmt.num(v) + if (h.unit.isNotBlank() && h.unit.length <= 4) " ${h.unit}" else ""
        Tracking.BOOLEAN -> "${v.toInt()}x"
    }
}

/** Botão circular de concluído: 0 sem registro, 1 não feito, 2 feito. */
class CheckView(ctx: android.content.Context, private val state: Int) : View(ctx) {
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    private val icon = IconDrawable(Icon.CHECK, 0xFFFFFFFF.toInt(), dp(22), 2.6f)
    init { isClickable = false; importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO }
    override fun onDraw(c: Canvas) {
        val r = minOf(width, height) / 2f - dpf(3)
        val cx = width / 2f; val cy = height / 2f
        when (state) {
            2 -> { p.style = Paint.Style.FILL; p.color = Theme.p.primaryDark; c.drawCircle(cx, cy, r, p)
                icon.color = 0xFFFFFFFF.toInt(); icon.setBounds((cx - dp(11)).toInt(), (cy - dp(11)).toInt(), (cx + dp(11)).toInt(), (cy + dp(11)).toInt()); icon.draw(c) }
            1 -> { p.style = Paint.Style.FILL; p.color = Theme.p.coralSoft; c.drawCircle(cx, cy, r, p)
                p.style = Paint.Style.STROKE; p.strokeWidth = dpf(2.4f); p.strokeCap = Paint.Cap.ROUND; p.color = Theme.p.coral; c.drawLine(cx - dp(6), cy, cx + dp(6), cy, p) }
            else -> { p.style = Paint.Style.STROKE; p.strokeWidth = dpf(2.2f); p.color = Theme.p.outline.let { if (Theme.p.dark) Theme.p.textFaint else Theme.blend(it, Theme.p.primaryDark, 0.25f) }; c.drawCircle(cx, cy, r - dpf(1), p) }
        }
    }
}

/** Folha de registro detalhado de um hábito num dia. */
object LogSheet {
    fun show(act: MainActivity, h: Habit, day: LocalDate) {
        val repo = act.repo
        val log = repo.logsForDay(day)[h.id]
        val s = BottomSheet(act)
        s.content.horizontal {
            lp(MATCH, WRAP, t = 8, b = 6)
            emojiBubble(h.emoji, h.color, 50)
            vertical {
                lp(0, WRAP, 1f, l = 12)
                text(h.name, TextStyle.TITLE).ellipsize()
                text(Fmt.relative(day) + " · " + HabitText.goal(h), TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 2)
            }
        }
        fun save(v: Double) { repo.setLog(h.id, day, v); s.dismiss() }
        val c = s.content
        if (h.isPositive) {
            if (h.tracking == Tracking.BOOLEAN) {
                c.space(10)
                c.primaryButton("Concluído", Icon.CHECK) { save(1.0) }
                c.softButton("Não consegui hoje", color = Theme.p.surfaceAlt, textColor = Theme.p.text) { save(0.0); act.snack("Tudo bem. Amanhã é uma nova chance. 💚") }
            } else {
                c.text("Quanto você fez?", TextStyle.LABEL, Theme.p.textSoft).lp(WRAP, WRAP, t = 14, b = 6)
                var value = log?.value ?: 0.0
                val stepper = Stepper(act, value, HabitText.step(h)) { value = it }
                c.addView(stepper, LinearLayout.LayoutParams(WRAP, WRAP).apply { gravity = Gravity.CENTER_HORIZONTAL })
                c.text(if (h.tracking == Tracking.DURATION) "minutos" else h.unit.ifBlank { "unidades" }, TextStyle.CAPTION, Theme.p.textSoft) { gravity = Gravity.CENTER }.lp(MATCH, WRAP, t = 2, b = 10)
                val quick = if (h.tracking == Tracking.DURATION) listOf(15.0, 30.0, 60.0, h.target).distinct() else listOf(h.target / 2, h.target).filter { it > 0 }.distinct()
                c.flow {
                    for (q in quick) addView(Chip(act, (if (q == h.target) "Meta: " else "") + HabitText.amount(h, q), false).apply { onClick { stepper.set(q) } })
                }
                c.space(12)
                c.primaryButton("Salvar") { save(value) }
                c.softButton("Não fiz hoje", color = Theme.p.surfaceAlt, textColor = Theme.p.text) { save(0.0) }
            }
        } else {
            c.text("Registrar comportamentos que você quer reduzir ajuda a enxergar padrões, sem julgamentos.", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 6, b = 10)
            c.primaryButton("Não aconteceu 🌿", color = Theme.p.primaryDark) { save(0.0); act.snack("Boa! Mais um dia no seu controle.") }
            when (h.tracking) {
                Tracking.BOOLEAN -> {
                    c.softButton("Aconteceu uma vez", color = Theme.blend(Theme.p.surface, Theme.p.yellow, 0.55f), textColor = Theme.p.text) { save(1.0) }
                    c.text("Aconteceu várias vezes", TextStyle.LABEL, Theme.p.textSoft).lp(WRAP, WRAP, t = 14, b = 6)
                    var value = maxOf(log?.value ?: 2.0, 2.0)
                    val stepper = Stepper(act, value, 1.0, 2.0) { value = it }
                    c.horizontal {
                        addView(stepper); flexSpace()
                        softButton("Salvar", color = Theme.p.coralSoft, textColor = Theme.p.text) { save(value) }.lp(WRAP, WRAP)
                    }
                }
                else -> {
                    c.text(if (h.tracking == Tracking.DURATION) "Quanto tempo?" else "Quanto? (${h.unit.ifBlank { "vezes" }})", TextStyle.LABEL, Theme.p.textSoft).lp(WRAP, WRAP, t = 14, b = 6)
                    var value = log?.value ?: (if (h.tracking == Tracking.DURATION) 30.0 else 1.0)
                    val stepper = Stepper(act, value, HabitText.step(h)) { value = it }
                    c.addView(stepper, LinearLayout.LayoutParams(WRAP, WRAP).apply { gravity = Gravity.CENTER_HORIZONTAL })
                    if (h.tracking == Tracking.DURATION) c.flow {
                        setPadding(0, dp(10), 0, 0)
                        for (q in listOf(30.0, 60.0, 120.0, 180.0, 240.0)) addView(Chip(act, Fmt.minutes(q), false).apply { onClick { stepper.set(q) } })
                    }
                    if (h.target > 0) c.text("Seu limite: ${HabitText.amount(h, h.target)} por dia", TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 10)
                    c.space(8)
                    c.softButton("Salvar registro", color = Theme.p.coralSoft, textColor = Theme.p.text) {
                        save(value)
                        if (value > h.target) act.snack("Registrado. Perceber já é um passo importante. 💚")
                    }
                }
            }
        }
        if (log != null) c.ghostButton("Limpar registro (deixar sem registro)", Theme.p.textSoft) {
            repo.clearLog(h.id, day); s.dismiss()
            act.snack("Registro removido.", "Desfazer") { repo.setLog(h.id, day, log.value, log.note) }
        }
        s.show()
    }
}

/** Grade mensal reutilizável (segunda a domingo). */
object MonthGrid {
    fun build(ctx: android.content.Context, month: LocalDate, cellHeightDp: Int, cell: (LinearLayout, LocalDate?) -> Unit): LinearLayout {
        val grid = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL }
        grid.horizontal {
            for (d in java.time.DayOfWeek.values()) text(Fmt.dowShort(d), TextStyle.TINY, Theme.p.textFaint) { gravity = Gravity.CENTER }.lp(0, WRAP, 1f, b = 6)
        }
        val first = month.withDayOfMonth(1)
        val offset = first.dayOfWeek.value - 1
        val days = month.lengthOfMonth()
        val weeks = Math.ceil((offset + days) / 7.0).toInt()
        for (w in 0 until weeks) {
            grid.horizontal {
                for (i in 0 until 7) {
                    val idx = w * 7 + i - offset
                    val cellView = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER }
                    cellView.layoutParams = LinearLayout.LayoutParams(0, ctx.dp(cellHeightDp), 1f)
                    addView(cellView)
                    cell(cellView, if (idx in 0 until days) first.plusDays(idx.toLong()) else null)
                }
            }
        }
        return grid
    }
}

/** Faixa da semana para escolher o dia. */
object WeekStrip {
    fun build(act: MainActivity, selected: LocalDate, weekStart: LocalDate, progress: (LocalDate) -> Float?, onPick: (LocalDate) -> Unit, onShift: (Int) -> Unit): View {
        val today = LocalDate.now()
        val row = LinearLayout(act).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        row.iconButton(Icon.LEFT, Theme.p.textSoft, null, 34, 18, minTouchDp = 40) { onShift(-1) }.also { it.layoutParams.height = act.dp(48) }
        for (i in 0..6) {
            val d = weekStart.plusDays(i.toLong())
            val future = d.isAfter(today)
            val sel = d == selected
            row.vertical {
                lp(0, WRAP, 1f); gravity = Gravity.CENTER_HORIZONTAL; pad(0, 8)
                background = if (sel) rounded(Theme.p.primarySoft, dpf(18)) else null
                text(Fmt.dowShort(d.dayOfWeek).take(3), TextStyle.TINY, if (sel) Theme.p.deep else Theme.p.textSoft)
                val pr = if (future) null else progress(d)
                val dv = DrawView(act) { c, w, h ->
                    val pnt = Paint(Paint.ANTI_ALIAS_FLAG)
                    val r = minOf(w, h) / 2f - dpf(2)
                    pnt.style = Paint.Style.STROKE; pnt.strokeWidth = dpf(2.5f); pnt.strokeCap = Paint.Cap.ROUND
                    pnt.color = if (future) 0 else Theme.alpha(Theme.p.primaryDark, 0.15f)
                    c.drawCircle(w / 2f, h / 2f, r, pnt)
                    if (pr != null && pr > 0) { pnt.color = Theme.p.primaryDark; c.drawArc(RectF(w / 2f - r, h / 2f - r, w / 2f + r, h / 2f + r), -90f, 360f * pr, false, pnt) }
                    pnt.style = Paint.Style.FILL; pnt.textAlign = Paint.Align.CENTER; pnt.typeface = if (d == today) Fonts.extrabold else Fonts.bold
                    pnt.textSize = dpf(13); pnt.color = if (future) Theme.p.textFaint else Theme.p.text
                    c.drawText(d.dayOfMonth.toString(), w / 2f, h / 2f + dpf(4.5f), pnt)
                }
                addView(dv, LinearLayout.LayoutParams(dp(34), dp(34)).apply { topMargin = dp(4) })
                minimumHeight = dp(48)
                contentDescription = Fmt.longDate(d)
                if (!future) { onClick { it.haptic(); onPick(d) } }
            }
        }
        val canNext = weekStart.plusDays(7) <= today
        row.iconButton(Icon.RIGHT, if (canNext) Theme.p.textSoft else Theme.p.outline, null, 34, 18, minTouchDp = 40) { if (canNext) onShift(1) }.also { it.layoutParams.height = act.dp(48) }
        return row
    }
}
