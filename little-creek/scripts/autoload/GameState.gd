extends Node
## Central game state: resources, placed objects, upgrades, progression and
## derived ecosystem stats. Systems and UI listen to its signals.

signal resources_changed
signal stats_changed
signal stage_changed(stage: int)
signal item_placed(data: Dictionary)
signal item_removed(uid: int)
signal species_discovered(id: String)
signal upgrade_bought(id: String)
signal notify(text: String)

const STAGE_PROD_BONUS := [0.0, 0.0, 0.15, 0.35, 0.6]
const TAP_SEED_CHANCE := 0.06

# --- persistent state
var water: float = 30.0
var seeds: float = 5.0
var reputation: float = 0.0
var stage: int = 1
var upgrades: Dictionary = {}
var placed: Array = []          # [{uid, id, x, y, v}]
var discovered: Dictionary = {}
var next_uid: int = 1
var total_taps: int = 0
var play_time: float = 0.0
var tutorial_step: int = 0

# --- derived (recomputed)
var counts: Dictionary = {}
var quality: float = 0.0
var vitality: float = 0.0
var beauty: float = 0.0
var biodiversity: int = 0
var biodiversity_base: int = 0
var eligible_animals: Dictionary = {}
var water_rate: float = 0.0
var seed_rate: float = 0.0
var tap_value: float = 1.0
var multiplier: float = 1.0

## Debug/testing speed-up (Info panel). Not saved.
var time_scale: float = 1.0

var _emit_accum := 0.0
var _recalc_accum := 0.0


func _ready() -> void:
	reset_state()


func reset_state() -> void:
	water = 30.0
	seeds = 5.0
	reputation = 0.0
	stage = 1
	upgrades = {}
	placed = []
	discovered = {}
	next_uid = 1
	total_taps = 0
	play_time = 0.0
	tutorial_step = 0
	_add_initial_scenery()
	recompute(false)


## A few natural elements so stage 1 is sparse but never ugly.
func _add_initial_scenery() -> void:
	var initial := [
		["small_rock", 214, 262, 0], ["grass", 258, 300, 1], ["small_rock", 592, 300, 2],
		["grass", 612, 252, 0], ["log", 196, 330, 0], ["grass", 352, 318, 2],
	]
	for e in initial:
		placed.append({"uid": next_uid, "id": e[0], "x": float(e[1]), "y": float(e[2]), "v": e[3]})
		next_uid += 1


func _process(delta: float) -> void:
	var dt := delta * time_scale
	play_time += dt
	water += water_rate * dt
	seeds += seed_rate * dt
	_emit_accum += delta
	_recalc_accum += delta
	if _recalc_accum >= 2.0:
		_recalc_accum = 0.0
		recompute()
	if _emit_accum >= 0.2:
		_emit_accum = 0.0
		resources_changed.emit()


# ------------------------------------------------------------------ stats
func recompute(allow_stage_up: bool = true) -> void:
	counts = {}
	var veg := 0.0
	beauty = 0.0
	var seed_items := 0.0
	var plant_species := {}
	for p in placed:
		var it: Dictionary = GameData.items.get(p["id"], {})
		if it.is_empty():
			continue
		counts[p["id"]] = int(counts.get(p["id"], 0)) + 1
		veg += float(it.get("vitality", 0.0))
		beauty += float(it.get("beauty", 0.0))
		seed_items += float(it.get("seed_rate", 0.0))
		var sp: String = it.get("species", "")
		if sp != "":
			plant_species[sp] = true
	quality = EcosystemRules.quality(upgrades, counts)
	vitality = EcosystemRules.vitality(quality, veg)
	if vitality >= 30.0:
		plant_species["moss"] = true
	beauty += float([0, 0, 4, 8, 14][stage])
	biodiversity_base = plant_species.size()
	var s := {"counts": counts, "vitality": vitality, "quality": quality, "stage": stage,
		"biodiversity_base": 0}
	# animals except deer first, then deer (needs the biodiversity count)
	eligible_animals = {}
	for a in EcosystemRules.ANIMALS:
		if a == "deer":
			continue
		if EcosystemRules.animal_eligible(a, s):
			eligible_animals[a] = true
	biodiversity_base = plant_species.size() + eligible_animals.size()
	s["biodiversity_base"] = biodiversity_base
	if EcosystemRules.animal_eligible("deer", s):
		eligible_animals["deer"] = true
	biodiversity = plant_species.size() + eligible_animals.size()
	for sp in plant_species.keys():
		if not discovered.has(sp):
			discover(sp)

	var corridor := float(upgrades.get("corridor", 0))
	multiplier = (1.0 + biodiversity * 0.05 * (1.0 + 0.15 * corridor)) \
		* (1.0 + STAGE_PROD_BONUS[stage]) * (1.0 + reputation * 0.001)
	var plants := 0
	for k in counts.keys():
		if GameData.items[k].get("category", "") in ["plants", "trees"]:
			plants += int(counts[k])
	water_rate = (0.5 + 0.35 * float(upgrades.get("spring", 0)) + quality * 0.008 + plants * 0.02) * multiplier
	seed_rate = (0.03 + 0.04 * float(upgrades.get("seedbank", 0)) + seed_items) * (1.0 + biodiversity * 0.03)
	tap_value = (1.0 + float(upgrades.get("tap", 0))) * (1.0 + biodiversity * 0.05)
	stats_changed.emit()
	if allow_stage_up:
		_check_stage()


func ecosystem_snapshot() -> Dictionary:
	return {"counts": counts, "vitality": vitality, "quality": quality, "stage": stage,
		"biodiversity_base": biodiversity_base}


## 0..1 visual "lushness" used by the world (ground, moss, foreground).
func lushness() -> float:
	return clampf((vitality - 8.0) / 80.0, 0.0, 1.0)


func stage_requirements(st: int) -> Dictionary:
	if st > GameData.stages.size():
		return {}
	return GameData.stage_info(st)["req"]


## Progress 0..1 toward the next stage (minimum over requirements).
func stage_progress() -> float:
	var req := stage_requirements(stage + 1)
	if req.is_empty():
		return 1.0
	var p := 1.0
	for k in req.keys():
		p = minf(p, clampf(stat_value(k) / float(req[k]), 0.0, 1.0))
	return p


func stat_value(key: String) -> float:
	match key:
		"beauty":
			return beauty
		"vitality":
			return vitality
		"biodiversity":
			return float(biodiversity)
		"quality":
			return quality
	return 0.0


func _check_stage() -> void:
	while stage < GameData.stages.size():
		var req := stage_requirements(stage + 1)
		var ok := true
		for k in req.keys():
			if stat_value(k) < float(req[k]):
				ok = false
		if not ok:
			return
		stage += 1
		recompute(false)
		stage_changed.emit(stage)
		SaveSystem.request_save()


# ------------------------------------------------------------------ economy
func tap_water() -> Dictionary:
	total_taps += 1
	var gained := tap_value
	water += gained
	var seed_gain := 0
	if randf() < TAP_SEED_CHANCE:
		seed_gain = 1
		seeds += 1
	resources_changed.emit()
	return {"water": gained, "seeds": seed_gain}


func add_resources(w: float, s: float, rep: float = 0.0) -> void:
	water += w
	seeds += s
	reputation += rep
	resources_changed.emit()


func item_cost(id: String) -> Dictionary:
	var it: Dictionary = GameData.items[id]
	var n := int(counts.get(id, 0))
	var f := pow(1.07, n)
	return {"water": ceilf(float(it["cost"]["water"]) * f), "seeds": ceilf(float(it["cost"]["seeds"]) * f)}


func upgrade_level(id: String) -> int:
	return int(upgrades.get(id, 0))


func upgrade_cost(id: String) -> Dictionary:
	var u: Dictionary = GameData.upgrade_index[id]
	var f := pow(float(u["growth"]), upgrade_level(id))
	return {"water": ceilf(float(u["base_cost"]["water"]) * f), "seeds": ceilf(float(u["base_cost"]["seeds"]) * f)}


func can_afford(cost: Dictionary) -> bool:
	return water + 0.0001 >= float(cost.get("water", 0)) and seeds + 0.0001 >= float(cost.get("seeds", 0))


func _spend(cost: Dictionary) -> void:
	water -= float(cost.get("water", 0))
	seeds -= float(cost.get("seeds", 0))


func buy_upgrade(id: String) -> bool:
	var u: Dictionary = GameData.upgrade_index[id]
	if upgrade_level(id) >= int(u["max_level"]) or stage < int(u.get("unlock_stage", 1)):
		return false
	var cost := upgrade_cost(id)
	if not can_afford(cost):
		return false
	_spend(cost)
	upgrades[id] = upgrade_level(id) + 1
	recompute()
	upgrade_bought.emit(id)
	resources_changed.emit()
	SaveSystem.request_save()
	return true


func place_item(id: String, pos: Vector2, variant: int) -> Dictionary:
	var cost := item_cost(id)
	if not can_afford(cost):
		return {}
	_spend(cost)
	var d := {"uid": next_uid, "id": id, "x": pos.x, "y": pos.y, "v": variant}
	next_uid += 1
	placed.append(d)
	recompute()
	item_placed.emit(d)
	resources_changed.emit()
	SaveSystem.request_save()
	return d


func remove_item(uid: int) -> void:
	for i in placed.size():
		if int(placed[i]["uid"]) == uid:
			var id: String = placed[i]["id"]
			placed.remove_at(i)
			recompute(false)
			var cost := item_cost(id)  # refund half of the current price
			add_resources(cost["water"] * 0.5, cost["seeds"] * 0.5)
			item_removed.emit(uid)
			recompute()
			SaveSystem.request_save()
			return


func discover(id: String) -> void:
	if discovered.has(id):
		return
	discovered[id] = true
	species_discovered.emit(id)


# ------------------------------------------------------------------ save
func to_dict() -> Dictionary:
	return {"water": water, "seeds": seeds, "reputation": reputation, "stage": stage,
		"upgrades": upgrades, "placed": placed, "discovered": discovered, "next_uid": next_uid,
		"total_taps": total_taps, "play_time": play_time, "tutorial_step": tutorial_step}


func from_dict(d: Dictionary) -> void:
	water = float(d.get("water", 30.0))
	seeds = float(d.get("seeds", 5.0))
	reputation = float(d.get("reputation", 0.0))
	stage = clampi(int(d.get("stage", 1)), 1, GameData.stages.size())
	upgrades = {}
	for k in d.get("upgrades", {}).keys():
		upgrades[k] = int(d["upgrades"][k])
	placed = []
	for p in d.get("placed", []):
		if GameData.items.has(p.get("id", "")):
			placed.append({"uid": int(p["uid"]), "id": String(p["id"]), "x": float(p["x"]),
				"y": float(p["y"]), "v": int(p.get("v", 0))})
	discovered = d.get("discovered", {})
	next_uid = int(d.get("next_uid", placed.size() + 1))
	total_taps = int(d.get("total_taps", 0))
	play_time = float(d.get("play_time", 0.0))
	tutorial_step = int(d.get("tutorial_step", 0))
	recompute(false)
