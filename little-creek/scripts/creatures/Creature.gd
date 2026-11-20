class_name Creature
extends Node2D
## Base class for every living thing in the scene. Provides an animated
## sprite, simple steering helpers and tap handling. Subclasses implement a
## small state machine in _process.

signal departed(creature: Creature)

var world: World
var species: String = ""
var sprite: AnimatedSprite2D
var state: String = ""
var state_time: float = 0.0
var hit_radius: float = 6.0
var _leaving := false


func setup_sprite(sheet: String, anim: String = "") -> void:
	sprite = AnimatedSprite2D.new()
	sprite.sprite_frames = SpriteLib.frames(sheet)
	sprite.centered = false
	var meta: Dictionary = GameData.creatures[sheet]
	# anchor: bottom-center (feet / perch contact point)
	sprite.offset = Vector2(-floorf(float(meta["w"]) / 2.0), -float(meta["h"]))
	add_child(sprite)
	if anim != "":
		sprite.play(anim)
	add_to_group("creatures")


func set_state(s: String) -> void:
	state = s
	state_time = 0.0


func play(anim: String) -> void:
	if sprite.animation != anim or not sprite.is_playing():
		sprite.play(anim)


func face(dir_x: float) -> void:
	if absf(dir_x) > 0.01:
		sprite.flip_h = dir_x < 0.0


## Move toward target at speed; returns true when arrived.
func step_to(target: Vector2, speed: float, delta: float) -> bool:
	var d := target - position
	var dist := d.length()
	if dist <= speed * delta or dist < 0.5:
		position = target
		return true
	position += d / dist * speed * delta
	face(d.x)
	return false


func hit_test(p: Vector2) -> bool:
	var c := position + Vector2(0, -sprite.sprite_frames.get_frame_texture(sprite.animation, 0).get_height() / 2.0)
	return c.distance_to(p) <= hit_radius + 4.0


func on_tap() -> void:
	pass


func leave() -> void:
	_leaving = true


func depart() -> void:
	departed.emit(self)
	queue_free()


func is_offscreen(margin: float = 30.0) -> bool:
	return position.x < -margin or position.x > World.W + margin or position.y < -margin


## Off-screen entry/exit point on the left or right edge at a given height.
static func edge_point(left: bool, y: float) -> Vector2:
	return Vector2(-24.0 if left else World.W + 24.0, y)
