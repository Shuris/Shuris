class_name Training
## Treino no ludus: só energia e tempo; progresso diminui conforme o atributo sobe (TrainingSystem.ts).

const THRESHOLD := 100
const PROGRESS := 25
const IDS := ["str", "res", "agi", "tech"]


static func gain(p: Dictionary, id: String) -> int:
	return maxi(6, int(round((PROGRESS * Upgrades.training_mul(p, id)) / (1 + int(p.trainedBonus[id]) * 0.12))))


static func sessions_to_next(p: Dictionary, id: String) -> int:
	return int(ceil(float(THRESHOLD - int(p.training[id].progress)) / gain(p, id)))


static func xp(p: Dictionary) -> int:
	return 4 + int(p.level) * 2


static func train(p: Dictionary, id: String, rng: Rng) -> Dictionary:
	if int(p.baseAttributes[id]) + int(p.trainedBonus[id]) >= int(Data.constant("MAX_ATTRIBUTE")):
		return {"ok": false, "message": I18n.t("train.maxed"), "attributeGained": false, "xp": 0, "levelUps": 0}
	var tp: Dictionary = p.training[id]
	var g := gain(p, id)
	tp.sessions = int(tp.sessions) + 1
	tp.progress = int(tp.progress) + g
	var gained := false
	if int(tp.progress) >= THRESHOLD:
		tp.progress = int(tp.progress) - THRESHOLD
		p.trainedBonus[id] = int(p.trainedBonus[id]) + 1
		gained = true
	var x := xp(p)
	var ups := Progression.grant_xp(p, x)
	if ups > 0:
		News.on_level(p, rng)
	return {"ok": true, "message": I18n.t("train.gained") if gained else I18n.t("train.progress", {"n": g}), "attributeGained": gained, "xp": x, "levelUps": ups}
