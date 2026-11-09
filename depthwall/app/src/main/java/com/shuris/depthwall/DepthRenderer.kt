package com.shuris.depthwall

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.opengl.GLUtils
import android.util.Log
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.abs

/**
 * Desenha a foto deslocando cada pixel de acordo com sua profundidade (parallax por mapa de
 * profundidade, com "ray marching" para tratar corretamente o que fica na frente de quê),
 * mais as partículas posicionadas em camadas de profundidade.
 * Usado tanto na prévia do app quanto no wallpaper.
 */
class DepthRenderer(
    private val ctx: Context,
    private val tilt: TiltSensor,
) : GLSurfaceView.Renderer {

    /** Deslocamento extra (rolagem de páginas do launcher), em [-1, 1]. */
    @Volatile var extraX = 0f
    @Volatile var extraY = 0f
    @Volatile var showDepth = false

    /** Escala atual (fração da foto visível por eixo), usada pela prévia para converter gestos. */
    @Volatile var visibleFractionX = 1f
        private set
    @Volatile var visibleFractionY = 1f
        private set

    private var program = 0
    private var imageTex = 0
    private var depthTex = 0
    private var blurTex = 0
    private var hasScene = false
    private var loadedVersion = Long.MIN_VALUE
    private var imgAspect = 1f
    private var viewW = 1
    private var viewH = 1

    private var offX = 0f
    private var offY = 0f
    private var fxTime = 0f
    private var lastNanos = 0L

    private val u = HashMap<String, Int>()
    private var aPos = 0

    private val quad: FloatBuffer = ByteBuffer.allocateDirect(8 * 4)
        .order(ByteOrder.nativeOrder()).asFloatBuffer()
        .apply { put(floatArrayOf(-1f, -1f, 1f, -1f, -1f, 1f, 1f, 1f)); position(0) }

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        // Contexto novo: texturas antigas não existem mais.
        imageTex = 0
        depthTex = 0
        blurTex = 0
        hasScene = false
        loadedVersion = Long.MIN_VALUE
        lastNanos = 0L

        program = buildProgram(VERTEX_SHADER, FRAGMENT_SHADER)
        aPos = GLES20.glGetAttribLocation(program, "aPos")
        u.clear()
        for (name in UNIFORMS) u[name] = GLES20.glGetUniformLocation(program, name)
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

        val now = System.nanoTime()
        val dt = if (lastNanos == 0L) 0f else ((now - lastNanos) * 1e-9f).coerceIn(0f, 0.1f)
        lastNanos = now
        fxTime = (fxTime + dt * lerp(0.25f, 2.5f, s.fxSpeed)) % 3600f

        // Suaviza o movimento para não tremer.
        val tx = (tilt.targetX + extraX).coerceIn(-1.2f, 1.2f)
        val ty = (tilt.targetY + extraY).coerceIn(-1.2f, 1.2f)
        offX += (tx - offX) * 0.12f
        offY += (ty - offY) * 0.12f

        // "Cover": fração da foto que cabe na tela ao preenchê-la.
        val viewAspect = viewW.toFloat() / viewH
        var coverX = 1f
        var coverY = 1f
        if (imgAspect > viewAspect) coverX = viewAspect / imgAspect else coverY = imgAspect / viewAspect

        // Zoom do usuário + um zoom pequeno que esconde as bordas durante o movimento.
        val zoom = s.zoom.coerceIn(Scene.MIN_ZOOM, Scene.MAX_ZOOM) * (1f + 0.12f * s.strength)
        val sx = coverX / zoom
        val sy = coverY / zoom
        visibleFractionX = sx
        visibleFractionY = sy
        val panX = clampPan(s.panX, sx)
        val panY = clampPan(s.panY, sy)

        val shiftAmount = 0.05f * s.strength
        val shiftX = offX * shiftAmount
        val shiftY = offY * shiftAmount

        GLES20.glUseProgram(program)
        bindTexture(0, imageTex, "uImage")
        bindTexture(1, depthTex, "uDepth")
        bindTexture(2, blurTex, "uBlur")

        GLES20.glUniform2f(u["uScale"]!!, sx, sy)
        GLES20.glUniform2f(u["uPan"]!!, panX, panY)
        GLES20.glUniform2f(u["uBlurScale"]!!, coverX, coverY)
        GLES20.glUniform2f(u["uShift"]!!, shiftX, shiftY)
        // Mesmo deslocamento convertido para o espaço da tela (usado pelas partículas).
        GLES20.glUniform2f(u["uShiftS"]!!, shiftX / sx * viewAspect, shiftY / sy)
        GLES20.glUniform1f(u["uFocus"]!!, s.focus)
        GLES20.glUniform1f(u["uAspect"]!!, viewAspect)
        GLES20.glUniform1i(u["uShowDepth"]!!, if (showDepth) 1 else 0)

        GLES20.glUniform1i(u["uEffect"]!!, s.effect)
        GLES20.glUniform1f(u["uFxTime"]!!, fxTime)
        GLES20.glUniform1f(u["uFxAmount"]!!, s.fxAmount)
        GLES20.glUniform1f(u["uFxSizeInv"]!!, 1f / lerp(0.5f, 1.9f, s.fxSize))

        quad.position(0)
        GLES20.glEnableVertexAttribArray(aPos)
        GLES20.glVertexAttribPointer(aPos, 2, GLES20.GL_FLOAT, false, 0, quad)
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
        GLES20.glDisableVertexAttribArray(aPos)
    }

    private fun bindTexture(unit: Int, tex: Int, uniform: String) {
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0 + unit)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, tex)
        GLES20.glUniform1i(u[uniform]!!, unit)
    }

    private fun loadTextures() {
        if (imageTex != 0) GLES20.glDeleteTextures(3, intArrayOf(imageTex, depthTex, blurTex), 0)
        imageTex = 0
        depthTex = 0
        blurTex = 0
        hasScene = false
        if (!Scene.hasScene(ctx)) return
        try {
            val img = BitmapFactory.decodeFile(Scene.imageFile(ctx).absolutePath) ?: return
            val depth = BitmapFactory.decodeFile(Scene.depthFile(ctx).absolutePath) ?: run {
                img.recycle(); return
            }
            imgAspect = img.width.toFloat() / img.height
            // Versão minúscula da foto: ampliada com filtro linear vira um fundo desfocado,
            // usado quando a foto é diminuída e não cobre a tela toda.
            val tinyW = 24
            val tinyH = maxOf(1, (tinyW / imgAspect).toInt())
            val tiny = Bitmap.createScaledBitmap(img, tinyW, tinyH, true)

            val ids = IntArray(3)
            GLES20.glGenTextures(3, ids, 0)
            imageTex = ids[0]
            depthTex = ids[1]
            blurTex = ids[2]
            upload(imageTex, img)
            upload(depthTex, depth)
            upload(blurTex, tiny)
            img.recycle()
            depth.recycle()
            tiny.recycle()
            hasScene = true
        } catch (t: Throwable) {
            Log.e(TAG, "Falha ao carregar a cena", t)
        }
    }

    private fun upload(tex: Int, bmp: Bitmap) {
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

    private fun lerp(a: Float, b: Float, t: Float) = a + (b - a) * t

    companion object {
        private const val TAG = "DepthRenderer"

        /**
         * Limita o deslocamento da foto: com zoom, a foto não "descola" da borda da tela;
         * diminuída, ela pode ser movida até encostar na borda.
         */
        fun clampPan(pan: Float, visibleFraction: Float): Float {
            val limit = abs(1f - visibleFraction) / 2f
            return pan.coerceIn(-limit, limit)
        }

        private val UNIFORMS = listOf(
            "uImage", "uDepth", "uBlur", "uScale", "uPan", "uBlurScale", "uShift", "uShiftS",
            "uFocus", "uAspect", "uShowDepth", "uEffect", "uFxTime", "uFxAmount", "uFxSizeInv",
        )

        private const val VERTEX_SHADER = """
attribute vec2 aPos;
varying vec2 vUv;
void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}
"""

        // Profundidade normalizada: 1.0 = mais perto, 0.0 = mais longe.
        // Coordenadas de imagem têm y para baixo; vUv tem y para cima.
        // "s" = espaço da tela com y para baixo e x em [0, aspecto] (pixels quadrados).
        private const val FRAGMENT_SHADER = """
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 vUv;
uniform sampler2D uImage;
uniform sampler2D uDepth;
uniform sampler2D uBlur;
uniform vec2 uScale;
uniform vec2 uPan;
uniform vec2 uBlurScale;
uniform vec2 uShift;
uniform vec2 uShiftS;
uniform float uFocus;
uniform float uAspect;
uniform int uShowDepth;

uniform int uEffect;
uniform float uFxTime;
uniform float uFxAmount;
uniform float uFxSizeInv;

const int STEPS = 28;

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

// Fração das células da grade que têm uma partícula (controlada por "Quantidade").
float density() {
    return mix(0.92, 0.10, uFxAmount);
}

float snow(vec2 s, float scale, float speed, float seed) {
    float t = uFxTime;
    s.y -= t * speed;
    s.x += sin(t * 0.6 + s.y * 3.0 + seed) * 0.03;
    vec2 g = s * scale * uFxSizeInv;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    vec2 r = hash22(id + seed) - 0.5;
    float size = 0.06 + 0.10 * hash12(id + seed + 1.7);
    float d = length(f - r * 0.6);
    return smoothstep(size, size * 0.2, d) * step(density(), hash12(id + seed + 9.1));
}

float rain(vec2 s, float scale, float speed, float seed) {
    s.x += s.y * 0.12;
    float sc = scale * uFxSizeInv;
    vec2 g = vec2(s.x * sc, s.y * sc * 0.12 - uFxTime * speed);
    vec2 id = floor(g);
    vec2 f = fract(g);
    float rx = 0.15 + 0.7 * hash12(id + seed);
    float line = smoothstep(0.035, 0.0, abs(f.x - rx));
    float tail = smoothstep(0.0, 0.7, f.y) * smoothstep(1.0, 0.85, f.y);
    return line * tail * step(density(), hash12(id + seed + 4.2));
}

float fireflies(vec2 s, float scale, float seed) {
    float t = uFxTime;
    s.y += t * 0.03;
    vec2 g = s * scale * uFxSizeInv;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    vec2 r = hash22(id + seed) - 0.5;
    r += 0.25 * vec2(sin(t * 0.7 + r.x * 20.0), cos(t * 0.9 + r.y * 20.0));
    float d = length(f - r * 0.5);
    float tw = 0.5 + 0.5 * sin(t * 2.0 + hash12(id) * 30.0);
    return (smoothstep(0.25, 0.0, d) * 0.5 + smoothstep(0.06, 0.0, d)) * tw
        * step(density(), hash12(id + seed + 2.3));
}

// Algo na camada de profundidade pd só aparece onde a cena está mais longe que ela.
float inFront(float pd, float d) {
    return smoothstep(d - 0.04, d + 0.04, pd);
}

// Desloca um ponto da tela como se estivesse na profundidade pd.
vec2 atDepth(vec2 s, float pd) {
    return s - uShiftS * (pd - uFocus);
}

void main() {
    vec2 sUv = vec2(vUv.x, 1.0 - vUv.y);
    vec2 base = (sUv - 0.5) * uScale + 0.5 + uPan;

    // Ray marching: um ponto da foto com profundidade D aparece em base + shift*(D - foco).
    // Percorre as camadas da frente (h=1) para o fundo (h=0) e para no primeiro ponto em que a
    // superfície da foto é alcançada. Assim, o que está na frente sempre cobre o que está atrás
    // e o fundo não é "arrastado" junto com os objetos próximos.
    float hPrev = 1.0;
    float dPrev = texture2D(uDepth, base - uShift * (1.0 - uFocus)).r;
    float hit = 0.0;
    float wall = 0.0;
    if (dPrev >= 1.0) {
        hit = 1.0;
    } else {
        for (int i = 1; i <= STEPS; i++) {
            float h = 1.0 - float(i) / float(STEPS);
            float dd = texture2D(uDepth, base - uShift * (h - uFocus)).r;
            if (dd >= h) {
                // Salto grande entre duas amostras = o raio bateu na "parede" lateral de um
                // objeto próximo. Essa faixa é fundo que estava escondido: preenche com o fundo
                // vizinho em vez de esticar a borda do objeto.
                if (dd - dPrev > 0.12) {
                    wall = 1.0;
                    hit = hPrev;
                } else {
                    // Refinamento linear entre as duas amostras.
                    float a = dPrev - hPrev;
                    float b = dd - h;
                    hit = mix(hPrev, h, a / (a - b));
                }
                break;
            }
            hPrev = h;
            dPrev = dd;
        }
    }
    vec2 uv = base - uShift * (hit - uFocus);
    float d = wall > 0.5 ? dPrev : texture2D(uDepth, uv).r;

    // Fora da foto (quando ela foi diminuída): fundo desfocado e escurecido da própria foto.
    vec2 edge = step(vec2(0.0), uv) * step(uv, vec2(1.0));
    float inside = edge.x * edge.y;
    d *= inside;

    if (uShowDepth == 1) {
        gl_FragColor = vec4(vec3(d), 1.0);
        return;
    }

    vec3 bg = texture2D(uBlur, (sUv - 0.5) * uBlurScale + 0.5).rgb * 0.6;
    vec3 col = mix(bg, texture2D(uImage, uv).rgb, inside);
    vec2 s = vec2(vUv.x * uAspect, 1.0 - vUv.y);

    if (uEffect == 1) {
        float a = 0.0;
        a += snow(atDepth(s, 0.20), 14.0, 0.05, 1.0) * inFront(0.20, d) * 0.6;
        a += snow(atDepth(s, 0.55), 9.0, 0.08, 7.0) * inFront(0.55, d) * 0.8;
        a += snow(atDepth(s, 0.92), 5.0, 0.13, 13.0) * inFront(0.92, d);
        col = mix(col, vec3(1.0), clamp(a, 0.0, 1.0) * 0.9);
    } else if (uEffect == 2) {
        float a = 0.0;
        a += rain(atDepth(s, 0.20), 40.0, 1.6, 1.0) * inFront(0.20, d) * 0.5;
        a += rain(atDepth(s, 0.55), 26.0, 2.2, 7.0) * inFront(0.55, d) * 0.7;
        a += rain(atDepth(s, 0.92), 14.0, 3.0, 13.0) * inFront(0.92, d);
        float dim = mix(1.0, 0.75, uFxAmount);
        col = col * dim + vec3(0.80, 0.85, 0.92) * clamp(a, 0.0, 1.0) * 0.55;
    } else if (uEffect == 3) {
        float a = 0.0;
        a += fireflies(atDepth(s, 0.30), 9.0, 3.0) * inFront(0.30, d) * 0.6;
        a += fireflies(atDepth(s, 0.75), 5.0, 11.0) * inFront(0.75, d);
        col = col * mix(1.0, 0.8, uFxAmount) + vec3(1.0, 0.82, 0.38) * a;
    } else if (uEffect == 4) {
        float far = 1.0 - d;
        vec2 fs = s * uFxSizeInv;
        float n = noise(fs * 3.0 + vec2(uFxTime * 0.05, 0.0)) * 0.6
                + noise(fs * 7.0 - vec2(uFxTime * 0.08, uFxTime * 0.02)) * 0.4;
        float fog = smoothstep(0.15, 1.0, far) * (0.55 + 0.45 * n) * mix(0.3, 1.0, uFxAmount);
        col = mix(col, vec3(0.80, 0.83, 0.88), fog);
    }

    gl_FragColor = vec4(col, 1.0);
}
"""
    }
}
