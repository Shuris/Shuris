class_name Equip
## Comprar, equipar, tirar e vender itens; ferreiro (EquipmentSystem.ts, ForgeSystem.ts).

static func add_item(p: Dictionary, item_id: String) -> Dictionary:
	var inv := {"uid": "i%d" % int(p.nextUid), "itemId": item_id}
	p.nextUid = int(p.nextUid) + 1
	p.inventory.append(inv)
	return inv


static func is_equipped(p: Dictionary, uid: String) -> bool:
	return p.equipment.values().has(uid)


static func can_buy(p: Dictionary, item_id: String) -> Variant:
	var item := Data.item(item_id)
	if item.is_empty():
		return I18n.t("err.noItem")
	if not item.shop:
		return I18n.t("err.notForSale")
	if int(p.level) < int(item.minLevel):
		return I18n.t("err.needLevel", {"n": item.minLevel})
	if int(p.coins) < int(item.price):
		return I18n.t("err.noCoins")
	if p.inventory.size() >= 40:
		return I18n.t("err.invFull")
	return null


## {ok, message}
static func buy(p: Dictionary, item_id: String) -> Dictionary:
	var err = can_buy(p, item_id)
	if err != null:
		return {"ok": false, "message": err}
	var item := Data.item(item_id)
	p.coins = int(p.coins) - int(item.price)
	add_item(p, item_id)
	return {"ok": true, "message": I18n.t("market.bought", {"name": Names.item_name(item), "n": item.price})}


static func _inv(p: Dictionary, uid: String) -> Variant:
	for i in p.inventory:
		if i.uid == uid:
			return i
	return null


static func equip(p: Dictionary, uid: String) -> Dictionary:
	var inv = _inv(p, uid)
	var item := Data.item(inv.itemId) if inv != null else {}
	if inv == null or item.is_empty():
		return {"ok": false, "message": I18n.t("err.itemNotFound")}
	if int(p.level) < int(item.minLevel):
		return {"ok": false, "message": I18n.t("err.needLevel", {"n": item.minLevel})}
	p.equipment[item.slot] = uid
	return {"ok": true, "message": I18n.t("char.equipped", {"name": Names.item_name(item)})}


static func unequip(p: Dictionary, slot: String) -> Dictionary:
	if p.equipment.get(slot) == null:
		return {"ok": false, "message": I18n.t("err.slotEmpty")}
	p.equipment[slot] = null
	return {"ok": true, "message": I18n.t("char.unequipped")}


static func sell(p: Dictionary, uid: String) -> Dictionary:
	var inv = _inv(p, uid)
	if inv == null:
		return {"ok": false, "message": I18n.t("err.itemNotFound")}
	if is_equipped(p, uid):
		return {"ok": false, "message": I18n.t("err.unequipFirst")}
	var item := Data.item(inv.itemId)
	if item.is_empty():
		return {"ok": false, "message": I18n.t("err.itemInvalid")}
	var price := Stats.sell_price(item, int(inv.get("plus", 0)))
	p.inventory.erase(inv)
	p.coins = int(p.coins) + price
	return {"ok": true, "message": I18n.t("market.sold", {"name": Names.item_name(item), "n": price})}


const FORGE_MINUTES := 30


static func can_forge(p: Dictionary, uid: String) -> Variant:
	var closed = Calendar.can_trade(p)
	if closed != null:
		return closed
	var inv = _inv(p, uid)
	var item := Data.item(inv.itemId) if inv != null else {}
	if inv == null or item.is_empty():
		return I18n.t("err.itemNotFound")
	if item.id == "rudis":
		return I18n.t("forge.noWood")
	var plus := int(inv.get("plus", 0))
	if plus >= Stats.MAX_PLUS:
		return I18n.t("forge.max")
	if int(p.level) < Stats.forge_level(item, plus):
		return I18n.t("err.needLevel", {"n": Stats.forge_level(item, plus)})
	if int(p.coins) < Stats.forge_cost(item, plus):
		return I18n.t("err.noCoins")
	if int(p.minutes) + FORGE_MINUTES > Calendar.DAY_END:
		return I18n.t("cal.tooLate")
	return null


static func forge(p: Dictionary, uid: String) -> Dictionary:
	var err = can_forge(p, uid)
	var inv = _inv(p, uid)
	if err != null or inv == null:
		return {"error": err if err != null else I18n.t("err.itemNotFound"), "plus": 0, "name": ""}
	var item := Data.item(inv.itemId)
	var plus := int(inv.get("plus", 0))
	p.coins = int(p.coins) - Stats.forge_cost(item, plus)
	inv.plus = plus + 1
	Calendar.advance(p, FORGE_MINUTES)
	return {"error": null, "plus": inv.plus, "name": Names.item_name(item)}
