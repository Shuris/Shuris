package app.broto.screens

import android.app.TimePickerDialog
import android.content.Intent
import android.os.Build
import android.provider.Settings as AndroidSettings
import android.view.View
import app.broto.MainActivity
import app.broto.core.alerts.Alert
import app.broto.core.alerts.AlertCategory
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
                text("Categorias", TextStyle.HEADLINE).lp(WRAP, WRAP, b = 6)
                for (c in AlertCategory.values()) {
                    settingRow(c.label, c.description, right = {
                        addView(Toggle(act, c in a.enabled) { on -> s.alertSettings = a.copy(enabled = if (on) a.enabled + c else a.enabled - c); changed() })
                    })
                }
            }
            card {
                text("Horários", TextStyle.HEADLINE).lp(WRAP, WRAP, b = 6)
                fun timeRow(title: String, sub: String, minutes: Int, allowOff: Boolean, set: (Int) -> Unit) {
                    settingRow(title, if (minutes < 0) "Desativado" else "$sub às ${Fmt.time(minutes)}", Icon.CLOCK, right = {
                        if (allowOff) addView(Toggle(act, minutes >= 0) { on -> set(if (on) 21 * 60 else -1); changed() })
                    }) {
                        val m = if (minutes < 0) 21 * 60 else minutes
                        TimePickerDialog(act, { _, h, mm -> set(h * 60 + mm); changed() }, m / 60, m % 60, true).show()
                    }
                }
                timeRow("Lembrete de humor", "Todos os dias", s.moodReminderMinutes, true) { s.moodReminderMinutes = it }
                timeRow("Verificação de padrões", "Análise diária", s.dailyCheckMinutes, false) { s.dailyCheckMinutes = it }
                timeRow("Lembrete de consistência", "Se o dia ainda não foi registrado", s.streakReminderMinutes, true) { s.streakReminderMinutes = it }
                text("Lembretes de cada hábito são definidos no próprio hábito.", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 4)
            }
            card {
                text("Sem excessos", TextStyle.HEADLINE).lp(WRAP, WRAP, b = 4)
                text("Alertas de padrões por dia (os lembretes de hábitos não entram nessa conta)", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, b = 8)
                choiceChips(listOf(1, 2, 3, 5), a.maxPerDay, { "até $it" }) { s.alertSettings = s.alertSettings.copy(maxPerDay = it) }
                divider()
                settingRow("Horário silencioso", "Sem alertas de padrões entre ${Fmt.time(a.quietStart)} e ${Fmt.time(a.quietEnd)}", Icon.MOON) {
                    TimePickerDialog(act, { _, h, m ->
                        val start = h * 60 + m
                        TimePickerDialog(act, { _, h2, m2 -> s.alertSettings = s.alertSettings.copy(quietStart = start, quietEnd = h2 * 60 + m2); changed() }, a.quietEnd / 60, a.quietEnd % 60, true).apply { setTitle("Fim do silêncio") }.show()
                    }, a.quietStart / 60, a.quietStart % 60, true).apply { setTitle("Início do silêncio") }.show()
                }
                text("Um mesmo alerta nunca se repete antes de alguns dias, e nada é enviado fora dos dias programados de cada hábito.", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 4)
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
                Notifier.post(act, Alert("test", AlertCategory.MOOD, "Oi! Eu sou o Broto 🌱", "As notificações estão funcionando. Até o próximo lembrete!", 0, 0, "home"))
                act.snack(if (Notifier.canPost(act)) "Notificação enviada." else "Permita as notificações para recebê-las.")
            }
        }
    }
}
