extends Node
## Audio: music, layered ambience (water, wind, forest) and pooled SFX.
## Volumes for Music and Effects are independent (buses "Music" and "SFX";
## "Ambience" is routed through SFX).

const MUSIC := "res://assets/audio/music/creek_theme"
const AMBIENCE := {
	"water": "res://assets/audio/ambience/water_loop",
	"wind": "res://assets/audio/ambience/wind_loop",
}
const SFX_DIR := "res://assets/audio/sfx/"
const POOL_SIZE := 10

var _music: AudioStreamPlayer
var _amb: Dictionary = {}
var _pool: Array[AudioStreamPlayer] = []
var _cache: Dictionary = {}
var _next := 0
var music_volume := 0.7
var sfx_volume := 0.85


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_music = AudioStreamPlayer.new()
	_music.bus = &"Music"
	add_child(_music)
	for k in AMBIENCE.keys():
		var p := AudioStreamPlayer.new()
		p.bus = &"Ambience"
		add_child(p)
		_amb[k] = p
	for i in POOL_SIZE:
		var p := AudioStreamPlayer.new()
		p.bus = &"SFX"
		add_child(p)
		_pool.append(p)


func _load(base: String) -> AudioStream:
	if _cache.has(base):
		return _cache[base]
	var s: AudioStream = null
	for ext in [".ogg", ".wav"]:
		if ResourceLoader.exists(base + ext):
			s = load(base + ext)
			break
	if s is AudioStreamOggVorbis:
		(s as AudioStreamOggVorbis).loop = base.ends_with("_loop") or base == MUSIC
	elif s is AudioStreamWAV and (base.ends_with("_loop") or base == MUSIC):
		var w := s as AudioStreamWAV
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_begin = 0
		w.loop_end = int(w.get_length() * w.mix_rate)
	_cache[base] = s
	return s


func start_ambience() -> void:
	var m := _load(MUSIC)
	if m and not _music.playing:
		_music.stream = m
		_music.volume_db = -6.0
		_music.play()
	for k in _amb.keys():
		var p: AudioStreamPlayer = _amb[k]
		var s := _load(AMBIENCE[k])
		if s and not p.playing:
			p.stream = s
			p.play()
	set_ambience_mix(0.0)


## Water gets louder as the creek recovers; wind is constant and soft.
func set_ambience_mix(health: float) -> void:
	if _amb.has("water"):
		_amb["water"].volume_db = lerpf(-14.0, -7.0, health)
	if _amb.has("wind"):
		_amb["wind"].volume_db = -15.0


## Play a one-shot effect by name (file in assets/audio/sfx/).
func play(name: String, pitch_jitter: float = 0.06, volume_db: float = 0.0, pan: float = 0.0) -> void:
	var s := _load(SFX_DIR + name)
	if s == null:
		return
	var p := _pool[_next]
	_next = (_next + 1) % POOL_SIZE
	p.stream = s
	p.pitch_scale = 1.0 + randf_range(-pitch_jitter, pitch_jitter)
	p.volume_db = volume_db
	p.play()


## Bird calls: several recorded-style variants, positioned softly.
func play_bird(kind: String = "sabia") -> void:
	var n := 3
	var name := "bird_%s_%d" % [kind, randi() % n]
	play(name, 0.08, -8.0)


func apply_settings(settings: Dictionary) -> void:
	set_music_volume(float(settings.get("music", music_volume)))
	set_sfx_volume(float(settings.get("sfx", sfx_volume)))


func set_music_volume(v: float) -> void:
	music_volume = clampf(v, 0.0, 1.0)
	var idx := AudioServer.get_bus_index("Music")
	AudioServer.set_bus_volume_db(idx, linear_to_db(maxf(music_volume, 0.0001)))
	AudioServer.set_bus_mute(idx, music_volume <= 0.001)
	SaveSystem.settings["music"] = music_volume


func set_sfx_volume(v: float) -> void:
	sfx_volume = clampf(v, 0.0, 1.0)
	var idx := AudioServer.get_bus_index("SFX")
	AudioServer.set_bus_volume_db(idx, linear_to_db(maxf(sfx_volume, 0.0001)))
	AudioServer.set_bus_mute(idx, sfx_volume <= 0.001)
	SaveSystem.settings["sfx"] = sfx_volume
