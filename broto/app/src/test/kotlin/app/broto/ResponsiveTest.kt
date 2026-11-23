package app.broto

import app.broto.data.DemoData
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ResponsiveTest {
    private fun shoot(prefix: String) {
        val repo = TestRepo.fresh(); repo.settings.onboarded = true; repo.settings.userName = "Maria Eduarda"
        DemoData.generate(repo)
        val a = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        Shots.activity(a, "${prefix}_home")
        a.switchTab(1, false); Shots.activity(a, "${prefix}_habits")
        a.switchTab(2, false); Shots.activity(a, "${prefix}_mood")
    }
    @Test @Config(qualifiers = "w320dp-h640dp-hdpi") fun smallPhone() = shoot("40_small")
    @Test @Config(qualifiers = "w800dp-h1280dp-mdpi") fun tablet() = shoot("41_tablet")
}
