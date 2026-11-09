package com.shuris.depthwall

import android.annotation.SuppressLint
import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.ImageDecoder
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.opengl.GLSurfaceView
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.SeekBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import java.io.File
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {

    private lateinit var glView: GLSurfaceView
    private lateinit var status: TextView
    private lateinit var panel: LinearLayout
    private lateinit var pickButton: Button
    private lateinit var tilt: TiltSensor
    private lateinit var renderer: DepthRenderer
    private lateinit var estimator: DepthEstimator
    private val worker = Executors.newSingleThreadExecutor()

    private var settings = Scene.Settings()

    /** Controles que só fazem sentido quando há um efeito / relógio ativo. */
    private val effectControls = mutableListOf<View>()
    private val clockControls = mutableListOf<View>()

    private val pickPhoto = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) processPhoto(uri)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tilt = TiltSensor(this)
        renderer = DepthRenderer(applicationContext, tilt)
        estimator = DepthEstimator(applicationContext)
        settings = Scene.settings(this)

        glView = findViewById(R.id.glView)
        glView.setEGLContextClientVersion(2)
        glView.setRenderer(renderer)
        setupDragPreview()

        status = findViewById(R.id.status)
        if (Scene.hasScene(this)) status.visibility = View.GONE

        panel = findViewById(R.id.panel)
        buildPanel()

        findViewById<Button>(R.id.applyButton).setOnClickListener { applyWallpaper() }
    }

    private fun update(change: (Scene.Settings) -> Scene.Settings) {
        settings = change(settings)
        Scene.save(this, settings)
    }

    // ---------------------------------------------------------------- painel de ajustes

    private fun buildPanel() {
        pickButton = Button(this).apply {
            text = "Escolher foto"
            setOnClickListener {
                pickPhoto.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
            }
        }
        panel.addView(pickButton, matchWidth().apply { topMargin = dp(10) })

        section("Profundidade 3D")
        slider("Intensidade", settings.strength) { v -> update { it.copy(strength = v) } }
        slider("Ponto fixo (fundo ↔ frente)", settings.focus) { v -> update { it.copy(focus = v) } }
        toggle("Ver mapa de profundidade", false) { renderer.showDepth = it }

        section("Efeito entre as camadas")
        choices(listOf("Nenhum", "Neve", "Chuva", "Vaga-lumes", "Neblina"), settings.effect) { i ->
            update { it.copy(effect = i) }
            refreshEnabled()
        }
        effectControls += slider("Quantidade", settings.fxAmount) { v -> update { it.copy(fxAmount = v) } }
        effectControls += slider("Velocidade", settings.fxSpeed) { v -> update { it.copy(fxSpeed = v) } }
        effectControls += slider("Tamanho", settings.fxSize) { v -> update { it.copy(fxSize = v) } }

        section("Relógio")
        toggle("Mostrar relógio", settings.clockOn) { on ->
            update { it.copy(clockOn = on) }
            refreshEnabled()
        }
        clockControls += choices(ClockPainter.STYLE_NAMES, settings.clockStyle) { i ->
            update { it.copy(clockStyle = i) }
        }
        clockControls += colorRow(CLOCK_COLORS, settings.clockColor) { c -> update { it.copy(clockColor = c) } }
        clockControls += slider("Tamanho", settings.clockSize) { v -> update { it.copy(clockSize = v) } }
        clockControls += slider("Posição (cima ↔ baixo)", settings.clockY) { v -> update { it.copy(clockY = v) } }
        clockControls += slider("Profundidade (atrás de tudo ↔ na frente de tudo)", settings.clockDepth) { v ->
            update { it.copy(clockDepth = v) }
        }
        clockControls += toggle("Mostrar data", settings.clockDate) { on -> update { it.copy(clockDate = on) } }
        clockControls += toggle("Formato 24 horas", settings.clock24h) { on -> update { it.copy(clock24h = on) } }
        clockControls += toggle("Só na tela de bloqueio", settings.clockLockOnly) { on ->
            update { it.copy(clockLockOnly = on) }
        }
        clockControls += note(
            "Dica: deixe a profundidade um pouco abaixo do meio para a pessoa ou objeto da foto " +
                "passar na frente do relógio. Na tela de bloqueio o Android também mostra o relógio " +
                "do sistema; em alguns aparelhos dá para escolher um estilo menor nas configurações.",
        )

        refreshEnabled()
    }

    private fun refreshEnabled() {
        val fxOn = settings.effect != Effect.NONE
        effectControls.forEach { setEnabledDeep(it, fxOn) }
        clockControls.forEach { setEnabledDeep(it, settings.clockOn) }
    }

    private fun setEnabledDeep(v: View, enabled: Boolean) {
        v.alpha = if (enabled) 1f else 0.4f
        fun apply(view: View) {
            view.isEnabled = enabled
            if (view is ViewGroup) for (i in 0 until view.childCount) apply(view.getChildAt(i))
        }
        apply(v)
    }

    private fun section(title: String) {
        panel.addView(TextView(this).apply {
            text = title
            setTextColor(0xFFB9C3FF.toInt())
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        }, matchWidth().apply { topMargin = dp(18); bottomMargin = dp(2) })
    }

    private fun note(text: String): View {
        val tv = TextView(this).apply {
            this.text = text
            setTextColor(0x99FFFFFF.toInt())
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
        }
        panel.addView(tv, matchWidth().apply { topMargin = dp(4) })
        return tv
    }

    private fun slider(label: String, initial: Float, onChange: (Float) -> Unit): View {
        val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        box.addView(TextView(this).apply {
            text = label
            setTextColor(0xCCFFFFFF.toInt())
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
        })
        box.addView(SeekBar(this).apply {
            max = 100
            progress = (initial * 100).toInt()
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar, p: Int, fromUser: Boolean) {
                    if (fromUser) onChange(p / 100f)
                }
                override fun onStartTrackingTouch(seekBar: SeekBar) = Unit
                override fun onStopTrackingTouch(seekBar: SeekBar) = Unit
            })
        }, matchWidth())
        panel.addView(box, matchWidth().apply { topMargin = dp(6) })
        return box
    }

    private fun toggle(label: String, initial: Boolean, onChange: (Boolean) -> Unit): View {
        val cb = CheckBox(this).apply {
            text = label
            isChecked = initial
            setOnCheckedChangeListener { _, checked -> onChange(checked) }
        }
        panel.addView(cb, matchWidth())
        return cb
    }

    private fun choices(labels: List<String>, selected: Int, onSelect: (Int) -> Unit): View {
        val group = RadioGroup(this).apply { orientation = RadioGroup.HORIZONTAL }
        labels.forEachIndexed { i, label ->
            group.addView(RadioButton(this).apply {
                id = View.generateViewId()
                text = label
                tag = i
                setPadding(0, 0, dp(8), 0)
            })
        }
        group.getChildAt(selected.coerceIn(0, labels.size - 1))?.let { group.check(it.id) }
        group.setOnCheckedChangeListener { g, checkedId ->
            val idx = g.findViewById<View>(checkedId)?.tag as? Int ?: return@setOnCheckedChangeListener
            onSelect(idx)
        }
        val scroll = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            addView(group)
        }
        panel.addView(scroll, matchWidth())
        return scroll
    }

    private fun colorRow(colors: List<Int>, selected: Int, onSelect: (Int) -> Unit): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val swatches = mutableListOf<View>()
        fun paint(v: View, color: Int, isSelected: Boolean) {
            v.background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(color)
                setStroke(dp(if (isSelected) 3 else 1), if (isSelected) 0xFFB9C3FF.toInt() else 0x55FFFFFF)
            }
        }
        colors.forEach { color ->
            val v = View(this)
            paint(v, color, color == selected)
            v.setOnClickListener {
                if (!v.isEnabled) return@setOnClickListener
                swatches.forEachIndexed { i, sw -> paint(sw, colors[i], colors[i] == color) }
                onSelect(color)
            }
            swatches += v
            row.addView(v, LinearLayout.LayoutParams(dp(34), dp(34)).apply { marginEnd = dp(10) })
        }
        val scroll = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            addView(row)
        }
        panel.addView(scroll, matchWidth().apply { topMargin = dp(8); bottomMargin = dp(4) })
        return scroll
    }

    private fun matchWidth() = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT,
    )

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    // ---------------------------------------------------------------- prévia

    /** Arrastar o dedo na prévia simula a inclinação (útil em emulador). */
    @SuppressLint("ClickableViewAccessibility")
    private fun setupDragPreview() {
        var startX = 0f
        var startY = 0f
        glView.setOnTouchListener { v, e ->
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    startX = e.x; startY = e.y
                }
                MotionEvent.ACTION_MOVE -> {
                    renderer.extraX = ((e.x - startX) / v.width * 3f).coerceIn(-1f, 1f)
                    renderer.extraY = ((e.y - startY) / v.height * 3f).coerceIn(-1f, 1f)
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    renderer.extraX = 0f; renderer.extraY = 0f
                }
            }
            true
        }
    }

    // ---------------------------------------------------------------- foto + IA

    private fun processPhoto(uri: Uri) {
        pickButton.isEnabled = false
        showStatus("Carregando foto…")
        worker.execute {
            try {
                val bitmap = decode(uri)
                if (!estimator.isModelReady()) {
                    showStatus("Baixando modelo de IA (só na primeira vez)…")
                    estimator.ensureModel { pct -> showStatus("Baixando modelo de IA (só na primeira vez)… $pct%") }
                }
                showStatus("Calculando profundidade…")
                val depth = estimator.estimate(bitmap)

                writeAtomically(Scene.imageFile(this)) { bitmap.compress(Bitmap.CompressFormat.JPEG, 92, it) }
                writeAtomically(Scene.depthFile(this)) { depth.compress(Bitmap.CompressFormat.PNG, 100, it) }
                bitmap.recycle()
                depth.recycle()
                Scene.bumpVersion(this)

                runOnUiThread {
                    status.visibility = View.GONE
                    pickButton.isEnabled = true
                }
            } catch (t: Throwable) {
                showStatus("Erro: ${t.message ?: t.javaClass.simpleName}\nVerifique a internet e tente de novo.")
                runOnUiThread { pickButton.isEnabled = true }
            }
        }
    }

    private fun decode(uri: Uri): Bitmap {
        val source = ImageDecoder.createSource(contentResolver, uri)
        return ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
            val w = info.size.width
            val h = info.size.height
            val scale = minOf(1f, MAX_IMAGE_SIDE.toFloat() / maxOf(w, h))
            decoder.setTargetSize((w * scale).toInt().coerceAtLeast(1), (h * scale).toInt().coerceAtLeast(1))
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        }
    }

    private fun writeAtomically(target: File, write: (java.io.OutputStream) -> Unit) {
        val tmp = File(target.parentFile, target.name + ".tmp")
        tmp.outputStream().use(write)
        if (!tmp.renameTo(target)) throw java.io.IOException("Falha ao salvar ${target.name}")
    }

    private fun applyWallpaper() {
        if (!Scene.hasScene(this)) {
            Toast.makeText(this, "Escolha uma foto primeiro", Toast.LENGTH_SHORT).show()
            return
        }
        val intent = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER).putExtra(
            WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,
            ComponentName(this, DepthWallpaperService::class.java),
        )
        try {
            startActivity(intent)
        } catch (e: Exception) {
            try {
                startActivity(Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER))
            } catch (e2: Exception) {
                Toast.makeText(this, "Este aparelho não abriu o seletor de wallpaper animado", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun showStatus(text: String) = runOnUiThread {
        status.text = text
        status.visibility = View.VISIBLE
    }

    override fun onResume() {
        super.onResume()
        glView.onResume()
        tilt.start()
    }

    override fun onPause() {
        tilt.stop()
        glView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        worker.shutdown()
        super.onDestroy()
    }

    private companion object {
        const val MAX_IMAGE_SIDE = 2048
        val CLOCK_COLORS = listOf(
            Color.WHITE,
            0xFF111111.toInt(),
            0xFFFFE08A.toInt(), // amarelo suave
            0xFFFFB3C7.toInt(), // rosa
            0xFFA8E6FF.toInt(), // azul claro
            0xFFB8F5A0.toInt(), // verde claro
            0xFFFF8A4C.toInt(), // laranja
            0xFFC9A7FF.toInt(), // lilás
        )
    }
}
