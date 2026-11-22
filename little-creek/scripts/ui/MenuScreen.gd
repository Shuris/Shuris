class_name MenuScreen
extends Control
## Title screen (shown at start) and pause menu (Esc). The living creek stays
## visible behind it. While the pause menu is open the game is paused.

var main: Node
var pause := false
var box: VBoxContainer
var _settings: SettingsPanel


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	theme = UITheme.get_theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var shade := ColorRect.new()
	shade.color = Color(0.03, 0.06, 0.08, 0.35 if not pause else 0.5)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shade)
	box = VBoxContainer.new()
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_theme_constant_override("separation", 12)
	box.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	add_child(box)
	var title := UITheme.label("Little Creek", 72 if not pause else 48, Palette.GOLD)
	title.add_theme_constant_override("outline_size", 10)
	title.add_theme_color_override("font_outline_color", Color(0.04, 0.09, 0.12, 0.9))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)
	var sub := UITheme.label("Pausado" if pause else "um pequeno riacho para cuidar", 22, Palette.TEXT)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.add_theme_constant_override("outline_size", 6)
	sub.add_theme_color_override("font_outline_color", Color(0.04, 0.09, 0.12, 0.9))
	box.add_child(sub)
	box.add_child(Control.new())
	_button("Continuar" if pause else "Jogar", _play, true)
	_button("Configurações", _open_settings)
	if Settings.is_desktop():
		_button("Sair do jogo", _quit)
	var ver := UITheme.label("v%s" % ProjectSettings.get_setting("application/config/version", ""), 14, Palette.TEXT_MUTED)
	ver.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	ver.position -= Vector2(70, 30)
	add_child(ver)
	box.reset_size()
	box.position = (get_viewport_rect().size - box.size) / 2.0
	if pause:
		get_tree().paused = true


func _button(text: String, cb: Callable, focus: bool = false) -> void:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(300, 58)
	b.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	b.add_theme_font_size_override("font_size", 22)
	b.pressed.connect(func() -> void:
		AudioManager.play("click", 0.05, -6.0)
		cb.call())
	box.add_child(b)
	if focus:
		b.call_deferred("grab_focus")


func _play() -> void:
	main.close_menu()


func _open_settings() -> void:
	if _settings:
		return
	box.visible = false
	_settings = SettingsPanel.new()
	add_child(_settings)
	_settings.reset_size()
	_settings.position = ((get_viewport_rect().size - _settings.get_combined_minimum_size()) / 2.0).floor()
	_settings.closed.connect(func() -> void:
		_settings = null
		box.visible = true)


func _quit() -> void:
	SaveSystem.save_now()
	get_tree().quit()


## Esc inside the menu: close settings first, then the menu (pause only).
func back() -> bool:
	if _settings:
		_settings._close()
		return true
	if pause:
		_play()
		return true
	return false
