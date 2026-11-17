extends Node
## Estado do jogo em andamento: o gladiador do espaço escolhido e o salvamento.

signal changed

var slot := 0
var p: Dictionary = {}


func has_player() -> bool:
	return not p.is_empty()


func start(slot_n: int, player: Dictionary) -> void:
	slot = slot_n
	p = player
	I18n.set_lang(str(p.settings.get("language", I18n.lang)))
	save()
	changed.emit()


## Altera o estado, salva e avisa a interface.
func update(fn: Callable) -> Variant:
	var r = fn.call(p)
	save()
	changed.emit()
	return r


func save() -> void:
	if slot > 0 and has_player():
		Saves.write(slot, p)


func close() -> void:
	save()
	p = {}
	slot = 0
