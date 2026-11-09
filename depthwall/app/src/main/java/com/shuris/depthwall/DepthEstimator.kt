package com.shuris.depthwall

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.graphics.Bitmap
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Estima a profundidade de uma foto no próprio aparelho com o Depth Anything V2 Small
 * (licença Apache-2.0) via ONNX Runtime. O modelo (~27 MB) é baixado na primeira vez.
 */
class DepthEstimator(private val ctx: Context) {

    private val modelFile = File(ctx.filesDir, "depth_anything_v2_small_q.onnx")

    fun isModelReady() = modelFile.exists() && modelFile.length() > 1_000_000

    fun ensureModel(onProgress: (Int) -> Unit) {
        if (isModelReady()) return
        val tmp = File(ctx.filesDir, "model.download")
        val conn = URL(MODEL_URL).openConnection() as HttpURLConnection
        conn.connectTimeout = 20_000
        conn.readTimeout = 60_000
        conn.instanceFollowRedirects = true
        try {
            val code = conn.responseCode
            if (code !in 200..299) throw IOException("HTTP $code ao baixar o modelo")
            val total = conn.contentLengthLong
            conn.inputStream.use { input ->
                tmp.outputStream().use { out ->
                    val buf = ByteArray(64 * 1024)
                    var done = 0L
                    var lastPct = -1
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                        done += n
                        if (total > 0) {
                            val pct = (done * 100 / total).toInt()
                            if (pct != lastPct) {
                                lastPct = pct
                                onProgress(pct)
                            }
                        }
                    }
                }
            }
        } finally {
            conn.disconnect()
        }
        if (!tmp.renameTo(modelFile)) throw IOException("Não foi possível salvar o modelo")
    }

    /** Retorna um mapa de profundidade em tons de cinza (branco = perto). */
    fun estimate(src: Bitmap): Bitmap {
        val n = INPUT_SIZE
        val scaled = Bitmap.createScaledBitmap(src, n, n, true)
        val px = IntArray(n * n)
        scaled.getPixels(px, 0, n, 0, 0, n, n)
        if (scaled !== src) scaled.recycle()

        val plane = n * n
        val input = ByteBuffer.allocateDirect(3 * plane * 4).order(ByteOrder.nativeOrder()).asFloatBuffer()
        for (i in 0 until plane) {
            val p = px[i]
            input.put(i, (((p shr 16) and 0xFF) / 255f - MEAN[0]) / STD[0])
            input.put(plane + i, (((p shr 8) and 0xFF) / 255f - MEAN[1]) / STD[1])
            input.put(2 * plane + i, ((p and 0xFF) / 255f - MEAN[2]) / STD[2])
        }

        val env = OrtEnvironment.getEnvironment()
        val (depth, w, h) = OrtSession.SessionOptions().use { opts ->
            env.createSession(modelFile.absolutePath, opts).use { session ->
                OnnxTensor.createTensor(env, input, longArrayOf(1, 3, n.toLong(), n.toLong())).use { tensor ->
                    session.run(mapOf(session.inputNames.first() to tensor)).use { result ->
                        val out = result.get(0) as OnnxTensor
                        val shape = out.info.shape
                        val oh = shape[shape.size - 2].toInt()
                        val ow = shape[shape.size - 1].toInt()
                        val values = FloatArray(ow * oh)
                        out.floatBuffer.get(values)
                        Triple(values, ow, oh)
                    }
                }
            }
        }

        normalize(depth)
        // Dilatar a frente e suavizar reduz o "rasgo" nas bordas dos objetos ao mover.
        maxFilter(depth, w, h, 3)
        repeat(2) { boxBlur(depth, w, h, 3) }

        val out = IntArray(w * h)
        for (i in out.indices) {
            val v = (depth[i] * 255f).toInt().coerceIn(0, 255)
            out[i] = (0xFF shl 24) or (v shl 16) or (v shl 8) or v
        }
        return Bitmap.createBitmap(out, w, h, Bitmap.Config.ARGB_8888)
    }

    private fun normalize(a: FloatArray) {
        var mn = Float.MAX_VALUE
        var mx = -Float.MAX_VALUE
        for (v in a) {
            if (v < mn) mn = v
            if (v > mx) mx = v
        }
        val range = (mx - mn).takeIf { it > 1e-6f } ?: 1f
        for (i in a.indices) a[i] = (a[i] - mn) / range
    }

    private fun maxFilter(a: FloatArray, w: Int, h: Int, r: Int) {
        val tmp = FloatArray(a.size)
        for (y in 0 until h) for (x in 0 until w) {
            var m = 0f
            for (k in -r..r) {
                val v = a[y * w + (x + k).coerceIn(0, w - 1)]
                if (v > m) m = v
            }
            tmp[y * w + x] = m
        }
        for (y in 0 until h) for (x in 0 until w) {
            var m = 0f
            for (k in -r..r) {
                val v = tmp[(y + k).coerceIn(0, h - 1) * w + x]
                if (v > m) m = v
            }
            a[y * w + x] = m
        }
    }

    private fun boxBlur(a: FloatArray, w: Int, h: Int, r: Int) {
        val tmp = FloatArray(a.size)
        val norm = 1f / (2 * r + 1)
        for (y in 0 until h) for (x in 0 until w) {
            var s = 0f
            for (k in -r..r) s += a[y * w + (x + k).coerceIn(0, w - 1)]
            tmp[y * w + x] = s * norm
        }
        for (y in 0 until h) for (x in 0 until w) {
            var s = 0f
            for (k in -r..r) s += tmp[(y + k).coerceIn(0, h - 1) * w + x]
            a[y * w + x] = s * norm
        }
    }

    private companion object {
        const val MODEL_URL =
            "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_quantized.onnx"
        const val INPUT_SIZE = 518 // múltiplo de 14, resolução nativa do modelo
        val MEAN = floatArrayOf(0.485f, 0.456f, 0.406f)
        val STD = floatArrayOf(0.229f, 0.224f, 0.225f)
    }
}
