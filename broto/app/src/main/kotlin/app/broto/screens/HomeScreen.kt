package app.broto.screens

import android.graphics.RectF
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import app.broto.MainActivity
import app.broto.core.model.Emotion
import app.broto.core.model.GoalStatus
import app.broto.core.model.Mood
import app.broto.core.schedule.Schedule
import app.broto.core.score.DayScore
import app.broto.core.streak.FlameLevel
import app.broto.ui.*
import java.time.LocalDate
import kotlin.math.roundToInt

class HomeScreen(act: MainActivity) : Screen(act) {

    override fun build(): View {
        val today = LocalDate.now()
        val name = repo.settings.userName
        val score = repo.dayScore(today)
        val mood = repo.mood(today)
        val habits = repo.habits()
        val logs = repo.logsForDay(today)
        val rest = repo.restDays()
        val cons = repo.consistency(today)
        return scrollPage(Theme.p.bg) {
            // ---------------- cabeçalho
            frame {
                lp(MATCH, WRAP, b = 8)
                drawing(-1, 96) { c, w, h ->
                    Decor.sprig(c, w - dpf(30), h - dpf(6), dpf(70), Theme.alpha(Theme.p.primary, 0.55f), 18f)
                    Decor.sprig(c, w - dpf(62), h - dpf(2), dpf(46), Theme.alpha(Theme.p.primaryDark, 0.30f), -22f, true)
                    Decor.flower(c, w - dpf(96), dpf(26), dpf(4.5f), Theme.alpha(Theme.p.yellow, 0.9f), Theme.alpha(0xFFFFFFFF.toInt(), 0.9f))
                    Decor.dot(c, w - dpf(120), dpf(56), dpf(3), Theme.alpha(Theme.p.primary, 0.5f))
                }
                vertical {
                    flp(MATCH, WRAP, r = 110)
                    text(Fmt.longDate(today).replaceFirstChar { it.uppercase() }, TextStyle.LABEL, Theme.p.textSoft)
                    text(if (name.isBlank()) "${Fmt.greeting()}!" else "${Fmt.greeting()}, $name!", if (narrow || name.length > 14) TextStyle.TITLE else TextStyle.DISPLAY).lp(WRAP, WRAP, t = 6)
                    text(subtitle(score, mood != null), TextStyle.BODY, Theme.p.textSoft).lp(WRAP, WRAP, t = 4)
                }
                horizontal {
                    flp(WRAP, WRAP, Gravity.END or Gravity.TOP)
                    iconButton(Icon.SETTINGS, Theme.p.textSoft, Theme.p.surface, 42, 20) { act.push(SettingsScreen(act)) }
                }
            }

            // ---------------- score
            card(color = Theme.p.primarySoft, padding = 20) {
                horizontal {
                    val ring = RingView(context, (score.score ?: 0) / 100f, Theme.p.primaryDark, Theme.alpha(0xFFFFFFFF.toInt(), if (Theme.p.dark) 0.12f else 0.6f), 11f)
                    ring.centerText = score.score?.toString() ?: "–"; ring.subText = "de 100"
                    if (narrow) ring.centerTextSp = 24f
                    addView(ring, LinearLayout.LayoutParams(dp(if (narrow) 88 else 112), dp(if (narrow) 88 else 112)))
                    vertical {
                        lp(0, WRAP, 1f, l = 18)
                        text("Score de hoje", TextStyle.LABEL, Theme.p.deep)
                        text(scoreTitle(score.score), TextStyle.HEADLINE, Theme.p.text).lp(WRAP, WRAP, t = 4)
                        val week = repo.storedScores(today.minusDays(6), today).values
                        val prev = repo.storedScores(today.minusDays(13), today.minusDays(7)).values
                        if (week.isNotEmpty()) {
                            val a = week.average()
                            val delta = if (prev.isNotEmpty()) a - prev.average() else null
                            text("Média 7 dias: ${a.roundToInt()}" + (delta?.let { "  ${if (it >= 0) "▲" else "▼"} ${Math.abs(it).roundToInt()}" } ?: ""), TextStyle.CAPTION, Theme.p.deep).lp(WRAP, WRAP, t = 8)
                        }
                        text("Como foi calculado ›", TextStyle.LABEL, Theme.p.primaryDark).lp(WRAP, WRAP, t = 10)
                    }
                }
            }.clickable { ScoreSheet.show(act, score) }.enter()

            // ---------------- humor
            card {
                if (mood == null) {
                    text("Como você está hoje?", TextStyle.HEADLINE)
                    text("Toque na carinha que representa seu dia", TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 4, b = 12)
                    horizontal {
                        for (lvl in 1..5) {
                            vertical {
                                gravity = Gravity.CENTER_HORIZONTAL
                                lp(0, WRAP, 1f)
                                val iv = ImageView(context); iv.setImageDrawable(MoodFaceDrawable(lvl, dp(52)))
                                addView(iv, LinearLayout.LayoutParams(dp(52), dp(52)))
                                text(Mood.of(lvl).label, TextStyle.TINY, Theme.p.textSoft).lp(WRAP, WRAP, t = 4)
                                ripple(dpf(16)); onClick { act.push(MoodEditorScreen(act, today, lvl)) }
                            }
                        }
                    }
                } else {
                    horizontal {
                        val iv = ImageView(context); iv.setImageDrawable(MoodFaceDrawable(mood.mood, dp(64)))
                        addView(iv, LinearLayout.LayoutParams(dp(64), dp(64)))
                        vertical {
                            lp(0, WRAP, 1f, l = 14)
                            text("Seu humor hoje", TextStyle.CAPTION, Theme.p.textSoft)
                            text(Mood.of(mood.mood).label, TextStyle.TITLE).lp(WRAP, WRAP, t = 2)
                            val bits = ArrayList<String>()
                            mood.energy?.let { bits.add("Energia $it/5") }; mood.stress?.let { bits.add("Estresse $it/5") }
                            if (bits.isNotEmpty()) text(bits.joinToString(" · "), TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 4)
                        }
                        iconButton(Icon.EDIT, Theme.p.textSoft, null, 40, 20) { act.push(MoodEditorScreen(act, today)) }
                    }
                    if (mood.emotions.isNotEmpty()) {
                        flow(6, 6) {
                            setPadding(0, dp(12), 0, 0)
                            for (e in mood.emotions) addView(tagView("${e.emoji} ${e.label}", Theme.moodColor(mood.mood)))
                        }
                    }
                }
            }.enter(40)

            // ---------------- hábitos de hoje
            val visible = habits.filter { Schedule.isVisibleOn(it, today) }
            val positives = visible.filter { it.isPositive && Schedule.isScheduled(it, today, rest) }
            val done = positives.count { Schedule.isDone(it, logs[it.id]) }
            card {
                horizontal {
                    vertical {
                        lp(0, WRAP, 1f)
                        text("Hábitos de hoje", TextStyle.HEADLINE)
                        val negLogged = visible.count { it.isNegative && logs.containsKey(it.id) }
                        val negTotal = visible.count { it.isNegative }
                        val sub = when {
                            visible.isEmpty() -> "Nenhum hábito para hoje"
                            positives.isEmpty() && rest.isRest(today) -> "Dia de descanso 🌿"
                            else -> "$done de ${positives.size} concluídos" + if (negTotal > 0) " · $negLogged de $negTotal registrados" else ""
                        }
                        text(sub, TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 3)
                    }
                    text("Abrir ›", TextStyle.LABEL, Theme.p.primaryDark).link { act.switchTab(1) }
                }
                if (positives.isNotEmpty()) progressBar(done / positives.size.toFloat()).lp(MATCH, dp(10), t = 12, b = 6)
                if (habits.isEmpty()) {
                    text("Crie seu primeiro hábito para começar a acompanhar sua rotina.", TextStyle.BODY, Theme.p.textSoft).lp(MATCH, WRAP, t = 10)
                    softButton("Criar hábito", Icon.PLUS) { act.push(HabitEditorScreen(act, null)) }.lp(MATCH, WRAP, t = 10)
                } else {
                    for (h in visible.take(5)) addView(HabitRow.build(act, h, today, logs[h.id], compact = true))
                    if (visible.size > 5) text("+ ${visible.size - 5} hábitos", TextStyle.LABEL, Theme.p.textSoft).lp(WRAP, WRAP, t = 6)
                }
            }.enter(80)

            // ---------------- consistência + objetivos
            horizontal {
                lp(MATCH, WRAP, b = 14)
                gravity = Gravity.TOP
                card(padding = 16) {
                    lp(0, MATCH, 1f, r = 7, b = 0)
                    gravity = Gravity.CENTER_HORIZONTAL
                    val fv = FlameView(context, cons.flame); addView(fv, LinearLayout.LayoutParams(dp(64), dp(64)))
                    text(Fmt.days(cons.current), TextStyle.TITLE).lp(WRAP, WRAP, t = 6)
                    text(if (cons.current == 0) "Comece hoje!" else "de consistência", TextStyle.CAPTION, Theme.p.textSoft)
                    text("Melhor: ${cons.best}", TextStyle.TINY, Theme.p.textFaint).lp(WRAP, WRAP, t = 4)
                }.clickable { act.push(ConsistencyScreen(act)) }
                val goals = repo.goals().filter { it.status == GoalStatus.ACTIVE }
                card(padding = 16) {
                    lp(0, MATCH, 1f, l = 7, b = 0)
                    horizontal { icon(Icon.TARGET, Theme.p.primaryDark, 20); text("Objetivos", TextStyle.SUBTITLE).lp(WRAP, WRAP, l = 6) }
                    if (goals.isEmpty()) {
                        text("Defina um objetivo para acompanhar seu progresso.", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 10)
                    } else {
                        for (g in goals.take(2)) {
                            val pr = repo.goalProgress(g, today)
                            text("${g.emoji} ${g.name}", TextStyle.LABEL).ellipsize().lp(MATCH, WRAP, t = 10)
                            horizontal {
                                lp(MATCH, WRAP, t = 5)
                                progressBar(pr.toFloat(), Theme.p.yellow, 8).lp(0, dp(8), 1f)
                                text(Fmt.pct(pr), TextStyle.TINY, Theme.p.textSoft).lp(WRAP, WRAP, l = 6)
                            }
                        }
                        if (goals.size > 2) text("+${goals.size - 2} em andamento", TextStyle.TINY, Theme.p.textFaint).lp(WRAP, WRAP, t = 8)
                    }
                }.clickable { act.push(GoalsScreen(act)) }
            }

            // ---------------- sua evolução
            val scores = repo.storedScores(today.minusDays(13), today)
            card {
                horizontal {
                    text("Sua evolução", TextStyle.HEADLINE).lp(0, WRAP, 1f)
                    text("Análises ›", TextStyle.LABEL, Theme.p.primaryDark).link { act.switchTab(4) }
                }
                if (scores.size < 2) {
                    text("Registre alguns dias para ver sua evolução aqui. 🌱", TextStyle.BODY, Theme.p.textSoft).lp(MATCH, WRAP, t = 8)
                } else {
                    val vals = (13 downTo 0).map { scores[today.minusDays(it.toLong())]?.toDouble() }
                    val labels = (13 downTo 0).map { Fmt.dowShort(today.minusDays(it.toLong()).dayOfWeek).take(1).uppercase() }
                    addView(LineChartView(context, listOf(LineSeries(vals, Theme.p.primaryDark)), labels, 0.0, 100.0, listOf(0.0, 50.0, 100.0)),
                        LinearLayout.LayoutParams(MATCH, dp(130)).apply { topMargin = dp(10) })
                    val moodWeek = repo.moodsInRange(today.minusDays(6), today).values.map { it.mood }
                    horizontal {
                        lp(MATCH, WRAP, t = 10)
                        miniStat("Score médio", scores.values.toList().takeLast(7).average().roundToInt().toString())
                        miniStat("Humor médio", if (moodWeek.isEmpty()) "–" else Fmt.num(Math.round(moodWeek.average() * 10) / 10.0))
                        miniStat("Dias registrados", cons.statusByDay.filterKeys { !it.isBefore(today.minusDays(6)) }.count { it.value == app.broto.core.streak.DayStatus.VALID }.toString() + "/7")
                    }
                }
            }.enter(120)

            // ---------------- atalhos
            horizontal {
                lp(MATCH, WRAP, b = 8)
                shortcut(Icon.TARGET, "Objetivos") { act.push(GoalsScreen(act)) }
                shortcut(Icon.DOC, "Relatórios") { act.push(ReportsScreen(act)) }
                shortcut(Icon.FLAME, "Consistência") { act.push(ConsistencyScreen(act)) }
                shortcut(Icon.SETTINGS, "Ajustes") { act.push(SettingsScreen(act)) }
            }
            if (repo.hasDemoData()) {
                text("🧪 Dados de demonstração ativos — remova em Ajustes › Dados.", TextStyle.CAPTION, Theme.p.textSoft) { gravity = Gravity.CENTER }.lp(MATCH, WRAP, t = 8)
            }
        }
    }

    private fun LinearLayout.miniStat(label: String, value: String) {
        vertical {
            lp(0, WRAP, 1f); gravity = Gravity.CENTER_HORIZONTAL
            background = rounded(Theme.p.surfaceAlt, dpf(16)); pad(6, 10)
            (layoutParams as LinearLayout.LayoutParams).setMargins(dp(3), 0, dp(3), 0)
            text(value, TextStyle.HEADLINE)
            text(label, TextStyle.TINY, Theme.p.textSoft) { gravity = Gravity.CENTER }.lp(WRAP, WRAP, t = 2)
        }
    }

    private fun LinearLayout.shortcut(icon: Icon, label: String, f: () -> Unit) {
        vertical {
            lp(0, WRAP, 1f); gravity = Gravity.CENTER_HORIZONTAL; pad(4, 8)
            frame {
                lp(dp(50), dp(50)); background = rounded(Theme.p.surface, dpf(18))
                val iv = ImageView(context); iv.setImageDrawable(IconDrawable(icon, Theme.p.primaryDark, dp(22)))
                addView(iv, android.widget.FrameLayout.LayoutParams(dp(22), dp(22), Gravity.CENTER))
            }
            text(label, TextStyle.TINY, Theme.p.textSoft).lp(WRAP, WRAP, t = 6)
            ripple(dpf(16)); onClick { f() }
        }
    }

    private fun subtitle(s: DayScore, moodDone: Boolean): String = when {
        s.score == null && !moodDone -> "Que tal começar registrando como você está?"
        !moodDone -> "Não esqueça de registrar seu humor hoje."
        else -> "Cada registro é um passo de autoconhecimento."
    }

    companion object {
        fun scoreTitle(s: Int?): String = when {
            s == null -> "Sem registros ainda"
            s >= 85 -> "Dia incrível! ✨"
            s >= 70 -> "Ótimo ritmo"
            s >= 50 -> "Bom equilíbrio"
            s >= 30 -> "Dia desafiador"
            else -> "Seja gentil com você 💚"
        }
    }
}

fun android.view.ViewGroup.tagView(label: String, color: Int): android.widget.TextView =
    android.widget.TextView(context).apply {
        text = label; style(TextStyle.CAPTION, Theme.p.text)
        background = rounded(Theme.blend(Theme.p.surface, color, if (Theme.p.dark) 0.3f else 0.35f), dpf(14)); pad(10, 6)
    }
