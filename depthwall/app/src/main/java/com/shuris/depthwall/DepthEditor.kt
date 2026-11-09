package com.shuris.depthwall

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Pincel para corrigir o mapa de profundidade à mão, onde a IA errou.
 *
 * Trabalha sobre o mapa salvo (mesma resolução e proporção da foto). O pincel "inteligente"
 * pesa cada pixel pela semelhança de cor com o centro do pincel, então ao pintar uma corda
 * o efeito não vaza para a grama ou a madeira ao lado.
 */
class DepthEditor(private val ctx: Context) {

    enum class Mode { FORWARD, BACK, LEVEL, SMOOTH }

    var width = 0
        private set
    var height = 0
        private set
    private var depth = FloatArray(0)
    private var guide = IntArray(0)
    private val undoStack = ArrayDeque<FloatArray>()
    private var levelValue = 0.5f

    val isLoaded get() = width > 0

    fun load(): Boolean {
        val depthBmp = BitmapFactory.decodeFile(Scene.depthFile(ctx).absolutePath) ?: return false
        val w = depthBmp.width
        val h = depthBmp.height
        val px = IntArray(w * h)
        depthBmp.getPixels(px, 0, w, 0, 0, w, h)
        depthBmp.recycle()

        val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(Scene.imageFile(ctx).absolutePath, opts)
        var sample = 1
        while (opts.outWidth / (sample * 2) >= w && opts.outHeight / (sample * 2) >= h) sample *= 2
        val photo = BitmapFactory.decodeFile(
            Scene.imageFile(ctx).absolutePath,
            BitmapFactory.Options().apply { inSampleSize = sample },
        ) ?: return false
        val scaled = Bitmap.createScaledBitmap(photo, w, h, true)
        val g = IntArray(w * h)
        scaled.getPixels(g, 0, w, 0, 0, w, h)
        if (scaled !== photo) scaled.recycle()
        photo.recycle()

        depth = FloatArray(w * h) { (px[it] and 0xFF) / 255f }
        guide = g
        width = w
        height = h
        undoStack.clear()
        return true
    }

    fun unload() {
        width = 0
        height = 0
        depth = FloatArray(0)
        guide = IntArray(0)
        undoStack.clear()
    }

    /** Começa um traço: guarda o estado para desfazer. */
    fun beginStroke(u: Float, v: Float) {
        if (!isLoaded) return
        undoStack.addLast(depth.copyOf())
        while (undoStack.size > MAX_UNDO) undoStack.removeFirst()
        levelValue = sample(u, v)
    }

    fun canUndo() = undoStack.isNotEmpty()

    fun undo(): Boolean {
        val prev = undoStack.removeLastOrNull() ?: return false
        depth = prev
        return true
    }

    /** Volta ao mapa original da IA (mantém a possibilidade de desfazer). */
    fun restoreOriginal(): Boolean {
        val bmp = BitmapFactory.decodeFile(Scene.depthAiFile(ctx).absolutePath) ?: return false
        if (bmp.width != width || bmp.height != height) {
            bmp.recycle()
            return false
        }
        val px = IntArray(width * height)
        bmp.getPixels(px, 0, width, 0, 0, width, height)
        bmp.recycle()
        undoStack.addLast(depth.copyOf())
        depth = FloatArray(width * height) { (px[it] and 0xFF) / 255f }
        return true
    }

    /**
     * Aplica o pincel ao longo de um segmento (coordenadas da foto em [0, 1]).
     * @param radius raio em pixels do mapa
     */
    fun strokeSegment(u0: Float, v0: Float, u1: Float, v1: Float, radius: Float, strength: Float, mode: Mode, smart: Boolean) {
        if (!isLoaded) return
        val dx = (u1 - u0) * width
        val dy = (v1 - v0) * height
        val dist = sqrt(dx * dx + dy * dy)
        val spacing = max(1f, radius / 3f)
        val steps = max(1, (dist / spacing).toInt())
        for (i in 1..steps) {
            val t = i.toFloat() / steps
            dab(u0 + (u1 - u0) * t, v0 + (v1 - v0) * t, radius, strength, mode, smart)
        }
    }

    fun dab(u: Float, v: Float, radius: Float, strength: Float, mode: Mode, smart: Boolean) {
        if (!isLoaded) return
        val cx = u * width
        val cy = v * height
        val r = max(1f, radius)
        val x0 = max(0, (cx - r).toInt())
        val x1 = min(width - 1, (cx + r).toInt())
        val y0 = max(0, (cy - r).toInt())
        val y1 = min(height - 1, (cy + r).toInt())
        if (x0 > x1 || y0 > y1) return

        // Cor de referência: média 3x3 no centro do pincel.
        val (cr, cg, cb) = centerColor(cx.toInt().coerceIn(0, width - 1), cy.toInt().coerceIn(0, height - 1))

        // Para suavizar, usa uma cópia da região como fonte.
        val src = if (mode == Mode.SMOOTH) depth.copyOf() else depth
        val k = strength.coerceIn(0f, 1f)

        for (y in y0..y1) {
            val fy = (y + 0.5f - cy) / r
            for (x in x0..x1) {
                val fx = (x + 0.5f - cx) / r
                val rr = sqrt(fx * fx + fy * fy)
                if (rr >= 1f) continue
                // Borda macia: cheio até 60% do raio, caindo até a borda.
                var w = if (rr < 0.6f) 1f else smooth(1f - (rr - 0.6f) / 0.4f)
                val i = y * width + x
                if (smart) {
                    val c = guide[i]
                    val dr = ((c shr 16) and 0xFF) / 255f - cr
                    val dg = ((c shr 8) and 0xFF) / 255f - cg
                    val db = (c and 0xFF) / 255f - cb
                    w *= exp(-(dr * dr + dg * dg + db * db) / COLOR_SIGMA2)
                }
                if (w < 0.003f) continue
                val wk = w * k
                val d = depth[i]
                depth[i] = when (mode) {
                    Mode.FORWARD -> min(1f, d + 0.06f * wk)
                    Mode.BACK -> max(0f, d - 0.06f * wk)
                    Mode.LEVEL -> d + (levelValue - d) * 0.5f * wk
                    Mode.SMOOTH -> d + (localMean(src, x, y) - d) * 0.5f * wk
                }
            }
        }
    }

    fun toBitmap(): Bitmap {
        val out = IntArray(width * height)
        for (i in out.indices) {
            val v = (depth[i] * 255f).toInt().coerceIn(0, 255)
            out[i] = (0xFF shl 24) or (v shl 16) or (v shl 8) or v
        }
        return Bitmap.createBitmap(out, width, height, Bitmap.Config.ARGB_8888)
    }

    /** Cópia do estado atual para salvar em outra thread sem conflito com novos traços. */
    fun snapshot(): Snapshot = Snapshot(depth.copyOf(), guide, width, height)

    class Snapshot(val depth: FloatArray, val guide: IntArray, val width: Int, val height: Int)

    private fun sample(u: Float, v: Float): Float {
        val x = (u * width).toInt().coerceIn(0, width - 1)
        val y = (v * height).toInt().coerceIn(0, height - 1)
        return depth[y * width + x]
    }

    private fun centerColor(x: Int, y: Int): Triple<Float, Float, Float> {
        var r = 0f
        var g = 0f
        var b = 0f
        var n = 0
        for (yy in max(0, y - 1)..min(height - 1, y + 1)) for (xx in max(0, x - 1)..min(width - 1, x + 1)) {
            val c = guide[yy * width + xx]
            r += ((c shr 16) and 0xFF) / 255f
            g += ((c shr 8) and 0xFF) / 255f
            b += (c and 0xFF) / 255f
            n++
        }
        return Triple(r / n, g / n, b / n)
    }

    private fun localMean(src: FloatArray, x: Int, y: Int): Float {
        var s = 0f
        var n = 0
        for (yy in max(0, y - 2)..min(height - 1, y + 2)) for (xx in max(0, x - 2)..min(width - 1, x + 2)) {
            s += src[yy * width + xx]
            n++
        }
        return s / n
    }

    private fun smooth(t: Float) = t * t * (3f - 2f * t)

    private companion object {
        const val MAX_UNDO = 15
        const val COLOR_SIGMA2 = 0.02f // tolerância de cor do pincel inteligente
    }
}
