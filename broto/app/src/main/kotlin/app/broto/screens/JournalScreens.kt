package app.broto.screens

import android.app.DatePickerDialog
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import app.broto.MainActivity
import app.broto.core.model.Emotion
import app.broto.core.model.JournalEntry
import app.broto.ui.*
import java.time.LocalDate

class JournalScreen(act: MainActivity) : Screen(act) {
    enum class Period(val label: String) { ALL("Tudo"), WEEK("7 dias"), MONTH("30 dias"), YEAR("Este ano"), CUSTOM("Período…") }
    private var query = ""
    private var searching = false
    private var period = Period.ALL
    private var customFrom: LocalDate? = null
    private var customTo: LocalDate? = null
    private var tag: String? = null
    private var limit = 30

    private fun range(): Pair<LocalDate?, LocalDate?> {
        val t = LocalDate.now()
        return when (period) {
            Period.ALL -> Pair(null, null)
            Period.WEEK -> Pair(t.minusDays(6), t)
            Period.MONTH -> Pair(t.minusDays(29), t)
            Period.YEAR -> Pair(t.withDayOfYear(1), t)
            Period.CUSTOM -> Pair(customFrom, customTo)
        }
    }

    override fun build(): View {
        val (from, to) = range()
        val entries = repo.journal(query, from, to, limit + 1).filter { tag == null || it.tags.contains(tag) }
        val total = repo.journalCount()
        return page("Meu Diário", "${if (total == 1) "1 entrada" else "$total entradas"} · 🔒 privado neste aparelho", back = false, actions = {
            iconButton(Icon.SEARCH, if (searching) Theme.p.primaryDark else Theme.p.text) { searching = !searching; if (!searching) query = ""; render() }
            iconButton(Icon.PLUS, Theme.p.deep, Theme.p.primarySoft, 44, 22) { act.push(JournalEditorScreen(act, null)) }
        }) {
            if (searching) {
                val f = field("Buscar por palavras ou tags…", query)
                f.lp(MATCH, WRAP, b = 8)
                f.setOnEditorActionListener { v, _, _ -> query = v.text.toString(); render(); true }
                f.imeOptions = android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH
                if (query.isEmpty()) f.post { f.requestFocus() }
            }
            choiceChips(Period.values().toList(), period, { if (it == Period.CUSTOM && customFrom != null) "${Fmt.shortDate(customFrom!!)} – ${Fmt.shortDate(customTo!!)}" else it.label }) {
                if (it == Period.CUSTOM) pickRange() else { period = it; render() }
            }
            val tags = repo.allTags()
            if (tags.isNotEmpty()) {
                space(8)
                flow(6, 6) {
                    for (t in tags) addView(Chip(act, "#$t", tag == t, Theme.p.primaryDark).apply { onClick { tag = if (tag == t) null else t; render() } })
                }
            }
            space(10)
            if (total == 0) {
                card { emptyState("Seu diário está esperando", "Escreva sobre seu dia, pensamentos e sentimentos. Tudo fica só no seu aparelho.", 4, "Escrever agora") { act.push(JournalEditorScreen(act, null)) } }
                card(color = Theme.p.surfaceAlt) {
                    text("Ideias para começar", TextStyle.SUBTITLE).lp(WRAP, WRAP, b = 8)
                    for (q in JournalEditorScreen.PROMPTS) text("• $q", TextStyle.BODY, Theme.p.textSoft).lp(WRAP, WRAP, t = 3)
                }
                return@page
            }
            if (entries.isEmpty()) { emptyState("Nada encontrado", "Tente outras palavras ou outro período.", 3); return@page }
            var lastMonth = ""
            for ((i, e) in entries.take(limit).withIndex()) {
                val m = Fmt.monthYear(e.day)
                if (m != lastMonth) { text(m, TextStyle.LABEL, Theme.p.textSoft).lp(WRAP, WRAP, t = if (i == 0) 0 else 10, b = 8); lastMonth = m }
                addView(timelineItem(e, i == entries.take(limit).lastIndex).also { it.enter(minOf(i, 8) * 30L) })
            }
            if (entries.size > limit) softButton("Carregar mais", color = Theme.p.surfaceAlt, textColor = Theme.p.text) { limit += 30; render() }
        }
    }

    private fun timelineItem(e: JournalEntry, last: Boolean): View {
        val row = LinearLayout(act).apply { orientation = LinearLayout.HORIZONTAL }
        row.vertical {
            lp(act.dp(46), MATCH); gravity = Gravity.CENTER_HORIZONTAL
            text(e.day.dayOfMonth.toString(), TextStyle.HEADLINE)
            text(Fmt.dowShort(e.day.dayOfWeek), TextStyle.TINY, Theme.p.textSoft)
            if (!last) addView(View(act).apply { setBackgroundColor(Theme.p.outline) }, LinearLayout.LayoutParams(act.dp(2), 0, 1f).apply { topMargin = act.dp(6) })
        }
        row.card(padding = 16) {
            lp(0, WRAP, 1f, l = 6)
            if (e.title.isNotBlank()) text(e.title, TextStyle.SUBTITLE).ellipsize().lp(WRAP, WRAP, b = 4)
            text(e.body.ifBlank { "(sem texto)" }, TextStyle.BODY, Theme.p.textSoft).ellipsize(3)
            if (e.emotions.isNotEmpty() || e.tags.isNotEmpty()) {
                text((e.emotions.map { it.emoji } + e.tags.map { "#$it" }).joinToString("  "), TextStyle.CAPTION, Theme.p.primaryDark).ellipsize().lp(WRAP, WRAP, t = 8)
            }
        }.clickable { act.push(JournalEntryScreen(act, e.id)) }
        return row
    }

    private fun pickRange() {
        val t = LocalDate.now()
        val start = customFrom ?: t.minusDays(30)
        DatePickerDialog(act, { _, y, m, d ->
            val a = LocalDate.of(y, m + 1, d)
            DatePickerDialog(act, { _, y2, m2, d2 ->
                val b = LocalDate.of(y2, m2 + 1, d2)
                customFrom = minOf(a, b); customTo = maxOf(a, b); period = Period.CUSTOM; render()
            }, t.year, t.monthValue - 1, t.dayOfMonth).apply { setTitle("Até quando?"); datePicker.maxDate = System.currentTimeMillis() }.show()
        }, start.year, start.monthValue - 1, start.dayOfMonth).apply { setTitle("A partir de quando?"); datePicker.maxDate = System.currentTimeMillis() }.show()
    }
}

class JournalEntryScreen(act: MainActivity, private val id: Long) : Screen(act) {
    override fun build(): View {
        val e = repo.journalEntry(id) ?: return act.verticalLayout().also { it.post { if (visible) act.back() } }
        return page(Fmt.relative(e.day), Fmt.fullDate(e.day), actions = {
            iconButton(Icon.EDIT, Theme.p.text) { act.push(JournalEditorScreen(act, e.id)) }
            iconButton(Icon.TRASH, Theme.p.coral) {
                confirm(act, "Excluir entrada?", "Esta entrada do diário será apagada permanentemente.", "Excluir", true) { repo.deleteJournal(e.id); act.back(); act.snack("Entrada excluída.") }
            }
        }) {
            card(padding = 22) {
                drawing(-1, 34) { c, w, h -> Decor.sprig(c, w - dpf(16), h.toFloat(), dpf(32), Theme.alpha(Theme.p.primary, 0.6f), 30f) }
                if (e.title.isNotBlank()) text(e.title, TextStyle.TITLE).lp(MATCH, WRAP, b = 12)
                text(e.body, TextStyle.BODY) { setLineSpacing(dpf(5), 1f); setTextIsSelectable(true) }.lp(MATCH, WRAP)
                if (e.emotions.isNotEmpty() || e.tags.isNotEmpty()) {
                    divider()
                    flow(6, 6) {
                        for (em in e.emotions) addView(tagView("${em.emoji} ${em.label}", if (em.positive) Theme.p.primary else Theme.p.coral))
                        for (t in e.tags) addView(tagView("#$t", Theme.p.surfaceAlt))
                    }
                }
            }
            repo.mood(e.day)?.let { m ->
                card(color = Theme.p.surfaceAlt, padding = 14) {
                    horizontal {
                        val iv = android.widget.ImageView(context); iv.setImageDrawable(MoodFaceDrawable(m.mood, dp(40))); addView(iv, LinearLayout.LayoutParams(dp(40), dp(40)))
                        text("Neste dia seu humor foi ${app.broto.core.model.Mood.of(m.mood).label.lowercase()}.", TextStyle.BODY, Theme.p.textSoft).lp(0, WRAP, 1f, l = 12)
                    }
                }
            }
        }
    }
}

class JournalEditorScreen(act: MainActivity, private val id: Long?) : Screen(act) {
    private val original = id?.let { repo.journalEntry(it) }
    private var e = original ?: JournalEntry(day = LocalDate.now(), body = "")
    private var bodyField: EditText? = null
    private var tagsText = e.tags.joinToString(", ")

    companion object {
        val PROMPTS = listOf("O que aconteceu de importante hoje?", "Do que me orgulho?", "O que poderia ter feito melhor?", "O que aprendi?", "Pelo que sou grato?", "O que desejo realizar amanhã?")
    }

    private var saved = false

    private fun dirty(): Boolean = !saved && (original == null && (e.body.isNotBlank() || e.title.isNotBlank())) ||
        (original != null && (original.body != e.body || original.title != e.title || original.day != e.day || original.emotions != e.emotions || original.tags != parseTags()))

    override fun onBack(): Boolean {
        if (!dirty()) return false
        confirm(act, "Descartar alterações?", "O que você escreveu ainda não foi salvo.", "Descartar", true) { e = original ?: JournalEntry(day = e.day, body = ""); act.back() }
        return true
    }

    private fun parseTags() = tagsText.split(',', ' ', '#').map { it.trim() }.filter { it.isNotEmpty() }.distinct()

    override fun build(): View = page(if (original == null) "Nova entrada" else "Editar entrada", Fmt.relative(e.day), actions = {
        iconButton(Icon.CALENDAR, Theme.p.text) {
            DatePickerDialog(act, { _, y, m, d -> e = e.copy(day = LocalDate.of(y, m + 1, d)); render() }, e.day.year, e.day.monthValue - 1, e.day.dayOfMonth)
                .apply { datePicker.maxDate = System.currentTimeMillis() }.show()
        }
    }) {
        card(padding = 16) {
            val title = field("Título (opcional)", e.title)
            title.style(TextStyle.HEADLINE); title.setHintTextColor(Theme.p.textFaint)
            title.addTextChangedListener(watcher { e = e.copy(title = it) })
            val body = field("Escreva livremente sobre seu dia, pensamentos e sentimentos…", e.body, multiline = true, minLines = 9)
            body.setLineSpacing(dpf(4), 1f)
            body.addTextChangedListener(watcher { e = e.copy(body = it) })
            bodyField = body
        }
        text("Sugestões de reflexão (opcional)", TextStyle.LABEL, Theme.p.textSoft).lp(WRAP, WRAP, b = 8)
        flow(6, 6) {
            for (q in PROMPTS) addView(Chip(act, q, false).apply {
                onClick {
                    val f = bodyField ?: return@onClick
                    val prefix = if (f.text.isEmpty()) "" else if (f.text.endsWith("\n\n")) "" else if (f.text.endsWith("\n")) "\n" else "\n\n"
                    f.append("$prefix$q\n")
                    f.requestFocus(); f.setSelection(f.text.length)
                }
            })
        }
        space(14)
        card {
            text("Emoções", TextStyle.SUBTITLE).lp(WRAP, WRAP, b = 8)
            multiChips(Emotion.values().toList(), e.emotions.toSet(), { "${it.emoji} ${it.label}" }) { sel -> e = e.copy(emotions = Emotion.values().filter { it in sel }) }
            text("Tags", TextStyle.SUBTITLE).lp(WRAP, WRAP, t = 14, b = 2)
            val tf = field("ex.: trabalho, família, estudo", tagsText)
            tf.addTextChangedListener(watcher { tagsText = it })
            val existing = repo.allTags()
            if (existing.isNotEmpty()) flow(6, 6) {
                for (t in existing.take(12)) addView(Chip(act, "#$t", false).apply { onClick {
                    if (!parseTags().contains(t)) { tagsText = (parseTags() + t).joinToString(", "); tf.setText(tagsText) }
                } })
            }
        }
        primaryButton("Salvar", Icon.CHECK) {
            if (e.body.isBlank() && e.title.isBlank()) { act.snack("Escreva algo antes de salvar."); return@primaryButton }
            val newId = repo.saveJournal(e.copy(tags = parseTags()))
            e = repo.journalEntry(newId)!!; saved = true
            act.back()
            act.snack("Entrada salva no seu diário. 📖")
        }
    }
}
