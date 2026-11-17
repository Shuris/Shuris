class_name Events
## Eventos da cidade: festival, mercador viajante e queda de braço (EventSystem.ts).

const FESTIVAL_EVERY := 14
const FESTIVAL_OFFSET := 10
const FESTIVAL_FAME_MUL := 2
const ARM_START := 19 * 60
const ARM_END := 23 * 60
const ARM_ENERGY := 10
const ARM_MINUTES := 30


static func is_festival(day: int) -> bool:
	return day % FESTIVAL_EVERY == FESTIVAL_OFFSET


static func next_festival(day: int) -> int:
	var d := day
	while not is_festival(d):
		d += 1
	return d


static func merchant_days(seed: int, up_to: int) -> Array:
	var rng := Rng.new(((seed & 0xFFFFFFFF) ^ 0x6d657263) & 0xFFFFFFFF)
	var out := []
	var d := 4 + int(floor(rng.next() * 3))
	while d <= up_to:
		var visit := d + 1 if Calendar.weekday_index(d) == 0 else d
		out.append(visit)
		d = visit + 6 + int(floor(rng.next() * 5))
	return out


static func is_merchant_day(seed: int, day: int) -> bool:
	return merchant_days(seed, day + 1).has(day)


static func next_merchant_day(seed: int, day: int) -> int:
	for d in merchant_days(seed, day + 12):
		if d >= day:
			return d
	return day + 10


static func merchant_here(p: Dictionary) -> bool:
	return is_merchant_day(int(p.createdAt), int(p.day)) and Calendar.is_open(Data.location("market"), int(p.minutes), int(p.day))


static func merchant_stock(seed: int, day: int, level: int) -> Array:
	var rng := Rng.new(Fighters.day_seed(seed, day, 7))
	var items: Array = Data.d.items
	var exotic: Array = items.filter(func(i): return not i.shop and i.id != "rudis" and int(i.minLevel) <= level + 6)
	var shop: Array = items.filter(func(i): return i.shop and int(i.minLevel) <= level + 3 and i.rarity != "common")
	var offers := []
	var used := {}
	var take := func(pool: Array, ex: bool):
		var free: Array = pool.filter(func(i): return not used.has(i.id))
		if free.is_empty():
			return
		var item: Dictionary = rng.pick(free)
		used[item.id] = true
		offers.append({"item": item, "exotic": ex, "price": int(round(float(item.price) * (1.1 if ex else 0.75)))})
	take.call(exotic if exotic.size() > 0 else shop, true)
	take.call(exotic if exotic.size() > 1 else shop, true)
	take.call(shop, false)
	return offers


static func can_buy_from_merchant(p: Dictionary, item_id: String) -> Variant:
	if not merchant_here(p):
		return I18n.t("event.merchantGone")
	var offer = null
	for o in merchant_stock(int(p.createdAt), int(p.day), int(p.level)):
		if o.item.id == item_id:
			offer = o
	if offer == null:
		return I18n.t("err.noItem")
	if int(p.events.merchantDay) == int(p.day) and p.events.merchantBought.has(item_id):
		return I18n.t("event.soldOut")
	if int(p.level) < int(offer.item.minLevel):
		return I18n.t("err.needLevel", {"n": offer.item.minLevel})
	if int(p.coins) < int(offer.price):
		return I18n.t("err.noCoins")
	if p.inventory.size() >= 40:
		return I18n.t("err.invFull")
	return null


static func buy_from_merchant(p: Dictionary, item_id: String) -> Variant:
	var err = can_buy_from_merchant(p, item_id)
	if err != null:
		return err
	var offer = null
	for o in merchant_stock(int(p.createdAt), int(p.day), int(p.level)):
		if o.item.id == item_id:
			offer = o
	if int(p.events.merchantDay) != int(p.day):
		p.events.merchantDay = p.day
		p.events.merchantBought = []
	p.events.merchantBought.append(item_id)
	p.coins = int(p.coins) - int(offer.price)
	Equip.add_item(p, item_id)
	return null


static func merchant_sold_out(p: Dictionary, item_id: String) -> bool:
	return int(p.events.merchantDay) == int(p.day) and p.events.merchantBought.has(item_id)


static func arm_fee(p: Dictionary) -> int:
	return 10 + int(p.level) * 2


static func arm_prize(p: Dictionary) -> int:
	return 30 + int(p.level) * 6


static func is_arm_night(day: int, minutes: int) -> bool:
	return Calendar.weekday_index(day) == 0 and minutes >= ARM_START and minutes < ARM_END


static func can_arm_wrestle(p: Dictionary) -> Variant:
	if Calendar.weekday_index(int(p.day)) != 0:
		return I18n.t("event.armSundayOnly")
	if int(p.minutes) < ARM_START or int(p.minutes) >= ARM_END:
		return I18n.t("event.armHours")
	if int(p.events.armDay) == int(p.day):
		return I18n.t("event.armDone")
	if int(p.energy) < ARM_ENERGY:
		return I18n.t("cal.tooTired")
	if int(p.coins) < arm_fee(p):
		return I18n.t("err.noCoins")
	if int(p.minutes) + ARM_MINUTES > Calendar.DAY_END:
		return I18n.t("cal.tooLate")
	return null


static func arm_setup(p: Dictionary) -> Dictionary:
	var str_ := int(Stats.final_attributes(Stats.natural_attributes(p), Stats.equipped_items(p)).str)
	var names := ["Pollux", "Gorgo", "Taurus", "Magnus", "Bubulcus"]
	return {"zone": minf(0.42, 0.16 + str_ * 0.006), "push": 10 + minf(8, str_ * 0.18),
		"pull": 9 + int(p.events.armWins) * 1.6 + minf(10, int(p.level) * 0.35), "champion": names[int(p.events.armWins) % names.size()]}


static func finish_arm_wrestle(p: Dictionary, won: bool) -> Dictionary:
	p.events.armDay = p.day
	p.coins = int(p.coins) - mini(int(p.coins), arm_fee(p))
	Calendar.spend_energy(p, ARM_ENERGY)
	Calendar.advance(p, ARM_MINUTES)
	if not won:
		return {"coins": 0, "fame": 0}
	p.events.armWins = int(p.events.armWins) + 1
	var coins := arm_prize(p)
	p.coins = int(p.coins) + coins
	p.reputation = int(p.reputation) + 3
	return {"coins": coins, "fame": 3}
