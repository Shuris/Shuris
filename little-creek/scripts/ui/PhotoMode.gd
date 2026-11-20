class_name PhotoMode
extends Control
## Photo mode: hides the HUD, lets the player zoom (integer pixel scales so
## the pixel art stays crisp), pan by dragging, pinch to zoom, reset the
## framing and save a capture of the scene without any interface.
## Captures are saved to user://photos (Android: app storage).

var main: Node
var bar: HBoxContainer
var zoom_label: Label
var _touches: Dictionary = {}
var _pinch_d0 := 0.0
var _pinch_z0 := 1.0
var _flash: ColorRect
const ZOOMS := [1.0, 1.5, 2.0, 3.0, 4.0]


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	theme = UITheme.get_theme()
	bar = HBoxContainer.new()
	bar.add_theme_constant_override("separation", 8)
	add_child(bar)
	bar.add_child(_btn("−", func() -> void: _step(-1)))
	zoom_label = UITheme.label("×1", 18)
	zoom_label.custom_minimum_size = Vector2(54, 0)
	zoom_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	zoom_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	bar.add_child(zoom_label)
	bar.add_child(_btn("+", func() -> void: _step(1)))
	bar.add_child(_btn("Enquadrar", func() -> void:
		main.reset_view()
		_update_label()))
	bar.add_child(_btn("Capturar", capture))
	bar.add_child(_btn("Sair", func() -> void: main.exit_photo_mode()))
	_flash = ColorRect.new()
	_flash.color = Color(1, 1, 1, 0)
	_flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_flash.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_flash)
	_layout()
	get_viewport().size_changed.connect(_layout)


func _btn(text: String, cb: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(56 if text.length() <= 1 else 0, 52)
	b.pressed.connect(func() -> void:
		AudioManager.play("click", 0.05, -6.0)
		cb.call())
	return b


func _layout() -> void:
	bar.reset_size()
	var vs := get_viewport_rect().size
	bar.position = Vector2((vs.x - bar.size.x) / 2.0, vs.y - bar.size.y - 12)


func _update_label() -> void:
	zoom_label.text = "×%s" % str(main.zoom).trim_suffix(".0")


func _step(dir: int) -> void:
	var i := ZOOMS.find(main.zoom)
	if i < 0:
		i = 0
	i = clampi(i + dir, 0, ZOOMS.size() - 1)
	main.set_zoom(ZOOMS[i])
	_update_label()


func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			_touches[event.index] = event.position
		else:
			_touches.erase(event.index)
		if _touches.size() == 2:
			var p: Array = _touches.values()
			_pinch_d0 = (p[0] as Vector2).distance_to(p[1])
			_pinch_z0 = main.zoom
		accept_event()
	elif event is InputEventScreenDrag:
		_touches[event.index] = event.position
		if _touches.size() >= 2:
			var p: Array = _touches.values()
			var d := (p[0] as Vector2).distance_to(p[1])
			if _pinch_d0 > 10.0:
				var z := _pinch_z0 * d / _pinch_d0
				# snap to crisp zoom levels
				var best: float = ZOOMS[0]
				for zz in ZOOMS:
					if absf(zz - z) < absf(best - z):
						best = zz
				if best != main.zoom:
					main.set_zoom(best, ((p[0] as Vector2) + (p[1] as Vector2)) / 2.0)
					_update_label()
		else:
			main.pan -= event.relative / main.view_scale()
			main._apply_view()
		accept_event()
	elif event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_step(1)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_step(-1)


## Saves exactly what is on screen minus the interface.
func capture() -> String:
	bar.visible = false
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	bar.visible = true
	DirAccess.make_dir_recursive_absolute("user://photos")
	var dt := Time.get_datetime_dict_from_system()
	var path := "user://photos/little_creek_%04d%02d%02d_%02d%02d%02d.png" % [dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second]
	img.save_png(path)
	AudioManager.play("camera", 0.03, -2.0)
	_flash.color = Color(1, 1, 1, 0.7)
	create_tween().tween_property(_flash, "color:a", 0.0, 0.4)
	if main.hud:
		main.hud.toast_queue_after_photo(ProjectSettings.globalize_path(path))
	return path
