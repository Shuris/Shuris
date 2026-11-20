class_name UITheme
extends RefCounted
## Builds the game's Theme from the pixel-art UI textures and offers small
## widget helpers so every panel looks consistent.

const UI := "res://assets/sprites/ui/"
const ICONS := "res://assets/sprites/ui/icons/"

static var _theme: Theme
static var font: FontFile


static func sbt(path: String, margin: int, content: int = -1, content_v: int = -1) -> StyleBoxTexture:
	var sb := StyleBoxTexture.new()
	sb.texture = load(UI + path)
	sb.texture_margin_left = margin
	sb.texture_margin_right = margin
	sb.texture_margin_top = margin
	sb.texture_margin_bottom = margin
	var c := content if content >= 0 else margin
	var cv := content_v if content_v >= 0 else c
	sb.content_margin_left = c
	sb.content_margin_right = c
	sb.content_margin_top = cv
	sb.content_margin_bottom = cv
	return sb


static func get_theme() -> Theme:
	if _theme:
		return _theme
	font = load("res://assets/fonts/PixelifySans.ttf")
	font.antialiasing = TextServer.FONT_ANTIALIASING_NONE
	font.hinting = TextServer.HINTING_NONE
	font.subpixel_positioning = TextServer.SUBPIXEL_POSITIONING_DISABLED
	var t := Theme.new()
	t.default_font = font
	t.default_font_size = 20
	t.set_color("font_color", "Label", Palette.TEXT)
	t.set_color("font_shadow_color", "Label", Color(0.02, 0.05, 0.07, 0.75))
	t.set_constant("shadow_offset_x", "Label", 2)
	t.set_constant("shadow_offset_y", "Label", 2)
	t.set_stylebox("panel", "PanelContainer", sbt("panel.png", 12, 14))
	t.set_stylebox("panel", "Panel", sbt("panel.png", 12, 14))
	for st in ["normal", "hover", "focus"]:
		t.set_stylebox(st, "Button", sbt("btn.png", 6, 12, 6))
	t.set_stylebox("pressed", "Button", sbt("btn_pressed.png", 6, 12, 6))
	t.set_stylebox("disabled", "Button", sbt("btn_disabled.png", 6, 12, 6))
	t.set_color("font_color", "Button", Palette.TEXT)
	t.set_color("font_hover_color", "Button", Color.WHITE)
	t.set_color("font_pressed_color", "Button", Palette.TEXT)
	t.set_color("font_focus_color", "Button", Palette.TEXT)
	t.set_color("font_disabled_color", "Button", Palette.TEXT_MUTED)
	t.set_color("font_shadow_color", "Button", Color(0.02, 0.05, 0.07, 0.7))
	t.set_constant("shadow_offset_x", "Button", 2)
	t.set_constant("shadow_offset_y", "Button", 2)
	t.set_font_size("font_size", "Button", 18)
	# progress bar / slider
	var bg := sbt("bar_bg.png", 4, 0)
	t.set_stylebox("background", "ProgressBar", bg)
	t.set_stylebox("fill", "ProgressBar", sbt("bar_fill.png", 2, 0))
	t.set_constant("outline_size", "ProgressBar", 0)
	var track := sbt("bar_bg.png", 4, 0, 5)
	var fillsb := sbt("bar_fill.png", 2, 0, 3)
	t.set_stylebox("slider", "HSlider", track)
	t.set_stylebox("grabber_area", "HSlider", fillsb)
	t.set_stylebox("grabber_area_highlight", "HSlider", fillsb)
	t.set_icon("grabber", "HSlider", load(UI + "grabber.png"))
	t.set_icon("grabber_highlight", "HSlider", load(UI + "grabber.png"))
	# scroll bars: slim and dark
	var sb_bg := StyleBoxFlat.new()
	sb_bg.bg_color = Color(0, 0, 0, 0.25)
	sb_bg.content_margin_top = 4
	sb_bg.content_margin_bottom = 4
	var sb_g := StyleBoxFlat.new()
	sb_g.bg_color = Color("5d9148")
	for cls in ["HScrollBar", "VScrollBar"]:
		t.set_stylebox("scroll", cls, sb_bg)
		t.set_stylebox("grabber", cls, sb_g)
		t.set_stylebox("grabber_highlight", cls, sb_g)
		t.set_stylebox("grabber_pressed", cls, sb_g)
	_theme = t
	return t


static func icon(name: String, size: int = 24) -> TextureRect:
	var r := TextureRect.new()
	r.texture = load(ICONS + name + ".png")
	r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	r.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	r.custom_minimum_size = Vector2(size, size)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r


static func tex_rect(tex: Texture2D, size: Vector2) -> TextureRect:
	var r := TextureRect.new()
	r.texture = tex
	r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	r.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	r.custom_minimum_size = size
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r


static func label(text: String, size: int = 20, color: Color = Palette.TEXT) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


static func panel(style: String = "panel.png", margin: int = 12, content: int = 14) -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", sbt(style, margin, content))
	return p


## Cost line: [water icon] 120  [seed icon] 4
static func cost_row(cost: Dictionary, size: int = 16) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 4)
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var can := GameState.can_afford(cost)
	for k in ["water", "seeds"]:
		var v := float(cost.get(k, 0))
		if v <= 0.0:
			continue
		h.add_child(icon("water" if k == "water" else "seed", size + 4))
		var have := GameState.water if k == "water" else GameState.seeds
		var l := label(NumFmt.short(v), size, Palette.TEXT if have >= v else Palette.WARN)
		h.add_child(l)
	if h.get_child_count() == 0:
		h.add_child(label("grátis", size, Palette.ACCENT))
	return h


## Integer-scaled preview size for pixel textures (fits inside box).
static func pixel_fit(tex: Texture2D, box: Vector2) -> Vector2:
	var fit := minf(box.x / tex.get_width(), box.y / tex.get_height())
	# integer up-scaling, or exact 1/n down-scaling for very large sprites
	var s := floorf(fit) if fit >= 1.0 else 1.0 / ceilf(1.0 / fit)
	return Vector2(tex.get_width(), tex.get_height()) * s
