class_name SettingsPanel
extends PanelContainer
## Settings window (PC + mobile). Display rows only on desktop.
## Every control applies immediately (Settings / AudioManager) and is saved.

signal closed

var _res: OptionButton
var _mode: OptionButton
var _vsync: CheckButton
var _quality: OptionButton
var _particles: HSlider
var _part_label: Label


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	theme = UITheme.get_theme()
	add_theme_stylebox_override("panel", UITheme.sbt("panel.png", 12, 22))
	mouse_filter = Control.MOUSE_FILTER_STOP
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	add_child(v)
	var head := HBoxContainer.new()
	v.add_child(head)
	var t := UITheme.label("Configurações", 26, Palette.GOLD)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(t)
	var close := Button.new()
	close.text = "Fechar (Esc)"
	close.custom_minimum_size = Vector2(0, 44)
	close.pressed.connect(_close)
	head.add_child(close)
	var cols := HBoxContainer.new()
	cols.add_theme_constant_override("separation", 30)
	v.add_child(cols)
	var left := VBoxContainer.new()
	left.add_theme_constant_override("separation", 8)
	left.custom_minimum_size = Vector2(380, 0)
	cols.add_child(left)
	var right := VBoxContainer.new()
	right.add_theme_constant_override("separation", 8)
	right.custom_minimum_size = Vector2(360, 0)
	cols.add_child(right)

	left.add_child(UITheme.label("Vídeo", 18, Palette.ACCENT))
	if Settings.is_desktop():
		_mode = _option(left, "Modo de tela", ["Janela", "Tela cheia"], 1 if Settings.fullscreen else 0,
			func(i: int) -> void:
				Settings.fullscreen = i == 1
				_res.disabled = Settings.fullscreen
				Settings.set_and_apply())
		var names: Array = []
		var sel := 3
		for i in Settings.RESOLUTIONS.size():
			var r: Vector2i = Settings.RESOLUTIONS[i]
			names.append("%d × %d" % [r.x, r.y])
			if r == Settings.resolution:
				sel = i
		_res = _option(left, "Resolução da janela", names, sel, func(i: int) -> void:
			Settings.resolution = Settings.RESOLUTIONS[i]
			Settings.set_and_apply())
		_res.disabled = Settings.fullscreen
		var hv := HBoxContainer.new()
		_vsync = CheckButton.new()
		_vsync.text = "VSync (sincronia vertical)"
		_vsync.button_pressed = Settings.vsync
		_vsync.toggled.connect(func(on: bool) -> void:
			Settings.vsync = on
			Settings.set_and_apply())
		hv.add_child(_vsync)
		left.add_child(hv)
	_quality = _option(left, "Qualidade dos efeitos", Settings.QUALITY_NAMES, Settings.quality, func(i: int) -> void:
		Settings.quality = i
		Settings.set_and_apply())
	_part_label = UITheme.label("", 16)
	left.add_child(_part_label)
	_particles = HSlider.new()
	_particles.min_value = 0.25
	_particles.max_value = 1.5
	_particles.step = 0.05
	_particles.value = Settings.particles
	_particles.custom_minimum_size = Vector2(340, 32)
	_particles.value_changed.connect(func(x: float) -> void:
		Settings.particles = x
		_update_labels()
		Settings.set_and_apply())
	left.add_child(_particles)
	_update_labels()

	right.add_child(UITheme.label("Som", 18, Palette.ACCENT))
	right.add_child(_slider("music", "Música", AudioManager.music_volume, AudioManager.set_music_volume))
	right.add_child(_slider("rain", "Sons ambientes", AudioManager.amb_volume, AudioManager.set_amb_volume))
	right.add_child(_slider("sound", "Efeitos sonoros", AudioManager.sfx_volume, AudioManager.set_sfx_volume))
	if Settings.is_desktop():
		var keys := UITheme.label("Atalhos: B construir · U melhorias · E ecossistema · J diário · I info\n" +
			"P modo foto (roda do mouse = zoom, arrastar = enquadrar) · F11 tela cheia · Esc menu", 13, Palette.TEXT_MUTED)
		keys.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		keys.custom_minimum_size = Vector2(340, 0)
		right.add_child(keys)


func _update_labels() -> void:
	_part_label.text = "Densidade de partículas: %d%%" % int(round(Settings.particles * 100.0))


func _option(parent: Control, title: String, items: Array, sel: int, cb: Callable) -> OptionButton:
	parent.add_child(UITheme.label(title, 16))
	var o := OptionButton.new()
	for it in items:
		o.add_item(String(it))
	o.select(sel)
	o.custom_minimum_size = Vector2(340, 44)
	o.item_selected.connect(cb)
	parent.add_child(o)
	return o


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
	s.custom_minimum_size = Vector2(320, 32)
	s.value_changed.connect(func(x: float) -> void:
		setter.call(x)
		SaveSystem.request_save())
	v.add_child(s)
	return v


func _close() -> void:
	AudioManager.play("click", 0.05, -6.0)
	closed.emit()
	queue_free()
