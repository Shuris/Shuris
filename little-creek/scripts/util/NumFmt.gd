class_name NumFmt
extends RefCounted
## Compact number formatting for the HUD (1.2K, 3.4M...).


static func short(v: float) -> String:
	var a := absf(v)
	if a < 1000.0:
		return str(int(floorf(v))) if a >= 100.0 or is_equal_approx(v, roundf(v)) else ("%.1f" % v).trim_suffix(".0")
	var units := ["K", "M", "B", "T"]
	var i := -1
	while a >= 1000.0 and i < units.size() - 1:
		a /= 1000.0
		i += 1
	var s := ("%.1f" % a) if a < 100.0 else str(int(a))
	return s.trim_suffix(".0") + units[i]


static func rate(v: float) -> String:
	if v < 1.0:
		return "%.2f/s" % v
	if v < 10.0:
		return "%.1f/s" % v
	return short(v) + "/s"


static func duration(seconds: float) -> String:
	var s := int(seconds)
	var h := s / 3600
	var m := (s % 3600) / 60
	if h > 0:
		return "%dh %02dmin" % [h, m]
	return "%d min" % max(m, 1)
