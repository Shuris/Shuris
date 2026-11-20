class_name Visitor
extends Creature
## A quiet visitor of the natural refuge: walks the trail, stops to watch the
## water, sits on benches, photographs animals and feeds birds. Leaves small
## donations and reputation.

const SPEED := 15.0
const VIEW_INDEX := 5  # trail point beside the pool (where the bridge spur starts)

var path: Array = []
var idx := 0
var plan: Array = []        # queue of activities
var activity: Dictionary = {}
var wait := 0.0
var director: Node
var returning := false
var view_idx := -1          # index in `path` of the creek view point
var bridge_mid_idx := -1    # index in `path` of the middle of the bridge
var crosses := false
var profile := "visitor"
var leader: Visitor = null
var follow_gap := 0


## Family members walk the leader's route a few steps behind and only stop
## where the leader stops to look.
func follow(l: Visitor, n: int) -> void:
	leader = l
	follow_gap = n
	path = l.path.duplicate()
	view_idx = l.view_idx
	bridge_mid_idx = l.bridge_mid_idx
	crosses = l.crosses
	plan = [{"type": "view"}]
	position = l.position - Vector2(10.0 * n * (1 if path[1].x > path[0].x else -1), -2.0 * n)
	modulate.a = l.modulate.a
	if l.modulate.a < 1.0:
		create_tween().tween_property(self, "modulate:a", 1.0, 2.0)


static func _pts(key: String) -> Array:
	var out: Array = []
	for p in GameData.scene.get(key, []):
		out.append(Vector2(float(p["x"]), float(p["y"])))
	return out


## Points along the arched deck (walkers follow the arch, never the water).
static func bridge_points() -> Array:
	var b: Dictionary = GameData.scene["bridge"]
	var out: Array = []
	var x0 := float(b["x"]) - 46.0
	var x1 := float(b["x"]) + 46.0
	for i in 13:
		var t := i / 12.0
		var x := lerpf(x0, x1, t)
		out.append(Vector2(x, float(b["y"]) + 3.0 - 10.0 * sin(PI * t)))
	return out


## Builds the walking route. Without the bridge, visitors stay on the west
## bank trail. With it, some cross to the east bank and leave on that side.
func build_route() -> void:
	var trail := _pts("trail")
	path = []
	crosses = GameState.has_bridge() and randf() < 0.65
	if crosses:
		var west: Array = trail.slice(0, VIEW_INDEX + 1)
		var spur: Array = _pts("trail_spur").slice(1)
		var br := bridge_points()
		var east: Array = _pts("trail_east")
		east.append(Vector2(World.W + 24.0, east[-1].y))
		path = west + spur + br + east.slice(1)
		view_idx = -1
		bridge_mid_idx = west.size() + spur.size() + 6
		if randf() < 0.5:
			path.reverse()
			bridge_mid_idx = path.size() - 1 - bridge_mid_idx
	else:
		path = trail
		view_idx = VIEW_INDEX
		if randf() < 0.5:
			path.reverse()
			view_idx = path.size() - 1 - VIEW_INDEX


func setup(w: World, variant: int, d: Node) -> void:
	world = w
	director = d
	species = "visitor"
	setup_sprite("visitor_%d" % variant, "walk")
	hit_radius = 10.0
	build_route()
	position = path[0]
	if path[0].x < 100:
		position.x = -20.0
	elif path[0].x > World.W:
		pass
	else:
		modulate.a = 0.0
		create_tween().tween_property(self, "modulate:a", 1.0, 2.0)
	_make_plan()
	set_state("walk")
	play("walk")


func _make_plan() -> void:
	plan = [{"type": "view"}]
	if profile == "family":
		return
	for b in world.items_with_poi("bench"):
		if randf() < 0.7:
			plan.append({"type": "bench", "node": b})
			break
	for f in world.items_with_poi("feeder"):
		if randf() < 0.6:
			plan.append({"type": "feeder", "node": f})
			break
	for d in world.items_with_poi("deck"):
		if randf() < 0.7:
			plan.append({"type": "deck", "node": d})
			break


func _process(delta: float) -> void:
	state_time += delta
	match state:
		"walk":
			if idx >= path.size():
				_finish()
				return
			if step_to(path[idx], SPEED, delta):
				_arrived_at_point()
		"goto":
			var n: Node2D = activity.get("node")
			if not is_instance_valid(n):
				_resume()
				return
			if step_to(activity["target"], SPEED, delta):
				_start_activity()
		"activity":
			_tick_activity(delta)
		"back":
			if step_to(path[clampi(idx, 0, path.size() - 1)], SPEED, delta):
				set_state("walk")
				play("walk")


func _arrived_at_point() -> void:
	# view point on the trail
	if plan.size() > 0 and plan[0]["type"] == "view" and (idx == view_idx or idx == bridge_mid_idx):
		activity = plan.pop_front()
		_start_activity()
		return
	# detours to structures once past the view point (only along the west trail)
	if plan.size() > 0 and plan[0]["type"] != "view" and position.x < 420.0:
		activity = plan.pop_front()
		var n: Node2D = activity["node"]
		if is_instance_valid(n):
			var off := Vector2(0, 2) if activity["type"] == "bench" else Vector2(-16 if n.position.x > position.x else 16, 4)
			activity["target"] = n.position + off
			set_state("goto")
			play("walk")
			return
	idx += 1


func _start_activity() -> void:
	set_state("activity")
	match activity["type"]:
		"view":
			face(1.0 if idx != bridge_mid_idx else (1.0 if randf() < 0.5 else -1.0))
			play("look" if randf() < 0.5 else "idle")
			wait = randf_range(4.0, 7.0)
		"bench":
			var n: Node2D = activity["node"]
			position = n.position + Vector2(0, 1)
			face(1.0 if n.position.x < 470 else -1.0)
			play("sit")
			wait = randf_range(8.0, 14.0)
		"feeder":
			face(activity["node"].position.x - position.x)
			play("feed")
			wait = 4.0
			director.call_bird_to(activity["node"])
		"deck":
			face(470.0 - position.x)
			play("photo")
			wait = 3.5
	activity["photos"] = 0


func _tick_activity(delta: float) -> void:
	match activity["type"]:
		"view", "deck":
			if state_time > 1.5 and int(activity["photos"]) == 0 and randf() < 0.6:
				_photo()
		"feeder":
			if not sprite.is_playing():
				play("feed")
	if state_time > wait:
		_end_activity()


func _photo() -> void:
	activity["photos"] = 1
	play("photo")
	var f := Sprite2D.new()
	f.texture = load("res://assets/sprites/effects/flash.png")
	f.position = position + Vector2(6 * facing, -36)
	world.fx_layer.add_child(f)
	var t := f.create_tween()
	t.tween_property(f, "modulate:a", 0.0, 0.5)
	t.tween_callback(f.queue_free)
	AudioManager.play("camera", 0.05, -10.0)
	var subject := ""
	for c in get_tree().get_nodes_in_group("creatures"):
		if c != self and c.species in ["deer", "fish", "sabia", "saira", "butterfly", "dragonfly"] \
				and c.position.distance_to(position) < 160.0:
			subject = c.species
			if subject == "deer":
				break
	director.reward(self, "photo", subject)


func _end_activity() -> void:
	match activity["type"]:
		"bench":
			director.reward(self, "bench", "")
		"feeder":
			director.reward(self, "feeder", "")
		"view":
			director.reward(self, "view", "")
	activity = {}
	_resume()


func _resume() -> void:
	set_state("back")
	play("walk")


func _finish() -> void:
	set_state("gone")
	if position.x > 100:
		var t := create_tween()
		t.tween_property(self, "modulate:a", 0.0, 1.5)
		t.tween_callback(depart)
	else:
		depart()


func on_tap() -> void:
	# a friendly wave: small reputation bonus, once in a while
	if randf() < 0.5:
		director.reward(self, "wave", "")
