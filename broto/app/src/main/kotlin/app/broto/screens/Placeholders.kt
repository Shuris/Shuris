package app.broto.screens

import android.view.View
import app.broto.MainActivity
import app.broto.ui.*
import java.time.LocalDate

class AnalysesScreen(act: MainActivity) : Screen(act) { override fun build(): View = page("Análises", back = false) { } }
class SettingsScreen(act: MainActivity) : Screen(act) { override fun build(): View = page("Ajustes") { } }
class ScoreSettingsScreen(act: MainActivity) : Screen(act) { override fun build(): View = page("Score") { } }
class ConsistencyScreen(act: MainActivity) : Screen(act) { override fun build(): View = page("Minha Consistência") { } }
class GoalsScreen(act: MainActivity) : Screen(act) { override fun build(): View = page("Meus Objetivos") { } }
class ReportsScreen(act: MainActivity) : Screen(act) { override fun build(): View = page("Relatórios") { } }
