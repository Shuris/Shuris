extends Node
## World clock: hour of day, four periods (dawn, day, dusk, night), days and
## seasons (30 days each by default, configurable in data/config.json).
## Visual systems read the smooth curves exposed here (lighting keyframes,
## seasonal foliage state) instead of reacting only to discrete changes.

signal period_changed(period: String)
signal day_changed(day: int)
signal season_changed(season: int)

const SEASONS := ["spring", "summer", "autumn", "winter"]
const SEASON_NAMES := ["Primavera", "Verão", "Outono", "Inverno"]
const PERIOD_NAMES := {"dawn": "Amanhecer", "day": "Dia", "dusk": "Entardecer", "night": "Noite"}

var total_hours: float = 7.0   # game hours since the world began
var cfg: Dictionary = {}
var _period := ""
var _day := -1
var _season := -1


func _ready() -> void:
	cfg = GameData.config.get("time", {})
	total_hours = float(cfg.get("start_hour", 7.0))
	_sync_signals(true)


func hours_per_real_second() -> float:
	return 24.0 / (float(cfg.get("day_real_minutes", 24.0)) * 60.0)


func days_per_season() -> int:
	return int(cfg.get("days_per_season", 30))


func _process(delta: float) -> void:
	total_hours += delta * GameState.time_scale * hours_per_real_second()
	_sync_signals(false)


func _sync_signals(silent: bool) -> void:
	var p := period()
	if p != _period:
		_period = p
		if not silent:
			period_changed.emit(p)
	var d := day()
	if d != _day:
		_day = d
		if not silent:
			day_changed.emit(d)
	var s := season()
	if s != _season:
		_season = s
		if not silent:
			season_changed.emit(s)


# ------------------------------------------------------------------ queries
func hour() -> float:
	return fposmod(total_hours, 24.0)


func day() -> int:
	return int(floorf(total_hours / 24.0))


func season() -> int:
	return int(day() / days_per_season()) % 4


func season_key() -> String:
	return SEASONS[season()]


func day_in_season() -> float:
	## fractional day inside the current season (0 .. days_per_season)
	return fposmod(total_hours / 24.0, float(days_per_season()))


func year() -> int:
	return int(day() / (days_per_season() * 4)) + 1


func period() -> String:
	var h := hour()
	var pr: Dictionary = cfg.get("periods", {})
	for k in ["dawn", "day", "dusk"]:
		var r: Array = pr.get(k, [0, 0])
		if h >= float(r[0]) and h < float(r[1]):
			return k
	return "night"


func is_night() -> bool:
	return period() == "night"


func date_string() -> String:
	return "Dia %d · %s · Ano %d" % [int(day_in_season()) + 1, SEASON_NAMES[season()], year()]


func time_string() -> String:
	var h := hour()
	return "%02d:%02d" % [int(h), int(fmod(h, 1.0) * 60.0)]


## Date of an absolute game-hour stamp (for the biodiversity journal).
func stamp_string(hours: float) -> String:
	var d := int(floorf(hours / 24.0))
	var s := int(d / days_per_season()) % 4
	var y := int(d / (days_per_season() * 4)) + 1
	return "Dia %d da %s, ano %d" % [d % days_per_season() + 1, SEASON_NAMES[s], y]


# ------------------------------------------------------------------ smooth curves
static func _ramp(x: float, a: float, b: float) -> float:
	return clampf((x - a) / maxf(b - a, 0.0001), 0.0, 1.0)


## Seasonal vegetation state, changing gradually over many days.
## Returns {autumn, bare, winter, bloom, lush} in 0..1.
func foliage_state() -> Dictionary:
	var n := float(days_per_season())
	var d := day_in_season() / n  # 0..1 inside the season
	var s := season()
	var autumn := 0.0
	var bare := 0.0
	var winter := 0.0
	var bloom := 0.0
	var lush := 0.0
	match s:
		0:  # spring: winter fades, blossoms rise
			winter = 1.0 - _ramp(d, 0.0, 0.3)
			bare = 0.55 * (1.0 - _ramp(d, 0.0, 0.35))
			bloom = _ramp(d, 0.1, 0.4) * (1.0 - 0.6 * _ramp(d, 0.7, 1.0))
			lush = _ramp(d, 0.3, 1.0) * 0.5
		1:  # summer: full and lush
			bloom = 0.4 * (1.0 - _ramp(d, 0.0, 0.3))
			lush = 0.5 + 0.5 * _ramp(d, 0.0, 0.2)
		2:  # autumn: colours turn over ~half the season, then leaves drop
			autumn = _ramp(d, 0.03, 0.55)
			bare = 0.55 * _ramp(d, 0.6, 1.0)
			lush = 0.6 * (1.0 - _ramp(d, 0.0, 0.3))
		3:  # winter: cold, sparse, dull
			autumn = 1.0 - _ramp(d, 0.0, 0.6)
			bare = 0.55
			winter = _ramp(d, 0.0, 0.2)
	return {"autumn": autumn, "bare": bare, "winter": winter, "bloom": bloom, "lush": lush}


## Lighting keyframes by hour: tint (multiply), shadow colour (lift), sat,
## contrast, ray intensity, ray colour.
const KEYS := [
	# hour, tint, shadow, sat, bright, rays, ray_col
	[0.0, Color(0.42, 0.50, 0.78), Color(0.03, 0.05, 0.12), 0.45, 0.62, 0.32, Color(0.55, 0.68, 1.0)],
	[4.5, Color(0.45, 0.52, 0.80), Color(0.04, 0.05, 0.13), 0.48, 0.64, 0.25, Color(0.55, 0.68, 1.0)],
	[5.6, Color(0.82, 0.66, 0.78), Color(0.08, 0.05, 0.12), 0.75, 0.82, 0.35, Color(1.0, 0.72, 0.62)],
	[6.6, Color(1.08, 0.86, 0.72), Color(0.06, 0.04, 0.06), 0.95, 0.96, 0.9, Color(1.0, 0.82, 0.6)],
	[8.5, Color(1.0, 0.98, 0.94), Color(0.0, 0.0, 0.0), 1.0, 1.0, 1.0, Color(1.0, 0.94, 0.72)],
	[15.5, Color(1.02, 1.0, 0.94), Color(0.0, 0.0, 0.0), 1.02, 1.0, 1.0, Color(1.0, 0.92, 0.7)],
	[17.4, Color(1.12, 0.88, 0.64), Color(0.05, 0.02, 0.06), 1.05, 0.98, 1.15, Color(1.0, 0.72, 0.42)],
	[18.6, Color(0.98, 0.62, 0.56), Color(0.10, 0.04, 0.12), 0.9, 0.84, 0.7, Color(1.0, 0.55, 0.42)],
	[19.6, Color(0.58, 0.52, 0.78), Color(0.06, 0.05, 0.14), 0.6, 0.7, 0.1, Color(0.8, 0.6, 0.9)],
	[21.0, Color(0.42, 0.50, 0.78), Color(0.03, 0.05, 0.12), 0.45, 0.62, 0.32, Color(0.55, 0.68, 1.0)],
	[24.0, Color(0.42, 0.50, 0.78), Color(0.03, 0.05, 0.12), 0.45, 0.62, 0.32, Color(0.55, 0.68, 1.0)],
]


func lighting(h: float = -1.0) -> Dictionary:
	if h < 0.0:
		h = hour()
	var i := 0
	while i < KEYS.size() - 2 and h >= float(KEYS[i + 1][0]):
		i += 1
	var a: Array = KEYS[i]
	var b: Array = KEYS[i + 1]
	var t := clampf((h - float(a[0])) / maxf(float(b[0]) - float(a[0]), 0.001), 0.0, 1.0)
	t = t * t * (3.0 - 2.0 * t)
	return {
		"tint": (a[1] as Color).lerp(b[1], t),
		"shadow": (a[2] as Color).lerp(b[2], t),
		"sat": lerpf(a[3], b[3], t),
		"bright": lerpf(a[4], b[4], t),
		"rays": lerpf(a[5], b[5], t),
		"ray_col": (a[6] as Color).lerp(b[6], t),
		"night": clampf(1.0 - lerpf(a[4], b[4], t), 0.0, 0.38) / 0.38,
	}


# ------------------------------------------------------------------ persistence
func to_dict() -> Dictionary:
	return {"total_hours": total_hours}


func from_dict(d: Dictionary) -> void:
	total_hours = float(d.get("total_hours", cfg.get("start_hour", 7.0)))
	_sync_signals(true)


## Offline time advances the clock, but never by more than a configured
## number of game hours, so seasons never fly by while the player is away.
func advance_offline(real_seconds: float) -> float:
	var h := minf(real_seconds * hours_per_real_second(), float(cfg.get("offline_max_game_hours", 18.0)))
	total_hours += h
	_sync_signals(true)
	return h


func set_hour(h: float) -> void:
	total_hours = floorf(total_hours / 24.0) * 24.0 + h
	_sync_signals(false)


func set_season(s: int, day_in: float = 12.0) -> void:
	var cur_h := hour()
	var year_days := days_per_season() * 4
	var base := floorf(total_hours / 24.0 / year_days) * year_days
	total_hours = (base + s * days_per_season() + day_in) * 24.0 + cur_h
	_sync_signals(false)
