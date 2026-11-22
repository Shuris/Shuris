extends HBoxContainer
## Info drawer: audio volumes, how to play, test speed and progress reset.

var hud: Node
var _speed_btn: Button
var _reset_btn: Button
var _reset_armed := false


func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 24)
	var left := VBoxContainer.new()
	left.custom_minimum_size = Vector2(330, 0)
	left.add_theme_constant_override("separation", 10)
	add_child(left)
	left.add_child(UITheme.label("Som", 18, Palette.ACCENT))
	left.add_child(_slider("music", "Música", AudioManager.music_volume, AudioManager.set_music_volume))
	left.add_child(_slider("rain", "Sons ambientes", AudioManager.amb_volume, AudioManager.set_amb_volume))
	left.add_child(_slider("sound", "Efeitos sonoros", AudioManager.sfx_volume, AudioManager.set_sfx_volume))
	var sb := Button.new()
	sb.text = "Configurações de vídeo e som"
	sb.custom_minimum_size = Vector2(0, 50)
	sb.pressed.connect(func() -> void:
		hud.close_drawer()
		hud.main.open_menu(true)
		hud.main.menu.call_deferred("_open_settings"))
	left.add_child(sb)
	left.add_child(UITheme.label("Teste", 18, Palette.ACCENT))
	_speed_btn = Button.new()
	_speed_btn.custom_minimum_size = Vector2(0, 50)
	_speed_btn.pressed.connect(_cycle_speed)
	left.add_child(_speed_btn)
	_reset_btn = Button.new()
	_reset_btn.custom_minimum_size = Vector2(0, 50)
	_reset_btn.text = "Apagar progresso"
	_reset_btn.pressed.connect(_reset)
	left.add_child(_reset_btn)
	_update_speed()

	var mid := VBoxContainer.new()
	mid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mid.add_theme_constant_override("separation", 6)
	add_child(mid)
	mid.add_child(UITheme.label("Como jogar", 18, Palette.ACCENT))
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	mid.add_child(scroll)
	var help := UITheme.label(
		"• Toque na água do riacho para coletar água. O riacho também produz sozinho, mesmo com o jogo fechado (até 2h, mais com o Ciclo das chuvas).\n" +
		"• Construir: compre flores, plantas, pedras, árvores e construções. Cada elemento entra sozinho no cenário, num lugar que combine com ele. Cada tipo tem um limite.\n" +
		"• O tempo passa: amanhecer, dia, entardecer e noite; cada estação dura 30 dias de jogo e muda a floresta aos poucos. Às vezes chove.\n" +
		"• Cada animal tem seus horários: pássaros cantam de manhã, veados bebem água ao amanhecer e ao entardecer, corujas e vagalumes aparecem à noite.\n" +
		"• Acontecimentos surgem sozinhos: ninhos, filhotes, patos, flores raras, arco-íris depois da chuva. Tudo fica no Diário.\n" +
		"• No Refúgio Natural chegam visitantes de vez em quando. Com a ponte, eles podem atravessar o riacho.\n" +
		"• Botão da câmera: modo fotografia, com zoom e captura sem interface. O progresso é salvo automaticamente.", 15, Palette.TEXT)
	help.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	help.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	help.custom_minimum_size = Vector2(380, 0)
	scroll.add_child(help)
	var cred := UITheme.label("Little Creek · protótipo 0.5 · Godot 4 · fonte Pixelify Sans (OFL)", 13, Palette.TEXT_MUTED)
	mid.add_child(cred)


func _slider(icon_name: String, text: String, value: float, setter: Callable) -> Control:
	var v := VBoxContainer.new()
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 8)
	h.add_child(UITheme.icon(icon_name, 24))
	h.add_child(UITheme.label(text, 16))
	v.add_child(h)
	var s := HSlider.new()
	s.min_value = 0.0
	s.max_value = 1.0
	s.step = 0.05
	s.value = value
	s.custom_minimum_size = Vector2(300, 32)
	s.value_changed.connect(func(x: float) -> void:
		setter.call(x)
		SaveSystem.request_save())
	v.add_child(s)
	return v


func _cycle_speed() -> void:
	var speeds := [1.0, 5.0, 20.0, 60.0]
	var i := speeds.find(GameState.time_scale)
	GameState.time_scale = speeds[(i + 1) % speeds.size()]
	_update_speed()


func _update_speed() -> void:
	_speed_btn.text = "Velocidade do tempo: ×%d" % int(GameState.time_scale)


func _reset() -> void:
	if not _reset_armed:
		_reset_armed = true
		_reset_btn.text = "Toque de novo para confirmar"
		get_tree().create_timer(3.0).timeout.connect(func() -> void:
			if is_instance_valid(_reset_btn):
				_reset_armed = false
				_reset_btn.text = "Apagar progresso")
		return
	SaveSystem.delete_save()
	GameState.reset_state()
	SaveSystem.save_now()
	get_tree().reload_current_scene()
