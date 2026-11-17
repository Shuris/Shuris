class_name PlayerFactory
## Gladiador novo: o mesmo estado da versão TypeScript (PlayerState, versão 5).

const SAVE_VERSION := 5
const STARTING_COINS := 150
const MAX_NAME_LENGTH := 24
const ATTR_KEYS := ["str", "vit", "res", "agi", "prec", "tech"]


static func sanitize_name(raw: String) -> String:
	var rx := RegEx.new()
	rx.compile("[\\x00-\\x1f<>]")
	var s := rx.sub(raw, "", true)
	rx.compile("\\s+")
	s = rx.sub(s, " ", true).strip_edges()
	return s.substr(0, MAX_NAME_LENGTH)


## null = nome válido; senão, a mensagem de erro.
static func validate_name(raw: String) -> Variant:
	var n := sanitize_name(raw)
	if n.length() < 2:
		return I18n.t("err.nameShort")
	var rx := RegEx.new()
	rx.compile("^[\\p{L}\\p{N} '.-]+$")
	if rx.search(n) == null:
		return I18n.t("err.nameChars")
	return null


## Gladiador novo com a edição de estreia do jornal (createPlayer da versão TS).
static func new_player(name: String, origin_id: String, appearance: Dictionary, now_ms: int) -> Dictionary:
	var p := create(name, origin_id, appearance, now_ms)
	News.debut_edition(p, Rng.new(now_ms))
	return p


## Estado de um gladiador recém-chegado (mesmos campos e valores iniciais do jogo atual).
static func create(name: String, origin_id: String, appearance: Dictionary, now_ms: int) -> Dictionary:
	var origin := Data.origin(origin_id)
	var base := {}
	for k in ATTR_KEYS:
		base[k] = int(Data.constant("BASE_ATTRIBUTE")) + int(origin.bonus.get(k, 0))
	var trained := {}
	for k in ATTR_KEYS:
		trained[k] = 0
	return {
		"version": SAVE_VERSION,
		"name": sanitize_name(name),
		"origin": origin.id,
		"appearance": appearance.duplicate(),
		"level": 1, "xp": 0, "coins": STARTING_COINS, "reputation": 0,
		"baseAttributes": base, "trainedBonus": trained, "unspentPoints": 0,
		"training": {
			"str": {"progress": 0, "sessions": 0}, "res": {"progress": 0, "sessions": 0},
			"agi": {"progress": 0, "sessions": 0}, "tech": {"progress": 0, "sessions": 0},
		},
		"equipment": {"mainHand": "i1", "offHand": null, "head": null, "body": null, "legs": null},
		"inventory": [{"uid": "i1", "itemId": "rudis"}],
		"history": [],
		"stats": {"wins": 0, "losses": 0, "battles": 0},
		"strategy": "balanced",
		"defeatedOpponents": [],
		"selectedOpponent": Data.d.opponents[0].id,
		"settings": {"battleSpeed": 1, "autoContinue": false, "tipsSeen": [], "volume": 0.7, "muted": false, "language": I18n.lang},
		"nextUid": 2,
		"day": 1, "minutes": 8 * 60, "energy": 100, "location": "home",
		"skillPoints": 2, "perks": [], "respecs": 0, "streak": 0,
		"news": {"editions": [], "pending": [], "milestones": []},
		"upgrades": [],
		"tavern": {"rumorDay": 0, "heard": []},
		"rivals": {}, "rematch": null, "lastRematchDay": 0, "injury": null,
		"tournament": {"registered": 0, "run": null, "titles": 0, "best": -1},
		"events": {"armDay": 0, "armWins": 0, "merchantDay": 0, "merchantBought": [], "freeDay": 0, "freeCount": 0},
		"career": {
			"invites": [], "respect": {}, "partner": null, "quest": null, "questsDone": 0, "questDay": 0,
			"rank": [], "rankDay": 0, "rankPts": 0, "rankPrev": 0, "talkDay": 0, "chatDays": {},
			"beastDay": 0, "beastWins": 0, "duoWins": 0, "duoDay": 0, "thumbsUp": 0,
		},
		"createdAt": now_ms, "updatedAt": now_ms,
	}
