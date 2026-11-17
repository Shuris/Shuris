class_name TownLife
extends Node2D
## Vida de cada local (porte de HubScene.ts): móveis e melhorias compradas, moradores
## (com fala ao clicar e nome ao passar o mouse), rivais amigos, figurantes andando,
## pombos, pássaros, fumaça, vapor, chuva, neblina, folhas de outono e guirlandas.

const GROUND := 312.0
const RAIN_ON := 0.35
const MONK_EVERY := 30.0
const CLOTH := [0x4a6aa8, 0xd8c890, 0x9a4a3a, 0x6a8a5a, 0xe8dcc0, 0x7a5a8a]

var view: LocationView
var loc: String
var props: Array = []        # colisão: {x, y, w}
var npcs: Array = []         # {g, speed, min, max, pause, leaving}
var talkers: Array = []      # {g, line, head, name, rival}
var drills: Array = []       # {t, period, run}
var pigeons: Array = []
var raining := false
var was_open := true
var open_check := 0.5
var chat_timer := 6.0
var monk: Sprite2D = null
var monk_t := 0.0
var palus: Sprite2D = null
var hover = null
var ring: Line2D
var hover_label: Label
var rain_layer: Node2D = null
var drops: Array = []
var fog: Array = []
var leaves: Array = []
var people_nodes: Array = []
var bird_t := 3.8
var puff_t := 0.0
var thunder_t := 12.0


func depth(y: float) -> int:
	return int(y) - 240


static func rnd(n: int) -> int:
	return randi() % n


func setup(v: LocationView) -> void:
	view = v
	loc = v.loc.id
	var p := Game.p
	raining = bool(v.loc.outdoor) and float(Weather.now(int(p.createdAt), int(p.day)).rain) > RAIN_ON
	ring = Line2D.new()
	ring.width = 1
	ring.default_color = Color8(255, 228, 154)
	ring.closed = true
	for k in 16:
		var a := TAU * k / 16.0
		ring.add_point(Vector2(cos(a) * 13, sin(a) * 3.5).round())
	ring.visible = false
	add_child(ring)
	hover_label = _world_label("", Color8(255, 228, 154), 16)
	hover_label.visible = false
	hover_label.z_index = 200
	add_child(hover_label)
	_spawn_props()
	_spawn_people()
	if v.loc.outdoor:
		_setup_weather()


# ------------------------------------------------------------------ móveis
func _prop(name: String, x: float, y: float, w := -1.0, scale := 1.0) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = Ui.tex("res://assets/sprites/fx/%s.png" % name)
	s.centered = false
	s.offset = Vector2(-s.texture.get_width() / 2.0, -s.texture.get_height())
	s.position = Vector2(x, y + 3)
	s.scale = Vector2(scale, scale)
	s.z_index = depth(y)
	add_child(s)
	props.append({"x": x, "y": y, "w": w if w >= 0 else s.texture.get_width() * scale / 2.0})
	return s


func _flat(name: String, x: float, y: float, z := -5) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = Ui.tex("res://assets/sprites/fx/%s.png" % name)
	s.centered = false
	s.offset = Vector2(-s.texture.get_width() / 2.0, -s.texture.get_height())
	s.position = Vector2(x, y)
	s.z_index = z
	add_child(s)
	return s


func blocked(x: float, y: float, r := 6.0) -> bool:
	for p in props:
		if absf(x - p.x) < p.w + r and absf(y - p.y) < 7:
			return true
	return false


func free_x(x: float, y: float) -> float:
	for d in range(0, 120, 4):
		if not blocked(x + d, y):
			return x + d
		if not blocked(x - d, y):
			return x - d
	return x


func _spawn_props() -> void:
	var ups: Array = Game.p.upgrades
	match loc:
		"tavern":
			_prop("prop_table", 214, 300, 24)
			_prop("prop_table", 290, 300, 24)
			_prop("prop_stool", 190, 308, 7)
			_prop("prop_stool", 314, 308, 7)
			_prop("prop_barrel", 548, 316, 8)
			_prop("prop_sacks", 580, 318, 12)
		"market":
			_prop("prop_crates", 200, 290, 18)
			_prop("prop_basket_fruit", 260, 294, 11)
			_prop("prop_basket_bread", 284, 296, 11)
			_prop("prop_amphorae", 432, 290, 14)
			_prop("prop_barrel", 466, 292, 8)
			_prop("prop_barrel", 482, 294, 8)
			_prop("prop_sacks", 148, 296, 12)
			_prop("forge", 536, 314, 30)
			_light(526, GROUND - 14, 80, Color8(255, 152, 80), 1.1)
		"home":
			_flat("prop_home_rug", 340, 320)
			_flat("prop_home_sandals", 384, 316)
			_prop("prop_home_amphora", 193, 309, 7)
			_prop("prop_home_table", 247, 308, 21)
			var fl := _anim_sprite("lamp_flame", 6, 8, 4, 8)
			fl.position = Vector2(244, 280)
			fl.z_index = depth(308) + 1
			_prop("prop_home_stool", 277, 308, 9)
			_prop("prop_home_chest", 466, 309, 15)
			_prop("prop_bed_noble" if ups.has("bed_noble") else ("prop_bed_wool" if ups.has("bed_wool") else "prop_bed_straw"), 419, 309, 33)
		"baths":
			_prop("prop_plant", 182, 304, 7)
			_prop("prop_bench", 236, 304, 24)
			_prop("prop_bench", 432, 304, 24)
			_prop("prop_towels", 476, 306, 10)
			_prop("prop_home_amphora", 498, 306, 7)
			_prop("prop_plant", 524, 304, 7)
		"ludus":
			props.append({"x": 352, "y": GROUND, "w": 6})
			_prop("prop_shields", 132, 242, 15)
			_prop("prop_trough", 225, 242, 26)
			_prop("prop_rack", 495, 242, 26)
			_prop("prop_barrel", 168, 300, 8)
			_prop("prop_basket_bread", 186, 302, 11)
			palus = Sprite2D.new()
			palus.texture = Ui.tex("res://assets/sprites/fx/%s.png" % ("palus_iron" if ups.has("iron_palus") else "palus"))
			palus.hframes = 2
			palus.centered = false
			palus.offset = Vector2(-12, -56)
			palus.position = Vector2(352, GROUND)
			palus.z_index = depth(GROUND)
			if ups.has("bronze_palus"):
				palus.modulate = Color8(232, 168, 96)
			add_child(palus)
			# equipamentos comprados (segundo nível: em bronze)
			if ups.has("stone_weights"):
				_flat("up_weights", 300, GROUND - 30, 2).modulate = Color8(232, 168, 96) if ups.has("bronze_weights") else Color.WHITE
			if ups.has("bronze_weights"):
				var w2 := _flat("up_weights", 286, GROUND - 30, 2)
				w2.scale = Vector2(0.8, 0.8)
				w2.modulate = Color8(216, 144, 72)
			if ups.has("agility_stakes"):
				_flat("up_stakes", 244, GROUND - 26, 2).modulate = Color8(232, 168, 96) if ups.has("swing_stakes") else Color.WHITE
			if ups.has("sand_track"):
				_flat("up_track", 330, GROUND - 42, 1).modulate = Color8(232, 168, 96) if ups.has("long_track") else Color.WHITE


func _light(x: float, y: float, radius: float, color: Color, power: float) -> void:
	var pl := PointLight2D.new()
	pl.texture = LocationView._light_texture()
	pl.position = Vector2(x, y)
	pl.texture_scale = radius / 64.0
	pl.color = color
	pl.set_meta("power", power)
	add_child(pl)
	view.lights.append(pl)


func _anim_sprite(name: String, fw: int, fh: int, frames: int, fps: float, first := 0) -> AnimatedSprite2D:
	var sf := SpriteFrames.new()
	sf.add_animation("a")
	sf.set_animation_speed("a", fps)
	var t: Texture2D = Ui.tex("res://assets/sprites/fx/%s.png" % name)
	for i in frames:
		var at := AtlasTexture.new()
		at.atlas = t
		at.region = Rect2((first + i) * fw, 0, fw, fh)
		sf.add_frame("a", at)
	var s := AnimatedSprite2D.new()
	s.sprite_frames = sf
	s.centered = false
	s.offset = Vector2(-fw / 2.0, -fh)
	s.play("a")
	add_child(s)
	return s


# ------------------------------------------------------------------ pessoas
func person(long := false, gladiator := false, old := false, tint := -1) -> Dictionary:
	var ap := {"skin": rnd(5), "hairStyle": [1, 4, 6][rnd(3)] if long else [0, 2, 3, 5][rnd(4)],
		"hairColor": 5 if old else rnd(Data.d.hairColors.size() - 1), "beard": old or (not long and randf() < 0.45), "clothColor": rnd(Data.d.clothColors.size())}
	if gladiator:
		var gear := {"mainHand": Data.item("rudis" if randf() < 0.7 else "short_sword"), "offHand": Data.item("parmula" if randf() < 0.6 else "scutum")}
		if randf() < 0.4:
			gear.head = Data.item("leather_cap")
		return {"appearance": ap, "gear": gear, "extra": []}
	return {"appearance": ap, "gear": {}, "extra": [{"sheet": "robe" if long else "tunic", "tint": tint if tint >= 0 else CLOTH[rnd(6)]}]}


func _view(vis: Dictionary, x: float, y: float, scale := 1.0) -> Gladiator:
	var g := Gladiator.new()
	var ap: Dictionary = vis.appearance.duplicate()
	if vis.get("beast") != null:
		ap["_beast"] = vis.beast
	g.set_visual(ap, vis.get("gear", {}), vis.get("extra", []))
	g.position = Vector2(x, y)
	g.scale = Vector2(scale, scale)
	g.z_index = depth(y)
	g.set_process(false)
	g.play("idle", {"fps": 3})
	add_child(g)
	people_nodes.append(g)
	return g


func _npc(g: Gladiator, speed := 0.0, mn := -1.0, mx := -1.0) -> Dictionary:
	var n := {"g": g, "speed": speed, "min": mn if mn >= 0 else g.position.x, "max": mx if mx >= 0 else g.position.x, "pause": 0.0, "leaving": null, "left_at": 0.0}
	npcs.append(n)
	return n


func _talker(g: Node2D, line: String, head: float, name := "", rival := "", auto := false) -> void:
	talkers.append({"g": g, "line": line, "head": head, "name": name, "rival": rival, "auto": auto})


func _open() -> bool:
	return Calendar.is_open(view.loc, int(Game.p.minutes), int(Game.p.day))


func _spawn_people() -> void:
	for nd in people_nodes:
		if is_instance_valid(nd):
			nd.queue_free()
	people_nodes.clear()
	npcs.clear()
	talkers.clear()
	drills.clear()
	pigeons.clear()
	monk = null
	var ups: Array = Game.p.upgrades
	var open := _open()
	was_open = open
	if loc == "market":
		if open:
			_townsfolk()
		_market_extras(open, Events.merchant_here(Game.p))
	if loc == "ludus" and open:
		_ludus(ups)
	if loc == "tavern" and open:
		_tavern()
	if loc == "temple" and not raining:
		monk = Sprite2D.new()
		monk.texture = Ui.tex("res://assets/sprites/fx/monk.png")
		monk.hframes = 2
		monk.centered = false
		monk.offset = Vector2(-24, -44)
		monk.position = Vector2(424, GROUND + 2)
		monk.z_index = depth(GROUND + 2)
		add_child(monk)
		people_nodes.append(monk)
		_talker(monk, "monk", 46, "", "", true)
	if open or loc == "forum" or loc == "temple":
		_city_folk()
	if open:
		_rivals()


func _rivals() -> void:
	var list := RivalTown.rivals_at(Game.p, loc)
	for i in list.size():
		var r = list[i]
		var def: Dictionary = r if r is Dictionary and r.has("appearance") else Data.opponent(str(r.id if r is Dictionary else r))
		if def.is_empty():
			continue
		var y := GROUND + 12 + (i % 2) * 8
		var vis: Dictionary = Stats.opponent_combatant(def).visual
		var g := _view(vis, free_x(236 + i * 88, y), y)
		g.set_facing(1)
		g.play("idle")
		_npc(g)
		_talker(g, "rival." + str(def.id), 50, str(def.name), str(def.id))


func _city_folk() -> void:
	var indoor := loc == "tavern" or loc == "home"
	if raining and not indoor:
		return
	var senator := func(): return {"appearance": {"skin": rnd(3), "hairStyle": [1, 6, 0][rnd(3)], "hairColor": 5, "beard": randf() < 0.5, "clothColor": 0}, "gear": {}, "extra": [{"sheet": "robe", "tint": 0xf4eee2}]}
	var soldier := func(): return {"appearance": {"skin": rnd(5), "hairStyle": 0, "hairColor": rnd(4), "beard": randf() < 0.3, "clothColor": 2},
		"gear": {"head": Data.item("galea"), "body": Data.item("medium_armor"), "mainHand": Data.item("spear"), "offHand": Data.item("scutum")}, "extra": []}
	var kid := func(): return {"appearance": {"skin": rnd(5), "hairStyle": [0, 3, 4, 6][rnd(4)], "hairColor": rnd(5), "beard": false, "clothColor": rnd(Data.d.clothColors.size())}, "gear": {},
		"extra": [{"sheet": "tunic", "tint": [0x4a6aa8, 0xd8c890, 0x9a4a3a, 0x6a8a5a][rnd(4)]}]}
	var animal := func(b: String): return {"appearance": {"skin": 0, "hairStyle": 0, "hairColor": 0, "beard": false, "clothColor": 0}, "gear": {}, "beast": b}
	var add := func(vis: Dictionary, x: float, y: float, scale: float, line: String, head: float, speed := 0.0):
		var g := _view(vis, x if speed != 0 else free_x(x, y), y, scale)
		g.set_facing(1 if speed >= 0 else -1)
		g.play("walk" if speed != 0 else "idle", {"fps": 8 if speed != 0 else 3})
		_npc(g, speed, 196, 480)
		_talker(g, line, head * scale if scale < 1 else head)
	match loc:
		"forum":
			add.call(senator.call(), 250, GROUND - 6, 1.0, "senator", 46, 14.0)
			add.call(senator.call(), 430, GROUND + 4, 1.0, "senator", 46, -11.0)
			add.call(soldier.call(), 372, GROUND - 16, 1.0, "soldier", 50)
			add.call(kid.call(), 300, GROUND + 14, 0.68, "kid", 46, 26.0)
			add.call(animal.call("dog"), 360, GROUND + 18, 0.5, "dog", 36, -30.0)
		"market":
			add.call(soldier.call(), 300, GROUND + 4, 1.0, "soldier", 50, 12.0)
			add.call(kid.call(), 260, GROUND + 18, 0.68, "kid", 46, -24.0)
			add.call(animal.call("dog"), 420, GROUND + 20, 0.5, "dog", 36, 28.0)
			add.call(animal.call("cat"), 214, GROUND - 4, 0.42, "cat", 34)
		"temple":
			add.call(senator.call(), 270, GROUND - 4, 1.0, "senator", 46)
		"tavern":
			add.call(animal.call("cat"), 196, GROUND + 6, 0.42, "cat", 34)
		"baths":
			add.call(kid.call(), 330, GROUND + 14, 0.68, "kid", 46, 20.0)
	if loc in ["forum", "temple", "market"]:
		for i in (6 if loc == "forum" else 3):
			var pg := _anim_sprite("pigeon", 16, 12, 2, 5, 2 if randf() < 0.5 else 0)
			pg.position = Vector2(210 + randf() * 260, GROUND + 6 + randf() * 22).round()
			pg.z_index = depth(pg.position.y)
			pg.flip_h = randf() < 0.5
			people_nodes.append(pg)
			pigeons.append({"s": pg, "vx": (randf() - 0.5) * 8, "flying": false})


func _townsfolk() -> void:
	var spots := [[252, GROUND - 50, 0, 1], [410, GROUND - 50, 0, -1]] if raining else \
		[[230, GROUND - 14, 0, 1], [404, GROUND - 14, 0, -1], [200, GROUND - 8, 20, 1], [470, GROUND + 10, 24, -1], [330, GROUND + 14, 17, 1]]
	for s in spots:
		var long := randf() < 0.45
		var vis := person(long)
		var x: float = s[0] if s[2] != 0 else free_x(s[0], s[1])
		var g := _view(vis, x, s[1], 0.88 if raining else 1.0)
		g.set_facing(s[3])
		g.play("walk" if s[2] != 0 else "idle", {"fps": 8 if s[2] != 0 else 4})
		_npc(g, float(s[2]) * s[3], 186, 488)
		_talker(g, "vendorRain" if raining else ("shopper" if s[2] != 0 else "vendor"), 46)


func _market_extras(open: bool, merchant: bool) -> void:
	if open and not raining:
		var smith := _view(person(false, false, false, 0x6a4a30), 584, GROUND + 2)
		smith.set_facing(-1)
		_npc(smith)
		_talker(smith, "smith", 46)
		drills.append({"t": 1.4, "period": 2.6, "run": func():
			if not is_instance_valid(smith):
				return
			smith.sequence([["attack", 0, 0.2], ["attack", 2, 0.15], ["attack", 3, 0.3], ["idle", 0, 9.0]])
			get_tree().create_timer(0.33).timeout.connect(func():
				Sfx.play("forge", 0.25)
				for i in 4:
					_spark(Vector2(552, GROUND - 16), Color8(255, 208, 112)))})
	if merchant and open:
		var cart := _prop("merchant_cart", 226, GROUND + 6, 40)
		people_nodes.append(cart)
		var m := _view(person(true, false, false, 0x7a3a8a), 278, GROUND + 4)
		m.set_facing(-1)
		_npc(m)
		_talker(m, "merchant", 46)


func _ludus(ups: Array) -> void:
	if raining:
		return
	var back_y := GROUND - 14
	var palus2 := Sprite2D.new()
	palus2.texture = Ui.tex("res://assets/sprites/fx/palus.png")
	palus2.hframes = 2
	palus2.centered = false
	palus2.offset = Vector2(-12, -56)
	palus2.position = Vector2(452, back_y)
	palus2.scale = Vector2(0.92, 0.92)
	palus2.z_index = depth(back_y)
	add_child(palus2)
	people_nodes.append(palus2)
	var medic_vis := person(true, false, true, 0xe8e0cc)
	var medic := _view(medic_vis, 196, GROUND - 6)
	medic.set_facing(1)
	medic.play("idle", {"fps": 2})
	_npc(medic)
	_talker(medic, "medicInjured" if Game.p.get("injury") != null else "medic", 46)
	var a := _view(person(false, true), 226, back_y, 0.92)
	var b := _view(person(false, true), 258, back_y, 0.92)
	b.set_facing(-1)
	_npc(a)
	_npc(b)
	var turn := [0]
	drills.append({"t": 0.6, "period": 1.5, "run": func():
		var atk: Gladiator = b if turn[0] % 2 else a
		var def: Gladiator = a if turn[0] % 2 else b
		turn[0] += 1
		var dir := 1 if atk == a else -1
		atk.sequence([["attack", 0, 0.22], ["attack", 1, 0.08], ["attack", 2, 0.18], ["attack", 3, 0.3], ["idle", 0, 9.0]])
		var x0 := atk.position.x
		var tw := create_tween()
		tw.tween_interval(0.3)
		tw.tween_property(atk, "position:x", x0 + dir * 6, 0.09)
		tw.tween_interval(0.12)
		tw.tween_property(atk, "position:x", x0, 0.09)
		get_tree().create_timer(0.3).timeout.connect(func():
			if randf() < 0.7:
				def.sequence([["block", 0, 0.35], ["idle", 0, 9.0]])
				Sfx.play("block", 0.3)
			else:
				def.sequence([["dodge", 0, 0.1], ["dodge", 1, 0.2], ["dodge", 2, 0.15], ["idle", 0, 9.0]]))})
	_talker(a, "trainee", 44)
	_talker(b, "trainee", 44)
	var c := _view(person(false, true), 426, back_y, 0.92)
	_npc(c)
	drills.append({"t": 1.1, "period": 1.25, "run": func():
		c.sequence([["attack", 0, 0.2], ["attack", 1, 0.08], ["attack", 2, 0.18], ["attack", 3, 0.25], ["idle", 0, 9.0]])
		get_tree().create_timer(0.29).timeout.connect(func():
			if is_instance_valid(palus2):
				palus2.frame = 1
				get_tree().create_timer(0.11).timeout.connect(func():
					if is_instance_valid(palus2):
						palus2.frame = 0))})
	_talker(c, "trainee", 44)
	var has_doc := ups.has("doctore")
	var doc_vis := person(true, false, true, 0x4a2a6a if ups.has("doctore_legend") else 0x6a2a24)
	doc_vis.gear = {"mainHand": Data.item("rudis")}
	var doc := _view(doc_vis, 288 if has_doc else 396, GROUND - 4 if has_doc else back_y - 6)
	doc.set_facing(1)
	_npc(doc)
	_talker(doc, "doctore" if has_doc else "instructor", 48)


func _tavern() -> void:
	var keeper := _view(person(true, false, false, 0x8a3a2a), 404, GROUND - 22)
	keeper.set_facing(-1)
	_npc(keeper)
	var front := Sprite2D.new()
	front.texture = Ui.tex("res://assets/sprites/fx/tavern_front.png")
	front.centered = false
	front.z_index = depth(GROUND - 6)
	add_child(front)
	people_nodes.append(front)
	_talker(keeper, "keeper", 48)
	var quintus := _view(person(false, false, true, 0x7a6a50), 214, GROUND - 20)
	quintus.set_facing(1)
	quintus.play("idle", {"fps": 2})
	_npc(quintus)
	_talker(quintus, "quintus", 46)
	var p := Game.p
	if Events.is_arm_night(int(p.day), int(p.minutes)):
		var tbl := _prop("arm_table", 128, GROUND + 10, 26)
		people_nodes.append(tbl)
		var va := person(false, true)
		va.gear = {}
		var vb := person(false, true)
		vb.gear = {}
		var a := _view(va, 110, GROUND + 2)
		var b := _view(vb, 146, GROUND + 2)
		b.set_facing(-1)
		for g in [a, b]:
			g.hold("block", 0)
			_npc(g)
		_talker(a, "armCheer", 46)
		drills.append({"t": 0.5, "period": 0.9, "run": func():
			var push: Gladiator = a if randf() < 0.5 else b
			var x0 := push.position.x
			var tw := create_tween()
			tw.tween_property(push, "position:x", x0 + (2 if push == a else -2), 0.2)
			tw.tween_property(push, "position:x", x0, 0.2)})
	var spots := [[290, GROUND - 20, -1, true], [252, GROUND + 14, 1, false], [452, GROUND + 10, -1, true]]
	var night := int(p.minutes) >= 19 * 60
	var rainy: bool = Weather.of_day(int(p.createdAt), int(p.day)).rainy
	var extra := [[158, GROUND + 6, 1, false], [520, GROUND + 12, -1, false], [384, GROUND + 18, 1, true], [190, GROUND + 20, 1, true],
		[560, GROUND + 4, -1, true], [330, GROUND + 22, -1, false], [228, GROUND - 22, 1, false], [480, GROUND + 22, -1, false]]
	var more := (3 if rainy else 0) + (2 if night else 0) + (3 if rainy and night else 0)
	spots.append_array(extra.slice(0, more))
	for s in spots:
		var vis := person(false, true) if s[3] else person()
		if s[3]:
			vis.gear = {}
		var g := _view(vis, free_x(s[0], s[1]), s[1])
		g.set_facing(s[2])
		g.play("idle", {"fps": 3 + randf() * 2})
		_npc(g)
		_talker(g, "patronRain" if rainy and talkers.size() % 2 == 1 else "patron", 46)


# ------------------------------------------------------------------ falas
func talk(tk: Dictionary) -> void:
	if tk.rival != "":
		var line: String = view.app_rival_talk(tk.rival)
		if line == "":
			return
		Balloon.speak(self, tk.g, line, tk.head)
		_heart(tk.g.position + Vector2(10, -tk.head - 4))
		return
	var line2 := Dialogue.npc_line(tk.line, randi() % 1000, {"name": Game.p.name})
	if line2 != "":
		Balloon.speak(self, tk.g, line2, tk.head)


## Fala pedida pela interface (taverna, médico, ferreiro...). false se ninguém daquele tipo está aqui.
func say(kind: String, text: String) -> bool:
	for tk in talkers:
		if tk.line == kind or (kind == "medic" and tk.line == "medicInjured") or (kind == "patron" and tk.line in ["armCheer", "patronRain"]) or (kind == "doctore" and tk.line == "doctore") or (kind == "instructor" and tk.line == "instructor"):
			if is_instance_valid(tk.g):
				Balloon.speak(self, tk.g, text, tk.head, 5.2)
				return true
	return false


func _heart(at: Vector2) -> void:
	var rows := [".XX.XX.", "XooXooX", "XoooooX", ".XoooX.", "..XoX..", "...X..."]
	var img := Image.create(7, 6, false, Image.FORMAT_RGBA8)
	for j in rows.size():
		for i in 7:
			var ch: String = rows[j][i]
			if ch != ".":
				img.set_pixel(i, j, Color8(90, 16, 16) if ch == "X" else Color8(232, 72, 90))
	var s := Sprite2D.new()
	s.texture = ImageTexture.create_from_image(img)
	s.position = at
	s.z_index = 210
	s.modulate.a = 0
	add_child(s)
	var tw := create_tween()
	tw.tween_property(s, "modulate:a", 1.0, 0.15)
	tw.parallel().tween_property(s, "position:y", at.y - 16, 1.4).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tw.tween_property(s, "modulate:a", 0.0, 0.4)
	tw.tween_callback(s.queue_free)
	Sfx.play("equip", 0.6)


func _hit_test(wp: Vector2):
	var best = null
	for tk in talkers:
		var g: Node2D = tk.g
		if not is_instance_valid(g):
			continue
		var h: float = tk.head
		if Rect2(g.position.x - 12, g.position.y - h - 6, 24, h + 8).has_point(wp):
			if best == null or g.position.y > best.g.position.y:
				best = tk
	return best


## Clique na cena: se acertou um morador, ele fala (e o gladiador não anda).
func click(wp: Vector2) -> bool:
	var tk = _hit_test(wp)
	if tk == null:
		return false
	talk(tk)
	return true


# ------------------------------------------------------------------ atualização
func _process(delta: float) -> void:
	if not Game.has_player():
		return
	var dt := minf(0.1, delta)
	_update_open(dt)
	_update_npcs(dt)
	_update_pigeons(dt)
	for d in drills:
		d.t -= dt
		if d.t <= 0:
			d.t += d.period
			if not view.busy:
				d.run.call()
	if monk:
		monk_t += dt
		monk.frame = int(monk_t / 1.1) % 2
	chat_timer -= dt
	if chat_timer <= 0:
		chat_timer = MONK_EVERY
		for tk in talkers:
			if tk.auto:
				talk(tk)
	view.hero.z_index = depth(view.hero.position.y) + 1
	# destaque ao passar o mouse
	hover = _hit_test(get_global_mouse_position())
	ring.visible = hover != null
	hover_label.visible = hover != null
	if hover != null:
		var g: Node2D = hover.g
		ring.position = g.position + Vector2(0, 1)
		ring.z_index = g.z_index - 1
		var nm: String = hover.name if hover.name != "" else I18n.tk("npcName." + str(hover.line), {}, "")
		hover_label.text = nm if nm != "" else "…"
		hover_label.position = Vector2(g.position.x - 80, g.position.y - float(hover.head) - 16)
	Input.set_default_cursor_shape(Input.CURSOR_POINTING_HAND if hover != null else Input.CURSOR_ARROW)
	_update_weather(dt)
	if view.loc.outdoor:
		bird_t -= dt
		if bird_t <= 0:
			bird_t = 3.8
			if not raining and randf() < 0.55:
				_flock()
	puff_t -= dt
	if loc == "tavern" and puff_t <= 0:
		puff_t = 0.38
		_puff(Vector2(140 + randf() * 24, 216), Color8(138, 128, 120), 0.45, -48, 3)
	elif loc == "baths" and puff_t <= 0:
		puff_t = 0.22
		_puff(Vector2(190 + randf() * 330, 252 + randf() * 34), Color8(246, 244, 238), 0.18, -34, 2)


func _update_open(dt: float) -> void:
	open_check -= dt
	if open_check > 0:
		return
	open_check = 0.5
	var open := _open()
	if was_open and not open:
		_depart_all()
	elif not was_open and open and npcs.is_empty():
		_spawn_people()
	was_open = open


func _depart_all() -> void:
	drills.clear()
	talkers = talkers.filter(func(t): return t.auto)
	var now := Time.get_ticks_msec() / 1000.0
	for i in npcs.size():
		var n: Dictionary = npcs[i]
		var left: bool = n.g.position.x < 330
		n.leaving = -60.0 if left else 700.0
		n.left_at = now
		n.speed = (-1.0 if left else 1.0) * (24 + (i % 3) * 4)
		n.pause = 0.2 + (i % 4) * 0.35


func _update_npcs(dt: float) -> void:
	var now := Time.get_ticks_msec() / 1000.0
	for i in range(npcs.size() - 1, -1, -1):
		var n: Dictionary = npcs[i]
		var g: Gladiator = n.g
		if not is_instance_valid(g):
			npcs.remove_at(i)
			continue
		g.tick(dt)
		if n.leaving != null:
			if now - n.left_at > 12:
				g.queue_free()
				npcs.remove_at(i)
				continue
			if n.pause > 0:
				n.pause -= dt
				if n.pause <= 0:
					g.set_facing(1 if n.speed > 0 else -1)
					g.play("walk", {"fps": 8})
				continue
			g.position.x += n.speed * dt
			if (n.speed < 0 and g.position.x <= n.leaving) or (n.speed > 0 and g.position.x >= n.leaving):
				g.queue_free()
				npcs.remove_at(i)
			continue
		if n.speed == 0:
			continue
		if n.pause > 0:
			n.pause -= dt
			if n.pause <= 0:
				g.play("walk", {"fps": 8})
			continue
		var nx: float = g.position.x + n.speed * dt
		if blocked(nx, g.position.y, 4):
			n.speed = -n.speed
			g.set_facing(1 if n.speed > 0 else -1)
			continue
		g.position.x = nx
		if nx < n.min or nx > n.max:
			n.speed = -n.speed
			g.position.x = clampf(nx, n.min, n.max)
			g.set_facing(1 if n.speed > 0 else -1)
		elif randf() < dt * 0.15:
			n.pause = 1 + randf() * 2.5
			g.play("idle")


func _update_pigeons(dt: float) -> void:
	var hero := view.hero
	for pg in pigeons:
		var s: AnimatedSprite2D = pg.s
		if not is_instance_valid(s) or pg.flying:
			continue
		if absf(hero.position.x - s.position.x) < 30 and absf(hero.position.y - s.position.y) < 20:
			pg.flying = true
			var dir := 1 if hero.position.x < s.position.x else -1
			s.flip_h = dir < 0
			s.sprite_frames = _pigeon_frames(4)
			s.play("a")
			var tw := create_tween()
			tw.tween_property(s, "position", s.position + Vector2(dir * 260, -170), 1.8).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
			tw.tween_callback(s.queue_free)
			continue
		s.position.x += pg.vx * dt
		if s.position.x < 200 or s.position.x > 480 or randf() < dt * 0.3:
			pg.vx = (randf() - 0.5) * 10
			s.flip_h = pg.vx < 0


func _pigeon_frames(first: int) -> SpriteFrames:
	var sf := SpriteFrames.new()
	sf.add_animation("a")
	sf.set_animation_speed("a", 10)
	for i in 2:
		var at := AtlasTexture.new()
		at.atlas = Ui.tex("res://assets/sprites/fx/pigeon.png")
		at.region = Rect2((first + i) * 16, 0, 16, 12)
		sf.add_frame("a", at)
	return sf


func _flock() -> void:
	var dir := 1 if randf() < 0.5 else -1
	var y := 30 + randf() * 60
	for i in 2 + rnd(4):
		var b := _anim_sprite("bird", 9, 5, 2, 5)
		b.frame = i % 2
		b.position = Vector2(-20 - i * 12 if dir > 0 else 660 + i * 12, y + (i % 2) * 6 + randf() * 4)
		b.z_index = -5
		b.flip_h = dir < 0
		var tw := create_tween()
		tw.tween_property(b, "position", b.position + Vector2(dir * 720, -20 + randf() * 40), 11 + randf() * 2)
		tw.tween_callback(b.queue_free)


func _puff(at: Vector2, color: Color, alpha: float, rise: float, r: float) -> void:
	var c := Polygon2D.new()
	c.polygon = MapView._circle(r)
	c.color = Color(color, alpha)
	c.position = at
	c.z_index = 3
	add_child(c)
	var tw := create_tween()
	tw.tween_property(c, "position", at + Vector2((randf() - 0.5) * 10, rise), 2.2).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)
	tw.parallel().tween_property(c, "scale", Vector2(2.4, 2.4), 2.2)
	tw.parallel().tween_property(c, "modulate:a", 0.0, 2.2)
	tw.tween_callback(c.queue_free)


func _spark(at: Vector2, color: Color) -> void:
	var r := ColorRect.new()
	r.color = color
	r.size = Vector2(1, 1)
	r.position = at
	r.z_index = depth(GROUND + 20)
	add_child(r)
	var tw := create_tween()
	tw.tween_property(r, "position", at + Vector2((randf() - 0.5) * 16, -4 - randf() * 8), 0.3)
	tw.parallel().tween_property(r, "modulate:a", 0.0, 0.3)
	tw.tween_callback(r.queue_free)


func _world_label(text: String, color: Color, size: int) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", UiTheme.title_font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color8(26, 14, 8))
	l.add_theme_constant_override("outline_size", 5)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.size = Vector2(320, 20)
	l.scale = Vector2(0.5, 0.5)
	return l


# ------------------------------------------------------------------ clima
func _setup_weather() -> void:
	rain_layer = Node2D.new()
	rain_layer.z_index = 150
	add_child(rain_layer)
	var p := Game.p
	var season := Weather.season_of(int(p.day))
	# neblina da manhã: faixas claras que passam devagar
	for i in 5:
		var f := Polygon2D.new()
		var w := 260.0 + randf() * 160
		f.polygon = PackedVector2Array([Vector2(0, 0), Vector2(w, 0), Vector2(w, 10 + randf() * 8), Vector2(0, 12)])
		f.color = Color(0.92, 0.92, 0.95, 0.0)
		f.position = Vector2(randf() * 640 - 120, 220 + i * 22 + randf() * 10)
		f.z_index = 140
		add_child(f)
		fog.append({"n": f, "v": 3 + randf() * 5})
	# folhas no outono
	if season == "autumn":
		for i in 14:
			var lf := ColorRect.new()
			lf.size = Vector2(2, 1)
			lf.color = [Color8(200, 112, 40), Color8(176, 72, 32), Color8(214, 160, 56)][i % 3]
			lf.position = Vector2(randf() * 640, randf() * 360)
			lf.z_index = 145
			add_child(lf)
			leaves.append({"n": lf, "vx": 8 + randf() * 14, "vy": 10 + randf() * 12, "ph": randf() * TAU})
	# guirlandas nos dias de festa
	if Events.is_festival(int(p.day)) and loc != "arena":
		for seg in [[10, 168, 210, 172], [210, 172, 430, 170], [430, 170, 632, 168]]:
			var line := Line2D.new()
			line.width = 1
			line.default_color = Color8(80, 110, 50)
			for k in 13:
				var t := k / 12.0
				line.add_point(Vector2(lerpf(seg[0], seg[2], t), lerpf(seg[1], seg[3], t) + sin(t * PI) * 10).round())
			line.z_index = 4
			add_child(line)
			for k in range(1, 12):
				var t2 := k / 12.0
				var flag := Polygon2D.new()
				flag.polygon = PackedVector2Array([Vector2(-2, 0), Vector2(2, 0), Vector2(0, 4)])
				flag.color = [Color8(200, 60, 50), Color8(240, 200, 80), Color8(240, 240, 220), Color8(70, 120, 180)][k % 4]
				flag.position = Vector2(lerpf(seg[0], seg[2], t2), lerpf(seg[1], seg[3], t2) + sin(t2 * PI) * 10).round()
				flag.z_index = 4
				add_child(flag)


func _update_weather(dt: float) -> void:
	if rain_layer == null:
		return
	var p := Game.p
	var fog_k := Weather.morning_fog(int(p.minutes), Weather.season_of(int(p.day)))
	for f in fog:
		f.n.position.x += f.v * dt
		if f.n.position.x > 660:
			f.n.position.x = -420
		f.n.color.a = 0.22 * fog_k
	for lf in leaves:
		lf.ph += dt * 3
		lf.n.position += Vector2(lf.vx + sin(lf.ph) * 10, lf.vy) * dt
		if lf.n.position.y > 340 or lf.n.position.x > 650:
			lf.n.position = Vector2(randf() * 600 - 60, 130 + randf() * 40)
	var rain := float(Weather.now(int(p.createdAt), int(p.day)).rain)
	var want := int(rain * 200)
	while drops.size() < want:
		var d := ColorRect.new()
		d.size = Vector2(1, 6)
		d.rotation = 0.23
		d.color = Color(0.86, 0.9, 1.0, 0.8)
		d.mouse_filter = Control.MOUSE_FILTER_IGNORE
		d.position = Vector2(randf() * 700, randf() * 360)
		rain_layer.add_child(d)
		drops.append(d)
	while drops.size() > want:
		drops.pop_back().queue_free()
	for d in drops:
		d.position += Vector2(-60, 260) * dt
		if d.position.y > 330 + randf() * 30:
			if randf() < 0.3:
				_splash(d.position)
			d.position = Vector2(randf() * 700, -10)
	if rain > 0.5:
		thunder_t -= dt
		if thunder_t <= 0:
			thunder_t = 14 + randf() * 20
			_lightning()


func _splash(at: Vector2) -> void:
	var r := ColorRect.new()
	r.color = Color(0.8, 0.86, 0.95, 0.6)
	r.size = Vector2(2, 1)
	r.position = at.round()
	rain_layer.add_child(r)
	var tw := create_tween()
	tw.tween_property(r, "modulate:a", 0.0, 0.2)
	tw.tween_callback(r.queue_free)


func _lightning() -> void:
	var flash := ColorRect.new()
	flash.color = Color(1, 1, 1, 0.5)
	flash.size = Vector2(700, 400)
	flash.position = Vector2(-30, -20)
	flash.z_index = 160
	add_child(flash)
	var tw := create_tween()
	tw.tween_property(flash, "color:a", 0.0, 0.35)
	tw.tween_callback(flash.queue_free)
	get_tree().create_timer(0.6 + randf()).timeout.connect(func(): Sfx.play("thunder", 0.8))
