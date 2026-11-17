extends Node
## Três espaços de salvamento em user://saves (gravação atômica + cópia de segurança).
## Na primeira vez, encontra os saves da versão Electron (pasta do Colosseum) e os usa.

const DIR := "user://saves"


func _ready() -> void:
	DirAccess.make_dir_recursive_absolute(DIR)


func path(slot: int) -> String:
	return "%s/slot%d.json" % [DIR, slot]


func backup_path(slot: int) -> String:
	return "%s/slot%d.backup.json" % [DIR, slot]


## Pasta de saves da versão Electron (para importar).
func electron_dir() -> String:
	var override := OS.get_environment("COLOSSEUM_ELECTRON_SAVES")
	if override != "":
		return override
	if OS.get_name() == "Windows":
		return OS.get_environment("APPDATA").path_join("Colosseum").path_join("saves")
	if OS.get_name() == "macOS":
		return OS.get_environment("HOME").path_join("Library/Application Support/Colosseum/saves")
	return OS.get_environment("HOME").path_join(".config/Colosseum/saves")


func _read(p: String) -> String:
	if not FileAccess.file_exists(p):
		return ""
	var f := FileAccess.open(p, FileAccess.READ)
	return f.get_as_text() if f else ""


## {slot, player (ou null), error, imported}
func read(slot: int) -> Dictionary:
	var text := _read(path(slot))
	var imported := false
	if text == "":
		text = _read(electron_dir().path_join("slot%d.json" % slot))
		imported = text != ""
	if text == "":
		return {"slot": slot, "player": null, "error": "", "imported": false}
	var res := SaveSystem.parse(text)
	if not res.ok:
		# save principal com defeito: tenta a cópia de segurança
		var bak := SaveSystem.parse(_read(backup_path(slot)))
		if bak.ok:
			return {"slot": slot, "player": bak.player, "error": "", "imported": false, "fromBackup": true}
		return {"slot": slot, "player": null, "error": res.error, "imported": imported}
	return {"slot": slot, "player": res.player, "error": "", "imported": imported}


func read_all() -> Array:
	var out := []
	for s in SaveSystem.SLOTS:
		out.append(read(s))
	return out


func write(slot: int, p: Dictionary) -> bool:
	var text := SaveSystem.serialize(p, int(Time.get_unix_time_from_system() * 1000.0))
	var tmp := path(slot) + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		return false
	f.store_string(text)
	f.close()
	var d := DirAccess.open(DIR)
	if FileAccess.file_exists(path(slot)):
		d.copy(path(slot), backup_path(slot))
	d.rename(tmp, path(slot))
	return true


func remove(slot: int) -> void:
	var d := DirAccess.open(DIR)
	for p in [path(slot), backup_path(slot)]:
		if FileAccess.file_exists(p):
			d.remove(p)
