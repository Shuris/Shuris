extends Node
## Decides which animals are in the creek right now. Eligibility comes from
## the ecosystem (EcosystemRules); how many show up depends on the hour,
## season and weather (data/fauna.json). Big animals (deer, fox) visit on
## game-hour intervals, so meeting one stays special. Total population is
## capped (config animals.max_total).

const CHECK_INTERVAL := 2.5
var world: World
var _timer := 0.0
var _cooldowns: Dictionary = {}
var cfg: Dictionary = {}
var next_deer_h := -1.0
var next_fox_h := -1.0
var _owl_rolled_night := -1


func _ready() -> void:
	Bird.reserved.clear()
	cfg = GameData.config.get("animals", {})


func _process(delta: float) -> void:
	_timer += delta
	for k in _cooldowns.keys():
		_cooldowns[k] = float(_cooldowns[k]) - delta
	if _timer < CHECK_INTERVAL:
		return
	_timer = 0.0
	var snap := GameState.ecosystem_snapshot()
	var total := _alive_total()
	var cap := int(cfg.get("max_total", 12))
	for sp in ["sabia", "saira", "butterfly", "dragonfly", "fish", "duck"]:
		var act := EcosystemRules.activity(sp)
		var target := int(roundf(EcosystemRules.animal_target(sp, snap) * minf(act, 1.3)))
		if act > 0.0 and act < 0.5 and target == 0 and EcosystemRules.animal_eligible(sp, snap) and randf() < act:
			target = 1
		var alive := _alive(sp)
		if alive.size() < target and float(_cooldowns.get(sp, 0.0)) <= 0.0 and total < cap:
			_spawn(sp)
			total += 1
			_cooldowns[sp] = randf_range(5.0, 14.0) if sp != "sabia" else randf_range(8.0, 22.0)
		elif alive.size() > target and alive.size() > 0:
			alive[0].leave()
	_handle_deer()
	_handle_owl()
	_handle_fox()


func _alive_total() -> int:
	var n := 0
	for c in get_tree().get_nodes_in_group("creatures"):
		if c.species != "visitor" and c.species != "":
			n += 1
	return n


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
		"duck":
			c = Duck.new()
			world.entities.add_child(c)
			var young := randi_range(2, 4) if Clock.season() == 0 and _alive("duck").is_empty() else 0
			(c as Duck).setup(world, young)
		"owl":
			c = Owl.new()
			world.flyers.add_child(c)
			(c as Owl).setup(world)
	return c


func _interval(r: Array, act: float) -> float:
	return randf_range(float(r[0]), float(r[1])) / maxf(act, 0.25)


func _handle_deer() -> void:
	var now := Clock.total_hours
	if next_deer_h < 0.0:
		next_deer_h = now + randf_range(1.0, 4.0)
	if not GameState.eligible_animals.has("deer") or now < next_deer_h:
		return
	var act := EcosystemRules.activity("deer")
	if act < 0.3 or _alive("deer").size() > 0:
		next_deer_h = now + 0.5
		return
	spawn_deer(false)
	next_deer_h = now + _interval(cfg.get("deer_interval_hours", [5.0, 14.0]), act)


func spawn_deer(with_fawn: bool) -> Deer:
	var spots: Array = GameData.scene.get("drink_spots", [])
	if spots.is_empty():
		return null
	var d := Deer.new()
	world.entities.add_child(d)
	d.setup(world, spots[randi() % spots.size()])
	if with_fawn:
		d.add_fawn()
	return d


func _handle_owl() -> void:
	if not GameState.eligible_animals.has("owl") or EcosystemRules.activity("owl") < 0.4:
		return
	# one roll per night: some nights the owl comes, some it doesn't
	var night_id := int(floorf((Clock.total_hours + 6.0) / 24.0))
	if night_id == _owl_rolled_night:
		return
	_owl_rolled_night = night_id
	if randf() < float(cfg.get("owl_chance_night", 0.6)) and _alive("owl").is_empty():
		get_tree().create_timer(randf_range(5.0, 40.0)).timeout.connect(func() -> void: _spawn("owl"))


func _handle_fox() -> void:
	var now := Clock.total_hours
	if next_fox_h < 0.0:
		next_fox_h = now + randf_range(2.0, 8.0)
	if not GameState.eligible_animals.has("fox") or now < next_fox_h:
		return
	var act := EcosystemRules.activity("fox")
	if act < 0.5 or not get_tree().get_nodes_in_group("visitors").is_empty():
		next_fox_h = now + 0.5
		return
	spawn_wanderer("fox")
	next_fox_h = now + _interval(cfg.get("fox_interval_hours", [10.0, 30.0]), act)


func spawn_wanderer(kind: String) -> Wanderer:
	var w := Wanderer.new()
	world.entities.add_child(w)
	w.setup(world, kind)
	return w


func spawn_flock(n: int) -> void:
	for i in n:
		get_tree().create_timer(i * 0.35).timeout.connect(func() -> void: _spawn("sabia"))


## Used by visitors feeding birds at a feeder.
func call_bird_to(feeder: Node2D) -> void:
	var pp: Variant = feeder.perch_point()
	if pp != null:
		bird_to_point(pp)


## A bird flies straight to a point (feeder, nest) and perches there.
func bird_to_point(p: Vector2) -> void:
	var b := Bird.new()
	world.flyers.add_child(b)
	b.setup(world, "sabia" if randf() < 0.6 or not GameState.eligible_animals.has("saira") else "saira")
	b._release()
	b._fly_to(p)
