extends Node
## Weather: clear / light rain / heavy rain events driven by season odds and
## cooldowns (data/config.json). Exposes smooth values for visuals and audio:
## rain (0..1 intensity), wetness (ground/puddles, dries slowly), wind.

signal weather_changed(state: String)
signal rain_ended(was_heavy: bool)

var state := "clear"           # clear | light | heavy
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
	return {"clear": 0.0, "light": 0.45, "heavy": 1.0}[state]


func _process(delta: float) -> void:
	var dh := delta * GameState.time_scale * Clock.hours_per_real_second()
	var fade := float(cfg.get("fade_hours", 0.35))
	rain = move_toward(rain, target_rain(), dh / fade)
	if rain > 0.05:
		wetness = minf(1.0, wetness + dh * rain * 0.9)
	else:
		wetness = maxf(0.0, wetness - dh / float(cfg.get("dry_hours", 3.0)))
	# wind: base breeze, stronger with rain, slow gusts
	_gust_t += delta
	var gust := 0.5 + 0.5 * sin(_gust_t * 0.37) * sin(_gust_t * 0.13 + 1.3)
	wind = clampf(0.18 + 0.25 * gust + rain * 0.55, 0.0, 1.0)
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
	if randf() < float(cfg.get("rain_chance", {}).get(sk, 0.15)):
		var heavy := randf() < float(cfg.get("heavy_ratio", {}).get(sk, 0.3))
		start_rain("heavy" if heavy else "light")


func start_rain(kind: String, hours: float = -1.0) -> void:
	var r: Array = cfg.get("heavy_hours" if kind == "heavy" else "light_hours", [1.5, 3.0])
	state = kind
	remaining_hours = hours if hours > 0.0 else randf_range(float(r[0]), float(r[1]))
	weather_changed.emit(state)


func _end_rain() -> void:
	var was_heavy := state == "heavy"
	state = "clear"
	var c: Array = cfg.get("cooldown_hours", [8.0, 16.0])
	cooldown_hours = randf_range(float(c[0]), float(c[1]))
	weather_changed.emit(state)
	rain_ended.emit(was_heavy)


## Dev / tests: force a weather state immediately (no fade).
func force(kind: String, hours: float = 3.0) -> void:
	if kind == "clear":
		state = "clear"
		rain = 0.0
		remaining_hours = 0.0
		weather_changed.emit(state)
		return
	start_rain(kind, hours)
	rain = target_rain()
	wetness = 0.8 if kind == "heavy" else 0.5


func to_dict() -> Dictionary:
	return {"state": state, "remaining": remaining_hours, "cooldown": cooldown_hours, "wetness": wetness}


func from_dict(d: Dictionary) -> void:
	state = String(d.get("state", "clear"))
	if not state in ["clear", "light", "heavy"]:
		state = "clear"
	remaining_hours = float(d.get("remaining", 0.0))
	cooldown_hours = float(d.get("cooldown", 6.0))
	wetness = float(d.get("wetness", 0.0))
	rain = target_rain()
