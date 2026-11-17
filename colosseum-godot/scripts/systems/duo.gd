class_name Duo
## Amizade e lutas de dupla simultâneas (DuoSystem.ts).

const FRIEND_RESPECT := 100
const RESPECT_FIRST_WIN := 40
const RESPECT_REMATCH_WIN := 20
const RESPECT_DUO := 10
const ENERGY := 35
const FROM_DAY := 9
const WEEKDAYS := [2, 4]


static func respect_of(p: Dictionary, id: String) -> int:
	return int(p.career.respect.get(id, 0))


static func add_respect(p: Dictionary, id: String, n: int) -> bool:
	if not p.defeatedOpponents.has(id) or RivalTown.is_hater(id):
		return false
	var before := respect_of(p, id)
	p.career.respect[id] = mini(100, before + n)
	return before < FRIEND_RESPECT and int(p.career.respect[id]) >= FRIEND_RESPECT


static func friends(p: Dictionary) -> Array:
	var out := []
	for id in p.career.respect:
		if respect_of(p, id) >= FRIEND_RESPECT and not RivalTown.is_hater(id) and not Data.opponent(id).is_empty():
			out.append(Data.opponent(id))
	return out


static func set_partner(p: Dictionary, id: String) -> bool:
	if not friends(p).any(func(f): return f.id == id):
		return false
	p.career.partner = id
	return true


static func partner_def(p: Dictionary) -> Variant:
	var pid = p.career.get("partner")
	if pid == null or RivalTown.is_hater(pid):
		return null
	var base := Data.opponent(pid)
	if base.is_empty():
		return null
	return Fighters.with_level(base, maxi(int(base.level), int(p.level) - 1))


static func unlocked(p: Dictionary) -> bool:
	return int(p.day) >= FROM_DAY


static func is_duo_day(day: int) -> bool:
	return WEEKDAYS.has(Calendar.weekday_index(day))


static func check(p: Dictionary) -> Variant:
	if not unlocked(p):
		return "locked"
	if not is_duo_day(int(p.day)):
		return "notToday"
	if partner_def(p) == null:
		return "noPartner"
	if int(p.career.duoDay) == int(p.day):
		return "done"
	return null


static func foes(p: Dictionary) -> Array:
	var rng := Rng.new(Fighters.day_seed(int(p.createdAt), int(p.day), 130))
	var two := Fighters.shuffle(rng, Data.d.pool).slice(0, 2)
	return [Fighters.pool_opponent(two[0], int(p.level)), Fighters.pool_opponent(two[1], maxi(1, int(p.level) - 1 + (1 if rng.next() < 0.5 else 0)))]


static func new_run() -> Dictionary:
	return {"ours": [null, null], "theirs": [null, null], "a": 0, "b": 0, "bouts": 0, "playerOut": false}


static func clash(run: Dictionary, front: Dictionary, back: Dictionary) -> String:
	run.bouts = 1
	run.ours = [front.hp[0] if int(front.winner) == 0 else 0, back.hp[0] if int(back.winner) == 0 else 0]
	run.theirs = [front.hp[1] if int(front.winner) == 1 else 0, back.hp[1] if int(back.winner) == 1 else 0]
	run.playerOut = float(run.ours[0]) == 0
	var ours: int = run.ours.filter(func(h): return float(h) > 0).size()
	if ours == 2:
		return "win"
	if ours == 0:
		return "loss"
	run.a = 1 if run.playerOut else 0
	run.b = 0 if float(run.theirs[0]) > 0 else 1
	return "decider"


static func decider(run: Dictionary, winner: int) -> String:
	run.bouts = 2
	return "win" if winner == 0 else "loss"


static func prize(p: Dictionary, won: bool) -> Dictionary:
	var l := int(p.level)
	return {"coins": 90 + l * 14, "fame": 10 + l / 2, "xp": 50 + l * 9} if won else {"coins": 15 + l * 2, "fame": 0, "xp": 15 + l * 3}
