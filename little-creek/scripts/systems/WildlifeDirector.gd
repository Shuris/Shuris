extends Node
## Decides which animals live in the creek right now, based on the ecosystem
## rules, and spawns/dismisses them gradually so the scene feels alive but
## never crowded.

const CHECK_INTERVAL := 2.5
var world: World
var _timer := 0.0
var _cooldowns: Dictionary = {}
var _deer_timer := 20.0



func _ready() -> void:
	Bird.reserved.clear()


func _process(delta: float) -> void:
	_timer += delta
	for k in _cooldowns.keys():
		_cooldowns[k] = float(_cooldowns[k]) - delta
	_deer_timer -= delta * GameState.time_scale
	if _timer < CHECK_INTERVAL:
		return
	_timer = 0.0
	var snap := GameState.ecosystem_snapshot()
	for sp in EcosystemRules.ANIMALS:
		if sp == "deer":
			_handle_deer()
			continue
		var target := EcosystemRules.animal_target(sp, snap)
		var alive := _alive(sp)
		if alive.size() < target and float(_cooldowns.get(sp, 0.0)) <= 0.0:
			_spawn(sp)
			_cooldowns[sp] = randf_range(4.0, 12.0) if sp != "sabia" else randf_range(6.0, 20.0)
		elif alive.size() > target and alive.size() > 0:
			alive[0].leave()


func _alive(sp: String) -> Array:
	var out: Array = []
	for c in get_tree().get_nodes_in_group("creatures"):
		if c.species == sp and not c._leaving:
			out.append(c)
	return out


func _spawn(sp: String) -> Creature:
	var c: Creature
	match sp:
		"sabia", "saira":
			c = Bird.new()
			world.flyers.add_child(c)
			(c as Bird).setup(world, sp)
		"butterfly":
			c = Butterfly.new()
			world.flyers.add_child(c)
			(c as Butterfly).setup(world)
		"dragonfly":
			c = Dragonfly.new()
			world.flyers.add_child(c)
			(c as Dragonfly).setup(world)
		"fish":
			c = Fish.new()
			world.fish_layer.add_child(c)
			(c as Fish).setup(world)
	if c and not GameState.discovered.has(sp):
		get_tree().create_timer(4.0).timeout.connect(func() -> void: GameState.discover(sp))
	return c


func _handle_deer() -> void:
	if not GameState.eligible_animals.has("deer"):
		_deer_timer = maxf(_deer_timer, 15.0)
		return
	if _alive("deer").size() > 0 or _deer_timer > 0.0:
		return
	var spots: Array = GameData.scene.get("drink_spots", [])
	if spots.is_empty():
		return
	var d := Deer.new()
	world.entities.add_child(d)
	d.setup(world, spots[randi() % spots.size()])
	_deer_timer = randf_range(50.0, 110.0)
	if not GameState.discovered.has("deer"):
		get_tree().create_timer(6.0).timeout.connect(func() -> void: GameState.discover("deer"))


## Used by visitors feeding birds at a feeder.
func call_bird_to(feeder: Node2D) -> void:
	var b := Bird.new()
	world.flyers.add_child(b)
	b.setup(world, "sabia" if randf() < 0.6 or not GameState.eligible_animals.has("saira") else "saira")
	b._release()
	var pp: Variant = feeder.perch_point()
	if pp != null:
		b._fly_to(pp)
