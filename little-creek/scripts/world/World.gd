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

var fish_layer: Node2D
var entities: Node2D
var flyers: Node2D
var fx_layer: Node2D
var ghost: Sprite2D
var pollen: CPUParticles2D
var leaves: CPUParticles2D
var motes: CPUParticles2D

var items: Dictionary = {}  # uid -> PlacedItem
var frame_trees: Array = []

var lush := 0.0
var quality := 0.12
var trail_amount := 0.0
var _initialized := false


func _ready() -> void:
	noise_tex = load(FX + "noise_rgba.png")
	zones = (load(ENV + "zones.png") as Texture2D).get_image()
	_build_layers()
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


func _build_layers() -> void:
	_sprite(ENV + "bg_forest.png")

	var ground := _sprite(ENV + "ground_dry.png")
	ground_mat = _dissolve_mat(ENV + "ground_lush.png")
	ground.material = ground_mat

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
	rocks.material = rocks_mat

	_sprite(ENV + "mid_trees.png")

	var fog := ColorRect.new()
	fog.position = Vector2(0, 126)
	fog.size = Vector2(W, 100)
	fog.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var fm := ShaderMaterial.new()
	fm.shader = FOG
	fm.set_shader_parameter("noise_tex", noise_tex)
	fm.set_shader_parameter("rect_size", fog.size)
	fog.material = fm
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

	var fgb := _sprite(ENV + "fg_bottom_dry.png")
	fgb_mat = ShaderMaterial.new()
	fgb_mat.shader = SWAY
	fgb_mat.set_shader_parameter("strength", 1.0)
	fgb_mat.set_shader_parameter("speed", 0.9)
	fgb_mat.set_shader_parameter("use_dissolve", true)
	fgb_mat.set_shader_parameter("tex_b", load(ENV + "fg_bottom_lush.png"))
	fgb_mat.set_shader_parameter("noise_tex", noise_tex)
	fgb.material = fgb_mat

	var fgt := _sprite(ENV + "fg_top.png")
	fgt_mat = ShaderMaterial.new()
	fgt_mat.shader = SWAY
	fgt_mat.set_shader_parameter("strength", 1.0)
	fgt_mat.set_shader_parameter("speed", 0.7)
	fgt_mat.set_shader_parameter("anchor_top", true)
	fgt.material = fgt_mat

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
	leaves.texture = load(FX + "leaf_fall.png")
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
func rebuild_items() -> void:
	for n in items.values():
		n.queue_free()
	items.clear()
	for d in GameState.placed:
		_spawn_item(d, false)
	lush = GameState.lushness()
	quality = GameState.quality / 100.0
	trail_amount = 1.0 if GameState.stage >= 4 else 0.0
	_initialized = true
	_apply_visuals()


func _spawn_item(d: Dictionary, animate: bool) -> PlacedItem:
	var n := PlacedItem.new()
	n.setup(d, noise_tex)
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
	water_mat.set_shader_parameter("quality", quality)
	water_mat.set_shader_parameter("flow_speed", 0.75 + quality * 0.35)
	rays_mat.set_shader_parameter("intensity", 0.8 + 0.1 * GameState.stage)
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
	if trail_amount > 0.5 and c.b > 0.5:
		return false
	return true


## Validates a placement. Returns "" when OK, otherwise a short reason.
func placement_error(id: String, p: Vector2) -> String:
	var def: Dictionary = GameData.items[id]
	var zone: String = def.get("zone", "ground")
	if not zone_ok(zone, p):
		return "Aqui não: precisa ser dentro d'água calma." if zone == "water" \
			else "Aqui não: escolha terra firme, longe da água e das pedras."
	var r := float(def.get("footprint", 8.0))
	for n in items.values():
		var d: float = Vector2((n.position - p).x, (n.position - p).y * 1.8).length()
		var min_d: float = (r + n.footprint()) * 0.8
		if d < min_d:
			return "Muito perto de outro elemento."
	return ""


func item_at(p: Vector2) -> PlacedItem:
	var best: PlacedItem = null
	for n in items.values():
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
		leaves.restart()
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
