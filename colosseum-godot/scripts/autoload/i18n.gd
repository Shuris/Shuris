extends Node
## Textos em português e inglês (data/i18n.json, os mesmos dicionários da versão
## TypeScript). t("chave", {"name": "Marcus"}) troca {name} pelo valor.

signal lang_changed(lang: String)

var lang := "pt"
var dicts := {}
var _rx := RegEx.new()


func _ready() -> void:
	var f := FileAccess.open("res://data/i18n.json", FileAccess.READ)
	dicts = JSON.parse_string(f.get_as_text())
	# textos só da versão Godot
	var g = JSON.parse_string(FileAccess.open("res://data/i18n_godot.json", FileAccess.READ).get_as_text())
	for l in g:
		dicts[l].merge(g[l], true)
	_rx.compile("\\{(\\w+)\\}")


func set_lang(l: String) -> void:
	if l != "pt" and l != "en" or l == lang:
		return
	lang = l
	lang_changed.emit(l)


func t(key: String, params: Dictionary = {}) -> String:
	return tk(key, params, key)


## Como t(), mas com um valor de reserva quando a chave não existe.
func tk(key: String, params: Dictionary = {}, fallback: String = "") -> String:
	var dict: Dictionary = dicts.get(lang, {})
	var raw = dict.get(key, null)
	if raw == null:
		raw = dicts.pt.get(key, null)
	if raw == null:
		return fallback
	return fill(str(raw), params)


func fill(text: String, params: Dictionary) -> String:
	if params.is_empty():
		return text
	var out := text
	for m in _rx.search_all(text):
		var k := m.get_string(1)
		if params.has(k):
			out = out.replace(m.get_string(0), str(params[k]))
	return out


## Uma das variantes separadas por "|", escolhida por pick.
func variant(text: String, pick: int) -> String:
	var parts := text.split("|")
	return parts[posmod(pick, parts.size())]
