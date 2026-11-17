class_name Weather
## Clima do dia (sol, nublado ou chuva), estações e neblina (WeatherSystem.ts).

const RAIN_CHANCE := 0.25
const CLOUDY_CHANCE := 0.25
const SEASON_DAYS := 10
const SEASONS := ["spring", "summer", "autumn", "winter"]


static func of_day(seed: int, day: int) -> Dictionary:
	var rng := Rng.new(((seed & 0xFFFFFFFF) ^ Rng.imul(day + 1, 2654435761)) & 0xFFFFFFFF)
	var r := rng.next()
	var kind := "sun" if day <= 1 else ("rain" if r < RAIN_CHANCE else ("cloudy" if r < RAIN_CHANCE + CLOUDY_CHANCE else "sun"))
	return {"kind": kind, "rainy": kind == "rain", "start": 0, "end": 1440}


static func now(seed: int, day: int) -> Dictionary:
	var w := of_day(seed, day)
	if w.kind == "rain":
		return {"cloud": 1.0, "rain": 1.0}
	if w.kind == "cloudy":
		return {"cloud": 0.7, "rain": 0.0}
	return {"cloud": 0.0, "rain": 0.0}


static func label(n: Dictionary) -> String:
	if n.rain > 0.05:
		return I18n.t("weather.rain")
	if n.cloud > 0.3:
		return I18n.t("weather.cloudy")
	return ""


static func season_of(day: int) -> String:
	return SEASONS[((maxi(1, day) - 1) / SEASON_DAYS) % 4]


static func morning_fog(minutes: int, season: String) -> float:
	var m := posmod(minutes, 1440)
	var f := 0.0
	if m >= 300 and m < 360:
		f = (m - 300) / 60.0
	elif m >= 360 and m < 480:
		f = 1.0
	elif m >= 480 and m < 600:
		f = 1 - (m - 480) / 120.0
	var k := 0.45 if season == "summer" else (1.0 if season == "autumn" or season == "winter" else 0.75)
	return f * k
