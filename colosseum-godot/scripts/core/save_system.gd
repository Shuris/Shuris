class_name SaveSystem
## Formato do save idêntico ao da versão Electron ({format, version, savedAt, player}),
## para que os saves atuais abram aqui e vice-versa. Campos desconhecidos são mantidos.

const FORMAT := "colosseum-save"
const SLOTS := [1, 2, 3]


static func serialize(p: Dictionary, now_ms: int) -> String:
	p.updatedAt = now_ms
	return JSON.stringify({"format": FORMAT, "version": PlayerFactory.SAVE_VERSION, "savedAt": now_ms, "player": p})


## {ok: true, player} ou {ok: false, error}
static func parse(text: String) -> Dictionary:
	if text.is_empty():
		return {"ok": false, "error": I18n.t("save.none")}
	var raw = JSON.parse_string(text)
	if typeof(raw) != TYPE_DICTIONARY or raw.get("format") != FORMAT or typeof(raw.get("player")) != TYPE_DICTIONARY:
		return {"ok": false, "error": I18n.t("save.unknown") if raw != null else I18n.t("save.corrupt")}
	if typeof(raw.get("version")) != TYPE_FLOAT and typeof(raw.get("version")) != TYPE_INT or float(raw.version) > PlayerFactory.SAVE_VERSION:
		return {"ok": false, "error": I18n.t("save.newer")}
	return validate(raw.player)


## Completa o que faltar (saves antigos) e corrige valores fora do lugar.
static func validate(src: Dictionary) -> Dictionary:
	var name := PlayerFactory.sanitize_name(str(src.get("name", "")))
	if name.length() < 2:
		return {"ok": false, "error": I18n.t("save.badName")}
	var tpl := PlayerFactory.create(name, str(src.get("origin", "gaul")), {"skin": 0, "hairStyle": 0, "hairColor": 0, "beard": false, "clothColor": 0}, int(src.get("createdAt", 0)))
	var p: Dictionary = _merge(tpl, src)
	p.name = name
	p.version = PlayerFactory.SAVE_VERSION
	# números com limites (JSON traz floats: volta para inteiro)
	p.level = clampi(int(p.level), 1, int(Data.constant("MAX_LEVEL")))
	for k in ["xp", "coins", "reputation", "unspentPoints", "skillPoints", "respecs", "streak", "nextUid", "lastRematchDay"]:
		p[k] = maxi(0, int(p[k]))
	p.day = maxi(1, int(p.day))
	p.minutes = clampi(int(p.minutes), 0, Calendar.DAY_END + 120)
	p.energy = clampi(int(p.energy), 0, Calendar.MAX_ENERGY)
	var a: Dictionary = p.appearance
	a.skin = clampi(int(a.get("skin", 0)), 0, 4)
	a.hairStyle = clampi(int(a.get("hairStyle", 0)), 0, 6)
	a.hairColor = clampi(int(a.get("hairColor", 0)), 0, Data.d.hairColors.size() - 1)
	a.clothColor = clampi(int(a.get("clothColor", 0)), 0, Data.d.clothColors.size() - 1)
	a.beard = bool(a.get("beard", false))
	for k in PlayerFactory.ATTR_KEYS:
		p.baseAttributes[k] = clampi(int(p.baseAttributes.get(k, 5)), 1, int(Data.constant("MAX_ATTRIBUTE")))
		p.trainedBonus[k] = clampi(int(p.trainedBonus.get(k, 0)), 0, int(Data.constant("MAX_ATTRIBUTE")))
	if not Data.location(str(p.location)).id == p.location:
		p.location = "home"
	# inventário: só itens que existem; equipamento só aponta para itens do inventário
	var inv: Array = []
	var seen := {}
	for it in p.inventory:
		if typeof(it) == TYPE_DICTIONARY and it.has("uid") and not Data.item(str(it.get("itemId", ""))).is_empty() and not seen.has(it.uid):
			seen[it.uid] = true
			inv.append(it)
	p.inventory = inv
	for slot in ["mainHand", "offHand", "head", "body", "legs"]:
		var uid = p.equipment.get(slot)
		var ok := false
		if typeof(uid) == TYPE_STRING:
			for it in inv:
				if it.uid == uid and Data.item(it.itemId).get("slot") == slot:
					ok = true
		if not ok:
			p.equipment[slot] = null
	return {"ok": true, "player": p}


## Mescla profunda: valores do save por cima do modelo; listas e campos novos do save ficam.
static func _merge(tpl: Dictionary, src: Dictionary) -> Dictionary:
	var out := tpl.duplicate(true)
	for k in src:
		var v = src[k]
		if out.has(k) and typeof(out[k]) == TYPE_DICTIONARY and typeof(v) == TYPE_DICTIONARY and k != "rivals" and k != "respect" and k != "chatDays":
			out[k] = _merge(out[k], v)
		elif out.has(k) and out[k] != null and v != null and typeof(out[k]) != typeof(v) and not (_is_num(out[k]) and _is_num(v)):
			continue  # tipo errado: fica o valor padrão
		else:
			out[k] = v
	return out


static func _is_num(v) -> bool:
	return typeof(v) == TYPE_INT or typeof(v) == TYPE_FLOAT
