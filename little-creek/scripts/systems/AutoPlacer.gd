class_name AutoPlacer
extends RefCounted
## Chooses where a purchased element goes, so the scene keeps a natural
## composition without manual placement. Each category has its own rule:
##   meadow  flowers/grass: open sunny ground, in small drifts near similar plants
##   bank    rocks: close to the creek banks
##   shade   ferns: near trees, rocks and the water (moist, shaded)
##   edge    shrubs/logs: forest edges, beside trees, away from the trail
##   grove   trees: spaced out, toward the sides and back, never mid-meadow
##   water   aquatic plants: calm water near the banks
##   trail   bench/feeder: beside the trail (needs the stage-4 trail)
##   view    deck: overlooking the creek next to the trail
##   bridge  fixed spot over the calm stretch
## Candidates are sampled and scored; the best valid one wins.

const SAMPLES := 260


static func choose(world: World, id: String) -> Variant:
	var def: Dictionary = GameData.items[id]
	var rule: String = def.get("placement", "meadow")
	var p: Variant = _choose_rule(world, id, rule)
	# natural growths (rare flower) fall back to open ground if the banks are full
	if p == null and def.get("hidden", false) and rule != "meadow":
		p = _choose_rule(world, id, "meadow")
	return p


static func _choose_rule(world: World, id: String, rule: String) -> Variant:
	if rule == "bridge":
		var b: Dictionary = GameData.scene["bridge"]
		return Vector2(float(b["x"]), float(b["y"]))
	var best: Variant = null
	var best_score := -1e9
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	for i in SAMPLES:
		var p: Variant = _candidate(world, rule, rng)
		if p == null:
			continue
		if world.placement_error(id, p) != "":
			continue
		var sc := _score(world, id, rule, p) + rng.randf() * 0.35
		if sc > best_score:
			best_score = sc
			best = p
	return best


static func _candidate(world: World, rule: String, rng: RandomNumberGenerator) -> Variant:
	if rule == "water":
		return world.random_water_point(230.0) + Vector2(rng.randf_range(-6, 6), 0)
	if rule == "trail" or rule == "view":
		var path: Array = GameData.scene.get("trail", [])
		var a: Dictionary = path[rng.randi() % (path.size() - 1)]
		var off := Vector2(rng.randf_range(-26, 26), rng.randf_range(-12, 14))
		return Vector2(float(a["x"]), float(a["y"])) + off
	return Vector2(rng.randf_range(96, 704), rng.randf_range(206, 350))


static func _dist_water(world: World, p: Vector2) -> float:
	var best := 999.0
	for r in GameData.scene.get("creek_rows", []):
		var y := float(r["y"])
		if absf(y - p.y) > 6.0:
			continue
		best = minf(best, minf(absf(p.x - float(r["l"])), absf(p.x - float(r["r"]))))
	return best


static func _near(world: World, p: Vector2, cats: Array, radius: float) -> int:
	var n := 0
	for it in world.items.values():
		if it.id in cats or String(it.def.get("category", "")) in cats:
			if Vector2(it.position.x - p.x, (it.position.y - p.y) * 1.8).length() < radius:
				n += 1
	return n


static func _nearest(world: World, p: Vector2) -> float:
	var best := 999.0
	for it in world.items.values():
		best = minf(best, Vector2(it.position.x - p.x, (it.position.y - p.y) * 1.8).length())
	return best


static func _trail_dist(p: Vector2) -> float:
	var best := 999.0
	for key in ["trail", "trail_spur", "trail_east"]:
		var path: Array = GameData.scene.get(key, [])
		for i in path.size() - 1:
			var a := Vector2(float(path[i]["x"]), float(path[i]["y"]))
			var b := Vector2(float(path[i + 1]["x"]), float(path[i + 1]["y"]))
			var t := clampf((p - a).dot(b - a) / maxf((b - a).length_squared(), 0.001), 0.0, 1.0)
			best = minf(best, p.distance_to(a + (b - a) * t))
	return best


static func _score(world: World, id: String, rule: String, p: Vector2) -> float:
	var dw := _dist_water(world, p)
	var spread := clampf(_nearest(world, p) / 60.0, 0.0, 1.0)   # avoid clutter
	var center := absf(p.x - 400.0) / 300.0                      # 0 centre .. 1 sides
	var depth := (p.y - 206.0) / 144.0                            # 0 back .. 1 front
	var tdist := _trail_dist(p)
	var s := 0.0
	match rule:
		"meadow":
			s = spread * 0.6 + clampf(dw / 40.0, 0.0, 1.0) * 0.4
			s += 0.7 * minf(_near(world, p, [id], 46.0), 2)          # drifts of the same plant
			s -= 0.6 * _near(world, p, ["trees"], 40.0)
			s -= 0.3 if tdist < 12.0 else 0.0
		"bank":
			s = 1.5 - absf(dw - 14.0) / 14.0 + spread * 0.5
		"shade":
			s = 0.8 * minf(_near(world, p, ["trees", "rocks"], 50.0), 2) + 1.0 - clampf(dw / 50.0, 0.0, 1.0) + spread * 0.3
		"edge":
			s = center * 1.2 + 0.6 * minf(_near(world, p, ["trees"], 70.0), 2) + spread * 0.4
			s -= 0.8 if tdist < 16.0 else 0.0
		"grove":
			s = center * 1.6 + (1.0 - depth) * 0.6 + spread * 1.2 + clampf(dw / 50.0, 0.0, 1.0) * 0.6
			s -= 1.0 if tdist < 20.0 else 0.0
			s -= 2.0 * _near(world, p, ["trees"], 50.0)
		"water":
			s = 1.0 - clampf(dw / 16.0, 0.0, 1.0) * 0.5 + spread
		"trail":
			s = 2.0 - absf(tdist - 15.0) / 8.0 + spread * 0.5
		"view":
			s = 2.0 - absf(tdist - 18.0) / 8.0 + 1.5 - clampf(dw / 50.0, 0.0, 1.0)
	return s
