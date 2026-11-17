extends RefCounted
## Paridade do combate com a versão TypeScript (data/golden.json gerado por
## tools/export-godot.ts): gerador aleatório, estatísticas dos adversários e lutas
## inteiras com sementes fixas devem dar exatamente o mesmo resultado.

static func run(t) -> void:
	print("paridade do combate com a versão TypeScript")
	var g: Dictionary = JSON.parse_string(FileAccess.open("res://data/golden.json", FileAccess.READ).get_as_text())
	var r := Rng.new(12345)
	var same := true
	for v in g.rngSeq:
		if absf(r.next() - float(v)) > 1e-12:
			same = false
	t.ok(same, "gerador aleatório igual")
	var bad := []
	for o in g.opps:
		var def := Data.opponent(o.id)
		var c := Stats.opponent_combatant(def)
		if Stats.auto_perks(int(def.level), def.paths, true) != o.perks:
			bad.append(o.id + " (habilidades)")
		for k in o.stats:
			if absf(float(c.spec.stats[k]) - float(o.stats[k])) > 1e-9:
				bad.append("%s.%s %s != %s" % [o.id, k, c.spec.stats[k], o.stats[k]])
	t.ok(bad.is_empty(), "estatísticas dos adversários iguais " + str(bad.slice(0, 3)))
	var res := SaveSystem.validate(g.playerSave)
	var me := Stats.player_combatant(res.player)
	var pbad := []
	for k in g.player.stats:
		if absf(float(me.spec.stats[k]) - float(g.player.stats[k])) > 1e-9:
			pbad.append("%s %s != %s" % [k, me.spec.stats[k], g.player.stats[k]])
	t.ok(pbad.is_empty() and me.spec.skills == g.player.skills, "estatísticas do jogador iguais " + str(pbad.slice(0, 3)))
	var fbad := []
	for f in g.fights:
		var e := CombatEngine.new(me.spec, Stats.opponent_combatant(Data.opponent(f.opp)).spec, {"seed": int(f.seed)})
		var evs := 0
		while not e.finished and e.time < 600:
			evs += e.step().size()
		var out := e.run_to_end()
		var okf: bool = int(out.winner) == int(f.winner) and out.reason == f.reason and absf(out.duration - float(f.duration)) < 1e-6 \
			and int(out.fighters[0].hp) == int(f.hp[0]) and int(out.fighters[1].hp) == int(f.hp[1]) and evs == int(f.events)
		for i in 2:
			for k in f.counters[i]:
				if int(out.fighters[i].counters[k]) != int(f.counters[i][k]):
					okf = false
		if not okf:
			fbad.append("%s/%s: %s %s %.2f hp %s eventos %d (esperado %s %s %.2f hp %s eventos %d)" % [f.opp, f.seed, out.winner, out.reason, out.duration, [out.fighters[0].hp, out.fighters[1].hp], evs, f.winner, f.reason, f.duration, f.hp, f.events])
	t.ok(fbad.is_empty(), "%d lutas idênticas às da versão TypeScript %s" % [g.fights.size(), str(fbad.slice(0, 2))])
