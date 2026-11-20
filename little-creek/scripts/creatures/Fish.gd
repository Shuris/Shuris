class_name Fish
extends Creature
## Lambari swimming under the surface (clipped to the water and tinted).

const UNDERWATER := preload("res://shaders/underwater.gdshader")
var target := Vector2.ZERO
var speed := 8.0
var pause := 0.0


func setup(w: World) -> void:
	world = w
	species = "fish"
	setup_sprite("fish", "swim")
	sprite.offset = Vector2(-5, -2)
	hit_radius = 6.0
	var m := ShaderMaterial.new()
	m.shader = UNDERWATER
	m.set_shader_parameter("water_mask", world.water_mask_tex)
	m.set_shader_parameter("world_size", Vector2(World.W, World.H))
	sprite.material = m
	add_to_group("fish")
	position = _random_spot()
	_new_target()
	modulate.a = 0.0
	create_tween().tween_property(self, "modulate:a", 1.0, 2.0)


func _random_spot() -> Vector2:
	var rows: Array = GameData.scene.get("fish_rows", [])
	if rows.is_empty():
		return Vector2(440, 300)
	var r: Dictionary = rows[randi() % rows.size()]
	return Vector2(float(r["x"]) + randf_range(-1, 1) * float(r["hw"]), float(r["y"]))


func _new_target() -> void:
	for i in 8:
		var p := _random_spot()
		if p.distance_to(position) < 60.0 and world.is_water(p):
			target = p
			break
	speed = randf_range(5.0, 11.0)
	set_state("swim")
	play("swim")


func startle(from: Vector2) -> void:
	target = position + (position - from).normalized() * 18.0
	if not world.is_water(target):
		target = _random_spot()
	speed = 40.0
	set_state("swim")
	play("dart")


func _process(delta: float) -> void:
	state_time += delta
	match state:
		"swim":
			if step_to(target, speed, delta):
				set_state("idle")
				pause = randf_range(0.8, 3.0)
				play("swim")
				sprite.speed_scale = 0.4
		"idle":
			if state_time > pause:
				sprite.speed_scale = 1.0
				if randf() < 0.08:
					world.ripple(position + Vector2(0, 2))
				_new_target()
	if _leaving and state == "idle":
		var t := create_tween()
		t.tween_property(self, "modulate:a", 0.0, 1.5)
		t.tween_callback(depart)
		_leaving = false
		set_state("gone")


func on_tap() -> void:
	GameState.discover(species)
	startle(position + Vector2(randf_range(-3, 3), -3))
