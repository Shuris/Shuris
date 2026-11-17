class_name Rivals
## Rivais com memória, revanche e ferimentos (RivalSystem.ts).

const REMATCH_CHANCE := 0.35
const REMATCH_COOLDOWN := 7
const REMATCH_WINDOW := 7
const REMATCH_REWARD_MUL := 1.5
const MEDIC_MINUTES := 30


static func record(p: Dictionary, opp_id: String, won: bool) -> void:
	if Data.opponent(opp_id).is_empty():
		return
	var m: Dictionary = p.rivals.get(opp_id, {"wins": 0, "losses": 0, "lastDay": 0, "last": "win"})
	if won:
		m.wins = int(m.wins) + 1
	else:
		m.losses = int(m.losses) + 1
	m.lastDay = p.day
	m.last = "win" if won else "loss"
	p.rivals[opp_id] = m


static func rematch_active(p: Dictionary, opp_id: String) -> bool:
	var r = p.get("rematch")
	return r != null and r.opponentId == opp_id and int(p.day) >= int(r.askedDay) and int(p.day) <= int(r.expires)


static func maybe_ask_rematch(p: Dictionary, opp_id: String, rng: Rng) -> bool:
	if p.get("rematch") != null or Data.opponent(opp_id).is_empty():
		return false
	if int(p.lastRematchDay) > 0 and int(p.day) - int(p.lastRematchDay) < REMATCH_COOLDOWN:
		return false
	if rng.next() >= REMATCH_CHANCE:
		return false
	p.rematch = {"opponentId": opp_id, "askedDay": int(p.day) + 1, "expires": int(p.day) + REMATCH_WINDOW}
	p.lastRematchDay = p.day
	return true


static func expire_rematch(p: Dictionary) -> Variant:
	var r = p.get("rematch")
	if r == null or int(p.day) <= int(r.expires):
		return null
	var id: String = r.opponentId
	p.rematch = null
	p.reputation = maxi(0, int(p.reputation) - 2)
	return id


static func rematch_boost(asked_day: int, day: int) -> int:
	return mini(3, 1 + maxi(0, day - asked_day) / 2)


static func fight_def(p: Dictionary, def: Dictionary) -> Dictionary:
	if not rematch_active(p, def.id) or p.get("rematch") == null:
		return def
	return Fighters.with_level(def, mini(30, int(def.level) + rematch_boost(int(p.rematch.askedDay), int(p.day))))


static func is_unlocked(p: Dictionary, opp_id: String) -> bool:
	var idx := Fighters.opponent_index(opp_id)
	if idx <= 0:
		return idx == 0
	return p.defeatedOpponents.has(Data.d.opponents[idx - 1].id)


static func ladder_check(p: Dictionary, opp_id: String) -> Variant:
	if not is_unlocked(p, opp_id):
		return I18n.t("arena.unavailable")
	if p.defeatedOpponents.has(opp_id) and not rematch_active(p, opp_id):
		return I18n.t("rival.alreadyBeaten")
	return null


static func intro_moment(p: Dictionary, opp_id: String) -> String:
	if rematch_active(p, opp_id):
		return "rematch"
	if p.rivals.has(opp_id) and p.rivals[opp_id].get("last") == "loss":
		return "gloat"
	return "intro"


static func apply_injury(p: Dictionary, reason: String, rng: Rng) -> int:
	if reason == "decision":
		return 0
	var days := (1 if rng.next() < 0.5 else 2) if reason == "ko" else 1
	var cur := int(p.injury.days) if p.get("injury") != null else 0
	p.injury = {"days": mini(3, maxi(cur, days))}
	return int(p.injury.days)


static func medic_cost(p: Dictionary) -> int:
	return 20 + int(p.level) * 4


static func can_see_medic(p: Dictionary) -> Variant:
	if p.get("injury") == null:
		return I18n.t("injury.none")
	if not Calendar.is_open(Data.location("ludus"), int(p.minutes), int(p.day)):
		return I18n.t("cal.ludusClosed")
	if int(p.coins) < medic_cost(p):
		return I18n.t("err.noCoins")
	if int(p.minutes) + MEDIC_MINUTES > Calendar.DAY_END:
		return I18n.t("cal.tooLate")
	return null


static func see_medic(p: Dictionary) -> Variant:
	var err = can_see_medic(p)
	if err != null:
		return err
	p.coins = int(p.coins) - medic_cost(p)
	p.injury = null
	Calendar.advance(p, MEDIC_MINUTES)
	return null
