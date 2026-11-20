class_name Rabbit
extends Creature
## Coelho-do-mato. Comes out from under a shrub, then chains small activities:
##   look   - sits still, ears turning, watches around
##   forage - hops to a grass clump and nibbles it
##   wander - short hops to a nearby free spot (same bank, off the roads)
##   rest   - loafs near a tree or shrub in a quiet spot
##   hide   - slips behind a shrub for a while
## Hops come in short bursts with pauses (never a constant glide). It flees to
## the nearest shrub (or out of the scene) when tapped, when a visitor comes
## close or when a fox is around. Never crosses the creek or stops on a road.

const HOP_SPEED := 24.0
const FLEE_SPEED := 64.0

var coat := 0
var target := Vector2.ZERO
var after := ""              # activity to start when the target is reached
var hops_left := 0
var wait := 0.0
var activities := 0
var home: PlacedItem          # shrub it came from
var focus: PlacedItem         # grass / shrub / tree of the current activity
var _flee := false


func setup(w: World, c: int = -1) -> void:
	world = w
	species = "rabbit"
	coat = c if c >= 0 else randi() % 3
	setup_sprite("rabbit_%d" % coat, "idle")
	hit_radius = 8.0
	var shrubs := world.items_of("shrub")
	if not shrubs.is_empty():
		home = shrubs[randi() % shrubs.size()]
		position = home.position + Vector2(randf_range(-5, 5), -3)
		modulate.a = 0.0
		create_tween().tween_property(self, "modulate:a", 1.0, 1.2)
		_go(_free_near(home.position + Vector2(randf_range(-30, 30), randf_range(6, 14)), 30.0), "look")
	else:
		position = edge_point(randf() < 0.5, randf_range(270, 330))
		_go(_free_near(Vector2(randf_range(150, 650), randf_range(250, 330)), 60.0), "look")


# ------------------------------------------------------------------ helpers
func _bank(p: Vector2) -> int:
	for r in GameData.scene.get("creek_rows", []):
		if absf(float(r["y"]) - p.y) <= 2.0:
			return -1 if p.x < (float(r["l"]) + float(r["r"])) / 2.0 else 1
	return -1 if p.x < 440.0 else 1


func _same_bank(p: Vector2) -> bool:
	return _bank(p) == _bank(position)


func _free_near(c: Vector2, radius: float) -> Vector2:
	for i in 24:
		var p := c + Vector2(randf_range(-radius, radius), randf_range(-radius, radius) * 0.5)
		if world.animal_spot_ok(p, 3.0) and _same_bank(p):
			return p
	return position


func _go(p: Vector2, then: String) -> void:
	target = p
	after = then
	hops_left = randi_range(1, 3)
	set_state("move")
	play("hop")
	face(p.x - position.x)


func _next_activity() -> void:
	activities += 1
	if activities > randi_range(6, 10):
		leave()
		return
	var r := randf()
	if r < 0.35:
		var grass := world.items_of("grass").filter(func(g: PlacedItem) -> bool: return _same_bank(g.position))
		if not grass.is_empty():
			focus = grass[randi() % grass.size()]
			var side := -1.0 if randf() < 0.5 else 1.0
			for k in 2:
				var spot := focus.position + Vector2(11.0 * side, 2.0)
				if world.walkable(spot):
					_go(spot, "forage")
					return
				side = -side
	if r < 0.55:
		_go(_free_near(position, 40.0), "look")
		return
	if r < 0.72:
		var spots: Array = world.items_of("tree_small") + world.items_of("tree_big") + world.items_of("shrub")
		spots = spots.filter(func(s: PlacedItem) -> bool: return _same_bank(s.position))
		if not spots.is_empty():
			focus = spots[randi() % spots.size()]
			_go(_free_near(focus.position + Vector2(randf_range(-16, 16), 8), 10.0), "rest")
			return
	if r < 0.88:
		_hide()
		return
	_go(_free_near(position, 50.0), "look")


func _hide() -> void:
	var shrubs := world.items_of("shrub").filter(func(s: PlacedItem) -> bool: return _same_bank(s.position))
	if shrubs.is_empty():
		leave()
		return
	var best: PlacedItem = shrubs[0]
	for s in shrubs:
		if s.position.distance_to(position) < best.position.distance_to(position):
			best = s
	focus = best
	# just behind the shrub (smaller y) so the leaves are drawn in front of it
	var spot := best.position + Vector2(randf_range(-6, 6), -4.0)
	if not world.walkable(spot):
		spot = best.position + Vector2(0, -3.0)
	_go(spot, "hide")


# ------------------------------------------------------------------ update
func _process(delta: float) -> void:
	state_time += delta
	if not _flee and state != "gone" and _danger():
		flee()
	match state:
		"move":
			var sp := FLEE_SPEED if _flee else HOP_SPEED
			# a hop lasts one animation cycle (4 frames @ 10 fps)
			if step_to(target, sp, delta):
				_arrive()
			elif not _flee and state_time > 0.4 * hops_left:
				set_state("pause")
				wait = randf_range(0.4, 1.4)
				play("idle")
		"pause":
			if state_time > wait:
				hops_left = randi_range(1, 3)
				set_state("move")
				play("hop")
		"look":
			if randf() < delta * 0.6:
				play("ears" if randf() < 0.6 else "look")
			elif not sprite.is_playing():
				play("idle")
			if state_time > wait:
				_next_activity()
		"forage":
			if randf() < delta * 0.25 and is_instance_valid(focus):
				focus.rustle()
			if state_time > wait:
				_next_activity()
		"rest", "hide":
			if state_time > wait:
				if state == "hide":
					modulate.a = 1.0
				_next_activity()
		"exit":
			if step_to(target, FLEE_SPEED if _flee else HOP_SPEED, delta):
				var tw := create_tween()
				tw.tween_property(self, "modulate:a", 0.0, 0.6)
				tw.tween_callback(depart)
				set_state("gone")


func _arrive() -> void:
	match after:
		"forage":
			set_state("forage")
			if is_instance_valid(focus):
				face(focus.position.x - position.x)
			play("eat")
			wait = randf_range(4.0, 9.0)
		"rest":
			set_state("rest")
			play("rest")
			wait = randf_range(7.0, 14.0)
		"hide":
			set_state("hide")
			play("rest")
			wait = randf_range(5.0, 10.0)
			if _flee:
				_flee = false
				wait = randf_range(6.0, 12.0)
		"exit":
			pass
		_:
			set_state("look")
			play("idle")
			wait = randf_range(2.0, 4.5)


func _danger() -> bool:
	for v in get_tree().get_nodes_in_group("visitors"):
		if v.position.distance_to(position) < 80.0:
			return true
	for c in get_tree().get_nodes_in_group("creatures"):
		if c is Wanderer and c.position.distance_to(position) < 110.0:
			return true
	return false


func flee() -> void:
	_flee = true
	var shrubs := world.items_of("shrub").filter(func(s: PlacedItem) -> bool: return _same_bank(s.position))
	if shrubs.is_empty():
		_exit()
		return
	_hide()
	hops_left = 99


func _exit() -> void:
	var left := position.x < 400.0
	target = edge_point(left, position.y)
	set_state("exit")
	play("hop")
	face(target.x - position.x)


func leave() -> void:
	if _leaving:
		return
	_leaving = true
	# slip back under a shrub and vanish, or hop out of the scene
	if is_instance_valid(home):
		target = home.position + Vector2(randf_range(-4, 4), -3)
		set_state("exit")
		play("hop")
		face(target.x - position.x)
	else:
		_exit()


func on_tap() -> void:
	GameState.discover(species)
	if not _flee:
		play("look")
		get_tree().create_timer(0.3).timeout.connect(func() -> void:
			if is_instance_valid(self):
				flee())
