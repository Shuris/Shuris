class_name Names
## Nomes e descrições dos dados no idioma atual (i18n/data.ts da versão TypeScript).

static var champion_beaten := false


static func _en() -> bool:
	return I18n.lang == "en"


static func _en_tab(tab: String) -> Dictionary:
	return Data.d.en.get(tab, {})


static func item_name(it: Dictionary) -> String:
	if _en() and _en_tab("EN_ITEMS").has(it.id):
		return _en_tab("EN_ITEMS")[it.id].name
	return str(it.get("name", it.get("id", "")))


static func item_desc(it: Dictionary) -> String:
	if _en() and _en_tab("EN_ITEMS").has(it.id):
		return _en_tab("EN_ITEMS")[it.id].description
	return str(it.get("description", ""))


static func opponent_epithet(o: Dictionary) -> String:
	if o.get("id") == "flamma" and champion_beaten:
		return ""
	if o.get("beast") != null:
		return I18n.t("beast.%s.ep" % o.beast)
	if o.get("cls") != null:
		return I18n.t("class.%s.ep" % o.cls)
	if _en() and _en_tab("EN_OPPONENTS").has(o.id):
		return _en_tab("EN_OPPONENTS")[o.id].epithet
	return str(o.get("epithet", ""))


static func opponent_full(o: Dictionary) -> String:
	if o.get("beast") != null:
		return "%s, %s" % [I18n.t("beast.%s.name" % o.beast), opponent_epithet(o)]
	var ep := opponent_epithet(o)
	return "%s, %s" % [o.name, ep] if ep != "" else str(o.name)


static func opponent_short(o: Dictionary) -> String:
	return I18n.t("beast.%s.name" % o.beast) if o.get("beast") != null else str(o.name)


static func opponent_desc(o: Dictionary) -> String:
	if o.get("beast") != null:
		return I18n.t("beast.%s.desc" % o.beast)
	if o.get("cls") != null:
		return I18n.t("class.%s.desc" % o.cls)
	if _en() and _en_tab("EN_OPPONENTS").has(o.id):
		return _en_tab("EN_OPPONENTS")[o.id].description
	return str(o.get("description", ""))


static func skill_name(id: String) -> String:
	return _en_tab("EN_SKILLS")[id].name if _en() else Data.d.skills[id].name


static func skill_desc(id: String) -> String:
	return _en_tab("EN_SKILLS")[id].description if _en() else Data.d.skills[id].description


static func move_name(skill: String, beast = null) -> String:
	if beast != null:
		var t := I18n.tk("beast.%s.%s" % [beast, skill], {}, "")
		if t != "":
			return t
	return skill_name(skill)


static func strategy_name(id: String) -> String:
	return _en_tab("EN_STRATEGIES")[id].name if _en() else Data.d.strategies[id].name


static func strategy_desc(id: String) -> String:
	return _en_tab("EN_STRATEGIES")[id].description if _en() else Data.d.strategies[id].description


static func perk_name(pk: Dictionary) -> String:
	return _en_tab("EN_PERKS")[pk.id].name if _en() and _en_tab("EN_PERKS").has(pk.id) else str(pk.name)


static func perk_short(pk: Dictionary) -> String:
	return _en_tab("EN_PERKS")[pk.id].short if _en() and _en_tab("EN_PERKS").has(pk.id) else str(pk.short)


static func branch_name(b: String) -> String:
	return _en_tab("EN_BRANCHES")[b].name if _en() else Data.d.branches[b].name


static func branch_subtitle(b: String) -> String:
	return _en_tab("EN_BRANCHES")[b].subtitle if _en() else Data.d.branches[b].subtitle


static func arena_name(id: String) -> String:
	for a in Data.d.arenas:
		if a.id == id:
			return _en_tab("EN_ARENAS").get(id, a.name) if _en() else str(a.name)
	return id


static func training_name(id: String) -> String:
	if _en():
		return _en_tab("EN_TRAININGS")[id].name
	for t in Data.d.trainings:
		if t.id == id:
			return t.name
	return id


static func training_desc(id: String) -> String:
	if _en():
		return _en_tab("EN_TRAININGS")[id].description
	for t in Data.d.trainings:
		if t.id == id:
			return t.description
	return ""


static func rarity_label(r: String) -> String:
	return _en_tab("EN_RARITY")[r] if _en() else Data.d.rarityLabel[r]


static func attr_short(k: String) -> String:
	return _en_tab("EN_ATTRIBUTES")[k].short if _en() else Data.d.attributes[k].short


static func attr_desc(k: String) -> String:
	return _en_tab("EN_ATTRIBUTES")[k].description if _en() else Data.d.attributes[k].description
