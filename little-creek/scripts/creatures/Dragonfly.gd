class_name Dragonfly
extends Creature
## Darts quickly over the water, hovers, sometimes touches the surface.

var target := Vector2.ZERO
var hover := 0.0
var darts := 0


func setup(w: World) -> void:
	world = w
	species = "dragonfly"
	setup_sprite("dragonfly", "fly")
	hit_radius = 5.0
	position = edge_point(randf() < 0.5, randf_range(200, 260))
	_new_target()


func _new_target() -> void:
	darts += 1
	if darts > randi_range(10, 18):
		_leaving = true
		target = edge_point(randf() < 0.5, randf_range(150, 240))
	else:
		target = world.random_water_point(205.0) + Vector2(0, -randf_range(5, 14))
	set_state("dart")


func _process(delta: float) -> void:
	state_time += delta
	match state:
		"dart":
			var d := target - position
			var sp := clampf(d.length() * 4.0, 25.0, 140.0)
			if step_to(target, sp, delta):
				if _leaving:
					depart()
					return
				set_state("hover")
				hover = randf_range(0.6, 2.2)
		"hover":
			position.y += sin(state_time * 20.0) * 0.15
			if state_time > hover:
				if randf() < 0.25:
					world.ripple(position + Vector2(0, 8))
				_new_target()


func leave() -> void:
	if _leaving:
		return
	_leaving = true
	target = edge_point(randf() < 0.5, randf_range(150, 240))
	set_state("dart")


func on_tap() -> void:
	GameState.discover(species)
	_new_target()
