extends VBoxContainer
## Build drawer: horizontally scrollable cards with a pixel preview, cost,
## quantity / limit and ecological effect. "Comprar" adds the element to the
## scene automatically (AutoPlacer chooses a natural spot).

var hud: Node
var _cards: Dictionary = {}  # id -> {card, cost_holder}
var _press := Vector2.ZERO


func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	var scroll := ScrollContainer.new()
	scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_child(scroll)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	scroll.add_child(row)
	var ids: Array = GameData.item_order.filter(func(k: String) -> bool: return not GameData.items[k].get("hidden", false))
	ids.sort_custom(func(a: String, b: String) -> bool:
		var sa := int(GameData.items[a].get("unlock_stage", 1))
		var sb := int(GameData.items[b].get("unlock_stage", 1))
		if sa != sb:
			return sa < sb
		return float(GameData.items[a]["cost"]["water"]) < float(GameData.items[b]["cost"]["water"]))
	for id in ids:
		row.add_child(_card(id))


func _tap_handler(cb: Callable) -> Callable:
	return func(e: InputEvent) -> void:
		if e is InputEventScreenTouch:
			if e.pressed:
				_press = e.position
			elif e.position.distance_to(_press) < 14.0:
				AudioManager.play("click", 0.05, -6.0)
				cb.call()


func _card(id: String) -> Control:
	var it: Dictionary = GameData.items[id]
	var locked := GameState.stage < int(it.get("unlock_stage", 1))
	var card := UITheme.panel("card_locked.png" if locked else "card.png", 8, 10)
	card.custom_minimum_size = Vector2(158, 0)
	card.mouse_filter = Control.MOUSE_FILTER_PASS
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 3)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(v)
	var tex := SpriteLib.tex(GameData.item_sprite_path(id, 0))
	var box := Control.new()
	box.custom_minimum_size = Vector2(138, 70)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var pv := UITheme.tex_rect(tex, UITheme.pixel_fit(tex, Vector2(136, 68)))
	box.add_child(pv)
	pv.position = ((box.custom_minimum_size - pv.custom_minimum_size) / 2.0).floor()
	if locked:
		pv.modulate = Color(0.25, 0.3, 0.3, 0.9)
		var lk := UITheme.icon("lock", 36)
		lk.position = Vector2(51, 17)
		box.add_child(lk)
	v.add_child(box)
	var name := UITheme.label(it["name"], 16, Palette.TEXT if not locked else Palette.TEXT_MUTED)
	name.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	name.custom_minimum_size = Vector2(138, 0)
	v.add_child(name)
	var qty := UITheme.label("", 14, Palette.ACCENT)
	v.add_child(qty)
	var holder := HBoxContainer.new()
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(holder)
	var fx := "+%d beleza" % int(it["beauty"])
	if float(it.get("vitality", 0)) > 0:
		fx += "  +%s vida" % str(it["vitality"]).trim_suffix(".0")
	v.add_child(UITheme.label(fx, 13, Palette.TEXT_MUTED))
	var extra := ""
	if it.has("quality"):
		extra = "limpa a água"
	elif it.get("flower", false):
		extra = "atrai borboletas"
	elif it.has("perch"):
		extra = "poleiro de pássaros"
	elif id == "bridge":
		extra = "travessia do riacho"
	elif it.has("poi"):
		extra = "para visitantes"
	elif float(it.get("seed_rate", 0)) > 0:
		extra = "gera sementes"
	if extra != "":
		v.add_child(UITheme.label(extra, 13, Palette.ACCENT))
	var btn := Button.new()
	btn.custom_minimum_size = Vector2(0, 46)
	btn.pressed.connect(func() -> void: hud.buy_item(id))
	v.add_child(btn)
	_cards[id] = {"holder": holder, "locked": locked, "qty": qty, "btn": btn}
	refresh_card(id)
	return card


func _remove_card() -> Control:
	var card := UITheme.panel("card_locked.png", 8, 10)
	card.custom_minimum_size = Vector2(130, 0)
	card.mouse_filter = Control.MOUSE_FILTER_PASS
	card.gui_input.connect(_tap_handler(func() -> void: hud.start_remove()))
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	card.add_child(v)
	var ic := UITheme.icon("remove", 48)
	ic.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	v.add_child(ic)
	var l := UITheme.label("Remover", 16)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(l)
	var l2 := UITheme.label("devolve 50%", 13, Palette.TEXT_MUTED)
	l2.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(l2)
	return card


func refresh_card(id: String) -> void:
	var c: Dictionary = _cards[id]
	var n := GameState.item_count(id)
	var lim := GameState.item_limit(id)
	(c["qty"] as Label).text = "Quantidade: %d/%d" % [n, lim]
	var btn: Button = c["btn"]
	var holder: HBoxContainer = c["holder"]
	for ch in holder.get_children():
		ch.queue_free()
	if c["locked"]:
		holder.add_child(UITheme.label("Estágio %d" % int(GameData.items[id]["unlock_stage"]), 14, Palette.WARN))
		btn.text = "Bloqueado"
		btn.disabled = true
		return
	if n >= lim:
		holder.add_child(UITheme.label("Completo", 14, Palette.GOLD))
		btn.text = "Completo"
		btn.disabled = true
		return
	holder.add_child(UITheme.label("Próxima:", 13, Palette.TEXT_MUTED))
	holder.add_child(UITheme.cost_row(GameState.item_cost(id), 15))
	btn.text = "Comprar"
	btn.disabled = not GameState.can_afford(GameState.item_cost(id))


var _refresh_accum := 0


func refresh() -> void:
	_refresh_accum += 1
	if _refresh_accum % 3 != 0:
		return
	for id in _cards.keys():
		refresh_card(id)
