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
 * App e wallpaper rodam no mesmo processo, então o renderer lê isso a cada frame.
 */
object Scene {
    data class Settings(val strength: Float, val focus: Float, val effect: Int)

    private const val PREFS = "scene"
    private const val KEY_VERSION = "version"
    private const val KEY_STRENGTH = "strength"
    private const val KEY_FOCUS = "focus"
    private const val KEY_EFFECT = "effect"

    fun imageFile(ctx: Context) = File(ctx.filesDir, "scene_image.jpg")
    fun depthFile(ctx: Context) = File(ctx.filesDir, "scene_depth.png")

    fun hasScene(ctx: Context) = imageFile(ctx).exists() && depthFile(ctx).exists()

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Muda sempre que foto/profundidade mudam, para o renderer recarregar as texturas. */
    fun version(ctx: Context): Long = prefs(ctx).getLong(KEY_VERSION, 0L)

    fun bumpVersion(ctx: Context) {
        prefs(ctx).edit().putLong(KEY_VERSION, System.currentTimeMillis()).apply()
    }

    fun settings(ctx: Context): Settings {
        val p = prefs(ctx)
        return Settings(
            strength = p.getFloat(KEY_STRENGTH, 0.6f),
            focus = p.getFloat(KEY_FOCUS, 0.5f),
            effect = p.getInt(KEY_EFFECT, Effect.NONE),
        )
    }

    fun save(ctx: Context, s: Settings) {
        prefs(ctx).edit()
            .putFloat(KEY_STRENGTH, s.strength)
            .putFloat(KEY_FOCUS, s.focus)
            .putInt(KEY_EFFECT, s.effect)
            .apply()
    }
}
