extends RefCounted
## Paridade dos sistemas com a versão TypeScript (data/golden_systems.json).

static func run(t) -> void:
	print("paridade dos sistemas com a versão TypeScript")
	var g: Dictionary = JSON.parse_string(FileAccess.open("res://data/golden_systems.json", FileAccess.READ).get_as_text())
	var seed := int(g.seed)
	var w := []
	for d in 40:
		w.append(Weather.of_day(seed, d + 1).kind)
	t.ok(w == g.weather, "clima dos 40 primeiros dias")
	var md := Events.merchant_days(seed, 60)
	t.ok(md.map(func(x): return int(x)) == g.merchant.map(func(x): return int(x)), "dias do mercador")
	var ven := []
	for d in 60:
		ven.append(Venatio.is_day(seed, d + 1))
	t.ok(ven == g.venatio, "dias de feras")
	var st := Events.merchant_stock(seed, 9, 6).map(func(o): return [o.item.id, o.price, o.exotic])
	t.ok(str(st) == str(g.stock.map(func(o): return [o[0], int(o[1]), o[2]])), "mercadorias do mercador")
	var rp := PlayerFactory.create("Rank", "gaul", {"skin": 0, "hairStyle": 0, "hairColor": 0, "beard": false, "clothColor": 0}, seed)
	rp.level = 7
	var seeded := Ranking.seed_table(rp)
	var same: bool = seeded.size() == g.rankSeed.size()
	for i in mini(seeded.size(), g.rankSeed.size()):
		var a: Dictionary = seeded[i]
		var b: Dictionary = g.rankSeed[i]
		if a.id != b.id or int(a.level) != int(b.level) or int(a.w) != int(b.w) or int(a.l) != int(b.l):
			same = false
	t.ok(same, "tabela inicial do ranking")
	for d in range(2, 7):
		rp.day = d
		Ranking.nightly(rp)
	var after := Ranking.table(rp).map(func(r): return [r.id, int(r.level), int(r.w), int(r.l), int(r.pos), int(r.prev)])
	t.ok(str(after) == str(g.rankAfter.map(func(r): return [r[0], int(r[1]), int(r[2]), int(r[3]), int(r[4]), int(r[5])])), "ranking depois de 5 noites de lutas")
	var bad := []
	var i := 0
	for row in g.rewards:
		var opp := Data.opponent(row[0])
		var r := Progression.compute_rewards(rp, opp, row[2], Rng.new(31 + Fighters.opponent_index(opp.id)), row[1])
		var e: Dictionary = row[3]
		if int(r.xp) != int(e.xp) or int(r.coins) != int(e.coins) or int(r.reputation) != int(e.reputation) or str(r.itemId) != str(e.itemId):
			bad.append("%s %s %s: %s / %s" % [row[0], row[1], row[2], r, e])
		i += 1
	t.ok(bad.is_empty(), "recompensas (%d casos) %s" % [g.rewards.size(), str(bad.slice(0, 2))])
	var tp := PlayerFactory.create("Tour", "gaul", {"skin": 0, "hairStyle": 0, "hairColor": 0, "beard": false, "clothColor": 0}, seed)
	tp.level = 9
	tp.day = 13
	var br := Tournament.build_bracket(tp)
	t.ok(br.bracket == g.bracket.bracket and str(br.levels) == str(g.bracket.levels.map(func(x): return int(x))), "chave do torneio")
	var ch := []
	for k in 4:
		var c := Fighters.free_challenger(seed, 5, k, 8)
		ch.append([c.id, c.level])
	t.ok(str(ch) == str(g.challengers.map(func(x): return [x[0], int(x[1])])), "desafiantes do dia")
	tp.reputation = 420
	Invites.check(tp)
	var inv_ok: bool = tp.career.invites.size() == g.invites.size()
	for k in mini(tp.career.invites.size(), g.invites.size()):
		for fk in tp.career.invites[k].foes.size():
			if tp.career.invites[k].foes[fk].id != g.invites[k].foes[fk].id or int(tp.career.invites[k].foes[fk].level) != int(g.invites[k].foes[fk].level):
				inv_ok = false
	t.ok(inv_ok, "convites e adversários")
	var df := Duo.foes(tp).map(func(o): return [o.id, o.level])
	t.ok(str(df) == str(g.duoFoes.map(func(x): return [x[0], int(x[1])])), "dupla adversária do dia")
	var b := PlayerFactory.create("B", "gaul", {"skin": 0, "hairStyle": 0, "hairColor": 0, "beard": false, "clothColor": 0}, seed)
	b.level = 10
	b.day = 20
	var be := Venatio.beast_of_day(b)
	t.ok([be.id, be.level] == [g.beast[0], int(g.beast[1])], "fera do dia")
