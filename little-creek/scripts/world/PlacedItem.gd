class_name PlacedItem
extends Node2D
## A player-placed element (plant, rock, log, structure) living in the world.
## Vegetation sways in the wind; rocks and logs gain moss as vitality rises.

const SWAY_SHADER := preload("res://shaders/sway.gdshader")

var uid: int = 0
var id: String = ""
var variant: int = 0
var def: Dictionary = {}
var sprite: Sprite2D
var mat: ShaderMaterial
var half_width: float = 4.0
var height: float = 8.0


func setup(d: Dictionary, noise: Texture2D) -> void:
	uid = int(d["uid"])
	id = String(d["id"])
	variant = int(d.get("v", 0))
	def = GameData.items[id]
	position = Vector2(roundf(float(d["x"])), roundf(float(d["y"])))
	sprite = Sprite2D.new()
	var tex := SpriteLib.tex(GameData.item_sprite_path(id, variant))
	sprite.texture = tex
	sprite.centered = false
	sprite.offset = Vector2(-floorf(tex.get_width() / 2.0), -tex.get_height() + 2)
	half_width = tex.get_width() / 2.0
	height = tex.get_height()
	mat = ShaderMaterial.new()
	mat.shader = SWAY_SHADER
	mat.set_shader_parameter("strength", float(def.get("sway", 0.0)))
	mat.set_shader_parameter("speed", randf_range(1.0, 1.5))
	mat.set_shader_parameter("phase", position.x * 0.05)
	var moss := GameData.item_moss_path(id, variant)
	if moss != "":
		mat.set_shader_parameter("use_dissolve", true)
		mat.set_shader_parameter("tex_b", SpriteLib.tex(moss))
		mat.set_shader_parameter("noise_tex", noise)
	sprite.material = mat
	add_child(sprite)


func set_moss(amount: float) -> void:
	mat.set_shader_parameter("amount", amount)


func pop_in() -> void:
	sprite.scale = Vector2(1.25, 0.5)
	var t := create_tween()
	t.tween_property(sprite, "scale", Vector2(0.9, 1.15), 0.12).set_trans(Tween.TRANS_QUAD)
	t.tween_property(sprite, "scale", Vector2(1.0, 1.0), 0.18).set_trans(Tween.TRANS_BACK)


func rustle() -> void:
	if float(def.get("sway", 0.0)) <= 0.0:
		return
	var t := create_tween()
	t.tween_method(func(v: float) -> void: mat.set_shader_parameter("gust", v), 2.0, 0.0, 1.2)


func perch_point() -> Variant:
	if not def.has("perch"):
		return null
	var p: Array = def["perch"]
	return position + Vector2(p[0], p[1])


func hit_test(p: Vector2) -> bool:
	var r := Rect2(position + sprite.offset, sprite.texture.get_size())
	return r.has_point(p)


func footprint() -> float:
	return float(def.get("footprint", clampf(half_width * 0.75, 3.0, 22.0)))
