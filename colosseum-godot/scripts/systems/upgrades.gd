class_name Upgrades
## Melhorias compráveis do alojamento e do ludus (data/upgrades.ts).

static func get_def(id: String) -> Dictionary:
	for u in Data.d.upgrades:
		if u.id == id:
			return u
	return {}


static func has(p: Dictionary, id: String) -> bool:
	return p.upgrades.has(id)


static func visible(p: Dictionary, u: Dictionary) -> bool:
	return u.get("tier") == null or int(u.tier) < 2 or u.get("requires") == null or has(p, u.requires)


static func nap_bonus(p: Dictionary) -> int:
	var b := 0
	for u in Data.d.upgrades:
		if u.get("napBonus") and has(p, u.id):
			b = maxi(b, int(u.napBonus))
	return b


static func training_mul(p: Dictionary, id: String) -> float:
	var m := 1.0
	for u in Data.d.upgrades:
		if u.get("training") != null and u.training.id == id and has(p, u.id):
			m *= float(u.training.mul)
	return m


static func train_energy_cut(p: Dictionary) -> int:
	var s := 0
	for u in Data.d.upgrades:
		if u.get("trainEnergyCut") and has(p, u.id):
			s += int(u.trainEnergyCut)
	return s


## null = pode; senão 'owned' | 'level' | 'requires' | 'coins'
static func can_buy(p: Dictionary, id: String) -> Variant:
	var u := get_def(id)
	if u.is_empty() or has(p, id):
		return "owned"
	if int(p.level) < int(u.minLevel):
		return "level"
	if u.get("requires") != null and not has(p, u.requires):
		return "requires"
	if int(p.coins) < int(u.price):
		return "coins"
	return null


static func buy(p: Dictionary, id: String) -> Variant:
	var err = can_buy(p, id)
	if err != null:
		return err
	p.coins = int(p.coins) - int(get_def(id).price)
	p.upgrades.append(id)
	return null
