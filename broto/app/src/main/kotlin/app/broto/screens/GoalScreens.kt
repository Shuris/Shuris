package app.broto.screens

import android.app.DatePickerDialog
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import app.broto.MainActivity
import app.broto.core.model.*
import app.broto.core.schedule.Schedule
import app.broto.core.stats.HabitStatsCalc
import app.broto.ui.*
import java.time.LocalDate
import java.time.temporal.ChronoUnit

object GoalText {
    fun deadline(g: Goal, today: LocalDate = LocalDate.now()): String? {
        if (g.status == GoalStatus.DONE) return g.completedDay?.let { "Concluído em ${Fmt.shortDate(it)}" } ?: "Concluído"
        val d = g.deadline ?: return null
        val n = ChronoUnit.DAYS.between(today, d)
        return when { n < 0 -> "Prazo encerrado há ${Fmt.days((-n).toInt())}"; n == 0L -> "O prazo é hoje"; else -> "Faltam ${Fmt.days(n.toInt())}" }
    }

    fun progressLabel(repo: app.broto.data.Repo, g: Goal): String = when (g.mode) {
        GoalProgressMode.MANUAL -> "${Fmt.num(g.current)} de ${Fmt.num(g.target)} ${g.unit}".trim()
        GoalProgressMode.STEPS -> "${g.steps.count { it.done }} de ${g.steps.size} etapas"
        GoalProgressMode.HABITS -> "${Fmt.num(repo.goalHabitDays(g))} de ${Fmt.num(g.target)} dias com os hábitos"
    }
}

class GoalsScreen(act: MainActivity) : Screen(act) {
    private var filter = GoalStatus.ACTIVE

    override fun build(): View {
        val all = repo.goals()
        val list = all.filter { it.status == filter }
        return page("Meus Objetivos", "${all.count { it.status == GoalStatus.ACTIVE }} em andamento · ${all.count { it.status == GoalStatus.DONE }} concluídos", actions = {
            iconButton(Icon.PLUS, Theme.p.deep, Theme.p.primarySoft, 44, 22) { act.push(GoalEditorScreen(act, null)) }
        }) {
            segmented(GoalStatus.values().toList(), filter, { (when (it) { GoalStatus.ACTIVE -> "Ativos"; GoalStatus.PAUSED -> "Pausados"; GoalStatus.DONE -> "Concluídos" }) + " ${all.count { g -> g.status == it }}" }) { filter = it; render() }
            space(14)
            if (all.isEmpty()) {
                card { emptyState("Nenhum objetivo ainda", "Defina objetivos de curto, médio e longo prazo e acompanhe seu progresso.", 4, "Criar objetivo") { act.push(GoalEditorScreen(act, null)) } }
                card(color = Theme.p.surfaceAlt) {
                    text("Ideias", TextStyle.SUBTITLE)
                    for (s in listOf("📚 Ler 12 livros", "🧠 Estudar 100 horas", "🏃 Praticar exercícios durante 30 dias", "📵 Reduzir o tempo nas redes sociais", "💻 Desenvolver um projeto pessoal"))
                        text(s, TextStyle.BODY, Theme.p.textSoft).lp(WRAP, WRAP, t = 6)
                }
                return@page
            }
            if (list.isEmpty()) text("Nenhum objetivo ${filter.label.lowercase()}.", TextStyle.BODY, Theme.p.textSoft).lp(WRAP, WRAP, t = 10)
            list.forEachIndexed { i, g -> addView(goalCard(g).also { it.enter(i * 40L) }) }
        }
    }

    private fun goalCard(g: Goal): View {
        val w = act.verticalLayout()
        val pr = repo.goalProgress(g)
        w.card {
            horizontal {
                gravity = Gravity.TOP
                text(g.emoji, TextStyle.TITLE) { gravity = Gravity.CENTER; background = rounded(Theme.blend(Theme.p.surface, Theme.p.yellow, 0.35f), dpf(16)) }.lp(dp(50), dp(50))
                vertical { lp(0, WRAP, 1f, l = 12)
                    text(g.name, TextStyle.SUBTITLE).ellipsize(2)
                    text("${g.horizon.label} · ${g.category.label}", TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 3)
                }
                text(Fmt.pct(pr), TextStyle.HEADLINE, if (pr >= 1) Theme.p.primaryDark else Theme.p.text)
            }
            progressBar(pr.toFloat(), if (g.status == GoalStatus.DONE) Theme.p.primaryDark else Theme.p.yellow, 10).lp(MATCH, dp(10), t = 14)
            horizontal {
                lp(MATCH, WRAP, t = 8)
                text(GoalText.progressLabel(repo, g), TextStyle.CAPTION, Theme.p.textSoft).lp(0, WRAP, 1f)
                GoalText.deadline(g)?.let { text(it, TextStyle.CAPTION, if (it.startsWith("Prazo encerrado")) Theme.p.coral else Theme.p.textSoft) }
            }
        }.clickable { act.push(GoalDetailScreen(act, g.id)) }
        return w
    }
}

class GoalDetailScreen(act: MainActivity, private val id: Long) : Screen(act) {
    override fun build(): View {
        val g = repo.goal(id) ?: return act.verticalLayout().also { it.post { if (visible) act.back() } }
        val pr = repo.goalProgress(g)
        val today = LocalDate.now()
        return page(g.name, "${g.horizon.label} · ${g.category.label}", actions = {
            iconButton(Icon.EDIT, Theme.p.text) { act.push(GoalEditorScreen(act, g.id)) }
        }) {
            card(padding = 20) {
                horizontal {
                    val ring = RingView(act, pr.toFloat(), if (g.status == GoalStatus.DONE) Theme.p.primaryDark else 0xFFF5C33B.toInt(), Theme.p.surfaceAlt, 11f)
                    ring.centerText = Fmt.pct(pr); ring.centerTextSp = 24f
                    addView(ring, LinearLayout.LayoutParams(dp(110), dp(110)))
                    vertical { lp(0, WRAP, 1f, l = 16)
                        text("${g.emoji}  ${g.status.label}", TextStyle.LABEL, Theme.p.textSoft)
                        text(GoalText.progressLabel(repo, g), TextStyle.HEADLINE).lp(WRAP, WRAP, t = 6)
                        GoalText.deadline(g)?.let { text(it, TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 6) }
                        g.deadline?.let { text("Prazo: ${Fmt.fullDate(it)}", TextStyle.CAPTION, Theme.p.textFaint).lp(WRAP, WRAP, t = 2) }
                    }
                }
                if (g.description.isNotBlank()) text(g.description, TextStyle.BODY, Theme.p.textSoft).lp(MATCH, WRAP, t = 14)
            }
            if (g.mode == GoalProgressMode.MANUAL && g.status != GoalStatus.DONE) {
                card {
                    text("Atualizar progresso", TextStyle.SUBTITLE).lp(WRAP, WRAP, b = 10)
                    var v = g.current
                    horizontal {
                        addView(Stepper(act, v, if (g.target >= 50) 5.0 else 1.0) { v = it })
                        text(g.unit, TextStyle.BODY, Theme.p.textSoft).lp(0, WRAP, 1f, l = 8)
                        softButton("Salvar") { save(g.copy(current = v)) }.lp(WRAP, WRAP)
                    }
                }
            }
            if (g.steps.isNotEmpty()) {
                card {
                    text("Etapas", TextStyle.SUBTITLE).lp(WRAP, WRAP, b = 6)
                    g.steps.forEachIndexed { i, s ->
                        horizontal {
                            pad(0, 4)
                            addView(CheckView(act, if (s.done) 2 else 0).apply { layoutParams = LinearLayout.LayoutParams(dp(38), dp(38)) })
                            text(s.title, TextStyle.BODY, if (s.done) Theme.p.textSoft else Theme.p.text) {
                                if (s.done) paintFlags = paintFlags or android.graphics.Paint.STRIKE_THRU_TEXT_FLAG
                            }.lp(0, WRAP, 1f, l = 10)
                            ripple(dpf(12))
                            onClick { save(g.copy(steps = g.steps.mapIndexed { j, x -> if (j == i) x.copy(done = !x.done) else x })) }
                        }
                    }
                }
            }
            if (g.habitIds.isNotEmpty()) {
                card {
                    text("Hábitos relacionados", TextStyle.SUBTITLE).lp(WRAP, WRAP, b = 6)
                    val rest = repo.restDays()
                    for (h in repo.habits(true).filter { it.id in g.habitIds }) {
                        val st = HabitStatsCalc.forPeriod(h, repo.logsForHabit(h.id), today.minusDays(29), today, today, rest)
                        horizontal {
                            pad(0, 6)
                            emojiBubble(h.emoji, h.color, 38)
                            vertical { lp(0, WRAP, 1f, l = 10)
                                text(h.name, TextStyle.BODY_BOLD)
                                text((if (h.isPositive) "Conclusão" else "Dentro do limite") + " nos últimos 30 dias: " + (st.rate?.let { Fmt.pct(it) } ?: "–"), TextStyle.CAPTION, Theme.p.textSoft) }
                            ripple(dpf(12)); onClick { act.push(HabitDetailScreen(act, h.id)) }
                        }
                    }
                }
            }
            when (g.status) {
                GoalStatus.ACTIVE -> {
                    primaryButton("Marcar como concluído 🎉", Icon.CHECK) { save(g.copy(status = GoalStatus.DONE, completedDay = today)); act.snack("Parabéns pela conquista! 🎉") }
                    softButton("Pausar objetivo", Icon.PAUSE, Theme.p.surfaceAlt, Theme.p.text) { save(g.copy(status = GoalStatus.PAUSED)) }
                }
                GoalStatus.PAUSED -> primaryButton("Retomar objetivo", Icon.PLAY) { save(g.copy(status = GoalStatus.ACTIVE)) }
                GoalStatus.DONE -> softButton("Reabrir objetivo", Icon.REFRESH, Theme.p.surfaceAlt, Theme.p.text) { save(g.copy(status = GoalStatus.ACTIVE, completedDay = null)) }
            }
            ghostButton("Excluir objetivo", Theme.p.coral) {
                confirm(act, "Excluir \"${g.name}\"?", "Esta ação não pode ser desfeita.", "Excluir", true) { repo.deleteGoal(g.id); act.back() }
            }
        }
    }

    private fun save(g: Goal) {
        val wasDone = repo.goalProgress(repo.goal(g.id)!!) >= 1
        repo.saveGoal(g)
        if (!wasDone && g.status == GoalStatus.ACTIVE && repo.goalProgress(g) >= 1) {
            confirm(act, "Meta atingida! 🎉", "Você chegou a 100% de \"${g.name}\". Quer marcar como concluído?", "Concluir") { repo.saveGoal(g.copy(status = GoalStatus.DONE, completedDay = LocalDate.now())) }
        }
    }
}

class GoalEditorScreen(act: MainActivity, private val id: Long?) : Screen(act) {
    private var g: Goal = id?.let { repo.goal(it) } ?: Goal(name = "", createdDay = LocalDate.now(), target = 10.0)
    private val emojis = listOf("🎯", "📚", "🧠", "🏃", "💪", "📵", "💻", "✍️", "🎸", "🌍", "💰", "🏆", "🌱", "🧘", "🍎", "✈️", "🏠", "❤️")
    private var newStep = ""

    override fun build(): View = page(if (id == null) "Novo objetivo" else "Editar objetivo") {
        card {
            fieldLabel("Nome")
            field("Ex.: Ler 12 livros", g.name).addTextChangedListener(watcher { g = g.copy(name = it) })
            fieldLabel("Descrição")
            field("Por que este objetivo importa?", g.description, multiline = true).addTextChangedListener(watcher { g = g.copy(description = it) })
            fieldLabel("Ícone")
            flow(4, 4) {
                for (e in emojis) addView(TextView(act).apply {
                    text = e; textSize = 22f; gravity = Gravity.CENTER
                    layoutParams = android.view.ViewGroup.LayoutParams(dp(42), dp(42))
                    background = if (e == g.emoji) rounded(Theme.p.primarySoft, dpf(12)) else null
                    onClick { g = g.copy(emoji = e); render() }
                })
            }
            fieldLabel("Categoria")
            choiceChips(Category.values().toList(), g.category, { "${it.emoji} ${it.label}" }) { g = g.copy(category = it) }
            fieldLabel("Prazo")
            segmented(GoalHorizon.values().toList(), g.horizon, { it.label }) { g = g.copy(horizon = it) }
            space(8)
            settingRow("Data limite", g.deadline?.let { Fmt.fullDate(it) } ?: "Sem data limite", Icon.CALENDAR, right = {
                if (g.deadline != null) iconButton(Icon.CLOSE, Theme.p.textSoft, null, 36, 18) { g = g.copy(deadline = null); render() }
            }) {
                val d = g.deadline ?: LocalDate.now().plusMonths(1)
                DatePickerDialog(act, { _, y, m, dd -> g = g.copy(deadline = LocalDate.of(y, m + 1, dd)); render() }, d.year, d.monthValue - 1, d.dayOfMonth).show()
            }
        }
        card {
            fieldLabel("Como medir o progresso")
            segmented(GoalProgressMode.values().toList(), g.mode, { when (it) { GoalProgressMode.MANUAL -> "Valor"; GoalProgressMode.STEPS -> "Etapas"; GoalProgressMode.HABITS -> "Hábitos" } }) { g = g.copy(mode = it); render() }
            text(when (g.mode) {
                GoalProgressMode.MANUAL -> "Você atualiza o valor atual (ex.: livros lidos, horas estudadas)."
                GoalProgressMode.STEPS -> "O progresso é a fração de etapas concluídas."
                GoalProgressMode.HABITS -> "Conta os dias em que você concluiu (ou ficou no limite de) algum hábito relacionado."
            }, TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 8, b = 6)
            if (g.mode != GoalProgressMode.STEPS) {
                fieldLabel(if (g.mode == GoalProgressMode.HABITS) "Meta (dias)" else "Meta")
                horizontal {
                    addView(Stepper(act, g.target, if (g.target >= 50) 5.0 else 1.0, 1.0) { g = g.copy(target = it) })
                    if (g.mode == GoalProgressMode.MANUAL) field("unidade (ex.: livros)", g.unit).also { it.lp(0, WRAP, 1f, l = 12) }.addTextChangedListener(watcher { g = g.copy(unit = it) })
                }
                if (g.mode == GoalProgressMode.MANUAL) {
                    fieldLabel("Valor atual")
                    addView(Stepper(act, g.current, if (g.target >= 50) 5.0 else 1.0) { g = g.copy(current = it) })
                }
            }
        }
        card {
            text("Etapas menores", TextStyle.SUBTITLE).lp(WRAP, WRAP, b = 6)
            g.steps.forEachIndexed { i, s ->
                horizontal {
                    text("${i + 1}.", TextStyle.BODY_BOLD, Theme.p.textSoft).lp(dp(26), WRAP)
                    text(s.title, TextStyle.BODY).lp(0, WRAP, 1f)
                    iconButton(Icon.CLOSE, Theme.p.textSoft, null, 36, 16) { g = g.copy(steps = g.steps.filterIndexed { j, _ -> j != i }); render() }
                }
            }
            horizontal {
                val f = field("Nova etapa", newStep); f.lp(0, WRAP, 1f)
                f.addTextChangedListener(watcher { newStep = it })
                iconButton(Icon.PLUS, Theme.p.deep, Theme.p.primarySoft, 44, 20) {
                    if (newStep.isNotBlank()) { g = g.copy(steps = g.steps + GoalStep(title = newStep.trim())); newStep = ""; render() }
                }.lp(dp(44), dp(44), l = 8)
            }
        }
        val habits = repo.habits()
        if (habits.isNotEmpty()) card {
            text("Hábitos relacionados", TextStyle.SUBTITLE).lp(WRAP, WRAP, b = 8)
            multiChips(habits, habits.filter { it.id in g.habitIds }.toSet(), { "${it.emoji} ${it.name}" }) { sel -> g = g.copy(habitIds = sel.map { it.id }) }
        }
        primaryButton(if (id == null) "Criar objetivo" else "Salvar", Icon.CHECK) {
            if (g.name.isBlank()) { act.snack("Dê um nome ao objetivo."); return@primaryButton }
            if (g.mode == GoalProgressMode.STEPS && g.steps.isEmpty()) { act.snack("Adicione pelo menos uma etapa."); return@primaryButton }
            repo.saveGoal(g); act.back(); act.snack(if (id == null) "${g.emoji} Objetivo criado!" else "Objetivo salvo.")
        }
    }
}
