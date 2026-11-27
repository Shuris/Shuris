package app.broto.screentime

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.drawable.Drawable
import android.os.Build
import android.os.Process
import app.broto.core.model.HabitLog
import app.broto.core.model.Tracking
import app.broto.core.schedule.Schedule
import app.broto.data.Repo
import java.time.LocalDate
import java.time.ZoneId

/**
 * Tempo de tela medido automaticamente (Android "Acesso ao uso").
 * Tudo é calculado no aparelho; nada sai dele. Os minutos de cada dia viram o registro do hábito.
 */
object ScreenTime {
    /** Registros que o usuário corrigiu à mão não são sobrescritos pela medição automática. */
    const val MANUAL = "manual"
    const val AUTO = "auto"
    private const val DAYS_BACK = 7L

    data class AppInfo(val pkg: String, val label: String, val icon: Drawable?, val isGame: Boolean)

    /** Pacotes de redes sociais conhecidos (usados no atalho "Selecionar redes sociais"). */
    val SOCIAL = setOf("com.instagram.android", "com.instagram.barcelona", "com.zhiliaoapp.musically", "com.ss.android.ugc.trill", "com.facebook.katana",
        "com.facebook.lite", "com.twitter.android", "com.snapchat.android", "com.kwai.video", "com.pinterest", "com.reddit.frontpage", "com.linkedin.android",
        "com.tumblr", "org.telegram.messenger", "com.discord")

    fun hasPermission(ctx: Context): Boolean {
        val ops = ctx.getSystemService(AppOpsManager::class.java) ?: return false
        val mode = if (Build.VERSION.SDK_INT >= 29) ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
        else @Suppress("DEPRECATION") ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName)
        return mode == AppOpsManager.MODE_ALLOWED
    }

    fun permissionIntent(ctx: Context): Intent {
        val i = Intent(android.provider.Settings.ACTION_USAGE_ACCESS_SETTINGS)
        // Em vários aparelhos, abrir direto na página do app evita procurar na lista.
        i.data = android.net.Uri.parse("package:${ctx.packageName}")
        return if (i.resolveActivity(ctx.packageManager) != null) i else Intent(android.provider.Settings.ACTION_USAGE_ACCESS_SETTINGS)
    }

    /** Apps instalados que aparecem no menu do celular (ordenados por nome). */
    fun launchableApps(ctx: Context): List<AppInfo> {
        val pm = ctx.packageManager
        val main = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        return pm.queryIntentActivities(main, 0).map { it.activityInfo.applicationInfo }.distinctBy { it.packageName }
            .filter { it.packageName != ctx.packageName }
            .map { ai -> AppInfo(ai.packageName, ai.loadLabel(pm).toString(), try { ai.loadIcon(pm) } catch (e: Exception) { null }, ai.category == ApplicationInfo.CATEGORY_GAME) }
            .sortedBy { it.label.lowercase() }
    }

    private val KNOWN = mapOf("com.instagram.android" to "Instagram", "com.instagram.barcelona" to "Threads", "com.zhiliaoapp.musically" to "TikTok",
        "com.ss.android.ugc.trill" to "TikTok", "com.facebook.katana" to "Facebook", "com.facebook.lite" to "Facebook Lite", "com.twitter.android" to "X (Twitter)",
        "com.snapchat.android" to "Snapchat", "com.kwai.video" to "Kwai", "com.pinterest" to "Pinterest", "com.reddit.frontpage" to "Reddit",
        "com.linkedin.android" to "LinkedIn", "com.tumblr" to "Tumblr", "org.telegram.messenger" to "Telegram", "com.discord" to "Discord",
        "com.google.android.youtube" to "YouTube", "com.whatsapp" to "WhatsApp", "com.netflix.mediaclient" to "Netflix")

    /** Nome do app instalado; se não estiver instalado, um nome conhecido ou o identificador. */
    fun labelOf(ctx: Context, pkg: String): String = try {
        val pm = ctx.packageManager; pm.getApplicationInfo(pkg, 0).loadLabel(pm).toString()
    } catch (e: Exception) { KNOWN[pkg] ?: pkg }

    /** Hábitos de duração que têm apps vinculados (medidos automaticamente). */
    fun autoHabitIds(repo: Repo): Set<Long> {
        val apps = repo.allHabitApps()
        return repo.habits().filter { it.tracking == Tracking.DURATION && !apps[it.id].isNullOrEmpty() }.map { it.id }.toSet()
    }

    /**
     * Minutos em primeiro plano de cada pacote em [start, end) (epoch ms), a partir dos eventos de uso.
     * Retorna null se não há nenhum evento no intervalo (dado indisponível, ex.: dias muito antigos).
     */
    fun foregroundMinutes(usm: UsageStatsManager, packages: Set<String>, start: Long, end: Long): Map<String, Double>? {
        val events = usm.queryEvents(start - 3 * 3_600_000L, end) ?: return null
        val open = HashMap<String, Long>()               // pacote -> início da sessão em primeiro plano
        val openClasses = HashMap<String, HashSet<String>>()
        val total = HashMap<String, Long>()
        var any = false
        fun close(pkg: String, at: Long) {
            val s = open.remove(pkg) ?: return
            openClasses.remove(pkg)
            val a = maxOf(s, start); val b = minOf(at, end)
            if (b > a) total[pkg] = (total[pkg] ?: 0L) + (b - a)
        }
        val e = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(e)
            val t = e.timeStamp
            if (t >= start) any = true
            when (e.eventType) {
                1 /* ACTIVITY_RESUMED / MOVE_TO_FOREGROUND */ -> if (e.packageName in packages) {
                    if (!open.containsKey(e.packageName)) open[e.packageName] = t
                    openClasses.getOrPut(e.packageName) { HashSet() }.add(e.className ?: "")
                }
                2 /* ACTIVITY_PAUSED */, 23 /* ACTIVITY_STOPPED */ -> if (e.packageName in packages) {
                    val cls = openClasses[e.packageName]
                    cls?.remove(e.className ?: "")
                    if (cls == null || cls.isEmpty()) close(e.packageName, t)
                }
                16 /* SCREEN_NON_INTERACTIVE */, 17 /* KEYGUARD_SHOWN */, 26 /* DEVICE_SHUTDOWN */ -> for (p in open.keys.toList()) close(p, t)
            }
        }
        val now = System.currentTimeMillis()
        for (p in open.keys.toList()) close(p, minOf(end, now))
        if (!any) return null
        return packages.associateWith { (total[it] ?: 0L) / 60_000.0 }
    }

    private fun dayWindow(d: LocalDate): Pair<Long, Long> {
        val z = ZoneId.systemDefault()
        return Pair(d.atStartOfDay(z).toInstant().toEpochMilli(), d.plusDays(1).atStartOfDay(z).toInstant().toEpochMilli())
    }

    /** Minutos de hoje por hábito automático (para as notificações e a tela). */
    fun todayMinutes(ctx: Context, repo: Repo, today: LocalDate = LocalDate.now()): Map<Long, Double> {
        if (!hasPermission(ctx)) return emptyMap()
        val usm = ctx.getSystemService(UsageStatsManager::class.java) ?: return emptyMap()
        val apps = repo.allHabitApps()
        val ids = autoHabitIds(repo)
        val all = apps.filterKeys { it in ids }.values.flatten().toSet()
        if (all.isEmpty()) return emptyMap()
        val (s, e) = dayWindow(today)
        val per = foregroundMinutes(usm, all, s, e) ?: return ids.associateWith { 0.0 }
        return ids.associateWith { id -> apps[id].orEmpty().sumOf { per[it] ?: 0.0 } }
    }

    /**
     * Atualiza os registros dos hábitos automáticos dos últimos dias.
     * Não sobrescreve correções manuais nem dias sem dados de uso disponíveis.
     */
    fun sync(ctx: Context, repo: Repo, today: LocalDate = LocalDate.now()): Int {
        val entries = compute(ctx, repo, today)
        return if (entries.isEmpty()) 0 else repo.setLogsBatch(entries)
    }

    /** Calcula (sem gravar) os registros a atualizar. Pode rodar em segundo plano. */
    fun compute(ctx: Context, repo: Repo, today: LocalDate = LocalDate.now()): List<HabitLog> {
        if (!hasPermission(ctx)) return emptyList()
        val usm = ctx.getSystemService(UsageStatsManager::class.java) ?: return emptyList()
        val apps = repo.allHabitApps()
        val habits = repo.habits().filter { it.tracking == Tracking.DURATION && !apps[it.id].isNullOrEmpty() }
        if (habits.isEmpty()) return emptyList()
        val all = habits.flatMap { apps[it.id].orEmpty() }.toSet()
        val out = ArrayList<HabitLog>()
        for (back in 0..DAYS_BACK) {
            val d = today.minusDays(back)
            val (s, e) = dayWindow(d)
            val per = foregroundMinutes(usm, all, s, e) ?: continue
            val existing = repo.logsForDay(d)
            for (h in habits) {
                if (!Schedule.isActiveOn(h, d)) continue
                if (existing[h.id]?.note == MANUAL) continue
                val m = Math.round(apps[h.id].orEmpty().sumOf { per[it] ?: 0.0 }).toDouble()
                out.add(HabitLog(h.id, d, m, AUTO))
            }
        }
        return out
    }
}
