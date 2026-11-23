package app.broto.notify

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import app.broto.MainActivity
import app.broto.core.alerts.Alert
import app.broto.core.alerts.AlertCategory

object Notifier {
    private fun channelFor(c: AlertCategory) = when (c) {
        AlertCategory.HABIT_REMINDER -> "reminders"
        AlertCategory.MOOD -> "mood"
        AlertCategory.STREAK -> "streak"
        else -> "insights"
    }

    fun ensureChannels(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        val list = listOf(
            NotificationChannel("reminders", "Lembretes de hábitos", NotificationManager.IMPORTANCE_DEFAULT).apply { description = "No horário escolhido para cada hábito" },
            NotificationChannel("mood", "Humor e bem-estar", NotificationManager.IMPORTANCE_DEFAULT).apply { description = "Lembrete diário e cuidado em dias difíceis" },
            NotificationChannel("insights", "Alertas de padrões", NotificationManager.IMPORTANCE_LOW).apply { description = "Mudanças nos seus hábitos que merecem atenção" },
            NotificationChannel("streak", "Consistência", NotificationManager.IMPORTANCE_LOW).apply { description = "Para não perder sua sequência" },
        )
        nm.createNotificationChannels(list)
    }

    fun canPost(ctx: Context): Boolean {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return false
        if (Build.VERSION.SDK_INT >= 33 && ctx.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) return false
        return nm.areNotificationsEnabled()
    }

    fun post(ctx: Context, a: Alert) {
        ensureChannels(ctx)
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        val open = Intent(ctx, MainActivity::class.java).putExtra(MainActivity.EXTRA_TARGET, a.target).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pi = PendingIntent.getActivity(ctx, a.key.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val icon = ctx.resources.getIdentifier("ic_notification", "drawable", ctx.packageName).takeIf { it != 0 } ?: android.R.drawable.star_on
        val n = Notification.Builder(ctx, channelFor(a.category))
            .setSmallIcon(icon)
            .setColor(0xFF188B5B.toInt())
            .setContentTitle(a.title)
            .setContentText(a.text)
            .setStyle(Notification.BigTextStyle().bigText(a.text))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setCategory(if (a.category == AlertCategory.HABIT_REMINDER) Notification.CATEGORY_REMINDER else Notification.CATEGORY_RECOMMENDATION)
            .build()
        nm.notify(a.key.substringBefore(':').hashCode() * 31 + a.key.hashCode(), n)
    }
}
