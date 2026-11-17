class_name Progression
## Recompensas, experiência, níveis e histórico (ProgressionSystem.ts).

const HISTORY_LIMIT := 50
const DROP_TABLES := [
	[2, {"common": 70, "uncommon": 30, "rare": 0, "epic": 0}],
	[5, {"common": 25, "uncommon": 50, "rare": 25, "epic": 0}],
	[7, {"common": 0, "uncommon": 35, "rare": 55, "epic": 10}],
	[99, {"common": 0, "uncommon": 0, "rare": 60, "epic": 40}],
]


static func xp_to_next(level: int) -> float:
	if level >= int(Data.constant("MAX_LEVEL")):
		return INF
	return round(50 * pow(level, 1.4) + 50)


static func level_diff_factor(pl: int, ol: int) -> float:
	var diff := ol - pl
	if diff >= 0:
		return minf(1.5, 1 + diff * 0.08)
	return maxf(0.2, 1 + diff * 0.15)


static func roll_drop(opp_idx: int, rng: Rng) -> String:
	var table: Dictionary = {}
	for row in DROP_TABLES:
		if opp_idx <= row[0]:
			table = row[1]
			break
	var total := 0.0
	for k in table:
		total += table[k]
	var r := rng.next() * total
	var rarity := "common"
	for k in ["common", "uncommon", "rare", "epic"]:
		if r < table[k]:
			rarity = k
			break
		r -= table[k]
	var pool: Array = Data.d.items.filter(func(i): return i.rarity == rarity and i.id != "rudis")
	return rng.pick(pool).id


static func loss_fame(opp_level: int) -> int:
	return mini(10, 2 + opp_level / 4)


static func compute_rewards(p: Dictionary, opp: Dictionary, won: bool, rng: Rng, mode := "ladder") -> Dictionary:
	var f := level_diff_factor(int(p.level), int(opp.level))
	var ol := int(opp.level)
	var first: bool = mode == "ladder" and won and not p.defeatedOpponents.has(opp.id)
	var fame_mul: float = Events.FESTIVAL_FAME_MUL if Events.is_festival(int(p.day)) else 1
	if not won:
		var rep := 0 if mode == "tournament" else -loss_fame(ol)
		return {"xp": maxi(5, int(round((30 + 12 * ol) * f * 0.2))), "coins": 5 + ol, "reputation": rep, "itemId": null, "firstVictory": first}
	var mul := Rivals.REMATCH_REWARD_MUL if mode == "rematch" else (0.9 if mode == "free" else (1.2 if mode == "beast" else 1.0))
	var xp := int(round((30 + 12 * ol) * f * mul))
	var coins := int(round((20 + 8 * ol) * f * mul)) + (25 + ol * 10 if first else 0)
	var fame := maxi(1, int(round((2 + ol) * minf(1, f)))) + (5 if first else 0) + (4 if mode == "rematch" else 0)
	var reputation := int(round(fame * fame_mul * (Venatio.FAME_MUL if mode == "beast" else 1.0))) + (5 if mode == "beast" else 0)
	var drop := 1.0 if first else (0.5 if mode == "rematch" else (0.15 if mode == "free" else (0.3 if mode == "beast" else 0.2)))
	var idx := mini(Data.d.opponents.size() - 1, ol / 3) if mode == "free" or mode == "beast" else Fighters.opponent_index(opp.id)
	var item = roll_drop(maxi(0, idx), rng) if rng.next() < drop else null
	return {"xp": xp, "coins": coins, "reputation": reputation, "itemId": item, "firstVictory": first}


static func grant_xp(p: Dictionary, amount: float) -> int:
	var ups := 0
	var mx := int(Data.constant("MAX_LEVEL"))
	if int(p.level) >= mx:
		return 0
	p.xp = int(p.xp) + maxi(0, int(round(amount)))
	while int(p.level) < mx and float(p.xp) >= xp_to_next(int(p.level)):
		p.xp = int(p.xp) - int(xp_to_next(int(p.level)))
		p.level = int(p.level) + 1
		p.unspentPoints = int(p.unspentPoints) + int(Data.constant("POINTS_PER_LEVEL"))
		p.skillPoints = int(p.skillPoints) + 1
		ups += 1
	if int(p.level) >= mx:
		p.xp = 0
	return ups


static func _now_ms() -> int:
	return int(Time.get_unix_time_from_system() * 1000.0)


static func apply_battle_result(p: Dictionary, input: Dictionary) -> Dictionary:
	var opp: Dictionary = input.opponent
	var won: bool = input.won
	var rng: Rng = input.rng
	var mode: String = input.get("mode", "ladder")
	var level_before := int(p.level)
	var festival := Events.is_festival(int(p.day))
	var r := compute_rewards(p, opp, won, rng, mode)
	var ups := grant_xp(p, r.xp)
	p.coins = int(p.coins) + int(r.coins)
	p.reputation = maxi(0, int(p.reputation) + int(r.reputation))
	if r.itemId != null:
		Equip.add_item(p, r.itemId)
	var unlocked = null
	if mode == "ladder" and won and not p.defeatedOpponents.has(opp.id):
		p.defeatedOpponents.append(opp.id)
		var ni := Fighters.opponent_index(opp.id) + 1
		if ni < Data.d.opponents.size():
			unlocked = Data.d.opponents[ni]
			p.selectedOpponent = unlocked.id
	p.stats.battles = int(p.stats.battles) + 1
	if won:
		p.stats.wins = int(p.stats.wins) + 1
	else:
		p.stats.losses = int(p.stats.losses) + 1
	var prev_streak := int(p.streak)
	p.streak = maxi(0, prev_streak) + 1 if won else mini(0, prev_streak) - 1
	var rematch_asked := false
	if mode == "ladder" or mode == "rematch":
		Rivals.record(p, opp.id, won)
		if mode == "rematch":
			p.rematch = null
		if won:
			rematch_asked = Rivals.maybe_ask_rematch(p, opp.id, rng)
	var injury := 0 if won else Rivals.apply_injury(p, input.reason, rng)
	if mode != "beast":
		News.on_battle(p, opp, won, r.firstVictory, rng, input.reason, prev_streak, mode)
	if rematch_asked:
		News.on_rematch_asked(p, opp.id, rng)
	var now: int = input.get("now", _now_ms())
	_history(p, {"id": "b%d-%d" % [int(p.stats.battles), now], "date": now, "opponentId": opp.id, "opponentName": Names.opponent_full(opp),
		"opponentLevel": opp.level, "playerLevel": level_before, "result": "win" if won else "loss", "reason": input.reason,
		"duration": int(round(float(input.duration))), "strategy": input.strategy, "xp": r.xp, "coins": r.coins,
		"reputation": r.reputation, "itemId": r.itemId, "levelUps": ups})
	return {"result": "win" if won else "loss", "xp": r.xp, "coins": r.coins, "reputation": r.reputation, "itemId": r.itemId,
		"levelUps": ups, "newLevel": p.level, "pointsGained": ups * int(Data.constant("POINTS_PER_LEVEL")), "unlockedOpponent": unlocked,
		"firstVictory": r.firstVictory, "injuryDays": injury, "rematchAsked": rematch_asked, "festival": festival, "mode": mode}


static func _history(p: Dictionary, rec: Dictionary) -> void:
	p.history.push_front(rec)
	while p.history.size() > HISTORY_LIMIT:
		p.history.pop_back()


static func record_fight_only(p: Dictionary, opp: Dictionary, won: bool, reason: String, duration: float, strategy: String, rng: Rng) -> int:
	p.stats.battles = int(p.stats.battles) + 1
	if won:
		p.stats.wins = int(p.stats.wins) + 1
	else:
		p.stats.losses = int(p.stats.losses) + 1
	p.streak = maxi(0, int(p.streak)) + 1 if won else mini(0, int(p.streak)) - 1
	var injury := 0 if won else Rivals.apply_injury(p, reason, rng)
	var now := _now_ms()
	_history(p, {"id": "b%d-%d" % [int(p.stats.battles), now], "date": now, "opponentId": opp.id, "opponentName": Names.opponent_full(opp),
		"opponentLevel": opp.level, "playerLevel": p.level, "result": "win" if won else "loss", "reason": reason,
		"duration": int(round(duration)), "strategy": strategy, "xp": 0, "coins": 0, "reputation": 0, "itemId": null, "levelUps": 0})
	return injury


static func reputation_title(rep: int) -> String:
	if rep >= 600:
		return I18n.t("rank.6")
	if rep >= 350:
		return I18n.t("rank.5")
	if rep >= 180:
		return I18n.t("rank.4")
	if rep >= 80:
		return I18n.t("rank.3")
	if rep >= 25:
		return I18n.t("rank.2")
	return I18n.t("rank.1")
