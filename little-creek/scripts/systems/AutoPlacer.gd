class_name AutoPlacer
extends RefCounted
## Chooses where a purchased element goes (v0.4: spatial distribution).
##
## Candidates are not just random points: the ground is divided into a grid
## of regions and every region contributes stratified samples, so all parts of
## the scene are always considered. Each candidate must pass hard rules
## (valid zone, whole footprint off the roads, no collision, category minimum
## distance) and is then scored by its category rule:
##   grass    wide coverage: farthest-point spreading + under-used regions
##   flowers  small drifts (2-3) spread over different regions
##   shrubs   groups of 1-3 of varied size, near trees, clear of paths
##   trees    big spacing (crowns barely touch), sides and back preferred
##   rocks    near the banks, spaced
##   ferns    shade/moisture (near trees, rocks, water), spaced
##   aquatic  calm water near the banks, spaced
##   trail    bench/feeder beside (never on) the trail
##   view     deck overlooking the creek beside the trail
##   bridge   fixed, exact spot
## Positions are stored in GameState.placed, so the scene never reshuffles.

const COLS := 6
const ROWS := 3
const GX0 := 96.0
const GX1 := 704.0
const GY0 := 206.0
const GY1 := 350.0
const PER_CELL := 14

## Minimum distance to the same kind (ellipse metric: y counts 1.8x).
const SAME_MIN := {"grass": 40.0, "flowers": 18.0, "small_rock": 28.0, "big_rock": 46.0, "fern": 34.0,
	"shrub": 26.0, "log": 70.0, "aquatic": 30.0, "tree_small": 58.0, "tree_big": 78.0, "bench": 90.0,
	"feeder": 90.0, "deck": 200.0, "rare_flower": 0.0}
## Cluster sizes: flowers form drifts, shrubs groups of varied size.
const CLUSTER := {"flowers": [3, 2, 3, 2], "shrub": [2, 1, 3, 2]}
const CLUSTER_RADIUS := {"flowers": 34.0, "shrub": 44.0}


static func choose(world: World, id: String) -> Variant:
	var def: Dictionary = GameData.items[id]
	var rule: String = def.get("placement", "meadow")
	if rule == "bridge":
		var b: Dictionary = GameData.scene["bridge"]
		return Vector2(float(b["x"]), float(b["y"]))
	var p: Variant = null
	# up to three passes with denser sampling before giving up
	for density in [1, 3, 6]:
		p = _best(world, id, rule, density)
		if p != null:
			break
	if p == null and def.get("hidden", false) and rule != "meadow":
		p = _best(world, id, "meadow")
	return p


# ------------------------------------------------------------------ helpers
static func _dist(a: Vector2, b: Vector2) -> float:
	return Vector2(a.x - b.x, (a.y - b.y) * 1.8).length()


static func _of(world: World, ids: Array) -> Array:
	var out: Array = []
	for it in world.items.values():
		if it.id in ids:
			out.append(it)
	return out


static func _cell(p: Vector2) -> int:
	var cx := clampi(int((p.x - GX0) / (GX1 - GX0) * COLS), 0, COLS - 1)
	var cy := clampi(int((p.y - GY0) / (GY1 - GY0) * ROWS), 0, ROWS - 1)
	return cy * COLS + cx


static func _nearest(p: Vector2, list: Array) -> float:
	var best := 9999.0
	for it in list:
		best = minf(best, _dist(p, it.position))
	return best


static func _dist_water(p: Vector2) -> float:
	var best := 999.0
	for r in GameData.scene.get("creek_rows", []):
		if absf(float(r["y"]) - p.y) > 6.0:
			continue
		best = minf(best, minf(absf(p.x - float(r["l"])), absf(p.x - float(r["r"]))))
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


## The cluster (list of items) the next flower/shrub should join, or [] to
## start a new cluster. Clusters = items of that id closer than the radius,
## the "current" one is the cluster of the most recently placed item.
static func _open_cluster(world: World, id: String) -> Array:
	var mine := _of(world, [id])
	if mine.is_empty() or not CLUSTER.has(id):
		return []
	var last: PlacedItem = mine[0]
	for it in mine:
		if it.uid > last.uid:
			last = it
	var group: Array = [last]
	var changed := true
	while changed:
		changed = false
		for it in mine:
			if it in group:
				continue
			for g in group:
				if _dist(it.position, g.position) < CLUSTER_RADIUS[id]:
					group.append(it)
					changed = true
					break
	# target size of this cluster depends on how many clusters exist already
	var n_clusters := maxi(1, int(round(mine.size() / 2.5)))
	var sizes: Array = CLUSTER[id]
	var target := int(sizes[(n_clusters - 1) % sizes.size()])
	return group if group.size() < target else []


static func _candidates(world: World, rule: String, rng: RandomNumberGenerator, density: int = 1) -> Array:
	var out: Array = []
	if rule == "water":
		for i in 160:
			out.append(world.random_water_point(230.0) + Vector2(rng.randf_range(-6, 6), rng.randf_range(-2, 2)))
		return out
	# stratified: every region of the ground contributes samples
	for cy in ROWS:
		for cx in COLS:
			for k in PER_CELL * density:
				out.append(Vector2(lerpf(GX0, GX1, (cx + rng.randf()) / COLS), lerpf(GY0, GY1, (cy + rng.randf()) / ROWS)))
	if rule == "trail" or rule == "view":
		var path: Array = GameData.scene.get("trail", [])
		for i in 80:
			var a: Dictionary = path[rng.randi() % (path.size() - 1)]
			out.append(Vector2(float(a["x"]), float(a["y"])) + Vector2(rng.randf_range(-34, 34), rng.randf_range(-16, 18)))
	return out


# ------------------------------------------------------------------ choose
static func _best(world: World, id: String, rule: String, density: int = 1) -> Variant:
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	var same := _of(world, [id])
	var cluster := _open_cluster(world, id)
	var trees := _of(world, ["tree_small", "tree_big"])
	var structs := _of(world, ["bench", "feeder", "deck"])
	# region usage by this category (for balance)
	var usage := {}
	for it in same:
		var c := _cell(it.position)
		usage[c] = int(usage.get(c, 0)) + 1
	var all_usage := {}
	for it in world.items.values():
		var c2 := _cell(it.position)
		all_usage[c2] = int(all_usage.get(c2, 0)) + 1
	var best: Variant = null
	var best_score := -1e9
	var shade_src := _of(world, ["tree_small", "tree_big", "small_rock", "big_rock"])
	var mind: float = SAME_MIN.get(id, 24.0)
	var zone: String = GameData.items[id].get("zone", "ground")
	for p0 in _candidates(world, rule, rng, density):
		# validate exactly the position that will be stored (whole pixels)
		var p: Vector2 = (p0 as Vector2).round()
		# ---- hard rules (cheapest first)
		if not world.zone_ok(zone, p):
			continue
		var dsame := _nearest(p, same)
		if dsame < mind:
			continue
		if rule == "grove":
			if _nearest(p, trees) < (64.0 if id == "tree_big" else 54.0):
				continue
			# keep the view of the creek and the bridge open: no trees in the
			# central foreground corridor, big trees only toward the back/sides
			if p.x > 320.0 and p.x < 590.0 and p.y > 244.0:
				continue
			if id == "tree_big" and p.y > 280.0 and absf(p.x - 400.0) < 230.0:
				continue
			if _trail_dist(p) < 26.0:
				continue
		if id in ["shrub", "log", "tree_small", "tree_big"] and _nearest(p, structs) < 40.0:
			continue
		if world.placement_error(id, p) != "":
			continue
		# ---- soft rules
		var cell := _cell(p)
		var used := float(usage.get(cell, 0))
		var crowd := float(all_usage.get(cell, 0))
		var spread: float = clampf(dsame / 120.0, 0.0, 1.0)
		var dw := _dist_water(p)
		var td := _trail_dist(p)
		var side: float = absf(p.x - 400.0) / 300.0
		var back: float = 1.0 - (p.y - GY0) / (GY1 - GY0)
		var s := 0.0
		match rule:
			"meadow":
				if id == "flowers" and not cluster.is_empty():
					# join the open drift: close to its members, same region
					var dc := _nearest(p, cluster)
					s = 3.0 - absf(dc - 22.0) / 8.0
				else:
					s = spread * 2.5 - used * 1.2 - crowd * 0.15 + clampf(dw / 50.0, 0.0, 1.0) * 0.5
					s -= 0.8 if _nearest(p, trees) < 34.0 else 0.0
			"edge":
				if id == "shrub" and not cluster.is_empty():
					var dc2 := _nearest(p, cluster)
					s = 3.0 - absf(dc2 - 30.0) / 10.0
				else:
					s = spread * 2.0 - used * 1.0 + side * 0.8
					var dt := _nearest(p, trees)
					s += 0.8 if dt > 40.0 and dt < 90.0 else 0.0
				s -= 1.2 if td < 26.0 else 0.0   # keep passages open
			"grove":
				s = spread * 2.0 + side * 1.4 + back * 0.6 - used * 1.0 - crowd * 0.2
				s += clampf(_nearest(p, trees) / 140.0, 0.0, 1.0) * 1.5
				s -= 1.0 if td < 26.0 else 0.0
			"bank":
				s = 2.0 - absf(dw - 16.0) / 10.0 + spread * 1.5 - used * 0.8
			"shade":
				var near := 0
				for it in shade_src:
					if _dist(p, it.position) < 60.0:
						near += 1
				s = 0.6 * minf(float(near), 2.0)
				s += 1.0 - clampf(dw / 60.0, 0.0, 1.0) + spread * 1.5 - used * 0.8
			"water":
				s = 1.0 - clampf(dw / 18.0, 0.0, 1.0) * 0.6 + spread * 2.0
			"trail":
				s = 2.0 - absf(td - 22.0) / 8.0 + spread * 1.0
			"view":
				s = 2.0 - absf(td - 26.0) / 8.0 + 1.5 - clampf(dw / 50.0, 0.0, 1.0)
		s += rng.randf() * 0.3   # natural variation
		if s > best_score:
			best_score = s
			best = p
	return best
