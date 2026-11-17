class_name Hud
extends Control
## Painéis do jogo: status no canto superior esquerdo (nome, nível, XP, dia, hora,
## energia, moedas e fama) e o painel lateral à direita com as abas Local/Mapa/Gladiador.

signal go_map
signal go_location

const SIDE_W := 210

var status_box: PanelContainer
var side: PanelContainer
var side_body: VBoxContainer
var tab := "location"
var toast_label: Label


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	status_box = PanelContainer.new()
	status_box.position = Vector2(6, 6)
	status_box.custom_minimum_size = Vector2(176, 0)
	add_child(status_box)
	side = PanelContainer.new()
	side.anchor_left = 1.0
	side.anchor_right = 1.0
	side.anchor_bottom = 1.0
	side.offset_left = -SIDE_W
	side.offset_right = -6
	side.offset_top = 6
	side.offset_bottom = -6
	add_child(side)
	var sv := VBoxContainer.new()
	side.add_child(sv)
	var tabs := HBoxContainer.new()
	tabs.name = "tabs"
	sv.add_child(tabs)
	side_body = VBoxContainer.new()
	side_body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	side_body.add_theme_constant_override("separation", 4)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	side_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(side_body)
	sv.add_child(scroll)
	toast_label = Label.new()
	toast_label.anchor_left = 0.0
	toast_label.anchor_top = 1.0
	toast_label.anchor_bottom = 1.0
	toast_label.offset_top = -28
	toast_label.position.x = 10
	toast_label.add_theme_color_override("font_color", UiTheme.GOLD)
	toast_label.modulate.a = 0
	add_child(toast_label)


func show_location() -> void:
	tab = "location"
	refresh()


func show_map() -> void:
	tab = "map"
	refresh()


func toast(text: String) -> void:
	toast_label.text = text
	toast_label.modulate.a = 1
	var tw := create_tween()
	tw.tween_interval(2.5)
	tw.tween_property(toast_label, "modulate:a", 0.0, 0.6)


func refresh() -> void:
	if not Game.has_player():
		return
	_status()
	_tabs()
	for c in side_body.get_children():
		c.queue_free()
	match tab:
		"map":
			_map_tab()
		"gladiator":
			_gladiator_tab()
		_:
			_location_tab()


func _status() -> void:
	for c in status_box.get_children():
		c.queue_free()
	var p := Game.p
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 1)
	status_box.add_child(v)
	var top := HBoxContainer.new()
	v.add_child(top)
	var n := Label.new()
	n.text = p.name
	n.add_theme_color_override("font_color", UiTheme.GOLD)
	n.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	n.clip_text = true
	top.add_child(n)
	var lv := Label.new()
	lv.text = I18n.t("common.level", {"n": p.level})
	top.add_child(lv)
	v.add_child(_bar(int(p.xp), Data.xp_to_next(int(p.level)), Color8(80, 140, 220), "%d / %d" % [p.xp, Data.xp_to_next(int(p.level))]))
	var d := HBoxContainer.new()
	v.add_child(d)
	var dl := Label.new()
	dl.text = I18n.t("status.day", {"weekday": Calendar.weekday_name(int(p.day)), "day": p.day})
	dl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	d.add_child(dl)
	var cl := Label.new()
	cl.name = "clock"
	cl.text = Calendar.clock_label(int(p.minutes))
	d.add_child(cl)
	var en := HBoxContainer.new()
	v.add_child(en)
	var el := Label.new()
	el.text = I18n.t("common.energy")
	en.add_child(el)
	var eb := _bar(int(p.energy), 100, Color8(90, 190, 110), "%d / 100" % p.energy)
	eb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	en.add_child(eb)
	var res := Label.new()
	res.text = "%s %d   %s %d" % [I18n.t("godot.coins"), p.coins, I18n.t("godot.fame"), p.reputation]
	v.add_child(res)


func _bar(value: int, max_v: int, color: Color, text: String) -> Control:
	var bar := ProgressBar.new()
	bar.max_value = max(1, max_v)
	bar.value = value
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(80, 10)
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color8(14, 9, 6)
	bg.border_color = Color8(90, 64, 40)
	bg.set_border_width_all(1)
	var fg := StyleBoxFlat.new()
	fg.bg_color = color
	bar.add_theme_stylebox_override("background", bg)
	bar.add_theme_stylebox_override("fill", fg)
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 16)
	l.set_anchors_preset(Control.PRESET_FULL_RECT)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.position.y = -3
	bar.add_child(l)
	return bar


func _tabs() -> void:
	var tabs: HBoxContainer = side.get_child(0).get_node("tabs")
	for c in tabs.get_children():
		c.queue_free()
	for t in [["location", Data.loc_name(Game.p.location)], ["map", I18n.t("nav.map")], ["gladiator", I18n.t("nav.gladiator")]]:
		var b := Button.new()
		b.name = "tab_" + t[0]
		b.text = t[1]
		b.clip_text = true
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.toggle_mode = true
		b.button_pressed = tab == t[0]
		var id: String = t[0]
		b.pressed.connect(func():
			if id == "map":
				go_map.emit()
			elif tab == "map":
				tab = id
				go_location.emit()
			else:
				tab = id
				refresh())
		tabs.add_child(b)


func _heading(text: String) -> void:
	side_body.add_child(UiTheme.title_label(text, 16, UiTheme.GOLD))


func _text(text: String, color := UiTheme.CREAM) -> Label:
	var l := Label.new()
	l.text = text
	l.autowrap_mode = TextServer.AUTOWRAP_WORD
	l.add_theme_color_override("font_color", color)
	l.custom_minimum_size.x = SIDE_W - 30
	side_body.add_child(l)
	return l


func _location_tab() -> void:
	var p := Game.p
	var loc := Data.location(p.location)
	_heading(Data.loc_name(loc.id))
	_text(Data.loc_short(loc.id), UiTheme.DIM)
	var open := Calendar.is_open(loc, int(p.minutes), int(p.day))
	_text(Calendar.hours_label(loc, int(p.day)), UiTheme.CREAM if open else UiTheme.RED)
	_text(I18n.t("godot.soon"), UiTheme.DIM)


func _map_tab() -> void:
	var p := Game.p
	_heading(I18n.t("nav.map"))
	for l in Data.locations:
		var b := Button.new()
		b.name = "go_" + l.id
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		var here: bool = l.id == p.location
		var open := Calendar.is_open(l, int(p.minutes) + Calendar.TRAVEL_MINUTES, int(p.day))
		var extra := I18n.t("godot.here") if here else ("" if open else I18n.t("godot.closed", {"hours": Calendar.hours_label(l, int(p.day))}))
		b.text = Data.loc_name(l.id) + ("  · " + extra if extra != "" else "")
		b.disabled = here
		b.clip_text = true
		b.custom_minimum_size.x = SIDE_W - 30
		b.pressed.connect(func(): get_parent().get_parent()._travel(l.id))
		side_body.add_child(b)


func _gladiator_tab() -> void:
	var p := Game.p
	_heading(I18n.t("godot.attrs"))
	for k in PlayerFactory.ATTR_KEYS:
		var row := HBoxContainer.new()
		side_body.add_child(row)
		var n := Label.new()
		n.text = Data.attr_name(k)
		n.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(n)
		var v := Label.new()
		v.text = str(int(p.baseAttributes[k]) + int(p.trainedBonus[k]))
		v.add_theme_color_override("font_color", UiTheme.GOLD)
		row.add_child(v)
	_heading(I18n.t("godot.gear"))
	var gear := Data.gear_of(p)
	for slot in ["mainHand", "offHand", "head", "body", "legs"]:
		var row := HBoxContainer.new()
		side_body.add_child(row)
		var n := Label.new()
		n.text = Data.slot_name(slot)
		n.custom_minimum_size.x = 70
		n.add_theme_color_override("font_color", UiTheme.DIM)
		row.add_child(n)
		var v := Label.new()
		v.text = Data.item_name(gear[slot]) if gear.has(slot) else I18n.t("godot.empty")
		v.clip_text = true
		v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(v)
