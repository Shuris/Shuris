package app.broto.ui

import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.drawable.Drawable
import android.widget.ImageView
import android.view.ViewGroup
import android.widget.LinearLayout

/** Ícones de traço arredondado desenhados num espaço 24×24. */
enum class Icon { HOME, HABITS, MOOD, JOURNAL, CHART, PLUS, MINUS, SETTINGS, TARGET, CALENDAR, BACK, LEFT, RIGHT, EDIT, TRASH, PAUSE, PLAY, BELL,
    LOCK, SEARCH, CLOSE, SHARE, DOWNLOAD, CHECK, MORE, ARCHIVE, UP, DOWN, DOC, INFO, SUN, MOON, LEAF, SPARKLE, FILTER, CLOCK, REFRESH, SHIELD, FOLDER, FLAME, BOOK_OPEN, DATABASE, PALETTE, FINGERPRINT }

class IconDrawable(private val icon: Icon, var color: Int, private val sizePx: Int, private val strokeDp: Float = 2f) : Drawable() {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }

    override fun getIntrinsicWidth() = sizePx
    override fun getIntrinsicHeight() = sizePx

    override fun draw(canvas: Canvas) {
        val b = bounds
        val s = minOf(b.width(), b.height()) / 24f
        canvas.save()
        canvas.translate(b.left + (b.width() - 24 * s) / 2, b.top + (b.height() - 24 * s) / 2)
        canvas.scale(s, s)
        paint.color = color; paint.strokeWidth = strokeDp * 24f / 24f
        fill.color = color
        drawIcon(canvas, icon, paint, fill)
        canvas.restore()
    }

    override fun setAlpha(alpha: Int) { paint.alpha = alpha; fill.alpha = alpha }
    override fun setColorFilter(colorFilter: ColorFilter?) { paint.colorFilter = colorFilter }
    @Deprecated("Deprecated in Java") override fun getOpacity() = PixelFormat.TRANSLUCENT

    companion object {
        fun drawIcon(c: Canvas, icon: Icon, p: Paint, f: Paint) {
            val path = Path()
            when (icon) {
                Icon.HOME -> { path.moveTo(4f, 10.5f); path.lineTo(12f, 4f); path.lineTo(20f, 10.5f); path.moveTo(6f, 9f); path.lineTo(6f, 19f); path.quadTo(6f, 20f, 7f, 20f); path.lineTo(17f, 20f); path.quadTo(18f, 20f, 18f, 19f); path.lineTo(18f, 9f); path.moveTo(10f, 20f); path.lineTo(10f, 15f); path.lineTo(14f, 15f); path.lineTo(14f, 20f); c.drawPath(path, p) }
                Icon.HABITS -> { c.drawRoundRect(RectF(4f, 4f, 20f, 20f), 6f, 6f, p); path.moveTo(8.5f, 12.2f); path.lineTo(11f, 14.7f); path.lineTo(15.8f, 9.5f); c.drawPath(path, p) }
                Icon.MOOD -> { c.drawCircle(12f, 12f, 8.5f, p); c.drawCircle(9f, 10.5f, 0.6f, p); c.drawCircle(15f, 10.5f, 0.6f, p); path.moveTo(8.5f, 14f); path.quadTo(12f, 17.5f, 15.5f, 14f); c.drawPath(path, p) }
                Icon.JOURNAL -> { c.drawRoundRect(RectF(5f, 3.5f, 19f, 20.5f), 3f, 3f, p); path.moveTo(9f, 3.5f); path.lineTo(9f, 20.5f); path.moveTo(12f, 8f); path.lineTo(16f, 8f); path.moveTo(12f, 11.5f); path.lineTo(16f, 11.5f); c.drawPath(path, p) }
                Icon.CHART -> { path.moveTo(5f, 19.5f); path.lineTo(19f, 19.5f); path.moveTo(7.5f, 16f); path.lineTo(7.5f, 12f); path.moveTo(12f, 16f); path.lineTo(12f, 6f); path.moveTo(16.5f, 16f); path.lineTo(16.5f, 9.5f); c.drawPath(path, p) }
                Icon.PLUS -> { path.moveTo(12f, 5f); path.lineTo(12f, 19f); path.moveTo(5f, 12f); path.lineTo(19f, 12f); c.drawPath(path, p) }
                Icon.MINUS -> { path.moveTo(5f, 12f); path.lineTo(19f, 12f); c.drawPath(path, p) }
                Icon.SETTINGS -> {
                    c.drawCircle(12f, 12f, 3f, p)
                    for (i in 0 until 8) {
                        val a = Math.toRadians(i * 45.0)
                        val x1 = 12 + 6.2 * Math.cos(a); val y1 = 12 + 6.2 * Math.sin(a)
                        val x2 = 12 + 8.3 * Math.cos(a); val y2 = 12 + 8.3 * Math.sin(a)
                        c.drawLine(x1.toFloat(), y1.toFloat(), x2.toFloat(), y2.toFloat(), p)
                    }
                    c.drawCircle(12f, 12f, 6.2f, p)
                }
                Icon.TARGET -> { c.drawCircle(12f, 12f, 8.5f, p); c.drawCircle(12f, 12f, 4.8f, p); c.drawCircle(12f, 12f, 1.3f, f) }
                Icon.CALENDAR -> { c.drawRoundRect(RectF(4f, 5.5f, 20f, 20f), 3.5f, 3.5f, p); path.moveTo(4f, 10f); path.lineTo(20f, 10f); path.moveTo(8.5f, 3.5f); path.lineTo(8.5f, 7f); path.moveTo(15.5f, 3.5f); path.lineTo(15.5f, 7f); c.drawPath(path, p) }
                Icon.BACK -> { path.moveTo(19f, 12f); path.lineTo(5f, 12f); path.moveTo(11f, 6f); path.lineTo(5f, 12f); path.lineTo(11f, 18f); c.drawPath(path, p) }
                Icon.LEFT -> { path.moveTo(14.5f, 6f); path.lineTo(8.5f, 12f); path.lineTo(14.5f, 18f); c.drawPath(path, p) }
                Icon.RIGHT -> { path.moveTo(9.5f, 6f); path.lineTo(15.5f, 12f); path.lineTo(9.5f, 18f); c.drawPath(path, p) }
                Icon.UP -> { path.moveTo(6f, 14.5f); path.lineTo(12f, 8.5f); path.lineTo(18f, 14.5f); c.drawPath(path, p) }
                Icon.DOWN -> { path.moveTo(6f, 9.5f); path.lineTo(12f, 15.5f); path.lineTo(18f, 9.5f); c.drawPath(path, p) }
                Icon.EDIT -> { path.moveTo(5f, 19f); path.lineTo(5.6f, 15.4f); path.lineTo(15.5f, 5.5f); path.quadTo(16.5f, 4.5f, 17.5f, 5.5f); path.lineTo(18.5f, 6.5f); path.quadTo(19.5f, 7.5f, 18.5f, 8.5f); path.lineTo(8.6f, 18.4f); path.close(); path.moveTo(13.5f, 7.5f); path.lineTo(16.5f, 10.5f); c.drawPath(path, p) }
                Icon.TRASH -> { path.moveTo(4.5f, 7f); path.lineTo(19.5f, 7f); path.moveTo(9.5f, 7f); path.lineTo(10f, 4.5f); path.lineTo(14f, 4.5f); path.lineTo(14.5f, 7f); path.moveTo(6.5f, 7f); path.lineTo(7.5f, 19f); path.quadTo(7.6f, 20f, 8.6f, 20f); path.lineTo(15.4f, 20f); path.quadTo(16.4f, 20f, 16.5f, 19f); path.lineTo(17.5f, 7f); path.moveTo(10.2f, 11f); path.lineTo(10.4f, 16f); path.moveTo(13.8f, 11f); path.lineTo(13.6f, 16f); c.drawPath(path, p) }
                Icon.PAUSE -> { path.moveTo(9f, 6f); path.lineTo(9f, 18f); path.moveTo(15f, 6f); path.lineTo(15f, 18f); c.drawPath(path, p) }
                Icon.PLAY -> { path.moveTo(8f, 5.5f); path.lineTo(18.5f, 12f); path.lineTo(8f, 18.5f); path.close(); c.drawPath(path, p) }
                Icon.BELL -> { path.moveTo(6f, 16.5f); path.lineTo(6f, 11f); path.cubicTo(6f, 7.5f, 8.5f, 5f, 12f, 5f); path.cubicTo(15.5f, 5f, 18f, 7.5f, 18f, 11f); path.lineTo(18f, 16.5f); path.lineTo(19.5f, 17.5f); path.lineTo(4.5f, 17.5f); path.close(); path.moveTo(10f, 20f); path.quadTo(12f, 21.5f, 14f, 20f); c.drawPath(path, p) }
                Icon.LOCK -> { c.drawRoundRect(RectF(5.5f, 10.5f, 18.5f, 20f), 3f, 3f, p); path.moveTo(8.5f, 10.5f); path.lineTo(8.5f, 8f); path.cubicTo(8.5f, 3.5f, 15.5f, 3.5f, 15.5f, 8f); path.lineTo(15.5f, 10.5f); c.drawPath(path, p); c.drawCircle(12f, 15.2f, 1f, f) }
                Icon.SEARCH -> { c.drawCircle(10.5f, 10.5f, 6f, p); c.drawLine(15f, 15f, 19.5f, 19.5f, p) }
                Icon.CLOSE -> { c.drawLine(6.5f, 6.5f, 17.5f, 17.5f, p); c.drawLine(17.5f, 6.5f, 6.5f, 17.5f, p) }
                Icon.SHARE -> { c.drawCircle(17f, 6f, 2.4f, p); c.drawCircle(7f, 12f, 2.4f, p); c.drawCircle(17f, 18f, 2.4f, p); c.drawLine(9.1f, 10.8f, 14.9f, 7.2f, p); c.drawLine(9.1f, 13.2f, 14.9f, 16.8f, p) }
                Icon.DOWNLOAD -> { path.moveTo(12f, 4.5f); path.lineTo(12f, 15f); path.moveTo(7.5f, 10.5f); path.lineTo(12f, 15f); path.lineTo(16.5f, 10.5f); path.moveTo(5f, 19.5f); path.lineTo(19f, 19.5f); c.drawPath(path, p) }
                Icon.CHECK -> { path.moveTo(5.5f, 12.5f); path.lineTo(10f, 17f); path.lineTo(18.5f, 7.5f); c.drawPath(path, p) }
                Icon.MORE -> { c.drawCircle(6f, 12f, 1.5f, f); c.drawCircle(12f, 12f, 1.5f, f); c.drawCircle(18f, 12f, 1.5f, f) }
                Icon.ARCHIVE -> { c.drawRoundRect(RectF(4f, 5f, 20f, 9f), 1.5f, 1.5f, p); path.moveTo(5.5f, 9f); path.lineTo(5.5f, 18f); path.quadTo(5.5f, 19.5f, 7f, 19.5f); path.lineTo(17f, 19.5f); path.quadTo(18.5f, 19.5f, 18.5f, 18f); path.lineTo(18.5f, 9f); path.moveTo(10f, 13f); path.lineTo(14f, 13f); c.drawPath(path, p) }
                Icon.DOC -> { path.moveTo(14f, 3.5f); path.lineTo(7f, 3.5f); path.quadTo(5.5f, 3.5f, 5.5f, 5f); path.lineTo(5.5f, 19f); path.quadTo(5.5f, 20.5f, 7f, 20.5f); path.lineTo(17f, 20.5f); path.quadTo(18.5f, 20.5f, 18.5f, 19f); path.lineTo(18.5f, 8f); path.close(); path.moveTo(14f, 3.5f); path.lineTo(14f, 8f); path.lineTo(18.5f, 8f); path.moveTo(9f, 13f); path.lineTo(15f, 13f); path.moveTo(9f, 16.5f); path.lineTo(13f, 16.5f); c.drawPath(path, p) }
                Icon.INFO -> { c.drawCircle(12f, 12f, 8.5f, p); c.drawLine(12f, 11f, 12f, 16.5f, p); c.drawCircle(12f, 7.8f, 1.1f, f) }
                Icon.SUN -> { c.drawCircle(12f, 12f, 4f, p); for (i in 0 until 8) { val a = Math.toRadians(i * 45.0); c.drawLine((12 + 6.5 * Math.cos(a)).toFloat(), (12 + 6.5 * Math.sin(a)).toFloat(), (12 + 8.5 * Math.cos(a)).toFloat(), (12 + 8.5 * Math.sin(a)).toFloat(), p) } }
                Icon.MOON -> { path.moveTo(18.5f, 14.5f); path.cubicTo(13f, 16.5f, 7.5f, 11f, 9.5f, 5.5f); path.cubicTo(5.5f, 6.8f, 3.8f, 11.8f, 6.3f, 15.8f); path.cubicTo(9f, 20f, 15.5f, 20f, 18.5f, 14.5f); c.drawPath(path, p) }
                Icon.LEAF -> { path.moveTo(5f, 19f); path.cubicTo(5f, 9f, 11f, 5f, 19.5f, 4.5f); path.cubicTo(19f, 13f, 15f, 19f, 5f, 19f); path.moveTo(5f, 19f); path.lineTo(13f, 11f); c.drawPath(path, p) }
                Icon.SPARKLE -> { path.moveTo(12f, 3.5f); path.quadTo(13f, 11f, 20.5f, 12f); path.quadTo(13f, 13f, 12f, 20.5f); path.quadTo(11f, 13f, 3.5f, 12f); path.quadTo(11f, 11f, 12f, 3.5f); path.close(); c.drawPath(path, p) }
                Icon.FILTER -> { path.moveTo(4.5f, 6f); path.lineTo(19.5f, 6f); path.moveTo(7.5f, 12f); path.lineTo(16.5f, 12f); path.moveTo(10.5f, 18f); path.lineTo(13.5f, 18f); c.drawPath(path, p) }
                Icon.CLOCK -> { c.drawCircle(12f, 12f, 8.5f, p); path.moveTo(12f, 7.5f); path.lineTo(12f, 12f); path.lineTo(15f, 14f); c.drawPath(path, p) }
                Icon.REFRESH -> { c.drawArc(RectF(5f, 5f, 19f, 19f), -60f, 290f, false, p); path.moveTo(19.5f, 4.5f); path.lineTo(18.6f, 8.6f); path.lineTo(14.6f, 7.8f); c.drawPath(path, p) }
                Icon.SHIELD -> { path.moveTo(12f, 3.5f); path.lineTo(19f, 6.5f); path.lineTo(19f, 11.5f); path.cubicTo(19f, 16f, 16f, 19f, 12f, 20.5f); path.cubicTo(8f, 19f, 5f, 16f, 5f, 11.5f); path.lineTo(5f, 6.5f); path.close(); path.moveTo(9f, 12f); path.lineTo(11.2f, 14.2f); path.lineTo(15.2f, 10f); c.drawPath(path, p) }
                Icon.FOLDER -> { path.moveTo(4f, 7f); path.quadTo(4f, 5.5f, 5.5f, 5.5f); path.lineTo(9.5f, 5.5f); path.lineTo(11.5f, 7.5f); path.lineTo(18.5f, 7.5f); path.quadTo(20f, 7.5f, 20f, 9f); path.lineTo(20f, 17.5f); path.quadTo(20f, 19f, 18.5f, 19f); path.lineTo(5.5f, 19f); path.quadTo(4f, 19f, 4f, 17.5f); path.close(); c.drawPath(path, p) }
                Icon.FLAME -> { path.moveTo(12f, 3f); path.cubicTo(13f, 7f, 18.5f, 9f, 18.5f, 14.5f); path.cubicTo(18.5f, 18f, 15.5f, 21f, 12f, 21f); path.cubicTo(8.5f, 21f, 5.5f, 18f, 5.5f, 14.5f); path.cubicTo(5.5f, 11.5f, 7.5f, 10f, 8.5f, 8f); path.cubicTo(9f, 10f, 10f, 11f, 11f, 11f); path.cubicTo(10.5f, 8f, 11f, 5f, 12f, 3f); path.close(); c.drawPath(path, p) }
                Icon.BOOK_OPEN -> { path.moveTo(12f, 6.5f); path.cubicTo(9.5f, 5f, 6.5f, 4.8f, 3.5f, 5.5f); path.lineTo(3.5f, 18.5f); path.cubicTo(6.5f, 17.8f, 9.5f, 18f, 12f, 19.5f); path.cubicTo(14.5f, 18f, 17.5f, 17.8f, 20.5f, 18.5f); path.lineTo(20.5f, 5.5f); path.cubicTo(17.5f, 4.8f, 14.5f, 5f, 12f, 6.5f); path.lineTo(12f, 19.5f); c.drawPath(path, p) }
                Icon.DATABASE -> { c.drawOval(RectF(5f, 3.5f, 19f, 8.5f), p); path.moveTo(5f, 6f); path.lineTo(5f, 18f); path.cubicTo(5f, 21.3f, 19f, 21.3f, 19f, 18f); path.lineTo(19f, 6f); path.moveTo(5f, 12f); path.cubicTo(5f, 15.3f, 19f, 15.3f, 19f, 12f); c.drawPath(path, p) }
                Icon.PALETTE -> { path.moveTo(12f, 3.5f); path.cubicTo(6.5f, 3.5f, 3.5f, 7.5f, 3.5f, 12f); path.cubicTo(3.5f, 16.5f, 7f, 20.5f, 11.5f, 20.5f); path.cubicTo(13f, 20.5f, 13.5f, 19.5f, 13f, 18.3f); path.cubicTo(12.3f, 16.8f, 13.3f, 15.5f, 15f, 15.5f); path.lineTo(17f, 15.5f); path.cubicTo(19f, 15.5f, 20.5f, 14f, 20.5f, 11.5f); path.cubicTo(20.5f, 7f, 16.8f, 3.5f, 12f, 3.5f); path.close(); c.drawPath(path, p); c.drawCircle(8f, 11f, 1.2f, f); c.drawCircle(11f, 7.5f, 1.2f, f); c.drawCircle(15.5f, 8.5f, 1.2f, f) }
                Icon.FINGERPRINT -> { c.drawArc(RectF(5f, 4f, 19f, 18f), 200f, 140f, false, p); c.drawArc(RectF(8f, 7f, 16f, 15f), 180f, 180f, false, p); path.moveTo(8f, 11f); path.cubicTo(8f, 15f, 9f, 18f, 10.5f, 20f); path.moveTo(16f, 11f); path.cubicTo(16f, 14f, 15.5f, 17f, 14.5f, 19.5f); path.moveTo(12f, 11f); path.cubicTo(12f, 14.5f, 12.5f, 17.5f, 13f, 20f); path.moveTo(5.2f, 13f); path.cubicTo(5.5f, 15.5f, 6.2f, 17f, 7f, 18.5f); c.drawPath(path, p) }
            }
        }
    }
}

fun ViewGroup.icon(icon: Icon, color: Int = Theme.p.text, sizeDp: Int = 24, strokeDp: Float = 2f): ImageView {
    val iv = ImageView(context)
    iv.setImageDrawable(IconDrawable(icon, color, context.dp(sizeDp), strokeDp))
    iv.layoutParams = LinearLayout.LayoutParams(context.dp(sizeDp), context.dp(sizeDp))
    addView(iv)
    return iv
}
