extends Node
## Efeitos sonoros (gerados por tools/gen_audio.py com as receitas da versão Electron),
## murmúrio do público, chuva e torcida. Volume e mudo vêm das opções do save.

const POOL := 10
var players: Array[AudioStreamPlayer] = []
var streams := {}
var crowd: AudioStreamPlayer
var rain: AudioStreamPlayer
var volume := 0.7
var muted := false
var played := 0
var last := ""
var _next := 0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	if AudioServer.get_bus_index("Sfx") < 0:
		AudioServer.add_bus()
		AudioServer.set_bus_name(AudioServer.bus_count - 1, "Sfx")
	for i in POOL:
		var p := AudioStreamPlayer.new()
		p.bus = "Sfx"
		add_child(p)
		players.append(p)
	crowd = _loop("loop_crowd")
	rain = _loop("loop_rain")
	apply()


func _loop(name: String) -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.bus = "Sfx"
	var s: AudioStreamWAV = _stream(name)
	if s:
		s = s.duplicate()
		s.loop_mode = AudioStreamWAV.LOOP_FORWARD
		s.loop_end = s.data.size() / 2
	p.stream = s
	p.volume_db = -80
	add_child(p)
	return p


func _stream(name: String) -> AudioStream:
	if not streams.has(name):
		var path := "res://assets/audio/%s.wav" % name
		streams[name] = load(path) if ResourceLoader.exists(path) else null
	return streams[name]


func set_volume(v: float, m: bool) -> void:
	volume = clampf(v, 0, 1)
	muted = m
	apply()


func apply() -> void:
	var idx := AudioServer.get_bus_index("Sfx")
	AudioServer.set_bus_mute(idx, muted or volume <= 0.001)
	AudioServer.set_bus_volume_db(idx, linear_to_db(maxf(0.001, volume * 0.8 / 0.7)))


func play(name: String, intensity := 1.0) -> void:
	if muted:
		return
	var s := _stream("sfx_" + name)
	if s == null:
		return
	played += 1
	last = name
	var p := players[_next]
	_next = (_next + 1) % POOL
	p.stream = s
	p.volume_db = linear_to_db(clampf(intensity, 0.3, 1.5))
	p.pitch_scale = randf_range(0.96, 1.04) if name in ["hit", "block", "step", "whoosh", "dodge", "train"] else 1.0
	p.play()


func cheer(intensity := 1.0) -> void:
	play("cheer", intensity)


func start_crowd() -> void:
	if not crowd.playing:
		crowd.play()
	create_tween().tween_property(crowd, "volume_db", 0.0, 1.5)


func stop_crowd() -> void:
	if crowd.playing:
		var tw := create_tween()
		tw.tween_property(crowd, "volume_db", -80.0, 1.0)
		tw.tween_callback(crowd.stop)


## Chuva contínua (0 = desligada).
func set_rain(intensity: float) -> void:
	if intensity <= 0.02:
		if rain.playing:
			var tw := create_tween()
			tw.tween_property(rain, "volume_db", -80.0, 1.0)
			tw.tween_callback(rain.stop)
		return
	if not rain.playing:
		rain.volume_db = -80
		rain.play()
	create_tween().tween_property(rain, "volume_db", linear_to_db(clampf(intensity, 0.05, 1.0)), 1.0)
