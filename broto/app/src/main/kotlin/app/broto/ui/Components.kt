package app.broto.ui

import android.animation.ValueAnimator
import android.app.Dialog
import android.content.Context
import android.graphics.*
import android.graphics.drawable.ColorDrawable
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.*

// ----------------------------------------------------------------- Cartões e containers
fun ViewGroup.card(color: Int = Theme.p.surface, radius: Int = 26, padding: Int = 18, block: LinearLayout.() -> Unit): LinearLayout {
    val l = LinearLayout(context); l.orientation = LinearLayout.VERTICAL
    l.background = rounded(color, dpf(radius))
    l.elevation = if (Theme.p.dark) 0f else dpf(0.5f)
    l.pad(padding)
    l.layoutParams = LinearLayout.LayoutParams(MATCH, WRAP).apply { setMargins(0, 0, 0, dp(14)) }
    addView(l); l.block(); return l
}

fun LinearLayout.clickable(f: (View) -> Unit): LinearLayout {
    val bg = background
    val c = (bg as? android.graphics.drawable.GradientDrawable)?.color?.defaultColor
    if (c != null) ripple(dpf(26), c)
    onClick(f); return this
}

/** Cabeçalho de seção com ação opcional à direita. */
fun ViewGroup.section(title: String, action: String? = null, onAction: (() -> Unit)? = null) {
    horizontal {
        lp(MATCH, WRAP, t = 8, b = 10)
        text(title, TextStyle.HEADLINE).lp(0, WRAP, 1f)
        if (action != null) text(action, TextStyle.LABEL, Theme.p.primaryDark) { pad(8, 4); ripple(dpf(12)); onClick { onAction?.invoke() } }
    }
}

// ----------------------------------------------------------------- Botões
fun ViewGroup.primaryButton(label: String, icon: Icon? = null, color: Int = Theme.p.primaryDark, textColor: Int = 0xFFFFFFFF.toInt(), onClickF: () -> Unit): LinearLayout {
    val b = LinearLayout(context); b.orientation = LinearLayout.HORIZONTAL; b.gravity = Gravity.CENTER
    b.minimumHeight = dp(52); b.pad(20, 12)
    b.ripple(dpf(26), color)
    if (icon != null) { b.icon(icon, textColor, 20).lp(dp(20), dp(20), r = 8) }
    b.text(label, TextStyle.BODY_BOLD, textColor)
    b.layoutParams = LinearLayout.LayoutParams(MATCH, WRAP).apply { setMargins(0, dp(6), 0, dp(6)) }
    b.onClick { onClickF() }
    addView(b); return b
}

fun ViewGroup.softButton(label: String, icon: Icon? = null, color: Int = Theme.p.primarySoft, textColor: Int = Theme.p.deep, onClickF: () -> Unit): LinearLayout =
    primaryButton(label, icon, color, textColor, onClickF)

fun ViewGroup.ghostButton(label: String, color: Int = Theme.p.primaryDark, onClickF: () -> Unit): TextView =
    text(label, TextStyle.BODY_BOLD, color) {
        gravity = Gravity.CENTER; minHeight = dp(46); pad(16, 10); ripple(dpf(22))
        layoutParams = LinearLayout.LayoutParams(MATCH, WRAP)
        onClick { onClickF() }
    }

fun ViewGroup.iconButton(icon: Icon, tint: Int = Theme.p.text, bg: Int? = null, sizeDp: Int = 44, iconDp: Int = 22, onClickF: () -> Unit): FrameLayout {
    val f = FrameLayout(context)
    f.layoutParams = LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp))
    if (bg != null) f.ripple(dpf(sizeDp / 2f), bg) else f.ripple(dpf(sizeDp / 2f))
    val iv = ImageView(context); iv.setImageDrawable(IconDrawable(icon, tint, dp(iconDp)))
    f.addView(iv, FrameLayout.LayoutParams(dp(iconDp), dp(iconDp), Gravity.CENTER))
    f.onClick { onClickF() }
    f.contentDescription = icon.name
    addView(f); return f
}

// ----------------------------------------------------------------- Chips
class Chip(context: Context, label: String, selected: Boolean, private val accent: Int = Theme.p.primaryDark) : TextView(context) {
    var selectedState = selected
        set(v) { field = v; refresh() }
    init {
        text = label; style(TextStyle.LABEL); gravity = Gravity.CENTER
        pad(14, 9); minHeight = dp(36)
        refresh()
    }
    private fun refresh() {
        background = if (selectedState) rounded(Theme.blend(Theme.p.surface, accent, 0.18f), dpf(18), accent, dp(1))
        else rounded(Theme.p.surface, dpf(18), Theme.p.outline, dp(1))
        setTextColor(if (selectedState) Theme.deepen(accent, 0.25f).let { if (Theme.p.dark) Theme.p.text else it } else Theme.p.textSoft)
    }
}

/** Grupo de chips que quebra linha automaticamente. */
class FlowLayout(context: Context, private val hGap: Int = 8, private val vGap: Int = 8) : ViewGroup(context) {
    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val maxW = MeasureSpec.getSize(widthMeasureSpec) - paddingLeft - paddingRight
        var x = 0; var y = 0; var rowH = 0
        val hg = context.dp(hGap); val vg = context.dp(vGap)
        for (i in 0 until childCount) {
            val c = getChildAt(i)
            if (c.visibility == GONE) continue
            c.measure(MeasureSpec.makeMeasureSpec(maxW, MeasureSpec.AT_MOST), MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED))
            if (x > 0 && x + c.measuredWidth > maxW) { x = 0; y += rowH + vg; rowH = 0 }
            x += c.measuredWidth + hg
            rowH = maxOf(rowH, c.measuredHeight)
        }
        setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), y + rowH + paddingTop + paddingBottom)
    }
    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        val maxW = r - l - paddingLeft - paddingRight
        var x = 0; var y = 0; var rowH = 0
        val hg = context.dp(hGap); val vg = context.dp(vGap)
        for (i in 0 until childCount) {
            val c = getChildAt(i)
            if (c.visibility == GONE) continue
            if (x > 0 && x + c.measuredWidth > maxW) { x = 0; y += rowH + vg; rowH = 0 }
            c.layout(paddingLeft + x, paddingTop + y, paddingLeft + x + c.measuredWidth, paddingTop + y + c.measuredHeight)
            x += c.measuredWidth + hg
            rowH = maxOf(rowH, c.measuredHeight)
        }
    }
}

fun ViewGroup.flow(hGap: Int = 8, vGap: Int = 8, block: FlowLayout.() -> Unit): FlowLayout {
    val f = FlowLayout(context, hGap, vGap); f.layoutParams = LinearLayout.LayoutParams(MATCH, WRAP)
    addView(f); f.block(); return f
}

/** Chips de escolha única. */
fun <T> ViewGroup.choiceChips(options: List<T>, selected: T?, label: (T) -> String, onSelect: (T) -> Unit): FlowLayout {
    val chips = ArrayList<Chip>()
    return flow {
        for (o in options) {
            val c = Chip(context, label(o), o == selected)
            c.onClick { chips.forEach { it.selectedState = false }; c.selectedState = true; onSelect(o) }
            chips.add(c); addView(c)
        }
    }
}

/** Chips de múltipla escolha. */
fun <T> ViewGroup.multiChips(options: List<T>, selected: Set<T>, label: (T) -> String, onChange: (Set<T>) -> Unit): FlowLayout {
    val sel = LinkedHashSet(selected)
    return flow {
        for (o in options) {
            val c = Chip(context, label(o), o in sel)
            c.onClick { if (o in sel) sel.remove(o) else sel.add(o); c.selectedState = o in sel; onChange(LinkedHashSet(sel)) }
            addView(c)
        }
    }
}

/** Controle segmentado (2 a 4 opções). */
fun <T> ViewGroup.segmented(options: List<T>, selected: T, label: (T) -> String, onSelect: (T) -> Unit): LinearLayout {
    val views = ArrayList<TextView>()
    return horizontal {
        background = rounded(Theme.p.surfaceAlt, dpf(22)); pad(4)
        fun paint() {}
        for (o in options) {
            val t = text(label(o), TextStyle.LABEL, Theme.p.textSoft) {
                gravity = Gravity.CENTER; minHeight = dp(38); pad(8, 8)
                layoutParams = LinearLayout.LayoutParams(0, WRAP, 1f)
            }
            views.add(t)
        }
        fun select(i: Int) {
            views.forEachIndexed { j, v ->
                v.background = if (i == j) rounded(Theme.p.surface, dpf(18)) else null
                v.setTextColor(if (i == j) Theme.p.text else Theme.p.textSoft)
                v.elevation = if (i == j && !Theme.p.dark) dpf(1) else 0f
            }
        }
        views.forEachIndexed { i, v -> v.onClick { select(i); onSelect(options[i]) } }
        select(options.indexOf(selected).coerceAtLeast(0))
    }
}

// ----------------------------------------------------------------- Progresso
class ProgressBarView(context: Context, var progress: Float, var color: Int = Theme.p.primary, var track: Int = Theme.p.surfaceAlt) : View(context) {
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    private var shown = if (Motion.entrance) 0f else progress.coerceIn(0f, 1f)
    init { if (Motion.entrance) { Motion.started++; animateTo(progress) } }
    fun animateTo(v: Float) {
        progress = v.coerceIn(0f, 1f)
        ValueAnimator.ofFloat(shown, progress).apply { duration = 600; interpolator = DecelerateInterpolator(); addUpdateListener { shown = it.animatedValue as Float; invalidate() }; start() }
    }
    override fun onDraw(c: Canvas) {
        val r = height / 2f
        p.color = track; c.drawRoundRect(0f, 0f, width.toFloat(), height.toFloat(), r, r, p)
        if (shown > 0f) { p.color = color; c.drawRoundRect(0f, 0f, maxOf(height.toFloat(), width * shown), height.toFloat(), r, r, p) }
    }
}

fun ViewGroup.progressBar(progress: Float, color: Int = Theme.p.primary, heightDp: Int = 10, track: Int = Theme.p.surfaceAlt): ProgressBarView {
    val v = ProgressBarView(context, progress, color, track)
    v.layoutParams = LinearLayout.LayoutParams(MATCH, dp(heightDp))
    addView(v); return v
}

/** Anel de progresso com texto central opcional. */
class RingView(context: Context, var progress: Float, var color: Int = Theme.p.primary, var track: Int = Theme.p.surfaceAlt, var strokeDp: Float = 10f) : View(context) {
    private val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private val tp = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER }
    var centerText: String? = null
    var subText: String? = null
    var centerTextSp = 30f
    private var shown = if (Motion.entrance) 0f else progress.coerceIn(0f, 1f)
    init { if (Motion.entrance) { Motion.started++; animateTo(progress) } }
    fun animateTo(v: Float) {
        progress = v.coerceIn(0f, 1f)
        ValueAnimator.ofFloat(shown, progress).apply { duration = 900; interpolator = DecelerateInterpolator(1.6f); addUpdateListener { shown = it.animatedValue as Float; invalidate() }; start() }
    }
    override fun onDraw(c: Canvas) {
        val sw = dpf(strokeDp); p.strokeWidth = sw
        val sz = minOf(width, height) - sw
        val r = RectF((width - sz) / 2f, (height - sz) / 2f, (width + sz) / 2f, (height + sz) / 2f)
        p.color = track; c.drawArc(r, 0f, 360f, false, p)
        if (shown > 0.001f) { p.color = color; c.drawArc(r, -90f, 360f * shown, false, p) }
        val ct = centerText ?: return
        tp.typeface = Fonts.extrabold; tp.color = Theme.p.text
        tp.textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, centerTextSp, resources.displayMetrics)
        val cy = height / 2f + (if (subText != null) 0f else tp.textSize * 0.35f)
        c.drawText(ct, width / 2f, cy, tp)
        subText?.let {
            tp.typeface = Fonts.semibold; tp.color = Theme.p.textSoft
            tp.textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 11f, resources.displayMetrics)
            c.drawText(it, width / 2f, cy + tp.textSize * 1.7f, tp)
        }
    }
}

// ----------------------------------------------------------------- Bolha de emoji
fun ViewGroup.emojiBubble(emoji: String, color: Int, sizeDp: Int = 46): TextView =
    text(emoji, TextStyle.BODY) {
        setTextSize(TypedValue.COMPLEX_UNIT_PX, dpf(sizeDp * 0.48f)); gravity = Gravity.CENTER
        background = rounded(Theme.blend(Theme.p.surface, color, if (Theme.p.dark) 0.35f else 0.45f), dpf(sizeDp * 0.36f))
        layoutParams = LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp))
    }

// ----------------------------------------------------------------- Interruptor
class Toggle(context: Context, on: Boolean, private val onChange: (Boolean) -> Unit) : View(context) {
    var on = on; private set
    private var pos = if (on) 1f else 0f
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    init {
        layoutParams = LinearLayout.LayoutParams(dp(50), dp(30))
        setOnClickListener { set(!this.on, true) }
    }
    fun set(v: Boolean, notify: Boolean) {
        on = v
        ValueAnimator.ofFloat(pos, if (v) 1f else 0f).apply { duration = 180; addUpdateListener { pos = it.animatedValue as Float; invalidate() }; start() }
        if (notify) onChange(v)
    }
    override fun onDraw(c: Canvas) {
        val h = height.toFloat(); val w = width.toFloat()
        p.color = Theme.blend(Theme.p.outline, Theme.p.primaryDark, pos)
        c.drawRoundRect(0f, 0f, w, h, h / 2, h / 2, p)
        p.color = 0xFFFFFFFF.toInt()
        val r = h / 2 - dpf(3)
        c.drawCircle(h / 2 + (w - h) * pos, h / 2, r, p)
    }
}

/** Linha de configuração com título, descrição e controle à direita. */
fun ViewGroup.settingRow(title: String, subtitle: String? = null, icon: Icon? = null, right: (LinearLayout.() -> Unit)? = null, onClickF: (() -> Unit)? = null): LinearLayout =
    horizontal {
        pad(4, 10); minimumHeight = dp(56)
        if (icon != null) {
            frame { lp(dp(38), dp(38), r = 12); background = rounded(Theme.p.surfaceAlt, dpf(12))
                val iv = ImageView(context); iv.setImageDrawable(IconDrawable(icon, Theme.p.primaryDark, dp(20))); addView(iv, android.widget.FrameLayout.LayoutParams(dp(20), dp(20), Gravity.CENTER)) }
        }
        vertical {
            lp(0, WRAP, 1f)
            text(title, TextStyle.BODY_BOLD)
            if (subtitle != null) text(subtitle, TextStyle.CAPTION, Theme.p.textSoft).lp(WRAP, WRAP, t = 2)
        }
        right?.invoke(this)
        if (onClickF != null) { ripple(dpf(14)); onClick { onClickF() } }
    }

// ----------------------------------------------------------------- Campos de texto
fun ViewGroup.field(hint: String, value: String = "", multiline: Boolean = false, numeric: Boolean = false, minLines: Int = 1): EditText {
    val e = EditText(context)
    e.hint = hint; e.setText(value); e.style(TextStyle.BODY)
    e.setHintTextColor(Theme.p.textFaint)
    e.background = rounded(if (Theme.p.dark) Theme.p.surfaceAlt else Theme.blend(Theme.p.bg, Theme.p.surfaceAlt, 0.35f), dpf(16), Theme.p.outline, if (Theme.p.dark) 0 else 1)
    e.pad(16, 14)
    e.inputType = when {
        numeric -> InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
        multiline -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
        else -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
    }
    if (multiline) { e.minLines = minLines; e.gravity = Gravity.TOP or Gravity.START; e.isSingleLine = false } else e.isSingleLine = true
    e.layoutParams = LinearLayout.LayoutParams(MATCH, WRAP).apply { setMargins(0, dp(4), 0, dp(10)) }
    addView(e); return e
}

fun ViewGroup.fieldLabel(s: String) = text(s, TextStyle.LABEL, Theme.p.textSoft).lp(WRAP, WRAP, t = 6, b = 4)

/** Seletor numérico com − e +. */
class Stepper(context: Context, initial: Double, private val step: Double, private val min: Double = 0.0, private val onChange: (Double) -> Unit) : LinearLayout(context) {
    var value = initial; private set
    private val label: TextView
    init {
        orientation = HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
        iconButton(Icon.MINUS, Theme.p.deep, Theme.p.primarySoft, 44, 20) { set(value - step) }
        label = text(Fmt.num(value), TextStyle.TITLE) { gravity = Gravity.CENTER; minWidth = dp(70) }
        iconButton(Icon.PLUS, Theme.p.deep, Theme.p.primarySoft, 44, 20) { set(value + step) }
    }
    fun set(v: Double) { value = maxOf(min, Math.round(v * 100) / 100.0); label.text = Fmt.num(value); onChange(value) }
}

// ----------------------------------------------------------------- Bottom sheet
open class BottomSheet(protected val ctx: Context) : Dialog(ctx) {
    val content: LinearLayout
    private val scroll: ScrollView
    init {
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        content = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL; pad(22, 10, 22, 22) }
        val handle = View(ctx).apply { background = rounded(Theme.p.outline, ctx.dpf(3)) }
        val root = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(Theme.p.bg); cornerRadii = floatArrayOf(ctx.dpf(30), ctx.dpf(30), ctx.dpf(30), ctx.dpf(30), 0f, 0f, 0f, 0f)
            }
            addView(handle, LinearLayout.LayoutParams(ctx.dp(40), ctx.dp(5)).apply { gravity = Gravity.CENTER_HORIZONTAL; topMargin = ctx.dp(10) })
        }
        scroll = ScrollView(ctx).apply { isVerticalScrollBarEnabled = false; addView(content) }
        root.addView(scroll, LinearLayout.LayoutParams(MATCH, WRAP))
        setContentView(root)
        window?.apply {
            setBackgroundDrawable(ColorDrawable(0))
            setLayout(MATCH, WRAP)
            setGravity(Gravity.BOTTOM)
            setWindowAnimations(android.R.style.Animation_InputMethod)
            setDimAmount(0.35f)
            addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
            setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        }
        val maxH = (ctx.resources.displayMetrics.heightPixels * 0.9f).toInt()
        scroll.viewTreeObserver.addOnGlobalLayoutListener {
            if (scroll.height > maxH) scroll.layoutParams = scroll.layoutParams.apply { height = maxH }
        }
    }

    fun title(t: String, sub: String? = null) {
        content.text(t, TextStyle.TITLE).lp(WRAP, WRAP, t = 10, b = if (sub == null) 14 else 4)
        if (sub != null) content.text(sub, TextStyle.BODY, Theme.p.textSoft).lp(MATCH, WRAP, b = 14)
    }
}

/** Diálogo de confirmação no estilo do app. */
fun confirm(ctx: Context, title: String, message: String, yes: String = "Confirmar", danger: Boolean = false, onYes: () -> Unit) {
    val s = BottomSheet(ctx)
    s.title(title, message)
    s.content.primaryButton(yes, color = if (danger) Theme.p.coral else Theme.p.primaryDark) { s.dismiss(); onYes() }
    s.content.ghostButton("Cancelar", Theme.p.textSoft) { s.dismiss() }
    s.show()
}

/** Lista de opções em bottom sheet. */
fun options(ctx: Context, title: String, items: List<Triple<Icon, String, () -> Unit>>) {
    val s = BottomSheet(ctx)
    s.title(title)
    for ((ic, label, action) in items) {
        s.content.settingRow(label, icon = ic) { }.onClick { s.dismiss(); action() }
    }
    s.show()
}

// ----------------------------------------------------------------- Estado vazio
fun ViewGroup.emptyState(title: String, message: String, moodLevel: Int = 3, action: String? = null, onAction: (() -> Unit)? = null) {
    vertical {
        gravity = Gravity.CENTER_HORIZONTAL; pad(24, 28)
        val iv = ImageView(context); iv.setImageDrawable(MoodFaceDrawable(moodLevel, dp(84))); addView(iv, LinearLayout.LayoutParams(dp(84), dp(84)))
        text(title, TextStyle.HEADLINE) { gravity = Gravity.CENTER }.lp(WRAP, WRAP, t = 14)
        text(message, TextStyle.BODY, Theme.p.textSoft) { gravity = Gravity.CENTER }.lp(WRAP, WRAP, t = 6, b = 12)
        if (action != null) softButton(action) { onAction?.invoke() }.lp(WRAP, WRAP)
    }
}

/** Animação de entrada suave para listas de cartões. */
fun View.enter(delay: Long = 0) {
    if (!Motion.entrance) { alpha = 1f; translationY = 0f; return }
    Motion.started++
    alpha = 0f; translationY = dpf(14)
    animate().alpha(1f).translationY(0f).setStartDelay(delay).setDuration(320).setInterpolator(DecelerateInterpolator()).start()
}

fun View.pop() {
    animate().cancel(); scaleX = 1f; scaleY = 1f
    animate().scaleX(1.15f).scaleY(1.15f).setDuration(110).withEndAction {
        animate().scaleX(1f).scaleY(1f).setDuration(260).setInterpolator(OvershootInterpolator(3f)).start()
    }.start()
}

/** View que desenha algo arbitrário (usada para ilustrações). */
class DrawView(context: Context, private val painter: (Canvas, Int, Int) -> Unit) : View(context) {
    override fun onDraw(canvas: Canvas) = painter(canvas, width, height)
}

fun ViewGroup.drawing(wDp: Int, hDp: Int, painter: (Canvas, Int, Int) -> Unit): DrawView {
    val v = DrawView(context, painter)
    v.layoutParams = LinearLayout.LayoutParams(if (wDp < 0) MATCH else dp(wDp), dp(hDp))
    addView(v); return v
}
