class_name EcosystemRules
extends RefCounted
## Pure functions describing how the ecosystem responds to the player's
## choices. Used by GameState (stats), WildlifeDirector (spawning) and the UI.

const BASE_QUALITY := 12.0
const ANIMALS := ["sabia", "saira", "butterfly", "dragonfly", "fish", "deer", "owl", "fox", "duck"]


## Time/season/weather activity multiplier for a species (data/fauna.json).
static func activity(id: String) -> float:
	var f: Dictionary = GameData.fauna.get(id, {})
	if f.is_empty():
		return 1.0
	var a := float(f.get("periods", {}).get(Clock.period(), 1.0))
	a *= float(f.get("seasons", {}).get(Clock.season_key(), 1.0))
	a *= float(f.get("rain", {}).get(Weather.state, 1.0))
	return a


## Water quality 0..100
static func quality(upgrades: Dictionary, counts: Dictionary) -> float:
	var q := BASE_QUALITY
	q += 9.0 * float(upgrades.get("filter", 0))
	q += minf(6.0 * float(counts.get("aquatic", 0)), 36.0)
	q += minf(1.0 * float(counts.get("log", 0)), 4.0)
	q += minf(0.6 * float(counts.get("fern", 0)) + 0.4 * float(counts.get("grass", 0)), 10.0)
	return clampf(q, 0.0, 100.0)


## Vitality 0..100: water quality + vegetation (with diminishing returns)
static func vitality(q: float, veg_points: float) -> float:
	var veg := 62.0 * (1.0 - exp(-veg_points / 42.0))
	return clampf(q * 0.4 + veg, 0.0, 100.0)


## Is an animal species able to live here right now?
static func animal_eligible(id: String, s: Dictionary) -> bool:
	var c: Dictionary = s["counts"]
	match id:
		"sabia":
			return true
		"saira":
			return int(c.get("shrub", 0)) >= 1 and s["vitality"] >= 35.0
		"butterfly":
			return int(c.get("flowers", 0)) >= 2 and s["vitality"] >= 20.0
		"dragonfly":
			return s["quality"] >= 35.0 and int(c.get("aquatic", 0)) >= 1
		"fish":
			return s["quality"] >= 45.0 and int(c.get("aquatic", 0)) >= 1
		"deer":
			var cover := int(c.get("tree_small", 0)) + int(c.get("tree_big", 0)) + int(c.get("shrub", 0))
			return s["vitality"] >= 55.0 and s["biodiversity_base"] >= 8 and cover >= 4
		"owl":
			return s["stage"] >= 2 and int(c.get("tree_small", 0)) + int(c.get("tree_big", 0)) >= 1
		"fox":
			return s["vitality"] >= 45.0 and s["biodiversity_base"] >= 7
		"duck":
			return s["quality"] >= 50.0 and int(c.get("aquatic", 0)) >= 1 and GameState.ducks_resident
	return false


## How many individuals the director should aim for.
static func animal_target(id: String, s: Dictionary) -> int:
	if not animal_eligible(id, s):
		return 0
	var c: Dictionary = s["counts"]
	var trees := int(c.get("tree_small", 0)) + int(c.get("tree_big", 0)) * 2
	match id:
		"sabia":
			if s["stage"] <= 1 and trees == 0:
				return 1
			return clampi(1 + int(trees * 0.6 + int(c.get("shrub", 0)) * 0.3 + s["vitality"] / 35.0), 1, 5)
		"saira":
			return clampi(1 + int(c.get("shrub", 0)) / 2, 1, 3)
		"butterfly":
			return clampi(int(c.get("flowers", 0)) / 2 + int(s["stage"]) - 1, 1, 7)
		"dragonfly":
			return clampi(1 + int(c.get("aquatic", 0)) / 2, 1, 3)
		"fish":
			return clampi(1 + int((s["quality"] - 45.0) / 12.0) + int(c.get("aquatic", 0)), 1, 6)
		"deer", "owl", "fox":
			return 1
		"duck":
			return 2 + int(c.get("aquatic", 0)) / 3
	return 0
