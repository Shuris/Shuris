class_name SkyPainter
## Céu pixelado por trás dos cenários ao ar livre (os PNGs têm o céu transparente):
## faixas de cor que mudam com a hora, sol ou lua, estrelas à noite e nuvens.

static func colors(f: float) -> Array:
	# [topo, horizonte, tinta do mundo]
	if f < 0.22 or f >= 0.84:
		return [Color8(16, 18, 40), Color8(40, 46, 86), Color(0.42, 0.45, 0.72)]
	if f < 0.30:
		var k := (f - 0.22) / 0.08
		return [Color8(16, 18, 40).lerp(Color8(110, 130, 190), k), Color8(40, 46, 86).lerp(Color8(244, 170, 112), k), Color(0.42, 0.45, 0.72).lerp(Color(1.0, 0.9, 0.82), k)]
	if f < 0.38:
		var k := (f - 0.30) / 0.08
		return [Color8(110, 130, 190).lerp(Color8(118, 170, 222), k), Color8(244, 170, 112).lerp(Color8(214, 232, 240), k), Color(1.0, 0.9, 0.82).lerp(Color.WHITE, k)]
	if f < 0.70:
		return [Color8(118, 170, 222), Color8(214, 232, 240), Color.WHITE]
	if f < 0.78:
		var k := (f - 0.70) / 0.08
		return [Color8(118, 170, 222).lerp(Color8(92, 78, 140), k), Color8(214, 232, 240).lerp(Color8(240, 140, 84), k), Color.WHITE.lerp(Color(1.0, 0.8, 0.66), k)]
	var k := (f - 0.78) / 0.06
	return [Color8(92, 78, 140).lerp(Color8(16, 18, 40), k), Color8(240, 140, 84).lerp(Color8(40, 46, 86), k), Color(1.0, 0.8, 0.66).lerp(Color(0.42, 0.45, 0.72), k)]


## Imagem do céu (640x360) para a hora f (0..1 do dia).
static func image(f: float, w: int = 640, h: int = 360, horizon: int = 230) -> Image:
	var c := colors(f)
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	var bands := 9
	for y in h:
		var t := clampf(float(y) / horizon, 0.0, 1.0)
		for x in w:
			# faixas com retícula: degradê em degraus, como pixel art
			var th := (((x & 1) ^ (y & 1)) * 0.5 - 0.25) / bands
			var q := floorf(clampf(t + th, 0.0, 1.0) * bands) / bands
			img.set_pixel(x, y, (c[0] as Color).lerp(c[1], q))
	var night := f < 0.24 or f > 0.82
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	if night:
		for i in 90:
			var sx := rng.randi_range(0, w - 1)
			var sy := rng.randi_range(0, horizon - 40)
			img.set_pixel(sx, sy, Color8(230, 230, 255) if i % 5 else Color8(255, 240, 200))
	# sol (de dia) ou lua (à noite) atravessando o céu
	var arc := fposmod((f - 0.25) / 0.5, 2.0)
	var on_day := f >= 0.25 and f <= 0.75
	var u := (f - 0.25) / 0.5 if on_day else fposmod(f - 0.75, 1.0) / 0.5
	var cx := int(lerpf(40, w - 40, u))
	var cy := int(horizon - 40 - sin(u * PI) * (horizon - 90))
	var r := 9 if on_day else 7
	for yy in range(-r, r + 1):
		for xx in range(-r, r + 1):
			if xx * xx + yy * yy <= r * r and cx + xx >= 0 and cx + xx < w and cy + yy >= 0 and cy + yy < h:
				var col := Color8(255, 236, 170) if on_day else Color8(232, 232, 220)
				if not on_day and (xx + 3) * (xx + 3) + yy * yy < r * r * 0.6:
					col = Color8(200, 200, 196)
				img.set_pixel(cx + xx, cy + yy, col)
	# nuvens em blocos (3 tons), poucas
	var cloud := (c[1] as Color).lerp(Color.WHITE, 0.55)
	var shade := (c[1] as Color).lerp(c[0], 0.3).lerp(Color.WHITE, 0.3)
	for k in 5:
		var bx := rng.randi_range(0, w)
		var by := rng.randi_range(40, horizon - 70)
		for j in 7:
			var ox := bx + j * 9 + rng.randi_range(-3, 3)
			var oy := by + rng.randi_range(-4, 2)
			var rr := rng.randi_range(5, 9)
			for yy in range(-rr, rr / 2):
				for xx in range(-rr, rr + 1):
					if xx * xx + yy * yy * 2 <= rr * rr:
						var px := posmod(ox + xx, w)
						var py := oy + yy
						if py >= 0 and py < h:
							img.set_pixel(px, py, cloud if yy < 0 else shade)
	return img
