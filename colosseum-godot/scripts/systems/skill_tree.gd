class_name SkillTree
## Aprender e recomeçar a árvore de habilidades; distribuir pontos de atributo.

static func learn(p: Dictionary, id: String) -> Variant:
	var err = Stats.can_learn(p, id)
	if err != null:
		return err
	p.skillPoints = int(p.skillPoints) - int(Stats.perk(id).cost)
	p.perks.append(id)
	return null


static func respec_cost(p: Dictionary) -> int:
	return int(round((50 + int(p.level) * 10) * pow(1.5, int(p.respecs))))


static func respec(p: Dictionary) -> Variant:
	if p.perks.is_empty():
		return I18n.t("err.nothingRespec")
	var cost := respec_cost(p)
	if int(p.coins) < cost:
		return I18n.t("err.noCoins")
	p.coins = int(p.coins) - cost
	var back := 0
	for id in p.perks:
		back += int(Stats.perk(id).get("cost", 0))
	p.skillPoints = int(p.skillPoints) + back
	p.perks = []
	p.respecs = int(p.respecs) + 1
	return null


static func allocate(p: Dictionary, alloc: Dictionary) -> Variant:
	var total := 0
	var mx := int(Data.constant("MAX_ATTRIBUTE"))
	for k in Stats.ATTR_KEYS:
		var v := int(alloc.get(k, 0))
		if v < 0:
			return I18n.t("err.badAlloc")
		if int(p.baseAttributes[k]) + int(p.trainedBonus[k]) + v > mx:
			return I18n.t("err.attrMax")
		total += v
	if total == 0:
		return I18n.t("err.noPoints")
	if total > int(p.unspentPoints):
		return I18n.t("err.notEnoughPoints")
	for k in Stats.ATTR_KEYS:
		p.baseAttributes[k] = int(p.baseAttributes[k]) + int(alloc.get(k, 0))
	p.unspentPoints = int(p.unspentPoints) - total
	return null
