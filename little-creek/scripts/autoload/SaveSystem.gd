extends Node
## Automatic save/load (user://, works on Android), offline progress and
## persisted settings. Saves atomically (tmp file + rename).

signal loaded(offline_report: Dictionary)

const SAVE_PATH := "user://little_creek_save.json"
const TMP_PATH := "user://little_creek_save.tmp"
const SAVE_VERSION := 1
const AUTOSAVE_INTERVAL := 20.0
const OFFLINE_BASE_HOURS := 2.0
const OFFLINE_EFFICIENCY := 0.6

var settings := {"music": 0.7, "sfx": 0.85}
var last_report: Dictionary = {}
var _timer := 0.0
var _pending := false
var _loaded := false
var _paused_at := 0.0
## Systems that persist their own state (journal, nests...): key -> object
## with to_dict() / from_dict(d). Registered before load_game().
var extra_providers: Dictionary = {}
var _pending_extra: Dictionary = {}


func register(key: String, obj: Object) -> void:
	extra_providers[key] = obj
	if _pending_extra.has(key):
		obj.call("from_dict", _pending_extra[key])


func _load_extra(data: Dictionary) -> void:
	for k in extra_providers.keys():
		if data.has(k):
			extra_providers[k].call("from_dict", data[k])
	for k in data.keys():
		if not extra_providers.has(k):
			_pending_extra[k] = data[k]


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	get_tree().set_auto_accept_quit(false)


## Called by Main once the world exists.
func load_game() -> Dictionary:
	var report := {}
	if FileAccess.file_exists(SAVE_PATH):
		var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
		var data: Variant = JSON.parse_string(f.get_as_text()) if f else null
		if data is Dictionary:
			settings.merge(data.get("settings", {}), true)
			GameState.from_dict(data.get("state", {}))
			Clock.from_dict(data.get("clock", {}))
			Weather.from_dict(data.get("weather", {}))
			_load_extra(data)
			report = _apply_offline(float(data.get("last_unix", 0.0)))
		else:
			push_warning("SaveSystem: corrupt save ignored")
	_loaded = true
	AudioManager.apply_settings(settings)
	last_report = report
	loaded.emit(report)
	return report


func _apply_offline(last_unix: float) -> Dictionary:
	if last_unix <= 0.0:
		return {}
	var now := Time.get_unix_time_from_system()
	var elapsed := now - last_unix
	if elapsed < 60.0:
		return {}
	var cap := (OFFLINE_BASE_HOURS + GameState.upgrade_level("rain")) * 3600.0
	var eff := minf(elapsed, cap) * OFFLINE_EFFICIENCY
	var w := GameState.water_rate * eff
	var s := GameState.seed_rate * eff
	GameState.add_resources(w, s)
	# the world clock moves on too, but capped (no seasons flying by)
	Clock.advance_offline(elapsed)
	return {"elapsed": elapsed, "capped": elapsed > cap, "cap_hours": cap / 3600.0, "water": w, "seeds": s}


func request_save() -> void:
	_pending = true


func save_now() -> void:
	if not _loaded:
		return
	var data := {
		"version": SAVE_VERSION,
		"last_unix": Time.get_unix_time_from_system(),
		"settings": settings,
		"state": GameState.to_dict(),
		"clock": Clock.to_dict(),
		"weather": Weather.to_dict(),
	}
	for k in extra_providers.keys():
		var obj: Object = extra_providers[k]
		if is_instance_valid(obj):
			data[k] = obj.call("to_dict")
	var f := FileAccess.open(TMP_PATH, FileAccess.WRITE)
	if f == null:
		push_error("SaveSystem: cannot write save (%d)" % FileAccess.get_open_error())
		return
	f.store_string(JSON.stringify(data))
	f.close()
	var dir := DirAccess.open("user://")
	if dir.file_exists(SAVE_PATH.get_file()):
		dir.remove(SAVE_PATH.get_file())
	dir.rename(TMP_PATH.get_file(), SAVE_PATH.get_file())
	_pending = false


func delete_save() -> void:
	var dir := DirAccess.open("user://")
	if dir and dir.file_exists(SAVE_PATH.get_file()):
		dir.remove(SAVE_PATH.get_file())


func _process(delta: float) -> void:
	_timer += delta
	if _timer >= AUTOSAVE_INTERVAL or (_pending and _timer >= 2.0):
		_timer = 0.0
		save_now()


func _notification(what: int) -> void:
	match what:
		NOTIFICATION_WM_CLOSE_REQUEST:
			save_now()
			get_tree().quit()
		NOTIFICATION_APPLICATION_PAUSED:
			_paused_at = Time.get_unix_time_from_system()
			save_now()
		NOTIFICATION_APPLICATION_FOCUS_OUT, NOTIFICATION_WM_GO_BACK_REQUEST:
			save_now()
		NOTIFICATION_APPLICATION_RESUMED:
			# returning from background on Android counts as offline time
			if _paused_at > 0.0 and _loaded:
				var rep := _apply_offline(_paused_at)
				_paused_at = 0.0
				if not rep.is_empty():
					last_report = rep
					loaded.emit(rep)
