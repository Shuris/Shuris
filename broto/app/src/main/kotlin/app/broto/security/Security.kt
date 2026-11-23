package app.broto.security

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * Proteção do app. Fica fora do banco (e, portanto, fora dos backups): restaurar um backup
 * em outro aparelho nunca bloqueia o usuário com um PIN antigo.
 */
class Security(ctx: Context) {
    private val prefs: SharedPreferences = ctx.getSharedPreferences("broto_security", Context.MODE_PRIVATE)

    val pinEnabled: Boolean get() = prefs.contains("pin_hash")
    var biometricEnabled: Boolean
        get() = pinEnabled && prefs.getBoolean("bio", false)
        set(v) = prefs.edit().putBoolean("bio", v).apply()
    /** Segundos em segundo plano antes de pedir o PIN de novo. */
    var lockDelaySec: Int
        get() = prefs.getInt("delay", 0)
        set(v) = prefs.edit().putInt("delay", v).apply()

    fun setPin(pin: String) {
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
        prefs.edit().putString("pin_salt", Base64.getEncoder().encodeToString(salt)).putString("pin_hash", hash(pin, salt)).putInt("pin_len", pin.length).putInt("fails", 0).apply()
    }

    val pinLength: Int get() = prefs.getInt("pin_len", 4)

    fun clearPin() = prefs.edit().remove("pin_hash").remove("pin_salt").putBoolean("bio", false).apply()

    /** Tempo restante (ms) de espera após muitas tentativas erradas. */
    fun lockoutRemaining(now: Long = System.currentTimeMillis()): Long = (prefs.getLong("lockout_until", 0) - now).coerceAtLeast(0)

    fun check(pin: String): Boolean {
        if (lockoutRemaining() > 0) return false
        val salt = Base64.getDecoder().decode(prefs.getString("pin_salt", "") ?: "")
        val ok = MessageDigest.isEqual(hash(pin, salt).toByteArray(), (prefs.getString("pin_hash", "") ?: "").toByteArray())
        if (ok) prefs.edit().putInt("fails", 0).apply()
        else {
            val fails = prefs.getInt("fails", 0) + 1
            val e = prefs.edit().putInt("fails", fails)
            if (fails % 5 == 0) e.putLong("lockout_until", System.currentTimeMillis() + 30_000L * (fails / 5))
            e.apply()
        }
        return ok
    }

    private fun hash(pin: String, salt: ByteArray): String {
        val f = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        return Base64.getEncoder().encodeToString(f.generateSecret(PBEKeySpec(pin.toCharArray(), salt, 60_000, 256)).encoded)
    }

    companion object {
        fun biometricAvailable(ctx: Context): Boolean {
            if (Build.VERSION.SDK_INT < 28) return false
            if (Build.VERSION.SDK_INT >= 29) {
                val bm = ctx.getSystemService(android.hardware.biometrics.BiometricManager::class.java) ?: return false
                @Suppress("DEPRECATION")
                return bm.canAuthenticate() == android.hardware.biometrics.BiometricManager.BIOMETRIC_SUCCESS
            }
            return ctx.packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_FINGERPRINT)
        }
    }
}
