class_name Dialogue
## Falas dos adversários e dos moradores (talk.<quem>.<momento> e npc.<quem> no
## dicionário, com variantes separadas por "|").

static func talk(who: String, moment: String, pick: int, params: Dictionary = {}) -> String:
	var raw := I18n.tk("talk.%s.%s" % [who, moment], params, "")
	if raw == "":
		raw = I18n.tk("talk.any.%s" % moment, params, "")
	return I18n.variant(raw, pick) if raw != "" else ""


static func npc_line(who: String, pick: int, params: Dictionary = {}) -> String:
	var raw := I18n.tk("npc." + who, params, "")
	return I18n.variant(raw, pick) if raw != "" else ""
