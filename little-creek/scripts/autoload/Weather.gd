extends Node
## Weather: clear / light rain / heavy rain and, in winter, light snow /
## snow / blizzard, driven by season odds and cooldowns (data/config.json).
## Smooth values for visuals and audio: rain and snow (0..1 intensity),
## wetness (puddles), snow_cover (snow lying on things: builds up while it
## snows, melts slowly on sunny winter days and quickly in spring), wind.

signal weather_changed(state: String)
signal rain_ended(was_heavy: bool)

var state := "clear"           # clear | light | heavy | snow_light | snow | blizzard
const SNOW_STATES := ["snow_light", "snow", "blizzard"]
var snow := 0.0                # smoothed snowfall intensity
var remaining_hours := 0.0     # time left in the current rain event
var cooldown_hours := 6.0      # dry time before rain can start again
var rain := 0.0                # smoothed intensity
var wetness := 0.0
var snow_cover := 0.0          # 0..1 snow lying on the ground and on things
var wind := 0.25
var cfg: Dictionary = {}
var _check := 0.0
var _gust_t := 0.0


func _ready() -> void:
	cfg = GameData.config.get("weather", {})


func target_rain() -> float:
	return float({"light": 0.45, "heavy": 1.0}.get(state, 0.0))


func target_snow() -> float:
	return float({"snow_light": 0.35, "snow": 0.65, "blizzard": 1.0}.get(state, 0.0))


func is_snowing() -> bool:
	return state in SNOW_STATES


func _update_snow_cover(dh: float) -> void:
	var sc: Dictionary = cfg.get("snow", {})
	if snow > 0.05:
		var rate := float(sc.get("accum_per_hour", 0.3)) * snow
		snow_cover = minf(1.0, snow_cover + dh * rate)
	else:
		var melt := 0.0
		match Clock.season():
			3:   # winter: only melts a little on sunny afternoons
				var h := Clock.hour()
				melt = float(sc.get("melt_winter_sun", 0.012)) if h > 10.0 and h < 16.0 else 0.0
			0:
				melt = float(sc.get("melt_spring", 0.12))
			_:
				melt = float(sc.get("melt_other", 0.35))
		melt += rain * 0.15   # rain washes snow away
		snow_cover = maxf(0.0, snow_cover - dh * melt)


func _process(delta: float) -> void:
	var dh := delta * GameState.time_scale * Clock.hours_per_real_second()
	var fade := float(cfg.get("fade_hours", 0.35))
	rain = move_toward(rain, target_rain(), dh / fade)
	snow = move_toward(snow, target_snow(), dh / fade)
	_update_snow_cover(dh)
	if rain > 0.05:
		wetness = minf(1.0, wetness + dh * rain * 0.9)
	else:
		wetness = maxf(0.0, wetness - dh / float(cfg.get("dry_hours", 3.0)))
	# wind: base breeze, stronger with rain, slow gusts
	_gust_t += delta
	var gust := 0.5 + 0.5 * sin(_gust_t * 0.37) * sin(_gust_t * 0.13 + 1.3)
	wind = clampf(0.18 + 0.25 * gust + rain * 0.55 + snow * snow * 0.7, 0.0, 1.0)
	if state != "clear":
		remaining_hours -= dh
		if remaining_hours <= 0.0:
			_end_rain()
	else:
		cooldown_hours -= dh
		_check += dh
		if _check >= float(cfg.get("check_every_hours", 2.0)):
			_check = 0.0
			if cooldown_hours <= 0.0:
				_roll()


func _roll() -> void:
	var sk := Clock.season_key()
	if sk == "winter":
		var sc: Dictionary = cfg.get("snow", {})
		if randf() < float(sc.get("chance", 0.3)):
			var r := randf()
			var kind := "blizzard" if r < float(sc.get("blizzard_ratio", 0.15)) else ("snow" if r < 0.6 else "snow_light")
			start_snow(kind)
		return
	if randf() < float(cfg.get("rain_chance", {}).get(sk, 0.15)):
		var heavy := randf() < float(cfg.get("heavy_ratio", {}).get(sk, 0.3))
		start_rain("heavy" if heavy else "light")


func start_rain(kind: String, hours: float = -1.0) -> void:
	var r: Array = cfg.get("heavy_hours" if kind == "heavy" else "light_hours", [1.5, 3.0])
	state = kind
	remaining_hours = hours if hours > 0.0 else randf_range(float(r[0]), float(r[1]))
	weather_changed.emit(state)


func start_snow(kind: String, hours: float = -1.0) -> void:
	var sc: Dictionary = cfg.get("snow", {})
	var r: Array = sc.get(kind + "_hours", [2.0, 5.0])
	state = kind
	remaining_hours = hours if hours > 0.0 else randf_range(float(r[0]), float(r[1]))
	weather_changed.emit(state)


func _end_rain() -> void:
	var was_heavy := state == "heavy"
	var was_snow := is_snowing()
	state = "clear"
	var c: Array = cfg.get("snow", {}).get("cooldown_hours", [5.0, 12.0]) if was_snow else cfg.get("cooldown_hours", [8.0, 16.0])
	cooldown_hours = randf_range(float(c[0]), float(c[1]))
	weather_changed.emit(state)
	if not was_snow:
		rain_ended.emit(was_heavy)


## Dev / tests: force a weather state immediately (no fade).
func force(kind: String, hours: float = 3.0) -> void:
	if kind == "clear":
		state = "clear"
		rain = 0.0
		snow = 0.0
		remaining_hours = 0.0
		weather_changed.emit(state)
		return
	if kind in SNOW_STATES:
		start_snow(kind, hours)
		snow = target_snow()
		return
	start_rain(kind, hours)
	rain = target_rain()
	wetness = 0.8 if kind == "heavy" else 0.5


func to_dict() -> Dictionary:
	return {"state": state, "remaining": remaining_hours, "cooldown": cooldown_hours, "wetness": wetness,
		"snow_cover": snow_cover}


func from_dict(d: Dictionary) -> void:
	state = String(d.get("state", "clear"))
	if not state in ["clear", "light", "heavy"] + SNOW_STATES:
		state = "clear"
	snow_cover = float(d.get("snow_cover", 0.0))
	snow = target_snow()
	remaining_hours = float(d.get("remaining", 0.0))
	cooldown_hours = float(d.get("cooldown", 6.0))
	wetness = float(d.get("wetness", 0.0))
	rain = target_rain()
