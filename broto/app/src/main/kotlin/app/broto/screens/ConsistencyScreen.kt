package app.broto.screens

import android.graphics.Paint
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import app.broto.MainActivity
import app.broto.core.model.ScoreWeights
import app.broto.core.model.StreakCriterion
import app.broto.core.model.Weekdays
import app.broto.core.streak.DayStatus
import app.broto.core.streak.FlameLevel
import app.broto.ui.*
import java.time.DayOfWeek
import java.time.LocalDate
import kotlin.math.roundToInt

class ConsistencyScreen(act: MainActivity) : Screen(act) {
    private var month = LocalDate.now().withDayOfMonth(1)

    override fun build(): View {
        val today = LocalDate.now()
        val c = repo.consistency(today)
        return page("Minha Consistência") {
            card(color = Theme.p.surface, padding = 22) {
                gravity = Gravity.CENTER_HORIZONTAL
                frame {
                    lp(MATCH, dp(170))
                    addView(DrawView(act) { cv, w, h ->
                        Decor.sprig(cv, dpf(24), h.toFloat(), dpf(70), Theme.alpha(Theme.p.primary, 0.45f), -15f, true)
                        Decor.sprig(cv, w - dpf(24), h.toFloat(), dpf(64), Theme.alpha(Theme.p.primary, 0.45f), 15f)
                    }, android.widget.FrameLayout.LayoutParams(MATCH, MATCH))
                    addView(FlameView(act, c.flame), android.widget.FrameLayout.LayoutParams(dp(160), dp(160), Gravity.CENTER))
                }
                text(if (c.current == 0) "Acenda sua chama" else Fmt.days(c.current), TextStyle.DISPLAY) { gravity = Gravity.CENTER }.lp(WRAP, WRAP, t = 4)
                text(if (c.current == 0) "Faça um registro hoje para começar" else "${c.flame.label} · ${if (c.todayDone) "hoje já conta ✓" else "registre hoje para continuar"}",
                    TextStyle.BODY, Theme.p.textSoft) { gravity = Gravity.CENTER }.lp(WRAP, WRAP, t = 4)
                val next = c.flame.next
                if (next != null) {
                    val prevMin = c.flame.minDays
                    progressBar(((c.current - prevMin).toFloat() / (next.minDays - prevMin)).coerceIn(0f, 1f), 0xFFFFB938.toInt(), 10).lp(MATCH, dp(10), t = 16)
                    text("Faltam ${Fmt.days(next.minDays - c.current)} para: ${next.label}", TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 6)
                }
            }.enter()
            horizontal {
                lp(MATCH, WRAP, b = 14)
                stat("Atual", c.current.toString())
                stat("Melhor sequência", c.best.toString())
                stat("Dias registrados", c.totalValidDays.toString())
            }
            // marcos
            card {
                text("Conquistas", TextStyle.HEADLINE).lp(WRAP, WRAP, b = 12)
                horizontal {
                    for (lvl in FlameLevel.values().drop(1)) {
                        val got = c.best >= lvl.minDays
                        vertical {
                            lp(0, WRAP, 1f); gravity = Gravity.CENTER_HORIZONTAL
                            val fv = FlameView(act, if (got) lvl else FlameLevel.NONE, animate = false)
                            addView(fv, LinearLayout.LayoutParams(dp(44), dp(44)))
                            text(Fmt.days(lvl.minDays), TextStyle.TINY, if (got) Theme.p.text else Theme.p.textFaint).lp(WRAP, WRAP, t = 4)
                        }
                    }
                }
            }
            // calendário
            card {
                horizontal {
                    iconButton(Icon.LEFT, Theme.p.textSoft, null, 36, 18) { month = month.minusMonths(1); render() }
                    text(Fmt.monthYear(month), TextStyle.SUBTITLE) { gravity = Gravity.CENTER }.lp(0, WRAP, 1f)
                    val canNext = month.plusMonths(1) <= today
                    iconButton(Icon.RIGHT, if (canNext) Theme.p.textSoft else Theme.p.outline, null, 36, 18) { if (canNext) { month = month.plusMonths(1); render() } }
                }
                space(6)
                addView(MonthGrid.build(act, month, 40) { cell, d ->
                    if (d == null) return@build
                    val st = c.statusByDay[d]
                    cell.addView(DrawView(act) { cv, w, h ->
                        val p = Paint(Paint.ANTI_ALIAS_FLAG)
                        val r = minOf(w, h) / 2f - dpf(3)
                        when (st) {
                            DayStatus.VALID -> { p.color = 0xFFFFC94A.toInt(); cv.drawCircle(w / 2f, h / 2f, r, p) }
                            DayStatus.REST -> { p.color = Theme.p.primarySoft; cv.drawCircle(w / 2f, h / 2f, r, p) }
                            DayStatus.MISSED -> { p.color = Theme.p.surfaceAlt; cv.drawCircle(w / 2f, h / 2f, r, p) }
                            DayStatus.PENDING -> { p.style = Paint.Style.STROKE; p.strokeWidth = dpf(1.6f); p.color = 0xFFFFB938.toInt(); cv.drawCircle(w / 2f, h / 2f, r, p); p.style = Paint.Style.FILL }
                            else -> {}
                        }
                        p.textAlign = Paint.Align.CENTER; p.typeface = Fonts.semibold; p.textSize = dpf(12)
                        p.color = if (st == null || d.isAfter(today)) Theme.p.textFaint else if (st == DayStatus.VALID) 0xFF5A3A00.toInt() else Theme.p.text
                        cv.drawText(if (st == DayStatus.REST) "🌿" else d.dayOfMonth.toString(), w / 2f, h / 2f + dpf(4), p)
                    }, LinearLayout.LayoutParams(dp(36), dp(36)))
                })
                horizontal { lp(MATCH, WRAP, t = 10); legend(0xFFFFC94A.toInt(), "Registrado"); legend(Theme.p.primarySoft, "Descanso"); legend(Theme.p.surfaceAlt, "Sem registro") }
            }
            // histórico de sequências
            val runs = c.runs.filter { it.length >= 2 }.sortedByDescending { it.length }.take(6)
            if (runs.isNotEmpty()) {
                card {
                    text("Suas maiores sequências", TextStyle.HEADLINE).lp(WRAP, WRAP, b = 8)
                    val max = runs.first().length.toFloat()
                    for (r in runs) {
                        horizontal {
                            lp(MATCH, WRAP, t = 8)
                            text("🔥 ${r.length}", TextStyle.BODY_BOLD).lp(dp(64), WRAP)
                            vertical { lp(0, WRAP, 1f)
                                progressBar(r.length / max, 0xFFFFC94A.toInt(), 8)
                                text(Fmt.range(r.start, r.end), TextStyle.TINY, Theme.p.textSoft).lp(WRAP, WRAP, t = 3) }
                        }
                    }
                }
            }
            // regras
            card(color = Theme.p.surfaceAlt) {
                text("Como funciona", TextStyle.SUBTITLE)
                text("Um dia conta quando você faz o registro essencial: ${repo.settings.streakCriterion.description.lowercase()}. " +
                    "Não é preciso cumprir 100% dos hábitos — a chama mede o acompanhamento, não a perfeição. Dias de descanso não contam e também não quebram a sequência.",
                    TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 6)
                text("💚 Descanse quando precisar. Nenhuma sequência vale mais que a sua saúde.", TextStyle.CAPTION, Theme.p.text).lp(MATCH, WRAP, t = 8)
                softButton("Ajustar critério e dias de descanso", Icon.SETTINGS, Theme.p.surface, Theme.p.text) { act.push(ScoreSettingsScreen(act)) }.lp(MATCH, WRAP, t = 10)
            }
        }
    }

    private fun LinearLayout.stat(label: String, value: String) {
        vertical {
            lp(0, WRAP, 1f); gravity = Gravity.CENTER_HORIZONTAL
            background = rounded(Theme.p.surface, dpf(20)); pad(6, 14)
            (layoutParams as LinearLayout.LayoutParams).setMargins(dp(4), 0, dp(4), 0)
            text(value, TextStyle.TITLE)
            text(label, TextStyle.TINY, Theme.p.textSoft) { gravity = Gravity.CENTER }.lp(WRAP, WRAP, t = 4)
        }
    }
}

/** Pesos do score, critério de consistência e dias de descanso. */
class ScoreSettingsScreen(act: MainActivity) : Screen(act) {
    private var w = repo.settings.weights

    override fun build(): View = page("Score e consistência") {
        card {
            text("Pesos do score", TextStyle.HEADLINE)
            text("Defina quanto cada parte influencia sua pontuação diária. Os valores são normalizados para somar 100%.", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 4, b = 10)
            fun row(label: String, v: Double, set: (Double) -> Unit) {
                horizontal {
                    lp(MATCH, WRAP, t = 6, b = 6)
                    vertical { lp(0, WRAP, 1f)
                        text(label, TextStyle.BODY_BOLD)
                        text("${if (w.total > 0) (v / w.total * 100).roundToInt() else 0}% do score", TextStyle.CAPTION, Theme.p.textSoft) }
                    addView(Stepper(act, v, 5.0, 0.0) { set(it.coerceAtMost(100.0)); render() })
                }
            }
            row("🌱 Hábitos positivos", w.positive) { w = w.copy(positive = it) }
            row("🍂 Controle dos negativos", w.negative) { w = w.copy(negative = it) }
            row("💛 Bem-estar emocional", w.wellbeing) { w = w.copy(wellbeing = it) }
            horizontal {
                lp(MATCH, WRAP, t = 8)
                softButton("Padrão", color = Theme.p.surfaceAlt, textColor = Theme.p.text) { w = ScoreWeights(); render() }.lp(0, WRAP, 1f, r = 6)
                primaryButton("Aplicar") {
                    if (w.total <= 0) { act.snack("Pelo menos um peso precisa ser maior que zero."); return@primaryButton }
                    repo.settings.weights = w; repo.recomputeAllScores(); repo.notifyChanged(); act.snack("Pesos aplicados. Histórico recalculado.")
                }.lp(0, WRAP, 1f, l = 6)
            }
        }
        card {
            text("Critério da sequência", TextStyle.HEADLINE).lp(WRAP, WRAP, b = 10)
            val cur = repo.settings.streakCriterion
            for (c in StreakCriterion.values()) {
                settingRow(c.label, c.description, right = {
                    addView(CheckView(act, if (c == cur) 2 else 0).apply { layoutParams = LinearLayout.LayoutParams(dp(36), dp(36)) })
                }) { repo.settings.streakCriterion = c; repo.notifyChanged() }
            }
        }
        card {
            text("Dias de descanso semanais", TextStyle.HEADLINE)
            text("Nesses dias os hábitos positivos não são cobrados e a sequência não é quebrada. Também dá para marcar dias avulsos na tela de Hábitos.", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 4, b = 10)
            val rest = Weekdays(repo.settings.restWeekdays)
            horizontal {
                for (d in DayOfWeek.values()) {
                    val on = rest.contains(d)
                    text(Fmt.dowShort(d), TextStyle.LABEL, if (on) Theme.p.onPrimary else Theme.p.textSoft) {
                        gravity = Gravity.CENTER; background = rounded(if (on) Theme.p.primary else Theme.p.surfaceAlt, dpf(16))
                        layoutParams = LinearLayout.LayoutParams(0, dp(42), 1f).apply { setMargins(dp(2), 0, dp(2), 0) }
                        onClick { repo.settings.restWeekdays = rest.with(d, !on).mask; repo.recomputeAllScores(); repo.notifyChanged() }
                    }
                }
            }
        }
    }
}
