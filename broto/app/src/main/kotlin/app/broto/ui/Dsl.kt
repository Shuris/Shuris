package app.broto.ui

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

const val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
const val WRAP = ViewGroup.LayoutParams.WRAP_CONTENT

fun Context.dp(v: Number): Int = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()
fun Context.dpf(v: Number): Float = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics)
fun View.dp(v: Number): Int = context.dp(v)
fun View.dpf(v: Number): Float = context.dpf(v)

fun rounded(color: Int, radius: Float, strokeColor: Int = 0, strokeWidth: Int = 0): GradientDrawable = GradientDrawable().apply {
    setColor(color); cornerRadius = radius
    if (strokeWidth > 0) setStroke(strokeWidth, strokeColor)
}

fun View.ripple(radius: Float, base: Int? = null, mask: Boolean = true) {
    val content = base?.let { rounded(it, radius) }
    val m = if (mask) rounded(0xFFFFFFFF.toInt(), radius) else null
    background = RippleDrawable(ColorStateList.valueOf(Theme.alpha(Theme.p.primaryDark, 0.14f)), content, m)
}

fun View.onClick(f: (View) -> Unit): View { isClickable = true; setOnClickListener { f(it) }; return this }

/** Margens/peso em LinearLayout. */
fun <T : View> T.lp(w: Int = MATCH, h: Int = WRAP, weight: Float = 0f, l: Int = 0, t: Int = 0, r: Int = 0, b: Int = 0, gravity: Int = -1): T {
    val p = LinearLayout.LayoutParams(w, h, weight)
    p.setMargins(dp(l), dp(t), dp(r), dp(b))
    if (gravity != -1) p.gravity = gravity
    layoutParams = p
    return this
}

fun <T : View> T.flp(w: Int = MATCH, h: Int = WRAP, gravity: Int = Gravity.NO_GRAVITY, l: Int = 0, t: Int = 0, r: Int = 0, b: Int = 0): T {
    val p = FrameLayout.LayoutParams(w, h, gravity)
    p.setMargins(dp(l), dp(t), dp(r), dp(b))
    layoutParams = p
    return this
}

fun <T : View> T.pad(all: Int): T { val v = dp(all); setPadding(v, v, v, v); return this }
fun <T : View> T.pad(h: Int, v: Int): T { setPadding(dp(h), dp(v), dp(h), dp(v)); return this }
fun <T : View> T.pad(l: Int, t: Int, r: Int, b: Int): T { setPadding(dp(l), dp(t), dp(r), dp(b)); return this }

inline fun ViewGroup.vertical(block: LinearLayout.() -> Unit = {}): LinearLayout {
    val l = LinearLayout(context); l.orientation = LinearLayout.VERTICAL
    l.layoutParams = LinearLayout.LayoutParams(MATCH, WRAP)
    addView(l); l.block(); return l
}

inline fun ViewGroup.horizontal(block: LinearLayout.() -> Unit = {}): LinearLayout {
    val l = LinearLayout(context); l.orientation = LinearLayout.HORIZONTAL; l.gravity = Gravity.CENTER_VERTICAL
    l.layoutParams = LinearLayout.LayoutParams(MATCH, WRAP)
    addView(l); l.block(); return l
}

inline fun ViewGroup.frame(block: FrameLayout.() -> Unit = {}): FrameLayout {
    val l = FrameLayout(context); l.layoutParams = LinearLayout.LayoutParams(MATCH, WRAP)
    addView(l); l.block(); return l
}

fun Context.verticalLayout(block: LinearLayout.() -> Unit = {}): LinearLayout =
    LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; block() }

enum class TextStyle(val sizeSp: Float, val weight: Int) {
    DISPLAY(30f, 3), TITLE(22f, 3), HEADLINE(18f, 2), SUBTITLE(16f, 2), BODY(15f, 0), BODY_BOLD(15f, 1), LABEL(13f, 1), CAPTION(12f, 0), TINY(11f, 1)
}

fun face(weight: Int): Typeface = when (weight) { 0 -> Fonts.regular; 1 -> Fonts.semibold; 2 -> Fonts.bold; else -> Fonts.extrabold }

fun TextView.style(s: TextStyle, color: Int = Theme.p.text): TextView {
    setTextSize(TypedValue.COMPLEX_UNIT_SP, s.sizeSp); typeface = face(s.weight); setTextColor(color)
    includeFontPadding = false
    setLineSpacing(dpf(2), 1f)
    return this
}

fun ViewGroup.text(s: CharSequence, st: TextStyle = TextStyle.BODY, color: Int = Theme.p.text, block: TextView.() -> Unit = {}): TextView {
    val t = TextView(context)
    t.text = s; t.style(st, color)
    t.layoutParams = LinearLayout.LayoutParams(WRAP, WRAP)
    addView(t); t.block(); return t
}

fun TextView.ellipsize(lines: Int = 1): TextView { maxLines = lines; ellipsize = TextUtils.TruncateAt.END; return this }

fun ViewGroup.space(h: Int = 12, w: Int = 0): View {
    val v = View(context)
    v.layoutParams = LinearLayout.LayoutParams(if (w > 0) dp(w) else 0, if (h > 0) dp(h) else 1).apply { if (w == 0) width = MATCH }
    addView(v); return v
}

fun ViewGroup.flexSpace(): View { val v = View(context); v.layoutParams = LinearLayout.LayoutParams(0, 1, 1f); addView(v); return v }

fun ViewGroup.divider(): View {
    val v = View(context); v.setBackgroundColor(Theme.p.outline)
    v.layoutParams = LinearLayout.LayoutParams(MATCH, maxOf(1, dp(1) / 2 + 1)).apply { setMargins(0, dp(8), 0, dp(8)) }
    addView(v); return v
}

fun Context.scrollContainer(content: View, bg: Int = Theme.p.bg): ScrollView = ScrollView(this).apply {
    isFillViewport = true; setBackgroundColor(bg); overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
    isVerticalScrollBarEnabled = false
    addView(content, FrameLayout.LayoutParams(MATCH, WRAP))
}
