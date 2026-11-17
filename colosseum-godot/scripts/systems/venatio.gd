class_name Venatio
## Lutas sazonais contra feras (VenatioSystem.ts).

const BEASTS := [
	{"kind": "wolf", "minLevel": 1, "plus": 1, "weights": {"str": 1, "vit": 0.8, "res": 1, "agi": 1.8, "prec": 1.2, "tech": 0.2}},
	{"kind": "boar", "minLevel": 3, "plus": 0, "weights": {"str": 1.6, "vit": 1.4, "res": 1.2, "agi": 0.6, "prec": 0.8, "tech": 0.2}},
	{"kind": "bear", "minLevel": 6, "plus": 0, "weights": {"str": 2, "vit": 1.8, "res": 1, "agi": 0.4, "prec": 0.8, "tech": 0.2}},
	{"kind": "lion", "minLevel": 9, "plus": 0, "weights": {"str": 1.7, "vit": 1.1, "res": 1, "agi": 1.5, "prec": 1.2, "tech": 0.3}},
]
const CHANCE := 0.2
const FAME_MUL := 2.5


static func is_day(seed: int, day: int) -> bool:
	if day < 3 or Calendar.weekday_index(day) == 6:
		return false
	return Rng.new(Fighters.day_seed(seed, day, 77)).next() < CHANCE


static func next_day(seed: int, day: int) -> int:
	for d in range(day, day + 60):
		if is_day(seed, d):
			return d
	return 0


static func beast_of_day(p: Dictionary) -> Dictionary:
	var rng := Rng.new(Fighters.day_seed(int(p.createdAt), int(p.day), 78))
	var pool: Array = BEASTS.filter(func(b): return int(p.level) >= int(b.minLevel))
	var pk: Dictionary = pool[mini(pool.size() - 1, int(floor(pow(rng.next(), 0.7) * pool.size())))]
	var level := clampi(int(p.level) + int(pk.plus), 1, 30)
	return {"id": "beast_" + pk.kind, "name": pk.kind, "epithet": "", "description": "", "level": level, "weights": pk.weights,
		"equipment": {}, "strategy": "aggressive", "paths": ["mars", "mercury", "minerva"],
		"appearance": {"skin": 0, "hairStyle": 0, "hairColor": 0, "beard": false, "clothColor": 0}, "beast": pk.kind}


static func check(p: Dictionary) -> Variant:
	if not is_day(int(p.createdAt), int(p.day)):
		return "notToday"
	if int(p.career.beastDay) == int(p.day):
		return "done"
	return null
