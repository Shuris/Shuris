extends Node
## Occasional, quiet human presence (stage 4). Frequency depends on beauty,
## structures, trails, season, weather and time of day (config: visitors).
## At most one group at a time. Seasonal profiles: birdwatchers and
## photographers in spring, families in summer, leaf photographers in autumn,
## rare hikers in winter. Nobody crosses the creek without the bridge
## (route logic lives in Visitor.build_route).

var world: World
var cfg: Dictionary = {}
var _timer := 60.0


func _ready() -> void:
	cfg = GameData.config.get("visitors", {})
	_timer = randf_range(40.0, 90.0)


func frequency_mult() -> float:
	if Clock.is_night():
		return float(cfg.get("night_mult", 0.0))
	var m := float(cfg.get("season_mult", {}).get(Clock.season_key(), 1.0))
	m *= float(cfg.get("rain_mult", {}).get(Weather.state, 1.0))
	m *= clampf(0.6 + GameState.beauty / 250.0, 0.6, 1.4)
	m *= 1.0 + 0.1 * (GameState.item_count("bench") + GameState.item_count("feeder") + GameState.item_count("deck"))
	m *= 1.15 if GameState.has_bridge() else 1.0
	return m


func _process(delta: float) -> void:
	if GameState.stage < 4:
		return
	_timer -= delta * maxf(1.0, GameState.time_scale * 0.5)
	if _timer > 0.0:
		return
	var mult := frequency_mult()
	_timer = randf_range(float(cfg.get("min_interval_s", 160)), float(cfg.get("max_interval_s", 380))) / maxf(mult, 0.2)
	if mult <= 0.0:
		return
	if get_tree().get_nodes_in_group("visitors").size() > 0:
		return
	spawn_group(_profile())


func _profile() -> String:
	var r := randf()
	match Clock.season():
		0:
			return "photographer" if r < 0.5 else "birdwatcher"
		1:
			return "family" if r < 0.55 else ("hiker" if r < 0.8 else "photographer")
		2:
			return "photographer" if r < 0.6 else "birdwatcher"
	return "hiker"


## Spawns a group; returns the visitors created.
func spawn_group(profile: String) -> Array:
	var variants: Array = {"photographer": [1], "birdwatcher": [0], "hiker": [2], "family": [2, 1, 3]}.get(profile, [0])
	var out: Array = []
	var leader: Visitor = null
	for i in variants.size():
		var v := Visitor.new()
		world.entities.add_child(v)
		v.add_to_group("visitors")
		v.profile = profile
		v.setup(world, int(variants[i]), self)
		if leader == null:
			leader = v
		else:
			v.follow(leader, i)
		out.append(v)
	return out


func call_bird_to(feeder: Node2D) -> void:
	var wd := get_parent().get_node_or_null("WildlifeDirector")
	if wd:
		wd.call_bird_to(feeder)


## Visitors leave donations (water/seeds) and build reputation.
func reward(v: Node2D, kind: String, subject: String) -> void:
	var w := 0.0
	var rep := 0.0
	var txt := ""
	match kind:
		"photo":
			rep = 2.0
			w = GameState.water_rate * 6.0
			txt = "foto"
			if subject == "deer":
				rep = 6.0
				w *= 3.0
				txt = "foto do veado!"
			elif subject == "maned_wolf":
				rep = 12.0
				w *= 6.0
				txt = "foto do lobo-guará!"
			elif subject != "":
				rep = 3.0
				txt = "foto da vida selvagem"
			elif Clock.season() == 2:
				txt = "foto das folhas de outono"
		"bench":
			rep = 2.0
			w = GameState.water_rate * 4.0
			txt = "descanso"
		"feeder":
			rep = 2.0
			w = GameState.water_rate * 3.0
			txt = "alimentou os pássaros"
		"view":
			rep = 1.0
			w = GameState.water_rate * 3.0
			txt = "contemplou o riacho"
		"wave":
			rep = 0.5
			txt = "acenou"
	GameState.add_resources(w, 0.0, rep)
	world.floating_text.emit(v.position + Vector2(0, -44), "%s  +%s" % [txt, NumFmt.short(w)] if w > 0 else txt, Palette.GOLD)
