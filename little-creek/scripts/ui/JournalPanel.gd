extends HBoxContainer
## Biodiversity journal: animal species (silhouettes until discovered) with
## illustration, description, sightings, activity time, preferred season,
## habitat, curiosity and first-sighting date; plus a log of special events.

var hud: Node
var _list: GridContainer
var _detail: VBoxContainer
var _selected := ""
var _showing_events := false
const ANIMALS := ["sabia", "saira", "butterfly", "dragonfly", "fish", "duck", "owl", "deer", "fox", "maned_wolf"]


func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 16)
	var left := VBoxContainer.new()
	left.custom_minimum_size = Vector2(520, 0)
	add_child(left)
	var tabs := HBoxContainer.new()
	tabs.add_theme_constant_override("separation", 8)
	left.add_child(tabs)
	var b1 := Button.new()
	b1.text = "Espécies (%d/%d)" % [_found(), ANIMALS.size()]
	b1.custom_minimum_size = Vector2(0, 42)
	b1.pressed.connect(func() -> void:
		_showing_events = false
		_show_detail(_selected))
	tabs.add_child(b1)
	var b2 := Button.new()
	b2.text = "Acontecimentos (%d)" % NatureLog.events.size()
	b2.custom_minimum_size = Vector2(0, 42)
	b2.pressed.connect(func() -> void:
		_showing_events = true
		_show_events())
	tabs.add_child(b2)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	left.add_child(scroll)
	_list = GridContainer.new()
	_list.columns = 5
	_list.add_theme_constant_override("h_separation", 6)
	_list.add_theme_constant_override("v_separation", 6)
	scroll.add_child(_list)
	for id in ANIMALS:
		_list.add_child(_cell(id))
	var dscroll := ScrollContainer.new()
	dscroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	dscroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	add_child(dscroll)
	_detail = VBoxContainer.new()
	_detail.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_detail.add_theme_constant_override("separation", 4)
	dscroll.add_child(_detail)
	for id in ANIMALS:
		if NatureLog.count(id) > 0 or GameState.discovered.has(id):
			_selected = id
			break
	if _selected == "":
		_selected = ANIMALS[0]
	_show_detail(_selected)


func _found() -> int:
	var n := 0
	for id in ANIMALS:
		if GameState.discovered.has(id):
			n += 1
	return n


func _tex(id: String) -> Texture2D:
	var key: String = GameData.species[id].get("sprite", id)
	if key == "butterfly":
		key = "butterfly_orange"
	var sf := SpriteLib.frames(key)
	for a in ["idle", "rest", "swim", "fly"]:
		if sf.has_animation(a):
			return sf.get_frame_texture(a, 0)
	return sf.get_frame_texture(sf.get_animation_names()[0], 0)


func _cell(id: String) -> Control:
	var known := GameState.discovered.has(id)
	var cell := UITheme.panel("card.png" if known else "card_locked.png", 8, 6)
	cell.custom_minimum_size = Vector2(98, 88)
	cell.mouse_filter = Control.MOUSE_FILTER_STOP
	var v := VBoxContainer.new()
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cell.add_child(v)
	var tex := _tex(id)
	var tr := UITheme.tex_rect(tex, UITheme.pixel_fit(tex, Vector2(80, 48)))
	tr.custom_minimum_size = Vector2(80, 50)
	if not known:
		tr.modulate = Color(0.04, 0.07, 0.09, 0.9)   # silhouette
	v.add_child(tr)
	var l := UITheme.label(GameData.species[id]["name"] if known else "???", 12, Palette.TEXT if known else Palette.TEXT_MUTED)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(84, 0)
	v.add_child(l)
	cell.gui_input.connect(func(e: InputEvent) -> void:
		if e is InputEventScreenTouch and not e.pressed:
			_showing_events = false
			_show_detail(id))
	return cell


func _clear() -> void:
	for c in _detail.get_children():
		c.queue_free()


func _row(label: String, value: String) -> void:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 8)
	var a := UITheme.label(label, 14, Palette.ACCENT)
	a.custom_minimum_size = Vector2(150, 0)
	h.add_child(a)
	var b := UITheme.label(value, 14, Palette.TEXT)
	b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(b)
	_detail.add_child(h)


func _show_detail(id: String) -> void:
	_selected = id
	_clear()
	var sp: Dictionary = GameData.species[id]
	var known := GameState.discovered.has(id)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 12)
	_detail.add_child(head)
	var tex := _tex(id)
	var big := UITheme.tex_rect(tex, UITheme.pixel_fit(tex, Vector2(150, 96)))
	big.custom_minimum_size = Vector2(150, 96)
	if not known:
		big.modulate = Color(0.04, 0.07, 0.09, 0.9)
	head.add_child(big)
	var tv := VBoxContainer.new()
	tv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(tv)
	tv.add_child(UITheme.label(sp["name"] if known else "Espécie desconhecida", 22, Palette.GOLD if known else Palette.TEXT_MUTED))
	var desc := UITheme.label(sp.get("desc", "") if known else "Ainda não foi avistada no riacho.", 14, Palette.TEXT)
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc.custom_minimum_size = Vector2(300, 0)
	tv.add_child(desc)
	if not known:
		_row("Pista", String(sp.get("hint", "")))
		return
	var s: Dictionary = NatureLog.sightings.get(id, {})
	_row("Avistamentos", str(int(s.get("count", 0))))
	_row("Mais ativo", String(sp.get("active", "—")))
	_row("Estação preferida", String(sp.get("season", "—")))
	_row("Habitat", String(sp.get("habitat", "—")))
	_row("Primeiro avistamento", Clock.stamp_string(float(s["first_h"])) if s.has("first_h") else "—")
	_row("Curiosidade", String(sp.get("fact", "—")))


func _show_events() -> void:
	_clear()
	_detail.add_child(UITheme.label("Acontecimentos especiais", 20, Palette.GOLD))
	if NatureLog.events.is_empty():
		_detail.add_child(UITheme.label("Nada registrado ainda. Observe o riacho com calma.", 14, Palette.TEXT_MUTED))
		return
	var evs: Array = NatureLog.events.duplicate()
	evs.reverse()
	for e in evs.slice(0, 30):
		var l := UITheme.label("• %s  —  %s" % [e["text"], Clock.stamp_string(float(e["h"]))], 14, Palette.TEXT)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size = Vector2(380, 0)
		_detail.add_child(l)
