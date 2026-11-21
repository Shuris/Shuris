class_name Atmosphere
extends Node
## Keeps the look of the world in sync with time of day, weather and season:
## colour grading, sun/moon rays, morning mist, dust motes, water glints.
## Only shader parameters are touched each frame (cheap on mobile).

var main: Node
var world: World
var _local_accum := 10.0


func _process(_delta: float) -> void:
	if world == null or not world._initialized:
		return
	var L := Clock.lighting()
	var fs := Clock.foliage_state()
	var r := Weather.rain
	var h := Clock.hour()
	var g: ShaderMaterial = main.grade_mat
	# season light: golden autumn, warm summer, cold diffuse winter
	var tint: Color = L["tint"]
	var sk := Clock.season()
	if sk == 2:
		tint = tint * Color(1.0 + 0.06 * float(fs["autumn"]), 1.0 + 0.01 * float(fs["autumn"]), 1.0 - 0.08 * float(fs["autumn"]))
	elif sk == 1:
		tint = tint * Color(1.03, 1.01, 0.96)
	elif sk == 3:
		tint = tint * Color(0.97, 0.99, 1.05)
	g.set_shader_parameter("tint", _v3(tint))
	g.set_shader_parameter("shadow_lift", _v3(L["shadow"]))
	g.set_shader_parameter("saturation", float(L["sat"]) * (1.0 + 0.08 * float(fs["lush"]) + 0.06 * float(fs["bloom"])))
	g.set_shader_parameter("brightness", float(L["bright"]) * (1.04 if Clock.season() == 1 else 1.0) * (1.0 + world.weather_fx.flash * 0.9))
	g.set_shader_parameter("night", float(L["night"]))
	g.set_shader_parameter("rain", r)
	g.set_shader_parameter("cold", float(fs["winter"]) * 0.7)
	var sn := Weather.snow
	g.set_shader_parameter("vignette", 0.2 + 0.55 * float(L["night"]) + 0.3 * r + 0.2 * sn)
	g.set_shader_parameter("haze", clampf((sn - 0.4) / 0.6, 0.0, 1.0) * (1.0 - float(L["night"]) * 0.5))
	g.set_shader_parameter("haze_col", _v3(Color(0.80, 0.85, 0.91) * (L["tint"] as Color)))
	# rays: sunbeams by day, faint moonbeams by night, hidden by rain clouds
	var season_k := 0.75 if Clock.season() == 3 else (1.1 if Clock.season() == 1 else 1.0)
	world.rays_mat.set_shader_parameter("intensity", float(L["rays"]) * (1.0 - 0.92 * r) * (1.0 - 0.9 * Weather.snow) * season_k)
	world.rays_mat.set_shader_parameter("ray_col", _v3(L["ray_col"]))
	# morning mist peaks around dawn; rain thickens the air
	var mist := exp(-pow((h - 6.3) / 1.4, 2.0))
	world.fog_mat.set_shader_parameter("density", 0.45 + 1.0 * mist + 0.7 * r + 0.25 * float(fs["winter"]) + 0.9 * Weather.snow)
	var fog_col := Color(0.82, 0.88, 0.80).lerp(Color(0.98, 0.86, 0.80), mist * 0.6)
	world.fog_mat.set_shader_parameter("fog_col", _v3(fog_col))
	world.motes.emitting = float(L["rays"]) > 0.5 and r < 0.15 and Weather.snow < 0.1 and not Clock.is_night()
	# seasons (global shader uniforms shared by all vegetation shaders)
	for k in ["autumn", "bare", "winter", "bloom", "lush", "young"]:
		RenderingServer.global_shader_parameter_set("season_" + k, float(fs[k]))
	RenderingServer.global_shader_parameter_set("snow_cover", Weather.snow_cover)
	world.snow_mat.set_shader_parameter("cover", Weather.snow_cover)
	RenderingServer.global_shader_parameter_set("world_wind", Weather.wind)
	_local_accum += _delta
	if _local_accum >= 0.5:
		_local_accum = 0.0
		var mats: Array = [world.fgb_mat, world.fgt_mat]
		for n in world.items.values():
			mats.append(n.mat)
		for m in mats:
			for k in ["autumn", "bare", "winter", "bloom", "lush", "young"]:
				m.set_shader_parameter("season_" + k, float(fs[k]))
			m.set_shader_parameter("snow_cover", Weather.snow_cover)
			m.set_shader_parameter("world_wind", Weather.wind)
			m.set_shader_parameter("season_noise", world.noise_tex)
	var frost_time := 1.0 if (h < 8.5 or h > 19.0) else 0.25
	world.season_mats["litter"].set_shader_parameter("amount", clampf(float(fs["autumn"]) * 1.1, 0.0, 1.0) * (0.6 if Clock.season() == 3 else 1.0))
	world.season_mats["frost"].set_shader_parameter("amount", float(fs["winter"]) * frost_time * (1.0 - r))
	world.season_mats["flowers"].set_shader_parameter("amount", float(fs["bloom"]) * clampf(GameState.lushness() * 1.3, 0.2, 1.0))
	world.leaves.emitting = false  # replaced by FloatingLeaves (interacts with water)
	var winter_k := float(fs["winter"])
	var nightness := float(L["night"])
	world.water_mat.set_shader_parameter("ice", winter_k * (0.55 + 0.35 * nightness + 0.2 * Weather.snow_cover))
	world.water_mat.set_shader_parameter("cold", winter_k)
	# steam over the creek on cold mornings
	var h2 := Clock.hour()
	world.steam.emitting = winter_k > 0.4 and h2 > 5.0 and h2 < 10.0 and Weather.snow < 0.5
	var glint := float(L["rays"]) * (1.0 - r)
	world.water_mat.set_shader_parameter("glint", glint)
	world.water_mat.set_shader_parameter("glint_col", _v3((L["ray_col"] as Color).lerp(Color.WHITE, 0.4)))


static func _v3(c: Color) -> Vector3:
	return Vector3(c.r, c.g, c.b)
