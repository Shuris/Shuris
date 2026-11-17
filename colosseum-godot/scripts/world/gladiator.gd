class_name Gladiator
extends Node2D
## Gladiador montado em camadas (mesmo manifesto e ordem da versão atual): corpo,
## tanga, cinto, cabelo, barba, equipamentos e a arma presa à mão em cada quadro.
## Desenhado em 1x: cada pixel da arte é um pixel da grade do jogo.

const BASE := "res://assets/"
const BEAST_SCALE := {"wolf": 0.66, "boar": 0.66, "bear": 0.95, "lion": 0.74, "dog": 0.9, "cat": 0.8}
static var manifest: Dictionary = {}
static var _tex_cache := {}

var layers: Array[Sprite2D] = []
var weapon: Sprite2D = null
var _weapon_index := 0
var anim := "idle"
var loop := true
var fps := 5.0
var frame_idx := 0
var frame_time := 0.0
var facing := 1
var shadow: Sprite2D


static func load_manifest() -> Dictionary:
	if manifest.is_empty():
		var f := FileAccess.open(BASE + "sprites/gladiator/manifest.json", FileAccess.READ)
		manifest = JSON.parse_string(f.get_as_text())
	return manifest


static func tex(rel: String) -> Texture2D:
	if not _tex_cache.has(rel):
		_tex_cache[rel] = load(BASE + rel)
	return _tex_cache[rel]


func _init() -> void:
	load_manifest()
	shadow = Sprite2D.new()
	shadow.texture = _shadow_texture()
	shadow.modulate = Color(1, 1, 1, 0.85)
	add_child(shadow)


## Aparência + equipamento: {appearance: {...}, gear: {slot: itemDef}}
func set_visual(appearance: Dictionary, gear: Dictionary, extra: Array = []) -> void:
	for l in layers:
		remove_child(l)
		l.queue_free()
	layers.clear()
	if weapon:
		remove_child(weapon)
		weapon.queue_free()
		weapon = null
	var m := manifest
	var beast = appearance.get("_beast") if appearance.has("_beast") else gear.get("_beast")
	if beast != null:
		# fera: uma folha só com os mesmos quadros do gladiador, reduzida para a proporção de um homem
		var s := Sprite2D.new()
		s.texture = tex("sprites/beasts/beast_%s.png" % beast)
		s.hframes = int(m.frameCount)
		s.centered = false
		s.offset = Vector2(-float(m.originX), -float(m.originY))
		s.scale = Vector2.ONE * BEAST_SCALE.get(beast, 0.7)
		add_child(s)
		layers.append(s)
		_apply_frame()
		return
	var entries: Array = []
	var push := func(sheet: String, tint: Color):
		if m.sheets.has(sheet):
			entries.append({"sheet": sheet, "tint": tint, "layer": m.sheets[sheet].layer})
		elif sheet.begins_with("weapon_") and m.weapons.has(sheet.substr(7)):
			entries.append({"sheet": sheet, "tint": tint, "layer": "weapon", "weapon": sheet.substr(7)})
	var skin := int(appearance.get("skin", 0))
	var hair_col := Data.hex_color(int(Data.d.hairColors[int(appearance.get("hairColor", 0))]))
	push.call("body_back_%d" % skin, Color.WHITE)
	push.call("body_main_%d" % skin, Color.WHITE)
	push.call("cloth", Data.hex_color(int(Data.d.clothColors[int(appearance.get("clothColor", 0))])))
	push.call("belt", Color.WHITE)
	push.call("body_front_%d" % skin, Color.WHITE)
	push.call("arm_top_%d" % skin, Color.WHITE)
	if not gear.has("head"):
		push.call("hair_%d" % int(appearance.get("hairStyle", 0)), hair_col)
	if appearance.get("beard", false):
		push.call("beard", hair_col)
	for ex in extra:
		push.call(str(ex.sheet), Data.hex_color(int(ex.tint)) if ex.has("tint") else Color.WHITE)
	for slot in gear:
		var it: Dictionary = gear[slot]
		var v: Dictionary = it.get("visual", {})
		var tint := Data.hex_color(int(v.tint)) if v.has("tint") else Color.WHITE
		for s in v.get("sheets", []):
			push.call(s, tint)
	var order := {}
	for i in m.layerOrder.size():
		order[m.layerOrder[i]] = i
	entries.sort_custom(func(a, b): return order.get(a.layer, 0) < order.get(b.layer, 0))
	for e in entries:
		if e.has("weapon"):
			var wd: Dictionary = m.weapons[e.weapon]
			weapon = Sprite2D.new()
			weapon.texture = tex(wd.file)
			weapon.centered = false
			weapon.offset = Vector2(-float(wd.gripX), -float(wd.gripY))
			weapon.modulate = e.tint
			add_child(weapon)
			_weapon_index = weapon.get_index()
			continue
		var s := Sprite2D.new()
		s.texture = tex(m.sheets[e.sheet].file)
		s.hframes = int(m.frameCount)
		s.centered = false
		s.offset = Vector2(-float(m.originX), -float(m.originY))
		s.modulate = e.tint
		add_child(s)
		layers.append(s)
	_apply_frame()


func play(name: String, opts: Dictionary = {}) -> void:
	var def: Dictionary = manifest.animations.get(name, manifest.animations.idle)
	var had_seq := not seq.is_empty()
	seq = []
	if name == anim and not opts.get("restart", false) and not had_seq:
		fps = float(opts.get("fps", def.fps))
		return
	anim = name
	loop = bool(opts.get("loop", def.loop))
	fps = float(opts.get("fps", def.fps))
	frame_idx = 0
	frame_time = 0.0
	_apply_frame()


## Sequência de quadros: [[anim, índice, duração]...] (a última fica parada).
var seq: Array = []
var seq_idx := 0
var seq_t := 0.0


func sequence(steps: Array) -> void:
	seq = steps
	seq_idx = 0
	seq_t = 0.0
	_apply_frame()


func hold(name: String, idx: int) -> void:
	sequence([[name, idx, 999.0]])


func flash() -> void:
	modulate = Color(3, 3, 3)
	var tw := create_tween()
	tw.tween_property(self, "modulate", Color.WHITE, 0.09)


func set_facing(dir: int) -> void:
	facing = dir
	scale.x = absf(scale.x) * dir


var speed_mul := 1.0


func _process(delta: float) -> void:
	tick(delta * speed_mul)


func tick(delta: float) -> void:
	if not seq.is_empty():
		seq_t += delta
		while seq_idx < seq.size() - 1 and seq_t >= float(seq[seq_idx][2]):
			seq_t -= float(seq[seq_idx][2])
			seq_idx += 1
			_apply_frame()
		return
	frame_time += delta
	var def: Dictionary = manifest.animations[anim]
	var step := 1.0 / maxf(0.1, fps)
	while frame_time >= step:
		frame_time -= step
		if frame_idx + 1 < int(def.count):
			frame_idx += 1
		elif loop:
			frame_idx = 0
		_apply_frame()


func current_frame() -> int:
	if not seq.is_empty():
		var st: Array = seq[mini(seq_idx, seq.size() - 1)]
		return int(manifest.animations[st[0]].start) + int(st[1])
	return int(manifest.animations[anim].start) + frame_idx


func _apply_frame() -> void:
	var f := current_frame()
	for l in layers:
		l.frame = f
	if weapon:
		var hand: Array = manifest.hands[f]
		weapon.position = Vector2(round(float(hand[0]) - float(manifest.originX)), round(float(hand[1]) - float(manifest.originY)))
		weapon.rotation_degrees = float(hand[2])
		var top: bool = manifest.weaponTop.has(f)
		move_child(weapon, get_child_count() - 1 if top else mini(_weapon_index, get_child_count() - 1))


## Sombra elíptica suave sob os pés (pixelada: só 3 tons).
static func _shadow_texture() -> Texture2D:
	if _tex_cache.has("_shadow"):
		return _tex_cache["_shadow"]
	var img := Image.create(28, 6, false, Image.FORMAT_RGBA8)
	for y in 6:
		for x in 28:
			var dx := (x - 13.5) / 14.0
			var dy := (y - 2.5) / 3.0
			var r := dx * dx + dy * dy
			if r < 1.0:
				img.set_pixel(x, y, Color(0, 0, 0, 0.42 if r < 0.35 else (0.3 if r < 0.7 else 0.16)))
	var t := ImageTexture.create_from_image(img)
	_tex_cache["_shadow"] = t
	return t
