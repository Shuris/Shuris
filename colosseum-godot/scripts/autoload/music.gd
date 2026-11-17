extends Node
## Música de fundo (preenchida na etapa 4): play("town"|"arena"|"menu").

var current := ""


func play(track: String) -> void:
	current = track
