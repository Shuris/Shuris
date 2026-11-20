extends Control
## Heads-up display and interaction modes (mobile, landscape).
## Edges only: resources top-left, stage top-right, 4 round buttons
## bottom-right, a bottom drawer for menus. The creek stays visible.

var main: Node
var world: World

var water_val: Label
var water_rate: Label
var seed_val: Label
var seed_rate: Label
var stage_title: Label
var stage_bar: ProgressBar
var stat_vit: Label
var stat_bio: Label
var stat_beauty: Label
var buttons: HBoxContainer
var drawer: PanelContainer
var drawer_title: Label
var drawer_body: MarginContainer
var drawer_content: Control
var drawer_name := ""
var drawer_open := false
var mode_bar: PanelContainer
var mode_label: Label
var hint_panel: PanelContainer
var hint_label: Label
var toast_box: VBoxContainer
var float_layer: Control
var overlay: Control

# placement
var place_id := ""
var place_variant := 0
var remove_mode := false
var _touch_down := false

var _toast_queue: Array = []
var _toast_busy := false


func _ready() -> void:
	world = main.world
	theme = UITheme.get_theme()
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	float_layer = Control.new()
	float_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	float_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(float_layer)
	_build_resources()
	_build_stage_card()
	_build_buttons()
	_build_hint()
	_build_mode_bar()
	_build_drawer()
	toast_box = VBoxContainer.new()
	toast_box.custom_minimum_size = Vector2(640, 10)
	toast_box.alignment = BoxContainer.ALIGNMENT_BEGIN
	toast_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(toast_box)
	_pin(toast_box, Vector2(0.5, 0), Vector2(0, 112))
	overlay = Control.new()
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(overlay)

	GameState.resources_changed.connect(_refresh_resources)
	GameState.stats_changed.connect(_refresh_stats)
	GameState.stage_changed.connect(_on_stage_changed)
	GameState.species_discovered.connect(_on_species)
	world.floating_text.connect(_on_floating_text)
	world.water_tapped.connect(_on_water_tapped)
	SaveSystem.loaded.connect(_on_resume_report)
	NatureLog.notify.connect(func(t: String) -> void: toast(t, Palette.TEXT))
	_refresh_resources()
	_refresh_stats()


func on_game_loaded(report: Dictionary) -> void:
	_refresh_resources()
	_refresh_stats()
	if not report.is_empty():
		show_welcome(report)
	_update_hint()


func _on_resume_report(report: Dictionary) -> void:
	if is_inside_tree() and not report.is_empty() and get_tree().get_frame() > 10:
		show_welcome(report)


## Anchor a control to a point of the screen (0..1) with a pixel offset,
## growing away from that edge. Keeps the layout right on any aspect ratio.
func _pin(c: Control, anchor: Vector2, offset: Vector2) -> void:
	c.anchor_left = anchor.x
	c.anchor_right = anchor.x
	c.anchor_top = anchor.y
	c.anchor_bottom = anchor.y
	var sz := c.get_combined_minimum_size()
	c.grow_horizontal = Control.GROW_DIRECTION_BEGIN if anchor.x >= 1.0 else (Control.GROW_DIRECTION_BOTH if anchor.x == 0.5 else Control.GROW_DIRECTION_END)
	c.grow_vertical = Control.GROW_DIRECTION_BEGIN if anchor.y >= 1.0 else (Control.GROW_DIRECTION_BOTH if anchor.y == 0.5 else Control.GROW_DIRECTION_END)
	var x0 := offset.x - (sz.x if anchor.x >= 1.0 else (sz.x / 2.0 if anchor.x == 0.5 else 0.0))
	var y0 := offset.y - (sz.y if anchor.y >= 1.0 else (sz.y / 2.0 if anchor.y == 0.5 else 0.0))
	c.offset_left = x0
	c.offset_right = x0 + sz.x
	c.offset_top = y0
	c.offset_bottom = y0 + sz.y


# ------------------------------------------------------------------ top bars
func _chip(icon_name: String) -> Array:
	var p := UITheme.panel("chip.png", 8, 10)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 8)
	h.add_child(UITheme.icon(icon_name, 36))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", -4)
	var val := UITheme.label("0", 24)
	var rate := UITheme.label("+0/s", 14, Palette.TEXT_MUTED)
	v.add_child(val)
	v.add_child(rate)
	h.add_child(v)
	p.add_child(h)
	p.custom_minimum_size = Vector2(150, 0)
	return [p, val, rate]


func _build_resources() -> void:
	var box := HBoxContainer.new()
	box.position = Vector2(14, 12)
	box.add_theme_constant_override("separation", 8)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(box)
	var a := _chip("water")
	water_val = a[1]
	water_rate = a[2]
	box.add_child(a[0])
	var b := _chip("seed")
	seed_val = b[1]
	seed_rate = b[2]
	box.add_child(b[0])


func _build_stage_card() -> void:
	var p := UITheme.panel("panel.png", 12, 12)
	p.custom_minimum_size = Vector2(330, 0)
	p.mouse_filter = Control.MOUSE_FILTER_STOP
	p.gui_input.connect(func(e: InputEvent) -> void:
		if e is InputEventScreenTouch and not e.pressed:
			open_panel("eco"))
	add_child(p)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 4)
	p.add_child(v)
	stage_title = UITheme.label("", 17, Palette.ACCENT)
	v.add_child(stage_title)
	stage_bar = ProgressBar.new()
	stage_bar.custom_minimum_size = Vector2(0, 14)
	stage_bar.show_percentage = false
	stage_bar.max_value = 1.0
	stage_bar.step = 0.001
	stage_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(stage_bar)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 6)
	v.add_child(h)
	for pair in [["vitality", "vit"], ["biodiversity", "bio"], ["beauty", "beauty"]]:
		h.add_child(UITheme.icon(pair[0], 24))
		var l := UITheme.label("0", 18)
		l.custom_minimum_size = Vector2(62, 0)
		h.add_child(l)
		match pair[1]:
			"vit":
				stat_vit = l
			"bio":
				stat_bio = l
			"beauty":
				stat_beauty = l
	_pin(p, Vector2(1, 0), Vector2(-14, 12))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(row)
	var clock_chip := UITheme.panel("chip.png", 8, 8)
	clock_chip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var ch := HBoxContainer.new()
	ch.add_theme_constant_override("separation", 6)
	clock_chip.add_child(ch)
	weather_icon = UITheme.icon("sun", 24)
	ch.add_child(weather_icon)
	clock_label = UITheme.label("", 15, Palette.TEXT)
	ch.add_child(clock_label)
	row.add_child(clock_chip)
	row.add_child(_chip_button("camera", func() -> void:
		if main.has_method("enter_photo_mode"):
			main.enter_photo_mode()))
	row.add_child(_chip_button("info", func() -> void: open_panel("info")))
	clock_row = row
	_refresh_clock()
	_pin(row, Vector2(1, 0), Vector2(-14, 12 + p.get_combined_minimum_size().y + 6))


func _refresh_resources() -> void:
	water_val.text = NumFmt.short(GameState.water)
	water_rate.text = "+" + NumFmt.rate(GameState.water_rate * GameState.time_scale)
	seed_val.text = NumFmt.short(GameState.seeds)
	seed_rate.text = "+" + NumFmt.rate(GameState.seed_rate * GameState.time_scale)
	if drawer_open and drawer_content and drawer_content.has_method("refresh"):
		drawer_content.refresh()


func _refresh_stats() -> void:
	var info := GameData.stage_info(GameState.stage)
	stage_title.text = "ESTÁGIO %d · %s" % [GameState.stage, String(info["name"]).to_upper()]
	stage_bar.value = GameState.stage_progress()
	stat_vit.text = "%d%%" % int(GameState.vitality)
	stat_bio.text = str(GameState.biodiversity)
	stat_beauty.text = str(int(GameState.beauty))
	_update_hint()


var clock_label: Label
var weather_icon: TextureRect
var clock_row: HBoxContainer
var _clock_t := 0.0


func _chip_button(icon_name: String, cb: Callable) -> Control:
	var b := TextureButton.new()
	b.texture_normal = load(UITheme.UI + "chip.png")
	b.ignore_texture_size = true
	b.stretch_mode = TextureButton.STRETCH_SCALE
	b.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	b.custom_minimum_size = Vector2(52, 44)
	var ic := UITheme.icon(icon_name, 28)
	ic.position = Vector2(12, 8)
	b.add_child(ic)
	b.pressed.connect(func() -> void:
		AudioManager.play("click", 0.05, -6.0)
		cb.call())
	return b


func _refresh_clock() -> void:
	if clock_label == null:
		return
	clock_label.text = "%s  %s" % [Clock.date_string(), Clock.time_string()]
	var icon := "rain" if Weather.state != "clear" else ("moon" if Clock.is_night() else "sun")
	weather_icon.texture = load(UITheme.ICONS + icon + ".png")


func _process(delta: float) -> void:
	_clock_t += delta
	if _clock_t > 1.0:
		_clock_t = 0.0
		_refresh_clock()


# ------------------------------------------------------------------ buttons
func _round_button(icon_name: String, text: String, cb: Callable) -> Control:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", -2)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var b := TextureButton.new()
	b.texture_normal = load(UITheme.UI + "btn_round.png")
	b.texture_pressed = load(UITheme.UI + "btn_round_pressed.png")
	b.texture_hover = load(UITheme.UI + "btn_round_active.png")
	b.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	b.custom_minimum_size = Vector2(80, 80)
	b.ignore_texture_size = true
	b.stretch_mode = TextureButton.STRETCH_SCALE
	b.pressed.connect(func() -> void:
		AudioManager.play("click", 0.05, -6.0)
		cb.call())
	var ic := UITheme.icon(icon_name, 36)
	ic.position = Vector2(22, 20)
	b.add_child(ic)
	v.add_child(b)
	var l := UITheme.label(text, 13, Palette.TEXT)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(l)
	return v


func _build_buttons() -> void:
	buttons = HBoxContainer.new()
	buttons.add_theme_constant_override("separation", 12)
	buttons.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(buttons)
	buttons.add_child(_round_button("build", "Construir", func() -> void: open_panel("build")))
	buttons.add_child(_round_button("upgrade", "Melhorias", func() -> void: open_panel("upgrades")))
	buttons.add_child(_round_button("eco", "Ecossistema", func() -> void: open_panel("eco")))
	buttons.add_child(_round_button("journal", "Diário", func() -> void: open_panel("journal")))
	_pin(buttons, Vector2(1, 1), Vector2(-14, -6))


func _build_hint() -> void:
	hint_panel = UITheme.panel("chip.png", 8, 12)
	hint_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hint_label = UITheme.label("", 18)
	hint_panel.add_child(hint_label)
	add_child(hint_panel)
	hint_panel.visible = false


func _update_hint() -> void:
	if hint_label == null:
		return
	var t := ""
	var gs := GameState
	if gs.total_taps < 5:
		t = "Toque na água do riacho para coletar água"
	elif gs.placed.size() <= 6:
		t = "Abra  Construir  e compre flores ou plantas para o riacho"
	elif gs.upgrade_level("filter") == 0 and gs.stage == 1:
		t = "Em  Melhorias,  o filtro de cascalho limpa a água"
	elif gs.stage == 1:
		t = "Beleza 15 e vitalidade 25% fazem o riacho florescer"
	hint_label.text = t
	hint_panel.visible = t != "" and not drawer_open and place_id == "" and not remove_mode
	hint_panel.reset_size()
	_pin(hint_panel, Vector2(0.5, 1), Vector2(-60, -24))


# ------------------------------------------------------------------ drawer
func _build_drawer() -> void:
	drawer = UITheme.panel("panel.png", 12, 14)
	drawer.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	drawer.offset_left = 10
	drawer.offset_right = -10
	drawer.offset_top = 10
	drawer.offset_bottom = 300
	drawer.mouse_filter = Control.MOUSE_FILTER_STOP
	drawer.visible = false
	add_child(drawer)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	drawer.add_child(v)
	var head := HBoxContainer.new()
	v.add_child(head)
	drawer_title = UITheme.label("", 22, Palette.ACCENT)
	drawer_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(drawer_title)
	var close := TextureButton.new()
	close.texture_normal = load(UITheme.ICONS + "close.png")
	close.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	close.ignore_texture_size = true
	close.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
	close.custom_minimum_size = Vector2(44, 36)
	close.pressed.connect(close_drawer)
	head.add_child(close)
	drawer_body = MarginContainer.new()
	drawer_body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(drawer_body)


const PANEL_TITLES := {"build": "Construir", "upgrades": "Melhorias", "eco": "Ecossistema", "info": "Informações",
	"journal": "Diário de biodiversidade"}
const PANEL_HEIGHT := {"journal": 430, "build": 318, "upgrades": 300, "eco": 420, "info": 440}


func open_panel(name: String) -> void:
	cancel_modes()
	if drawer_open and drawer_name == name:
		close_drawer()
		return
	if drawer_content:
		drawer_content.queue_free()
		drawer_content = null
	var script_path := {"build": "res://scripts/ui/BuildPanel.gd", "upgrades": "res://scripts/ui/UpgradePanel.gd",
		"eco": "res://scripts/ui/EcoPanel.gd", "info": "res://scripts/ui/InfoPanel.gd",
		"journal": "res://scripts/ui/JournalPanel.gd"}[name] as String
	drawer_content = load(script_path).new()
	drawer_content.set("hud", self)
	drawer_body.add_child(drawer_content)
	drawer_title.text = PANEL_TITLES[name]
	drawer_name = name
	var h := float(PANEL_HEIGHT[name])
	var was_open := drawer_open
	drawer_open = true
	drawer.visible = true
	buttons.visible = false
	hint_panel.visible = false
	drawer.offset_top = -h - 10
	drawer.offset_bottom = -10
	if not was_open:
		drawer.position.y += h + 20
		var t := create_tween()
		t.tween_property(drawer, "position:y", drawer.position.y - h - 20, 0.22) \
			.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	AudioManager.play("panel", 0.04, -8.0)


func close_drawer() -> void:
	if not drawer_open:
		return
	drawer_open = false
	var t := create_tween()
	t.tween_property(drawer, "position:y", drawer.position.y + drawer.size.y + 20, 0.18) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	t.tween_callback(func() -> void:
		drawer.visible = false
		if drawer_content:
			drawer_content.queue_free()
			drawer_content = null
		drawer_name = "")
	buttons.visible = true
	_update_hint()


# ------------------------------------------------------------------ placement mode
func _build_mode_bar() -> void:
	mode_bar = UITheme.panel("panel.png", 12, 12)
	mode_bar.mouse_filter = Control.MOUSE_FILTER_STOP
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 14)
	mode_bar.add_child(h)
	mode_label = UITheme.label("", 18)
	mode_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	h.add_child(mode_label)
	var other := Button.new()
	other.text = "Escolher outro"
	other.custom_minimum_size = Vector2(0, 52)
	other.pressed.connect(func() -> void: open_panel("build"))
	h.add_child(other)
	var done := Button.new()
	done.text = "Concluir"
	done.custom_minimum_size = Vector2(130, 52)
	done.pressed.connect(cancel_modes)
	h.add_child(done)
	mode_bar.visible = false
	add_child(mode_bar)


## Buy an element: it is added to the scene automatically.
func buy_item(id: String) -> void:
	var d: Dictionary = world.buy(id)
	if d.is_empty():
		toast(world.last_buy_error)
		AudioManager.play("error", 0.0, -6.0)
		return
	var it: Dictionary = GameData.items[id]
	AudioManager.play("place_rock" if it["category"] == "rocks" or it["category"] == "structures" else "place_plant", 0.1, -3.0)
	_on_floating_text(Vector2(float(d["x"]), float(d["y"])) + Vector2(0, -14), "+%d beleza" % int(it["beauty"]), Palette.ACCENT)
	if id == "bridge":
		toast("A ponte foi construída: os visitantes já podem atravessar o riacho.", Palette.GOLD)
	if drawer_content and drawer_content.has_method("refresh_card"):
		drawer_content.refresh_card(id)


## Legacy manual placement (v0.1-0.2), kept for dev tools only.
func start_placement(id: String) -> void:
	var it: Dictionary = GameData.items[id]
	if GameState.stage < int(it.get("unlock_stage", 1)):
		toast("Disponível no estágio %d" % int(it["unlock_stage"]))
		AudioManager.play("error", 0.0, -6.0)
		return
	close_drawer()
	place_id = id
	remove_mode = false
	place_variant = randi() % int(it.get("variants", 1))
	_show_mode_bar("Toque no cenário para posicionar: %s" % it["name"])


func start_remove() -> void:
	close_drawer()
	place_id = ""
	remove_mode = true
	_show_mode_bar("Toque em um elemento para removê-lo (50% de volta)")


func _show_mode_bar(text: String) -> void:
	mode_label.text = text
	mode_bar.visible = true
	buttons.visible = false
	hint_panel.visible = false
	mode_bar.reset_size()
	_pin(mode_bar, Vector2(0.5, 1), Vector2(0, -14))


func cancel_modes() -> void:
	place_id = ""
	remove_mode = false
	world.hide_ghost()
	mode_bar.visible = false
	if not drawer_open:
		buttons.visible = true
	_update_hint()


## Called by Main for touches on the world. Return true to consume.
func world_touch(e: InputEventScreenTouch, wp: Vector2) -> bool:
	if place_id != "":
		if e.pressed:
			_touch_down = true
			world.show_ghost(place_id, place_variant, wp)
		elif _touch_down:
			_touch_down = false
			_try_place(wp)
		return true
	if remove_mode:
		if not e.pressed:
			var it := world.item_at(wp)
			if it:
				var name: String = GameData.items[it.id]["name"]
				GameState.remove_item(it.uid)
				AudioManager.play("rustle", 0.1, -4.0)
				toast("%s removido" % name)
		return true
	return false


func world_drag(_e: InputEventScreenDrag, wp: Vector2) -> void:
	if place_id != "" and _touch_down:
		world.show_ghost(place_id, place_variant, wp)


func _try_place(wp: Vector2) -> void:
	var err := world.placement_error(place_id, wp)
	if err != "":
		world.hide_ghost()
		toast(err)
		AudioManager.play("error", 0.0, -6.0)
		return
	var cost := GameState.item_cost(place_id)
	if not GameState.can_afford(cost):
		world.hide_ghost()
		toast("Recursos insuficientes")
		AudioManager.play("error", 0.0, -6.0)
		return
	var d := GameState.place_item(place_id, wp.round(), place_variant)
	world.hide_ghost()
	if not d.is_empty():
		var it: Dictionary = GameData.items[place_id]
		AudioManager.play("place_rock" if it["category"] == "rocks" else "place_plant", 0.1, -3.0)
		_on_floating_text(wp + Vector2(0, -10), "+%d beleza" % int(it["beauty"]), Palette.ACCENT)
		place_variant = randi() % int(it.get("variants", 1))
		mode_label.text = "Toque no cenário para posicionar: %s  ·  próximo: %s" % [it["name"],
			_cost_text(GameState.item_cost(place_id))]
		mode_bar.reset_size()
		_pin(mode_bar, Vector2(0.5, 1), Vector2(0, -14))


func _cost_text(c: Dictionary) -> String:
	var s := "%s água" % NumFmt.short(c["water"])
	if float(c["seeds"]) > 0:
		s += " + %s sementes" % NumFmt.short(c["seeds"])
	return s


# ------------------------------------------------------------------ feedback
func _on_water_tapped(_p: Vector2, _g: Dictionary) -> void:
	if GameState.total_taps == 5:
		_update_hint()


func _on_floating_text(wp: Vector2, text: String, color: Color) -> void:
	var l := UITheme.label(text, 20, color)
	l.add_theme_constant_override("outline_size", 6)
	l.add_theme_color_override("font_outline_color", Color(0.04, 0.09, 0.12, 0.9))
	float_layer.add_child(l)
	l.reset_size()
	var sp: Vector2 = main.world_to_screen(wp)
	l.position = sp - Vector2(l.size.x / 2.0, l.size.y)
	var t := l.create_tween()
	t.set_parallel(true)
	t.tween_property(l, "position:y", l.position.y - 46, 1.1).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	t.tween_property(l, "modulate:a", 0.0, 1.1).set_delay(0.35)
	t.chain().tween_callback(l.queue_free)


var _photo_msg := ""


## Shown when the player leaves photo mode (the HUD is hidden while taking photos).
func toast_queue_after_photo(path: String) -> void:
	_photo_msg = "Foto salva: " + path.get_file()


func _notification(what: int) -> void:
	if what == NOTIFICATION_VISIBILITY_CHANGED and visible and _photo_msg != "":
		toast(_photo_msg, Palette.ACCENT)
		_photo_msg = ""


func toast(text: String, color: Color = Palette.TEXT) -> void:
	_toast_queue.append([text, color])
	if not _toast_busy:
		_next_toast()


func _next_toast() -> void:
	if _toast_queue.is_empty():
		_toast_busy = false
		return
	_toast_busy = true
	var item: Array = _toast_queue.pop_front()
	var p := UITheme.panel("chip.png", 8, 12)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var l := UITheme.label(item[0], 18, item[1])
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	p.add_child(l)
	p.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	toast_box.add_child(p)
	p.modulate.a = 0.0
	var t := p.create_tween()
	t.tween_property(p, "modulate:a", 1.0, 0.2)
	t.tween_interval(2.2)
	t.tween_property(p, "modulate:a", 0.0, 0.3)
	t.tween_callback(p.queue_free)
	get_tree().create_timer(0.9).timeout.connect(_next_toast)


func _on_species(id: String) -> void:
	var sp: Dictionary = GameData.species.get(id, {})
	if sp.is_empty():
		return
	if sp.get("kind", "") == "animal":
		toast("Nova espécie descoberta: %s!" % sp["name"], Palette.GOLD)
	else:
		toast("Nova planta no ecossistema: %s" % sp["name"], Palette.ACCENT)
	AudioManager.play("discover", 0.0, -4.0)


func _on_stage_changed(stage: int) -> void:
	var info := GameData.stage_info(stage)
	AudioManager.play("stage_up", 0.0, -2.0)
	_banner("Estágio %d" % stage, String(info["name"]), String(info["desc"]))


func _banner(small: String, big: String, desc: String) -> void:
	var p := UITheme.panel("panel.png", 12, 24)
	p.mouse_filter = Control.MOUSE_FILTER_STOP
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 6)
	p.add_child(v)
	for l in [UITheme.label(small.to_upper(), 18, Palette.TEXT_MUTED), UITheme.label(big, 40, Palette.GOLD),
			UITheme.label(desc, 18, Palette.TEXT)]:
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(l)
	overlay.add_child(p)
	p.reset_size()
	_pin(p, Vector2(0.5, 0.5), Vector2.ZERO)
	p.pivot_offset = p.size / 2.0
	p.scale = Vector2(0.85, 0.85)
	p.modulate.a = 0.0
	var t := p.create_tween()
	t.set_parallel(true)
	t.tween_property(p, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	t.tween_property(p, "modulate:a", 1.0, 0.3)
	var close := func() -> void:
		if not is_instance_valid(p):
			return
		var t2 := p.create_tween()
		t2.tween_property(p, "modulate:a", 0.0, 0.4)
		t2.tween_callback(p.queue_free)
	p.gui_input.connect(func(e: InputEvent) -> void:
		if e is InputEventScreenTouch and not e.pressed:
			close.call())
	get_tree().create_timer(6.0).timeout.connect(close)


func show_welcome(r: Dictionary) -> void:
	var p := UITheme.panel("panel.png", 12, 24)
	p.mouse_filter = Control.MOUSE_FILTER_STOP
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	p.add_child(v)
	var title := UITheme.label("Bem-vindo de volta ao riacho", 28, Palette.GOLD)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(title)
	var away := "Você esteve fora por %s." % NumFmt.duration(float(r["elapsed"]))
	if bool(r.get("capped", false)):
		away += " (o riacho trabalha até %dh sem você)" % int(r["cap_hours"])
	var l1 := UITheme.label(away, 18, Palette.TEXT_MUTED)
	l1.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(l1)
	var h := HBoxContainer.new()
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	h.add_theme_constant_override("separation", 10)
	h.add_child(UITheme.icon("water", 36))
	h.add_child(UITheme.label("+" + NumFmt.short(float(r["water"])), 28))
	h.add_child(UITheme.icon("seed", 36))
	h.add_child(UITheme.label("+" + NumFmt.short(float(r["seeds"])), 28))
	v.add_child(h)
	var b := Button.new()
	b.text = "Continuar"
	b.custom_minimum_size = Vector2(200, 56)
	b.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	b.pressed.connect(func() -> void:
		AudioManager.play("click", 0.05, -6.0)
		p.queue_free())
	v.add_child(b)
	overlay.add_child(p)
	p.reset_size()
	_pin(p, Vector2(0.5, 0.5), Vector2.ZERO)
