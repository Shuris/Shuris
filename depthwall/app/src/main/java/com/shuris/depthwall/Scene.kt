package com.shuris.depthwall

import android.content.Context
import java.io.File

/** Efeitos desenhados entre as camadas de profundidade (mesmos valores usados no shader). */
object Effect {
    const val NONE = 0
    const val SNOW = 1
    const val RAIN = 2
    const val FIREFLIES = 3
    const val FOG = 4
}

/**
 * Cena atual do wallpaper: foto + mapa de profundidade em arquivos e ajustes em SharedPreferences.
 * App e wallpaper rodam no mesmo processo, então os valores ficam em cache na memória e o
 * renderer os lê a cada frame sem custo.
 */
object Scene {
    data class Settings(
        // 3D
        val strength: Float = 0.6f,
        val focus: Float = 0.5f,
        // Efeitos
        val effect: Int = Effect.NONE,
        val fxAmount: Float = 0.5f,
        val fxSpeed: Float = 0.5f,
        val fxSize: Float = 0.5f,
        // Enquadramento: zoom relativo a "preencher a tela" (1 = preenche) e deslocamento da foto.
        val zoom: Float = 1f,
        val panX: Float = 0f,
        val panY: Float = 0f,
    )

    const val MIN_ZOOM = 0.5f
    const val MAX_ZOOM = 4f

    private const val PREFS = "scene"
    private const val KEY_VERSION = "version"

    @Volatile private var cachedSettings: Settings? = null
    @Volatile private var cachedVersion: Long? = null

    fun imageFile(ctx: Context) = File(ctx.filesDir, "scene_image.jpg")
    fun depthFile(ctx: Context) = File(ctx.filesDir, "scene_depth.png")
    fun bgColorFile(ctx: Context) = File(ctx.filesDir, "scene_bg_color.jpg")
    fun bgDepthFile(ctx: Context) = File(ctx.filesDir, "scene_bg_depth.png")

    fun hasScene(ctx: Context) = imageFile(ctx).exists() && depthFile(ctx).exists()

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Muda sempre que foto/profundidade mudam, para o renderer recarregar as texturas. */
    fun version(ctx: Context): Long =
        cachedVersion ?: prefs(ctx).getLong(KEY_VERSION, 0L).also { cachedVersion = it }

    fun bumpVersion(ctx: Context) {
        val v = System.currentTimeMillis()
        cachedVersion = v
        prefs(ctx).edit().putLong(KEY_VERSION, v).apply()
    }

    fun settings(ctx: Context): Settings = cachedSettings ?: load(ctx).also { cachedSettings = it }

    fun save(ctx: Context, s: Settings) {
        cachedSettings = s
        prefs(ctx).edit()
            .putFloat("strength", s.strength)
            .putFloat("focus", s.focus)
            .putInt("effect", s.effect)
            .putFloat("fxAmount", s.fxAmount)
            .putFloat("fxSpeed", s.fxSpeed)
            .putFloat("fxSize", s.fxSize)
            .putFloat("zoom", s.zoom)
            .putFloat("panX", s.panX)
            .putFloat("panY", s.panY)
            .apply()
    }

    private fun load(ctx: Context): Settings {
        val p = prefs(ctx)
        val d = Settings()
        return Settings(
            strength = p.getFloat("strength", d.strength),
            focus = p.getFloat("focus", d.focus),
            effect = p.getInt("effect", d.effect),
            fxAmount = p.getFloat("fxAmount", d.fxAmount),
            fxSpeed = p.getFloat("fxSpeed", d.fxSpeed),
            fxSize = p.getFloat("fxSize", d.fxSize),
            zoom = p.getFloat("zoom", d.zoom),
            panX = p.getFloat("panX", d.panX),
            panY = p.getFloat("panY", d.panY),
        )
    }
}
