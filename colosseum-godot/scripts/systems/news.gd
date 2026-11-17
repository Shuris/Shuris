class_name News
## Cápua Times: notícias geradas pelos acontecimentos e publicadas na manhã seguinte
## (NewsSystem.ts). Cada notícia guarda o modelo e as variáveis (aparece no idioma atual).

const FAME_MILESTONES := [10, 25, 50, 80, 120, 180, 250, 350, 450, 600]
const MAX_EDITIONS := 30
const TPL := {"debut": 2, "fame": 5, "victory": 3, "champion": 1, "arena": 1, "streak3": 1, "streak5": 1, "streak10": 1,
	"comeback": 1, "lossKo": 2, "lossDecision": 1, "lossForfeit": 1, "slump": 1, "level": 2, "rival": 3, "city": 30,
	"tavern": 2, "rematchAsk": 2, "rematchWin": 1, "rematchLose": 1, "rematchFled": 1, "festivalSoon": 1, "festival": 2,
	"merchant": 2, "armWin": 2, "tourneySoon": 1, "tourneyToday": 2, "tourneyWin": 2, "tourneyFinal": 1, "tourneyOut": 1,
	"tourneyNoShow": 1, "invite": 2, "inviteWin": 2, "venatio": 2, "beastWin": 2, "duoWin": 2, "rankUpset": 2}
const IMAGES := {"debut": ["newcomer"], "fame": ["crowd", "statue"], "victory": ["victory"], "champion": ["colosseum"],
	"arena": ["colosseum"], "streak3": ["crowd"], "streak5": ["victory"], "streak10": ["statue"], "comeback": ["victory"],
	"lossKo": ["defeat"], "lossDecision": ["defeat"], "lossForfeit": ["defeat"], "slump": ["training"], "level": ["training"],
	"rival": ["rival"], "tavern": ["tavern"], "rematchAsk": ["rival"], "rematchWin": ["victory"], "rematchLose": ["defeat"],
	"rematchFled": ["rival"], "festivalSoon": ["festival"], "festival": ["festival"], "merchant": ["merchant"],
	"armWin": ["armwrestle"], "tourneySoon": ["tournament"], "tourneyToday": ["tournament"], "tourneyWin": ["tournament"],
	"tourneyFinal": ["tournament"], "tourneyOut": ["tournament"], "tourneyNoShow": ["tournament"], "invite": ["colosseum"],
	"inviteWin": ["victory", "crowd"], "venatio": ["crowd"], "beastWin": ["crowd", "victory"], "duoWin": ["victory"], "rankUpset": ["rival"]}
const CITY_IMAGES := ["market", "forum", "ship", "baths", "theater", "rain", "temple", "market", "forum", "market", "rain",
	"temple", "baths", "market", "temple", "forum", "forum", "market", "market", "forum", "ship", "theater", "baths", "ship",
	"forum", "ship", "temple", "theater", "forum", "temple"]
const SINGLE := ["streak", "defeat"]
const PRIORITY := ["champion", "tourneyWin", "inviteWin", "beastWin", "duoWin", "invite", "victory", "rematchWin", "streak10",
	"streak5", "comeback", "streak3", "tourneyFinal", "rematchAsk", "armWin", "arena", "level", "fame", "rival", "tavern",
	"lossKo", "lossDecision", "lossForfeit", "rematchLose", "slump", "tourneyOut", "rematchFled", "tourneyNoShow", "rankUpset"]
const RESULT := ["champion", "tourneyWin", "victory", "rematchWin", "streak10", "streak5", "comeback", "streak3", "tourneyFinal",
	"lossKo", "lossDecision", "lossForfeit", "rematchLose", "slump", "tourneyOut"]


static func next_rival(p: Dictionary) -> Dictionary:
	for o in Data.d.opponents:
		if not p.defeatedOpponents.has(o.id):
			return o
	return Data.d.opponents[-1]


static func _base_vars(p: Dictionary, extra: Dictionary) -> Dictionary:
	var rival := next_rival(p)
	var v := {"name": p.name, "origin": p.origin, "rival": rival.id, "arena": Fighters.arena_for_opponent(rival.id).id}
	v.merge(extra, true)
	return v


static func _resolve(v: Dictionary) -> Dictionary:
	var out := v.duplicate()
	out.city = I18n.t("news.city")
	out.origin = Data.origin_name(str(v.get("origin", ""))).to_lower()
	out.rival = Fighters.any_fighter_name(str(v.get("rival", "")))
	out.opp = Fighters.any_fighter_name(str(v.get("opp", "")))
	var ar := Fighters.arena(str(v.get("arena", "")))
	out.arena = Names.arena_name(ar.id) if not ar.is_empty() else str(v.get("arena", ""))
	return out


static func _cap(s: String) -> String:
	return s.substr(0, 1).to_upper() + s.substr(1) if s != "" else s


static func headline(n: Dictionary) -> String:
	return _cap(I18n.tk("news.%s.h" % n.tpl, _resolve(n.get("v", {})), n.get("headline", ""))) if n.get("tpl") else str(n.get("headline", ""))


static func body(n: Dictionary) -> String:
	return _cap(I18n.tk("news.%s.b" % n.tpl, _resolve(n.get("v", {})), n.get("body", ""))) if n.get("tpl") else str(n.get("body", ""))


static func _add(p: Dictionary, kind: String, group: String, rng: Rng, extra: Dictionary = {}) -> Dictionary:
	var idx := int(floor(rng.next() * TPL[group]))
	var v := _base_vars(p, extra)
	if SINGLE.has(kind):
		p.news.pending = p.news.pending.filter(func(n): return n.kind != kind)
	var item := {"id": "n%d-%d-%d" % [int(p.day), p.news.pending.size(), int(floor(rng.next() * 1e6))], "kind": kind, "tpl": "%s.%d" % [group, idx], "v": v, "headline": "", "body": ""}
	item.headline = headline(item)
	item.body = body(item)
	p.news.pending.append(item)
	return item


static func _illustrate(item, rng: Rng, chance: float) -> void:
	if item == null or not item.get("tpl") or rng.next() >= chance:
		return
	var parts: PackedStringArray = str(item.tpl).split(".")
	var pool: Array = [CITY_IMAGES[int(parts[1]) % CITY_IMAGES.size()]] if parts[0] == "city" else IMAGES.get(parts[0], [])
	if pool.size() > 0:
		item.img = rng.pick(pool)


static func debut_edition(p: Dictionary, rng: Rng) -> void:
	_illustrate(_add(p, "debut", "debut", rng), rng, 1.0)
	_add(p, "city", "city", rng)
	p.news.editions.push_front({"day": p.day, "items": p.news.pending.duplicate(), "read": false})
	p.news.pending.clear()


static func check_fame(p: Dictionary, rng: Rng) -> void:
	for m in FAME_MILESTONES:
		var key := "fame%d" % m
		if int(p.reputation) >= m and not p.news.milestones.has(key):
			p.news.milestones.append(key)
			_add(p, "fame", "fame", rng)
			if rng.next() < 0.5:
				_add(p, "rival", "rival", rng)


static func on_level(p: Dictionary, rng: Rng) -> void:
	for lv in [5, 10, 15, 20, 25, 30]:
		var key := "level%d" % lv
		if int(p.level) >= lv and not p.news.milestones.has(key):
			p.news.milestones.append(key)
			_add(p, "level", "level", rng)


static func on_tavern_talk(p: Dictionary, rng: Rng) -> void:
	if rng.next() < 0.6:
		_add(p, "rival", "tavern", rng)


static func on_battle(p: Dictionary, opp: Dictionary, won: bool, first_victory: bool, rng: Rng, reason := "ko", prev_streak := 0, mode := "ladder") -> void:
	var where := {"opp": opp.id, "arena": Fighters.arena_for_opponent(opp.id).id}
	if mode == "rematch":
		_add(p, "rival", "rematchWin" if won else "rematchLose", rng, where)
	if won:
		if first_victory:
			if opp.id == Data.d.opponents[-1].id:
				_add(p, "champion", "champion", rng)
			else:
				_add(p, "victory", "victory", rng, where)
				var nx := next_rival(p)
				if Fighters.arena_for_opponent(nx.id).id != Fighters.arena_for_opponent(opp.id).id:
					_add(p, "arena", "arena", rng)
		if prev_streak <= -2:
			_add(p, "streak", "comeback", rng, where)
		if int(p.streak) == 3:
			_add(p, "streak", "streak3", rng)
		if int(p.streak) == 5:
			_add(p, "streak", "streak5", rng)
		if int(p.streak) == 10:
			_add(p, "streak", "streak10", rng)
	else:
		p.news.pending = p.news.pending.filter(func(n): return n.kind != "streak")
		if int(p.streak) == -3:
			_add(p, "defeat", "slump", rng, where)
		elif mode != "rematch":
			_add(p, "defeat", "lossForfeit" if reason == "forfeit" else ("lossDecision" if reason == "decision" else "lossKo"), rng, where)
	check_fame(p, rng)
	on_level(p, rng)


static func on_rematch_asked(p: Dictionary, opp_id: String, rng: Rng) -> void:
	_illustrate(_add(p, "rival", "rematchAsk", rng, {"opp": opp_id}), rng, 0.6)


static func on_event(p: Dictionary, group: String, rng: Rng, extra: Dictionary = {}) -> void:
	var item := _add(p, "tournament" if group.begins_with("tourney") else "event", group, rng, extra)
	if group == "tourneyWin" or group == "armWin":
		_illustrate(item, rng, 0.8)


static func on_career(p: Dictionary, group: String, rng: Rng, extra: Dictionary = {}) -> void:
	var item := _add(p, "rival" if group == "rankUpset" else "event", group, rng, extra)
	if group != "rankUpset":
		_illustrate(item, rng, 0.7)


static func _city_events(p: Dictionary, rng: Rng) -> void:
	var day := int(p.day)
	if Events.is_festival(day):
		_illustrate(_add(p, "event", "festival", rng), rng, 0.8)
	elif Events.is_festival(day + 1):
		_add(p, "event", "festivalSoon", rng)
	if Events.is_merchant_day(int(p.createdAt), day):
		_illustrate(_add(p, "event", "merchant", rng), rng, 0.5)
	if Venatio.is_day(int(p.createdAt), day):
		_illustrate(_add(p, "event", "venatio", rng), rng, 0.5)
	if Calendar.weekday_index(day) == 6 and int(p.tournament.registered) == day:
		_illustrate(_add(p, "tournament", "tourneyToday", rng), rng, 0.8)
	elif Calendar.weekday_index(day) == 5:
		_add(p, "event", "tourneySoon", rng)


static func _group_of(n: Dictionary) -> String:
	return str(n.tpl).split(".")[0] if n.get("tpl") else ""


static func _mentioned(n: Dictionary) -> Array:
	if not n.get("tpl") or n.get("v") == null:
		return []
	var raw := "%s %s" % [I18n.tk("news.%s.h" % n.tpl), I18n.tk("news.%s.b" % n.tpl)]
	var out := []
	if raw.contains("{opp}") and n.v.get("opp"):
		out.append(str(n.v.opp))
	if raw.contains("{rival}") and n.v.get("rival"):
		out.append(str(n.v.rival))
	return out


static func edition_items(items: Array) -> Array:
	var rank := func(n):
		var i := PRIORITY.find(_group_of(n))
		return PRIORITY.size() if i < 0 else i
	var sorted := Stats.stable_sort(items, func(a, b): return rank.call(a) < rank.call(b))
	var seen := {}
	var result := false
	var keep := []
	for n in sorted:
		var g := _group_of(n)
		var opps := _mentioned(n)
		if opps.any(func(o): return seen.has(o)):
			continue
		if RESULT.has(g):
			if result:
				continue
			result = true
		for o in opps:
			seen[o] = true
		keep.append(n)
	return keep


## Publica a edição do dia (ao acordar). Retorna a edição se houver notícias do gladiador.
static func publish(p: Dictionary, rng: Rng) -> Variant:
	var own := edition_items(p.news.pending.duplicate()).slice(0, 5)
	p.news.pending = []
	_city_events(p, rng)
	own.append_array(p.news.pending)
	p.news.pending = []
	var items := own.duplicate()
	_add(p, "city", "city", rng)
	items.append_array(p.news.pending)
	p.news.pending = []
	_illustrate(items[0] if items.size() > 0 else null, rng, 0.7)
	if items.size() > 0 and not items[0].has("img"):
		_illustrate(items[-1], rng, 0.4)
	var edition := {"day": p.day, "items": items, "read": false}
	p.news.editions.push_front(edition)
	while p.news.editions.size() > MAX_EDITIONS:
		p.news.editions.pop_back()
	return edition if own.size() > 0 else null


static func unread_count(p: Dictionary) -> int:
	return p.news.editions.filter(func(e): return not e.read).size()
