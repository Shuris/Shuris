extends Node
## Static, read-only game data loaded from res://data/*.json.
## Keeping balance and content in JSON makes it easy to tune and expand.

var items: Dictionary = {}
var item_order: Array = []
var upgrades: Array = []
var upgrade_index: Dictionary = {}
var species: Dictionary = {}
var stages: Array = []
var scene: Dictionary = {}
var creatures: Dictionary = {}
var config: Dictionary = {}
var fauna: Dictionary = {}


func _ready() -> void:
	items = _load_json("res://data/items.json")
	item_order = items.keys()
	upgrades = _load_json("res://data/upgrades.json")
	for u in upgrades:
		upgrade_index[u["id"]] = u
	species = _load_json("res://data/species.json")
	stages = _load_json("res://data/stages.json")
	scene = _load_json("res://data/scene_points.json")
	creatures = _load_json("res://data/creatures.json")
	config = _load_json("res://data/config.json")
	fauna = _load_json("res://data/fauna.json")


func _load_json(path: String) -> Variant:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		push_error("GameData: cannot open %s" % path)
		return {}
	var data: Variant = JSON.parse_string(f.get_as_text())
	if data == null:
		push_error("GameData: invalid JSON in %s" % path)
		return {}
	return data


func stage_info(stage: int) -> Dictionary:
	return stages[clampi(stage - 1, 0, stages.size() - 1)]


func item_sprite_path(id: String, variant: int) -> String:
	var it: Dictionary = items[id]
	var p: String = it["sprite"]
	return p % variant if p.contains("%d") else p


func item_moss_path(id: String, variant: int) -> String:
	var it: Dictionary = items[id]
	if not it.has("moss"):
		return ""
	return String(it["moss"]) % variant
