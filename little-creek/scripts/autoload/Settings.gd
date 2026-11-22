extends Node
## Graphics/display settings (PC and mobile). Every option is applied for
## real and stored in SaveSystem.settings:
##   resolution (window mode), fullscreen, vsync, effects quality
##   (low/medium/high), particle density, plus the three audio volumes
##   (applied by AudioManager).

signal changed

const RESOLUTIONS := [Vector2i(1280, 720), Vector2i(1366, 768), Vector2i(1600, 900), Vector2i(1920, 1080),
	Vector2i(2560, 1440), Vector2i(3840, 2160)]
const QUALITY_NAMES := ["Baixa", "Média", "Alta"]

var resolution := Vector2i(1920, 1080)
var fullscreen := false
var vsync := true
var quality := 2          # 0 low, 1 medium, 2 high
var particles := 1.0      # 0.25 .. 1.5
var world: Node = null    # set by Main


func is_desktop() -> bool:
	return not OS.has_feature("mobile") and not OS.has_feature("web")


func load_from(s: Dictionary) -> void:
	var r: Array = s.get("resolution", [1920, 1080])
	resolution = Vector2i(int(r[0]), int(r[1]))
	fullscreen = bool(s.get("fullscreen", false))
	vsync = bool(s.get("vsync", true))
	quality = clampi(int(s.get("quality", 2 if is_desktop() else 1)), 0, 2)
	particles = clampf(float(s.get("particles", 1.0)), 0.25, 1.5)


func store() -> void:
	var s: Dictionary = SaveSystem.settings
	s["resolution"] = [resolution.x, resolution.y]
	s["fullscreen"] = fullscreen
	s["vsync"] = vsync
	s["quality"] = quality
	s["particles"] = particles
	SaveSystem.request_save()


func apply_display() -> void:
	if not is_desktop() or DisplayServer.get_name() == "headless":
		return
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED if vsync else DisplayServer.VSYNC_DISABLED)
	if fullscreen:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	else:
		if DisplayServer.window_get_mode() != DisplayServer.WINDOW_MODE_WINDOWED:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
		var screen := DisplayServer.screen_get_usable_rect(DisplayServer.window_get_current_screen())
		var size := Vector2i(mini(resolution.x, screen.size.x), mini(resolution.y, screen.size.y))
		DisplayServer.window_set_size(size)
		DisplayServer.window_set_position(screen.position + (screen.size - size) / 2)


## Effects budget for the world (particles, light rays, fog, steam...).
func apply_effects() -> void:
	if world == null:
		return
	var q: float = [0.45, 0.75, 1.0][quality]
	var k: float = q * particles
	world.weather_fx.particle_density = k
	world.motes.amount = maxi(6, int(46 * k))
	world.pollen.amount = maxi(6, int(50 * k))
	world.steam.amount = maxi(8, int(60 * k))
	world.fireflies.budget = k
	world.leaf_system.budget = k
	# low quality: no volumetric rays and no drifting mist band
	world.rays_mat.get_meta("node").visible = quality > 0
	world.fog_mat.get_meta("node").visible = quality > 0
	world.water_mat.set_shader_parameter("rain_rings", quality > 0)


func set_and_apply() -> void:
	store()
	apply_display()
	apply_effects()
	changed.emit()


func toggle_fullscreen() -> void:
	fullscreen = not fullscreen
	set_and_apply()
