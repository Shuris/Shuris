class_name Rng
extends RefCounted
## Gerador pseudoaleatório mulberry32, idêntico ao da versão TypeScript (mesma semente,
## mesmos números): as lutas e os sorteios do dia dão o mesmo resultado nas duas versões.

const M32 := 0xFFFFFFFF
var a: int


func _init(seed: int) -> void:
	a = seed & M32


## Multiplicação de 32 bits (Math.imul), em pedaços de 16 bits para não estourar.
static func imul(x: int, y: int) -> int:
	x &= M32
	y &= M32
	var xl := x & 0xFFFF
	var xh := (x >> 16) & 0xFFFF
	var yl := y & 0xFFFF
	var yh := (y >> 16) & 0xFFFF
	return ((xl * yl) + ((((xh * yl) + (xl * yh)) & 0xFFFF) << 16)) & M32


func next() -> float:
	a = (a + 0x6d2b79f5) & M32
	var t := a
	t = imul(t ^ (t >> 15), t | 1)
	t = (t ^ ((t + imul(t ^ (t >> 7), t | 61)) & M32)) & M32
	return float((t ^ (t >> 14)) & M32) / 4294967296.0


static func random_seed() -> int:
	return randi() & M32


func pick(list: Array) -> Variant:
	return list[int(floor(next() * list.size())) % list.size()]
