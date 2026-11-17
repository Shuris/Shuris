class_name Calendar
## Relógio do jogo, horários, energia, deslocamentos, sono e termas (CalendarSystem.ts).

const WAKE_TIME := 7 * 60
const MAX_ENERGY := 100
const FIGHT_ENERGY := 35
const FIGHT_MINUTES := 120
const TRAIN_ENERGY := 12
const TRAIN_MINUTES := 60
const TRAIN_MINUTES_LEGEND := 40
const TRAVEL_MINUTES := 20
const NAP_MINUTES := 120
const NAP_ENERGY := 20
const BATHS_ENERGY := 40
const BATHS_MINUTES := 60
const DAY_END := 24 * 60


static func weekday_index(day: int) -> int:
	return posmod(day, 7)


static func weekday_name(day: int) -> String:
	return I18n.t("wd.%d" % weekday_index(day))


static func is_open(loc: Dictionary, minutes: int, day: int = 1) -> bool:
	if loc.get("closedSunday", false) and weekday_index(day) == 0:
		return false
	var h = loc.get("hours")
	if h == null:
		return true
	return minutes >= int(h[0]) and minutes < int(h[1])


static func hours_label(loc: Dictionary, day: int = 1) -> String:
	if loc.get("closedSunday", false) and weekday_index(day) == 0:
		return I18n.t("hours.closedSunday")
	var h = loc.get("hours")
	if h == null:
		return I18n.t("hours.always")
	var a := I18n.t("hours.h", {"n": int(h[0]) / 60})
	var b := I18n.t("hours.h", {"n": int(h[1]) / 60})
	return "%s–%s%s" % [a, b, I18n.t("hours.exceptSunday") if loc.get("closedSunday", false) else ""]


static func day_fraction(minutes: int) -> float:
	return float(posmod(minutes, 1440)) / 1440.0


static func phase_name(f: float) -> String:
	if f < 0.22:
		return I18n.t("phase.night")
	if f < 0.3:
		return I18n.t("phase.dawn")
	if f < 0.5:
		return I18n.t("phase.morning")
	if f < 0.72:
		return I18n.t("phase.afternoon")
	if f < 0.8:
		return I18n.t("phase.dusk")
	return I18n.t("phase.night")


static func clock_label(minutes: int) -> String:
	var m := posmod(minutes, 1440)
	return "%02d:%02d" % [m / 60, m % 60]


static func train_energy(p: Dictionary) -> int:
	return TRAIN_ENERGY - Upgrades.train_energy_cut(p)


static func train_minutes(p: Dictionary) -> int:
	return TRAIN_MINUTES_LEGEND if p.upgrades.has("doctore_legend") else TRAIN_MINUTES


static func nap_energy(p: Dictionary) -> int:
	return NAP_ENERGY + Upgrades.nap_bonus(p)


static func _time_left(p: Dictionary, minutes: int) -> Variant:
	if int(p.minutes) + minutes > DAY_END:
		return I18n.t("cal.tooLate")
	return null


static func can_fight(p: Dictionary) -> Variant:
	if not is_open(Data.location("arena"), int(p.minutes), int(p.day)):
		return I18n.t("cal.arenaClosed")
	if int(p.energy) < FIGHT_ENERGY:
		return I18n.t("cal.noEnergyFight", {"n": FIGHT_ENERGY})
	return _time_left(p, FIGHT_MINUTES)


static func can_train(p: Dictionary) -> Variant:
	if not is_open(Data.location("ludus"), int(p.minutes), int(p.day)):
		return I18n.t("cal.ludusClosed")
	if int(p.energy) < train_energy(p):
		return I18n.t("cal.tooTired")
	return _time_left(p, train_minutes(p))


static func can_travel(p: Dictionary, to: String) -> Variant:
	if to == p.location:
		return I18n.t("cal.alreadyHere")
	if to == "home":
		return I18n.t("cal.tooLateShort") if int(p.minutes) + TRAVEL_MINUTES > DAY_END + 120 else null
	return _time_left(p, TRAVEL_MINUTES)


static func advance(p: Dictionary, minutes: float) -> void:
	p.minutes = mini(DAY_END + 120, int(p.minutes) + maxi(0, int(round(minutes))))


static func spend_energy(p: Dictionary, amount: int) -> void:
	p.energy = clampi(int(p.energy) - amount, 0, MAX_ENERGY)


static func travel(p: Dictionary, to: String) -> Variant:
	var err = can_travel(p, to)
	if err != null:
		return err
	advance(p, TRAVEL_MINUTES)
	p.location = to
	return null


static func apply_fight(p: Dictionary) -> void:
	spend_energy(p, FIGHT_ENERGY)
	advance(p, FIGHT_MINUTES)


static func apply_training(p: Dictionary) -> void:
	spend_energy(p, train_energy(p))
	advance(p, train_minutes(p))


static func can_trade(p: Dictionary) -> Variant:
	var market := Data.location("market")
	if is_open(market, int(p.minutes), int(p.day)):
		return null
	if weekday_index(int(p.day)) == 0:
		return I18n.t("cal.marketSunday")
	return I18n.t("cal.marketClosed", {"hours": hours_label(market, int(p.day))})


static func can_nap(p: Dictionary) -> Variant:
	if int(p.energy) >= MAX_ENERGY:
		return I18n.t("cal.rested")
	return _time_left(p, NAP_MINUTES)


static func nap(p: Dictionary) -> Variant:
	var err = can_nap(p)
	if err != null:
		return err
	advance(p, NAP_MINUTES)
	p.energy = mini(MAX_ENERGY, int(p.energy) + nap_energy(p))
	return null


static func baths_cost(p: Dictionary) -> int:
	return 15 + int(p.level) * 3


static func can_bathe(p: Dictionary) -> Variant:
	if not is_open(Data.location("baths"), int(p.minutes), int(p.day)):
		return I18n.t("cal.bathsClosed")
	if int(p.energy) >= MAX_ENERGY and p.get("injury") == null:
		return I18n.t("cal.rested")
	if int(p.coins) < baths_cost(p):
		return I18n.t("err.noCoins")
	return _time_left(p, BATHS_MINUTES)


static func bathe(p: Dictionary) -> Variant:
	var err = can_bathe(p)
	if err != null:
		return err
	p.coins = int(p.coins) - baths_cost(p)
	advance(p, BATHS_MINUTES)
	p.energy = mini(MAX_ENERGY, int(p.energy) + BATHS_ENERGY)
	heal_injury_day(p)
	return null


static func sleep(p: Dictionary) -> void:
	p.day = int(p.day) + 1
	p.minutes = WAKE_TIME
	p.energy = MAX_ENERGY
	p.location = "home"
	heal_injury_day(p)


static func heal_injury_day(p: Dictionary) -> void:
	if p.get("injury") == null:
		return
	p.injury.days = int(p.injury.days) - 1
	if int(p.injury.days) <= 0:
		p.injury = null
