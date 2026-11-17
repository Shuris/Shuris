class_name Tavern
## Taverna: refeição, rodada de vinho com boatos (TavernSystem.ts).

const MEAL_ENERGY := 15
const MEAL_MINUTES := 30
const RUMOR_MINUTES := 45
const RUMOR_COST := 5


static func meal_cost(p: Dictionary) -> int:
	return 6 + int(p.level)


static func _open(p: Dictionary, minutes: int) -> Variant:
	if not Calendar.is_open(Data.location("tavern"), int(p.minutes), int(p.day)):
		return I18n.t("tavern.closed")
	if int(p.minutes) + minutes > Calendar.DAY_END:
		return I18n.t("cal.tooLate")
	return null


static func can_eat(p: Dictionary) -> Variant:
	var c = _open(p, MEAL_MINUTES)
	if c != null:
		return c
	if int(p.energy) >= Calendar.MAX_ENERGY:
		return I18n.t("cal.rested")
	if int(p.coins) < meal_cost(p):
		return I18n.t("err.noCoins")
	return null


static func eat(p: Dictionary) -> Variant:
	var err = can_eat(p)
	if err != null:
		return err
	p.coins = int(p.coins) - meal_cost(p)
	p.energy = mini(Calendar.MAX_ENERGY, int(p.energy) + MEAL_ENERGY)
	Calendar.advance(p, MEAL_MINUTES)
	return null


static func can_hear_rumor(p: Dictionary) -> Variant:
	var c = _open(p, RUMOR_MINUTES)
	if c != null:
		return c
	if int(p.tavern.rumorDay) == int(p.day):
		return I18n.t("tavern.rumorDone")
	if int(p.coins) < RUMOR_COST:
		return I18n.t("err.noCoins")
	return null


static func hear_rumor(p: Dictionary, rng: Rng) -> Dictionary:
	var err = can_hear_rumor(p)
	var rival := News.next_rival(p)
	if err != null:
		return {"error": err, "rivalId": rival.id, "fame": 0}
	p.coins = int(p.coins) - RUMOR_COST
	p.tavern.rumorDay = p.day
	if not p.tavern.heard.has(rival.id):
		p.tavern.heard.append(rival.id)
	p.reputation = int(p.reputation) + 1
	Calendar.advance(p, RUMOR_MINUTES)
	News.on_tavern_talk(p, rng)
	return {"error": null, "rivalId": rival.id, "fame": 1}
