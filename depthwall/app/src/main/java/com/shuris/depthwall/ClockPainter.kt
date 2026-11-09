package com.shuris.depthwall

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Typeface
import android.text.format.DateFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Desenha o relógio (data + hora) num bitmap transparente que vira textura no shader. */
object ClockPainter {
    const val STYLE_CLASSIC = 0
    const val STYLE_THIN = 1
    const val STYLE_HEAVY = 2
    const val STYLE_SERIF = 3
    const val STYLE_DIGITAL = 4
    const val STYLE_STACKED = 5
    const val STYLE_OUTLINE = 6

    val STYLE_NAMES = listOf("Clássico", "Fino", "Pesado", "Serifa", "Digital", "Empilhado", "Contorno")

    private const val BASE = 260f

    fun render(s: Scene.Settings, date: Date): Bitmap {
        val locale = Locale.getDefault()
        val hours = SimpleDateFormat(if (s.clock24h) "HH" else "h", locale).format(date)
        val minutes = SimpleDateFormat("mm", locale).format(date)
        val lines = if (s.clockStyle == STYLE_STACKED) listOf(hours, minutes) else listOf("$hours:$minutes")
        val dateText = if (s.clockDate) {
            SimpleDateFormat(DateFormat.getBestDateTimePattern(locale, "EEEEdMMMM"), locale)
                .format(date)
                .replaceFirstChar { it.titlecase(locale) }
        } else null

        val timeSize = if (s.clockStyle == STYLE_STACKED) BASE * 1.05f else BASE
        val time = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = timeSize
            color = s.clockColor
            typeface = typefaceFor(s.clockStyle)
            textAlign = Paint.Align.CENTER
            fontFeatureSettings = "tnum" // dígitos de largura fixa: o relógio não "pula"
            if (s.clockStyle == STYLE_OUTLINE) {
                style = Paint.Style.STROKE
                strokeWidth = timeSize * 0.028f
            } else {
                setShadowLayer(timeSize * 0.05f, 0f, timeSize * 0.015f, shadowFor(s.clockColor))
            }
        }
        val datePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = BASE * 0.17f
            color = s.clockColor
            alpha = 235
            typeface = Typeface.create(Typeface.SANS_SERIF, 600, false)
            textAlign = Paint.Align.CENTER
            setShadowLayer(BASE * 0.03f, 0f, BASE * 0.01f, shadowFor(s.clockColor))
        }

        // Altura "justa" dos dígitos para empilhar as linhas sem espaço sobrando.
        val digits = Rect()
        time.getTextBounds("0123456789", 0, 10, digits)
        val lineH = digits.height().toFloat()
        val lineGap = timeSize * if (s.clockStyle == STYLE_STACKED) 0.06f else 0f
        val dateBounds = Rect()
        dateText?.let { datePaint.getTextBounds(it, 0, it.length, dateBounds) }
        val dateGap = BASE * 0.10f
        val pad = BASE * 0.18f

        val contentW = maxOf(
            lines.maxOf { time.measureText(it) },
            dateText?.let { datePaint.measureText(it) } ?: 0f,
        )
        val contentH = (if (dateText != null) dateBounds.height() + dateGap else 0f) +
            lines.size * lineH + (lines.size - 1) * lineGap

        val w = (contentW + 2 * pad).toInt().coerceAtLeast(1)
        val h = (contentH + 2 * pad).toInt().coerceAtLeast(1)
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val cx = w / 2f
        var y = pad
        if (dateText != null) {
            c.drawText(dateText, cx, y - dateBounds.top, datePaint)
            y += dateBounds.height() + dateGap
        }
        for (line in lines) {
            c.drawText(line, cx, y - digits.top, time)
            y += lineH + lineGap
        }
        return bmp
    }

    private fun typefaceFor(style: Int): Typeface = when (style) {
        STYLE_THIN -> Typeface.create(Typeface.SANS_SERIF, 100, false)
        STYLE_HEAVY -> Typeface.create(Typeface.SANS_SERIF, 900, false)
        STYLE_SERIF -> Typeface.create(Typeface.SERIF, Typeface.BOLD)
        STYLE_DIGITAL -> Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        STYLE_STACKED -> Typeface.create(Typeface.create("sans-serif-condensed", Typeface.NORMAL), 700, false)
        STYLE_OUTLINE -> Typeface.create(Typeface.SANS_SERIF, 800, false)
        else -> Typeface.create(Typeface.SANS_SERIF, 600, false)
    }

    /** Sombra clara para cores escuras e escura para cores claras, para manter a leitura. */
    private fun shadowFor(color: Int): Int {
        val lum = (0.299 * Color.red(color) + 0.587 * Color.green(color) + 0.114 * Color.blue(color)) / 255
        return if (lum > 0.5) 0x66000000 else 0x55FFFFFF
    }
}
