package com.shuris.depthwall

import android.annotation.SuppressLint
import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import android.opengl.GLSurfaceView
import android.os.Bundle
import android.view.MotionEvent
import android.view.View
import android.widget.Button
import android.widget.CheckBox
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
    private lateinit var pickButton: Button
    private lateinit var tilt: TiltSensor
    private lateinit var renderer: DepthRenderer
    private lateinit var estimator: DepthEstimator
    private val worker = Executors.newSingleThreadExecutor()

    private val effectIds = mapOf(
        Effect.NONE to R.id.effectNone,
        Effect.SNOW to R.id.effectSnow,
        Effect.RAIN to R.id.effectRain,
        Effect.FIREFLIES to R.id.effectFireflies,
        Effect.FOG to R.id.effectFog,
    )

    private val pickPhoto = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) processPhoto(uri)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tilt = TiltSensor(this)
        renderer = DepthRenderer(applicationContext, tilt)
        estimator = DepthEstimator(applicationContext)

        glView = findViewById(R.id.glView)
        glView.setEGLContextClientVersion(2)
        glView.setRenderer(renderer)
        setupDragPreview()

        status = findViewById(R.id.status)
        if (Scene.hasScene(this)) status.visibility = View.GONE

        pickButton = findViewById(R.id.pickButton)
        pickButton.setOnClickListener {
            pickPhoto.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        }

        val current = Scene.settings(this)
        val strength = findViewById<SeekBar>(R.id.strength)
        val focus = findViewById<SeekBar>(R.id.focus)
        val effects = findViewById<RadioGroup>(R.id.effectGroup)
        strength.progress = (current.strength * 100).toInt()
        focus.progress = (current.focus * 100).toInt()
        effects.check(effectIds[current.effect] ?: R.id.effectNone)

        fun saveSettings() {
            val effect = effectIds.entries.firstOrNull { it.value == effects.checkedRadioButtonId }?.key ?: Effect.NONE
            Scene.save(this, Scene.Settings(strength.progress / 100f, focus.progress / 100f, effect))
        }
        val seekListener = object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar, progress: Int, fromUser: Boolean) {
                if (fromUser) saveSettings()
            }
            override fun onStartTrackingTouch(seekBar: SeekBar) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar) = Unit
        }
        strength.setOnSeekBarChangeListener(seekListener)
        focus.setOnSeekBarChangeListener(seekListener)
        effects.setOnCheckedChangeListener { _, _ -> saveSettings() }

        findViewById<CheckBox>(R.id.showDepth).setOnCheckedChangeListener { _, checked ->
            renderer.showDepth = checked
        }
        findViewById<Button>(R.id.applyButton).setOnClickListener { applyWallpaper() }
    }

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
    }
}
