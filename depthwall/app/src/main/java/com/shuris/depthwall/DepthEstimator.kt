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

    /** Mapa de profundidade + camada de fundo reconstruída (todos com a proporção da foto). */
    class Result(val depth: Bitmap, val bgColor: Bitmap, val bgDepth: Bitmap)

    /**
     * Calcula o mapa de profundidade (branco = perto) com bordas refinadas pela própria foto e
     * a camada de fundo usada para preencher o que aparece atrás dos objetos ao mover.
     */
    fun estimate(src: Bitmap, onStep: (String) -> Unit = {}): Result {
        // 1) IA na proporção real da foto (lado menor 518, múltiplos de 14).
        val (iw, ih) = modelInputSize(src.width, src.height)
        val scaled = Bitmap.createScaledBitmap(src, iw, ih, true)
        val px = IntArray(iw * ih)
        scaled.getPixels(px, 0, iw, 0, 0, iw, ih)
        if (scaled !== src) scaled.recycle()

        val plane = iw * ih
        val input = ByteBuffer.allocateDirect(3 * plane * 4).order(ByteOrder.nativeOrder()).asFloatBuffer()
        for (i in 0 until plane) {
            val p = px[i]
            input.put(i, (((p shr 16) and 0xFF) / 255f - MEAN[0]) / STD[0])
            input.put(plane + i, (((p shr 8) and 0xFF) / 255f - MEAN[1]) / STD[1])
            input.put(2 * plane + i, ((p and 0xFF) / 255f - MEAN[2]) / STD[2])
        }

        val env = OrtEnvironment.getEnvironment()
        val (raw, ow, oh) = OrtSession.SessionOptions().use { opts ->
            env.createSession(modelFile.absolutePath, opts).use { session ->
                OnnxTensor.createTensor(env, input, longArrayOf(1, 3, ih.toLong(), iw.toLong())).use { tensor ->
                    session.run(mapOf(session.inputNames.first() to tensor)).use { result ->
                        val out = result.get(0) as OnnxTensor
                        val shape = out.info.shape
                        val h = shape[shape.size - 2].toInt()
                        val w = shape[shape.size - 1].toInt()
                        val values = FloatArray(w * h)
                        out.floatBuffer.get(values)
                        Triple(values, w, h)
                    }
                }
            }
        }
        normalizeRobust(raw)

        // 2) Amplia até a resolução da guia e "recorta" as bordas usando as cores da foto.
        onStep("Refinando as bordas…")
        val scale = GUIDE_LONG_SIDE.toFloat() / maxOf(src.width, src.height)
        val gw = (src.width * minOf(1f, scale)).toInt().coerceAtLeast(1)
        val gh = (src.height * minOf(1f, scale)).toInt().coerceAtLeast(1)
        val guideBmp = Bitmap.createScaledBitmap(src, gw, gh, true)
        val guide = IntArray(gw * gh)
        guideBmp.getPixels(guide, 0, gw, 0, 0, gw, gh)
        if (guideBmp !== src) guideBmp.recycle()

        var depth = GuidedFilter.resize(raw, ow, oh, gw, gh)
        val radius = maxOf(6, maxOf(gw, gh) / 90)
        depth = GuidedFilter.snapEdges(guide, depth, gw, gh, radius, 0.12f)
        depth = GuidedFilter.median3(depth, gw, gh)

        // 3) Camada de fundo: o que está escondido atrás das bordas dos objetos próximos.
        onStep("Reconstruindo o fundo…")
        val bgRadius = Math.ceil(0.055 * maxOf(gw, gh)).toInt()
        val bg = BackgroundLayer.build(guide, depth, gw, gh, bgRadius, 0.06f)

        return Result(
            depth = grayBitmap(depth, gw, gh),
            bgColor = Bitmap.createBitmap(bg.color, gw, gh, Bitmap.Config.ARGB_8888),
            bgDepth = grayBitmap(bg.depth, gw, gh),
        )
    }

    private fun grayBitmap(values: FloatArray, w: Int, h: Int): Bitmap {
        val out = IntArray(w * h)
        for (i in out.indices) {
            val v = (values[i] * 255f).toInt().coerceIn(0, 255)
            out[i] = (0xFF shl 24) or (v shl 16) or (v shl 8) or v
        }
        return Bitmap.createBitmap(out, w, h, Bitmap.Config.ARGB_8888)
    }

    private fun modelInputSize(w: Int, h: Int): Pair<Int, Int> {
        val s = INPUT_SHORT_SIDE.toFloat() / minOf(w, h)
        fun snap(v: Float) = (Math.round(v / 14f) * 14).coerceIn(14 * 10, INPUT_MAX_SIDE)
        return snap(w * s) to snap(h * s)
    }

    /** Normaliza para [0, 1] ignorando 1% de valores extremos de cada lado. */
    private fun normalizeRobust(a: FloatArray) {
        val sample = FloatArray(minOf(a.size, 20_000)) { a[(it.toLong() * a.size / minOf(a.size, 20_000)).toInt()] }
        sample.sort()
        val lo = sample[(sample.size * 0.01f).toInt()]
        val hi = sample[(sample.size * 0.99f).toInt().coerceAtMost(sample.size - 1)]
        val range = (hi - lo).takeIf { it > 1e-6f } ?: 1f
        for (i in a.indices) a[i] = ((a[i] - lo) / range).coerceIn(0f, 1f)
    }

    private companion object {
        const val MODEL_URL =
            "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_quantized.onnx"
        // Acima da resolução de treino (518) para enxergar melhor objetos finos (ex.: cordas).
        const val INPUT_SHORT_SIDE = 616   // múltiplo de 14
        const val INPUT_MAX_SIDE = 1232    // limite do lado maior (múltiplo de 14)
        const val GUIDE_LONG_SIDE = 960    // resolução final do mapa de profundidade
        val MEAN = floatArrayOf(0.485f, 0.456f, 0.406f)
        val STD = floatArrayOf(0.229f, 0.224f, 0.225f)
    }
}
