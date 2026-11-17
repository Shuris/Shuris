class_name Stats
## Atributos, equipamento e estatísticas de combate (AttributeSystem, data/equipment,
## SkillTreeSystem e CombatantFactory da versão TypeScript).

const ATTR_KEYS := ["str", "vit", "res", "agi", "prec", "tech"]
const SLOTS := ["mainHand", "offHand", "head", "body", "legs"]
const DODGE_CAP := 0.35
const MIN_ATTACK_INTERVAL := 0.8
const BASE_ATTACK_INTERVAL := 2.0
const UNARMED_REACH := 16
const PARRY_POWER := 0.2
const MAX_PLUS := 3
const INJURY_HP := 0.7
const INJURY_DAMAGE := 0.7
const BEAST_STATS := {
	"wolf": {"damage": 1.4, "hp": 0.9, "reach": 34},
	"boar": {"damage": 1.1, "hp": 1.0, "reach": 34},
	"bear": {"damage": 1.1, "hp": 0.9, "reach": 38},
	"lion": {"damage": 1.0, "hp": 1.2, "reach": 38},
}
const SKILL_ORDER := ["power_strike", "iron_guard", "quick_strike", "counter"]


static func empty_attrs(v := 0) -> Dictionary:
	var a := {}
	for k in ATTR_KEYS:
		a[k] = v
	return a


## Ordenação estável (como Array.sort do JavaScript): necessária para os resultados
## baterem com a versão TypeScript quando há empates.
static func stable_sort(arr: Array, less: Callable) -> Array:
	var out := arr.duplicate()
	for i in range(1, out.size()):
		var x = out[i]
		var j := i - 1
		while j >= 0 and less.call(x, out[j]):
			out[j + 1] = out[j]
			j -= 1
		out[j + 1] = x
	return out


# ------------------------------------------------------------------ ferreiro
static func forge_cost(item: Dictionary, plus: int) -> int:
	return int(round(20 + float(item.price) * [0.4, 0.7, 1.1][clampi(plus, 0, 2)]))


static func forge_level(item: Dictionary, plus: int) -> int:
	return int(item.minLevel) + (plus + 1) * 3 - 2


static func _forge_spent(item: Dictionary, plus: int) -> int:
	var s := 0
	for i in plus:
		s += forge_cost(item, i)
	return s


static func sell_price(item: Dictionary, plus := 0) -> int:
	return maxi(1, int(floor(float(item.price) * 0.4 + _forge_spent(item, plus) * 0.3)))


## Item com as melhorias do ferreiro (cópia).
static func forged(item: Dictionary, plus := 0) -> Dictionary:
	var n := clampi(int(floor(plus)), 0, MAX_PLUS)
	if n == 0:
		return item
	var it := item.duplicate(true)
	var base_mods: Dictionary = item.mods
	var m: Dictionary = it.mods
	if item.category == "weapon":
		m.damage = float(m.get("damage", 0)) + n * maxi(1, int(round(float(base_mods.get("damage", 0)) * 0.15)))
	if m.get("block", 0):
		m.block = minf(0.85, float(m.block) + 0.02 * n)
	if item.category != "weapon":
		m.defense = float(m.get("defense", 0)) + n * maxi(1, int(ceil(float(base_mods.get("defense", 0)) * 0.15)))
	it.plus = n
	return it


static func inv_item(inv) -> Dictionary:
	if inv == null:
		return {}
	var def := Data.item(str(inv.itemId))
	return forged(def, int(inv.get("plus", 0))) if not def.is_empty() else {}


static func equipped_items(p: Dictionary) -> Dictionary:
	var out := {}
	for slot in SLOTS:
		var uid = p.equipment.get(slot)
		if uid == null:
			continue
		for inv in p.inventory:
			if inv.uid == uid:
				var def := Data.item(str(inv.itemId))
				if not def.is_empty():
					out[slot] = forged(def, int(inv.get("plus", 0)))
	return out


static func natural_attributes(p: Dictionary) -> Dictionary:
	var a := empty_attrs()
	var mx := int(Data.constant("MAX_ATTRIBUTE"))
	for k in ATTR_KEYS:
		a[k] = clampi(int(p.baseAttributes[k]) + int(p.trainedBonus[k]), 0, mx)
	return a


static func final_attributes(natural: Dictionary, gear: Dictionary) -> Dictionary:
	var bonus := empty_attrs()
	for slot in gear:
		var attrs = gear[slot].mods.get("attrs")
		if attrs == null:
			continue
		for k in ATTR_KEYS:
			bonus[k] += int(attrs.get(k, 0))
	var a := empty_attrs()
	var mx := int(Data.constant("MAX_ATTRIBUTE")) + 20
	for k in ATTR_KEYS:
		a[k] = clampi(int(natural[k]) + int(bonus[k]), 0, mx)
	return a


static func compute(attrs: Dictionary, gear: Dictionary) -> Dictionary:
	var weapon_damage := 0.0
	var defense := 0.0
	var speed := 0.0
	var reach := float(UNARMED_REACH)
	var block := 0.0
	for slot in SLOTS:
		if not gear.has(slot):
			continue
		var it: Dictionary = gear[slot]
		var m: Dictionary = it.mods
		weapon_damage += float(m.get("damage", 0))
		defense += float(m.get("defense", 0))
		speed += float(m.get("attackSpeed", 0))
		if it.slot == "mainHand" and m.get("reach", 0):
			reach = float(m.reach)
		if it.slot == "offHand" and m.get("block", 0):
			block = float(m.block)
	var total_def: float = defense + attrs.res * 1.5
	var has_shield := block > 0
	return {
		"maxHp": int(round(100 + attrs.vit * 12)),
		"maxStamina": int(round(100 + attrs.res * 10)),
		"baseDamage": 8 + attrs.str * 1.8 + weapon_damage,
		"defense": total_def,
		"damageReduction": minf(0.7, total_def / (total_def + 100)),
		"precision": float(attrs.prec),
		"agility": float(attrs.agi),
		"technique": float(attrs.tech),
		"dodgeChance": minf(DODGE_CAP, 0.05 + attrs.agi * 0.005),
		"attackInterval": clampf(BASE_ATTACK_INTERVAL - attrs.agi * 0.032 + speed, MIN_ATTACK_INTERVAL, 3),
		"reach": reach,
		"blockPower": clampf((block if has_shield else PARRY_POWER) + attrs.tech * 0.002, 0, 0.85),
		"hasShield": has_shield,
		"critChance": minf(0.35, 0.04 + attrs.tech * 0.002 + attrs.prec * 0.006),
		"armorPierce": attrs.prec * 1.0,
		"moveSpeed": 34 + attrs.agi * 0.5,
		"staminaRegen": 3 + attrs.res * 0.1,
		"fatigueMul": 1.0 / (1 + attrs.res * 0.015),
		"damageMul": 1.0, "damageTakenMul": 1.0, "hitBonus": 0.0, "blockPierce": 0.0, "powerStrikeBonus": 0.0, "secondWind": false,
	}


# ------------------------------------------------------------------ árvore de habilidades
static func perk(id: String) -> Dictionary:
	for pk in Data.d.perks:
		if pk.id == id:
			return pk
	return {}


static func skill_points_for_level(level: int) -> int:
	return 1 + level


static func can_learn(p: Dictionary, id: String) -> Variant:
	var pk := perk(id)
	if pk.is_empty():
		return I18n.t("err.noPerk")
	if p.perks.has(id):
		return "Já aprendida."
	if pk.requires.size() > 0 and not pk.requires.any(func(r): return p.perks.has(r)):
		return I18n.t("err.perkPrev")
	if int(p.skillPoints) < int(pk.cost):
		return I18n.t("err.perkPoints", {"n": pk.cost})
	return null


static func combined_mods(perks: Array) -> Dictionary:
	var m := {"damageMul": 0.0, "critAdd": 0.0, "hpMul": 0.0, "dodgeAdd": 0.0, "intervalMul": 0.0, "hitAdd": 0.0, "regenMul": 0.0,
		"blockAdd": 0.0, "blockPierce": 0.0, "damageTakenMul": 0.0, "powerStrikeBonus": 0.0, "secondWind": false}
	for id in perks:
		var mods = perk(id).get("mods")
		if mods == null:
			continue
		for k in mods:
			if k == "secondWind":
				m.secondWind = m.secondWind or bool(mods[k])
			else:
				m[k] += float(mods[k])
	return m


static func skills_from_perks(perks: Array) -> Array:
	var have := {}
	for id in perks:
		var s = perk(id).get("skill")
		if s != null:
			have[s] = true
	return SKILL_ORDER.filter(func(s): return have.has(s))


static func auto_perks(level: int, order: Array, spread := false) -> Array:
	var state := {"perks": [], "skillPoints": skill_points_for_level(level)}
	var progress := true
	var turn := 0
	while progress:
		progress = false
		var rotated := order
		if spread:
			var k := turn % order.size()
			rotated = order.slice(k) + order.slice(0, k)
		turn += 1
		for branch in rotated:
			var cands: Array = Data.d.perks.filter(func(pk): return pk.branch == branch and can_learn(state, pk.id) == null)
			cands = stable_sort(cands, func(a, b): return int(a.tier) < int(b.tier))
			if cands.size() > 0:
				state.skillPoints -= int(cands[0].cost)
				state.perks.append(cands[0].id)
				progress = true
				break
	return state.perks


static func apply_perks(base: Dictionary, perks: Array) -> Dictionary:
	var m := combined_mods(perks)
	var s := base.duplicate()
	s.maxHp = int(round(s.maxHp * (1 + m.hpMul)))
	s.critChance = minf(0.45, s.critChance + m.critAdd)
	s.dodgeChance = minf(DODGE_CAP, s.dodgeChance + m.dodgeAdd)
	s.attackInterval = maxf(MIN_ATTACK_INTERVAL, s.attackInterval * (1 - m.intervalMul))
	s.staminaRegen *= 1 + m.regenMul
	s.blockPower = minf(0.85, s.blockPower + m.blockAdd)
	s.damageMul = 1 + m.damageMul
	s.damageTakenMul = 1 - m.damageTakenMul
	s.hitBonus = m.hitAdd
	s.blockPierce = m.blockPierce
	s.powerStrikeBonus = m.powerStrikeBonus
	s.secondWind = m.secondWind
	return s


# ------------------------------------------------------------------ combatentes
static func player_combatant(p: Dictionary) -> Dictionary:
	var gear := equipped_items(p)
	var attrs := final_attributes(natural_attributes(p), gear)
	var stats := apply_perks(compute(attrs, gear), p.perks)
	if p.get("injury") != null:
		stats.maxHp = int(round(stats.maxHp * INJURY_HP))
		stats.damageMul *= INJURY_DAMAGE
	return {
		"spec": {"name": p.name, "level": int(p.level), "stats": stats, "skills": skills_from_perks(p.perks), "strategy": p.strategy},
		"visual": {"appearance": p.appearance, "gear": gear},
	}


static func opponent_attributes(def: Dictionary) -> Dictionary:
	var lvl := int(def.level)
	var extra := 3 + int(Data.constant("POINTS_PER_LEVEL")) * (lvl - 1) + int(round(lvl * 0.5))
	var total := 0.0
	for k in ATTR_KEYS:
		total += float(def.weights.get(k, 0))
	var attrs := {}
	var assigned := 0
	var fracs: Array = []
	for k in ATTR_KEYS:
		var share := (extra * float(def.weights.get(k, 0))) / total
		var whole := int(floor(share))
		attrs[k] = int(Data.constant("BASE_ATTRIBUTE")) + whole
		assigned += whole
		fracs.append([k, share - whole])
	fracs = stable_sort(fracs, func(a, b): return a[1] > b[1])
	for i in extra - assigned:
		attrs[fracs[i % fracs.size()][0]] += 1
	return attrs


static func opponent_gear(def: Dictionary) -> Dictionary:
	var g := {}
	for slot in SLOTS:
		var id = def.equipment.get(slot)
		if id != null and not Data.item(str(id)).is_empty():
			g[slot] = Data.item(str(id))
	return g


static func opponent_combatant(def: Dictionary) -> Dictionary:
	var gear := opponent_gear(def)
	var attrs := final_attributes(opponent_attributes(def), gear)
	var perks := auto_perks(int(def.level), def.paths, true)
	var stats := apply_perks(compute(attrs, gear), perks)
	var beast = def.get("beast")
	if beast != null and BEAST_STATS.has(beast):
		var b: Dictionary = BEAST_STATS[beast]
		stats.damageMul *= b.damage
		stats.maxHp = int(round(stats.maxHp * b.hp))
		stats.blockPower = minf(stats.blockPower, 0.1)
		stats.reach = maxf(stats.reach, b.reach)
	return {
		"spec": {"name": Names.opponent_full(def), "level": int(def.level), "stats": stats, "skills": skills_from_perks(perks), "strategy": def.strategy},
		"visual": {"appearance": def.appearance, "gear": gear, "beast": beast},
	}
