class_name Bird
extends Creature
## Songbird: flies in, perches on canopy/trees/rocks/feeders, looks around,
## pecks, sings and eventually flies to another perch or leaves.

var kind := "sabia"
var target := Vector2.ZERO
var from := Vector2.ZERO
var flight_t := 0.0
var flight_len := 1.0
var perch_time := 0.0
var visits := 0
static var reserved: Dictionary = {}


func setup(w: World, k: String) -> void:
	world = w
	kind = k
	species = k
	setup_sprite("bird_" + k, "fly")
	hit_radius = 6.0
	var left := randf() < 0.5
	position = edge_point(left, randf_range(30, 120))
	_choose_perch_and_fly()


func _choose_perch_and_fly() -> void:
	var perches := world.perch_points()
	perches.shuffle()
	var chosen: Variant = null
	for p in perches:
		var key := str(Vector2i(p))
		if not reserved.has(key) and (p as Vector2).distance_to(position) > 24.0:
			chosen = p
			break
	if chosen == null or visits >= randi_range(3, 6):
		_fly_away()
		return
	_release()
	reserved[str(Vector2i(chosen))] = true
	_fly_to(chosen)


func _fly_to(p: Vector2) -> void:
	from = position
	target = p
	flight_t = 0.0
	flight_len = maxf(0.6, from.distance_to(target) / 70.0)
	set_state("fly")
	play("fly")
	face(target.x - from.x)


func _fly_away() -> void:
	_release()
	_leaving = true
	var left := randf() < 0.5
	_fly_to(Vector2(-30.0 if left else World.W + 30.0, randf_range(10, 90)))


func _release() -> void:
	reserved.erase(str(Vector2i(target)))


func _process(delta: float) -> void:
	state_time += delta
	match state:
		"fly":
			flight_t += delta / flight_len
			var t := clampf(flight_t, 0.0, 1.0)
			var e := t * t * (3.0 - 2.0 * t)
			var arc := sin(t * PI) * minf(40.0, from.distance_to(target) * 0.25)
			position = from.lerp(target, e) - Vector2(0, arc)
			position.y += sin(state_time * 9.0) * 0.6
			if t > 0.85 and not _leaving:
				play("glide")
			if t >= 1.0:
				position = target
				if _leaving:
					depart()
					return
				visits += 1
				set_state("perch")
				perch_time = randf_range(4.0, 10.0)
				play("idle")
		"perch":
			if state_time > perch_time:
				_choose_perch_and_fly()
			elif randf() < delta * 0.25:
				play("peck")
			elif randf() < delta * 0.18:
				sing()
			elif not sprite.is_playing():
				play("idle")
			if randf() < delta * 0.3:
				face(randf() - 0.5)


func sing() -> void:
	play("sing")
	AudioManager.play_bird(kind)
	var n := Sprite2D.new()
	n.texture = load("res://assets/sprites/effects/note.png")
	n.position = position + Vector2(4 if not sprite.flip_h else -6, -12)
	world.fx_layer.add_child(n)
	var t := n.create_tween()
	t.set_parallel(true)
	t.tween_property(n, "position", n.position + Vector2(randf_range(-4, 4), -12), 1.4)
	t.tween_property(n, "modulate:a", 0.0, 1.4)
	t.chain().tween_callback(n.queue_free)


## Dismissed by the director: finish gracefully by flying off-screen.
func leave() -> void:
	if _leaving:
		return
	if state == "perch":
		_fly_away()
	else:
		visits = 99  # next decision will be to fly away


func on_tap() -> void:
	GameState.discover(species)
	AudioManager.play_bird(kind)
	if state == "perch":
		_choose_perch_and_fly()
