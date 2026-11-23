package app.broto

import android.app.Dialog
import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import org.robolectric.shadows.ShadowDialog
import org.robolectric.shadows.ShadowLooper
import java.io.File
import java.io.FileOutputStream
import java.time.Duration

/** Utilitário de captura de tela para os testes Robolectric (gráficos nativos). */
object Shots {
    val dir: File = File(System.getProperty("broto.screenshots") ?: "build/screenshots").also { it.mkdirs() }

    fun idle(ms: Long = 1500) { ShadowLooper.idleMainLooper(ms, java.util.concurrent.TimeUnit.MILLISECONDS) }

    fun view(v: View, name: String, fullHeight: Boolean = false) {
        idle()
        var w = v.width; var h = v.height
        if (fullHeight) {
            v.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED))
            h = v.measuredHeight; v.layout(0, 0, w, h)
        }
        if (w <= 0 || h <= 0) return
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        v.draw(Canvas(bmp))
        FileOutputStream(File(dir, "$name.png")).use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    /** Captura a activity e, se houver, o diálogo aberto por cima. */
    fun activity(a: android.app.Activity, name: String) {
        idle()
        val root = a.window.decorView
        val bmp = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        root.draw(c)
        val d: Dialog? = ShadowDialog.getLatestDialog()
        if (d != null && d.isShowing) {
            c.drawColor(0x59000000)
            val dv = d.window!!.decorView
            idle()
            c.save(); c.translate(0f, (root.height - dv.height).toFloat()); dv.draw(c); c.restore()
        }
        FileOutputStream(File(dir, "$name.png")).use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
