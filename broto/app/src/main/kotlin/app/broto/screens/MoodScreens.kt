package app.broto.screens

import android.app.DatePickerDialog
import android.graphics.Paint
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import app.broto.MainActivity
import app.broto.core.model.Emotion
import app.broto.core.model.Mood
import app.broto.core.model.MoodEntry
import app.broto.ui.*
import java.time.LocalDate

class MoodScreen(act: MainActivity) : Screen(act) {
    private var month: LocalDate = LocalDate.now().withDayOfMonth(1)

    override fun build(): View {
        val today = LocalDate.now()
        val moods = repo.moodsInRange(month, month.plusMonths(1).minusDays(1))
        return page("Humor", "Seu calendário de emoções", back = false, actions = {
            iconButton(Icon.PLUS, Theme.p.deep, Theme.p.primarySoft, 44, 22) { act.push(MoodEditorScreen(act, today)) }
        }) {
            // ------- calendário
            card(padding = 16) {
                horizontal {
                    iconButton(Icon.LEFT, Theme.p.textSoft, null, 38, 20) { month = month.minusMonths(1); render() }
                    text(Fmt.monthYear(month), TextStyle.HEADLINE) { gravity = Gravity.CENTER; pad(6, 6); ripple(dpf(12)); onClick { pickMonth() } }.lp(0, WRAP, 1f)
                    val canNext = month.plusMonths(1) <= today
                    iconButton(Icon.RIGHT, if (canNext) Theme.p.textSoft else Theme.p.outline, null, 38, 20) { if (canNext) { month = month.plusMonths(1); render() } }
                }
                space(10)
                addView(MonthGrid.build(act, month, 58) { cell, d ->
                    if (d == null) return@build
                    val m = moods[d]
                    val future = d.isAfter(today)
                    cell.addView(DrawView(act) { c, w, h ->
                        val sz = minOf(w, h).toFloat()
                        if (m != null) MoodArt.draw(c, m.mood, (w - sz) / 2, 0f, sz * 0.98f, sprout = true)
                        else {
                            val p = Paint(Paint.ANTI_ALIAS_FLAG)
                            p.color = if (future) 0 else Theme.p.surfaceAlt
                            c.drawCircle(w / 2f, sz * 0.6f, sz * 0.34f, p)
                            if (d == today) { p.style = Paint.Style.STROKE; p.strokeWidth = dpf(1.6f); p.color = Theme.p.primaryDark; c.drawCircle(w / 2f, sz * 0.6f, sz * 0.34f, p) }
                        }
                    }, LinearLayout.LayoutParams(dp(40), dp(40)))
                    cell.text(d.dayOfMonth.toString(), TextStyle.TINY, if (d == today) Theme.p.primaryDark else if (future) Theme.p.textFaint else Theme.p.textSoft).lp(WRAP, WRAP, t = 1)
                    if (!future) { cell.ripple(dpf(14)); cell.onClick { MoodDaySheet.show(act, d) } }
                })
            }.enter()

            // ------- resumo do mês
            if (moods.isEmpty()) {
                card { emptyState("Nenhum registro neste mês", "Toque em um dia do calendário ou no + para registrar como você se sentiu.", 3) }
                return@page
            }
            card {
                text("Resumo de ${Fmt.month(month.monthValue)}", TextStyle.HEADLINE)
                val avg = moods.values.map { it.mood }.average()
                text("${Fmt.days(moods.size)} registrados · humor médio ${Fmt.num(Math.round(avg * 10) / 10.0)} (${Mood.of(Math.round(avg).toInt()).label.lowercase()})", TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 4, b = 12)
                horizontal {
                    for (lvl in 5 downTo 1) {
                        val n = moods.values.count { it.mood == lvl }
                        vertical {
                            lp(0, WRAP, 1f); gravity = Gravity.CENTER_HORIZONTAL
                            val iv = ImageView(context); iv.setImageDrawable(MoodFaceDrawable(lvl, dp(40))); iv.alpha = if (n == 0) 0.35f else 1f
                            addView(iv, LinearLayout.LayoutParams(dp(40), dp(40)))
                            text(n.toString(), TextStyle.BODY_BOLD).lp(WRAP, WRAP, t = 4)
                        }
                    }
                }
                drawing(-1, 14) { c, w, h ->
                    ChartPainter.stacked(c, android.graphics.RectF(0f, 0f, w.toFloat(), h.toFloat()), (5 downTo 1).map { l -> Pair(moods.values.count { it.mood == l }.toDouble(), Theme.moodColor(l)) }, h / 2f)
                }.lp(MATCH, dp(14), t = 12)
                val emoCount = moods.values.flatMap { it.emotions }.groupingBy { it }.eachCount().entries.sortedByDescending { it.value }.take(5)
                if (emoCount.isNotEmpty()) {
                    text("Emoções mais frequentes", TextStyle.LABEL, Theme.p.textSoft).lp(WRAP, WRAP, t = 16, b = 8)
                    flow(6, 6) { for ((e, n) in emoCount) addView(tagView("${e.emoji} ${e.label} · $n", if (e.positive) Theme.p.primary else Theme.p.coral)) }
                }
                val en = moods.values.mapNotNull { it.energy }; val st = moods.values.mapNotNull { it.stress }; val sl = moods.values.mapNotNull { it.sleep }
                if (en.isNotEmpty() || st.isNotEmpty()) {
                    horizontal {
                        lp(MATCH, WRAP, t = 14)
                        if (en.isNotEmpty()) pill("⚡ Energia", Fmt.num(Math.round(en.average() * 10) / 10.0))
                        if (st.isNotEmpty()) pill("🌧️ Estresse", Fmt.num(Math.round(st.average() * 10) / 10.0))
                        if (sl.isNotEmpty()) pill("🌙 Sono", Fmt.num(Math.round(sl.average() * 10) / 10.0))
                    }
                }
            }.enter(60)

            // ------- registros recentes
            section("Registros do mês")
            for ((i, m) in moods.values.sortedByDescending { it.day }.take(8).withIndex()) {
                card(padding = 14) {
                    horizontal {
                        gravity = Gravity.TOP
                        val iv = ImageView(context); iv.setImageDrawable(MoodFaceDrawable(m.mood, dp(46))); addView(iv, LinearLayout.LayoutParams(dp(46), dp(46)))
                        vertical {
                            lp(0, WRAP, 1f, l = 12)
                            horizontal {
                                text(Mood.of(m.mood).label, TextStyle.BODY_BOLD).lp(0, WRAP, 1f)
                                text(Fmt.relative(m.day), TextStyle.CAPTION, Theme.p.textSoft)
                            }
                            if (m.emotions.isNotEmpty()) text(m.emotions.joinToString("  ") { "${it.emoji} ${it.label}" }, TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 3)
                            if (m.note.isNotBlank()) text(m.note, TextStyle.BODY).ellipsize(2).lp(WRAP, WRAP, t = 6)
                        }
                    }
                }.clickable { MoodDaySheet.show(act, m.day) }.enter(80L + i * 30)
            }
        }
    }

    private fun LinearLayout.pill(label: String, v: String) {
        vertical {
            lp(0, WRAP, 1f); gravity = Gravity.CENTER_HORIZONTAL
            background = rounded(Theme.p.surfaceAlt, dpf(16)); pad(6, 10)
            (layoutParams as LinearLayout.LayoutParams).setMargins(dp(3), 0, dp(3), 0)
            text("$v/5", TextStyle.SUBTITLE)
            text(label, TextStyle.TINY, Theme.p.textSoft).lp(WRAP, WRAP, t = 2)
        }
    }

    private fun pickMonth() {
        val today = LocalDate.now()
        val s = BottomSheet(act)
        s.title("Ir para…")
        var year = month.year
        val first = repo.firstDay()?.year ?: today.year
        s.content.choiceChips((first..today.year).toList().reversed(), year, { it.toString() }) { year = it }
        s.content.space(12)
        s.content.flow(8, 8) {
            for (m in 1..12) addView(Chip(act, Fmt.monthShort(m).replaceFirstChar { it.uppercase() }, year == month.year && m == month.monthValue).apply {
                minWidth = dp(70)
                onClick {
                    val target = LocalDate.of(year, m, 1)
                    if (!target.isAfter(today)) { month = target; s.dismiss(); render() } else act.snack("Esse mês ainda não chegou. 🌱")
                }
            })
        }
        s.show()
    }
}

/** Detalhe de um dia no calendário de humor. */
object MoodDaySheet {
    fun show(act: MainActivity, day: LocalDate) {
        val repo = act.repo
        val m = repo.mood(day)
        val score = repo.dayScore(day)
        val s = BottomSheet(act)
        val c = s.content
        if (m == null) {
            s.title(Fmt.relative(day), "Sem registro de humor neste dia.")
            if (score.score != null) c.text("Score do dia: ${score.score}", TextStyle.BODY_BOLD).lp(WRAP, WRAP, b = 10)
            c.primaryButton("Registrar humor", Icon.PLUS) { s.dismiss(); act.push(MoodEditorScreen(act, day)) }
            s.show(); return
        }
        c.horizontal {
            lp(MATCH, WRAP, t = 8, b = 12)
            val iv = ImageView(act); iv.setImageDrawable(MoodFaceDrawable(m.mood, dp(78))); addView(iv, LinearLayout.LayoutParams(dp(78), dp(78)))
            vertical {
                lp(0, WRAP, 1f, l = 14)
                text(Fmt.relative(day), TextStyle.CAPTION, Theme.p.textSoft)
                text(Mood.of(m.mood).label, TextStyle.TITLE).lp(WRAP, WRAP, t = 2)
                if (score.score != null) text("Score do dia: ${score.score}/100", TextStyle.LABEL, Theme.p.primaryDark).lp(WRAP, WRAP, t = 6)
            }
        }
        if (m.emotions.isNotEmpty()) c.flow(6, 6) { for (e in m.emotions) addView(tagView("${e.emoji} ${e.label}", Theme.moodColor(m.mood))) }
        c.space(10)
        fun scale(label: String, v: Int?, color: Int, inverse: Boolean = false) {
            if (v == null) return
            c.horizontal {
                lp(MATCH, WRAP, t = 6)
                text(label, TextStyle.LABEL).lp(dp(92), WRAP)
                progressBar(v / 5f, color, 8).lp(0, dp(8), 1f)
                text("$v/5", TextStyle.LABEL, Theme.p.textSoft).lp(WRAP, WRAP, l = 8)
            }
        }
        scale("⚡ Energia", m.energy, Theme.p.yellow)
        scale("🌧️ Estresse", m.stress, Theme.p.coral)
        scale("🌙 Sono", m.sleep, Theme.habitColors[5])
        if (m.note.isNotBlank()) {
            c.card(color = Theme.p.surface, padding = 14) {
                lp(MATCH, WRAP, t = 14)
                text("Relato", TextStyle.LABEL, Theme.p.textSoft)
                text(m.note, TextStyle.BODY).lp(MATCH, WRAP, t = 4)
            }
        }
        c.softButton("Editar registro", Icon.EDIT) { s.dismiss(); act.push(MoodEditorScreen(act, day)) }
        s.show()
    }
}

class MoodEditorScreen(act: MainActivity, private var day: LocalDate, preset: Int? = null) : Screen(act) {
    private val existing = repo.mood(day)
    private var e: MoodEntry = existing?.copy(mood = preset ?: existing.mood) ?: MoodEntry(day, preset ?: 0)

    override fun build(): View = page(if (existing == null) "Registrar humor" else "Editar humor", Fmt.relative(day), actions = {
        iconButton(Icon.CALENDAR, Theme.p.text) {
            DatePickerDialog(act, { _, y, mo, d ->
                val nd = LocalDate.of(y, mo + 1, d)
                act.replace(MoodEditorScreen(act, nd, if (e.mood > 0) e.mood else null))
            }, day.year, day.monthValue - 1, day.dayOfMonth).apply { datePicker.maxDate = System.currentTimeMillis() }.show()
        }
        if (existing != null) iconButton(Icon.TRASH, Theme.p.coral) {
            confirm(act, "Apagar registro de humor?", "O registro de ${Fmt.relative(day).lowercase()} será removido.", "Apagar", true) { repo.deleteMood(day); act.back() }
        }
    }) {
        card(padding = 16) {
            text("Como foi seu dia?", TextStyle.HEADLINE) { gravity = Gravity.CENTER }.lp(MATCH, WRAP, b = 14)
            horizontal {
                for (lvl in 1..5) {
                    val sel = e.mood == lvl
                    vertical {
                        lp(0, WRAP, 1f); gravity = Gravity.CENTER_HORIZONTAL; pad(0, 6)
                        background = if (sel) rounded(Theme.blend(Theme.p.surface, Theme.moodColor(lvl), 0.3f), dpf(18)) else null
                        val sz = if (sel) 58 else 46
                        val iv = ImageView(context); iv.setImageDrawable(MoodFaceDrawable(lvl, dp(sz)))
                        if (e.mood != 0 && !sel) iv.alpha = 0.55f
                        addView(iv, LinearLayout.LayoutParams(dp(58), dp(sz)))
                        text(Mood.of(lvl).label, TextStyle.TINY, if (sel) Theme.p.text else Theme.p.textSoft).lp(WRAP, WRAP, t = 4)
                        contentDescription = Mood.of(lvl).label
                        onClick { e = e.copy(mood = lvl); render() }
                    }
                }
            }
        }
        card {
            scaleRow("⚡ Nível de energia", e.energy, "Exausto", "Cheio de energia") { e = e.copy(energy = it); render() }
            divider()
            scaleRow("🌧️ Nível de estresse", e.stress, "Tranquilo", "Muito estressado") { e = e.copy(stress = it); render() }
            divider()
            scaleRow("🌙 Qualidade do sono", e.sleep, "Péssima", "Ótima") { e = e.copy(sleep = it); render() }
            text("Toque de novo no número para deixar sem registro.", TextStyle.CAPTION, Theme.p.textFaint).lp(WRAP, WRAP, t = 6)
        }
        card {
            text("Emoções predominantes", TextStyle.SUBTITLE).lp(WRAP, WRAP, b = 10)
            multiChips(Emotion.values().toList(), e.emotions.toSet(), { "${it.emoji} ${it.label}" }) { sel -> e = e.copy(emotions = Emotion.values().filter { it in sel }) }
        }
        card {
            text("Como você está se sentindo hoje? O que aconteceu?", TextStyle.SUBTITLE).lp(WRAP, WRAP, b = 6)
            val f = field("Escreva livremente… (opcional)", e.note, multiline = true, minLines = 4)
            f.addTextChangedListener(watcher { e = e.copy(note = it) })
        }
        primaryButton(if (existing == null) "Salvar registro" else "Salvar alterações", Icon.CHECK) {
            if (e.mood == 0) { act.snack("Escolha uma carinha para o seu dia."); return@primaryButton }
            repo.saveMood(e.copy(day = day))
            act.back()
            act.snack(when (e.mood) { 5 -> "Que dia lindo! ✨"; 4 -> "Que bom! 🌱"; 3 -> "Registrado. 🌿"; else -> "Registrado. Cuide-se com carinho. 💚" })
            app.broto.AppEvents.afterCheckIn(act)
        }
    }

    private fun LinearLayout.scaleRow(label: String, value: Int?, low: String, high: String, onPick: (Int?) -> Unit) {
        text(label, TextStyle.BODY_BOLD).lp(WRAP, WRAP, t = 4, b = 8)
        horizontal {
            for (i in 1..5) {
                val sel = value == i
                text(i.toString(), TextStyle.BODY_BOLD, if (sel) Theme.p.onPrimary else Theme.p.textSoft) {
                    gravity = Gravity.CENTER
                    background = rounded(if (sel) Theme.p.primary else Theme.p.surfaceAlt, dpf(16))
                    layoutParams = LinearLayout.LayoutParams(0, dp(42), 1f).apply { setMargins(dp(3), 0, dp(3), 0) }
                    onClick { onPick(if (sel) null else i) }
                }
            }
        }
        horizontal {
            lp(MATCH, WRAP, t = 4, b = 4)
            text(low, TextStyle.TINY, Theme.p.textFaint).lp(0, WRAP, 1f)
            text(high, TextStyle.TINY, Theme.p.textFaint)
        }
    }
}
