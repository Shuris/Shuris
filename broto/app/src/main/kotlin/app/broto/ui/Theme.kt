package app.broto.ui

import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface

/** Paleta resolvida para o tema atual. */
class Palette(
    val dark: Boolean,
    val bg: Int,
    val bgGreen: Int,
    val surface: Int,
    val surfaceAlt: Int,
    val outline: Int,
    val text: Int,
    val textSoft: Int,
    val textFaint: Int,
    val primary: Int,
    val primarySoft: Int,
    val primaryDark: Int,
    val onPrimary: Int,
    val deep: Int,
    val yellow: Int,
    val coral: Int,
    val coralSoft: Int,
    val shadow: Int,
)

data class Accent(val key: String, val label: String, val primary: Int, val soft: Int, val dark: Int, val deep: Int)

object Theme {
    val accents = listOf(
        Accent("green", "Broto", 0xFFA5D879.toInt(), 0xFFC7E8A8.toInt(), 0xFF188B5B.toInt(), 0xFF086B4D.toInt()),
        Accent("mint", "Menta", 0xFF8ED8C3.toInt(), 0xFFC4EDE0.toInt(), 0xFF1F8A7A.toInt(), 0xFF0E5E53.toInt()),
        Accent("sky", "Céu", 0xFF9FD3F0.toInt(), 0xFFCFE8F7.toInt(), 0xFF2D7FB0.toInt(), 0xFF1B5B82.toInt()),
        Accent("lavender", "Lavanda", 0xFFC9B8F0.toInt(), 0xFFE4DBF8.toInt(), 0xFF6E55B8.toInt(), 0xFF4E3790.toInt()),
        Accent("peach", "Pêssego", 0xFFFFC59E.toInt(), 0xFFFFE1CC.toInt(), 0xFFC7653A.toInt(), 0xFF97461F.toInt()),
        Accent("pink", "Flor", 0xFFF5B5C8.toInt(), 0xFFFADAE4.toInt(), 0xFFB8487A.toInt(), 0xFF8A2F58.toInt()),
    )

    lateinit var p: Palette
        private set
    var accent: Accent = accents[0]
        private set

    fun isDark(context: Context, mode: String): Boolean = when (mode) {
        "dark" -> true
        "light" -> false
        else -> (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    }

    fun apply(context: Context, mode: String, accentKey: String) {
        val dark = isDark(context, mode)
        val a = accents.firstOrNull { it.key == accentKey } ?: accents[0]
        accent = a
        p = if (!dark) Palette(
            dark = false,
            bg = 0xFFF7F7EF.toInt(), bgGreen = blend(0xFFF7F7EF.toInt(), a.soft, 0.35f), surface = Color.WHITE, surfaceAlt = blend(0xFFF7F7EF.toInt(), a.soft, 0.55f),
            outline = 0xFFE6E9DF.toInt(), text = 0xFF23332A.toInt(), textSoft = 0xFF777D78.toInt(), textFaint = 0xFFAEB3AE.toInt(),
            primary = a.primary, primarySoft = a.soft, primaryDark = a.dark, onPrimary = 0xFF14301F.toInt(), deep = a.deep,
            yellow = 0xFFFFDF69.toInt(), coral = 0xFFE58E7E.toInt(), coralSoft = 0xFFFADDD6.toInt(), shadow = 0x14000000,
        ) else Palette(
            dark = true,
            bg = 0xFF121814.toInt(), bgGreen = blend(0xFF121814.toInt(), a.dark, 0.18f), surface = 0xFF1C241F.toInt(), surfaceAlt = 0xFF243029.toInt(),
            outline = 0xFF2D3931.toInt(), text = 0xFFE9F0E5.toInt(), textSoft = 0xFFA4AEA6.toInt(), textFaint = 0xFF6D7870.toInt(),
            primary = a.primary, primarySoft = blend(0xFF1C241F.toInt(), a.primary, 0.28f), primaryDark = a.primary, onPrimary = 0xFF10261A.toInt(), deep = a.soft,
            yellow = 0xFFFFDF69.toInt(), coral = 0xFFEE9C8D.toInt(), coralSoft = 0xFF4A2E2A.toInt(), shadow = 0x33000000,
        )
    }

    /** Cores de humor (1..5). Inspiradas na sugestão: cinza, coral suave, verde médio, verde-claro, amarelo. */
    fun moodColor(level: Int): Int = when (level) {
        1 -> 0xFFAEB5B1.toInt()
        2 -> 0xFFEBA393.toInt()
        3 -> 0xFF8FCB9C.toInt()
        4 -> 0xFFA5D879.toInt()
        else -> 0xFFFFDA5C.toInt()
    }

    val habitColors = intArrayOf(
        0xFFA5D879.toInt(), 0xFF7CC7A0.toInt(), 0xFF8ED8C3.toInt(), 0xFF9FD3F0.toInt(), 0xFFAFC3F5.toInt(), 0xFFC9B8F0.toInt(),
        0xFFF5B5C8.toInt(), 0xFFFFB4A2.toInt(), 0xFFFFC59E.toInt(), 0xFFFFDF69.toInt(), 0xFFD8C8A8.toInt(), 0xFFB9C4BC.toInt(),
    )

    fun blend(a: Int, b: Int, t: Float): Int {
        val r = (Color.red(a) + (Color.red(b) - Color.red(a)) * t).toInt()
        val g = (Color.green(a) + (Color.green(b) - Color.green(a)) * t).toInt()
        val bl = (Color.blue(a) + (Color.blue(b) - Color.blue(a)) * t).toInt()
        return Color.rgb(r, g, bl)
    }

    fun alpha(c: Int, a: Float): Int = Color.argb((255 * a).toInt(), Color.red(c), Color.green(c), Color.blue(c))

    /** Versão mais escura/saturada de uma cor clara, para texto ou ícones sobre fundo claro. */
    fun deepen(c: Int, f: Float = 0.45f): Int = blend(c, if (p.dark) Color.WHITE else 0xFF1F3A2A.toInt(), f)
}

object Fonts {
    lateinit var regular: Typeface
    lateinit var semibold: Typeface
    lateinit var bold: Typeface
    lateinit var extrabold: Typeface
    lateinit var italic: Typeface
    private var loaded = false

    fun load(context: Context) {
        if (loaded) return
        val am = context.assets
        fun f(n: String): Typeface = try { Typeface.createFromAsset(am, "fonts/$n.ttf") } catch (e: Exception) { Typeface.DEFAULT }
        regular = f("nunito_regular"); semibold = f("nunito_semibold"); bold = f("nunito_bold"); extrabold = f("nunito_extrabold"); italic = f("nunito_italic")
        loaded = true
    }
}
