class_name Fighters
## Lutadores avulsos da cidade, sementes do dia e embaralhamento (data/fighters.ts).

const M32 := 0xFFFFFFFF


## Semente estável por gladiador e dia (mesma conta de 32 bits da versão TypeScript).
static func day_seed(seed: int, day: int, salt: int) -> int:
	return ((seed & M32) ^ Rng.imul(day + 7, 2246822519) ^ Rng.imul(salt + 3, 3266489917)) & M32


static func shuffle(rng: Rng, list: Array) -> Array:
	var a := list.duplicate()
	for i in range(a.size() - 1, 0, -1):
		var j := int(floor(rng.next() * (i + 1)))
		var tmp = a[i]
		a[i] = a[j]
		a[j] = tmp
	return a


static func gear_tier(level: int) -> int:
	return 0 if level <= 5 else (1 if level <= 11 else (2 if level <= 18 else 3))


static func pool_fighter(id: String) -> Dictionary:
	for f in Data.d.pool:
		if f.id == id:
			return f
	return {}


static func pool_opponent(f: Dictionary, level: float) -> Dictionary:
	var c: Dictionary = Data.d.classes[f.cls]
	var lv := clampi(int(round(level)), 1, int(Data.constant("MAX_LEVEL")))
	return {"id": f.id, "name": f.name, "epithet": "", "description": "", "level": lv, "weights": c.weights,
		"equipment": c.gear[gear_tier(lv)], "strategy": c.strategy, "paths": c.paths, "appearance": f.appearance, "cls": f.cls}


static func free_challenger(seed: int, day: int, index: int, player_level: int) -> Dictionary:
	var rng := Rng.new(day_seed(seed, day, 100 + index))
	var pool: Array = Data.d.pool
	var f: Dictionary = pool[int(floor(rng.next() * pool.size()))]
	var level := player_level + (1 if rng.next() < 0.35 else 0) - (1 if rng.next() < 0.25 else 0)
	return pool_opponent(f, level)


static func with_level(def: Dictionary, level: int) -> Dictionary:
	var d := def.duplicate()
	d.level = level
	return d


static func opponent_index(id: String) -> int:
	var ops: Array = Data.d.opponents
	for i in ops.size():
		if ops[i].id == id:
			return i
	return -1


static func arena_for_opponent(id: String) -> Dictionary:
	var idx := maxi(0, opponent_index(id))
	var ars: Array = Data.d.arenas.slice(0, 5)
	return ars[mini(ars.size() - 1, idx / 2)]


static func arena(id: String) -> Dictionary:
	for a in Data.d.arenas:
		if a.id == id:
			return a
	return {}


static func any_fighter_name(id: String) -> String:
	var o := Data.opponent(id)
	if not o.is_empty():
		return o.name
	var f := pool_fighter(id)
	return f.name if not f.is_empty() else id
