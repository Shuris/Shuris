package app.broto
import android.app.Activity
import android.os.Bundle
import android.widget.TextView
class MainActivity : Activity() {
    override fun onCreate(s: Bundle?) { super.onCreate(s); setContentView(TextView(this).apply { text = "Olá, ação! Ç ã é "; textSize = 32f ; setOnClickListener { text = "ok" } }) }
}
