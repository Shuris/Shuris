class_name Act
## Regras de cada tipo de luta antes e depois (preparar, aplicar resultado, plateia,
## convites, respeito), sem interface. Porte da orquestração de App.ts.

## Desafiante avulso da próxima luta do dia.
static func todays_challenger(p: Dictionary) -> Dictionary:
	var n := int(p.events.freeCount) if int(p.events.freeDay) == int(p.day) else 0
	return Fighters.free_challenger(int(p.createdAt), int(p.day), n, int(p.level))


## Plano da luta ou mensagem de erro (String).
static func prepare_fight(p: Dictionary, opts: Dictionary) -> Variant:
	var city_arena := Fighters.arena_for_opponent(News.next_rival(p).id)
	var mode: String = opts.get("mode", "ladder")
	if mode == "beast":
		var v = Venatio.check(p)
		if v != null:
			return I18n.t("venatio.done" if v == "done" else "venatio.notToday")
		var err = Calendar.can_fight(p)
		if err != null:
			return err
		return {"def": Venatio.beast_of_day(p), "mode": "beast", "arena": city_arena, "voice": "beast", "intro": "intro"}
	if mode == "invite":
		var inv = null
		for i in p.career.invites:
			if i.id == opts.get("inviteId") and i.status == "open":
				inv = i
		var foe = Invites.foe(inv) if inv != null else null
		var ar := Fighters.arena(str(inv.id)) if inv != null else {}
		if inv == null or foe == null or ar.is_empty():
			return I18n.t("arena.unavailable")
		if int(inv.round) == 0:
			var err2 = Calendar.can_fight(p)
			if err2 != null:
				return err2
		return {"def": foe, "mode": "invite", "arena": ar, "voice": "pool", "intro": "intro"}
	if mode == "duo":
		var d = Duo.check(p)
		if d != null:
			return I18n.t({"noPartner": "duo.needPartner", "done": "duo.done", "notToday": "duo.notToday"}.get(d, "arena.unavailable"))
		var err3 = Calendar.can_fight(p)
		if err3 != null:
			return err3
		var fs := Duo.foes(p)
		var partner = Duo.partner_def(p)
		if partner == null:
			return I18n.t("duo.needPartner")
		return {"def": fs[0], "mode": "duo", "arena": city_arena, "voice": "pool", "intro": "intro", "back": [partner, fs[1]]}
	if mode == "tournament":
		var run = p.tournament.run
		var m = Tournament.player_match(run) if run != null else null
		if m == null:
			return I18n.t("tour.noMatch")
		if int(p.energy) < Tournament.ENERGY:
			return I18n.t("cal.noEnergyFight", {"n": Tournament.ENERGY})
		if not Tournament.time_for_fight(p):
			return I18n.t("cal.tooLate")
		return {"def": m.opponent, "mode": "tournament", "arena": city_arena, "voice": "pool", "intro": "intro"}
	var err4 = Calendar.can_fight(p)
	if err4 != null:
		return err4
	if mode == "free":
		return {"def": todays_challenger(p), "mode": "free", "arena": city_arena, "voice": "pool", "intro": "intro"}
	var base := Data.opponent(str(opts.get("opponentId", p.selectedOpponent)))
	if base.is_empty():
		return I18n.t("arena.unavailable")
	var lerr = Rivals.ladder_check(p, base.id)
	if lerr != null:
		return lerr
	return {"def": Rivals.fight_def(p, base), "mode": "rematch" if Rivals.rematch_active(p, base.id) else "ladder",
		"arena": Fighters.arena_for_opponent(base.id), "voice": base.id, "intro": Rivals.intro_moment(p, base.id)}


## Chance de vitória estimada (40 lutas simuladas, como na versão TS).
static var _chance_cache := {}
static func win_chance(p: Dictionary, def: Dictionary) -> float:
	var me: Dictionary = Stats.player_combatant(p).spec
	var key := "%s|%s|%s" % [def.id, def.level, JSON.stringify(me)]
	if _chance_cache.has(key):
		return _chance_cache[key]
	var them: Dictionary = Stats.opponent_combatant(def).spec
	var wins := 0
	for i in 40:
		if int(CombatEngine.new(me, them, {"seed": 7919 * (i + 1)}).run_to_end().winner) == 0:
			wins += 1
	var c := wins / 40.0
	_chance_cache[key] = c
	return c


static func difficulty(chance: float) -> Dictionary:
	if chance >= 0.75:
		return {"label": I18n.t("diff.easy"), "color": Color8(110, 200, 110)}
	if chance >= 0.5:
		return {"label": I18n.t("diff.even"), "color": Color8(230, 200, 90)}
	if chance >= 0.25:
		return {"label": I18n.t("diff.hard"), "color": Color8(230, 140, 70)}
	return {"label": I18n.t("diff.vhard"), "color": Color8(220, 80, 70)}


## Depois de qualquer luta: plateia (fama extra ou perdoada) e convites que a fama liberou.
static func after_fight(p: Dictionary, won: bool, ctx: Dictionary, rng: Rng, fame_change: int, notes: Array) -> int:
	var extra := 0
	if Crowd.spared(ctx.favor, won) and fame_change < 0:
		p.reputation = int(p.reputation) - fame_change
		extra -= fame_change
		notes.append({"text": I18n.t("result.spared")})
	var fx := 0 if ctx.mode == "invite" and not won else Crowd.fame(ctx.favor, won)
	if fx != 0:
		p.reputation = maxi(0, int(p.reputation) + fx)
		extra += fx
		notes.append({"text": I18n.t("result.thumbUp", {"n": fx})} if fx > 0 else {"text": I18n.t("result.thumbDown", {"n": fx}), "bad": true})
	p.career.thumbsUp = maxi(int(p.career.thumbsUp), int(round(ctx.favor)))
	for inv in Invites.check(p):
		News.on_career(p, "invite", rng, {"arena": inv.id})
		notes.append({"text": I18n.t("invite.arrived", {"title": I18n.t("invite.%s.title" % inv.id)})})
	return extra


## Luta comum (escada, revanche, desafiante, fera): aplica tudo e devolve {rw, notes}.
static func finish_normal(p: Dictionary, ctx: Dictionary, res: Dictionary, rng: Rng) -> Dictionary:
	var won: bool = int(res.winner) == 0
	var notes := []
	Calendar.apply_fight(p)
	if ctx.mode == "free":
		if int(p.events.freeDay) != int(p.day):
			p.events.freeDay = p.day
			p.events.freeCount = 0
		p.events.freeCount = int(p.events.freeCount) + 1
	var r := Progression.apply_battle_result(p, {"opponent": ctx.opponent, "won": won, "reason": res.reason, "duration": res.duration, "strategy": ctx.strategy, "rng": rng, "mode": ctx.mode})
	if ctx.mode == "beast":
		p.career.beastDay = p.day
		if won:
			p.career.beastWins = int(p.career.beastWins) + 1
			News.on_career(p, "beastWin", rng)
	if won and ctx.mode == "ladder" and r.firstVictory and Duo.add_respect(p, ctx.opponent.id, Duo.RESPECT_FIRST_WIN):
		notes.append({"text": I18n.t("duo.newFriend", {"name": ctx.opponent.name})})
	if won and ctx.mode == "rematch" and Duo.add_respect(p, ctx.opponent.id, Duo.RESPECT_REMATCH_WIN):
		notes.append({"text": I18n.t("duo.newFriend", {"name": ctx.opponent.name})})
	var extra := after_fight(p, won, ctx, rng, int(r.reputation), notes)
	r.reputation = int(r.reputation) + extra
	_chance_cache.clear()
	return {"rw": r, "notes": notes}


static func finish_tournament(p: Dictionary, ctx: Dictionary, res: Dictionary, rng: Rng) -> int:
	var won: bool = int(res.winner) == 0
	var inj := Progression.record_fight_only(p, ctx.opponent, won, res.reason, res.duration, ctx.strategy, rng)
	Tournament.record_player_fight(p, won)
	after_fight(p, won, ctx, rng, 0, [])
	return inj


static func finish_invite(p: Dictionary, ctx: Dictionary, res: Dictionary, rng: Rng) -> Variant:
	var won: bool = int(res.winner) == 0
	var id: String = ctx.inviteId
	var notes := []
	var inv = null
	for i in p.career.invites:
		if i.id == id:
			inv = i
	if inv != null and int(inv.round) == 0:
		Calendar.apply_fight(p)
	var r = Invites.finish_fight(p, id, won, res.reason, res.duration, rng)
	if r == null:
		return null
	if r.champion:
		notes.append({"text": I18n.t("invite.champion")})
	elif r.final and inv != null:
		var nf = Invites.foe(inv)
		notes.append({"text": I18n.t("invite.toFinal", {"name": nf.name if nf != null else ""})})
	elif id == "baiae" and not won:
		notes.append({"text": I18n.t("invite.finalLost" if inv != null and int(inv.round) == 1 else "invite.semiLost")})
	else:
		notes.append({"text": I18n.t("invite.win" if won else "invite.loss")})
	if won and r.done:
		News.on_career(p, "inviteWin", rng, {"arena": id})
	var extra := after_fight(p, won, ctx, rng, 0, notes)
	var rw := {"result": "win" if won else "loss", "xp": r.xp, "coins": r.coins, "reputation": int(r.fame) + extra, "itemId": r.itemId,
		"levelUps": r.levelUps, "newLevel": p.level, "mode": "invite", "final": r.final}
	return {"rw": rw, "notes": notes}


## Fim da dupla (já decidida: win/loss).
static func finish_duo(p: Dictionary, ctx: Dictionary, res: Dictionary, won: bool, rng: Rng) -> Dictionary:
	var notes := [{"text": I18n.t("duo.win" if won else "duo.loss"), "bad": not won}]
	Calendar.apply_fight(p)
	var pr := Duo.prize(p, won)
	p.coins = int(p.coins) + int(pr.coins)
	p.reputation = maxi(0, int(p.reputation) + int(pr.fame) - (0 if won else 2))
	var ups := Progression.grant_xp(p, pr.xp)
	p.career.duoDay = p.day
	var partner: Dictionary = ctx.duo.partner
	if won:
		p.career.duoWins = int(p.career.duoWins) + 1
		News.on_career(p, "duoWin", rng, {"rival": partner.id})
	p.career.respect[partner.id] = mini(100, int(p.career.respect.get(partner.id, 0)) + Duo.RESPECT_DUO)
	notes.append({"text": I18n.t("duo.respect", {"n": Duo.RESPECT_DUO, "name": partner.name})})
	var rec := pr.duplicate()
	rec.fame = int(pr.fame) - (0 if won else 2)
	rec.itemId = null
	rec.levelUps = ups
	Invites.record_special_fight(p, ctx.duo.foes[0], won, res.reason, res.duration, rec)
	var extra := after_fight(p, won, ctx, rng, 0 if won else -2, notes)
	var rw := {"result": "win" if won else "loss", "xp": pr.xp, "coins": pr.coins, "reputation": int(pr.fame) - (0 if won else 2) + extra,
		"itemId": null, "levelUps": ups, "newLevel": p.level, "mode": "duo"}
	return {"rw": rw, "notes": notes}


## Dormir: torneio largado, sono, ranking da noite, ausência no torneio, revanche esquecida e jornal.
static func sleep(p: Dictionary) -> Dictionary:
	var rng := Rng.new(Rng.random_seed())
	var out := {"noShow": false, "edition": null}
	if p.tournament.run != null:
		Tournament.abandon(p)
		var r = Tournament.close(p, rng)
		if r != null:
			News.on_event(p, "tourneyWin" if int(r.reached) == 3 else "tourneyOut", rng, {"opp": "" if r.champion == "player" else r.champion})
	Calendar.sleep(p)
	var upset = Ranking.nightly(p)
	if upset != null:
		News.on_career(p, "rankUpset", rng, {"opp": upset.winner, "rival": upset.loser})
	p.career.quest = null
	if Tournament.check_no_show(p):
		News.on_event(p, "tourneyNoShow", rng)
		out.noShow = true
	var fled = Rivals.expire_rematch(p)
	if fled != null:
		News.on_event(p, "rematchFled", rng, {"opp": fled})
	out.edition = News.publish(p, rng)
	return out


## Estados visíveis: ferido, cansado (pouca energia) e motivado (vitórias seguidas).
static func status(p: Dictionary) -> Array:
	var out := []
	if p.get("injury") != null:
		out.append("injured")
	if int(p.energy) < 35:
		out.append("tired")
	if int(p.streak) >= 2:
		out.append("motivated")
	return out
