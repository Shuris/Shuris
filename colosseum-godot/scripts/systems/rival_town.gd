class_name RivalTown
## Rivais derrotados pela cidade; quem odeia o jogador não aparece (RivalTownSystem.ts).

const HOME := {"marcus": "tavern", "cassius": "market", "rufus": "baths", "brutus": "ludus", "spiculus": "temple",
	"crixus": "tavern", "verus": "baths", "priscus": "market", "flamma": "temple"}
const HATERS := ["brutus", "crixus", "priscus"]
const CHAT_MIN := 10
const CHAT_MAX := 15


static func is_hater(id) -> bool:
	return HATERS.has(id)


static func rivals_at(p: Dictionary, loc: String) -> Array:
	var out := []
	for id in p.defeatedOpponents:
		if HOME.get(id) == loc and not is_hater(id) and not Data.opponent(id).is_empty():
			out.append(Data.opponent(id))
	return out


static func chatted_today(p: Dictionary, id: String) -> bool:
	return int(p.career.chatDays.get(id, -1)) == int(p.day)


## 'done' | 'hate' | {friend, gain}
static func chat(p: Dictionary, id: String, rnd := -1.0) -> Variant:
	if is_hater(id):
		return "hate"
	if chatted_today(p, id):
		return "done"
	p.career.chatDays[id] = p.day
	var r := randf() if rnd < 0 else rnd
	var gain := CHAT_MIN + int(floor(r * (CHAT_MAX - CHAT_MIN + 1)))
	return {"friend": Duo.add_respect(p, id, gain), "gain": gain}
