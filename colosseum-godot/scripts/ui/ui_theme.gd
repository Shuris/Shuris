class_name UiTheme
## Tema da interface em pixel art: fontes VT323 (texto) e Pixelify Sans (títulos)
## sem suavização, painéis de madeira escura com borda de bronze.

const BG := Color8(26, 16, 10, 235)
const BRONZE := Color8(184, 136, 74)
const GOLD := Color8(244, 212, 120)
const CREAM := Color8(246, 236, 214)
const DIM := Color8(176, 156, 128)
const RED := Color8(200, 72, 58)

static var font: FontFile
static var title_font: FontFile


static func _font(path: String) -> FontFile:
	var f := FontFile.new()
	f.load_dynamic_font(path)
	f.antialiasing = TextServer.FONT_ANTIALIASING_NONE
	f.hinting = TextServer.HINTING_NONE
	f.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_DISABLED
	return f


static func build() -> Theme:
	font = _font("res://assets/fonts/vt323-latin-400-normal.woff2")
	var ext := _font("res://assets/fonts/vt323-latin-ext-400-normal.woff2")
	font.fallbacks = [ext]
	title_font = _font("res://assets/fonts/pixelify-sans-latin-700-normal.woff2")
	var th := Theme.new()
	th.default_font = font
	th.default_font_size = 16
	th.set_color("font_color", "Label", CREAM)
	th.set_color("font_shadow_color", "Label", Color(0, 0, 0, 0.8))
	th.set_constant("shadow_offset_x", "Label", 1)
	th.set_constant("shadow_offset_y", "Label", 1)
	th.set_stylebox("panel", "PanelContainer", panel_box())
	th.set_stylebox("panel", "Panel", panel_box())
	for st in ["normal", "hover", "pressed", "disabled", "focus"]:
		th.set_stylebox(st, "Button", button_box(st))
	th.set_color("font_color", "Button", CREAM)
	th.set_color("font_hover_color", "Button", Color.WHITE)
	th.set_color("font_pressed_color", "Button", GOLD)
	th.set_color("font_disabled_color", "Button", DIM)
	th.set_color("font_focus_color", "Button", Color.WHITE)
	var le := StyleBoxFlat.new()
	le.bg_color = Color8(14, 9, 6)
	le.border_color = BRONZE
	le.set_border_width_all(1)
	le.set_content_margin_all(4)
	th.set_stylebox("normal", "LineEdit", le)
	th.set_stylebox("focus", "LineEdit", le)
	th.set_color("font_color", "LineEdit", CREAM)
	return th


static func panel_box() -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	b.bg_color = BG
	b.border_color = BRONZE
	b.set_border_width_all(1)
	b.expand_margin_left = 1
	b.shadow_color = Color(0, 0, 0, 0.55)
	b.shadow_size = 0
	b.shadow_offset = Vector2(2, 2)
	b.set_content_margin_all(6)
	b.anti_aliasing = false
	return b


static func button_box(state: String) -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	var base := Color8(106, 68, 40)
	match state:
		"hover", "focus":
			base = Color8(160, 106, 48)
		"pressed":
			base = Color8(84, 52, 30)
		"disabled":
			base = Color8(60, 44, 34)
	b.bg_color = base
	b.border_color = Color8(26, 12, 6)
	b.set_border_width_all(1)
	b.border_width_top = 1
	b.set_content_margin_all(3)
	b.content_margin_left = 8
	b.content_margin_right = 8
	b.anti_aliasing = false
	if state == "focus":
		b.border_color = GOLD
	return b


static func title_label(text: String, size: int, color := CREAM) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", title_font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color8(58, 22, 8))
	l.add_theme_constant_override("outline_size", 4)
	return l
