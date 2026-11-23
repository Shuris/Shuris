package app.broto.security

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.os.CancellationSignal
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import app.broto.ui.*

/** Tela de bloqueio (PIN + biometria). */
class LockView(ctx: Context, private val sec: Security, private val onUnlock: () -> Unit) : FrameLayout(ctx) {
    private var entered = ""
    private val dots: View
    private val msg: TextView

    init {
        setBackgroundColor(Theme.p.bg)
        isClickable = true
        val col = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL; pad(24, 40) }
        addView(col, LayoutParams(MATCH, MATCH))
        col.drawing(-1, 120) { c, w, h -> MoodArt.draw(c, 4, (w - dpf(110)) / 2, 0f, dpf(110)) }
        col.text("Broto está protegido", TextStyle.TITLE) { gravity = Gravity.CENTER }.lp(MATCH, WRAP, t = 12)
        msg = col.text("Digite seu PIN", TextStyle.BODY, Theme.p.textSoft) { gravity = Gravity.CENTER }.lp(MATCH, WRAP, t = 6)
        dots = col.drawing(-1, 30) { c, w, h ->
            val p = Paint(Paint.ANTI_ALIAS_FLAG)
            val n = sec.pinLength; val gap = dpf(22)
            val start = w / 2f - gap * (n - 1) / 2
            for (i in 0 until n) {
                p.color = if (i < entered.length) Theme.p.primaryDark else Theme.p.outline
                c.drawCircle(start + gap * i, h / 2f, dpf(if (i < entered.length) 7 else 6), p)
            }
        }
        dots.lp(MATCH, dp(30), t = 20, b = 20)
        val keys = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "bio", "0", "del")
        for (row in keys.chunked(3)) {
            col.horizontal {
                gravity = Gravity.CENTER
                for (k in row) {
                    val cell = FrameLayout(ctx)
                    cell.layoutParams = LinearLayout.LayoutParams(dp(78), dp(68)).apply { setMargins(dp(8), dp(4), dp(8), dp(4)) }
                    when (k) {
                        "bio" -> if (sec.biometricEnabled && Build.VERSION.SDK_INT >= 28) {
                            cell.addView(android.widget.ImageView(ctx).apply { setImageDrawable(IconDrawable(Icon.FINGERPRINT, Theme.p.primaryDark, dp(30))) }, LayoutParams(dp(30), dp(30), Gravity.CENTER))
                            cell.ripple(dpf(34)); cell.onClick { biometric() }; cell.contentDescription = "Usar biometria"
                        }
                        "del" -> {
                            cell.addView(android.widget.ImageView(ctx).apply { setImageDrawable(IconDrawable(Icon.BACK, Theme.p.textSoft, dp(26))) }, LayoutParams(dp(26), dp(26), Gravity.CENTER))
                            cell.ripple(dpf(34)); cell.onClick { if (entered.isNotEmpty()) { entered = entered.dropLast(1); dots.invalidate() } }; cell.contentDescription = "Apagar"
                        }
                        else -> {
                            cell.background = rounded(Theme.p.surface, dpf(34))
                            cell.addView(TextView(ctx).apply { text = k; style(TextStyle.TITLE); gravity = Gravity.CENTER }, LayoutParams(MATCH, MATCH))
                            cell.foreground = android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(Theme.alpha(Theme.p.primaryDark, 0.15f)), null, rounded(0xFFFFFFFF.toInt(), dpf(34)))
                            cell.onClick { press(k) }
                        }
                    }
                    addView(cell)
                }
            }
        }
        if (sec.biometricEnabled) post { biometric() }
    }

    private fun press(k: String) {
        val wait = sec.lockoutRemaining()
        if (wait > 0) { msg.text = "Muitas tentativas. Aguarde ${wait / 1000 + 1} s."; return }
        if (entered.length >= sec.pinLength) return
        entered += k
        dots.invalidate()
        if (entered.length == sec.pinLength) tryPin()
    }

    private fun tryPin() {
        if (sec.check(entered)) { onUnlock(); return }
        run {
            msg.text = if (sec.lockoutRemaining() > 0) "Muitas tentativas. Aguarde ${sec.lockoutRemaining() / 1000 + 1} s." else "PIN incorreto. Tente de novo."
            msg.setTextColor(Theme.p.coral)
            dots.animate().translationX(dpf(12)).setDuration(60).withEndAction { dots.animate().translationX(-dpf(12)).setDuration(60).withEndAction { dots.animate().translationX(0f).setDuration(60).start() }.start() }.start()
            entered = ""; dots.invalidate()
        }
    }

    private fun biometric() {
        if (Build.VERSION.SDK_INT < 28 || !sec.biometricEnabled) return
        val exec = context.mainExecutor
        try {
            BiometricPrompt.Builder(context).setTitle("Desbloquear o Broto").setSubtitle("Use sua digital ou rosto")
                .setNegativeButton("Usar PIN", exec) { _, _ -> }
                .build()
                .authenticate(CancellationSignal(), exec, object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult?) { onUnlock() }
                })
        } catch (e: Exception) { msg.text = "Biometria indisponível. Use o PIN." }
    }
}
