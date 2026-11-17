class_name OptionsPanel
extends Control
## Opções: idioma, tela cheia, som (efeitos), música e volume de cada um.

signal fullscreen_toggled


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.5)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(dim)
	var cc := CenterContainer.new()
	cc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(cc)
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(250, 0)
	cc.add_child(panel)
	var v := Ui.vbox(5)
	panel.add_child(v)
	_build(v)


func _build(v: VBoxContainer) -> void:
	for c in v.get_children():
		c.queue_free()
	v.add_child(UiTheme.title_label(I18n.t("app.options"), 16, UiTheme.GOLD))
	v.add_child(Ui.button("%s: %s" % [I18n.t("opt.language"), "Português" if I18n.lang == "pt" else "English"], func():
		I18n.set_lang("en" if I18n.lang == "pt" else "pt")
		if Game.has_player():
			Game.update(func(p): p.settings.language = I18n.lang)
		_build(v)))
	v.add_child(Ui.button(I18n.t("opt.fullscreenF11"), func(): fullscreen_toggled.emit()))
	# efeitos sonoros (guardado no save, como na versão anterior)
	v.add_child(Ui.button("%s: %s" % [I18n.t("opt.sound"), I18n.t("opt.off") if Sfx.muted else I18n.t("opt.on")], func():
		_set_sfx(Sfx.volume, not Sfx.muted)
		_build(v)))
	v.add_child(Ui.small(I18n.t("opt.volume"), UiTheme.CREAM))
	v.add_child(_slider(Sfx.volume, func(x):
		_set_sfx(x, Sfx.muted)
		Sfx.play("coin")))
	v.add_child(Ui.button("%s: %s" % [I18n.t("opt.music"), I18n.t("opt.on") if Music.enabled else I18n.t("opt.off")], func():
		Music.set_enabled(not Music.enabled)
		_build(v)))
	v.add_child(Ui.small(I18n.t("opt.musicVolume"), UiTheme.CREAM))
	v.add_child(_slider(Music.volume, func(x): Music.set_volume(x)))
	v.add_child(Ui.button(I18n.t("godot.close"), queue_free))


func _slider(value: float, cb: Callable) -> HSlider:
	var sl := HSlider.new()
	sl.min_value = 0
	sl.max_value = 1
	sl.step = 0.05
	sl.value = value
	sl.custom_minimum_size.x = 200
	sl.value_changed.connect(cb)
	return sl


func _set_sfx(vol: float, muted: bool) -> void:
	Sfx.set_volume(vol, muted)
	if Game.has_player():
		Game.update(func(p):
			p.settings.volume = vol
			p.settings.muted = muted)
