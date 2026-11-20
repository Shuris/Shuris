class_name FloatingLeaves
extends Node
## Leaves that detach from the canopy, fall swaying in the wind, then:
##   on water  -> float, carried by the flow map (which already swirls
##                around rocks), until they leave the screen or get stuck
##                against a bank where they gather for a while;
##   on ground -> rest a while and fade.
## More leaves in autumn (config effects.leaves_max).

var world: World
var leaves: Array = []   # [{node, state, vel, t, rest}]
var _sources: Array = []
var _src_t := 0.0
var _flow: Image
var frames_green: SpriteFrames
var frames_autumn: SpriteFrames
const SEASON_RATE := [0.12, 0.08, 0.9, 0.15]


func setup(w: World) -> void:
	world = w
	_flow = (load("res://assets/sprites/water/water_flow.png") as Texture2D).get_image()
	frames_green = SpriteLib.strip(World.FX + "leaf_fall.png", 4, 6.0, true)
	frames_autumn = SpriteLib.strip(World.FX + "leaf_fall_dry.png", 4, 6.0, true)


func _refresh_sources() -> void:
	_sources = []
	for it in world.items.values():
		if it.id in ["tree_small", "tree_big"]:
			var pp: Variant = it.perch_point()
			if pp != null:
				_sources.append(Rect2((pp as Vector2) + Vector2(-34, 10), Vector2(68, 50)))
	# frame trees, mid trees and the top foliage strip
	_sources.append(Rect2(Vector2(40, 0), Vector2(200, 60)))
	_sources.append(Rect2(Vector2(560, 0), Vector2(220, 60)))
	_sources.append(Rect2(Vector2(330, 0), Vector2(200, 30)))


func burst(at: Vector2, n: int = 5) -> void:
	for i in n:
		_spawn(at + Vector2(randf_range(-16, 16), randf_range(-6, 6)))


func _spawn(p: Vector2 = Vector2.INF) -> void:
	var mx := int(GameData.config.get("effects", {}).get("leaves_max", 26))
	if leaves.size() >= mx:
		return
	if p == Vector2.INF:
		if _sources.is_empty():
			_refresh_sources()
		var r: Rect2 = _sources[randi() % _sources.size()]
		p = r.position + Vector2(randf() * r.size.x, randf() * r.size.y)
	var s := AnimatedSprite2D.new()
	var aut: bool = float(Clock.foliage_state()["autumn"]) > 0.3
	s.sprite_frames = frames_autumn if aut or randf() < 0.15 else frames_green
	s.centered = true
	s.play()
	s.frame = randi() % 4
	s.position = p
	world.flyers.add_child(s)
	leaves.append({"node": s, "state": "fall", "vel": Vector2(randf_range(-4, 4), randf_range(8, 14)),
		"t": randf() * 10.0, "rest": 0.0, "ground_y": randf_range(200, 352)})


func _flow_at(p: Vector2) -> Vector3:
	var x := clampi(int(p.x), 0, World.W - 1)
	var y := clampi(int(p.y), 0, World.H - 1)
	var c := _flow.get_pixel(x, y)
	return Vector3(c.r * 2.0 - 1.0, c.g * 2.0 - 1.0, c.b if c.a > 0.5 else -1.0)


func _process(delta: float) -> void:
	if world == null:
		return
	_src_t -= delta
	if _src_t <= 0.0:
		_src_t = 15.0
		_refresh_sources()
	var rate: float = SEASON_RATE[Clock.season()] * (0.6 + Weather.wind * 1.4)
	if Clock.season() == 2:
		rate *= 0.6 + float(Clock.foliage_state()["autumn"])
	if randf() < delta * rate * 2.0:
		_spawn()
	var wind := Weather.wind
	var fspeed: float = world.water_mat.get_shader_parameter("flow_speed")
	for i in range(leaves.size() - 1, -1, -1):
		var L: Dictionary = leaves[i]
		var n: AnimatedSprite2D = L["node"]
		L["t"] = float(L["t"]) + delta
		var t := float(L["t"])
		match L["state"]:
			"fall":
				var sway := sin(t * 2.2) * 10.0
				n.position += Vector2(sway - wind * 14.0, 0) * delta + Vector2(0, (L["vel"] as Vector2).y) * delta
				if n.position.y >= float(L["ground_y"]):
					var f := _flow_at(n.position)
					if f.z >= 0.0:
						L["state"] = "float"
						world.ripple(n.position, true)
						n.speed_scale = 0.15
					else:
						L["state"] = "ground"
						n.pause()
						L["rest"] = randf_range(20.0, 45.0)
				elif n.position.x < -10 or n.position.x > World.W + 10:
					_remove(i)
			"float":
				var f := _flow_at(n.position)
				if f.z < 0.0:
					# pushed onto the bank: gather there for a while
					L["state"] = "bank"
					n.pause()
					L["rest"] = randf_range(40.0, 90.0)
					continue
				var v := Vector2(f.x, f.y) * (5.0 + 20.0 * f.z) * fspeed
				v += Vector2(sin(t * 1.3) * 1.5, 0)
				var nxt := n.position + v * delta
				var fn := _flow_at(nxt)
				if fn.z < 0.0:
					# slide along the bank instead of entering it
					nxt = n.position + Vector2(0, v.y) * delta
				n.position = nxt
				n.rotation = sin(t * 0.8) * 0.0
				if n.position.y > World.H + 6:
					_remove(i)
			"ground", "bank":
				L["rest"] = float(L["rest"]) - delta
				if float(L["rest"]) < 3.0:
					n.modulate.a = maxf(0.0, float(L["rest"]) / 3.0)
				if float(L["rest"]) <= 0.0:
					_remove(i)


func _remove(i: int) -> void:
	(leaves[i]["node"] as Node).queue_free()
	leaves.remove_at(i)
