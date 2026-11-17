class_name Tournament
## Torneio de sábado: inscrição, chave de 8 e três rodadas (TournamentSystem.ts).

const START := 14 * 60
const LATE := 16 * 60
const ENERGY := 15
const MIN_ENERGY := 45
const FIGHT_MINUTES := 40
const NO_SHOW_FAME := 50


static func is_saturday(day: int) -> bool:
	return Calendar.weekday_index(day) == 6


static func next_saturday(day: int) -> int:
	var d := day
	while not is_saturday(d):
		d += 1
	return d


static func entry_fee(p: Dictionary) -> int:
	return 20 + int(p.level) * 5


static func prize(level: int, reached: int) -> Dictionary:
	var t := [
		{"coins": 0, "fame": 1, "xp": 20 + level * 4},
		{"coins": 20 + level * 5, "fame": 2, "xp": 40 + level * 6},
		{"coins": 50 + level * 10, "fame": 5, "xp": 70 + level * 8},
		{"coins": 120 + level * 30, "fame": 12, "xp": 110 + level * 12},
	]
	return t[clampi(reached, 0, 3)]


static func can_register(p: Dictionary) -> Variant:
	if p.location != "arena":
		return I18n.t("tour.atArena")
	if not Calendar.is_open(Data.location("arena"), int(p.minutes), int(p.day)):
		return I18n.t("cal.arenaClosed")
	if int(p.tournament.registered) == next_saturday(int(p.day)):
		return I18n.t("tour.already")
	if is_saturday(int(p.day)):
		return I18n.t("tour.lateRegister")
	if int(p.coins) < entry_fee(p):
		return I18n.t("err.noCoins")
	return null


static func register(p: Dictionary) -> Variant:
	var err = can_register(p)
	if err != null:
		return err
	p.coins = int(p.coins) - entry_fee(p)
	p.tournament.registered = next_saturday(int(p.day))
	return null


static func build_bracket(p: Dictionary) -> Dictionary:
	var rng := Rng.new(Fighters.day_seed(int(p.createdAt), int(p.day), 31))
	var rivals := Fighters.shuffle(rng, Data.d.pool).slice(0, 7)
	var offsets := Fighters.shuffle(rng, [-2, -1, -1, 0, 0, 1, 2])
	var ids := ["player"]
	for f in rivals:
		ids.append(f.id)
	var levels := [int(p.level)]
	for o in offsets:
		levels.append(clampi(int(p.level) + o, 1, 30))
	var order := Fighters.shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7])
	return {"day": p.day, "bracket": order.map(func(i): return ids[i]), "levels": order.map(func(i): return levels[i]), "winners": [], "done": false}


static func can_start(p: Dictionary) -> Variant:
	if not is_saturday(int(p.day)):
		return I18n.t("tour.saturdayOnly")
	if int(p.tournament.registered) != int(p.day):
		return I18n.t("tour.notRegistered")
	if p.tournament.run != null:
		return null
	if int(p.minutes) < START:
		return I18n.t("tour.startsAt")
	if int(p.minutes) >= LATE:
		return I18n.t("tour.tooLate")
	if int(p.energy) < MIN_ENERGY:
		return I18n.t("tour.needEnergy", {"n": MIN_ENERGY})
	return null


static func start(p: Dictionary) -> Variant:
	var err = can_start(p)
	if err != null:
		return err
	if p.tournament.run == null:
		p.tournament.run = build_bracket(p)
	return null


static func current_round(run: Dictionary) -> int:
	var n: int = run.winners.size()
	return 0 if n < 4 else (1 if n < 6 else (2 if n < 7 else 3))


static func round_pairs(run: Dictionary, round: int) -> Array:
	if round == 0:
		return [[0, 1], [2, 3], [4, 5], [6, 7]]
	var prev: Array = run.winners.slice(0, 4) if round == 1 else run.winners.slice(4, 6)
	var out := []
	var i := 0
	while i + 1 < prev.size():
		out.append([int(prev[i]), int(prev[i + 1])])
		i += 2
	return out


static func player_slot(run: Dictionary) -> int:
	return run.bracket.find("player")


static func opponent_at(run: Dictionary, slot: int) -> Variant:
	var f := Fighters.pool_fighter(str(run.bracket[slot]))
	return Fighters.pool_opponent(f, int(run.levels[slot])) if not f.is_empty() else null


static func player_match(run: Dictionary) -> Variant:
	if run.done:
		return null
	var round := current_round(run)
	if round > 2:
		return null
	var me := player_slot(run)
	for pair in round_pairs(run, round):
		if pair[0] == me or pair[1] == me:
			var other: int = pair[1] if pair[0] == me else pair[0]
			var opp = opponent_at(run, other)
			return {"round": round, "opponentSlot": other, "opponent": opp} if opp != null else null
	return null


static func _simulate(run: Dictionary, a: int, b: int, rng: Rng) -> int:
	var da = opponent_at(run, a)
	var db = opponent_at(run, b)
	if da == null or db == null:
		return a if da != null else b
	var res := CombatEngine.new(Stats.opponent_combatant(da).spec, Stats.opponent_combatant(db).spec, {"seed": int(floor(rng.next() * 1e9))}).run_to_end()
	return a if int(res.winner) == 0 else b


static func record_player_fight(p: Dictionary, won: bool) -> void:
	var run = p.tournament.run
	if run == null or run.done:
		return
	var m = player_match(run)
	if m == null:
		return
	var rng := Rng.new(Fighters.day_seed(int(p.createdAt), int(p.day), 50 + run.winners.size()))
	var me := player_slot(run)
	for pair in round_pairs(run, m.round):
		if pair[0] == me or pair[1] == me:
			run.winners.append(me if won else m.opponentSlot)
		else:
			run.winners.append(_simulate(run, pair[0], pair[1], rng))
	Calendar.spend_energy(p, ENERGY)
	Calendar.advance(p, FIGHT_MINUTES)
	if not won:
		while current_round(run) <= 2:
			for pair in round_pairs(run, current_round(run)):
				run.winners.append(_simulate(run, pair[0], pair[1], rng))
		run.done = true
	elif current_round(run) > 2:
		run.done = true


static func reached_round(run: Dictionary) -> int:
	var me := player_slot(run)
	if run.winners.size() > 6 and int(run.winners[6]) == me:
		return 3
	if run.winners.slice(4, 6).has(me):
		return 2
	if run.winners.slice(0, 4).has(me):
		return 1
	return 0


static func close(p: Dictionary, rng: Rng) -> Variant:
	var run = p.tournament.run
	if run == null or not run.done:
		return null
	var reached := reached_round(run)
	var pr := prize(int(p.level), reached)
	p.coins = int(p.coins) + int(pr.coins)
	p.reputation = int(p.reputation) + int(pr.fame)
	var ups := Progression.grant_xp(p, pr.xp)
	var item = null
	if reached == 3:
		p.tournament.titles = int(p.tournament.titles) + 1
		item = Progression.roll_drop(5 + mini(3, int(p.level) / 8), rng)
		Equip.add_item(p, item)
	p.tournament.best = maxi(int(p.tournament.best), reached)
	var champ = run.bracket[int(run.winners[6])] if run.winners.size() > 6 else "player"
	p.tournament.run = null
	p.tournament.registered = 0
	return {"reached": reached, "coins": pr.coins, "fame": pr.fame, "xp": pr.xp, "itemId": item, "champion": champ, "levelUps": ups}


static func check_no_show(p: Dictionary) -> bool:
	var reg := int(p.tournament.registered)
	if reg == 0 or p.tournament.run != null:
		return false
	var missed: bool = int(p.day) > reg or (int(p.day) == reg and int(p.minutes) >= LATE)
	if not missed:
		return false
	p.tournament.registered = 0
	p.reputation = maxi(0, int(p.reputation) - NO_SHOW_FAME)
	return true


static func time_for_fight(p: Dictionary) -> bool:
	return int(p.minutes) + FIGHT_MINUTES <= Calendar.DAY_END


static func abandon(p: Dictionary) -> void:
	var run = p.tournament.run
	if run == null or run.done:
		return
	var e := int(p.energy)
	var m := int(p.minutes)
	record_player_fight(p, false)
	p.energy = e
	p.minutes = m
