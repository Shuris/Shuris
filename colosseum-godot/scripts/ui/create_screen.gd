class_name CreateScreen
extends Control
## Criação do gladiador: nome, origem e aparência (com o boneco ao vivo no ludus).

signal preview_changed(appearance: Dictionary)
signal finished(name: String, origin: String, appearance: Dictionary)
signal back

var appearance := {"skin": 0, "hairStyle": 0, "hairColor": 0, "beard": false, "clothColor": 0}
var origin := "gaul"
var name_edit: LineEdit
var error_label: Label
var origin_desc: Label
var _name_text := ""


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	rebuild()


func rebuild() -> void:
	if name_edit:
		_name_text = name_edit.text
	for c in get_children():
		c.queue_free()
	var panel := PanelContainer.new()
	panel.anchor_left = 1.0
	panel.anchor_right = 1.0
	panel.anchor_bottom = 1.0
	panel.offset_left = -250
	panel.offset_right = -8
	panel.offset_top = 4
	panel.offset_bottom = -4
	add_child(panel)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 1)
	panel.add_child(v)
	v.add_child(UiTheme.title_label(I18n.t("intro.yourGladiator"), 16, UiTheme.GOLD))
	var nl := Label.new()
	nl.text = I18n.t("intro.name")
	v.add_child(nl)
	name_edit = LineEdit.new()
	name_edit.name = "name"
	name_edit.placeholder_text = I18n.t("intro.namePlaceholder")
	name_edit.max_length = PlayerFactory.MAX_NAME_LENGTH
	name_edit.text = _name_text
	v.add_child(name_edit)
	var og := GridContainer.new()
	og.columns = 2
	v.add_child(og)
	for o in Data.d.origins:
		var b := Button.new()
		b.name = "origin_" + o.id
		b.text = Data.origin_name(o.id)
		b.toggle_mode = true
		b.button_pressed = o.id == origin
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.pressed.connect(func():
			origin = o.id
			rebuild())
		og.add_child(b)
	origin_desc = Label.new()
	origin_desc.text = Data.origin_desc(origin)
	origin_desc.autowrap_mode = TextServer.AUTOWRAP_WORD
	origin_desc.custom_minimum_size = Vector2(226, 0)
	origin_desc.add_theme_color_override("font_color", UiTheme.DIM)
	v.add_child(origin_desc)
	v.add_child(UiTheme.title_label(I18n.t("intro.look"), 16, UiTheme.GOLD))
	_picker(v, I18n.t("intro.skin"), "skin", 5, func(i): return Data.skin_name(i))
	_picker(v, I18n.t("intro.hair"), "hairStyle", 7, func(i): return Data.hair_name(i))
	_picker(v, I18n.t("intro.color"), "hairColor", Data.d.hairColors.size(), func(i): return "%d" % (i + 1))
	_picker(v, I18n.t("intro.beard"), "beard", 2, func(i): return I18n.t("intro.withBeard") if i == 1 else I18n.t("intro.noBeard"))
	_picker(v, I18n.t("intro.cloth"), "clothColor", Data.d.clothColors.size(), func(i): return "%d" % (i + 1))
	error_label = Label.new()
	error_label.add_theme_color_override("font_color", UiTheme.RED)
	error_label.autowrap_mode = TextServer.AUTOWRAP_WORD
	error_label.custom_minimum_size = Vector2(226, 0)
	v.add_child(error_label)
	var sp := Control.new()
	sp.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(sp)
	var row := HBoxContainer.new()
	v.add_child(row)
	var bb := Button.new()
	bb.text = I18n.t("common.back")
	bb.pressed.connect(func(): back.emit())
	row.add_child(bb)
	var go := Button.new()
	go.name = "finish"
	go.text = I18n.t("intro.start")
	go.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	go.pressed.connect(_finish)
	row.add_child(go)
	preview_changed.emit(appearance)


func _picker(box: Container, label: String, key: String, count: int, name_of: Callable) -> void:
	var row := HBoxContainer.new()
	box.add_child(row)
	var l := Label.new()
	l.text = label
	l.custom_minimum_size.x = 56
	row.add_child(l)
	var cur := int(appearance[key]) if key != "beard" else (1 if appearance.beard else 0)
	var prev := Button.new()
	prev.text = "<"
	row.add_child(prev)
	var val := Label.new()
	val.text = name_of.call(cur)
	val.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	val.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	val.clip_text = true
	val.custom_minimum_size.x = 60
	row.add_child(val)
	var next := Button.new()
	next.text = ">"
	row.add_child(next)
	var change := func(delta: int):
		var n := posmod(cur + delta, count)
		appearance[key] = (n == 1) if key == "beard" else n
		rebuild()
	prev.pressed.connect(change.bind(-1))
	next.pressed.connect(change.bind(1))


func _finish() -> void:
	var err = PlayerFactory.validate_name(name_edit.text)
	if err != null:
		error_label.text = str(err)
		return
	finished.emit(PlayerFactory.sanitize_name(name_edit.text), origin, appearance.duplicate())
