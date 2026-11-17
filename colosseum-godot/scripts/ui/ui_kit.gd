class_name Ui
## Peças de interface reutilizadas pelos painéis: textos, botões, cartões, barras,
## ícones, retratos e linhas de item, todos no tema de pixel art.

const GREEN := Color8(138, 216, 102)
const BLUE := Color8(110, 170, 230)
const W := 184  # largura útil do painel lateral

static var _tex := {}


static func tex(path: String) -> Texture2D:
	if not _tex.has(path):
		_tex[path] = load(path) if ResourceLoader.exists(path) else null
	return _tex[path]


static func label(text: String, color := UiTheme.CREAM, size := 16, wrap := true) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_color_override("font_color", color)
	if size != 16:
		l.add_theme_font_size_override("font_size", size)
	if wrap:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size.x = 40
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return l


static func small(text: String, color := UiTheme.DIM) -> Label:
	return label(text, color, 14)


static func heading(text: String, color := UiTheme.GOLD) -> Label:
	return UiTheme.title_label(text, 12, color)


static func center(l: Label) -> Label:
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return l


## Botão; `kind`: "" (bronze), "gold", "red" ou "dark".
static func button(text: String, cb: Callable, disabled := false, kind := "", icon := "") -> Button:
	var b := Button.new()
	b.text = text
	b.disabled = disabled
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	if icon != "":
		b.icon = tex("res://assets/ui/icons/%s.png" % icon)
	if kind != "":
		var base: Color = {"gold": Color8(150, 104, 30), "red": Color8(140, 42, 30), "dark": Color8(48, 34, 26)}[kind]
		for st in ["normal", "hover", "pressed", "focus"]:
			var sb := UiTheme.button_box(st)
			sb.bg_color = base.lightened(0.18) if st == "hover" else (base.darkened(0.2) if st == "pressed" else base)
			b.add_theme_stylebox_override(st, sb)
	b.pressed.connect(func():
		Sfx.play("click")
		cb.call())
	return b


static func wide(c: Control) -> Control:
	c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if c is Button:
		c.clip_text = true
	return c


static func hbox(sep := 4) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", sep)
	return h


static func vbox(sep := 3) -> VBoxContainer:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", sep)
	return v


## Cartão (painel interno mais claro). Devolve o VBox de conteúdo; o cartão é o pai dele.
static func card(parent: Control, accent := Color8(110, 78, 46)) -> VBoxContainer:
	var pc := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color8(44, 30, 20, 235)
	sb.border_color = accent
	sb.set_border_width_all(1)
	sb.set_content_margin_all(4)
	pc.add_theme_stylebox_override("panel", sb)
	parent.add_child(pc)
	var v := vbox(2)
	pc.add_child(v)
	return v


static func icon(name: String) -> TextureRect:
	var r := TextureRect.new()
	r.texture = tex("res://assets/ui/icons/%s.png" % name)
	r.stretch_mode = TextureRect.STRETCH_KEEP_CENTERED
	r.custom_minimum_size = Vector2(16, 16)
	return r


## Retrato 48x48 (escala 0.5 = 24, 1 = 48).
static func portrait(id: String, px := 24) -> Control:
	var frame := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color8(20, 12, 8)
	sb.border_color = UiTheme.BRONZE
	sb.set_border_width_all(1)
	frame.add_theme_stylebox_override("panel", sb)
	var r := TextureRect.new()
	r.texture = tex("res://assets/portraits/%s.png" % id)
	if r.texture == null:
		r.texture = tex("res://assets/portraits/locked.png")
	r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.stretch_mode = TextureRect.STRETCH_SCALE
	r.custom_minimum_size = Vector2(px, px)
	r.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	frame.add_child(r)
	frame.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	return frame


## Retrato do jogador montado em camadas (pele, barba e cabelo tingidos, capacete).
static func player_portrait(p: Dictionary, px := 24) -> Control:
	var frame := portrait("layer_base_%d" % int(p.appearance.skin), px)
	var base: TextureRect = frame.get_child(0)
	var a: Dictionary = p.appearance
	var hair: Color = Data.hex_color(int(Data.d.hairColors[int(a.hairColor)]))
	var gear := Data.gear_of(p)
	var helmet = gear.get("head")
	var layers := []
	if a.get("beard", false):
		layers.append(["layer_beard", hair])
	if helmet != null and helmet.visual.get("helmet"):
		layers.append(["layer_helmet_%s" % helmet.visual.helmet, Color.WHITE])
	elif ResourceLoader.exists("res://assets/portraits/layer_hair_%d.png" % int(a.hairStyle)):
		layers.append(["layer_hair_%d" % int(a.hairStyle), hair])
	for L in layers:
		var r := TextureRect.new()
		r.texture = tex("res://assets/portraits/%s.png" % L[0])
		r.modulate = L[1]
		r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		r.stretch_mode = TextureRect.STRETCH_SCALE
		r.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		r.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		base.add_child(r)
	return frame


static func bar(value: float, max_v: float, color: Color, text := "", h := 9) -> ProgressBar:
	var b := ProgressBar.new()
	b.max_value = maxf(1.0, max_v)
	b.value = value
	b.show_percentage = false
	b.custom_minimum_size = Vector2(40, h)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color8(14, 9, 6)
	bg.border_color = Color8(90, 64, 40)
	bg.set_border_width_all(1)
	var fg := StyleBoxFlat.new()
	fg.bg_color = color
	fg.border_color = color.darkened(0.35)
	fg.border_width_bottom = 1
	b.add_theme_stylebox_override("background", bg)
	b.add_theme_stylebox_override("fill", fg)
	if text != "":
		var l := Label.new()
		l.text = text
		l.add_theme_font_size_override("font_size", 14)
		l.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		l.offset_top = -4
		l.offset_bottom = 2
		b.add_child(l)
	return b


static func rarity_color(r: String) -> Color:
	var c = Data.d.get("rarityColor", {}).get(r)
	return Data.hex_color(int(c)) if c != null else UiTheme.CREAM


## Ícone de item (24x24) com moldura da raridade e tinta.
static func item_icon(item: Dictionary) -> Control:
	var frame := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color8(20, 12, 8)
	sb.border_color = rarity_color(item.get("rarity", "common"))
	sb.set_border_width_all(1)
	frame.add_theme_stylebox_override("panel", sb)
	var r := TextureRect.new()
	r.texture = tex("res://assets/ui/items/%s.png" % item.visual.get("icon", "weapon_rudis"))
	r.custom_minimum_size = Vector2(24, 24)
	if item.visual.get("tint") != null:
		r.modulate = Data.hex_color(int(item.visual.tint))
	frame.add_child(r)
	frame.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	return frame


static func item_title(item: Dictionary) -> String:
	var plus := int(item.get("plus", 0))
	return Names.item_name(item) + (" +%d" % plus if plus > 0 else "")


## Resumo dos efeitos do item (dano, defesa, atributos).
static func item_mods(item: Dictionary) -> String:
	var parts := []
	var m: Dictionary = item.get("mods", {})
	if m.get("damage"):
		parts.append("%+d %s" % [m.damage, I18n.t("stat.damage")])
	if m.get("defense"):
		parts.append("%+d %s" % [m.defense, I18n.t("stat.defense")])
	for k in Stats.ATTR_KEYS:
		var v = item.get("attributes", {}).get(k)
		if v:
			parts.append("%+d %s" % [v, Names.attr_short(k)])
	return ", ".join(parts)


## Linha de item: ícone, nome (cor da raridade), efeitos e os controles à direita.
static func item_row(parent: Control, item: Dictionary, controls: Array, note := "") -> void:
	var c := card(parent)
	var row := hbox(4)
	c.add_child(row)
	row.add_child(item_icon(item))
	var info := vbox(0)
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(info)
	var n := label(item_title(item), rarity_color(item.get("rarity", "common")), 14)
	info.add_child(n)
	var mods := item_mods(item)
	if note != "":
		mods = note + ("  " + mods if mods != "" else "")
	if mods != "":
		info.add_child(small(mods))
	if controls.size():
		var right := hbox(2)
		c.add_child(right)
		var sp := Control.new()
		sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		right.add_child(sp)
		for ctl in controls:
			right.add_child(ctl)


static func tag(text: String, color := UiTheme.GOLD) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 14)
	l.add_theme_color_override("font_color", color)
	return l


## Abas internas de um painel.
static func subtabs(parent: Control, items: Array, current: String, cb: Callable) -> void:
	var row := hbox(2)
	parent.add_child(row)
	for it in items:
		var id: String = it[0]
		var b := Button.new()
		b.text = it[1]
		b.clip_text = true
		b.focus_mode = Control.FOCUS_NONE
		b.toggle_mode = true
		b.button_pressed = id == current
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.add_theme_font_size_override("font_size", 14)
		b.pressed.connect(func(): cb.call(id))
		row.add_child(b)


## Fala de um personagem ("Nome: texto").
static func say(parent: Control, who: String, text: String) -> void:
	var c := card(parent, Color8(150, 110, 60))
	var l := RichTextLabel.new()
	l.bbcode_enabled = true
	l.fit_content = true
	l.scroll_active = false
	l.custom_minimum_size.x = 60
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.add_theme_font_size_override("normal_font_size", 14)
	l.add_theme_font_size_override("bold_font_size", 14)
	l.add_theme_font_override("bold_font", UiTheme.font)
	l.text = "[color=#f4d478]%s:[/color] “%s”" % [who, text]
	c.add_child(l)


static func fmt_duration(sec: float) -> String:
	var s := int(ceil(sec))
	return "%d:%02d" % [s / 60, s % 60]
