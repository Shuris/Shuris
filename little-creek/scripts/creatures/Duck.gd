class_name Duck
extends Creature
## Marreca-pé-vermelho: swims slowly in the calm stretches, dabbles (head
## under water), sometimes followed by a line of ducklings.

var target := Vector2.ZERO
var ducklings: Array = []
var trail: Array = []


func setup(w: World, with_young: int = 0) -> void:
	world = w
	species = "duck"
	setup_sprite("duck", "swim")
	sprite.offset.y += 3  # sits in the water
	hit_radius = 7.0
	position = world.random_water_point(250.0)
	modulate.a = 0.0
	create_tween().tween_property(self, "modulate:a", 1.0, 2.0)
	for i in with_young:
		var d := Creature.new()
		d.world = world
		d.species = ""
		world.entities.add_child(d)
		d.setup_sprite("duckling", "swim")
		d.sprite.offset.y += 2
		d.position = position
		ducklings.append(d)
	_new_target()


func _new_target() -> void:
	for i in 10:
		var p := world.random_water_point(250.0)
		if p.distance_to(position) < 70.0 and _calm(p):
			target = p
			break
	set_state("swim")
	play("swim")


func _calm(p: Vector2) -> bool:
	for f in GameData.scene.get("falls", []):
		if p.y > float(f["lip"]) - 6 and p.y < float(f["base"]) + 12:
			return false
	return true


func _process(delta: float) -> void:
	state_time += delta
	match state:
		"swim":
			if step_to(target, 5.0, delta):
				set_state("rest")
				if randf() < 0.5:
					play("dabble")
					world.ripple(position + Vector2(0, 2))
		"rest":
			if state_time > randf_range(2.0, 5.0):
				_new_target()
	trail.push_front(position)
	if trail.size() > 80:
		trail.pop_back()
	for i in ducklings.size():
		var d: Creature = ducklings[i]
		var k := mini((i + 1) * 14, trail.size() - 1)
		if is_instance_valid(d):
			var p: Vector2 = trail[k]
			d.face(p.x - d.position.x + 0.001 * facing)
			d.position = p
			d.modulate.a = modulate.a


func leave() -> void:
	if _leaving:
		return
	_leaving = true
	var tw := create_tween()
	tw.tween_property(self, "modulate:a", 0.0, 2.0)
	tw.tween_callback(depart)


func depart() -> void:
	for d in ducklings:
		if is_instance_valid(d):
			d.queue_free()
	super.depart()


func on_tap() -> void:
	GameState.discover(species)
	AudioManager.play("duck", 0.08, -8.0)
	_new_target()
