class_name WeatherFX
extends Node
## Visual side of the weather: rain streaks (two depth layers), ground
## splashes, water/puddle parameters, rainbow after the rain, lightning.
## Particle counts come from data/config.json (effects).

var world: World
var snow_layers: Array = []   # [far, mid, near] CPUParticles2D
var rain_far: CPUParticles2D
var rain_near: CPUParticles2D
var puddles: Sprite2D
var puddle_mat: ShaderMaterial
var rainbow: Sprite2D
var flash := 0.0               # lightning flash 0..1 (read by Atmosphere)
var rainbow_amount := 0.0
var _rainbow_target := 0.0
var _rainbow_left := 0.0
var _splash_acc := 0.0
var _thunder_t := 20.0
var _splash_frames: SpriteFrames
var _ground_pts: Array = []
var cfg: Dictionary = {}
var particle_density := 1.0   # graphics setting (0.25 .. 1.5)


func setup(w: World) -> void:
	world = w
	cfg = GameData.config.get("effects", {})
	_splash_frames = SpriteLib.strip(World.FX + "rain_splash.png", 7, 14.0, false)
	Weather.rain_ended.connect(_on_rain_ended)
	# ground points for splashes (sampled once from the placement zones)
	for i in 400:
		var p := Vector2(randf_range(90, 710), randf_range(196, 350))
		if world.zones.get_pixel(int(p.x), int(p.y)).r > 0.5:
			_ground_pts.append(p)


func make_rain_layers(parent: Node) -> void:
	rain_far = _rain_layer(World.FX + "rain_drop_far.png", Vector2(-0.18, 1), 170.0, 1.6)
	rain_near = _rain_layer(World.FX + "rain_drop.png", Vector2(-0.25, 1), 290.0, 1.15)
	parent.add_child(rain_far)
	parent.add_child(rain_near)


func _rain_layer(tex: String, dir: Vector2, speed: float, life: float) -> CPUParticles2D:
	var p := CPUParticles2D.new()
	p.texture = load(tex)
	p.amount = 60
	p.lifetime = life
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	p.position = Vector2(440, -10)
	p.emission_rect_extents = Vector2(460, 4)
	p.direction = dir
	p.spread = 2.0
	p.gravity = Vector2.ZERO
	p.initial_velocity_min = speed * 0.9
	p.initial_velocity_max = speed * 1.1
	p.emitting = false
	p.preprocess = life
	p.local_coords = false
	return p


func make_snow_layers(parent: Node) -> void:
	# depth: far = tiny & slow, near = bigger & faster; each drifts sideways
	# (tangential acceleration) so flakes never fall in uniform lines
	var specs := [["flake_s", 14.0, 9.0, 0.45], ["flake_m", 24.0, 7.0, 0.35], ["flake_l", 38.0, 5.5, 0.2]]
	for sp in specs:
		var p := CPUParticles2D.new()
		p.texture = load(World.FX + String(sp[0]) + ".png")
		p.amount = 40
		p.lifetime = float(sp[2]) * 4.0
		p.preprocess = p.lifetime
		p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
		p.position = Vector2(440, -8)
		p.emission_rect_extents = Vector2(520, 4)
		p.direction = Vector2(0, 1)
		p.spread = 18.0
		p.gravity = Vector2(0, 2.0)
		p.initial_velocity_min = float(sp[1]) * 0.7
		p.initial_velocity_max = float(sp[1]) * 1.25
		p.tangential_accel_min = -6.0
		p.tangential_accel_max = 6.0
		p.damping_min = 0.0
		p.damping_max = 1.0
		p.scale_amount_min = 1.0
		p.scale_amount_max = 1.0
		p.local_coords = false
		p.emitting = false
		p.set_meta("share", float(sp[3]))
		p.set_meta("speed", float(sp[1]))
		parent.add_child(p)
		snow_layers.append(p)


func _update_snow(_delta: float) -> void:
	var sn := Weather.snow
	var on := sn > 0.03
	var lo := float(cfg.get("snow_flakes_light", 120))
	var hi := float(cfg.get("snow_flakes_blizzard", 420))
	var total := lerpf(lo, hi, clampf((sn - 0.35) / 0.65, 0.0, 1.0)) * particle_density
	var wind := Weather.wind
	for p in snow_layers:
		p.emitting = on
		var target := maxi(8, int(total * float(p.get_meta("share"))))
		if on and absi(p.amount - target) > 12:
			p.amount = target
		var spd: float = p.get_meta("speed")
		# wind pushes flakes sideways; blizzards are almost horizontal
		var side := -(0.25 + wind * 1.8 * (0.6 + sn))
		p.direction = Vector2(side, 1.0).normalized()
		p.initial_velocity_min = spd * (0.7 + sn * 0.8)
		p.initial_velocity_max = spd * (1.25 + sn * 1.2)
		p.position.x = 440.0 + wind * 160.0 * sn   # emit upwind so the screen stays covered


func make_puddles(parent: Node) -> void:
	puddles = Sprite2D.new()
	puddles.texture = load(World.ENV + "puddles.png")
	puddles.centered = false
	puddle_mat = ShaderMaterial.new()
	puddle_mat.shader = preload("res://shaders/puddle.gdshader")
	puddles.material = puddle_mat
	parent.add_child(puddles)


func make_rainbow(parent: Node) -> void:
	rainbow = Sprite2D.new()
	rainbow.texture = load(World.FX + "rainbow.png")
	rainbow.centered = false
	rainbow.position = Vector2(250, 40)
	rainbow.modulate.a = 0.0
	parent.add_child(rainbow)


func _on_rain_ended(_heavy: bool) -> void:
	var h := Clock.hour()
	if h > 7.0 and h < 17.5 and randf() < float(GameData.config["weather"].get("rainbow_chance", 0.4)):
		show_rainbow(1.2)


func show_rainbow(game_hours: float) -> void:
	_rainbow_target = 1.0
	_rainbow_left = game_hours
	NatureLog.record_event("rainbow", "Um arco-íris apareceu depois da chuva.", true)


func _process(delta: float) -> void:
	_update_snow(delta)
	var r := Weather.rain
	var heavy := Weather.state == "heavy"
	# rain streaks
	var on := r > 0.03
	rain_far.emitting = on
	rain_near.emitting = on
	var n_light := int(cfg.get("rain_drops_light", 90))
	var n_heavy := int(cfg.get("rain_drops_heavy", 220))
	var target := int(lerpf(n_light, n_heavy, clampf((r - 0.45) / 0.55, 0.0, 1.0)) * particle_density)
	if on and absi(rain_near.amount - target / 2) > 10:
		rain_near.amount = maxi(10, target / 2)
		rain_far.amount = maxi(10, target / 2)
	var wind := Weather.wind
	rain_near.direction = Vector2(-0.15 - wind * 0.35, 1.0)
	rain_far.direction = Vector2(-0.1 - wind * 0.25, 1.0)
	# splashes on the ground
	if on and not _ground_pts.is_empty():
		var rate := lerpf(float(cfg.get("rain_ripples_per_s_light", 6.0)), float(cfg.get("rain_ripples_per_s_heavy", 16.0)), r)
		_splash_acc += delta * rate
		while _splash_acc >= 1.0:
			_splash_acc -= 1.0
			var s := AnimatedSprite2D.new()
			s.sprite_frames = _splash_frames
			s.position = _ground_pts[randi() % _ground_pts.size()] + Vector2(randf_range(-6, 6), randf_range(-3, 3))
			s.modulate.a = 0.8
			world.fx_layer.add_child(s)
			s.play()
			s.animation_finished.connect(s.queue_free)
	# water + puddles
	world.water_mat.set_shader_parameter("rain", r)
	puddle_mat.set_shader_parameter("wet", Weather.wetness if bool(cfg.get("puddles", true)) else 0.0)
	puddle_mat.set_shader_parameter("rain", r)
	var L := Clock.lighting()
	var sky := Color(0.72, 0.82, 0.80) * (L["tint"] as Color)
	puddle_mat.set_shader_parameter("sky_col", Vector3(sky.r, sky.g, sky.b))
	# lightning during storms
	flash = maxf(0.0, flash - delta * 3.0)
	if heavy and r > 0.8:
		_thunder_t -= delta
		if _thunder_t <= 0.0:
			_thunder_t = randf_range(18.0, 45.0)
			flash = 1.0
			get_tree().create_timer(randf_range(0.6, 2.5)).timeout.connect(func() -> void:
				AudioManager.play("thunder", 0.1, -4.0))
	# rainbow
	if _rainbow_left > 0.0:
		_rainbow_left -= delta * GameState.time_scale * Clock.hours_per_real_second()
		if _rainbow_left <= 0.0 or Weather.rain > 0.1:
			_rainbow_target = 0.0
	rainbow_amount = move_toward(rainbow_amount, _rainbow_target, delta * 0.15)
	rainbow.modulate.a = rainbow_amount
