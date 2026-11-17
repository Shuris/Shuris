class_name TitleScreen
extends Control
## Menu principal: arte ao fundo, título no alto à esquerda, botões empilhados embaixo
## à esquerda, versão no canto; os três espaços de salvamento abrem num painel.

signal play(slot: int, info: Dictionary)
signal options
signal quit

var slots: Array = []
var slots_panel: PanelContainer


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	rebuild()


func rebuild() -> void:
	for c in get_children():
		c.queue_free()
	slots = Saves.read_all()
	var art := TextureRect.new()
	art.texture = load("res://assets/ui/title.png")
	art.set_anchors_preset(Control.PRESET_FULL_RECT)
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	add_child(art)
	var logo := UiTheme.title_label("COLOSSEUM", 48, Color8(255, 246, 228))
	logo.position = Vector2(24, 14)
	add_child(logo)
	var sub := Label.new()
	sub.text = I18n.t("title.subtitle")
	sub.add_theme_color_override("font_color", Color8(255, 226, 168))
	sub.position = Vector2(28, 68)
	add_child(sub)
	var menu := VBoxContainer.new()
	menu.add_theme_constant_override("separation", 5)
	menu.anchor_top = 1.0
	menu.anchor_bottom = 1.0
	menu.position = Vector2(24, 0)
	menu.offset_top = -196
	add_child(menu)
	var last = _last_played()
	if last != null:
		_add_btn(menu, I18n.t("title.continue"), func(): play.emit(last.slot, last), "continue")
	_add_btn(menu, I18n.t("title.newGame"), _open_slots, "new")
	if slots.any(func(s): return s.player != null):
		_add_btn(menu, I18n.t("title.load"), _open_slots, "load")
	_add_btn(menu, I18n.t("app.options"), func(): options.emit(), "options")
	_add_btn(menu, "English" if I18n.lang == "pt" else "Português", func(): I18n.set_lang("en" if I18n.lang == "pt" else "pt"), "lang")
	_add_btn(menu, I18n.t("title.quit"), func(): quit.emit(), "quit")
	var ver := UiTheme.title_label("v" + str(ProjectSettings.get_setting("application/config/version")), 16)
	ver.anchor_left = 1.0
	ver.anchor_right = 1.0
	ver.anchor_top = 1.0
	ver.anchor_bottom = 1.0
	ver.offset_left = -70
	ver.offset_top = -26
	add_child(ver)
	var foot := Label.new()
	foot.text = I18n.t("title.foot")
	foot.add_theme_color_override("font_color", Color8(244, 216, 168))
	foot.anchor_top = 1.0
	foot.anchor_bottom = 1.0
	foot.position = Vector2(24, 0)
	foot.offset_top = -20
	add_child(foot)
	if menu.get_child_count() > 0:
		(menu.get_child(0) as Control).call_deferred("grab_focus")


func _add_btn(box: Container, text: String, fn: Callable, id: String) -> void:
	var b := MenuButton2.new(text)
	b.name = "btn_" + id
	b.pressed.connect(fn)
	box.add_child(b)


func _last_played() -> Variant:
	var best = null
	for s in slots:
		if s.player != null and (best == null or float(s.player.get("updatedAt", 0)) > float(best.player.get("updatedAt", 0))):
			best = s
	return best


func _open_slots() -> void:
	if slots_panel:
		slots_panel.queue_free()
	slots_panel = PanelContainer.new()
	slots_panel.name = "slots"
	slots_panel.anchor_left = 1.0
	slots_panel.anchor_right = 1.0
	slots_panel.offset_left = -440
	slots_panel.offset_right = -16
	slots_panel.position.y = 90
	add_child(slots_panel)
	var v := VBoxContainer.new()
	slots_panel.add_child(v)
	var head := HBoxContainer.new()
	v.add_child(head)
	var h := UiTheme.title_label(I18n.t("title.saves"), 16, UiTheme.GOLD)
	h.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(h)
	var back := Button.new()
	back.text = I18n.t("common.back")
	back.pressed.connect(func():
		slots_panel.queue_free()
		slots_panel = null)
	head.add_child(back)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	v.add_child(row)
	for s in slots:
		row.add_child(_slot_card(s))


func _slot_card(s: Dictionary) -> Control:
	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(134, 120)
	var v := VBoxContainer.new()
	card.add_child(v)
	var lab := Label.new()
	lab.text = I18n.t("title.slot", {"n": s.slot})
	lab.add_theme_color_override("font_color", UiTheme.GOLD)
	v.add_child(lab)
	if s.player == null:
		var e := Label.new()
		e.text = s.error if s.error != "" else I18n.t("title.empty")
		e.autowrap_mode = TextServer.AUTOWRAP_WORD
		e.add_theme_color_override("font_color", UiTheme.RED if s.error != "" else UiTheme.DIM)
		e.size_flags_vertical = Control.SIZE_EXPAND_FILL
		v.add_child(e)
		var b := Button.new()
		b.name = "play_%d" % s.slot
		b.text = I18n.t("title.new")
		b.pressed.connect(func(): play.emit(s.slot, s))
		v.add_child(b)
	else:
		var p: Dictionary = s.player
		for line in [p.name, I18n.t("common.level", {"n": p.level}), I18n.t("title.dayInfo", {"day": p.day, "wins": p.stats.wins, "losses": p.stats.losses})]:
			var l := Label.new()
			l.text = str(line)
			l.clip_text = true
			v.add_child(l)
		if s.get("imported", false):
			var im := Label.new()
			im.text = I18n.t("godot.imported")
			im.add_theme_color_override("font_color", UiTheme.DIM)
			v.add_child(im)
		var sp := Control.new()
		sp.size_flags_vertical = Control.SIZE_EXPAND_FILL
		v.add_child(sp)
		var b := Button.new()
		b.name = "play_%d" % s.slot
		b.text = I18n.t("title.continue")
		b.pressed.connect(func(): play.emit(s.slot, s))
		v.add_child(b)
		var del := Button.new()
		del.text = I18n.t("title.delete")
		del.pressed.connect(func():
			Saves.remove(s.slot)
			rebuild()
			_open_slots())
		v.add_child(del)
	return card
