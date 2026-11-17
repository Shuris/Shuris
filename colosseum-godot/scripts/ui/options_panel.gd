class_name OptionsPanel
extends Control
## Opções: idioma, tela cheia, volume e o filtro de paleta.

signal fullscreen_toggled


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.5)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(dim)
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.custom_minimum_size = Vector2(240, 0)
	panel.position = Vector2(-120, -80)
	add_child(panel)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 5)
	panel.add_child(v)
	v.add_child(UiTheme.title_label(I18n.t("app.options"), 16, UiTheme.GOLD))
	var lang := Button.new()
	lang.text = "%s: %s" % [I18n.t("opt.language"), "Português" if I18n.lang == "pt" else "English"]
	lang.pressed.connect(func():
		I18n.set_lang("en" if I18n.lang == "pt" else "pt")
		if Game.has_player():
			Game.update(func(p): p.settings.language = I18n.lang)
		queue_free())
	v.add_child(lang)
	var fs := Button.new()
	fs.text = I18n.t("godot.fullscreen")
	fs.pressed.connect(func(): fullscreen_toggled.emit())
	v.add_child(fs)
	var vl := Label.new()
	vl.text = I18n.t("opt.volume")
	v.add_child(vl)
	var sl := HSlider.new()
	sl.min_value = 0
	sl.max_value = 1
	sl.step = 0.05
	sl.value = db_to_linear(AudioServer.get_bus_volume_db(0))
	sl.value_changed.connect(func(x): AudioServer.set_bus_volume_db(0, linear_to_db(maxf(0.001, x))))
	v.add_child(sl)
	var close := Button.new()
	close.text = I18n.t("godot.close")
	close.pressed.connect(queue_free)
	v.add_child(close)
