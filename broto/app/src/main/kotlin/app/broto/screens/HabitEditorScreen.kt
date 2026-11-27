package app.broto.screens

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import app.broto.MainActivity
import app.broto.core.model.*
import app.broto.ui.*
import java.time.DayOfWeek
import java.time.LocalDate

class HabitEditorScreen(act: MainActivity, private val habitId: Long?) : Screen(act) {
    private var h: Habit = habitId?.let { repo.habit(it) } ?: Habit(name = "", startDate = LocalDate.now(), emoji = "🌱", category = Category.PERSONAL)
    private val isNew = habitId == null
    private val initial = h
    private var saved = false

    override fun onBack(): Boolean {
        if (saved || h == initial) return false
        confirm(act, "Descartar alterações?", if (isNew) "O hábito ainda não foi criado." else "As alterações neste hábito não foram salvas.", "Descartar", true) { saved = true; act.pop() }
        return true
    }

    data class Template(val h: Habit)

    private fun templates(): List<Habit> {
        val t = LocalDate.now()
        return listOf(
            Habit(name = "Ler", emoji = "📚", category = Category.PERSONAL, tracking = Tracking.QUANTITY, unit = "páginas", target = 20.0, color = Theme.habitColors[3], startDate = t),
            Habit(name = "Estudar", emoji = "🧠", category = Category.STUDY, tracking = Tracking.DURATION, unit = "min", target = 120.0, color = Theme.habitColors[4], startDate = t),
            Habit(name = "Exercício físico", emoji = "🏃", category = Category.EXERCISE, weekdays = Weekdays.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY), color = Theme.habitColors[1], startDate = t),
            Habit(name = "Beber água", emoji = "💧", category = Category.HEALTH, tracking = Tracking.QUANTITY, unit = "copos", target = 8.0, color = Theme.habitColors[2], startDate = t),
            Habit(name = "Dormir no horário", emoji = "😴", category = Category.SLEEP, color = Theme.habitColors[5], startDate = t),
            Habit(name = "Momento espiritual", emoji = "🙏", category = Category.SPIRITUALITY, color = Theme.habitColors[9], startDate = t),
            Habit(name = "Fazer minhas obrigações", emoji = "✅", category = Category.PRODUCTIVITY, weekdays = Weekdays.WEEKDAYS, color = Theme.habitColors[0], startDate = t),
            Habit(name = "Redes sociais", emoji = "📱", category = Category.PRODUCTIVITY, kind = HabitKind.NEGATIVE, tracking = Tracking.DURATION, unit = "min", target = 120.0, color = Theme.habitColors[7], startDate = t),
            Habit(name = "Jogar videogame", emoji = "🎮", category = Category.OTHER, kind = HabitKind.NEGATIVE, tracking = Tracking.DURATION, unit = "min", target = 180.0, color = Theme.habitColors[6], startDate = t),
            Habit(name = "Procrastinar", emoji = "⏳", category = Category.PRODUCTIVITY, kind = HabitKind.NEGATIVE, tracking = Tracking.BOOLEAN, target = 0.0, color = Theme.habitColors[8], startDate = t),
            Habit(name = "Dormir depois da meia-noite", emoji = "🌙", category = Category.SLEEP, kind = HabitKind.NEGATIVE, tracking = Tracking.BOOLEAN, target = 0.0, color = Theme.habitColors[5], startDate = t),
            Habit(name = "Comer doces", emoji = "🍩", category = Category.FOOD, kind = HabitKind.NEGATIVE, tracking = Tracking.QUANTITY, unit = "porções", target = 1.0, color = Theme.habitColors[10], startDate = t),
        )
    }

    private val emojis = listOf("🌱", "📚", "🧠", "✍️", "🏃", "🚴", "🧘", "🏋️", "💧", "🍎", "🥗", "😴", "🛏️", "🙏", "✨", "🎯", "✅", "💼", "🧹", "🎸", "🎨", "📝",
        "💊", "🦷", "🚶", "🌞", "🤝", "📞", "💛", "🐶", "🌿", "☕", "📱", "🎮", "📺", "⏳", "🌙", "🍩", "🍔", "🥤", "🚬", "🍷", "💸", "😤")

    override fun build(): View = page(if (isNew) "Novo hábito" else "Editar hábito", actions = {
        if (!isNew) iconButton(Icon.TRASH, Theme.p.coral) {
            confirm(act, "Excluir \"${h.name}\"?", "O hábito e todo o seu histórico serão apagados. Se quiser só parar de acompanhar, use Arquivar.", "Excluir", true) {
                val snap = repo.snapshotHabit(h.id)
                repo.deleteHabit(h.id); app.broto.notify.Scheduler.rescheduleAll(act); saved = true; act.pop()
                act.snack("Hábito excluído.", if (snap != null) "Desfazer" else null) { snap?.let { repo.restoreHabit(it); app.broto.notify.Scheduler.rescheduleAll(act) } }
            }
        }
    }) {
        if (isNew) {
            fieldLabel("Comece com uma sugestão (opcional)")
            flow(6, 6) {
                for (t in templates()) addView(Chip(act, "${t.emoji} ${t.name}", false, if (t.isNegative) Theme.p.coral else Theme.p.primaryDark).apply {
                    onClick { h = t.copy(); render() }
                })
            }
            space(16)
        }
        card {
            segmented(listOf(HabitKind.POSITIVE, HabitKind.NEGATIVE), h.kind, { if (it == HabitKind.POSITIVE) "🌱 Cultivar" else "🍂 Reduzir" }) {
                h = h.copy(kind = it, target = if (it == HabitKind.NEGATIVE && h.tracking == Tracking.BOOLEAN) 0.0 else if (it == HabitKind.POSITIVE && h.tracking == Tracking.BOOLEAN) 1.0 else h.target,
                    frequency = if (it == HabitKind.NEGATIVE) Frequency.DAILY else h.frequency)
                render()
            }
            text(if (h.isPositive) "Um comportamento que você quer desenvolver e manter." else "Um comportamento que você quer evitar, reduzir ou controlar.",
                TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 8, b = 6)
            fieldLabel("Nome")
            val name = field(if (h.isPositive) "Ex.: Ler, Estudar, Beber água" else "Ex.: Redes sociais, Procrastinar", h.name)
            name.addTextChangedListener(watcher { h = h.copy(name = it) })
            fieldLabel("Descrição (opcional)")
            val desc = field("Por que este hábito é importante para você?", h.description, multiline = true)
            desc.addTextChangedListener(watcher { h = h.copy(description = it) })
        }
        card {
            fieldLabel("Ícone")
            val preview = emojiBubble(h.emoji, h.color, 56)
            preview.lp(dp(56), dp(56), b = 10)
            flow(0, 0) {
                for (e in emojis) addView(TextView(act).apply {
                    text = e; textSize = 22f; gravity = Gravity.CENTER
                    layoutParams = android.view.ViewGroup.LayoutParams(dp(48), dp(48))
                    background = if (e == h.emoji) rounded(Theme.p.primarySoft, dpf(12)) else null
                    onClick { h = h.copy(emoji = e); render() }
                })
            }
            fieldLabel("Cor")
            flow(0, 0) {
                for (col in Theme.habitColors) addView(DrawView(act) { c, w, hh ->
                    val p = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG)
                    p.color = col; c.drawCircle(w / 2f, hh / 2f, dpf(14), p)
                    if (col == h.color) { p.style = android.graphics.Paint.Style.STROKE; p.strokeWidth = dpf(2.5f); p.color = Theme.p.text; c.drawCircle(w / 2f, hh / 2f, dpf(16.5f), p) }
                }.apply { layoutParams = android.view.ViewGroup.LayoutParams(dp(48), dp(48)); contentDescription = "Cor"; onClick { it.haptic(); h = h.copy(color = col); render() } })
            }
            fieldLabel("Categoria")
            choiceChips(Category.values().toList(), h.category, { "${it.emoji} ${it.label}" }) { h = h.copy(category = it) }
        }
        card {
            fieldLabel("Como medir")
            segmented(Tracking.values().toList(), h.tracking, { when (it) { Tracking.BOOLEAN -> if (h.isPositive) "Sim/Não" else "Ocorrências"; Tracking.QUANTITY -> "Quantidade"; Tracking.DURATION -> "Tempo" } }) {
                h = h.copy(tracking = it, target = when (it) {
                    Tracking.BOOLEAN -> if (h.isPositive) 1.0 else 0.0
                    Tracking.DURATION -> if (h.tracking == Tracking.DURATION) h.target else if (h.isPositive) 30.0 else 120.0
                    Tracking.QUANTITY -> if (h.tracking == Tracking.QUANTITY) h.target else if (h.isPositive) 10.0 else 1.0
                }, unit = when (it) { Tracking.DURATION -> "min"; Tracking.QUANTITY -> if (h.tracking == Tracking.QUANTITY) h.unit else ""; else -> "" })
                render()
            }
            space(8)
            if (h.isPositive && h.tracking != Tracking.BOOLEAN) {
                fieldLabel(if (h.tracking == Tracking.DURATION) "Meta diária (minutos)" else "Meta diária")
                horizontal {
                    val stepper = Stepper(act, h.target, if (h.tracking == Tracking.DURATION) 15.0 else 1.0, 0.5) { h = h.copy(target = it) }
                    addView(stepper)
                    if (h.tracking == Tracking.QUANTITY) {
                        val unit = field("unidade (ex.: páginas)", h.unit); unit.lp(0, WRAP, 1f, l = 12)
                        unit.addTextChangedListener(watcher { h = h.copy(unit = it) })
                    }
                }
            }
            if (h.isNegative) {
                fieldLabel(when (h.tracking) { Tracking.BOOLEAN -> "Limite pessoal (ocorrências por dia)"; Tracking.DURATION -> "Limite pessoal (minutos por dia)"; else -> "Limite pessoal por dia" })
                horizontal {
                    addView(Stepper(act, h.target, if (h.tracking == Tracking.DURATION) 15.0 else 1.0, 0.0) { h = h.copy(target = it) })
                    if (h.tracking == Tracking.QUANTITY) {
                        val unit = field("unidade (ex.: porções)", h.unit); unit.lp(0, WRAP, 1f, l = 12)
                        unit.addTextChangedListener(watcher { h = h.copy(unit = it) })
                    }
                }
                text("0 significa \"evitar completamente\". Passar do limite reduz o score de forma proporcional — nunca zera o seu dia.", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 6)
            }
        }
        card {
            fieldLabel("Frequência")
            if (h.isPositive) {
                segmented(listOf(Frequency.DAILY, Frequency.WEEKLY), h.frequency, { if (it == Frequency.DAILY) "Dias da semana" else "Vezes por semana" }) { h = h.copy(frequency = it); render() }
                space(10)
            }
            if (h.frequency == Frequency.DAILY || h.isNegative) {
                horizontal {
                    for (d in DayOfWeek.values()) {
                        val on = h.weekdays.contains(d)
                        text(Fmt.dowLetter(d), TextStyle.BODY_BOLD, if (on) Theme.p.onPrimary else Theme.p.textSoft) {
                            gravity = Gravity.CENTER
                            background = rounded(if (on) Theme.p.primary else Theme.p.surfaceAlt, dpf(20))
                            layoutParams = LinearLayout.LayoutParams(0, dp(48), 1f).apply { setMargins(dp(2), 0, dp(2), 0) }
                            contentDescription = Fmt.dow(d)
                            onClick { val nw = h.weekdays.with(d, !on); if (!nw.isEmpty) { h = h.copy(weekdays = nw); render() } }
                        }
                    }
                }
                text(if (h.isPositive) "O hábito só é cobrado nos dias marcados." else "Dias em que você quer acompanhar este comportamento.", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 8)
            } else {
                horizontal {
                    addView(Stepper(act, h.timesPerWeek.toDouble(), 1.0, 1.0) { h = h.copy(timesPerWeek = it.toInt().coerceIn(1, 7)) })
                    text("vezes por semana", TextStyle.BODY, Theme.p.textSoft).lp(WRAP, WRAP, l = 10)
                }
            }
        }
        card {
            settingRow("Lembrete", h.reminderMinutes?.let { "Todos os dias programados às ${Fmt.time(it)}" } ?: "Sem lembrete", Icon.BELL, right = {
                addView(Toggle(act, h.reminderMinutes != null) { on ->
                    if (on) pickTime(h.reminderMinutes ?: (20 * 60)) else { h = h.copy(reminderMinutes = null); render() }
                })
            }) { pickTime(h.reminderMinutes ?: (20 * 60)) }
            divider()
            settingRow("Data de início", Fmt.fullDate(h.startDate), Icon.CALENDAR) {
                DatePickerDialog(act, { _, y, m, d -> h = h.copy(startDate = LocalDate.of(y, m + 1, d)); render() }, h.startDate.year, h.startDate.monthValue - 1, h.startDate.dayOfMonth).apply {
                    datePicker.maxDate = System.currentTimeMillis()
                }.show()
            }
            text("Dias antes do início nunca contam como não realizados.", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 2)
        }
        primaryButton(if (isNew) "Criar hábito" else "Salvar alterações", Icon.CHECK) { save() }
        if (!isNew) {
            softButton(if (h.archived) "Restaurar hábito" else "Arquivar (parar de acompanhar)", Icon.ARCHIVE, Theme.p.surfaceAlt, Theme.p.text) {
                repo.setArchived(h.id, !h.archived); saved = true; act.pop(); act.snack(if (h.archived) "Hábito restaurado." else "Hábito arquivado. O histórico foi mantido.")
            }
        }
    }

    private fun pickTime(initial: Int) {
        TimePickerDialog(act, { _, hh, mm -> h = h.copy(reminderMinutes = hh * 60 + mm); render() }, initial / 60, initial % 60, true).show()
    }

    private fun save() {
        if (h.name.isBlank()) { act.snack("Dê um nome ao hábito."); return }
        if (h.isPositive && h.tracking != Tracking.BOOLEAN && h.target <= 0) { act.snack("Defina uma meta maior que zero."); return }
        val id = repo.saveHabit(h)
        app.broto.notify.Scheduler.rescheduleAll(act)
        saved = true
        act.pop()
        act.snack(if (isNew) "${h.emoji} Hábito criado!" else "Alterações salvas.")
        if (isNew) id.let { }
    }
}

fun watcher(f: (String) -> Unit) = object : android.text.TextWatcher {
    override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
    override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
    override fun afterTextChanged(s: android.text.Editable?) { f(s?.toString() ?: "") }
}
