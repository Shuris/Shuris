package app.broto.screens

import android.app.Activity
import android.app.DatePickerDialog
import android.content.Intent
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import app.broto.MainActivity
import app.broto.data.FilesProvider
import app.broto.pdf.*
import app.broto.ui.*
import java.io.File
import java.time.LocalDate

class ReportsScreen(act: MainActivity) : Screen(act) {
    private var type = ReportType.MONTHLY
    private var ref: LocalDate = LocalDate.now()
    private var customFrom: LocalDate = LocalDate.now().minusDays(29)
    private var customTo: LocalDate = LocalDate.now()
    private var sections = ReportSection.values().toSet() - ReportSection.JOURNAL
    private var charts = true
    private var style = ReportStyle.COLOR
    private var busy = false

    private fun range(): Pair<LocalDate, LocalDate> = if (type == ReportType.CUSTOM) Pair(minOf(customFrom, customTo), maxOf(customFrom, customTo)) else type.defaultRange(ref)

    override fun build(): View {
        val (from, to) = range()
        val today = LocalDate.now()
        return page("Relatórios em PDF", "Gerados no seu aparelho, sem internet") {
            card {
                text("Tipo de relatório", TextStyle.SUBTITLE).lp(WRAP, WRAP, b = 8)
                choiceChips(ReportType.values().toList(), type, { it.label }) { type = it; ref = today; render() }
                text("Período", TextStyle.SUBTITLE).lp(WRAP, WRAP, t = 16, b = 8)
                if (type == ReportType.CUSTOM) {
                    horizontal {
                        dateBox("De", customFrom) { customFrom = it }.lp(0, WRAP, 1f, r = 6)
                        dateBox("Até", customTo) { customTo = it }.lp(0, WRAP, 1f, l = 6)
                    }
                } else {
                    horizontal {
                        background = rounded(Theme.p.surfaceAlt, dpf(18)); pad(4)
                        iconButton(Icon.LEFT, Theme.p.text, null, 40, 20) { shift(-1) }
                        text(Fmt.range(from, to).replaceFirstChar { it.uppercase() }, TextStyle.BODY_BOLD) { gravity = Gravity.CENTER
                            if (type == ReportType.DAILY) { ripple(dpf(12)); onClick { pickDay() } } }.lp(0, WRAP, 1f)
                        val canNext = !shifted(1).first.isAfter(today)
                        iconButton(Icon.RIGHT, if (canNext) Theme.p.text else Theme.p.outline, null, 40, 20) { if (canNext) shift(1) }
                    }
                }
            }
            card {
                text("Seções", TextStyle.SUBTITLE).lp(WRAP, WRAP, b = 4)
                for (s in ReportSection.values().filter { it != ReportSection.JOURNAL }) {
                    settingRow(s.label, s.description, right = { addView(Toggle(act, s in sections) { on -> sections = if (on) sections + s else sections - s }) })
                }
                divider()
                settingRow("Incluir relatos do diário", "Seus textos pessoais entram no PDF. Desativado por padrão para proteger sua privacidade.", Icon.LOCK, right = {
                    addView(Toggle(act, ReportSection.JOURNAL in sections) { on -> sections = if (on) sections + ReportSection.JOURNAL else sections - ReportSection.JOURNAL })
                })
                settingRow("Incluir gráficos", null, Icon.CHART, right = { addView(Toggle(act, charts) { charts = it }) })
                text("Formato visual", TextStyle.LABEL, Theme.p.textSoft).lp(WRAP, WRAP, t = 8, b = 6)
                segmented(ReportStyle.values().toList(), style, { it.label }) { style = it }
            }
            primaryButton(if (busy) "Gerando…" else "Gerar relatório", Icon.DOC) { generate(ReportOptions(type, from, to, sections, charts, style)) }
            val list = PdfExporter.list(act)
            if (list.isNotEmpty()) {
                section("Relatórios gerados")
                for (g in list.take(20)) {
                    card(padding = 14) {
                        horizontal {
                            frame { lp(dp(44), dp(44)); background = rounded(Theme.p.coralSoft, dpf(14))
                                val iv = android.widget.ImageView(act); iv.setImageDrawable(IconDrawable(Icon.DOC, Theme.p.coral, dp(22))); addView(iv, android.widget.FrameLayout.LayoutParams(dp(22), dp(22), Gravity.CENTER)) }
                            vertical { lp(0, WRAP, 1f, l = 12)
                                text(PdfExporter.describe(g.options), TextStyle.BODY_BOLD).ellipsize(2)
                                text("${g.file.length() / 1024} KB · ${Fmt.shortDate(LocalDate.ofEpochDay(g.file.lastModified() / 86_400_000L))}", TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 2) }
                            iconButton(Icon.MORE, Theme.p.textSoft) { actions(g.file, g.options) }
                        }
                    }.clickable { open(act, g.file) }
                }
            }
            text("Os arquivos ficam na área privada do app. Use \"Salvar em…\" para guardar uma cópia em Downloads, Drive ou outra pasta.", TextStyle.CAPTION, Theme.p.textSoft).lp(MATCH, WRAP, t = 8)
        }
    }

    private fun shifted(n: Int): Pair<LocalDate, LocalDate> = when (type) {
        ReportType.DAILY -> type.defaultRange(ref.plusDays(n.toLong()))
        ReportType.WEEKLY -> type.defaultRange(ref.plusWeeks(n.toLong()))
        ReportType.MONTHLY -> type.defaultRange(ref.plusMonths(n.toLong()))
        ReportType.YEARLY -> type.defaultRange(ref.plusYears(n.toLong()))
        ReportType.CUSTOM -> range()
    }

    private fun shift(n: Int) { ref = shifted(n).first; render() }

    private fun pickDay() {
        DatePickerDialog(act, { _, y, m, d -> ref = LocalDate.of(y, m + 1, d); render() }, ref.year, ref.monthValue - 1, ref.dayOfMonth)
            .apply { datePicker.maxDate = System.currentTimeMillis() }.show()
    }

    private fun LinearLayout.dateBox(label: String, d: LocalDate, set: (LocalDate) -> Unit): LinearLayout = vertical {
        background = rounded(Theme.p.surfaceAlt, dpf(16)); pad(14, 10)
        text(label, TextStyle.TINY, Theme.p.textSoft)
        text(Fmt.numeric(d), TextStyle.BODY_BOLD).lp(WRAP, WRAP, t = 2)
        ripple(dpf(16), Theme.p.surfaceAlt)
        onClick { DatePickerDialog(act, { _, y, m, dd -> set(LocalDate.of(y, m + 1, dd)); render() }, d.year, d.monthValue - 1, d.dayOfMonth).apply { datePicker.maxDate = System.currentTimeMillis() }.show() }
    }

    private fun generate(o: ReportOptions) {
        if (busy) return
        if (o.sections.isEmpty()) { act.snack("Escolha pelo menos uma seção."); return }
        busy = true; render()
        val sheet = BottomSheet(act)
        sheet.setCancelable(false)
        sheet.content.gravity = Gravity.CENTER_HORIZONTAL
        val fv = FlameView(act, app.broto.core.streak.FlameLevel.SMALL)
        sheet.content.addView(fv, LinearLayout.LayoutParams(act.dp(70), act.dp(70)).apply { gravity = Gravity.CENTER_HORIZONTAL; topMargin = act.dp(16) })
        sheet.content.text("Preparando seu relatório…", TextStyle.HEADLINE) { gravity = Gravity.CENTER }.lp(MATCH, WRAP, t = 10, b = 24)
        sheet.show()
        Thread {
            val result = try { Result.success(PdfExporter.generate(act, repo, o)) } catch (e: Throwable) { Result.failure(e) }
            act.runOnUiThread {
                busy = false
                sheet.dismiss()
                render()
                result.onSuccess { f -> done(f, o) }.onFailure { act.snack("Não foi possível gerar o PDF: ${it.message ?: "erro"}") }
            }
        }.start()
    }

    private fun done(f: File, o: ReportOptions) {
        val s = BottomSheet(act)
        s.title("Relatório pronto! 📄", "${PdfExporter.describe(o)} · ${f.length() / 1024} KB")
        s.content.primaryButton("Abrir", Icon.DOC) { s.dismiss(); open(act, f) }
        s.content.softButton("Compartilhar", Icon.SHARE) { s.dismiss(); share(act, f) }
        s.content.softButton("Salvar em…", Icon.DOWNLOAD, Theme.p.surfaceAlt, Theme.p.text) { s.dismiss(); saveAs(act, f) }
        s.show()
    }

    private fun actions(f: File, o: ReportOptions?) {
        val items = arrayListOf(
            Triple(Icon.DOC, "Abrir") { open(act, f) },
            Triple(Icon.SHARE, "Compartilhar") { share(act, f) },
            Triple(Icon.DOWNLOAD, "Salvar em…") { saveAs(act, f) },
        )
        if (o != null) items.add(Triple(Icon.REFRESH, "Gerar novamente (dados atualizados)") { generate(o) })
        items.add(Triple(Icon.TRASH, "Excluir") { confirm(act, "Excluir relatório?", f.name, "Excluir", true) { PdfExporter.delete(f); render() } })
        options(act, PdfExporter.describe(o), items)
    }

    companion object {
        fun open(act: MainActivity, f: File) {
            val uri = FilesProvider.uriFor("reports", f)
            val i = Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/pdf").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            try { act.startActivity(i) } catch (e: Exception) { act.snack("Nenhum leitor de PDF encontrado. Use Compartilhar ou Salvar em…") }
        }

        fun share(act: MainActivity, f: File, kind: String = "reports", mime: String = "application/pdf") {
            val uri = FilesProvider.uriFor(kind, f)
            val i = Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri).putExtra(Intent.EXTRA_SUBJECT, f.name)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            act.startActivity(Intent.createChooser(i, "Compartilhar").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
        }

        fun saveAs(act: MainActivity, f: File, mime: String = "application/pdf") {
            val i = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE, f.name)
            act.launchForResult(i) { code, data ->
                val uri = data?.data
                if (code == Activity.RESULT_OK && uri != null) {
                    try {
                        act.contentResolver.openOutputStream(uri, "w")!!.use { out -> f.inputStream().use { it.copyTo(out) } }
                        act.snack("Arquivo salvo. ✅")
                    } catch (e: Exception) { act.snack("Não foi possível salvar: ${e.message}") }
                }
            }
        }
    }
}
