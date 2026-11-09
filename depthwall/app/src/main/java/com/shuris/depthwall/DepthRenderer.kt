package com.shuris.depthwall

import android.content.Context
import android.graphics.BitmapFactory
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.opengl.GLUtils
import android.os.SystemClock
import android.util.Log
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

/**
 * Desenha a foto deslocando cada pixel de acordo com sua profundidade (parallax por mapa
 * de profundidade). Usado tanto na prévia do app quanto no wallpaper.
 */
class DepthRenderer(
    private val ctx: Context,
    private val tilt: TiltSensor,
) : GLSurfaceView.Renderer {

    /** Deslocamento extra (arrastar na prévia / rolagem de páginas do launcher), em [-1, 1]. */
    @Volatile var extraX = 0f
    @Volatile var extraY = 0f
    @Volatile var showDepth = false

    private var program = 0
    private var imageTex = 0
    private var depthTex = 0
    private var hasScene = false
    private var loadedVersion = Long.MIN_VALUE
    private var imgAspect = 1f
    private var viewW = 1
    private var viewH = 1

    private var offX = 0f
    private var offY = 0f

    private var uImage = 0
    private var uDepth = 0
    private var uScale = 0
    private var uShift = 0
    private var uShiftS = 0
    private var uFocus = 0
    private var uTime = 0
    private var uAspect = 0
    private var uEffect = 0
    private var uShowDepth = 0
    private var aPos = 0

    private val quad: FloatBuffer = ByteBuffer.allocateDirect(8 * 4)
        .order(ByteOrder.nativeOrder()).asFloatBuffer()
        .apply { put(floatArrayOf(-1f, -1f, 1f, -1f, -1f, 1f, 1f, 1f)); position(0) }

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        // Contexto novo: texturas antigas não existem mais.
        imageTex = 0
        depthTex = 0
        hasScene = false
        loadedVersion = Long.MIN_VALUE

        program = buildProgram(VERTEX_SHADER, FRAGMENT_SHADER)
        aPos = GLES20.glGetAttribLocation(program, "aPos")
        uImage = GLES20.glGetUniformLocation(program, "uImage")
        uDepth = GLES20.glGetUniformLocation(program, "uDepth")
        uScale = GLES20.glGetUniformLocation(program, "uScale")
        uShift = GLES20.glGetUniformLocation(program, "uShift")
        uShiftS = GLES20.glGetUniformLocation(program, "uShiftS")
        uFocus = GLES20.glGetUniformLocation(program, "uFocus")
        uTime = GLES20.glGetUniformLocation(program, "uTime")
        uAspect = GLES20.glGetUniformLocation(program, "uAspect")
        uEffect = GLES20.glGetUniformLocation(program, "uEffect")
        uShowDepth = GLES20.glGetUniformLocation(program, "uShowDepth")
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        viewW = maxOf(1, width)
        viewH = maxOf(1, height)
        GLES20.glViewport(0, 0, viewW, viewH)
    }

    override fun onDrawFrame(gl: GL10?) {
        val version = Scene.version(ctx)
        if (version != loadedVersion) {
            loadedVersion = version
            loadTextures()
        }

        GLES20.glClearColor(0.063f, 0.067f, 0.078f, 1f)
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)
        if (!hasScene || program == 0) return

        val s = Scene.settings(ctx)

        // Suaviza o movimento para não tremer.
        val tx = (tilt.targetX + extraX).coerceIn(-1.2f, 1.2f)
        val ty = (tilt.targetY + extraY).coerceIn(-1.2f, 1.2f)
        offX += (tx - offX) * 0.12f
        offY += (ty - offY) * 0.12f

        // "Cover": preenche a tela cortando a foto, com um zoom extra que esconde as bordas.
        val viewAspect = viewW.toFloat() / viewH
        var sx = 1f
        var sy = 1f
        if (imgAspect > viewAspect) sx = viewAspect / imgAspect else sy = imgAspect / viewAspect
        val zoom = 1f / (1f + 0.12f * s.strength)
        sx *= zoom
        sy *= zoom

        val shiftAmount = 0.05f * s.strength
        val shiftX = offX * shiftAmount
        val shiftY = offY * shiftAmount

        GLES20.glUseProgram(program)
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, imageTex)
        GLES20.glUniform1i(uImage, 0)
        GLES20.glActiveTexture(GLES20.GL_TEXTURE1)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, depthTex)
        GLES20.glUniform1i(uDepth, 1)

        GLES20.glUniform2f(uScale, sx, sy)
        GLES20.glUniform2f(uShift, shiftX, shiftY)
        // Mesmo deslocamento convertido para o espaço da tela (usado pelas partículas).
        GLES20.glUniform2f(uShiftS, shiftX / sx * viewAspect, shiftY / sy)
        GLES20.glUniform1f(uFocus, s.focus)
        GLES20.glUniform1f(uTime, (SystemClock.elapsedRealtime() % 3_600_000L) / 1000f)
        GLES20.glUniform1f(uAspect, viewAspect)
        GLES20.glUniform1i(uEffect, s.effect)
        GLES20.glUniform1i(uShowDepth, if (showDepth) 1 else 0)

        quad.position(0)
        GLES20.glEnableVertexAttribArray(aPos)
        GLES20.glVertexAttribPointer(aPos, 2, GLES20.GL_FLOAT, false, 0, quad)
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
        GLES20.glDisableVertexAttribArray(aPos)
    }

    private fun loadTextures() {
        if (imageTex != 0) GLES20.glDeleteTextures(2, intArrayOf(imageTex, depthTex), 0)
        imageTex = 0
        depthTex = 0
        hasScene = false
        if (!Scene.hasScene(ctx)) return
        try {
            val img = BitmapFactory.decodeFile(Scene.imageFile(ctx).absolutePath) ?: return
            val depth = BitmapFactory.decodeFile(Scene.depthFile(ctx).absolutePath) ?: run {
                img.recycle(); return
            }
            imgAspect = img.width.toFloat() / img.height
            val ids = IntArray(2)
            GLES20.glGenTextures(2, ids, 0)
            imageTex = ids[0]
            depthTex = ids[1]
            upload(imageTex, img)
            upload(depthTex, depth)
            img.recycle()
            depth.recycle()
            hasScene = true
        } catch (t: Throwable) {
            Log.e(TAG, "Falha ao carregar a cena", t)
        }
    }

    private fun upload(tex: Int, bmp: android.graphics.Bitmap) {
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, tex)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
        GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bmp, 0)
    }

    private fun buildProgram(vs: String, fs: String): Int {
        val v = compile(GLES20.GL_VERTEX_SHADER, vs)
        val f = compile(GLES20.GL_FRAGMENT_SHADER, fs)
        if (v == 0 || f == 0) return 0
        val p = GLES20.glCreateProgram()
        GLES20.glAttachShader(p, v)
        GLES20.glAttachShader(p, f)
        GLES20.glLinkProgram(p)
        val ok = IntArray(1)
        GLES20.glGetProgramiv(p, GLES20.GL_LINK_STATUS, ok, 0)
        if (ok[0] == 0) {
            Log.e(TAG, "Link: " + GLES20.glGetProgramInfoLog(p))
            GLES20.glDeleteProgram(p)
            return 0
        }
        return p
    }

    private fun compile(type: Int, src: String): Int {
        val s = GLES20.glCreateShader(type)
        GLES20.glShaderSource(s, src)
        GLES20.glCompileShader(s)
        val ok = IntArray(1)
        GLES20.glGetShaderiv(s, GLES20.GL_COMPILE_STATUS, ok, 0)
        if (ok[0] == 0) {
            Log.e(TAG, "Shader: " + GLES20.glGetShaderInfoLog(s))
            GLES20.glDeleteShader(s)
            return 0
        }
        return s
    }

    private companion object {
        const val TAG = "DepthRenderer"

        const val VERTEX_SHADER = """
attribute vec2 aPos;
varying vec2 vUv;
void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}
"""

        // Profundidade normalizada: 1.0 = mais perto, 0.0 = mais longe.
        // Coordenadas de imagem têm y para baixo; vUv tem y para cima.
        const val FRAGMENT_SHADER = """
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 vUv;
uniform sampler2D uImage;
uniform sampler2D uDepth;
uniform vec2 uScale;
uniform vec2 uShift;
uniform vec2 uShiftS;
uniform float uFocus;
uniform float uTime;
uniform float uAspect;
uniform int uEffect;
uniform int uShowDepth;

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
               mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}

float snow(vec2 s, float scale, float speed, float seed) {
    s.y -= uTime * speed;
    s.x += sin(uTime * 0.6 + s.y * 3.0 + seed) * 0.03;
    vec2 g = s * scale;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    vec2 r = hash22(id + seed) - 0.5;
    float size = 0.06 + 0.10 * hash12(id + seed + 1.7);
    float d = length(f - r * 0.6);
    return smoothstep(size, size * 0.2, d) * step(0.35, hash12(id + seed + 9.1));
}

float rain(vec2 s, float scale, float speed, float seed) {
    s.x += s.y * 0.12;
    vec2 g = vec2(s.x * scale, s.y * scale * 0.12 - uTime * speed);
    vec2 id = floor(g);
    vec2 f = fract(g);
    float rx = 0.15 + 0.7 * hash12(id + seed);
    float line = smoothstep(0.035, 0.0, abs(f.x - rx));
    float tail = smoothstep(0.0, 0.7, f.y) * smoothstep(1.0, 0.85, f.y);
    return line * tail * step(0.55, hash12(id + seed + 4.2));
}

float fireflies(vec2 s, float scale, float seed) {
    s.y += uTime * 0.03;
    vec2 g = s * scale;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    vec2 r = hash22(id + seed) - 0.5;
    r += 0.25 * vec2(sin(uTime * 0.7 + r.x * 20.0), cos(uTime * 0.9 + r.y * 20.0));
    float d = length(f - r * 0.5);
    float tw = 0.5 + 0.5 * sin(uTime * 2.0 + hash12(id) * 30.0);
    return (smoothstep(0.25, 0.0, d) * 0.5 + smoothstep(0.06, 0.0, d)) * tw
        * step(0.6, hash12(id + seed + 2.3));
}

// Partícula na camada de profundidade pd só aparece onde a cena está mais longe que ela.
float inFront(float pd, float d) {
    return smoothstep(d - 0.04, d + 0.04, pd);
}

void main() {
    vec2 base = (vec2(vUv.x, 1.0 - vUv.y) - 0.5) * uScale + 0.5;

    // Parallax: busca iterativa do pixel de origem, uv = base - shift * (d(uv) - foco).
    vec2 uv = base;
    float d = texture2D(uDepth, base).r;
    for (int i = 0; i < 5; i++) {
        uv = base - uShift * (d - uFocus);
        d = texture2D(uDepth, uv).r;
    }

    if (uShowDepth == 1) {
        gl_FragColor = vec4(vec3(d), 1.0);
        return;
    }

    vec3 col = texture2D(uImage, uv).rgb;
    vec2 s = vec2(vUv.x * uAspect, 1.0 - vUv.y);

    if (uEffect == 1) {
        float a = 0.0;
        a += snow(s - uShiftS * (0.20 - uFocus), 14.0, 0.05, 1.0) * inFront(0.20, d) * 0.6;
        a += snow(s - uShiftS * (0.55 - uFocus), 9.0, 0.08, 7.0) * inFront(0.55, d) * 0.8;
        a += snow(s - uShiftS * (0.92 - uFocus), 5.0, 0.13, 13.0) * inFront(0.92, d);
        col = mix(col, vec3(1.0), clamp(a, 0.0, 1.0) * 0.9);
    } else if (uEffect == 2) {
        float a = 0.0;
        a += rain(s - uShiftS * (0.20 - uFocus), 40.0, 1.6, 1.0) * inFront(0.20, d) * 0.5;
        a += rain(s - uShiftS * (0.55 - uFocus), 26.0, 2.2, 7.0) * inFront(0.55, d) * 0.7;
        a += rain(s - uShiftS * (0.92 - uFocus), 14.0, 3.0, 13.0) * inFront(0.92, d);
        col = col * 0.82 + vec3(0.80, 0.85, 0.92) * clamp(a, 0.0, 1.0) * 0.55;
    } else if (uEffect == 3) {
        float a = 0.0;
        a += fireflies(s - uShiftS * (0.30 - uFocus), 9.0, 3.0) * inFront(0.30, d) * 0.6;
        a += fireflies(s - uShiftS * (0.75 - uFocus), 5.0, 11.0) * inFront(0.75, d);
        col = col * 0.88 + vec3(1.0, 0.82, 0.38) * a;
    } else if (uEffect == 4) {
        float far = 1.0 - d;
        float n = noise(s * 3.0 + vec2(uTime * 0.05, 0.0)) * 0.6
                + noise(s * 7.0 - vec2(uTime * 0.08, uTime * 0.02)) * 0.4;
        float fog = smoothstep(0.15, 1.0, far) * (0.55 + 0.45 * n) * 0.8;
        col = mix(col, vec3(0.80, 0.83, 0.88), fog);
    }

    gl_FragColor = vec4(col, 1.0);
}
"""
    }
}
