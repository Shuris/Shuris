class_name Crowd
## Favor da plateia e o polegar no fim da luta (CrowdSystem.ts).

const FAVOR_START := 50.0
const THUMB_UP := 60.0
const THUMB_DOWN := 30.0


static func after(favor: float, e: Dictionary) -> float:
	var d := 0.0
	match e.type:
		"impact":
			var mine: bool = int(e.side) == 0
			if e.outcome == "hit":
				if mine:
					d = 2 + (6 if e.crit else 0) + (4 if e.kind == "power_strike" else 0) + (5 if e.kind == "counter" else 0) + (2 if e.stagger else 0)
				else:
					d = -(1.5 + (3 if e.crit else 0))
			elif e.outcome == "dodge":
				d = -1.0 if mine else 4.0
			elif e.outcome == "block":
				d = -0.5 if mine else 1.5
			elif e.outcome == "miss":
				d = -1.0 if mine else 1.0
		"skill":
			if int(e.side) == 0:
				d = 2
		"secondWind":
			if int(e.side) == 0:
				d = 6
		"exhausted":
			d = -3.0 if int(e.side) == 0 else 2.0
		"end":
			if e.reason == "ko":
				d = 10.0 if int(e.winner) == 0 else -4.0
			if e.reason == "forfeit" and int(e.winner) == 1:
				d = -25
	return clampf(favor + d, 0, 100)


static func thumb(favor: float) -> String:
	return "up" if favor >= THUMB_UP else ("down" if favor < THUMB_DOWN else "none")


static func fame(favor: float, won: bool) -> int:
	var th := thumb(favor)
	if won:
		return int(round((favor - 40) / 6)) if th == "up" else 0
	return -3 if th == "down" else 0


static func spared(favor: float, won: bool) -> bool:
	return not won and thumb(favor) == "up"
