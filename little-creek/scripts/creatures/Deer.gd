class_name Deer
extends Creature
## Veado-catingueiro: comes out of the forest, walks to the creek, drinks,
## looks around and goes back. Startles if tapped.

const WALK_SPEED := 17.0
const RUN_SPEED := 58.0
var spot: Dictionary = {}
var exit_point := Vector2.ZERO
var drinks := 0
var sheet_name := "deer_m"
var wait := 0.0


func setup(w: World, s: Dictionary) -> void:
	world = w
	species = "deer"
	spot = s
	sheet_name = "deer_m" if randf() < 0.5 else "deer_f"
	setup_sprite(sheet_name, "walk")
	hit_radius = 18.0
	var from_left := float(s["face"]) > 0.0
	position = edge_point(from_left, float(s["y"]) - randf_range(0, 20))
	exit_point = edge_point(from_left, position.y + randf_range(-10, 10))
	set_state("walk_in")
	play("walk")


func _process(delta: float) -> void:
	state_time += delta
	match state:
		"walk_in":
			if step_to(Vector2(float(spot["x"]), float(spot["y"])), WALK_SPEED, delta):
				face(float(spot["face"]))
				set_state("look")
				wait = randf_range(1.5, 3.0)
				play("look")
		"look":
			if state_time > wait:
				set_state("lower")
				play("lower")
		"lower":
			if not sprite.is_playing():
				set_state("drink")
				wait = randf_range(5.0, 9.0)
				play("drink")
		"drink":
			if randf() < delta * 0.7:
				world.ripple(muzzle_point() + Vector2(0, 5))
			if state_time > wait:
				drinks += 1
				set_state("raise")
				play("raise")
		"raise":
			if not sprite.is_playing():
				set_state("idle")
				wait = randf_range(2.0, 4.0)
				play("idle")
		"idle":
			if not sprite.is_playing():
				play("idle")
			elif sprite.animation.begins_with("idle") and randf() < delta * 0.35:
				play("ears" if randf() < 0.5 else "tail")
			if state_time > wait:
				if drinks < 2 and randf() < 0.5:
					set_state("lower")
					play("lower")
				else:
					set_state("walk_out")
					play("walk")
		"walk_out", "flee":
			var sp := RUN_SPEED if state == "flee" else WALK_SPEED
			if step_to(exit_point, sp, delta):
				depart()
		"alert":
			if state_time > 0.9:
				set_state("flee")
				face(exit_point.x - position.x)
				play("run")


func on_tap() -> void:
	GameState.discover(species)
	if state in ["walk_out", "flee", "alert"]:
		return
	set_state("alert")
	play("alert")



## Muzzle position while drinking (from the sprite metadata).
func muzzle_point() -> Vector2:
	var m: Array = GameData.creatures[sheet_name].get("muzzle", [20.0, -9.0])
	return position + Vector2(float(m[0]) * facing, float(m[1]) + 1.0)
