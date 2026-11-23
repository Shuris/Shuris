package app.broto.pdf

import android.content.Context
import android.graphics.Canvas
import android.graphics.pdf.PdfDocument
import app.broto.data.FilesProvider
import app.broto.data.Repo
import app.broto.ui.Fmt
import java.io.File
import java.time.LocalDate

/** Gera o PDF no próprio aparelho (offline) com android.graphics.pdf.PdfDocument. */
object PdfExporter {
    class PdfSink(private val doc: PdfDocument) : PageSink {
        private var page: PdfDocument.Page? = null
        override fun begin(number: Int, width: Int, height: Int): Canvas {
            val p = doc.startPage(PdfDocument.PageInfo.Builder(width, height, number).create())
            page = p
            return p.canvas
        }
        override fun end() { page?.let { doc.finishPage(it) }; page = null }
    }

    fun fileName(o: ReportOptions): String {
        val base = when (o.type) {
            ReportType.DAILY -> "diario-${o.from}"
            ReportType.WEEKLY -> "semanal-${o.from}"
            ReportType.MONTHLY -> "mensal-${o.from.year}-${String.format("%02d", o.from.monthValue)}"
            ReportType.YEARLY -> "anual-${o.from.year}"
            ReportType.CUSTOM -> "periodo-${o.from}-a-${o.to}"
        }
        return "broto-relatorio-$base.pdf"
    }

    /** Gera e salva; retorna o arquivo. Lança exceção em caso de falha (o arquivo anterior é preservado). */
    fun generate(ctx: Context, repo: Repo, o: ReportOptions, today: LocalDate = LocalDate.now()): File {
        val data = ReportData.collect(repo, o, today)
        val dir = FilesProvider.reportsDir(ctx)
        val out = File(dir, fileName(o))
        val tmp = File(dir, out.name + ".tmp")
        val doc = PdfDocument()
        try {
            ReportRenderer(ctx, data, PdfSink(doc)).render()
            tmp.outputStream().use { doc.writeTo(it) }
        } finally { doc.close() }
        if (tmp.length() < 100) { tmp.delete(); throw IllegalStateException("PDF vazio") }
        if (out.exists()) out.delete()
        if (!tmp.renameTo(out)) { tmp.copyTo(out, true); tmp.delete() }
        File(dir, out.name + ".json").writeText(o.toJson())
        return out
    }

    data class Generated(val file: File, val options: ReportOptions?)

    fun list(ctx: Context): List<Generated> = FilesProvider.reportsDir(ctx).listFiles { f -> f.name.endsWith(".pdf") }.orEmpty()
        .sortedByDescending { it.lastModified() }
        .map { f -> Generated(f, File(f.parentFile, f.name + ".json").takeIf { it.exists() }?.readText()?.let { ReportOptions.fromJson(it) }) }

    fun delete(f: File) { f.delete(); File(f.parentFile, f.name + ".json").delete() }

    fun describe(o: ReportOptions?): String = if (o == null) "Relatório" else "${o.type.title} · ${Fmt.range(o.from, o.to)}"
}
