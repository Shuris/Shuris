package app.broto
import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File
import java.io.FileOutputStream

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xxhdpi")
class SmokeTest {
    @Test fun launches() {
        val a = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        val v: View = a.window.decorView
        val bmp = Bitmap.createBitmap(v.width.coerceAtLeast(1), v.height.coerceAtLeast(1), Bitmap.Config.ARGB_8888)
        v.draw(Canvas(bmp))
        val dir = File(System.getProperty("broto.screenshots")); dir.mkdirs()
        FileOutputStream(File(dir, "smoke.png")).use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
        println("SIZE ${v.width}x${v.height}")
    }
}
