extends Node
## Música de fundo: lira, flauta, metais e tambores em escalas mediterrâneas (faixas
## geradas por tools/gen_audio.py a partir dos sequenciadores da versão Electron).
## Troca com fade; preferência (ligada e volume) guardada neste computador.

const PREFS := "user://music.cfg"
var current := ""
var wanted := ""
var enabled := true
var volume := 0.45
var _a: AudioStreamPlayer
var _b: AudioStreamPlayer


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	if AudioServer.get_bus_index("Music") < 0:
		AudioServer.add_bus()
		AudioServer.set_bus_name(AudioServer.bus_count - 1, "Music")
	var cfg := ConfigFile.new()
	if cfg.load(PREFS) == OK:
		enabled = bool(cfg.get_value("music", "on", true))
		volume = clampf(float(cfg.get_value("music", "volume", 0.45)), 0, 1)
	_a = _player()
	_b = _player()
	_apply()


func _player() -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.bus = "Music"
	p.volume_db = -80
	add_child(p)
	return p


func _apply() -> void:
	var idx := AudioServer.get_bus_index("Music")
	AudioServer.set_bus_volume_db(idx, linear_to_db(maxf(0.001, volume * 0.6)))
	AudioServer.set_bus_mute(idx, volume <= 0.001)


func _save() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("music", "on", enabled)
	cfg.set_value("music", "volume", volume)
	cfg.save(PREFS)


func set_enabled(on: bool) -> void:
	enabled = on
	_save()
	if not on:
		stop()
	else:
		play(wanted)


func set_volume(v: float) -> void:
	volume = clampf(v, 0, 1)
	_save()
	_apply()


## Toca a faixa ("menu", "city", "night", "tavern", "arena"); a mesma não reinicia.
func play(track: String) -> void:
	if track == "town":
		track = "city"
	wanted = track
	if not enabled or track == "" or track == "none":
		stop()
		return
	if track == current:
		return
	var path := "res://assets/audio/music_%s.wav" % track
	if not ResourceLoader.exists(path):
		return
	var s: AudioStreamWAV = (load(path) as AudioStreamWAV).duplicate()
	s.loop_mode = AudioStreamWAV.LOOP_FORWARD
	s.loop_end = s.data.size() / 2
	current = track
	var old := _a
	_a = _b
	_b = old
	if old.playing:
		var tw := create_tween()
		tw.tween_property(old, "volume_db", -60.0, 1.2)
		tw.tween_callback(old.stop)
	_a.stream = s
	_a.volume_db = -40
	_a.play()
	create_tween().tween_property(_a, "volume_db", 0.0, 1.5)


func stop() -> void:
	current = ""
	for p in [_a, _b]:
		if p.playing:
			var tw := create_tween()
			tw.tween_property(p, "volume_db", -60.0, 1.0)
			tw.tween_callback(p.stop)
