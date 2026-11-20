class_name Owl
extends Creature
## Corujinha-do-mato: arrives at dusk/night, perches on a big tree, turns its
## head, hoots now and then, leaves before dawn. Discreet by design.

var from := Vector2.ZERO
var target := Vector2.ZERO
var t := 0.0
var dur := 1.0
var stay := 0.0


func setup(w: World) -> void:
	world = w
	species = "owl"
	setup_sprite("owl", "fly")
	hit_radius = 7.0
	position = edge_point(randf() < 0.5, randf_range(20, 70))
	_fly_to(_pick_perch())


func _pick_perch() -> Vector2:
	var best: Array = []
	for n in world.items.values():
		if n.id in ["tree_big", "tree_small"]:
			var pp: Variant = n.perch_point()
			if pp != null:
				best.append(pp + Vector2(randf_range(-10, 10), 6))
	if best.is_empty():
		for p in GameData.scene.get("perches", []):
			best.append(Vector2(float(p["x"]), float(p["y"])))
	return best[randi() % best.size()]


func _fly_to(p: Vector2) -> void:
	from = position
	target = p
	t = 0.0
	dur = maxf(1.2, from.distance_to(p) / 55.0)
	set_state("fly")
	play("fly")
	face(p.x - from.x)


func _process(delta: float) -> void:
	state_time += delta
	match state:
		"fly":
			t += delta / dur
			var e := clampf(t, 0.0, 1.0)
			position = from.lerp(target, e * e * (3.0 - 2.0 * e)) - Vector2(0, sin(e * PI) * 18.0)
			if t >= 1.0:
				if _leaving:
					depart()
					return
				set_state("perch")
				stay = randf_range(25.0, 60.0)
				play("idle")
		"perch":
			if randf() < delta * 0.12:
				play("look")
				get_tree().create_timer(randf_range(1.5, 3.0)).timeout.connect(func() -> void:
					if is_instance_valid(self) and state == "perch":
						play("idle"))
			if randf() < delta * 0.05:
				AudioManager.play("owl", 0.05, -10.0)
			if state_time > stay or EcosystemRules.activity("owl") <= 0.05:
				leave()


func leave() -> void:
	if _leaving:
		return
	_leaving = true
	_fly_to(edge_point(randf() < 0.5, randf_range(10, 60)))


func on_tap() -> void:
	GameState.discover(species)
	play("look")
	AudioManager.play("owl", 0.05, -6.0)
