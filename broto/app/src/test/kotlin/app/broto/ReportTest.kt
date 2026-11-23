package app.broto

import android.graphics.Bitmap
import android.graphics.Canvas
import app.broto.data.DemoData
import app.broto.pdf.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File
import java.io.FileOutputStream
import java.time.LocalDate
import kotlin.test.assertTrue

/** Renderiza o relatório em bitmaps (o PdfDocument nativo não existe na JVM; o desenho é o mesmo). */
class BitmapSink(private val prefix: String, private val scale: Float = 1.6f) : PageSink {
    private var bmp: Bitmap? = null
    private var n = 0
    val files = ArrayList<File>()
    override fun begin(number: Int, width: Int, height: Int): Canvas {
        n = number
        val b = Bitmap.createBitmap((width * scale).toInt(), (height * scale).toInt(), Bitmap.Config.ARGB_8888)
        bmp = b
        return Canvas(b).also { it.scale(scale, scale) }
    }
    override fun end() {
        val f = File(Shots.dir, "${prefix}_p${String.format("%02d", n)}.png")
        FileOutputStream(f).use { bmp!!.compress(Bitmap.CompressFormat.PNG, 100, it) }
        files.add(f)
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ReportTest {
    @Test fun rendersAllReportTypes() {
        val repo = TestRepo.fresh()
        repo.settings.userName = "Ana"
        DemoData.generate(repo)
        val ctx = RuntimeEnvironment.getApplication()
        val today = LocalDate.now()
        fun run(name: String, o: ReportOptions): Int {
            val sink = BitmapSink(name)
            val pages = ReportRenderer(ctx, ReportData.collect(repo, o, today), sink).render()
            assertTrue(pages >= 2, "$name pages=$pages")
            return pages
        }
        val (mf, mt) = ReportType.MONTHLY.defaultRange(today.minusMonths(1))
        val monthly = run("pdf_monthly", ReportOptions(ReportType.MONTHLY, mf, mt, ReportSection.values().toSet()))
        val (yf, yt) = ReportType.YEARLY.defaultRange(today)
        run("pdf_yearly", ReportOptions(ReportType.YEARLY, yf, yt))
        run("pdf_daily", ReportOptions(ReportType.DAILY, today.minusDays(1), today.minusDays(1), ReportSection.values().toSet()))
        val (wf, wt) = ReportType.WEEKLY.defaultRange(today.minusDays(7))
        run("pdf_weekly_print", ReportOptions(ReportType.WEEKLY, wf, wt, style = ReportStyle.PRINT))
        println("monthly pages: $monthly")
    }

    @Test fun emptyDataStillRenders() {
        TestRepo.fresh()
        val repo = app.broto.data.Repo.get(RuntimeEnvironment.getApplication())
        val t = LocalDate.now()
        val pages = ReportRenderer(RuntimeEnvironment.getApplication(), ReportData.collect(repo, ReportOptions(ReportType.CUSTOM, t.minusDays(6), t)), BitmapSink("pdf_empty")).render()
        assertTrue(pages >= 2)
    }

    @Test fun optionsRoundTrip() {
        val o = ReportOptions(ReportType.CUSTOM, LocalDate.of(2026, 1, 2), LocalDate.of(2026, 3, 4), setOf(ReportSection.MOOD, ReportSection.JOURNAL), false, ReportStyle.PRINT)
        kotlin.test.assertEquals(o, ReportOptions.fromJson(o.toJson()))
        kotlin.test.assertEquals("broto-relatorio-mensal-2026-01.pdf", PdfExporter.fileName(ReportOptions(ReportType.MONTHLY, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31))))
    }
}
