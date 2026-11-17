class_name Invites
## Convites por fama para as arenas particulares (InviteSystem.ts).

const DEFS := [
	{"id": "villa", "fame": 150, "kind": "friendly", "host": "Lucullus", "plus": [2]},
	{"id": "senator", "fame": 300, "kind": "friendly", "host": "Varro", "plus": [3]},
	{"id": "baiae", "fame": 400, "kind": "tournament", "host": "Baiae", "plus": [1, 2, 3]},
]


static func def(id: String) -> Dictionary:
	for d in DEFS:
		if d.id == id:
			return d
	return {}


static func check(p: Dictionary) -> Array:
	var fresh := []
	for d in DEFS:
		if int(p.reputation) < int(d.fame) or p.career.invites.any(func(i): return i.id == d.id):
			continue
		var rng := Rng.new(Fighters.day_seed(int(p.createdAt), int(d.fame), 90))
		var picked := Fighters.shuffle(rng, Data.d.pool).slice(0, d.plus.size())
		var foes := []
		for k in picked.size():
			foes.append({"id": picked[k].id, "level": clampi(int(p.level) + int(d.plus[k]), 1, 30)})
		p.career.invites.append({"id": d.id, "status": "open", "day": p.day, "won": false, "round": 0, "foes": foes})
		fresh.append(d)
	return fresh


static func open_invites(p: Dictionary) -> Array:
	return p.career.invites.filter(func(i): return i.status == "open")


static func foe(inv: Dictionary) -> Variant:
	var r := int(inv.round)
	if r >= inv.foes.size():
		return null
	var f := Fighters.pool_fighter(str(inv.foes[r].id))
	return Fighters.pool_opponent(f, int(inv.foes[r].level)) if not f.is_empty() else null


static func _prize(d: Dictionary, level: int, stage: String) -> Dictionary:
	if d.id == "villa":
		return {"coins": 180 + level * 12, "fame": 22, "xp": 60 + level * 10} if stage == "win" else {"coins": 40, "fame": 0, "xp": 20 + level * 4}
	if d.id == "senator":
		return {"coins": 380 + level * 18, "fame": 38, "xp": 90 + level * 12} if stage == "win" else {"coins": 80, "fame": 0, "xp": 30 + level * 5}
	if stage == "champion":
		return {"coins": 900 + level * 30, "fame": 70, "xp": 160 + level * 16}
	if stage == "final":
		return {"coins": 260 + level * 10, "fame": 22, "xp": 80 + level * 8}
	return {"coins": 60, "fame": 5, "xp": 40 + level * 5}


static func record_special_fight(p: Dictionary, opp: Dictionary, won: bool, reason: String, duration: float, r: Dictionary) -> void:
	p.stats.battles = int(p.stats.battles) + 1
	if won:
		p.stats.wins = int(p.stats.wins) + 1
	else:
		p.stats.losses = int(p.stats.losses) + 1
	p.streak = maxi(0, int(p.streak)) + 1 if won else mini(0, int(p.streak)) - 1
	var now := int(Time.get_unix_time_from_system() * 1000.0)
	Progression._history(p, {"id": "b%d-%d" % [int(p.stats.battles), now], "date": now, "opponentId": opp.id, "opponentName": Names.opponent_full(opp),
		"opponentLevel": opp.level, "playerLevel": p.level, "result": "win" if won else "loss", "reason": reason, "duration": int(round(duration)),
		"strategy": p.strategy, "xp": r.xp, "coins": r.coins, "reputation": r.fame, "itemId": r.get("itemId"), "levelUps": r.get("levelUps", 0)})


static func finish_fight(p: Dictionary, id: String, won: bool, reason: String, duration: float, rng: Rng) -> Variant:
	var d := def(id)
	var inv = null
	for i in p.career.invites:
		if i.id == id and i.status == "open":
			inv = i
	var opp = foe(inv) if inv != null else null
	if d.is_empty() or inv == null or opp == null:
		return null
	var stage := ""
	var final := false
	if d.kind == "friendly":
		stage = "win" if won else "out"
	elif not won:
		stage = "out" if int(inv.round) == 0 else "final"
	elif int(inv.round) == 0:
		var t1: Dictionary = inv.duplicate(true)
		t1.round = 1
		var t2: Dictionary = inv.duplicate(true)
		t2.round = 2
		var a = foe(t1)
		var b = foe(t2)
		var finalist := 1
		if a != null and b != null:
			var res := CombatEngine.new(Stats.opponent_combatant(a).spec, Stats.opponent_combatant(b).spec, {"seed": int(floor(rng.next() * 1e9))}).run_to_end()
			finalist = 1 if int(res.winner) == 0 else 2
		if finalist == 2:
			inv.foes = [inv.foes[0], inv.foes[2], inv.foes[1]]
		inv.round = 1
		final = true
		stage = "win"
	else:
		stage = "champion"
	var pr := {"coins": 0, "fame": 0, "xp": 30 + int(p.level) * 4} if final else _prize(d, int(p.level), stage)
	p.coins = int(p.coins) + int(pr.coins)
	p.reputation = int(p.reputation) + int(pr.fame)
	var ups := Progression.grant_xp(p, pr.xp)
	var item = null
	if stage == "win" and not final:
		item = Progression.roll_drop(5 if d.id == "villa" else 6, rng)
	if stage == "champion":
		item = Progression.roll_drop(7, rng)
	if item != null:
		Equip.add_item(p, item)
	var rec := pr.duplicate()
	rec.itemId = item
	rec.levelUps = ups
	record_special_fight(p, opp, won, reason, duration, rec)
	var done := not final
	if done:
		inv.status = "done"
		inv.won = won
	return {"won": won, "coins": pr.coins, "fame": pr.fame, "xp": pr.xp, "itemId": item, "levelUps": ups, "done": done, "final": final, "champion": stage == "champion"}
