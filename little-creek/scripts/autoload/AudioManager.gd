extends Node
## Audio: lo-fi music that follows the time of day (and season), dynamic
## ambience layers driven by clock/weather, scheduled one-shots (birds by
## day, owls and crickets at night, thunder in storms) and pooled SFX.
## Three independent volumes: Music, Ambience and Effects (buses "Music",
## "Ambience", "SFX").

const MUSIC_DIR := "res://assets/audio/music/"
const AMB_DIR := "res://assets/audio/ambience/"
const SFX_DIR := "res://assets/audio/sfx/"
const POOL_SIZE := 10
const LAYERS := ["water_loop", "wind_loop", "birds_loop", "insects_loop", "crickets_loop", "rain_light_loop", "rain_heavy_loop"]
## Music per period; seasons can override (winter days use the softer track).
const MUSIC_BY_PERIOD := {"dawn": "lofi_morning", "day": "lofi_day", "dusk": "lofi_dusk", "night": "lofi_night"}
const MUSIC_SEASON_OVERRIDE := {"winter": {"day": "lofi_morning"}}
const XFADE := 6.0

var _music_a: AudioStreamPlayer
var _music_b: AudioStreamPlayer
var _music_active: AudioStreamPlayer
var _current_track := ""
var _layers: Dictionary = {}
var _pool: Array[AudioStreamPlayer] = []
var _cache: Dictionary = {}
var _next := 0
var _started := false
var _oneshot_t := 5.0
var music_volume := 0.7
var amb_volume := 0.8
var sfx_volume := 0.85
var water_health := 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_music_a = _player(&"Music")
	_music_b = _player(&"Music")
	_music_active = _music_a
	for k in LAYERS:
		_layers[k] = _player(&"Ambience")
	for i in POOL_SIZE:
		_pool.append(_player(&"SFX"))


func _player(bus: StringName) -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.bus = bus
	add_child(p)
	return p


func _load(base: String, loop: bool) -> AudioStream:
	if _cache.has(base):
		return _cache[base]
	var s: AudioStream = null
	for ext in [".ogg", ".wav"]:
		if ResourceLoader.exists(base + ext):
			s = load(base + ext)
			break
	if s is AudioStreamOggVorbis:
		(s as AudioStreamOggVorbis).loop = loop
	_cache[base] = s
	return s


func start_ambience() -> void:
	_started = true
	for k in LAYERS:
		var p: AudioStreamPlayer = _layers[k]
		var s := _load(AMB_DIR + k, true)
		if s:
			p.stream = s
			p.volume_db = -60.0
			p.play(randf() * 5.0)
	_update_music(true)


func wanted_track() -> String:
	var per := Clock.period()
	var ov: Dictionary = MUSIC_SEASON_OVERRIDE.get(Clock.season_key(), {})
	return String(ov.get(per, MUSIC_BY_PERIOD[per]))


func _update_music(instant: bool = false) -> void:
	var t := wanted_track()
	if t == _current_track:
		return
	var s := _load(MUSIC_DIR + t, true)
	if s == null:
		return
	_current_track = t
	var old := _music_active
	var nw := _music_b if old == _music_a else _music_a
	nw.stream = s
	nw.volume_db = -40.0 if not instant else -4.0
	nw.play()
	_music_active = nw
	if instant:
		old.stop()
		return
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(nw, "volume_db", -4.0, XFADE)
	tw.tween_property(old, "volume_db", -50.0, XFADE)
	tw.chain().tween_callback(old.stop)


## Target loudness (dB) of each ambience layer from clock + weather.
func layer_targets() -> Dictionary:
	var per := Clock.period()
	var r := Weather.rain
	var heavy := Weather.state == "heavy"
	var winter := Clock.season() == 3
	var quiet := 0.0 if not winter else -5.0
	var t := {}
	t["water_loop"] = lerpf(-15.0, -8.0, water_health) + (3.0 if heavy else 0.0)
	t["wind_loop"] = lerpf(-22.0, -9.0, Weather.wind)
	var birds_on := (per == "dawn" or per == "day") and r < 0.5 and GameState.eligible_animals.has("sabia")
	t["birds_loop"] = ((-10.0 if per == "dawn" else -17.0) + quiet) if birds_on else -60.0
	t["insects_loop"] = (-17.0 + quiet * 2.0) if per == "day" and r < 0.3 and Clock.season() != 3 else -60.0
	t["crickets_loop"] = (-13.0 + quiet * 2.0) if (per == "night" or per == "dusk") and r < 0.5 else -60.0
	t["rain_light_loop"] = lerpf(-60.0, -9.0, clampf(r / 0.45, 0.0, 1.0)) if not heavy else -16.0
	t["rain_heavy_loop"] = lerpf(-60.0, -6.0, clampf((r - 0.45) / 0.55, 0.0, 1.0))
	return t


func _process(delta: float) -> void:
	if not _started:
		return
	_update_music()
	var tg := layer_targets()
	for k in tg.keys():
		var p: AudioStreamPlayer = _layers[k]
		p.volume_db = move_toward(p.volume_db, float(tg[k]), delta * 8.0)
	_oneshot_t -= delta
	if _oneshot_t <= 0.0:
		_oneshot_t = randf_range(6.0, 16.0)
		_random_oneshot()


## Occasional sounds so the soundscape never loops audibly.
func _random_oneshot() -> void:
	var per := Clock.period()
	if Weather.state == "heavy":
		return
	if per == "night":
		if GameState.eligible_animals.has("owl") and randf() < 0.35:
			play("owl", 0.06, -14.0)
		elif GameState.eligible_animals.has("fox") and randf() < 0.08:
			play("fox", 0.08, -18.0)
	elif per != "night" and Weather.state == "clear" and GameState.eligible_animals.has("sabia"):
		if randf() < (0.7 if per == "dawn" else 0.4):
			play_bird("sabia" if randf() < 0.7 or not GameState.eligible_animals.has("saira") else "saira")
	if Weather.wind > 0.55 and randf() < 0.4:
		play("rustle", 0.15, -14.0)


## Kept for compatibility: the water layer gets louder as the creek recovers.
func set_ambience_mix(health: float) -> void:
	water_health = health


## Play a one-shot effect by name (file in assets/audio/sfx/).
func play(name: String, pitch_jitter: float = 0.06, volume_db: float = 0.0, _pan: float = 0.0) -> void:
	var s := _load(SFX_DIR + name, false)
	if s == null:
		return
	var p := _pool[_next]
	_next = (_next + 1) % POOL_SIZE
	p.stream = s
	p.pitch_scale = 1.0 + randf_range(-pitch_jitter, pitch_jitter)
	p.volume_db = volume_db
	p.play()


func play_bird(kind: String = "sabia") -> void:
	play("bird_%s_%d" % [kind, randi() % 3], 0.08, -9.0)


func apply_settings(settings: Dictionary) -> void:
	set_music_volume(float(settings.get("music", music_volume)))
	set_amb_volume(float(settings.get("amb", amb_volume)))
	set_sfx_volume(float(settings.get("sfx", sfx_volume)))


func _set_bus(name: String, v: float) -> void:
	var idx := AudioServer.get_bus_index(name)
	if idx < 0:
		return
	AudioServer.set_bus_volume_db(idx, linear_to_db(maxf(v, 0.0001)))
	AudioServer.set_bus_mute(idx, v <= 0.001)


func set_music_volume(v: float) -> void:
	music_volume = clampf(v, 0.0, 1.0)
	_set_bus("Music", music_volume)
	SaveSystem.settings["music"] = music_volume


func set_amb_volume(v: float) -> void:
	amb_volume = clampf(v, 0.0, 1.0)
	_set_bus("Ambience", amb_volume)
	SaveSystem.settings["amb"] = amb_volume


func set_sfx_volume(v: float) -> void:
	sfx_volume = clampf(v, 0.0, 1.0)
	_set_bus("SFX", sfx_volume)
	SaveSystem.settings["sfx"] = sfx_volume
