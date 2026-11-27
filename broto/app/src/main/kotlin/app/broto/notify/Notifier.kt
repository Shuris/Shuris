package app.broto.notify

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.widget.RemoteViews
import app.broto.MainActivity
import app.broto.core.alerts.Alert
import app.broto.core.alerts.AlertCategory
import app.broto.core.alerts.CheckIn
import app.broto.core.alerts.QuickAction
import app.broto.ui.MoodArt

object Notifier {
    const val CHANNEL_DAILY = "daily"
    private fun channelFor(c: AlertCategory) = when (c) {
        AlertCategory.HABIT_REMINDER -> "reminders"
        AlertCategory.MOOD -> "mood"
        AlertCategory.STREAK -> "streak"
        else -> "insights"
    }

    fun ensureChannels(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        nm.createNotificationChannels(listOf(
            NotificationChannel(CHANNEL_DAILY, "Acompanhamento diário", NotificationManager.IMPORTANCE_DEFAULT).apply { description = "Manhã, tarde e noite: hábitos do dia e humor, com botões rápidos" },
            NotificationChannel("reminders", "Lembretes de hábitos", NotificationManager.IMPORTANCE_DEFAULT).apply { description = "No horário escolhido para cada hábito" },
            NotificationChannel("mood", "Humor e bem-estar", NotificationManager.IMPORTANCE_DEFAULT).apply { description = "Cuidado em dias difíceis" },
            NotificationChannel("insights", "Alertas de padrões", NotificationManager.IMPORTANCE_LOW).apply { description = "Mudanças nos seus hábitos que merecem atenção" },
            NotificationChannel("streak", "Consistência", NotificationManager.IMPORTANCE_LOW).apply { description = "Para não perder sua sequência" },
        ))
    }

    fun canPost(ctx: Context): Boolean {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return false
        if (Build.VERSION.SDK_INT >= 33 && ctx.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) return false
        return nm.areNotificationsEnabled()
    }

    private fun smallIcon(ctx: Context) = ctx.resources.getIdentifier("ic_notification", "drawable", ctx.packageName).takeIf { it != 0 } ?: android.R.drawable.star_on

    private fun openIntent(ctx: Context, target: String, code: Int): PendingIntent {
        val open = Intent(ctx, MainActivity::class.java).putExtra(MainActivity.EXTRA_TARGET, target).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        return PendingIntent.getActivity(ctx, code, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun idFor(key: String): Int = key.substringBefore(':').hashCode() * 31 + key.hashCode()

    /** Botões de ação (no máximo 3, limite do Android). */
    private fun Notification.Builder.addQuickActions(ctx: Context, actions: List<QuickAction>, notifId: Int, origin: String) {
        actions.take(3).forEachIndexed { i, a ->
            val pi = ActionReceiver.logIntent(ctx, a, notifId, origin, i)
            addAction(Notification.Action.Builder(null, a.label, pi).build())
        }
    }

    /** Lembrete/alerta simples, com botões rápidos opcionais. */
    fun post(ctx: Context, a: Alert, actions: List<QuickAction> = emptyList(), origin: String = "alert") {
        ensureChannels(ctx)
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        val id = idFor(a.key)
        val b = Notification.Builder(ctx, channelFor(a.category))
            .setSmallIcon(smallIcon(ctx)).setColor(0xFF188B5B.toInt())
            .setContentTitle(a.title).setContentText(a.text)
            .setStyle(Notification.BigTextStyle().bigText(a.text))
            .setContentIntent(openIntent(ctx, a.target, a.key.hashCode()))
            .setAutoCancel(true)
            .setCategory(if (a.category == AlertCategory.HABIT_REMINDER) Notification.CATEGORY_REMINDER else Notification.CATEGORY_RECOMMENDATION)
        b.addQuickActions(ctx, actions, id, origin)
        nm.notify(id, b.build())
    }

    /** Notificação diária (manhã/tarde/noite). Com [CheckIn.askMood], mostra as 5 carinhas tocáveis. */
    fun postCheckIn(ctx: Context, c: CheckIn, slot: Int, update: Boolean = false) {
        ensureChannels(ctx)
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        val id = checkInId(slot)
        val b = Notification.Builder(ctx, CHANNEL_DAILY)
            .setSmallIcon(smallIcon(ctx)).setColor(0xFF188B5B.toInt())
            .setContentTitle(c.title).setContentText(c.text.lineSequence().firstOrNull() ?: "")
            .setContentIntent(openIntent(ctx, if (c.askMood) "mood" else "habits", 7000 + slot))
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_REMINDER)
        if (update && c.allDone) b.setTimeoutAfter(6000)
        if (c.askMood) {
            val pkg = ctx.packageName
            fun layout(n: String) = ctx.resources.getIdentifier(n, "layout", pkg)
            fun vid(n: String) = ctx.resources.getIdentifier(n, "id", pkg)
            val small = RemoteViews(pkg, layout("notif_mood_small"))
            val big = RemoteViews(pkg, layout("notif_mood_big"))
            small.setTextViewText(vid("nm_title"), c.title)
            big.setTextViewText(vid("nm_title"), c.title)
            big.setTextViewText(vid("nm_text"), c.text)
            for (lvl in 1..5) {
                val bmp = face(ctx, lvl)
                val pi = ActionReceiver.moodIntent(ctx, lvl, id, slot)
                for (rv in listOf(small, big)) {
                    rv.setImageViewBitmap(vid("nm_face$lvl"), bmp)
                    rv.setOnClickPendingIntent(vid("nm_face$lvl"), pi)
                }
                big.setOnClickPendingIntent(vid("nm_cell$lvl"), pi)
            }
            b.setStyle(Notification.DecoratedCustomViewStyle()).setCustomContentView(small).setCustomBigContentView(big)
        } else {
            b.setStyle(Notification.BigTextStyle().bigText(c.text))
        }
        b.addQuickActions(ctx, c.actions, id, "checkin:$slot")
        nm.notify(id, b.build())
    }

    fun checkInId(slot: Int) = 4200 + slot

    private val faceCache = HashMap<Int, Bitmap>()
    private fun face(ctx: Context, level: Int): Bitmap = faceCache.getOrPut(level) {
        val px = (44 * ctx.resources.displayMetrics.density).toInt().coerceIn(48, 160)
        Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888).also { MoodArt.draw(Canvas(it), level, 0f, 0f, px.toFloat()) }
    }

    /** Confirmação breve após uma ação feita na notificação (some sozinha). */
    fun confirm(ctx: Context, id: Int, title: String, text: String, target: String = "home") {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        val n = Notification.Builder(ctx, CHANNEL_DAILY).setSmallIcon(smallIcon(ctx)).setColor(0xFF188B5B.toInt())
            .setContentTitle(title).setContentText(text).setContentIntent(openIntent(ctx, target, id))
            .setAutoCancel(true).setOnlyAlertOnce(true).setTimeoutAfter(5000).build()
        nm.notify(id, n)
    }
}
