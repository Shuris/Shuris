class_name Fireflies
extends Node
## Night fireflies: each one is a tiny body in the world plus a soft glow in
## the additive light layer. They drift around vegetation with a smooth,
## irregular path and blink with their own rhythm. Count depends on night,
## season, vegetation and rain (config effects.fireflies_max).

var world: World
var flies: Array = []   # [{body, glow, anchor, phase, speed, blink}]
var glow_tex: Texture2D
var body_tex: Texture2D
var _anchors: Array = []
var budget := 1.0   # graphics setting
var _anchor_t := 0.0
const SEASON_K := [0.7, 1.0, 0.45, 0.0]


func setup(w: World) -> void:
	world = w
	glow_tex = load(World.FX + "glow.png")
	body_tex = load(World.FX + "firefly.png")


func target_count() -> int:
	var L := Clock.lighting()
	var night := clampf((float(L["night"]) - 0.35) / 0.5, 0.0, 1.0)
	var veg := clampf(GameState.lushness() * 1.2, 0.15, 1.0)
	var mx := float(GameData.config.get("effects", {}).get("fireflies_max", 26))
	return int(mx * night * SEASON_K[Clock.season()] * veg * (1.0 - Weather.rain) * (1.0 - Weather.snow) * budget)


func _refresh_anchors() -> void:
	_anchors = []
	for it in world.items.values():
		if it.def.get("category", "") in ["plants", "trees"] and it.id != "aquatic":
			_anchors.append(it.position + Vector2(0, -6))
	for i in 6:  # meadow and forest edge
		_anchors.append(Vector2(randf_range(120, 680), randf_range(220, 330)))


func _spawn() -> void:
	if _anchors.is_empty():
		_refresh_anchors()
	var a: Vector2 = _anchors[randi() % _anchors.size()]
	var body := Sprite2D.new()
	body.texture = body_tex
	world.flyers.add_child(body)
	var glow := Sprite2D.new()
	glow.texture = glow_tex
	world.lights_root.add_child(glow)
	var f := {"body": body, "glow": glow, "anchor": a + Vector2(randf_range(-20, 20), randf_range(-24, -4)),
		"phase": randf() * 100.0, "speed": randf_range(0.25, 0.6), "blink": randf_range(2.2, 4.5), "life": 0.0,
		"dying": false}
	flies.append(f)


func _process(delta: float) -> void:
	if world == null or world.lights_root == null:
		return
	_anchor_t -= delta
	if _anchor_t <= 0.0:
		_anchor_t = 20.0
		_refresh_anchors()
	var target := target_count()
	if flies.size() < target and randf() < delta * 3.0:
		_spawn()
	var alive := 0
	for f in flies:
		if not f["dying"]:
			alive += 1
	if alive > target:
		for f in flies:
			if not f["dying"]:
				f["dying"] = true
				break
	var t := Time.get_ticks_msec() / 1000.0
	for i in range(flies.size() - 1, -1, -1):
		var f: Dictionary = flies[i]
		f["life"] = float(f["life"]) + delta
		var ph := float(f["phase"]) + t * float(f["speed"])
		# smooth, irregular wandering (sum of sines) around the anchor
		var off := Vector2(sin(ph * 1.3) * 14.0 + sin(ph * 2.9 + 1.0) * 6.0,
			sin(ph * 1.7 + 2.0) * 7.0 + cos(ph * 3.3) * 3.0)
		var pos: Vector2 = (f["anchor"] as Vector2) + off
		var b: Sprite2D = f["body"]
		var g: Sprite2D = f["glow"]
		b.position = pos.round()
		g.position = pos.round()
		# blink: slow glow-up, short peak, dark pause
		var cyc := fmod(t + float(f["phase"]), float(f["blink"])) / float(f["blink"])
		var lum := clampf(sin(clampf(cyc / 0.72, 0.0, 1.0) * PI) * 1.25, 0.0, 1.0)
		lum = floorf(lum * 4.0) / 4.0   # stepped, pixel-art friendly
		var fade := clampf(float(f["life"]) / 2.0, 0.0, 1.0)
		if f["dying"]:
			f["fade_out"] = float(f.get("fade_out", 1.0)) - delta * 0.5
			fade = minf(fade, float(f["fade_out"]))
			if fade <= 0.0:
				b.queue_free()
				g.queue_free()
				flies.remove_at(i)
				continue
		g.modulate = Color(0.85 * lum * fade, 1.0 * lum * fade, 0.45 * lum * fade, 1.0)
		b.modulate.a = fade
		b.visible = lum > 0.2
