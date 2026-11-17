class_name ArenaView
extends Node2D
## Cena da arena: roda o CombatEngine em tempo real e traduz os eventos em animações
## (porte de ArenaScene.ts). A lógica (quem acerta, dano) vem só do motor.

signal combat_event(e: Dictionary, engine: CombatEngine)
signal back_event(e: Dictionary, engine: CombatEngine)
signal frame(engine: CombatEngine)
signal finished(result: Dictionary, back_result)
signal speed_reset

const GROUND_Y := 318.0
const SPREAD := 17.0
const BACK_Y := GROUND_Y - 30.0
const LUNGE := {"normal": 13.0, "power_strike": 20.0, "quick_strike": 9.0, "counter": 12.0}
const BANNER_COLORS := {"capua": Color8(138, 58, 34), "pompeii": Color8(168, 50, 42), "verona": Color8(62, 110, 64), "leptis": Color8(42, 90, 154),
	"rome": Color8(168, 50, 42), "villa": Color8(74, 122, 74), "senator": Color8(106, 26, 34), "baiae": Color8(90, 42, 122)}

var engine: CombatEngine
var back_engine: CombatEngine = null
var views: Array = []
var back_views: Array = []
var choreo: Array = []
var prev_x := [0.0, 0.0]
var back_prev := [0.0, 0.0]
var acc := 0.0
var back_acc := 0.0
var speed := 1.0
var slow := 1.0
var freeze := 0.0
var end_timer := -1.0
var ended := false
var crowd: Sprite2D
var crowd_front: Sprite2D
var crowd_t := 0.0
var excite := 1.5
var standing := 0.0
var editor: AnimatedSprite2D
var cam: Camera2D
var cam_x := 320.0
var zoom_boost := 1.0
var zoom_target := 1.0
var focus = null
var dark: ColorRect
var blood_layer: Node2D
var drops: Array = []
var beasts := [null, null]
var arena_id := "capua"
var lights: Array[PointLight2D] = []
var modulate_node: CanvasModulate
var dir_to := [1, -1]
var finale_done := false
var setup_data: Dictionary


func setup(s: Dictionary) -> void:
	setup_data = s
	arena_id = s.arena.id
	speed = float(s.get("speed", 1))
	engine = CombatEngine.new(s.fighters[0].spec, s.fighters[1].spec, {"seed": s.seed, "startHp": s.get("startHp")})
	var sky := Sprite2D.new()
	sky.centered = false
	sky.z_index = -10
	var f := Calendar.day_fraction(int(Game.p.minutes) if Game.has_player() else 600)
	if arena_id != "senator":
		sky.texture = ImageTexture.create_from_image(SkyPainter.image(f))
	add_child(sky)
	_sprite("res://assets/backgrounds/arena_%s.png" % arena_id)
	var crowd_tex := "res://assets/backgrounds/crowd%s_%s.png" % ["fest" if s.get("festival", false) and ResourceLoader.exists("res://assets/backgrounds/crowdfest_%s.png" % arena_id) else "", arena_id]
	crowd = _sprite(crowd_tex)
	crowd.hframes = 5
	if s.get("festival", false):
		_sprite("res://assets/sprites/fx/festival.png")
	_decorate()
	for x in [112.0, 528.0]:
		var br := AnimatedSprite2D.new()
		br.sprite_frames = LocationView._brazier_frames()
		br.play("burn")
		br.centered = false
		br.offset = Vector2(-8, -32)
		br.position = Vector2(x, 200)
		add_child(br)
		var pl := PointLight2D.new()
		pl.texture = LocationView._light_texture()
		pl.position = Vector2(x, 184)
		pl.texture_scale = 2.0
		pl.color = Color8(255, 184, 104)
		add_child(pl)
		lights.append(pl)
	blood_layer = Node2D.new()
	blood_layer.z_index = 4
	add_child(blood_layer)
	for i in 2:
		var g := Gladiator.new()
		var vis: Dictionary = s.fighters[i].visual
		beasts[i] = vis.get("beast")
		var ap: Dictionary = vis.appearance.duplicate()
		if vis.get("beast") != null:
			ap["_beast"] = vis.beast
		g.set_visual(ap, vis.gear)
		g.position = Vector2(engine.fighters[i].x, GROUND_Y)
		g.set_facing(engine.fighters[i].facing)
		g.z_index = 10 + i
		g.set_process(false)
		g.play("walk", {"fps": 8})
		add_child(g)
		views.append(g)
		choreo.append({"lunge": 0.0, "push": 0.0, "lift": 0.0, "tilt": 0.0})
	prev_x = [engine.fighters[0].x, engine.fighters[1].x]
	if s.get("back") != null:
		back_engine = CombatEngine.new(s.back.fighters[0].spec, s.back.fighters[1].spec, {"seed": s.back.seed})
		for i in 2:
			var g := Gladiator.new()
			g.set_visual(s.back.fighters[i].visual.appearance, s.back.fighters[i].visual.gear)
			g.position = Vector2(_back_x(back_engine.fighters[i].x), BACK_Y)
			g.set_facing(back_engine.fighters[i].facing)
			g.z_index = 7
			g.modulate = Color(0.86, 0.84, 0.82)
			g.set_process(false)
			g.play("walk", {"fps": 8})
			add_child(g)
			back_views.append(g)
		back_prev = [back_engine.fighters[0].x, back_engine.fighters[1].x]
	crowd_front = _sprite("res://assets/sprites/fx/crowd_front.png")
	crowd_front.hframes = 2
	crowd_front.centered = false
	crowd_front.position = Vector2(-320, 326)
	crowd_front.z_index = 40
	dark = ColorRect.new()
	dark.color = Color8(5, 3, 10)
	dark.size = Vector2(1400, 800)
	dark.position = Vector2(-380, -200)
	dark.modulate.a = 0
	dark.z_index = 9
	add_child(dark)
	modulate_node = CanvasModulate.new()
	modulate_node.color = SkyPainter.colors(f)[2] if arena_id != "senator" else Color(0.55, 0.5, 0.6)
	add_child(modulate_node)
	var dk := 1.0 - modulate_node.color.v
	for pl in lights:
		pl.energy = clampf(dk * 2.2, 0.15, 1.2)
	cam = Camera2D.new()
	cam.zoom = Vector2(2, 2)
	cam.limit_left = 0
	cam.limit_top = 0
	cam.limit_right = 640
	cam.limit_bottom = 360
	add_child(cam)
	cam.make_current()
	cam.position = Vector2(320, 252)
	_big_text(Names.arena_name(arena_id), Color8(244, 220, 138), Vector2(320, 230))


func _sprite(path: String) -> Sprite2D:
	var sp := Sprite2D.new()
	sp.texture = load(path)
	sp.centered = false
	add_child(sp)
	return sp


func _back_x(x: float) -> float:
	return 320 + 64 + (x - 320) * 0.86


## Estandartes ao vento, grade dos portões que sobe e o editor dos jogos no camarote.
func _decorate() -> void:
	var color: Color = BANNER_COLORS.get(arena_id, Color8(168, 50, 42))
	var bt: Texture2D = load("res://assets/sprites/fx/banner_wave.png")
	for i in 2:
		var b := AnimatedSprite2D.new()
		var sf := SpriteFrames.new()
		sf.add_animation("w")
		sf.set_animation_speed("w", 6)
		for k in 4:
			var at := AtlasTexture.new()
			at.atlas = bt
			at.region = Rect2(k * 16, 0, 16, 34)
			sf.add_frame("w", at)
		b.sprite_frames = sf
		b.centered = false
		b.position = Vector2([195, 431][i], 203)
		b.modulate = color
		b.play("w")
		b.frame = i * 2
		add_child(b)
	var pulvinar := arena_id == "rome" or arena_id == "senator" or arena_id == "baiae"
	var kind := "group" if pulvinar else ("wood" if arena_id == "capua" else "box")
	var size := Vector2(72, 50) if kind == "group" else Vector2(80, 64)
	var et: Texture2D = load("res://assets/sprites/fx/editor_%s.png" % kind)
	var sf2 := SpriteFrames.new()
	for anim in [["watch", 0, 1.2], ["cheer", 2, 4.0]]:
		sf2.add_animation(anim[0])
		sf2.set_animation_speed(anim[0], anim[2])
		for k in 2:
			var at := AtlasTexture.new()
			at.atlas = et
			at.region = Rect2((anim[1] + k) * size.x, 0, size.x, size.y)
			sf2.add_frame(anim[0], at)
	editor = AnimatedSprite2D.new()
	editor.sprite_frames = sf2
	editor.centered = false
	editor.offset = Vector2(-size.x / 2, -size.y)
	editor.position = Vector2(320, 205 if pulvinar else 203)
	editor.play("watch")
	add_child(editor)


func set_speed(s: float) -> void:
	speed = s


func forfeit() -> void:
	if back_engine and not back_engine.finished:
		back_engine.forfeit(0)
		for e in back_engine.drain_events():
			_back_handle(e)
	if engine.finished:
		return
	engine.forfeit(0)
	for e in engine.drain_events():
		_handle(e)


func _process(delta: float) -> void:
	var real_dt := minf(0.25, delta)
	zoom_boost += (zoom_target - zoom_boost) * minf(1.0, real_dt * 4)
	var dt := real_dt * speed * slow
	dark.modulate.a += ((0.55 if slow < 1 else 0.0) - dark.modulate.a) * minf(1.0, real_dt * 7)
	if freeze > 0:
		freeze -= real_dt
		dt = 0
	if not engine.finished and dt > 0:
		acc += dt
		while acc >= CombatEngine.TICK and not engine.finished:
			prev_x = [engine.fighters[0].x, engine.fighters[1].x]
			for e in engine.step():
				_handle(e)
			acc -= CombatEngine.TICK
	var alpha := 1.0 if engine.finished else minf(1.0, acc / CombatEngine.TICK)
	var ex := [lerpf(prev_x[0], engine.fighters[0].x, alpha), lerpf(prev_x[1], engine.fighters[1].x, alpha)]
	dir_to = [1 if ex[1] >= ex[0] else -1, 1 if ex[0] > ex[1] else -1]
	var shift := -56.0 if back_engine else 0.0
	for i in 2:
		var f: Dictionary = engine.fighters[i]
		var v: Gladiator = views[i]
		var c: Dictionary = choreo[i]
		var d: int = dir_to[i]
		v.position.x = roundf(clampf(ex[i] + shift - d * SPREAD + d * (c.lunge - c.push), 30, 610))
		v.position.y = roundf(GROUND_Y - c.lift)
		v.rotation_degrees = -c.tilt * d
		if f.action != "victory" and f.action != "defeat":
			v.set_facing(f.facing)
		v.tick(dt)
	if back_engine:
		_back_update(dt)
	_update_blood(dt)
	var mid: float = (views[0].position.x + views[1].position.x) / 2.0
	if back_engine:
		mid = (mid * 2 + back_views[0].position.x + back_views[1].position.x) / 4.0
	cam_x += (mid - cam_x) * minf(1.0, dt * 3 + 0.001)
	var z := 2.0 if zoom_boost < 1.4 else 3.0
	cam.zoom = Vector2(z, z)
	var fp: Vector2 = focus if focus != null and zoom_boost > 1.2 else Vector2(cam_x, 252)
	cam.position = fp.round()
	_update_crowd(dt)
	frame.emit(engine)
	var back_done := back_engine == null or back_engine.finished
	if engine.finished and back_done and not ended:
		if end_timer < 0:
			end_timer = 4.0
		end_timer -= real_dt
		if end_timer <= 0:
			ended = true
			finished.emit(engine.result, back_engine.result if back_engine else null)


func _update_crowd(dt: float) -> void:
	crowd_t += dt
	excite = maxf(0.0, excite - dt)
	var frames := 5
	if standing > 0:
		crowd.frame = 3 + (int(crowd_t * 4.5) % 2)
	elif excite > 0:
		crowd.frame = int(crowd_t * 6.6) % 3
	else:
		crowd.frame = int(crowd_t * 1.4) % 2
	var cheering := standing > 0 or excite > 0.6
	crowd_front.frame = (int(crowd_t * 5) % 2) if cheering else (1 if int(crowd_t * 0.8) % 7 == 0 else 0)
	crowd_front.position.y = 326 + (roundf(sin(crowd_t * 12)) if cheering else 0.0)


# ------------------------------------------------------------------ coreografia
func _move(side: int, key: String, to: float, dur: float, back := 0.0, hold := 0.0) -> void:
	var c: Dictionary = choreo[side]
	var tw := create_tween()
	tw.tween_method(func(v): c[key] = v, float(c[key]), to, maxf(0.01, dur / 1000.0 / maxf(0.2, speed * slow))).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	if back > 0:
		tw.tween_interval(hold / 1000.0 / maxf(0.2, speed * slow))
		tw.tween_method(func(v): c[key] = v, to, 0.0, back / 1000.0 / maxf(0.2, speed * slow)).set_trans(Tween.TRANS_SINE)


func _anim(f: Dictionary, action: String, duration: float, v: Gladiator) -> void:
	match action:
		"intro", "advance":
			v.play("walk", {"fps": 10})
		"retreat":
			v.play("walk", {"fps": 7})
		"idle":
			v.play("idle")
		"windup":
			v.sequence([["attack", 0, duration * 0.65], ["attack", 1, duration * 0.35]])
		"recover":
			v.sequence([["attack", 2, minf(0.14, duration * 0.5)], ["attack", 3, 9.0]])
		"block":
			v.play("block", {"restart": true})
		"dodge":
			v.sequence([["dodge", 0, duration * 0.25], ["dodge", 1, duration * 0.45], ["dodge", 2, 9.0]])
		"hitstun":
			v.sequence([["hit", 0, duration * 0.5], ["hit", 1, 9.0]])
		"exhausted":
			v.hold("defeat", 0)
		"buff":
			v.hold("block", 0)
		"victory":
			v.play("victory", {"restart": true})
		"defeat":
			v.sequence([["defeat", 0, 0.3], ["defeat", 1, 0.3], ["defeat", 2, 0.4], ["defeat", 3, 99.0]])


func _handle(e: Dictionary) -> void:
	combat_event.emit(e, engine)
	var head_y := GROUND_Y - 44
	match e.type:
		"start":
			_big_text(I18n.t("battle.fightBig"), Color8(255, 211, 106), Vector2(cam_x, head_y - 24))
			excite = 2
		"action":
			var side: int = e.side
			_anim(engine.fighters[side], e.action, e.duration, views[side])
			if e.action == "idle":
				_move(side, "lunge", 0, 220)
				_move(side, "tilt", 0, 160)
			elif e.action == "windup":
				_move(side, "lunge", -6.0 if e.duration > 0.5 else -3.0, e.duration * 800)
				_move(side, "tilt", 6.0 if e.duration > 0.5 else 3.0, e.duration * 800)
			elif e.action == "dodge":
				_move(side, "push", 20, e.duration * 400, e.duration * 700, 60)
				_move(side, "lift", 7, e.duration * 250, e.duration * 300)
				_dust(views[side].position.x, 4)
		"impact":
			_impact(e, head_y)
		"skill":
			if e.skill != "counter":
				_float(Names.move_name(e.skill, beasts[e.side]), views[e.side].position + Vector2(0, -60), Color8(255, 211, 106))
			if e.skill == "iron_guard":
				views[e.side].modulate = Color(1.25, 1.15, 0.8)
		"buffEnd":
			views[e.side].modulate = Color.WHITE
		"secondWind":
			_float(I18n.t("fx.secondWind", {"n": e.heal}), views[e.side].position + Vector2(0, -62), Color8(138, 216, 102))
		"exhausted":
			_float(I18n.t("fx.tired"), views[e.side].position + Vector2(0, -58), Color8(200, 192, 176))
		"end":
			for v in views:
				v.modulate = Color.WHITE
			if back_engine:
				_duel_ended()
				return
			_crowd_end(int(e.winner) == 0, views[int(e.winner)].position.x)
			_big_text(I18n.t("result.victory") if int(e.winner) == 0 else I18n.t("result.defeat"), Color8(255, 211, 106) if int(e.winner) == 0 else Color8(224, 106, 90), Vector2(cam_x, head_y - 24))


func _impact(e: Dictionary, head_y: float) -> void:
	var side: int = e.side
	var target: int = e.target
	var tv: Gladiator = views[target]
	var lunge: float = LUNGE.get(e.kind, 12.0)
	var power: bool = e.kind == "power_strike"
	_move(side, "lunge", lunge + 6 if e.outcome == "miss" else (lunge - 4 if e.outcome == "block" else lunge), 70, 260, 220 if e.outcome == "miss" else 110)
	_move(side, "tilt", -9.0 if e.outcome == "miss" else -5.0, 70, 220, 120)
	_slash(views[side], dir_to[side], e.kind)
	var at := tv.position + Vector2(0, -44)
	match e.outcome:
		"miss":
			_float(I18n.t("fx.miss"), at, Color8(232, 224, 208))
		"dodge":
			_float(I18n.t("fx.dodge"), at, Color8(159, 216, 255))
			_move(target, "push", 18, 140, 380, 80)
		"block":
			_float(I18n.t("fx.blocked", {"n": e.damage}), at, Color8(216, 216, 232))
			_sparks(tv.position + Vector2(dir_to[target] * 9, -34), Color8(255, 240, 160), 10 if power else 6)
			_move(target, "push", 12.0 if power else 6.0, 90, 300, 60)
		"hit":
			tv.flash()
			_blood(target, 10 if e.crit else (6 if e.stagger else 4), e.crit)
			_sparks(tv.position + Vector2(dir_to[target] * 5, -34), Color.WHITE, 8 if e.crit else 4)
			var kb := 16.0 if e.stagger else 8.0
			_move(target, "push", kb, 110, 520 if e.stagger else 320, 160 if e.stagger else 60)
			_move(target, "tilt", 14.0 if e.stagger else 8.0, 90, 300, 200 if e.stagger else 60)
			var col := Color8(255, 106, 90) if target == 0 else Color8(255, 224, 138)
			_float("%d!" % e.damage if e.crit else str(e.damage), at, col, 2.0 if e.crit else 1.5)
			if e.crit:
				_float(I18n.t("fx.crit"), at + Vector2(0, -12), Color8(255, 176, 58))
			if e.crit or e.stagger:
				_shake()
				freeze = maxf(freeze, (0.09 if e.crit else 0.05) / maxf(1.0, speed))
				excite = maxf(excite, 1.2)
			if engine.fighters[target].hp <= 0:
				_final_blow(target)
	if e.kind == "counter":
		_float(I18n.t("fx.counter"), views[side].position + Vector2(0, -74), Color8(255, 176, 58))


## Golpe final: a cena congela, entra em câmera lenta com zoom e escurece; depois volta.
func _final_blow(target: int) -> void:
	if finale_done:
		return
	finale_done = true
	freeze = 0.35
	slow = 0.25
	zoom_target = 1.6
	focus = Vector2((views[0].position.x + views[1].position.x) / 2.0, GROUND_Y - 34)
	_blood(target, 22, true)
	var pool := Polygon2D.new()
	pool.polygon = MapView._circle(3)
	pool.color = Color8(94, 10, 10, 220)
	pool.position = Vector2(views[target].position.x, GROUND_Y + 1)
	pool.scale = Vector2(1, 0.35)
	blood_layer.add_child(pool)
	create_tween().tween_property(pool, "scale", Vector2(6, 2), 2.6).set_delay(0.6)
	get_tree().create_timer(1.3).timeout.connect(func(): slow = 0.5)
	get_tree().create_timer(1.8).timeout.connect(func():
		slow = 1.0
		zoom_target = 1.0
		focus = null
		if speed > 1:
			speed = 1
			speed_reset.emit())


func _crowd_end(player_won: bool, x: float) -> void:
	excite = 4
	standing = 1
	if player_won:
		for i in 40:
			get_tree().create_timer(i * 0.06).timeout.connect(_gift.bind(x, false))
		for i in 22:
			get_tree().create_timer(0.2 + i * 0.09).timeout.connect(_gift.bind(x, true))
		editor.play("cheer")


## Dupla: um duelo terminou; com os dois encerrados, a plateia reage (ou anuncia o desempate).
func _duel_ended() -> void:
	var a = engine.result
	var b = back_engine.result
	if a == null or b == null:
		var eng: CombatEngine = engine if a != null else back_engine
		var done: int = int((a if a != null else b).winner)
		var nm: String = str(eng.fighters[done].spec.name).split(",")[0]
		_float(I18n.t("duo.duelEnd", {"name": nm}), Vector2(cam_x, GROUND_Y - 74), Color8(255, 211, 106) if done == 0 else Color8(224, 106, 90), 1.4)
		return
	var ours := (1 if int(a.winner) == 0 else 0) + (1 if int(b.winner) == 0 else 0)
	standing = 1
	excite = 4
	if ours == 1:
		_big_text(I18n.t("duo.deciderBig"), Color8(244, 220, 138), Vector2(cam_x, GROUND_Y - 68))
		return
	var won := ours == 2
	_big_text(I18n.t("result.victory") if won else I18n.t("result.defeat"), Color8(255, 211, 106) if won else Color8(224, 106, 90), Vector2(cam_x, GROUND_Y - 68))
	if won:
		_crowd_end(true, (views[0].position.x + back_views[0].position.x) / 2.0)


func _back_update(dt: float) -> void:
	var was_done := back_engine.finished
	if not back_engine.finished and dt > 0:
		back_acc += dt
		while back_acc >= CombatEngine.TICK and not back_engine.finished:
			back_prev = [back_engine.fighters[0].x, back_engine.fighters[1].x]
			for e in back_engine.step():
				_back_handle(e)
			back_acc -= CombatEngine.TICK
	var alpha := 1.0 if back_engine.finished else minf(1.0, back_acc / CombatEngine.TICK)
	for i in 2:
		var f: Dictionary = back_engine.fighters[i]
		var ex := lerpf(back_prev[i], f.x, alpha)
		var other := lerpf(back_prev[1 - i], back_engine.fighters[1 - i].x, alpha)
		var d := 1 if other >= ex else -1
		var v: Gladiator = back_views[i]
		v.position.x = roundf(clampf(_back_x(ex) - d * SPREAD * 0.8, 30, 610))
		if f.action != "victory" and f.action != "defeat":
			v.set_facing(f.facing)
		v.tick(dt)
	if not was_done and back_engine.finished:
		_duel_ended()


func _back_handle(e: Dictionary) -> void:
	back_event.emit(e, back_engine)
	match e.type:
		"action":
			_anim(back_engine.fighters[e.side], e.action, e.duration, back_views[e.side])
		"impact":
			var tv: Gladiator = back_views[e.target]
			if e.outcome == "hit":
				tv.flash()
				_float(str(e.damage), tv.position + Vector2(0, -40), Color8(255, 138, 122) if int(e.target) == 0 else Color8(240, 216, 144))
				_sparks(tv.position + Vector2(0, -30), Color8(200, 58, 42), 3)
			elif e.outcome == "block":
				_sparks(tv.position + Vector2(0, -30), Color8(255, 240, 160), 3)


# ------------------------------------------------------------------ efeitos
func _float(text: String, at: Vector2, color: Color, scale_k := 1.0) -> void:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", UiTheme.title_font)
	l.add_theme_font_size_override("font_size", 8)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color8(20, 10, 6))
	l.add_theme_constant_override("outline_size", 2)
	l.scale = Vector2.ONE * scale_k * 0.5
	l.position = at + Vector2(-20, -6)
	l.z_index = 50
	add_child(l)
	var tw := create_tween()
	tw.tween_property(l, "position:y", l.position.y - 16, 0.9)
	tw.parallel().tween_property(l, "modulate:a", 0.0, 0.9).set_delay(0.4)
	tw.tween_callback(l.queue_free)


func _big_text(text: String, color: Color, at: Vector2) -> void:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", UiTheme.title_font)
	l.add_theme_font_size_override("font_size", 16)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color8(30, 14, 6))
	l.add_theme_constant_override("outline_size", 3)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.size = Vector2(240, 20)
	l.scale = Vector2(0.5, 0.5)
	l.position = at - Vector2(60, 10)
	l.z_index = 60
	add_child(l)
	var tw := create_tween()
	tw.tween_interval(1.4)
	tw.tween_property(l, "modulate:a", 0.0, 0.6)
	tw.tween_callback(l.queue_free)


func _slash(v: Gladiator, d: int, kind: String) -> void:
	var line := Line2D.new()
	line.width = 2.0 if kind == "power_strike" else 1.0
	line.default_color = Color8(255, 176, 80) if kind == "power_strike" else (Color8(159, 216, 255) if kind == "counter" else Color.WHITE)
	var r := 26.0 if kind == "power_strike" else 20.0
	var cx := v.position.x + d * 6
	var cy := GROUND_Y - 30
	for k in 9:
		var a := lerpf(-1.25, 0.75, k / 8.0)
		line.add_point(Vector2(cx + cos(a) * r * d, cy + sin(a) * r).round())
	line.z_index = 30
	add_child(line)
	var tw := create_tween()
	tw.tween_property(line, "modulate:a", 0.0, 0.22).set_delay(0.08)
	tw.tween_callback(line.queue_free)


func _sparks(at: Vector2, color: Color, n: int) -> void:
	for i in n:
		var s := ColorRect.new()
		s.color = color
		s.size = Vector2(1, 1)
		s.position = at.round()
		s.z_index = 41
		add_child(s)
		var to := at + Vector2(randf_range(-12, 12), randf_range(-12, 4))
		var tw := create_tween()
		tw.tween_property(s, "position", to.round(), 0.22)
		tw.parallel().tween_property(s, "modulate:a", 0.0, 0.22)
		tw.tween_callback(s.queue_free)


func _blood(side: int, n: int, big: bool) -> void:
	var v: Gladiator = views[side]
	var away: int = -dir_to[side]
	for i in n:
		var r := ColorRect.new()
		r.color = [Color8(138, 16, 16), Color8(168, 24, 24), Color8(106, 10, 10)][i % 3]
		r.size = Vector2(1, 1) if randf() < 0.7 else Vector2(2, 2)
		r.position = Vector2(v.position.x + randf_range(-3, 3), GROUND_Y - 30 + randf_range(-6, 6))
		r.z_index = 42
		add_child(r)
		drops.append({"r": r, "vx": away * randf_range(8, 46 if big else 30), "vy": -randf_range(20, 70 if big else 45), "floor": GROUND_Y - 2 + randf() * 6})


func _update_blood(dt: float) -> void:
	for i in range(drops.size() - 1, -1, -1):
		var b: Dictionary = drops[i]
		b.vy += 260 * dt
		b.r.position += Vector2(b.vx, b.vy) * dt
		if b.r.position.y >= b.floor:
			# vira mancha na areia (fica até o fim da luta)
			var st := ColorRect.new()
			st.color = Color8(122, 16, 16) if randf() < 0.5 else Color8(94, 10, 10)
			st.size = Vector2(b.r.size.x + 1, 1)
			st.position = Vector2(roundf(b.r.position.x), roundf(b.floor))
			blood_layer.add_child(st)
			b.r.queue_free()
			drops.remove_at(i)


func _dust(x: float, n: int) -> void:
	for i in n:
		var s := ColorRect.new()
		s.color = Color8(214, 184, 140, 200)
		s.size = Vector2(2, 1)
		s.position = Vector2(x + randf_range(-5, 5), GROUND_Y - 1).round()
		s.z_index = 9
		add_child(s)
		var tw := create_tween()
		tw.tween_property(s, "position", s.position + Vector2(randf_range(-8, 8), -randf_range(2, 6)), 0.5)
		tw.parallel().tween_property(s, "modulate:a", 0.0, 0.5)
		tw.tween_callback(s.queue_free)


func _shake() -> void:
	var tw := create_tween()
	for k in 4:
		tw.tween_property(cam, "offset", Vector2(randf_range(-2, 2), randf_range(-1, 1)).round(), 0.03)
	tw.tween_property(cam, "offset", Vector2.ZERO, 0.03)


## Flores (ou moedas) jogadas pela plateia; ficam na areia.
func _gift(near_x: float, coin: bool) -> void:
	if not is_inside_tree():
		return
	var cols := [Color8(244, 200, 64), Color8(232, 176, 48), Color8(255, 240, 160)] if coin else [Color8(232, 74, 90), Color8(244, 208, 106), Color8(240, 240, 224), Color8(216, 106, 176)]
	var g := ColorRect.new()
	g.color = cols[randi() % cols.size()]
	g.size = Vector2(1, 1) if coin else Vector2(2, 1)
	g.position = Vector2(randf_range(80, 560), randf_range(188, 200))
	g.z_index = 6
	add_child(g)
	var to := Vector2(near_x + randf_range(-60, 60), GROUND_Y - 4 + randf() * 26)
	var tw := create_tween()
	tw.tween_property(g, "position", to.round(), randf_range(0.9, 1.4)).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)


## Polegar da plateia no fim da luta.
func show_thumb(kind: String) -> void:
	if kind == "none":
		return
	var rows := ["......XX........", ".....XooX.......", ".....XooX.......", ".....XooX.......", ".....XooX.......", "....XooooXXXX...",
		"XXXXooooooooX...", "XooXoooooXXXX...", "XooXooooooooX...", "XooXoooooXXXX...", "XooXooooooooX...", "XooXoooooXXX....", "XooXooooooX.....", "XXXXXXXXXXX....."]
	var img := Image.create(16, 16, false, Image.FORMAT_RGBA8)
	for y in rows.size():
		for x in 16:
			var ch: String = rows[y][x]
			if ch != ".":
				img.set_pixel(x, y + 1, Color8(58, 36, 22) if ch == "X" else Color.WHITE)
	var s := Sprite2D.new()
	s.texture = ImageTexture.create_from_image(img)
	s.modulate = Color8(255, 226, 138) if kind == "up" else Color8(224, 106, 90)
	s.rotation_degrees = 180 if kind == "down" else 0
	s.position = Vector2(cam.position.x, 200)
	s.scale = Vector2(0.2, 0.2)
	s.z_index = 70
	add_child(s)
	var tw := create_tween()
	tw.tween_property(s, "scale", Vector2(1.5, 1.5), 0.38).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
