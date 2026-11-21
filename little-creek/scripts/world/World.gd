class_name World
extends Node2D
## The creek scene. Builds every visual layer (back to front), keeps shader
## parameters in sync with the ecosystem state, owns placed items and answers
## spatial questions (is this water? can I build here? where can birds perch?).
##
## Coordinates are art pixels: the world is 800x360 and lives inside a
## SubViewport that is displayed at an integer scale.

signal water_tapped(world_pos: Vector2, gained: Dictionary)
signal floating_text(world_pos: Vector2, text: String, color: Color)

const W := 800
const H := 360
const ENV := "res://assets/sprites/environment/"
const FX := "res://assets/sprites/effects/"
const DISSOLVE := preload("res://shaders/dissolve.gdshader")
const SWAY := preload("res://shaders/sway.gdshader")
const WATER_SHADER := preload("res://shaders/water.gdshader")
const RAYS := preload("res://shaders/light_rays.gdshader")
const FOG := preload("res://shaders/fog.gdshader")
const FOLIAGE := preload("res://shaders/foliage.gdshader")
const REVEAL := preload("res://shaders/reveal.gdshader")

var noise_tex: Texture2D
var zones: Image
var water_mask_tex: Texture2D

var ground_mat: ShaderMaterial
var rocks_mat: ShaderMaterial
var trail_mat: ShaderMaterial
var fgb_mat: ShaderMaterial
var fgt_mat: ShaderMaterial
var water_mat: ShaderMaterial
var rays_mat: ShaderMaterial
var fog_mat: ShaderMaterial

var weather_fx: WeatherFX
var fireflies: Fireflies
var leaf_system: FloatingLeaves
var bridge_layer: Node2D
var trail2_mat: ShaderMaterial
var trail2_amount := 0.0
var snow_mat: ShaderMaterial
var footprints: Footprints
var season_decor: SeasonDecor
var season_mats: Dictionary = {}  # "litter"/"frost"/"flowers" -> reveal material
var fish_layer: Node2D
var entities: Node2D
var flyers: Node2D
var fx_layer: Node2D
var ghost: Sprite2D
var pollen: CPUParticles2D
var leaves: CPUParticles2D
var leaf_tex_green: Texture2D
var leaf_tex_autumn: Texture2D
var motes: CPUParticles2D

var lights_root: Node2D     # additive light layer (fireflies...), set by Main
var items: Dictionary = {}  # uid -> PlacedItem
var frame_trees: Array = []

var lush := 0.0
var quality := 0.12
var trail_amount := 0.0
var _initialized := false


func _ready() -> void:
	noise_tex = load(FX + "noise_rgba.png")
	RenderingServer.global_shader_parameter_set("season_noise", noise_tex)
	zones = (load(ENV + "zones.png") as Texture2D).get_image()
	_build_layers()
	weather_fx.setup(self)
	fireflies = Fireflies.new()
	fireflies.name = "Fireflies"
	add_child(fireflies)
	fireflies.setup(self)
	leaf_system = FloatingLeaves.new()
	leaf_system.name = "FloatingLeaves"
	add_child(leaf_system)
	leaf_system.setup(self)
	GameState.item_placed.connect(_on_item_placed)
	GameState.item_removed.connect(_on_item_removed)
	GameState.stage_changed.connect(_on_stage_changed)


# ------------------------------------------------------------------ layers
func _sprite(path: String, parent: Node = self) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = load(path)
	s.centered = false
	parent.add_child(s)
	return s


func _dissolve_mat(tex_b_path: String) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = DISSOLVE
	m.set_shader_parameter("tex_b", load(tex_b_path))
	m.set_shader_parameter("noise_tex", noise_tex)
	m.set_shader_parameter("tex_size", Vector2(W, H))
	return m


func _foliage_mat(canopy: float, k: float) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = FOLIAGE
	m.set_shader_parameter("canopy", canopy)
	m.set_shader_parameter("season_k", k)
	return m


func _build_layers() -> void:
	var bg := _sprite(ENV + "bg_forest.png")
	bg.material = _foliage_mat(0.0, 0.85)
	(bg.material as ShaderMaterial).set_shader_parameter("snow_mode", 1)
	(bg.material as ShaderMaterial).set_shader_parameter("snow_k", 0.8)
	weather_fx = WeatherFX.new()
	weather_fx.name = "WeatherFX"
	add_child(weather_fx)
	weather_fx.make_rainbow(self)

	var ground := _sprite(ENV + "ground_dry.png")
	ground_mat = _dissolve_mat(ENV + "ground_lush.png")
	ground_mat.set_shader_parameter("season_k", 0.7)
	ground_mat.set_shader_parameter("snow_k", 0.0)  # the ground has its own snow layer
	ground.material = ground_mat
	for key in ["flowers", "litter", "frost"]:
		var ov := _sprite(ENV + "season_%s.png" % key)
		var rm := ShaderMaterial.new()
		rm.shader = REVEAL
		rm.set_shader_parameter("noise_tex", noise_tex)
		ov.material = rm
		season_mats[key] = rm
	weather_fx.make_puddles(self)

	# trail: revealed in pixel clusters at stage 4
	var trail := _sprite(ENV + "trail.png")
	trail_mat = ShaderMaterial.new()
	trail_mat.shader = preload("res://shaders/reveal.gdshader")
	trail_mat.set_shader_parameter("noise_tex", noise_tex)
	trail.material = trail_mat

	var water := _sprite("res://assets/sprites/water/water_flow.png")
	water_mask_tex = water.texture
	water_mat = ShaderMaterial.new()
	water_mat.shader = WATER_SHADER
	water_mat.set_shader_parameter("meta_tex", load("res://assets/sprites/water/water_meta.png"))
	water_mat.set_shader_parameter("extra_tex", load("res://assets/sprites/water/water_extra.png"))
	water_mat.set_shader_parameter("bed_tex", load("res://assets/sprites/water/water_bed.png"))
	water_mat.set_shader_parameter("noise_tex", noise_tex)
	water_mat.set_shader_parameter("world_size", Vector2(W, H))
	water_mat.set_shader_parameter("clean", Palette.vec3_ramp(Palette.WATER))
	water_mat.set_shader_parameter("murky", Palette.vec3_ramp(Palette.WATER_MURKY))
	water.material = water_mat

	fish_layer = Node2D.new()
	fish_layer.name = "Fish"
	add_child(fish_layer)

	var rocks := _sprite("res://assets/sprites/rocks/creek_rocks_bare.png")
	rocks_mat = _dissolve_mat("res://assets/sprites/rocks/creek_rocks_moss.png")
	rocks_mat.set_shader_parameter("edge_glow", 0.0)
	rocks_mat.set_shader_parameter("season_k", 0.25)
	rocks.material = rocks_mat

	bridge_layer = Node2D.new()
	bridge_layer.name = "BridgeLayer"
	add_child(bridge_layer)
	var trail2 := _sprite(ENV + "trail_bridge.png")
	trail2_mat = ShaderMaterial.new()
	trail2_mat.shader = REVEAL
	trail2_mat.set_shader_parameter("noise_tex", noise_tex)
	trail2.material = trail2_mat
	move_child(trail2, trail.get_index() + 1)
	var piles := Node2D.new()
	piles.name = "LeafPiles"
	add_child(piles)
	move_child(piles, trail2.get_index() + 1)
	var snow := _sprite(ENV + "snow_ground.png")
	snow_mat = ShaderMaterial.new()
	snow_mat.shader = preload("res://shaders/snow_ground.gdshader")
	snow.material = snow_mat
	move_child(snow, trail2.get_index() + 1)
	footprints = Footprints.new()
	footprints.world = self
	add_child(footprints)
	move_child(footprints, snow.get_index() + 1)
	var shadows := Node2D.new()
	shadows.name = "CanopyShadows"
	add_child(shadows)
	move_child(shadows, footprints.get_index() + 1)
	season_decor = SeasonDecor.new()
	add_child(season_decor)
	season_decor.setup(self, shadows, piles)
	var mid := _sprite(ENV + "mid_trees.png")
	mid.material = _foliage_mat(1.0, 0.9)
	(mid.material as ShaderMaterial).set_shader_parameter("has_bare", true)
	(mid.material as ShaderMaterial).set_shader_parameter("bare_tex", load(ENV + "mid_trees_bare.png"))

	var fog := ColorRect.new()
	fog.position = Vector2(0, 126)
	fog.size = Vector2(W, 100)
	fog.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var fm := ShaderMaterial.new()
	fm.shader = FOG
	fm.set_shader_parameter("noise_tex", noise_tex)
	fm.set_shader_parameter("rect_size", fog.size)
	fog.material = fm
	fog_mat = fm
	add_child(fog)

	entities = Node2D.new()
	entities.name = "Entities"
	entities.y_sort_enabled = true
	add_child(entities)
	for t in GameData.scene.get("frame_trees", []):
		var s := Sprite2D.new()
		s.texture = load(ENV + String(t["name"]) + ".png")
		s.centered = false
		s.position = Vector2(float(t["x"]), float(t["base_y"]))
		s.offset = Vector2(float(t["ox"]) - float(t["x"]), -float(t["base_y"]))
		var fm2 := _foliage_mat(0.0, 0.0)   # big trunks: snow on roots/ledges only
		s.material = fm2
		entities.add_child(s)
		frame_trees.append(s)

	var rays := ColorRect.new()
	rays.size = Vector2(W, H)
	rays.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rays_mat = ShaderMaterial.new()
	rays_mat.shader = RAYS
	rays_mat.set_shader_parameter("noise_tex", noise_tex)
	rays.material = rays_mat
	add_child(rays)

	_build_particles()
	_build_steam()

	var fgb := _sprite(ENV + "fg_bottom_dry.png")
	fgb_mat = ShaderMaterial.new()
	fgb_mat.shader = SWAY
	fgb_mat.set_shader_parameter("strength", 1.0)
	fgb_mat.set_shader_parameter("speed", 0.9)
	fgb_mat.set_shader_parameter("use_dissolve", true)
	fgb_mat.set_shader_parameter("tex_b", load(ENV + "fg_bottom_lush.png"))
	fgb_mat.set_shader_parameter("noise_tex", noise_tex)
	fgb_mat.set_shader_parameter("season_k", 0.7)
	fgb.material = fgb_mat

	var fgt := _sprite(ENV + "fg_top.png")
	fgt_mat = ShaderMaterial.new()
	fgt_mat.shader = SWAY
	fgt_mat.set_shader_parameter("strength", 1.0)
	fgt_mat.set_shader_parameter("speed", 0.7)
	fgt_mat.set_shader_parameter("anchor_top", true)
	fgt_mat.set_shader_parameter("canopy", 1.0)
	fgt_mat.set_shader_parameter("has_bare", true)
	fgt_mat.set_shader_parameter("bare_tex", load(ENV + "fg_top_bare.png"))
	fgt_mat.set_shader_parameter("tree_phase", 0.12)
	fgt.material = fgt_mat
	weather_fx.make_rain_layers(self)
	weather_fx.make_snow_layers(self)

	flyers = Node2D.new()
	flyers.name = "Flyers"
	add_child(flyers)
	fx_layer = Node2D.new()
	fx_layer.name = "FX"
	add_child(fx_layer)

	ghost = Sprite2D.new()
	ghost.centered = false
	ghost.visible = false
	add_child(ghost)


var steam: CPUParticles2D


## Vapour rising from the (relatively warm) creek on cold winter mornings.
func _build_steam() -> void:
	steam = CPUParticles2D.new()
	steam.texture = load(FX + "flake_m.png")
	var pts := PackedVector2Array()
	for r in GameData.scene.get("creek_rows", []):
		if float(r["y"]) > 196.0:
			for k in 3:
				pts.append(Vector2(lerpf(float(r["l"]) + 4.0, float(r["r"]) - 4.0, (k + 0.5) / 3.0), float(r["y"])))
	steam.emission_shape = CPUParticles2D.EMISSION_SHAPE_POINTS
	steam.emission_points = pts
	steam.amount = 60
	steam.lifetime = 7.0
	steam.preprocess = 7.0
	steam.direction = Vector2(0.2, -1)
	steam.spread = 25.0
	steam.gravity = Vector2(0.6, -1.5)
	steam.initial_velocity_min = 1.0
	steam.initial_velocity_max = 3.0
	steam.scale_amount_min = 1.0
	steam.scale_amount_max = 2.0
	var g := Gradient.new()
	g.set_color(0, Color(0.92, 0.95, 1.0, 0.0))
	g.add_point(0.3, Color(0.92, 0.95, 1.0, 0.28))
	g.set_color(g.get_point_count() - 1, Color(0.92, 0.95, 1.0, 0.0))
	steam.color_ramp = g
	steam.emitting = false
	add_child(steam)
	move_child(steam, fish_layer.get_index() + 1)


func _build_particles() -> void:
	# dust motes drifting in the sun rays
	motes = CPUParticles2D.new()
	motes.texture = load(FX + "px.png")
	motes.amount = 46
	motes.lifetime = 9.0
	motes.preprocess = 9.0
	motes.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	motes.position = Vector2(470, 170)
	motes.emission_rect_extents = Vector2(300, 150)
	motes.direction = Vector2(-1, 0.4)
	motes.spread = 40.0
	motes.gravity = Vector2(0, 0.6)
	motes.initial_velocity_min = 1.0
	motes.initial_velocity_max = 3.5
	var g := Gradient.new()
	g.set_color(0, Color(1, 0.96, 0.8, 0.0))
	g.add_point(0.25, Color(1, 0.96, 0.8, 0.9))
	g.add_point(0.7, Color(1, 0.96, 0.8, 0.5))
	g.set_color(g.get_point_count() - 1, Color(1, 0.96, 0.8, 0.0))
	motes.color_ramp = g
	add_child(motes)

	# pollen near the ground once things flourish
	pollen = CPUParticles2D.new()
	pollen.texture = load(FX + "px.png")
	pollen.amount = 30
	pollen.lifetime = 7.0
	pollen.preprocess = 7.0
	pollen.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	pollen.position = Vector2(400, 290)
	pollen.emission_rect_extents = Vector2(330, 60)
	pollen.direction = Vector2(0.3, -1)
	pollen.spread = 60.0
	pollen.gravity = Vector2(0, -0.8)
	pollen.initial_velocity_min = 1.0
	pollen.initial_velocity_max = 3.0
	var gp := Gradient.new()
	gp.set_color(0, Color(0.95, 0.95, 0.6, 0.0))
	gp.add_point(0.3, Color(0.95, 0.95, 0.6, 1.0))
	gp.set_color(gp.get_point_count() - 1, Color(0.95, 0.95, 0.6, 0.0))
	pollen.color_ramp = gp
	pollen.emitting = false
	add_child(pollen)

	# leaves drifting down from the canopy
	leaves = CPUParticles2D.new()
	leaf_tex_green = load(FX + "leaf_fall.png")
	leaf_tex_autumn = load(FX + "leaf_fall_dry.png")
	leaves.texture = leaf_tex_green
	var lm := CanvasItemMaterial.new()
	lm.particles_animation = true
	lm.particles_anim_h_frames = 4
	lm.particles_anim_v_frames = 1
	lm.particles_anim_loop = true
	leaves.material = lm
	leaves.amount = 5
	leaves.lifetime = 16.0
	leaves.preprocess = 16.0
	leaves.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	leaves.position = Vector2(400, 20)
	leaves.emission_rect_extents = Vector2(380, 20)
	leaves.direction = Vector2(-0.4, 1)
	leaves.spread = 30.0
	leaves.gravity = Vector2(-1.5, 5.0)
	leaves.initial_velocity_min = 2.0
	leaves.initial_velocity_max = 6.0
	leaves.anim_speed_min = 0.6
	leaves.anim_speed_max = 1.2
	leaves.damping_min = 0.5
	leaves.damping_max = 1.0
	add_child(leaves)


# ------------------------------------------------------------------ state sync
## Rebuild every placed item from GameState (after loading a save).
## Roads must stay free: elements from older saves (or initial scenery that
## predates a trail) that touch a road are moved once to the nearest valid
## spot. The fixed position is stored, so it never changes again.
func migrate_off_roads() -> int:
	var moved := 0
	for d in GameState.placed:
		var id: String = d["id"]
		if id == "bridge" or GameData.items[id].get("zone", "ground") == "fixed":
			continue
		var p := Vector2(float(d["x"]), float(d["y"]))
		if footprint_clear(id, p) and zone_ok(GameData.items[id].get("zone", "ground"), p):
			continue
		var found := false
		for ring in range(1, 30):
			for k in 16:
				var a := TAU * k / 16.0
				var q := (p + Vector2(cos(a), sin(a) * 0.55) * ring * 4.0).round()
				if zone_ok(GameData.items[id].get("zone", "ground"), q) and footprint_clear(id, q) \
						and _clear_of_others(id, q, int(d["uid"])):
					d["x"] = q.x
					d["y"] = q.y
					found = true
					break
			if found:
				break
		if found:
			moved += 1
	if moved > 0:
		SaveSystem.request_save()
	return moved


func _clear_of_others(id: String, q: Vector2, uid: int) -> bool:
	var r := float(GameData.items[id].get("footprint", 8.0))
	for d in GameState.placed:
		if int(d["uid"]) == uid or d["id"] == "bridge":
			continue
		var o := Vector2(float(d["x"]), float(d["y"]))
		var r2 := float(GameData.items[d["id"]].get("footprint", 8.0))
		if Vector2(o.x - q.x, (o.y - q.y) * 1.8).length() < (r + r2) * 0.8:
			return false
	return true


func rebuild_items() -> void:
	for n in items.values():
		n.queue_free()
	items.clear()
	migrate_off_roads()
	if season_decor:
		season_decor._dirty = true
	if bridge_front:
		bridge_front.queue_free()
		bridge_front = null
	for d in GameState.placed:
		_spawn_item(d, false)
	lush = GameState.lushness()
	quality = GameState.quality / 100.0
	trail_amount = 1.0 if GameState.stage >= 4 else 0.0
	_initialized = true
	_apply_visuals()


var bridge_front: Sprite2D


func _spawn_item(d: Dictionary, animate: bool) -> PlacedItem:
	var n := PlacedItem.new()
	n.setup(d, noise_tex)
	if n.id == "bridge":
		# painted in world coordinates: deck + far rail under the walkers,
		# near rail y-sorted at the deck's front edge (in front of walkers)
		var b: Dictionary = GameData.scene["bridge"]
		n.position = Vector2(float(b["x"]), float(b["y"]))
		n.sprite.offset = -n.position
		bridge_layer.add_child(n)
		bridge_front = Sprite2D.new()
		bridge_front.texture = load(ENV + "bridge_front.png")
		bridge_front.centered = false
		bridge_front.position = Vector2(float(b["x"]), float(b["y"]) + float(b["half_depth"]) + 1.0)
		bridge_front.offset = -bridge_front.position
		entities.add_child(bridge_front)
		items[n.uid] = n
		if animate:
			n.pop_in()
		return n
	entities.add_child(n)
	items[n.uid] = n
	if animate:
		n.pop_in()
	return n


func _on_item_placed(d: Dictionary) -> void:
	var n := _spawn_item(d, true)
	var puff := AnimatedSprite2D.new()
	puff.sprite_frames = SpriteLib.strip(FX + "puff.png", 18, 14.0, false)
	puff.position = n.position + Vector2(0, -6)
	fx_layer.add_child(puff)
	puff.play()
	puff.animation_finished.connect(puff.queue_free)
	_apply_visuals()


func _on_item_removed(uid: int) -> void:
	if items.has(uid) and items[uid].id == "bridge" and bridge_front:
		bridge_front.queue_free()
	if items.has(uid):
		items[uid].queue_free()
		items.erase(uid)


func _on_stage_changed(stage: int) -> void:
	if stage >= 4:
		var t := create_tween()
		t.tween_property(self, "trail_amount", 1.0, 5.0)


func _process(delta: float) -> void:
	if not _initialized:
		return
	# vegetation and water recover gradually (visible "sprouting")
	lush = move_toward(lush, GameState.lushness(), delta * 0.035)
	quality = move_toward(quality, GameState.quality / 100.0, delta * 0.05)
	_apply_visuals()


func _apply_visuals() -> void:
	ground_mat.set_shader_parameter("amount", lush)
	fgb_mat.set_shader_parameter("amount", lush)
	var moss := clampf((GameState.vitality - 22.0) / 55.0, 0.0, 1.0)
	rocks_mat.set_shader_parameter("amount", moss)
	trail_mat.set_shader_parameter("amount", trail_amount)
	trail2_amount = move_toward(trail2_amount, 1.0 if GameState.has_bridge() else 0.0, 0.01)
	trail2_mat.set_shader_parameter("amount", trail2_amount)
	water_mat.set_shader_parameter("quality", quality)
	water_mat.set_shader_parameter("flow_speed", (0.75 + quality * 0.35) * (1.0 + Weather.rain * (0.6 if Weather.state == "heavy" else 0.2)))
	pollen.emitting = GameState.stage >= 2
	pollen.amount = 20 + 10 * GameState.stage if GameState.stage >= 2 else 20
	for n in items.values():
		if n.mat.get_shader_parameter("use_dissolve"):
			n.set_moss(moss)
	AudioManager.set_ambience_mix(quality)


# ------------------------------------------------------------------ queries
func is_water(p: Vector2) -> bool:
	var x := int(p.x)
	var y := int(p.y)
	if x < 0 or y < 0 or x >= W or y >= H:
		return false
	return _water_at(x, y)


var _water_img: Image


func _water_at(x: int, y: int) -> bool:
	if _water_img == null:
		_water_img = (load("res://assets/sprites/water/water_flow.png") as Texture2D).get_image()
	return _water_img.get_pixel(x, y).a > 0.5


func zone_ok(zone: String, p: Vector2) -> bool:
	var x := int(p.x)
	var y := int(p.y)
	if x < 0 or y < 0 or x >= W or y >= H:
		return false
	var c := zones.get_pixel(x, y)
	if zone == "water":
		return c.g > 0.5
	if c.r < 0.5:
		return false
	# trails (including the future east trail) stay free
	if c.b > 0.5:
		return false
	return true


## Buys an element and lets the AutoPlacer choose a natural spot for it.
## Returns the placed record, or {} with `last_buy_error` set.
var last_buy_error := ""


func buy(id: String) -> Dictionary:
	last_buy_error = GameState.buy_block_reason(id)
	if last_buy_error != "":
		return {}
	var p: Variant = AutoPlacer.choose(self, id)
	if p == null:
		last_buy_error = "Não há mais espaço adequado para isso"
		return {}
	var v := randi() % int(GameData.items[id].get("variants", 1))
	return GameState.place_item(id, (p as Vector2).round(), v)


## Places an element for free (natural events, e.g. the rare flower).
func place_free(id: String) -> Dictionary:
	var p: Variant = AutoPlacer.choose(self, id)
	if p == null:
		return {}
	var d := {"uid": GameState.next_uid, "id": id, "x": (p as Vector2).x, "y": (p as Vector2).y, "v": 0}
	GameState.next_uid += 1
	GameState.placed.append(d)
	GameState.recompute()
	GameState.item_placed.emit(d)
	SaveSystem.request_save()
	return d


## Validates a placement. Returns "" when OK, otherwise a short reason.
func placement_error(id: String, p: Vector2) -> String:
	var def: Dictionary = GameData.items[id]
	var zone: String = def.get("zone", "ground")
	if zone == "fixed":
		return ""
	if not zone_ok(zone, p):
		return "Aqui não: precisa ser dentro d'água calma." if zone == "water" \
			else "Aqui não: escolha terra firme, longe da água e das pedras."
	if not footprint_clear(id, p):
		return "Aqui não: o elemento ocuparia a estrada."
	var r := float(def.get("footprint", 8.0))
	for n in items.values():
		var d: float = Vector2((n.position - p).x, (n.position - p).y * 1.8).length()
		var min_d: float = (r + n.footprint()) * 0.8
		if d < min_d:
			return "Muito perto de outro elemento."
	return ""


## True when the WHOLE ground area of the element (base ellipse plus the
## bottom band of its sprite) stays off the roads (zones.b = road + margin,
## which also covers the bridge span) and on valid ground/water.
func footprint_clear(id: String, p: Vector2) -> bool:
	var def: Dictionary = GameData.items[id]
	if def.get("zone", "ground") == "fixed":
		return true
	var r := float(def.get("footprint", 8.0))
	var tex := SpriteLib.tex(GameData.item_sprite_path(id, 0))
	var hw := maxf(r, tex.get_width() * 0.42)
	# vertical extent that visually sits on the ground: whole low props and
	# structures (bench, deck...), only the trunk base for trees
	var cat: String = def.get("category", "")
	var band := minf(tex.get_height() * 0.35, 14.0)
	if cat == "structures":
		band = tex.get_height() * 0.7
	elif cat in ["plants", "rocks"]:
		band = tex.get_height() * 0.6
	elif cat == "trees":
		hw = r
	var water: bool = def.get("zone", "ground") == "water"
	for i in 25:
		var q: Vector2
		if i == 0:
			q = p
		elif i <= 8:
			var a := TAU * i / 8.0
			q = p + Vector2(cos(a) * r, sin(a) * r * 0.45)
		else:
			# bottom band of the sprite (what visually sits on the ground)
			var k := i - 9
			q = p + Vector2(lerpf(-hw, hw, (k % 4) / 3.0), -band * float(k / 4) / 3.0)
		var x := int(q.x)
		var y := int(q.y)
		if x < 0 or y < 0 or x >= W or y >= H:
			return false
		var c := zones.get_pixel(x, y)
		if c.b > 0.5:
			return false
		if not water and i <= 8 and _water_at(x, y):
			return false
	return true


## Walkable ground for animals next to an element (ignores the elements).
func walkable(p: Vector2) -> bool:
	var x := int(p.x)
	var y := int(p.y)
	if x < 4 or y < 4 or x >= W - 4 or y >= H - 4:
		return false
	var c := zones.get_pixel(x, y)
	return c.b < 0.5 and not _water_at(x, y) and y > 200


## Ground spot for an animal: valid ground, off roads, not inside an element.
func animal_spot_ok(p: Vector2, clearance: float = 8.0) -> bool:
	var x := int(p.x)
	var y := int(p.y)
	if x < 4 or y < 4 or x >= W - 4 or y >= H - 4:
		return false
	var c := zones.get_pixel(x, y)
	if c.r < 0.5 or c.b > 0.5:
		return false
	for n in items.values():
		if n.id == "bridge":
			continue
		if Vector2(n.position.x - p.x, (n.position.y - p.y) * 1.8).length() < n.footprint() + clearance:
			return false
	return true


func item_at(p: Vector2) -> PlacedItem:
	var best: PlacedItem = null
	for n in items.values():
		if n.id == "bridge":
			continue
		if n.hit_test(p) and (best == null or n.position.y > best.position.y):
			best = n
	return best


## Perch points for birds: canopy points, placed trees/rocks/feeders.
func perch_points() -> Array:
	var out: Array = []
	for p in GameData.scene.get("perches", []):
		out.append(Vector2(float(p["x"]), float(p["y"])))
	for n in items.values():
		var pp: Variant = n.perch_point()
		if pp != null:
			out.append(pp)
	return out


func items_of(id: String) -> Array:
	var out: Array = []
	for n in items.values():
		if n.id == id:
			out.append(n)
	return out


func items_with_poi(poi: String) -> Array:
	var out: Array = []
	for n in items.values():
		if String(n.def.get("poi", "")) == poi:
			out.append(n)
	return out


func random_water_point(min_y: float = 200.0) -> Vector2:
	var rows: Array = GameData.scene.get("creek_rows", [])
	for i in 20:
		var r: Dictionary = rows[randi() % rows.size()]
		if float(r["y"]) < min_y:
			continue
		var x := randf_range(float(r["l"]) + 3.0, float(r["r"]) - 3.0)
		var p := Vector2(x, float(r["y"]))
		if is_water(p):
			return p
	return Vector2(440, 300)


# ------------------------------------------------------------------ interaction
func handle_tap(p: Vector2) -> void:
	for c in get_tree().get_nodes_in_group("creatures"):
		if c.has_method("hit_test") and c.hit_test(p):
			c.on_tap()
			return
	if is_water(p):
		var gained := GameState.tap_water()
		splash(p)
		var txt := "+%s" % NumFmt.short(gained["water"])
		floating_text.emit(p, txt, Palette.WATER_UI)
		if gained["seeds"] > 0:
			floating_text.emit(p + Vector2(0, -8), "+1 semente", Palette.ACCENT)
		AudioManager.play("tap_water", 0.12, -4.0)
		water_tapped.emit(p, gained)
		for f in get_tree().get_nodes_in_group("fish"):
			if f.global_position.distance_to(p) < 30.0:
				f.startle(p)
		return
	var it := item_at(p)
	if it:
		it.rustle()
		AudioManager.play("rustle", 0.15, -10.0)
		return
	if p.y < 110:
		fgt_mat.set_shader_parameter("gust", 2.0)
		var t := create_tween()
		t.tween_method(func(v: float) -> void: fgt_mat.set_shader_parameter("gust", v), 2.0, 0.0, 1.6)
		leaf_system.burst(p + Vector2(0, 10), 6)
		AudioManager.play("rustle", 0.1, -8.0)


func splash(p: Vector2) -> void:
	var s := AnimatedSprite2D.new()
	s.sprite_frames = SpriteLib.strip(FX + "splash.png", 24, 16.0, false)
	s.position = p + Vector2(0, -4)
	fx_layer.add_child(s)
	s.play()
	s.animation_finished.connect(s.queue_free)


func ripple(p: Vector2, small: bool = true) -> void:
	var s := AnimatedSprite2D.new()
	s.sprite_frames = SpriteLib.strip(FX + "splash.png", 24, 10.0, false)
	s.position = p + Vector2(0, -4)
	s.modulate = Color(1, 1, 1, 0.55)
	if small:
		s.frame = 3
	fx_layer.add_child(s)
	s.play()
	s.animation_finished.connect(s.queue_free)


# ------------------------------------------------------------------ build ghost
func show_ghost(id: String, variant: int, p: Vector2) -> bool:
	var tex := SpriteLib.tex(GameData.item_sprite_path(id, variant))
	ghost.texture = tex
	ghost.position = p.round()
	ghost.offset = Vector2(-floorf(tex.get_width() / 2.0), -tex.get_height() + 2)
	var ok := placement_error(id, p) == ""
	ghost.modulate = Color(0.75, 1.0, 0.75, 0.85) if ok else Color(1.0, 0.45, 0.4, 0.7)
	ghost.visible = true
	return ok


func hide_ghost() -> void:
	ghost.visible = false
