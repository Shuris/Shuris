package com.shuris.depthwall

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.exp

/**
 * Converte o movimento do celular em um deslocamento em [-1, 1].
 *
 * Usa o giroscópio integrado com "vazamento": o ângulo volta suavemente ao centro,
 * então o efeito funciona em qualquer posição em que a pessoa segure o celular.
 * Sem giroscópio, usa o acelerômetro comparado a uma média lenta.
 */
class TiltSensor(context: Context) : SensorEventListener {
    private val sm = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val gyro: Sensor? = sm.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
    private val accel: Sensor? = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

    // Saída alvo, escrita pela thread do sensor e lida pela thread de renderização.
    @Volatile var targetX = 0f
        private set
    @Volatile var targetY = 0f
        private set

    private var angX = 0f
    private var angY = 0f
    private var lastTs = 0L

    private var baseX = 0f
    private var baseY = 0f
    private var hasBase = false

    private var running = false

    fun start() {
        if (running) return
        running = true
        lastTs = 0L
        hasBase = false
        val s = gyro ?: accel ?: return
        sm.registerListener(this, s, SensorManager.SENSOR_DELAY_GAME)
    }

    fun stop() {
        if (!running) return
        running = false
        sm.unregisterListener(this)
        targetX = 0f
        targetY = 0f
        angX = 0f
        angY = 0f
    }

    override fun onSensorChanged(e: SensorEvent) {
        when (e.sensor.type) {
            Sensor.TYPE_GYROSCOPE -> {
                if (lastTs != 0L) {
                    val dt = ((e.timestamp - lastTs) * 1e-9f).coerceIn(0f, 0.1f)
                    angX += e.values[1] * dt
                    angY += e.values[0] * dt
                    val decay = exp(-dt / RECENTER_SECONDS)
                    angX *= decay
                    angY *= decay
                    targetX = (angX / MAX_ANGLE_RAD).coerceIn(-1f, 1f)
                    targetY = (angY / MAX_ANGLE_RAD).coerceIn(-1f, 1f)
                }
                lastTs = e.timestamp
            }
            Sensor.TYPE_ACCELEROMETER -> {
                val gx = e.values[0] / SensorManager.GRAVITY_EARTH
                val gy = e.values[1] / SensorManager.GRAVITY_EARTH
                if (!hasBase) {
                    baseX = gx; baseY = gy; hasBase = true
                }
                baseX += (gx - baseX) * 0.02f
                baseY += (gy - baseY) * 0.02f
                targetX = (-(gx - baseX) / 0.3f).coerceIn(-1f, 1f)
                targetY = ((gy - baseY) / 0.3f).coerceIn(-1f, 1f)
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private companion object {
        const val MAX_ANGLE_RAD = 0.30f   // ~17° de inclinação = deslocamento máximo
        const val RECENTER_SECONDS = 2.0f
    }
}
