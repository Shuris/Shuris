extends VBoxContainer
## Upgrades drawer: investments that raise production and water quality.

var hud: Node
var _rows: Dictionary = {}
const ICON_FOR := {"tap": "water", "spring": "quality", "filter": "quality", "seedbank": "seed",
	"corridor": "biodiversity", "rain": "clock"}


func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	var scroll := ScrollContainer.new()
	scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_child(scroll)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	scroll.add_child(row)
	for u in GameData.upgrades:
		row.add_child(_card(u))
	refresh()


func _card(u: Dictionary) -> Control:
	var id: String = u["id"]
	var locked := GameState.stage < int(u.get("unlock_stage", 1))
	var card := UITheme.panel("card_locked.png" if locked else "card.png", 8, 12)
	card.custom_minimum_size = Vector2(236, 0)
	card.mouse_filter = Control.MOUSE_FILTER_PASS
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 4)
	card.add_child(v)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 8)
	head.add_child(UITheme.icon(ICON_FOR.get(id, "upgrade"), 36))
	var nv := VBoxContainer.new()
	nv.add_theme_constant_override("separation", -2)
	var name := UITheme.label(u["name"], 17)
	name.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	name.custom_minimum_size = Vector2(170, 0)
	nv.add_child(name)
	var lvl := UITheme.label("", 14, Palette.ACCENT)
	nv.add_child(lvl)
	head.add_child(nv)
	v.add_child(head)
	var desc := UITheme.label(u["desc"], 14, Palette.TEXT_MUTED)
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc.custom_minimum_size = Vector2(212, 54)
	v.add_child(desc)
	var cost_holder := HBoxContainer.new()
	v.add_child(cost_holder)
	var btn := Button.new()
	btn.custom_minimum_size = Vector2(0, 50)
	btn.pressed.connect(func() -> void:
		if GameState.buy_upgrade(id):
			AudioManager.play("upgrade", 0.03, -3.0)
			var tw := card.create_tween()
			card.pivot_offset = card.size / 2.0
			tw.tween_property(card, "scale", Vector2(1.04, 1.04), 0.08)
			tw.tween_property(card, "scale", Vector2.ONE, 0.12)
		else:
			AudioManager.play("error", 0.0, -6.0)
		refresh(true))
	v.add_child(btn)
	_rows[id] = {"lvl": lvl, "cost": cost_holder, "btn": btn, "locked": locked, "u": u}
	return card


func refresh(force: bool = false) -> void:
	for id in _rows.keys():
		var r: Dictionary = _rows[id]
		var u: Dictionary = r["u"]
		var level := GameState.upgrade_level(id)
		var maxed := level >= int(u["max_level"])
		(r["lvl"] as Label).text = "Nível %d / %d" % [level, int(u["max_level"])]
		var btn: Button = r["btn"]
		if r["locked"]:
			btn.text = "Estágio %d" % int(u["unlock_stage"])
			btn.disabled = true
			continue
		if maxed:
			btn.text = "Máximo"
			btn.disabled = true
			continue
		var cost := GameState.upgrade_cost(id)
		btn.text = "Melhorar"
		btn.disabled = not GameState.can_afford(cost)
		var holder: HBoxContainer = r["cost"]
		if force or holder.get_child_count() == 0 or Engine.get_process_frames() % 3 == 0:
			for ch in holder.get_children():
				ch.queue_free()
			holder.add_child(UITheme.cost_row(cost, 16))
