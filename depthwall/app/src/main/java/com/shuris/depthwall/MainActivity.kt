package com.shuris.depthwall

import android.annotation.SuppressLint
import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import android.opengl.GLSurfaceView
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.GestureDetector
import android.view.Gravity
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.FrameLayout
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

    /** Controles que só fazem sentido quando há um efeito ativo. */
    private val effectControls = mutableListOf<View>()

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
        setupFramingGestures()
        matchPreviewToScreen()

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

        section("Enquadramento")
        note("Na prévia: pince para aumentar ou diminuir a foto, arraste para mover e toque duas vezes para voltar ao padrão.")
        panel.addView(Button(this).apply {
            text = "Redefinir enquadramento"
            setOnClickListener { update { it.copy(zoom = 1f, panX = 0f, panY = 0f) } }
        }, matchWidth().apply { topMargin = dp(6) })

        refreshEnabled()
    }

    private fun refreshEnabled() {
        val fxOn = settings.effect != Effect.NONE
        effectControls.forEach { setEnabledDeep(it, fxOn) }
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

    private fun matchWidth() = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT,
    )

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    // ---------------------------------------------------------------- prévia

    /** Pinçar = zoom, arrastar = mover a foto, toque duplo = voltar ao padrão. */
    @SuppressLint("ClickableViewAccessibility")
    private fun setupFramingGestures() {
        val scaleDetector = ScaleGestureDetector(this, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
            override fun onScale(d: ScaleGestureDetector): Boolean {
                update { it.copy(zoom = (it.zoom * d.scaleFactor).coerceIn(Scene.MIN_ZOOM, Scene.MAX_ZOOM)) }
                return true
            }
        })
        val gestureDetector = GestureDetector(this, object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent) = true

            override fun onScroll(e1: MotionEvent?, e2: MotionEvent, dx: Float, dy: Float): Boolean {
                // Converte pixels da prévia em coordenadas da foto (o dedo "segura" a foto).
                val fx = renderer.visibleFractionX
                val fy = renderer.visibleFractionY
                update {
                    it.copy(
                        panX = DepthRenderer.clampPan(it.panX + dx / glView.width * fx, fx),
                        panY = DepthRenderer.clampPan(it.panY + dy / glView.height * fy, fy),
                    )
                }
                return true
            }

            override fun onDoubleTap(e: MotionEvent): Boolean {
                update { it.copy(zoom = 1f, panX = 0f, panY = 0f) }
                return true
            }
        })
        glView.setOnTouchListener { _, e ->
            scaleDetector.onTouchEvent(e)
            if (!scaleDetector.isInProgress) gestureDetector.onTouchEvent(e)
            true
        }
    }

    /** Deixa a prévia com a mesma proporção da tela do celular: o que você enquadra é o que aparece. */
    private fun matchPreviewToScreen() {
        val frame = glView.parent as View
        frame.post {
            val (sw, sh) = screenSize()
            val screenAspect = sw.toFloat() / sh
            var h = frame.height
            var w = (h * screenAspect).toInt()
            if (w > frame.width) {
                w = frame.width
                h = (w / screenAspect).toInt()
            }
            glView.layoutParams = FrameLayout.LayoutParams(w, h, Gravity.CENTER)
        }
    }

    private fun screenSize(): Pair<Int, Int> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val b = windowManager.currentWindowMetrics.bounds
            b.width() to b.height()
        } else {
            val m = android.util.DisplayMetrics()
            @Suppress("DEPRECATION")
            windowManager.defaultDisplay.getRealMetrics(m)
            m.widthPixels to m.heightPixels
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
                val result = estimator.estimate(bitmap) { step -> showStatus(step) }

                writeAtomically(Scene.imageFile(this)) { bitmap.compress(Bitmap.CompressFormat.JPEG, 92, it) }
                writeAtomically(Scene.depthFile(this)) { result.depth.compress(Bitmap.CompressFormat.PNG, 100, it) }
                writeAtomically(Scene.bgColorFile(this)) { result.bgColor.compress(Bitmap.CompressFormat.JPEG, 90, it) }
                writeAtomically(Scene.bgDepthFile(this)) { result.bgDepth.compress(Bitmap.CompressFormat.PNG, 100, it) }
                bitmap.recycle()
                result.depth.recycle()
                result.bgColor.recycle()
                result.bgDepth.recycle()
                // Foto nova começa com o enquadramento padrão.
                update { it.copy(zoom = 1f, panX = 0f, panY = 0f) }
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
    }
}
