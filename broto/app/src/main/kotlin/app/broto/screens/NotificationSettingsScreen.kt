package app.broto.screens

import android.app.TimePickerDialog
import android.content.Intent
import android.os.Build
import android.provider.Settings as AndroidSettings
import android.view.View
import app.broto.MainActivity
import app.broto.core.alerts.Alert
import app.broto.core.alerts.AlertCategory
import app.broto.core.alerts.CheckInEngine
import app.broto.core.alerts.DayPart
import app.broto.notify.Notifier
import app.broto.notify.Scheduler
import app.broto.ui.*

class NotificationSettingsScreen(act: MainActivity) : Screen(act) {
    override fun onShow() { if (visible) container.post { if (visible) render() } }

    override fun build(): View {
        val s = repo.settings
        val a = s.alertSettings
        fun changed() { Scheduler.rescheduleAll(act); render() }
        return page("Notificações", "Lembretes e alertas amigáveis") {
            if (!Notifier.canPost(act)) {
                card(color = Theme.p.coralSoft, padding = 16) {
                    text("As notificações estão bloqueadas no sistema", TextStyle.BODY_BOLD)
                    text("Permita as notificações do Broto para receber lembretes, mesmo com o app fechado.", TextStyle.CAPTION, Theme.p.text).lp(MATCH, WRAP, t = 4)
                    softButton("Permitir notificações", Icon.BELL, Theme.p.surface, Theme.p.text) {
                        if (Build.VERSION.SDK_INT >= 33 && act.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED)
                            act.requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 7)
                        else act.startActivity(Intent(AndroidSettings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(AndroidSettings.EXTRA_APP_PACKAGE, act.packageName))
                    }.lp(MATCH, WRAP, t = 10)
                }
            }
            card {
                settingRow("Notificações do Broto", if (s.notificationsEnabled) "Ativadas" else "Desativadas — nenhum lembrete será enviado", Icon.BELL, right = {
                    addView(Toggle(act, s.notificationsEnabled) { s.notificationsEnabled = it; changed() })
                })
            }
            if (!s.notificationsEnabled) return@page
            card {
                text("Notificações diárias", TextStyle.HEADLINE)
                text("Acompanhamento ao longo do dia, com botões para marcar hábitos e as carinhas de humor direto na notificação.", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 4, b = 10)
                val times = s.checkInTimes
                horizontal {
                    vertical { lp(0, WRAP, 1f)
                        text("Quantas por dia", TextStyle.BODY_BOLD)
                        text(if (times.isEmpty()) "Desativadas" else "${times.size} por dia", TextStyle.CAPTION, Theme.p.textSoft) }
                    addView(Stepper(act, times.size.toDouble(), 1.0, 0.0) { v ->
                        val n = v.toInt().coerceIn(0, CheckInEngine.MAX_PER_DAY)
                        s.checkInTimes = CheckInEngine.defaultTimes(n); changed()
                    })
                }
                for ((i, m) in times.withIndex()) {
                    divider()
                    val part = CheckInEngine.partOf(m)
                    val emoji = when (part) { DayPart.MORNING -> "☀️"; DayPart.AFTERNOON -> "🌤️"; DayPart.EVENING -> "🌙" }
                    val what = when {
                        i == times.lastIndex -> "Humor do dia, o que falta e a sequência"
                        part == DayPart.MORNING -> "Hábitos do dia com botões para marcar"
                        else -> "Progresso do dia e o que ainda falta"
                    }
                    settingRow("$emoji ${part.label} · ${Fmt.time(m)}", what, Icon.CLOCK) {
                        TimePickerDialog(act, { _, h, mm ->
                            s.checkInTimes = times.toMutableList().also { it[i] = h * 60 + mm }; changed()
                        }, m / 60, m % 60, true).show()
                    }
                }
                if (times.isNotEmpty() && times != CheckInEngine.defaultTimes(times.size))
                    ghostButton("Restaurar horários padrão", Theme.p.primaryDark) { s.checkInTimes = CheckInEngine.defaultTimes(times.size); changed() }
                text("Toque num horário para mudar. Dicas de padrões (ex.: um hábito que ficou parado) aparecem dentro dessas notificações, sem notificações extras. Lembretes de cada hábito são definidos no próprio hábito.",
                    TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 8)
            }
            card {
                text("Categorias", TextStyle.HEADLINE).lp(WRAP, WRAP, b = 6)
                for (c in AlertCategory.values()) {
                    settingRow(c.label, c.description, right = {
                        addView(Toggle(act, c in a.enabled) { on -> s.alertSettings = a.copy(enabled = if (on) a.enabled + c else a.enabled - c); changed() })
                    })
                }
            }
            if (Build.VERSION.SDK_INT >= 31 && !Scheduler.canExact(act)) {
                card(color = Theme.p.surfaceAlt) {
                    text("Horários exatos", TextStyle.BODY_BOLD)
                    text("Sem a permissão de alarmes exatos, o Android pode atrasar os lembretes alguns minutos.", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 4)
                    softButton("Permitir alarmes exatos", color = Theme.p.surface, textColor = Theme.p.text) {
                        try { act.startActivity(Intent(AndroidSettings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, android.net.Uri.parse("package:${act.packageName}"))) } catch (_: Exception) {}
                    }.lp(MATCH, WRAP, t = 8)
                }
            }
            softButton("Enviar notificação de teste", Icon.BELL) {
                val times = s.checkInTimes
                val nowMin = java.time.LocalTime.now().let { it.hour * 60 + it.minute }
                val slot = times.indexOfLast { it <= nowMin }.coerceAtLeast(0)
                val c = if (times.isNotEmpty()) app.broto.notify.AlarmReceiver.buildCheckIn(act, repo, slot, record = false) else null
                if (c != null) Notifier.postCheckIn(act, c, slot)
                else Notifier.post(act, Alert("test", AlertCategory.MOOD, "Oi! Eu sou o Broto 🌱", "As notificações estão funcionando. Até o próximo lembrete!", 0, 0, "home"))
                act.snack(if (Notifier.canPost(act)) "Notificação enviada." else "Permita as notificações para recebê-las.")
            }
        }
    }
}
