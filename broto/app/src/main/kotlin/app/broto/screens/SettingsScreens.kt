package app.broto.screens

import android.app.Activity
import android.content.Intent
import android.graphics.Paint
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import app.broto.MainActivity
import app.broto.data.Backup
import app.broto.data.DemoData
import app.broto.data.FilesProvider
import app.broto.security.Security
import app.broto.ui.*
import java.io.File
import java.time.LocalDate

class SettingsScreen(act: MainActivity) : Screen(act) {
    override fun build(): View {
        val s = repo.settings
        return page("Ajustes") {
            card {
                text("Perfil", TextStyle.HEADLINE).lp(WRAP, WRAP, b = 4)
                fieldLabel("Como podemos te chamar?")
                val f = field("Seu nome", s.userName)
                f.setOnFocusChangeListener { _, has -> if (!has) { s.userName = f.text.toString(); repo.notifyChanged() } }
                f.addTextChangedListener(watcher { s.userName = it })
            }
            card {
                text("Aparência", TextStyle.HEADLINE).lp(WRAP, WRAP, b = 10)
                segmented(listOf("system", "light", "dark"), s.theme, { when (it) { "light" -> "☀️ Claro"; "dark" -> "🌙 Escuro"; else -> "Sistema" } }) {
                    s.theme = it; act.restartForTheme()
                }
                text("Cor de destaque", TextStyle.LABEL, Theme.p.textSoft).lp(WRAP, WRAP, t = 14, b = 8)
                horizontal {
                    for (a in Theme.accents) {
                        vertical {
                            lp(0, WRAP, 1f); gravity = Gravity.CENTER_HORIZONTAL
                            addView(DrawView(act) { c, w, h ->
                                val p = Paint(Paint.ANTI_ALIAS_FLAG)
                                p.color = a.primary; c.drawCircle(w / 2f, h / 2f, w / 2f - dpf(5), p)
                                p.color = a.dark; c.drawCircle(w / 2f + dpf(7), h / 2f + dpf(7), dpf(6), p)
                                if (a.key == s.accent) { p.style = Paint.Style.STROKE; p.strokeWidth = dpf(2.5f); p.color = Theme.p.text; c.drawCircle(w / 2f, h / 2f, w / 2f - dpf(1.5f), p) }
                            }, LinearLayout.LayoutParams(dp(44), dp(44)))
                            text(a.label, TextStyle.TINY, Theme.p.textSoft).lp(WRAP, WRAP, t = 4)
                            onClick { s.accent = a.key; act.restartForTheme() }
                        }
                    }
                }
            }
            card(padding = 10) {
                settingRow("Gerenciar hábitos", "Editar, reordenar, pausar e arquivar", Icon.HABITS) { act.push(ManageHabitsScreen(act)) }
                settingRow("Meus objetivos", "Metas de curto, médio e longo prazo", Icon.TARGET) { act.push(GoalsScreen(act)) }
                settingRow("Score e consistência", "Pesos do score, critério da sequência e dias de descanso", Icon.FLAME) { act.push(ScoreSettingsScreen(act)) }
                settingRow("Notificações", "Lembretes, alertas, horários e silêncio", Icon.BELL) { act.push(NotificationSettingsScreen(act)) }
                settingRow("Relatórios em PDF", "Gerar, abrir e compartilhar relatórios", Icon.DOC) { act.push(ReportsScreen(act)) }
            }
            card(padding = 10) {
                settingRow("Backup e restauração", "Cópias manuais e automáticas, exportação de dados", Icon.DATABASE) { act.push(BackupScreen(act)) }
                settingRow("Segurança", if (act.security.pinEnabled) "Protegido por PIN" + if (act.security.biometricEnabled) " e biometria" else "" else "Proteger o app com PIN ou biometria", Icon.LOCK) { act.push(SecurityScreen(act)) }
                settingRow("Sobre o Broto", "Privacidade, como o score funciona e créditos", Icon.INFO) { act.push(AboutScreen(act)) }
            }
            text("🔒 Todos os seus dados ficam apenas neste aparelho.", TextStyle.CAPTION, Theme.p.textSoft) { gravity = Gravity.CENTER }.lp(MATCH, WRAP, t = 6)
        }
    }
}

class BackupScreen(act: MainActivity) : Screen(act) {
    override fun build(): View = page("Backup e restauração", "Seus dados, sob seu controle") {
        val counts = repo.counts()
        card(color = Theme.p.surfaceAlt) {
            text("O que há no aparelho", TextStyle.SUBTITLE).lp(WRAP, WRAP, b = 6)
            for ((k, v) in counts) horizontal { lp(MATCH, WRAP, t = 2); text(k, TextStyle.BODY, Theme.p.textSoft).lp(0, WRAP, 1f); text(v.toString(), TextStyle.BODY_BOLD) }
        }
        card {
            text("Fazer backup", TextStyle.HEADLINE)
            text("Gera um arquivo com tudo: hábitos, histórico, humor, emoções, diário, objetivos, configurações e histórico de score. Guarde-o onde quiser (Drive, e-mail, computador).",
                TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 4, b = 8)
            primaryButton("Salvar backup…", Icon.DOWNLOAD) { exportBackup(null) }
            softButton("Salvar backup protegido por senha…", Icon.LOCK) { askPassword("Senha do backup", "Você vai precisar dela para restaurar. Não é possível recuperá-la.", confirm = true) { exportBackup(it) } }
        }
        card {
            text("Restaurar", TextStyle.HEADLINE)
            text("Substitui os dados atuais pelos do arquivo. Antes disso, uma cópia automática dos dados atuais é guardada.", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 4, b = 8)
            softButton("Escolher arquivo de backup…", Icon.FOLDER, Theme.p.surfaceAlt, Theme.p.text) { pickRestore() }
        }
        val snaps = Backup.snapshots(act)
        card {
            text("Cópias automáticas", TextStyle.HEADLINE)
            text("Uma por dia, guardadas no aparelho (as 7 mais recentes). Protegem contra erros e dados corrompidos.", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 4, b = 6)
            if (snaps.isEmpty()) text("Nenhuma cópia ainda.", TextStyle.BODY, Theme.p.textSoft)
            for (f in snaps) {
                settingRow(f.name.removePrefix("snapshot-").removeSuffix(".json").substringBeforeLast('-'), "${f.length() / 1024} KB", Icon.REFRESH) {
                    confirm(act, "Restaurar esta cópia?", "Os dados atuais serão substituídos pelos desta cópia automática.", "Restaurar") { doRestore(f.readText(), null) }
                }
            }
            softButton("Criar cópia agora", Icon.PLUS, Theme.p.surfaceAlt, Theme.p.text) { Backup.autoSnapshot(act, repo, force = true); act.snack("Cópia criada."); render() }
        }
        card {
            text("Exportar dados", TextStyle.HEADLINE)
            text("Planilha (CSV) com um registro por dia: score, humor, energia, estresse, sono, emoções, relato e valores de cada hábito.", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 4, b = 8)
            softButton("Exportar CSV", Icon.SHARE) {
                val f = File(FilesProvider.exportsDir(act), "broto-dados-${LocalDate.now()}.csv"); f.writeText(Backup.csv(repo))
                options(act, "Exportar CSV", listOf(
                    Triple(Icon.SHARE, "Compartilhar") { ReportsScreen.share(act, f, "exports", "text/csv") },
                    Triple(Icon.DOWNLOAD, "Salvar em…") { ReportsScreen.saveAs(act, f, "text/csv") },
                ))
            }
        }
        card {
            text("Dados de demonstração", TextStyle.HEADLINE)
            val has = repo.hasDemoData()
            text(if (has) "Há dados de demonstração (marcados como tal). Remova-os para usar só os seus registros." else "Gere 75 dias de dados fictícios, claramente identificados, para explorar o app. Eles podem ser removidos a qualquer momento.",
                TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 4, b = 8)
            if (has) softButton("Remover dados de demonstração", Icon.TRASH, Theme.p.coralSoft, Theme.p.text) {
                confirm(act, "Remover dados de demonstração?", "Somente os itens de demonstração serão apagados. Seus registros reais não são afetados.", "Remover", true) { repo.clearDemoData(); act.snack("Dados de demonstração removidos.") }
            } else softButton("Gerar dados de demonstração", Icon.SPARKLE, Theme.p.surfaceAlt, Theme.p.text) { DemoData.generate(repo); act.snack("Dados de demonstração criados.") }
        }
        ghostButton("Apagar todos os dados…", Theme.p.coral) {
            confirm(act, "Apagar TODOS os dados?", "Hábitos, humor, diário, objetivos e histórico serão apagados deste aparelho. Uma cópia automática será feita antes.", "Apagar tudo", true) {
                Backup.autoSnapshot(act, repo, force = true, tag = "antes-de-apagar")
                val db = repo.db
                db.beginTransaction(); try { for (t in app.broto.data.BrotoDatabase.TABLES.reversed()) if (t != "settings") db.delete(t, null, null); db.setTransactionSuccessful() } finally { db.endTransaction() }
                repo.notifyChanged(); act.snack("Dados apagados.")
            }
        }
    }

    private fun exportBackup(password: String?) {
        val json = Backup.export(repo)
        val content = if (password != null) Backup.encrypt(json, password) else json
        val name = "broto-backup-${LocalDate.now()}${if (password != null) "-protegido" else ""}.json"
        val i = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE, name)
        act.launchForResult(i) { code, data ->
            val uri = data?.data
            if (code == Activity.RESULT_OK && uri != null) {
                try { act.contentResolver.openOutputStream(uri, "w")!!.use { it.write(content.toByteArray(Charsets.UTF_8)) }; act.snack("Backup salvo. ✅") }
                catch (e: Exception) { act.snack("Não foi possível salvar: ${e.message}") }
            }
        }
    }

    private fun pickRestore() {
        val i = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
        act.launchForResult(i) { code, data ->
            val uri = data?.data ?: return@launchForResult
            if (code != Activity.RESULT_OK) return@launchForResult
            val text = try { act.contentResolver.openInputStream(uri)!!.use { it.readBytes().toString(Charsets.UTF_8) } } catch (e: Exception) { act.snack("Não foi possível ler o arquivo."); return@launchForResult }
            if (Backup.isEncrypted(text)) askPassword("Senha do backup", "Este backup está protegido.", confirm = false) { pw -> preview(text, pw) } else preview(text, null)
        }
    }

    private fun preview(text: String, pw: String?) {
        val info = try { Backup.inspect(text, pw) } catch (e: Exception) { act.snack(e.message ?: "Backup inválido."); return }
        val names = mapOf("habit" to "Hábitos", "habit_log" to "Registros de hábitos", "mood" to "Dias de humor", "journal" to "Entradas do diário", "goal" to "Objetivos", "daily_score" to "Dias com score")
        val summary = names.entries.joinToString("\n") { "${it.value}: ${info.counts[it.key] ?: 0}" }
        confirm(act, "Restaurar este backup?", "Feito em ${info.exportedAt.replace('T', ' ')}\n\n$summary\n\nOs dados atuais serão substituídos (uma cópia automática será feita antes).", "Restaurar") { doRestore(text, pw) }
    }

    private fun doRestore(text: String, pw: String?) {
        try {
            Backup.autoSnapshot(act, repo, force = true, tag = "antes-de-restaurar")
            Backup.restore(repo, text, pw)
            repo.recomputeScoresFrom(LocalDate.now().minusDays(1))
            app.broto.notify.Scheduler.rescheduleAll(act)
            act.snack("Backup restaurado com sucesso! 🌱")
            act.restartForTheme()
        } catch (e: Exception) { act.snack(e.message ?: "Falha ao restaurar. Nada foi alterado.") }
    }

    private fun askPassword(title: String, msg: String, confirm: Boolean, onOk: (String) -> Unit) {
        val s = BottomSheet(act)
        s.title(title, msg)
        val a = s.content.field("Senha", "")
        a.inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
        val b = if (confirm) s.content.field("Confirme a senha", "").also { it.inputType = a.inputType } else null
        s.content.primaryButton("Continuar") {
            val p = a.text.toString()
            if (p.length < 4) { act.snack("Use pelo menos 4 caracteres."); return@primaryButton }
            if (b != null && b.text.toString() != p) { act.snack("As senhas não conferem."); return@primaryButton }
            s.dismiss(); onOk(p)
        }
        s.show()
    }
}

class SecurityScreen(act: MainActivity) : Screen(act) {
    override fun build(): View {
        val sec = act.security
        return page("Segurança", "Proteja seus registros pessoais") {
            card {
                settingRow("Bloquear com PIN", if (sec.pinEnabled) "Ativado — o PIN é pedido ao abrir o app" else "Desativado", Icon.LOCK, right = {
                    addView(Toggle(act, sec.pinEnabled) { on -> if (on) setupPin() else confirm(act, "Desativar o PIN?", "O app poderá ser aberto sem proteção.", "Desativar", true) { sec.clearPin(); act.applySecureFlag(); render() } })
                })
                if (sec.pinEnabled) {
                    divider()
                    val bioOk = Security.biometricAvailable(act)
                    settingRow("Desbloquear com biometria", if (bioOk) "Digital ou reconhecimento facial" else "Nenhuma biometria cadastrada neste aparelho", Icon.FINGERPRINT, right = {
                        if (bioOk) addView(Toggle(act, sec.biometricEnabled) { sec.biometricEnabled = it })
                    })
                    divider()
                    settingRow("Trocar PIN", null, Icon.EDIT) { setupPin() }
                    divider()
                    text("Pedir o PIN de novo após", TextStyle.LABEL, Theme.p.textSoft).lp(WRAP, WRAP, t = 6, b = 8)
                    choiceChips(listOf(0, 60, 300, 900), sec.lockDelaySec, { when (it) { 0 -> "Imediatamente"; 60 -> "1 min"; 300 -> "5 min"; else -> "15 min" } }) { sec.lockDelaySec = it }
                }
            }
            card(color = Theme.p.surfaceAlt) {
                text("Privacidade", TextStyle.SUBTITLE)
                for (t in listOf("Tudo fica armazenado apenas neste aparelho, sem conta e sem internet.", "Nenhum dado é enviado automaticamente para lugar algum.",
                    "O backup do Android na nuvem está desativado para este app; você decide onde guardar seus backups.", "Com o PIN ativo, o conteúdo fica oculto na tela de apps recentes e capturas de tela são bloqueadas."))
                    text("• $t", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 6)
            }
        }
    }

    private fun setupPin() {
        val sec = act.security
        val s = BottomSheet(act)
        s.title("Criar PIN", "Use de 4 a 6 números. Se esquecer, será preciso reinstalar o app (restaure um backup depois).")
        val a = s.content.field("Novo PIN", "", numeric = true)
        a.inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD
        val b = s.content.field("Confirme o PIN", "", numeric = true); b.inputType = a.inputType
        s.content.primaryButton("Salvar PIN") {
            val p = a.text.toString()
            if (p.length !in 4..6 || !p.all { it.isDigit() }) { act.snack("O PIN deve ter de 4 a 6 números."); return@primaryButton }
            if (p != b.text.toString()) { act.snack("Os PINs não conferem."); return@primaryButton }
            sec.setPin(p); act.applySecureFlag(); s.dismiss(); render(); act.snack("PIN ativado. 🔒")
        }
        s.show()
    }
}

class AboutScreen(act: MainActivity) : Screen(act) {
    override fun build(): View = page("Sobre o Broto") {
        card(padding = 22) {
            gravity = Gravity.CENTER_HORIZONTAL
            drawing(-1, 110) { c, w, h -> MoodArt.draw(c, 5, (w - dpf(100)) / 2f, 0f, dpf(100)) }
            text("Broto", TextStyle.DISPLAY).lp(WRAP, WRAP, t = 8)
            text("Hábitos, humor e evolução · versão ${versionName()}", TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 4)
            text("Um app pessoal de autoconhecimento: acompanhe hábitos, emoções, diário e objetivos, e descubra padrões com carinho — sem julgamentos.", TextStyle.BODY, Theme.p.textSoft) { gravity = Gravity.CENTER }.lp(MATCH, WRAP, t = 12)
        }
        card {
            text("Como o score funciona", TextStyle.HEADLINE).lp(WRAP, WRAP, b = 6)
            val w = repo.settings.weights
            for (t in listOf(
                "O score diário vai de 0 a 100 e combina: hábitos positivos (${w.positive.toInt()}%), controle dos hábitos negativos (${w.negative.toInt()}%) e bem-estar emocional (${w.wellbeing.toInt()}%).",
                "Hábitos com meta numérica contam proporcionalmente ao progresso (60 de 120 minutos = 50%).",
                "Evitar um hábito negativo vale a nota máxima. Passar do limite reduz a nota de forma gradual — um único hábito nunca zera o dia.",
                "Humor, energia e estresse formam o bem-estar. Se você não registrou o humor, essa parte é ignorada (não conta como humor ruim).",
                "Hábitos fora dos dias programados, antes da data de início, pausados ou em dias de descanso nunca são penalizados.",
            )) text("• $t", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 5)
        }
        card {
            text("Privacidade", TextStyle.HEADLINE).lp(WRAP, WRAP, b = 6)
            text("O Broto funciona 100% offline. Não há conta, servidores, anúncios ou rastreamento. Seus registros — inclusive o diário — nunca saem do aparelho, a não ser que você mesmo exporte um backup ou compartilhe um relatório.", TextStyle.CAPTION, Theme.p.textSoft)
        }
        card {
            text("Créditos", TextStyle.HEADLINE).lp(WRAP, WRAP, b = 6)
            text("Tipografia: Nunito, © The Nunito Project Authors, licenciada sob a SIL Open Font License 1.1.\nIlustrações, ícones e gráficos desenhados para o Broto. Estética inspirada em apps de diário de humor minimalistas.", TextStyle.CAPTION, Theme.p.textSoft)
        }
    }

    private fun versionName(): String = try { act.packageManager.getPackageInfo(act.packageName, 0).versionName ?: "1.0" } catch (e: Exception) { "1.0" }
}
