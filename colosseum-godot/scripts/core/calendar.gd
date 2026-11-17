class_name Calendar
## Relógio do jogo, horários dos locais e deslocamentos (mesmas regras da versão TS).

const WAKE_TIME := 7 * 60
const MAX_ENERGY := 100
const TRAVEL_MINUTES := 20
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


## Pode viajar? (null = pode; senão, o motivo)
static func can_travel(p: Dictionary, to: String) -> Variant:
	if to == p.location:
		return I18n.t("cal.alreadyHere")
	if to == "home":
		return I18n.t("cal.tooLateShort") if int(p.minutes) + TRAVEL_MINUTES > DAY_END + 120 else null
	if int(p.minutes) + TRAVEL_MINUTES > DAY_END:
		return I18n.t("cal.tooLate")
	return null


static func advance(p: Dictionary, minutes: int) -> void:
	p.minutes = mini(DAY_END + 120, int(p.minutes) + maxi(0, minutes))


static func travel(p: Dictionary, to: String) -> Variant:
	var err = can_travel(p, to)
	if err != null:
		return err
	advance(p, TRAVEL_MINUTES)
	p.location = to
	return null
