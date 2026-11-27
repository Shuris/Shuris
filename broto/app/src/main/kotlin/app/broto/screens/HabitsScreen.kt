package app.broto.screens

import android.view.Gravity
import android.view.View
import app.broto.MainActivity
import app.broto.core.model.Frequency
import app.broto.core.schedule.Schedule
import app.broto.ui.*
import java.time.LocalDate

class HabitsScreen(act: MainActivity) : Screen(act) {
    private var day: LocalDate = LocalDate.now()
    private var weekStart: LocalDate = Schedule.weekStart(day)

    override fun onShow() {
        if (day.isAfter(LocalDate.now())) { day = LocalDate.now(); weekStart = Schedule.weekStart(day) }
    }

    override fun build(): View {
        val habits = repo.habits()
        val rest = repo.restDays()
        val logs = repo.logsForDay(day)
        val rangeLogs = repo.logsInRange(weekStart, weekStart.plusDays(6))
        return page("Hábitos", Fmt.relative(day), back = false, actions = {
            iconButton(Icon.MORE, Theme.p.text) {
                options(act, "Hábitos", listOf(
                    Triple(Icon.EDIT, "Gerenciar e reordenar hábitos") { act.push(ManageHabitsScreen(act)) },
                    Triple(Icon.LEAF, if (rest.isRest(day)) "Desmarcar dia de descanso" else "Marcar ${Fmt.relative(day).lowercase()} como dia de descanso") {
                        repo.setRestDate(day, !rest.dates.contains(day))
                        act.snack(if (!rest.dates.contains(day)) "Dia de descanso: hábitos positivos não serão cobrados." else "Dia de descanso removido.")
                    },
                ))
            }
            iconButton(Icon.PLUS, Theme.p.deep, Theme.p.primarySoft, 44, 22) { act.push(HabitEditorScreen(act, null)) }
        }) {
            card(padding = 8) {
                addView(WeekStrip.build(act, day, weekStart, { d ->
                    val sched = habits.filter { it.isPositive && Schedule.isScheduled(it, d, rest) }
                    if (sched.isEmpty()) null else sched.count { Schedule.isDone(it, rangeLogs[it.id]?.get(d)) } / sched.size.toFloat()
                }, { day = it; render() }, { weekStart = weekStart.plusWeeks(it.toLong()); day = minOf(weekStart.plusDays(6), LocalDate.now()).let { d -> if (d.isBefore(weekStart)) weekStart else d }; render() }))
            }
            if (habits.isEmpty()) {
                emptyState("Nenhum hábito ainda", "Crie hábitos positivos para cultivar e negativos para reduzir.", 4, "Criar meu primeiro hábito") { act.push(HabitEditorScreen(act, null)) }
                return@page
            }
            val prefs = act.getSharedPreferences("broto_ui", 0)
            if (!prefs.getBoolean("hint_gestures", false)) {
                card(color = Theme.blend(Theme.p.surface, Theme.p.yellow, 0.28f), padding = 16) {
                    horizontal {
                        gravity = Gravity.TOP
                        text("💡", TextStyle.TITLE)
                        vertical { lp(0, WRAP, 1f, l = 12)
                            text("Atalhos dos hábitos", TextStyle.BODY_BOLD)
                            text("• Toque no círculo para concluir (toque de novo para desmarcar).\n• Toque e segure um hábito para registrar quantidade, \"não fiz\" ou corrigir.\n• Toque no nome para ver calendário e histórico.",
                                TextStyle.CAPTION, Theme.p.text).lp(MATCH, WRAP, t = 4)
                        }
                    }
                    text("Entendi", TextStyle.LABEL, Theme.p.primaryDark).link { prefs.edit().putBoolean("hint_gestures", true).apply(); render() }.lp(WRAP, WRAP, gravity = Gravity.END)
                }
            }
            if (rest.isRest(day)) {
                card(color = Theme.p.surfaceAlt, padding = 14) {
                    horizontal {
                        text("🌿", TextStyle.TITLE)
                        vertical { lp(0, WRAP, 1f, l = 12)
                            text("Dia de descanso", TextStyle.BODY_BOLD)
                            text("Hábitos positivos não contam como perdidos hoje.", TextStyle.CAPTION, Theme.p.textSoft) }
                    }
                }
            }
            val visible = habits.filter { Schedule.isVisibleOn(it, day) }
            val daily = visible.filter { it.isPositive && it.frequency == Frequency.DAILY }
            val weekly = visible.filter { it.isPositive && it.frequency == Frequency.WEEKLY }
            val negative = visible.filter { it.isNegative }
            val hidden = habits.filter { !Schedule.isVisibleOn(it, day) && !it.archived }
            var delay = 0L
            fun group(title: String, emoji: String, list: List<app.broto.core.model.Habit>, hint: String? = null) {
                if (list.isEmpty()) return
                section("$emoji  $title")
                if (hint != null) text(hint, TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = -6, b = 8)
                card(padding = 12) {
                    list.forEachIndexed { i, h ->
                        if (i > 0) divider()
                        addView(HabitRow.build(act, h, day, logs[h.id]))
                    }
                }.enter(delay); delay += 50
            }
            group("Para cultivar", "🌱", daily)
            group("Semanais", "📅", weekly, "Conte as vezes da semana — nenhum dia isolado é considerado perdido.")
            group("Para reduzir", "🍂", negative, "Registre se aconteceu e quanto. Não aconteceu também é um registro!")
            if (hidden.isNotEmpty()) {
                text("Não programados para este dia: " + hidden.joinToString(", ") { "${it.emoji} ${it.name}" + if (it.paused) " (pausado)" else "" },
                    TextStyle.CAPTION, Theme.p.textFaint).lp(MATCH, WRAP, t = 4)
            }
        }
    }
}

class ManageHabitsScreen(act: MainActivity) : Screen(act) {
    override fun build(): View {
        val all = repo.habits(includeArchived = true)
        return page("Gerenciar hábitos", "Reordene, pause, arquive ou edite") {
            if (all.isEmpty()) { emptyState("Nada por aqui", "Seus hábitos aparecerão nesta lista.", 3); return@page }
            val active = all.filter { !it.archived }
            val archived = all.filter { it.archived }
            card(padding = 10) {
                active.forEachIndexed { i, h ->
                    if (i > 0) divider()
                    horizontal {
                        pad(4, 6)
                        emojiBubble(h.emoji, h.color, 40)
                        vertical { lp(0, WRAP, 1f, l = 10)
                            text(h.name, TextStyle.BODY_BOLD).ellipsize()
                            text((if (h.isPositive) "Positivo" else "Para reduzir") + if (h.paused) " · pausado" else "", TextStyle.CAPTION, if (h.paused) Theme.p.coral else Theme.p.textSoft)
                            ripple(dpf(12)); onClick { act.push(HabitEditorScreen(act, h.id)) }
                        }
                        iconButton(Icon.UP, if (i > 0) Theme.p.textSoft else Theme.p.outline, null, 36, 18) { if (i > 0) repo.moveHabit(h.id, true) }
                        iconButton(Icon.DOWN, if (i < active.lastIndex) Theme.p.textSoft else Theme.p.outline, null, 36, 18) { if (i < active.lastIndex) repo.moveHabit(h.id, false) }
                        iconButton(if (h.paused) Icon.PLAY else Icon.PAUSE, Theme.p.textSoft, null, 36, 18) {
                            repo.setPaused(h.id, !h.paused); act.snack(if (h.paused) "${h.name} retomado." else "${h.name} pausado. Dias pausados não contam como falha.")
                        }
                    }
                }
            }
            if (archived.isNotEmpty()) {
                section("Arquivados")
                card(padding = 10) {
                    archived.forEachIndexed { i, h ->
                        if (i > 0) divider()
                        horizontal {
                            pad(4, 6)
                            emojiBubble(h.emoji, Theme.p.outline, 40)
                            text(h.name, TextStyle.BODY_BOLD, Theme.p.textSoft).lp(0, WRAP, 1f, l = 10)
                            text("Restaurar", TextStyle.LABEL, Theme.p.primaryDark).link { repo.setArchived(h.id, false) }
                        }
                    }
                }
            }
        }
    }
}
