class_name Butterfly
extends Creature
## Flutters between flowers with a soft wandering motion and rests on them.

var target := Vector2.ZERO
var rest_time := 0.0
var wobble := randf() * TAU
var visits := 0


func setup(w: World) -> void:
	world = w
	species = "butterfly"
	var cols := ["orange", "blue", "yellow", "white"]
	setup_sprite("butterfly_" + cols[randi() % cols.size()], "fly")
	hit_radius = 5.0
	position = edge_point(randf() < 0.5, randf_range(200, 300))
	_next_flower()


func _next_flower() -> void:
	var fl := world.items_of("flowers")
	visits += 1
	if fl.is_empty() or visits > randi_range(5, 9):
		_leaving = true
		target = edge_point(randf() < 0.5, randf_range(150, 260))
	else:
		var f: PlacedItem = fl[randi() % fl.size()]
		target = f.position + Vector2(randf_range(-3, 3), -7)
	set_state("fly")
	play("fly")


func _process(delta: float) -> void:
	state_time += delta
	match state:
		"fly":
			wobble += delta * 3.0
			var d := target - position
			var dist := d.length()
			var dir := d / maxf(dist, 0.001)
			var perp := Vector2(-dir.y, dir.x)
			position += dir * 22.0 * delta + perp * sin(wobble * 2.3) * 10.0 * delta \
				+ Vector2(0, sin(wobble * 5.1) * 8.0 * delta)
			face(d.x)
			if dist < 2.0:
				if _leaving:
					depart()
					return
				position = target
				set_state("rest")
				rest_time = randf_range(2.5, 6.0)
				play("rest")
			elif _leaving and is_offscreen():
				depart()
		"rest":
			if state_time > rest_time:
				_next_flower()


func leave() -> void:
	if _leaving:
		return
	_leaving = true
	target = edge_point(randf() < 0.5, randf_range(150, 260))
	set_state("fly")
	play("fly")


func on_tap() -> void:
	GameState.discover(species)
	if state == "rest":
		_next_flower()
	wobble += 2.0
