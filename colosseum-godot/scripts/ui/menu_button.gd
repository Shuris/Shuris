class_name MenuButton2
extends Button
## Placa de madeira com pontas (botões do menu principal), desenhada em pixels.

func _init(text_: String = "") -> void:
	text = text_
	custom_minimum_size = Vector2(150, 24)
	add_theme_font_override("font", UiTheme.title_font)
	add_theme_font_size_override("font_size", 16)
	add_theme_color_override("font_color", Color(0, 0, 0, 0))
	add_theme_color_override("font_hover_color", Color(0, 0, 0, 0))
	add_theme_color_override("font_focus_color", Color(0, 0, 0, 0))
	add_theme_color_override("font_pressed_color", Color(0, 0, 0, 0))
	for st in ["normal", "hover", "pressed", "focus", "disabled"]:
		add_theme_stylebox_override(st, StyleBoxEmpty.new())
	focus_mode = Control.FOCUS_ALL


func _draw() -> void:
	var w := size.x
	var h := size.y
	var hot := is_hovered() or has_focus()
	var top := Color8(200, 144, 72) if hot else Color8(138, 96, 64)
	var mid := Color8(160, 106, 48) if hot else Color8(106, 68, 40)
	var low := Color8(116, 68, 28) if hot else Color8(74, 46, 26)
	var tip := 7.0
	var outer := PackedVector2Array([Vector2(tip, 0), Vector2(w - tip, 0), Vector2(w, h / 2), Vector2(w - tip, h), Vector2(tip, h), Vector2(0, h / 2)])
	draw_colored_polygon(outer, Color8(26, 12, 6))
	var inner := PackedVector2Array([Vector2(tip, 1), Vector2(w - tip, 1), Vector2(w - 2, h / 2), Vector2(w - tip, h - 1), Vector2(tip, h - 1), Vector2(2, h / 2)])
	draw_colored_polygon(inner, mid)
	draw_rect(Rect2(tip, 1, w - tip * 2, 1), top)
	draw_rect(Rect2(tip, h / 2, w - tip * 2, h / 2 - 1), low)
	draw_rect(Rect2(tip, h / 2 - 1, w - tip * 2, 1), mid.lerp(low, 0.5))
	# pregos nas pontas
	draw_rect(Rect2(tip - 2, h / 2 - 1, 2, 2), Color8(214, 170, 90))
	draw_rect(Rect2(w - tip, h / 2 - 1, 2, 2), Color8(214, 170, 90))
	# texto por cima da placa (sombra de 1 px)
	var f: Font = UiTheme.title_font
	var fs := 16
	var tw := f.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	var base := Vector2(roundf((w - tw) / 2), roundf(h / 2 + fs * 0.32))
	draw_string(f, base + Vector2(1, 1), text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color8(26, 12, 6))
	draw_string(f, base, text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color.WHITE if hot else Color8(255, 243, 214))


func _notification(what: int) -> void:
	if what == NOTIFICATION_MOUSE_ENTER or what == NOTIFICATION_MOUSE_EXIT or what == NOTIFICATION_FOCUS_ENTER or what == NOTIFICATION_FOCUS_EXIT:
		queue_redraw()
