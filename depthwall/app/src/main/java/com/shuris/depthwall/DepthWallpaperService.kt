package com.shuris.depthwall

import android.view.SurfaceHolder

class DepthWallpaperService : GLWallpaperService() {

    override fun onCreateEngine(): Engine = DepthEngine()

    inner class DepthEngine : GLEngine() {
        private lateinit var tilt: TiltSensor
        private lateinit var renderer: DepthRenderer

        override fun onCreate(surfaceHolder: SurfaceHolder) {
            super.onCreate(surfaceHolder)
            tilt = TiltSensor(this@DepthWallpaperService)
            renderer = DepthRenderer(applicationContext, tilt)
            setRenderer(renderer)
        }

        override fun onVisibilityChanged(visible: Boolean) {
            super.onVisibilityChanged(visible)
            if (visible) tilt.start() else tilt.stop()
        }

        // Launchers que rolam o wallpaper entre páginas: adiciona um leve parallax horizontal.
        override fun onOffsetsChanged(
            xOffset: Float, yOffset: Float,
            xOffsetStep: Float, yOffsetStep: Float,
            xPixelOffset: Int, yPixelOffset: Int,
        ) {
            renderer.extraX = (xOffset - 0.5f) * 0.8f
        }

        override fun onDestroy() {
            tilt.stop()
            super.onDestroy()
        }
    }
}
