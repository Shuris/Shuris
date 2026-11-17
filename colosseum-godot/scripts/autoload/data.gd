extends Node
## Dados do jogo exportados da versão TypeScript (data/game_data.json): locais,
## origens, itens, adversários, melhorias, habilidades e cores. Mesmos números.

var d: Dictionary = {}
var locations: Array = []
var _loc_by_id := {}
var _items := {}
var _opps := {}


func _ready() -> void:
	var f := FileAccess.open("res://data/game_data.json", FileAccess.READ)
	d = JSON.parse_string(f.get_as_text())
	locations = d.locations
	for l in locations:
		_loc_by_id[l.id] = l
	for it in d.items:
		_items[it.id] = it
	for o in d.opponents:
		_opps[o.id] = o


func location(id: String) -> Dictionary:
	return _loc_by_id.get(id, locations[0])


func origin(id: String) -> Dictionary:
	for o in d.origins:
		if o.id == id:
			return o
	return d.origins[0]


func item(id: String) -> Dictionary:
	return _items.get(id, {})


func opponent(id: String) -> Dictionary:
	return _opps.get(id, {})


func constant(name: String) -> Variant:
	return d.constants[name]


func xp_to_next(level: int) -> int:
	var t: Array = d.xpTable
	return int(t[clampi(level, 1, t.size() - 1)])


## Cores (tinta multiplicada) a partir dos números hexadecimais do jogo (0xRRGGBB).
func hex_color(v: int) -> Color:
	return Color8((v >> 16) & 255, (v >> 8) & 255, v & 255)


func _en() -> bool:
	return I18n.lang == "en"


func loc_name(id: String) -> String:
	return d.en.EN_LOCATIONS[id].name if _en() else location(id).name


func loc_short(id: String) -> String:
	return d.en.EN_LOCATIONS[id].short if _en() else location(id).short


func origin_name(id: String) -> String:
	return d.en.EN_ORIGINS[id].name if _en() and d.en.EN_ORIGINS.has(id) else origin(id).name


func origin_desc(id: String) -> String:
	return d.en.EN_ORIGINS[id].description if _en() and d.en.EN_ORIGINS.has(id) else origin(id).description


func skin_name(i: int) -> String:
	return (d.en.EN_SKIN if _en() else d.skinNames)[i]


func hair_name(i: int) -> String:
	return (d.en.EN_HAIR if _en() else d.hairNames)[i]


func attr_name(k: String) -> String:
	return d.en.EN_ATTRIBUTES[k].name if _en() else d.attributes[k].name


func item_name(it: Dictionary) -> String:
	if _en() and d.en.EN_ITEMS.has(it.id):
		return d.en.EN_ITEMS[it.id].name
	return it.get("name", it.get("id", ""))


func slot_name(slot: String) -> String:
	var pt := {"mainHand": "Arma", "offHand": "Escudo", "head": "Capacete", "body": "Armadura", "legs": "Pernas"}
	return d.en.EN_SLOTS[slot] if _en() else pt.get(slot, slot)


## Equipamento vestido: {slot: itemDef}
func gear_of(p: Dictionary) -> Dictionary:
	var g := {}
	for slot in p.equipment:
		var uid = p.equipment[slot]
		if uid == null:
			continue
		for it in p.inventory:
			if it.uid == uid:
				var def := item(it.itemId)
				if not def.is_empty():
					g[slot] = def
	return g
