class_name Wanderer
extends Creature
## Fox / maned wolf: comes out of the forest on one bank, wanders a little,
## sniffs the ground, stops to look around and goes back. Never crosses the
## creek and flees from visitors.

var sheet := "fox"
var waypoints: Array = []
var wi := 0
var speed := 16.0
var pause := 0.0


func setup(w: World, kind: String) -> void:
	world = w
	species = kind
	sheet = "fox" if kind == "fox" else "maned_wolf"
	speed = 16.0 if kind == "fox" else 19.0
	setup_sprite(sheet, "walk")
	hit_radius = 12.0 if kind == "fox" else 18.0
	var left := randf() < 0.6
	var y := randf_range(250, 320)
	position = edge_point(left, y)
	waypoints = []
	for i in randi_range(2, 3):
		var p := Vector2.ZERO
		for k in 20:
			p = Vector2(randf_range(110, 360) if left else randf_range(580, 700), randf_range(232, 330))
			if world.animal_spot_ok(p, 6.0):
				break
		waypoints.append(p)
	waypoints.append(edge_point(left, y + randf_range(-20, 20)))
	set_state("walk")


func _process(delta: float) -> void:
	state_time += delta
	match state:
		"walk":
			play("trot" if _leaving else "walk")
			if step_to(waypoints[wi], speed * (2.2 if _leaving else 1.0), delta):
				wi += 1
				if wi >= waypoints.size():
					depart()
					return
				if wi < waypoints.size() - 1 or randf() < 0.5:
					set_state("pause")
					pause = randf_range(2.5, 6.0)
					play("sniff" if randf() < 0.6 else "look")
		"pause":
			if state_time > pause:
				set_state("walk")
			elif get_tree().get_nodes_in_group("visitors").size() > 0:
				leave()


func leave() -> void:
	if _leaving:
		return
	_leaving = true
	wi = waypoints.size() - 1
	set_state("walk")


func on_tap() -> void:
	GameState.discover(species)
	play("look")
	get_tree().create_timer(0.8).timeout.connect(func() -> void:
		if is_instance_valid(self):
			leave())
