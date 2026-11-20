class_name Palette
extends RefCounted
## Mirror of tools/art/palette.py ramps needed at runtime (shaders, UI).

const WATER := ["0f2429", "153e40", "1d4f55", "2b6a70", "3f8686", "5aa3a0", "7fc0b8", "a9dcd0", "d8f0e6", "f1f3e0"]
const WATER_MURKY := ["1f2318", "2c2f20", "3d4229", "545a36", "6e7445", "8a8c5a", "a8a678", "d6d2b0"]

const TEXT := Color("e9f0d8")
const TEXT_MUTED := Color("9fbb95")
const ACCENT := Color("c9da78")
const GOLD := Color("f2d35b")
const WARN := Color("e98a3b")
const WATER_UI := Color("7fc0b8")
const PANEL := Color("111d25")
const DARK := Color("0c1820")


static func vec3_ramp(hexes: Array) -> PackedVector3Array:
	var out := PackedVector3Array()
	for h in hexes:
		var c := Color(h)
		out.append(Vector3(c.r, c.g, c.b))
	return out
