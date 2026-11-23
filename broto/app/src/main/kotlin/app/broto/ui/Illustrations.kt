package app.broto.ui

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.*
import android.graphics.drawable.Drawable
import android.view.View
import android.view.animation.LinearInterpolator
import app.broto.core.streak.FlameLevel

/**
 * Carinha de humor do Broto: um corpinho redondo com um brotinho na cabeça.
 * O broto "cresce" conforme o humor: folha murcha (1) até folhas e flor (5).
 */
object MoodArt {
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    private val s = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }
    private const val INK = 0xFF3A3A33.toInt()

    fun draw(c: Canvas, level: Int, x: Float, y: Float, size: Float, sprout: Boolean = true) {
        val S = size
        c.save(); c.translate(x, y)
        val body = Theme.moodColor(level)
        // ---- broto
        if (sprout) {
            val stemTop = if (level <= 1) 0.20f else 0.13f
            s.color = 0xFF5FA86A.toInt(); s.strokeWidth = S * 0.04f
            val leaf = if (level <= 1) 0xFF9AAA9F.toInt() else if (level == 2) 0xFF7DBB7B.toInt() else 0xFF5FB36E.toInt()
            s.color = leaf
            val stem = Path(); stem.moveTo(S * 0.5f, S * 0.33f); stem.quadTo(S * 0.5f, S * 0.24f, S * (if (level <= 1) 0.47f else 0.5f), S * stemTop)
            c.drawPath(stem, s)
            p.style = Paint.Style.FILL; p.color = leaf
            when (level) {
                1 -> leafPath(c, S * 0.47f, S * 0.20f, S * 0.30f, S * 0.30f, S * 0.12f)    // murcha, caída
                2 -> leafPath(c, S * 0.5f, S * 0.15f, S * 0.70f, S * 0.08f, S * 0.11f)
                3 -> { leafPath(c, S * 0.5f, S * 0.15f, S * 0.70f, S * 0.07f, S * 0.11f); leafPath(c, S * 0.5f, S * 0.17f, S * 0.33f, S * 0.11f, S * 0.08f) }
                4 -> { leafPath(c, S * 0.5f, S * 0.14f, S * 0.76f, S * 0.04f, S * 0.14f); leafPath(c, S * 0.5f, S * 0.14f, S * 0.24f, S * 0.04f, S * 0.14f) }
                else -> {
                    leafPath(c, S * 0.5f, S * 0.16f, S * 0.78f, S * 0.08f, S * 0.14f); leafPath(c, S * 0.5f, S * 0.16f, S * 0.22f, S * 0.08f, S * 0.14f)
                    // florzinha
                    p.color = 0xFFFF9FB8.toInt()
                    for (i in 0 until 5) {
                        val a = Math.toRadians(i * 72.0 - 90)
                        c.drawCircle(S * 0.5f + (S * 0.055f * Math.cos(a)).toFloat(), S * 0.085f + (S * 0.055f * Math.sin(a)).toFloat(), S * 0.042f, p)
                    }
                    p.color = 0xFFFFE27A.toInt(); c.drawCircle(S * 0.5f, S * 0.085f, S * 0.035f, p)
                }
            }
        }
        // ---- corpo
        val r = RectF(S * 0.12f, S * 0.28f, S * 0.88f, S * 0.97f)
        p.style = Paint.Style.FILL
        p.color = body
        val bodyPath = Path()
        bodyPath.moveTo(S * 0.5f, r.top)
        bodyPath.cubicTo(S * 0.80f, r.top, r.right, S * 0.48f, r.right, S * 0.64f)
        bodyPath.cubicTo(r.right, S * 0.86f, S * 0.74f, r.bottom, S * 0.5f, r.bottom)
        bodyPath.cubicTo(S * 0.26f, r.bottom, r.left, S * 0.86f, r.left, S * 0.64f)
        bodyPath.cubicTo(r.left, S * 0.48f, S * 0.20f, r.top, S * 0.5f, r.top)
        bodyPath.close()
        c.drawPath(bodyPath, p)
        // sombra suave e brilho
        c.save(); c.clipPath(bodyPath)
        p.color = 0x14000000; c.drawOval(RectF(S * 0.05f, S * 0.70f, S * 0.95f, S * 1.2f), p)
        p.color = 0x55FFFFFF; c.drawOval(RectF(S * 0.24f, S * 0.34f, S * 0.48f, S * 0.46f), p)
        c.restore()

        // ---- rosto
        s.color = INK; s.strokeWidth = S * 0.045f
        p.color = INK
        val ex1 = S * 0.385f; val ex2 = S * 0.615f; val ey = S * 0.60f
        val blush = 0x66FF8A8A
        when (level) {
            1 -> {
                arcEye(c, ex1, ey, S * 0.06f, false); arcEye(c, ex2, ey, S * 0.06f, false)
                val m = Path(); m.moveTo(S * 0.41f, S * 0.79f); m.quadTo(S * 0.5f, S * 0.71f, S * 0.59f, S * 0.79f); c.drawPath(m, s)
                p.color = 0xFF8CC8F0.toInt()
                val t = Path(); t.moveTo(S * 0.34f, S * 0.66f); t.quadTo(S * 0.305f, S * 0.73f, S * 0.33f, S * 0.75f); t.quadTo(S * 0.36f, S * 0.75f, S * 0.355f, S * 0.71f); t.close()
                c.drawPath(t, p)
            }
            2 -> {
                c.drawCircle(ex1, ey + S * 0.01f, S * 0.035f, p); c.drawCircle(ex2, ey + S * 0.01f, S * 0.035f, p)
                s.strokeWidth = S * 0.035f
                c.drawLine(ex1 - S * 0.06f, ey - S * 0.07f, ex1 + S * 0.04f, ey - S * 0.10f, s); c.drawLine(ex2 + S * 0.06f, ey - S * 0.07f, ex2 - S * 0.04f, ey - S * 0.10f, s)
                s.strokeWidth = S * 0.045f
                val m = Path(); m.moveTo(S * 0.42f, S * 0.78f); m.quadTo(S * 0.5f, S * 0.74f, S * 0.58f, S * 0.78f); c.drawPath(m, s)
            }
            3 -> {
                c.drawCircle(ex1, ey, S * 0.037f, p); c.drawCircle(ex2, ey, S * 0.037f, p)
                c.drawLine(S * 0.43f, S * 0.765f, S * 0.57f, S * 0.765f, s)
            }
            4 -> {
                c.drawCircle(ex1, ey, S * 0.037f, p); c.drawCircle(ex2, ey, S * 0.037f, p)
                p.color = blush; c.drawOval(RectF(S * 0.22f, S * 0.66f, S * 0.32f, S * 0.72f), p); c.drawOval(RectF(S * 0.68f, S * 0.66f, S * 0.78f, S * 0.72f), p)
                val m = Path(); m.moveTo(S * 0.41f, S * 0.73f); m.quadTo(S * 0.5f, S * 0.83f, S * 0.59f, S * 0.73f); c.drawPath(m, s)
            }
            else -> {
                arcEye(c, ex1, ey, S * 0.06f, true); arcEye(c, ex2, ey, S * 0.06f, true)
                p.color = blush; c.drawOval(RectF(S * 0.21f, S * 0.65f, S * 0.32f, S * 0.72f), p); c.drawOval(RectF(S * 0.68f, S * 0.65f, S * 0.79f, S * 0.72f), p)
                p.color = INK
                val m = Path(); m.moveTo(S * 0.39f, S * 0.71f); m.lineTo(S * 0.61f, S * 0.71f); m.quadTo(S * 0.60f, S * 0.86f, S * 0.5f, S * 0.86f); m.quadTo(S * 0.40f, S * 0.86f, S * 0.39f, S * 0.71f); m.close()
                c.drawPath(m, p)
                p.color = 0xFFFF8E8E.toInt(); c.drawOval(RectF(S * 0.45f, S * 0.79f, S * 0.55f, S * 0.86f), p)
            }
        }
        c.restore()
    }

    private fun arcEye(c: Canvas, x: Float, y: Float, w: Float, happy: Boolean) {
        val path = Path()
        if (happy) { path.moveTo(x - w, y + w * 0.4f); path.quadTo(x, y - w * 0.9f, x + w, y + w * 0.4f) }
        else { path.moveTo(x - w, y - w * 0.2f); path.quadTo(x, y + w * 0.9f, x + w, y - w * 0.2f) }
        c.drawPath(path, s)
    }

    /** Folha em forma de gota entre a base (bx,by) e a ponta (tx,ty). */
    private fun leafPath(c: Canvas, bx: Float, by: Float, tx: Float, ty: Float, w: Float) {
        val dx = tx - bx; val dy = ty - by
        val len = Math.hypot(dx.toDouble(), dy.toDouble()).toFloat()
        val nx = -dy / len * w; val ny = dx / len * w
        val mx = bx + dx * 0.5f; val my = by + dy * 0.5f
        val path = Path()
        path.moveTo(bx, by)
        path.quadTo(mx + nx, my + ny, tx, ty)
        path.quadTo(mx - nx, my - ny, bx, by)
        path.close()
        c.drawPath(path, p)
    }

    /** Dia sem registro: círculo tracejado neutro. */
    fun drawEmpty(c: Canvas, x: Float, y: Float, size: Float, color: Int) {
        s.color = color; s.strokeWidth = size * 0.035f
        s.pathEffect = DashPathEffect(floatArrayOf(size * 0.06f, size * 0.06f), 0f)
        c.drawCircle(x + size / 2, y + size * 0.6f, size * 0.36f, s)
        s.pathEffect = null
    }
}

class MoodFaceDrawable(var mood: Int, private val sizePx: Int, var sprout: Boolean = true) : Drawable() {
    override fun draw(canvas: Canvas) {
        val b = bounds; val sz = minOf(b.width(), b.height()).toFloat()
        MoodArt.draw(canvas, mood, b.left + (b.width() - sz) / 2, b.top + (b.height() - sz) / 2, sz, sprout)
    }
    override fun getIntrinsicWidth() = sizePx
    override fun getIntrinsicHeight() = sizePx
    override fun setAlpha(alpha: Int) {}
    override fun setColorFilter(colorFilter: ColorFilter?) {}
    @Deprecated("Deprecated in Java") override fun getOpacity() = PixelFormat.TRANSLUCENT
}

/** Chama da consistência: cresce e muda de cor conforme o nível. */
object FlameArt {
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)

    fun flamePath(cx: Float, base: Float, w: Float, h: Float, sway: Float = 0f): Path {
        val path = Path()
        path.moveTo(cx + sway * w * 0.3f, base - h)
        path.cubicTo(cx + w * 0.15f, base - h * 0.72f, cx + w * 0.5f, base - h * 0.55f, cx + w * 0.5f, base - h * 0.30f)
        path.cubicTo(cx + w * 0.5f, base - h * 0.10f, cx + w * 0.28f, base, cx, base)
        path.cubicTo(cx - w * 0.28f, base, cx - w * 0.5f, base - h * 0.10f, cx - w * 0.5f, base - h * 0.30f)
        path.cubicTo(cx - w * 0.5f, base - h * 0.48f, cx - w * 0.32f, base - h * 0.58f, cx - w * 0.24f, base - h * 0.70f)
        path.cubicTo(cx - w * 0.16f, base - h * 0.58f, cx - w * 0.08f, base - h * 0.55f, cx - w * 0.02f, base - h * 0.56f)
        path.cubicTo(cx - w * 0.06f, base - h * 0.72f, cx - w * 0.02f, base - h * 0.88f, cx + sway * w * 0.3f, base - h)
        path.close()
        return path
    }

    fun colors(level: FlameLevel): IntArray = when (level) {
        FlameLevel.NONE -> intArrayOf(0xFFD3D8D3.toInt(), 0xFFE4E8E4.toInt(), 0xFFF2F4F2.toInt())
        FlameLevel.SPARK, FlameLevel.SMALL -> intArrayOf(0xFFFF9B42.toInt(), 0xFFFFC94A.toInt(), 0xFFFFF0C2.toInt())
        FlameLevel.SPECIAL -> intArrayOf(0xFFFF7A3D.toInt(), 0xFFFFB938.toInt(), 0xFFFFF3B0.toInt())
        FlameLevel.ADVANCED -> intArrayOf(0xFFFF5F5F.toInt(), 0xFFFFA63D.toInt(), 0xFFFFF7D6.toInt())
        FlameLevel.LEGEND -> intArrayOf(0xFFB06CF0.toInt(), 0xFFFF7FB0.toInt(), 0xFFFFF0FA.toInt())
    }

    fun scale(level: FlameLevel): Float = when (level) {
        FlameLevel.NONE -> 0.62f; FlameLevel.SPARK -> 0.58f; FlameLevel.SMALL -> 0.72f; FlameLevel.SPECIAL -> 0.85f; FlameLevel.ADVANCED -> 0.95f; FlameLevel.LEGEND -> 1f
    }

    fun draw(c: Canvas, level: FlameLevel, x: Float, y: Float, size: Float, phase: Float = 0f) {
        val sc = scale(level)
        val cx = x + size / 2; val base = y + size * 0.96f
        val w = size * 0.70f * sc; val h = size * 0.92f * sc
        val sway = if (level == FlameLevel.NONE) 0f else (Math.sin(phase * Math.PI * 2) * 0.12).toFloat()
        val col = colors(level)
        p.style = Paint.Style.FILL
        if (level.ordinal >= FlameLevel.SPECIAL.ordinal) {
            p.shader = RadialGradient(cx, base - h * 0.4f, h * 0.8f, Theme.alpha(col[1], 0.35f), 0, Shader.TileMode.CLAMP)
            c.drawCircle(cx, base - h * 0.4f, h * 0.8f, p); p.shader = null
        }
        p.shader = LinearGradient(cx, base - h, cx, base, col[1], col[0], Shader.TileMode.CLAMP)
        c.drawPath(flamePath(cx, base, w, h, sway), p)
        p.shader = LinearGradient(cx, base - h * 0.6f, cx, base, col[2], col[1], Shader.TileMode.CLAMP)
        c.drawPath(flamePath(cx, base - h * 0.02f, w * 0.58f, h * 0.6f, -sway * 0.7f), p)
        p.shader = null
        if (level.ordinal >= FlameLevel.SMALL.ordinal) {
            p.color = col[2]
            c.drawOval(RectF(cx - w * 0.12f, base - h * 0.28f, cx + w * 0.12f, base - h * 0.04f), p)
        }
        if (level.ordinal >= FlameLevel.SPECIAL.ordinal) {
            p.color = if (level == FlameLevel.LEGEND) 0xFFFFD34D.toInt() else 0xFFFFD86B.toInt()
            sparkle(c, cx + w * 0.62f, base - h * 0.85f, size * 0.06f * (1 + 0.2f * Math.sin(phase * 6.28 + 1).toFloat()))
            sparkle(c, cx - w * 0.66f, base - h * 0.55f, size * 0.045f * (1 + 0.2f * Math.sin(phase * 6.28 + 3).toFloat()))
            if (level.ordinal >= FlameLevel.ADVANCED.ordinal) sparkle(c, cx + w * 0.70f, base - h * 0.25f, size * 0.04f)
        }
        if (level == FlameLevel.LEGEND) {
            p.color = 0xFFFFD34D.toInt()
            val crown = Path(); val cw = w * 0.45f; val ct = base - h - size * 0.02f
            crown.moveTo(cx - cw / 2, ct); crown.lineTo(cx - cw / 2, ct - size * 0.08f); crown.lineTo(cx - cw / 4, ct - size * 0.04f)
            crown.lineTo(cx, ct - size * 0.11f); crown.lineTo(cx + cw / 4, ct - size * 0.04f); crown.lineTo(cx + cw / 2, ct - size * 0.08f); crown.lineTo(cx + cw / 2, ct); crown.close()
            c.drawPath(crown, p)
        }
    }

    fun sparkle(c: Canvas, x: Float, y: Float, r: Float) {
        val path = Path()
        path.moveTo(x, y - r); path.quadTo(x + r * 0.15f, y - r * 0.15f, x + r, y); path.quadTo(x + r * 0.15f, y + r * 0.15f, x, y + r)
        path.quadTo(x - r * 0.15f, y + r * 0.15f, x - r, y); path.quadTo(x - r * 0.15f, y - r * 0.15f, x, y - r); path.close()
        c.drawPath(path, p)
    }
}

/** Chama com leve tremulação. */
class FlameView(context: Context, var level: FlameLevel, private val animate: Boolean = true) : View(context) {
    private var phase = 0f
    private var anim: ValueAnimator? = null
    override fun onDraw(canvas: Canvas) {
        val sz = minOf(width, height).toFloat()
        FlameArt.draw(canvas, level, (width - sz) / 2, (height - sz) / 2, sz, phase)
    }
    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (!animate || level == FlameLevel.NONE) return
        anim = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 2400; repeatCount = ValueAnimator.INFINITE; interpolator = LinearInterpolator()
            addUpdateListener { phase = it.animatedValue as Float; invalidate() }
            start()
        }
    }
    override fun onDetachedFromWindow() { anim?.cancel(); anim = null; super.onDetachedFromWindow() }
}

/** Ramos e folhinhas decorativas discretas para cabeçalhos e cartões. */
object Decor {
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    private val s = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }

    fun sprig(c: Canvas, x: Float, y: Float, size: Float, color: Int, angle: Float = 0f, flip: Boolean = false) {
        c.save(); c.translate(x, y); c.rotate(angle); if (flip) c.scale(-1f, 1f)
        s.color = color; s.strokeWidth = size * 0.04f
        val stem = Path(); stem.moveTo(0f, 0f); stem.quadTo(size * 0.1f, -size * 0.5f, size * 0.05f, -size)
        c.drawPath(stem, s)
        p.color = color
        for (i in 0 until 4) {
            val t = 0.25f + i * 0.2f
            val px = size * 0.1f * t * 2 * (1 - t) + size * 0.05f * t * t
            val py = -size * t
            leaf(c, px, py, size * 0.22f, if (i % 2 == 0) -50f else 50f)
        }
        c.restore()
    }

    private fun leaf(c: Canvas, x: Float, y: Float, len: Float, angle: Float) {
        c.save(); c.translate(x, y); c.rotate(angle)
        val path = Path(); path.moveTo(0f, 0f); path.quadTo(len * 0.3f, -len * 0.5f, 0f, -len); path.quadTo(-len * 0.3f, -len * 0.5f, 0f, 0f); path.close()
        c.drawPath(path, p)
        c.restore()
    }

    fun dot(c: Canvas, x: Float, y: Float, r: Float, color: Int) { p.color = color; c.drawCircle(x, y, r, p) }

    fun flower(c: Canvas, x: Float, y: Float, r: Float, petal: Int, center: Int) {
        p.color = petal
        for (i in 0 until 5) { val a = Math.toRadians(i * 72.0 - 90); c.drawCircle(x + (r * Math.cos(a)).toFloat(), y + (r * Math.sin(a)).toFloat(), r * 0.75f, p) }
        p.color = center; c.drawCircle(x, y, r * 0.6f, p)
    }
}
