class_name Ranking
## Ranking da cidade (RankingSystem.ts).

const WIN := 3
const LOSS := -1
const FIELD := 16
const CHAMPION_ID := "flamma"
const CHAMPION_RECORD := {"w": 214, "l": 11}


static func points(w: int, l: int) -> int:
	return maxi(0, w * WIN + l * LOSS)


static func seed_table(p: Dictionary) -> Array:
	var rng := Rng.new(Fighters.day_seed(int(p.createdAt), 1, 120))
	var entries := []
	for o in Data.d.opponents:
		entries.append({"id": o.id, "level": int(o.level)})
	for f in Fighters.shuffle(rng, Data.d.pool).slice(0, maxi(0, FIELD - entries.size())):
		entries.append({"id": f.id, "level": maxi(1, int(round(2 + rng.next() * 10)))})
	var out := []
	for e in entries:
		var w: int
		var l: int
		if e.id == CHAMPION_ID:
			w = CHAMPION_RECORD.w
			l = CHAMPION_RECORD.l
		else:
			w = int(round(e.level * (3.2 + rng.next() * 1.2)))
			l = int(round(e.level * (0.6 + rng.next() * 0.5)))
		out.append({"id": e.id, "level": e.level, "pts": points(w, l), "w": w, "l": l, "prev": 0})
	return out


static func _def_of(e: Dictionary) -> Variant:
	var o := Data.opponent(e.id)
	if not o.is_empty():
		return o
	var f := Fighters.pool_fighter(e.id)
	return Fighters.pool_opponent(f, int(e.level)) if not f.is_empty() else null


static func ensure(p: Dictionary) -> void:
	if p.career.rank.is_empty() or not p.career.rank.any(func(e): return e.id == CHAMPION_ID):
		p.career.rank = seed_table(p)
		p.career.rankDay = p.day


static func table(p: Dictionary) -> Array:
	ensure(p)
	var rows := []
	for e in p.career.rank:
		var r: Dictionary = e.duplicate()
		r.pts = points(int(e.w), int(e.l))
		r.pos = 0
		r.player = false
		rows.append(r)
	rows.append({"id": "player", "level": p.level, "pts": points(int(p.stats.wins), int(p.stats.losses)), "w": int(p.stats.wins), "l": int(p.stats.losses), "pos": 0, "prev": int(p.career.rankPrev), "player": true})
	rows = Stats.stable_sort(rows, func(a, b):
		if int(a.pts) != int(b.pts):
			return int(a.pts) > int(b.pts)
		if int(a.w) != int(b.w):
			return int(a.w) > int(b.w)
		if int(a.l) != int(b.l):
			return int(a.l) < int(b.l)
		return a.player and not b.player)
	for i in rows.size():
		rows[i].pos = i + 1
	return rows


static func player_position(p: Dictionary) -> int:
	for r in table(p):
		if r.player:
			return r.pos
	return 0


static func nightly(p: Dictionary) -> Variant:
	ensure(p)
	if int(p.career.rankDay) >= int(p.day):
		return null
	p.career.rankDay = p.day
	var before := table(p)
	for e in p.career.rank:
		e.prev = 0
		for r in before:
			if r.id == e.id:
				e.prev = r.pos
	for r in before:
		if r.player:
			p.career.rankPrev = r.pos
	var rng := Rng.new(Fighters.day_seed(int(p.createdAt), int(p.day), 121))
	var champ := -1
	for i in p.career.rank.size():
		if p.career.rank[i].id == CHAMPION_ID:
			champ = i
	var idxs := []
	for i in p.career.rank.size():
		if i != champ:
			idxs.append(i)
	var order := Fighters.shuffle(rng, idxs)
	if champ >= 0:
		order.push_front(champ)
	var best = null
	var k := 0
	while k + 1 < order.size() and k < 10:
		var a: Dictionary = p.career.rank[order[k]]
		var b: Dictionary = p.career.rank[order[k + 1]]
		k += 2
		var da = _def_of(a)
		var db = _def_of(b)
		if da == null or db == null:
			continue
		var res := CombatEngine.new(Stats.opponent_combatant(da).spec, Stats.opponent_combatant(db).spec, {"seed": int(floor(rng.next() * 1e9))}).run_to_end()
		var win: Dictionary = a if int(res.winner) == 0 else b
		var lose: Dictionary = b if int(res.winner) == 0 else a
		win.w = int(win.w) + 1
		lose.l = int(lose.l) + 1
		win.pts = points(int(win.w), int(win.l))
		lose.pts = points(int(lose.w), int(lose.l))
		if rng.next() < 0.25:
			win.level = mini(30, int(win.level) + 1)
		var gap := int(lose.level) - int(win.level)
		if best == null or gap > best.gap:
			best = {"winner": win.id, "loser": lose.id, "gap": gap}
	return {"winner": best.winner, "loser": best.loser} if best != null else null
