class_name BattleHud
extends Control
## HUD da luta: placas com vida e fôlego, relógio, favor da plateia, narração
## curta, velocidade e desistência. Na dupla, barras menores do duelo do fundo.

signal speed_changed(s: int)
signal forfeit_pressed

var plates: Array = []
var back_plates: Array = []
var timer_label: Label
var favor_bar: ProgressBar
var log_box: VBoxContainer
var speed_btns: Array = []
var beasts: Array = [null, null]
var _last_time := ""


func setup(engine: CombatEngine, speed: int, levels: Array, beast_kinds: Array) -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	beasts = beast_kinds
	var top := Ui.hbox(6)
	top.position = Vector2(6, 6)
	top.size = Vector2(628, 40)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(top)
	for side in 2:
		var f: Dictionary = engine.fighters[side]
		var pl := _plate(str(f.spec.name), int(levels[side]), side)
		plates.append(pl)
		if side == 0:
			top.add_child(pl.root)
			var mid := Ui.vbox(1)
			mid.custom_minimum_size.x = 120
			top.add_child(mid)
			timer_label = UiTheme.title_label("2:00", 16, UiTheme.GOLD)
			timer_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			mid.add_child(timer_label)
			mid.add_child(Ui.center(Ui.small(I18n.t("favor.label"))))
			favor_bar = Ui.bar(Crowd.FAVOR_START, 100, Color8(214, 168, 64), "", 6)
			mid.add_child(favor_bar)
		else:
			top.add_child(pl.root)
	var bottom := PanelContainer.new()
	bottom.anchor_top = 1.0
	bottom.anchor_bottom = 1.0
	bottom.anchor_right = 1.0
	bottom.offset_left = 6
	bottom.offset_right = -6
	bottom.offset_top = -34
	bottom.offset_bottom = -6
	add_child(bottom)
	var row := Ui.hbox(6)
	bottom.add_child(row)
	log_box = Ui.vbox(0)
	log_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(log_box)
	for s in [1, 2, 3]:
		var b := Ui.button("%dx" % s, func(): speed_changed.emit(s))
		b.toggle_mode = true
		b.button_pressed = s == speed
		row.add_child(b)
		speed_btns.append(b)
	row.add_child(Ui.button(I18n.t("battle.forfeit"), func(): forfeit_pressed.emit(), false, "dark"))
	push(I18n.t("battle.enter"))
	update(engine)


func _plate(fname: String, level: int, side: int) -> Dictionary:
	var pc := PanelContainer.new()
	pc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var v := Ui.vbox(1)
	pc.add_child(v)
	var head := Ui.hbox(4)
	v.add_child(head)
	var n := Ui.label(fname.split(",")[0], Color8(255, 226, 150) if side == 0 else Color8(255, 170, 150), 16, false)
	n.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	n.clip_text = true
	head.add_child(n)
	head.add_child(Ui.tag(I18n.t("common.lv", {"n": level}), UiTheme.DIM))
	var hp := Ui.bar(1, 1, Color8(196, 52, 40), "1 / 1", 10)
	v.add_child(hp)
	var st := Ui.bar(1, 1, Color8(214, 176, 60), "", 3)
	v.add_child(st)
	return {"root": pc, "box": v, "hp": hp, "st": st}


func show_back(engine: CombatEngine, levels: Array) -> void:
	for side in 2:
		var f: Dictionary = engine.fighters[side]
		var box: VBoxContainer = plates[side].box
		var h := Ui.hbox(4)
		box.add_child(h)
		var n := Ui.small(str(f.spec.name).split(",")[0] + "  " + I18n.t("common.lv", {"n": levels[side]}))
		n.autowrap_mode = TextServer.AUTOWRAP_OFF
		n.clip_text = true
		n.custom_minimum_size.x = 70
		h.add_child(n)
		var hp := Ui.bar(1, 1, Color8(160, 60, 50), "", 5)
		h.add_child(hp)
		back_plates.append({"hp": hp, "name": n})
	update_back(engine)


func update_back(engine: CombatEngine) -> void:
	for side in back_plates.size():
		var f: Dictionary = engine.fighters[side]
		var bp: Dictionary = back_plates[side]
		bp.hp.max_value = float(f.spec.stats.maxHp)
		bp.hp.value = float(f.hp)
		bp.name.modulate.a = 0.45 if float(f.hp) <= 0 else 1.0


func set_favor(f: float) -> void:
	favor_bar.value = f
	var fill: StyleBoxFlat = favor_bar.get_theme_stylebox("fill")
	fill.bg_color = Color8(244, 196, 64) if f >= 60 else (Color8(120, 110, 130) if f < 30 else Color8(214, 168, 64))


func set_speed(s: int) -> void:
	for i in speed_btns.size():
		speed_btns[i].button_pressed = i + 1 == s


func update(engine: CombatEngine) -> void:
	for side in 2:
		var f: Dictionary = engine.fighters[side]
		var pl: Dictionary = plates[side]
		var mx := float(f.spec.stats.maxHp)
		pl.hp.max_value = mx
		pl.hp.value = float(f.hp)
		(pl.hp.get_child(0) as Label).text = "%d / %d" % [ceili(float(f.hp)), int(mx)]
		pl.st.max_value = float(f.spec.stats.maxStamina)
		pl.st.value = float(f.stamina)
	var t := Ui.fmt_duration(engine.time_remaining()) if engine.started else "—"
	if t != _last_time:
		_last_time = t
		timer_label.text = t


func push(text: String) -> void:
	var l := RichTextLabel.new()
	l.bbcode_enabled = true
	l.fit_content = true
	l.scroll_active = false
	l.autowrap_mode = TextServer.AUTOWRAP_OFF
	l.add_theme_font_size_override("normal_font_size", 14)
	l.text = text
	log_box.add_child(l)
	while log_box.get_child_count() > 2:
		var old := log_box.get_child(0)
		log_box.remove_child(old)
		old.queue_free()
	for i in log_box.get_child_count():
		log_box.get_child(i).modulate.a = 1.0 if i == log_box.get_child_count() - 1 else 0.6


func event(e: Dictionary, engine: CombatEngine) -> void:
	var nm := func(s: int) -> String:
		return "[color=%s]%s[/color]" % ["#ffe296" if s == 0 else "#ffaa96", str(engine.fighters[s].spec.name).split(",")[0]]
	match e.type:
		"start":
			push(I18n.t("battle.fight"))
		"skill":
			push("%s: [color=#f4d478]%s[/color]" % [nm.call(e.side), Names.move_name(e.skill, beasts[e.side])])
		"impact":
			if e.crit and e.outcome == "hit":
				push(_strip(I18n.t("battle.critBy", {"name": nm.call(e.side)})))
		"exhausted":
			push(_strip(I18n.t("battle.tired", {"name": nm.call(e.side)})))
		"end":
			push(_strip(I18n.t("battle.wins", {"name": nm.call(e.winner)})))


## Os textos do jogo vêm com <b>…</b> (HTML); aqui viram BBCode.
func _strip(s: String) -> String:
	return s.replace("<b>", "[b]").replace("</b>", "[/b]")
