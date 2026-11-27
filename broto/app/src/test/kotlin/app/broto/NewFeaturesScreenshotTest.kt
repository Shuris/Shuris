package app.broto

import android.app.NotificationManager
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import android.widget.FrameLayout
import app.broto.core.model.*
import app.broto.data.DemoData
import app.broto.notify.AlarmReceiver
import app.broto.notify.Scheduler
import app.broto.screens.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.io.File
import java.io.FileOutputStream
import java.time.LocalDate

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w400dp-h860dp-xhdpi")
class NewFeaturesScreenshotTest {
    private fun shoot(v: View, name: String, w: Int) {
        v.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED))
        v.layout(0, 0, w, v.measuredHeight)
        val b = Bitmap.createBitmap(w, v.measuredHeight, Bitmap.Config.ARGB_8888)
        val c = Canvas(b); c.drawColor(0xFFF2F4F0.toInt()); v.draw(c)
        FileOutputStream(File(Shots.dir, "$name.png")).use { b.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test fun notificationsAndSettings() {
        val repo = TestRepo.fresh(); repo.settings.onboarded = true; repo.settings.userName = "Ana"
        DemoData.generate(repo)
        val app = RuntimeEnvironment.getApplication()
        shadowOf(app).grantPermissions(android.Manifest.permission.POST_NOTIFICATIONS)
        val today = LocalDate.now()
        for ((slot, h) in listOf(0 to 8, 2 to 20)) {
            AlarmReceiver.handle(app, Intent().putExtra(Scheduler.EXTRA_KIND, Scheduler.KIND_CHECKIN).putExtra(Scheduler.EXTRA_SLOT, slot), today.atTime(h, 30))
        }
        val nm = shadowOf(app.getSystemService(NotificationManager::class.java))
        val evening = nm.allNotifications.first { it.bigContentView != null }
        val parent = FrameLayout(app)
        shoot(evening.bigContentView.apply(app, parent), "50_notif_evening_faces", 760)
        shoot(evening.contentView.apply(app, parent), "50_notif_evening_small", 760)
        val morning = nm.allNotifications.first { it.bigContentView == null }
        println("MANHÃ: " + morning.extras.getCharSequence(android.app.Notification.EXTRA_TITLE) + " | " + morning.extras.getCharSequence(android.app.Notification.EXTRA_BIG_TEXT) + " | botões=" + morning.actions.map { it.title })
        println("NOITE botões=" + evening.actions.map { it.title })

        val a = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        a.push(NotificationSettingsScreen(a), false); Shots.view(a.currentScreen.container.getChildAt(0), "51_notification_settings", fullHeight = true)
        a.pop(); Shots.idle()
        val social = repo.habits().first { it.name == "Redes sociais" }
        repo.setHabitApps(social.id, listOf("com.instagram.android"))
        a.push(HabitEditorScreen(a, social.id), false); Shots.view(a.currentScreen.container.getChildAt(0), "52_editor_screentime", fullHeight = true)
    }
}
