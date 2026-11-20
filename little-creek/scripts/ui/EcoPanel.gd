extends HBoxContainer
## Ecosystem drawer: health indicators, next-stage checklist and the species
## journal (discovered animals and plants).

var hud: Node
var _stats: VBoxContainer
var _req: VBoxContainer


func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 18)
	_stats = VBoxContainer.new()
	_stats.custom_minimum_size = Vector2(330, 0)
	_stats.add_theme_constant_override("separation", 6)
	add_child(_stats)
	_req = VBoxContainer.new()
	_req.custom_minimum_size = Vector2(300, 0)
	_req.add_theme_constant_override("separation", 6)
	add_child(_req)
	var journal := VBoxContainer.new()
	journal.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	add_child(journal)
	journal.add_child(UITheme.label("Diário de espécies", 18, Palette.ACCENT))
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	journal.add_child(scroll)
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 8)
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(grid)
	var order := ["sabia", "saira", "butterfly", "dragonfly", "fish", "deer",
		"grass", "flowers", "fern", "shrub", "fungi", "aquatic", "tree", "tree_big", "moss"]
	for id in order:
		grid.add_child(_species_cell(id))
	refresh()


func _species_cell(id: String) -> Control:
	var sp: Dictionary = GameData.species[id]
	var known := GameState.discovered.has(id)
	var cell := UITheme.panel("card.png" if known else "card_locked.png", 8, 8)
	cell.custom_minimum_size = Vector2(190, 0)
	cell.mouse_filter = Control.MOUSE_FILTER_PASS
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 6)
	cell.add_child(h)
	var tex: Texture2D = _species_tex(id)
	var tr := UITheme.tex_rect(tex, UITheme.pixel_fit(tex, Vector2(48, 40)) if tex else Vector2(40, 40))
	tr.custom_minimum_size = Vector2(48, 40)
	if not known:
		tr.modulate = Color(0.05, 0.08, 0.1, 0.85)
	h.add_child(tr)
	var l := UITheme.label(sp["name"] if known else "???", 14, Palette.TEXT if known else Palette.TEXT_MUTED)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(120, 0)
	l.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	h.add_child(l)
	cell.gui_input.connect(func(e: InputEvent) -> void:
		if e is InputEventScreenTouch and not e.pressed:
			hud.toast(("%s — %s" % [sp["name"], sp["hint"]]) if known else ("Dica: " + String(sp["hint"]))))
	return cell


func _species_tex(id: String) -> Texture2D:
	var sp: Dictionary = GameData.species[id]
	if sp.has("sprite"):
		var key: String = sp["sprite"]
		if key == "butterfly":
			key = "butterfly_orange"
		var sf := SpriteLib.frames(key)
		var anim: StringName = sf.get_animation_names()[0]
		if sf.has_animation(&"idle"):
			anim = &"idle"
		elif sf.has_animation(&"rest"):
			anim = &"rest"
		return sf.get_frame_texture(anim, 0)
	var item_for := {"grass": "grass", "flowers": "flowers", "fern": "fern", "shrub": "shrub", "fungi": "log",
		"aquatic": "aquatic", "tree": "tree_small", "tree_big": "tree_big"}
	if item_for.has(id):
		var iid: String = item_for[id]
		var p := GameData.item_moss_path(iid, 0) if iid == "log" else GameData.item_sprite_path(iid, 0)
		return SpriteLib.tex(p)
	if id == "moss":
		return SpriteLib.tex("res://assets/sprites/rocks/small_rock_0_moss.png")
	return null


func _bar_row(icon_name: String, title: String, value_text: String, frac: float, fill: String) -> Control:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 0)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 6)
	h.add_child(UITheme.icon(icon_name, 24))
	var t := UITheme.label(title, 16)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(t)
	h.add_child(UITheme.label(value_text, 16, Palette.ACCENT))
	v.add_child(h)
	if frac >= 0.0:
		var pb := ProgressBar.new()
		pb.show_percentage = false
		pb.max_value = 1.0
		pb.step = 0.001
		pb.value = frac
		pb.custom_minimum_size = Vector2(0, 12)
		pb.add_theme_stylebox_override("fill", UITheme.sbt(fill, 2, 0))
		v.add_child(pb)
	return v


func refresh() -> void:
	for c in _stats.get_children():
		c.queue_free()
	for c in _req.get_children():
		c.queue_free()
	var gs := GameState
	_stats.add_child(_bar_row("quality", "Qualidade da água", "%d" % int(gs.quality), gs.quality / 100.0, "bar_fill_water.png"))
	_stats.add_child(_bar_row("vitality", "Vitalidade", "%d%%" % int(gs.vitality), gs.vitality / 100.0, "bar_fill.png"))
	_stats.add_child(_bar_row("biodiversity", "Biodiversidade", "%d espécies" % gs.biodiversity, gs.biodiversity / 15.0, "bar_fill_gold.png"))
	_stats.add_child(_bar_row("beauty", "Beleza", "%d" % int(gs.beauty), -1.0, ""))
	_stats.add_child(_bar_row("reputation", "Reputação", "%d" % int(gs.reputation), -1.0, ""))
	_stats.add_child(UITheme.label("Produção ×%.2f (bônus de biodiversidade)" % gs.multiplier, 14, Palette.TEXT_MUTED))
	var next := gs.stage + 1
	if next > GameData.stages.size():
		_req.add_child(UITheme.label("Refúgio completo", 18, Palette.GOLD))
		var l := UITheme.label("O riacho é um refúgio natural. Continue cuidando dele e recebendo visitantes.", 15, Palette.TEXT_MUTED)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_req.add_child(l)
		return
	var info := GameData.stage_info(next)
	_req.add_child(UITheme.label("Próximo: %s" % info["name"], 18, Palette.ACCENT))
	var d := UITheme.label(info["desc"], 14, Palette.TEXT_MUTED)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	d.custom_minimum_size = Vector2(290, 0)
	_req.add_child(d)
	var names := {"beauty": "Beleza", "vitality": "Vitalidade", "biodiversity": "Biodiversidade"}
	var req: Dictionary = info["req"]
	for k in req.keys():
		var have := gs.stat_value(k)
		var need := float(req[k])
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 6)
		h.add_child(UITheme.icon("check" if have >= need else "lock", 24))
		h.add_child(UITheme.label("%s  %d / %d%s" % [names[k], int(have), int(need), "%" if k == "vitality" else ""], 16,
			Palette.TEXT if have >= need else Palette.TEXT_MUTED))
		_req.add_child(h)


var _tick := 0


func _process(_d: float) -> void:
	_tick += 1
	if _tick % 60 == 0:
		refresh()
