class_name ResultView
## Tela de resultado da luta: grande, direta, com as recompensas em destaque.

static var on_action: Callable


static func fill(m: Modal, res: Dictionary, rw: Dictionary, opp: Dictionary, again: String, notes: Array, title: String) -> void:
	var won: bool = rw.result == "win"
	var b := m.body
	var sb: StyleBoxFlat = UiTheme.panel_box()
	sb.border_color = UiTheme.GOLD if won else UiTheme.RED
	sb.set_border_width_all(2)
	m.panel.add_theme_stylebox_override("panel", sb)
	b.add_child(Ui.center(UiTheme.title_label(I18n.t("result.victory") if won else I18n.t("result.defeat"), 24, UiTheme.GOLD if won else Color8(224, 106, 90))))
	if title != "":
		b.add_child(Ui.center(Ui.small(title, UiTheme.GOLD)))
	b.add_child(Ui.center(Ui.small("vs %s · %s · %s" % [Names.opponent_full(opp).split(",")[0], I18n.t("reason." + str(res.reason)), Ui.fmt_duration(float(res.duration))], UiTheme.CREAM)))
	var box := Ui.hbox(10)
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	b.add_child(box)
	_reward(box, "xp", "+%d XP" % rw.xp)
	_reward(box, "coin", "+%d" % rw.coins)
	var rep := int(rw.get("reputation", 0))
	if rep != 0:
		_reward(box, "laurel", "%+d" % rep, UiTheme.RED if rep < 0 else UiTheme.GOLD)
	if rw.get("itemId") != null:
		var it := Data.item(str(rw.itemId))
		if not it.is_empty():
			var ir := Ui.hbox(4)
			ir.alignment = BoxContainer.ALIGNMENT_CENTER
			b.add_child(ir)
			ir.add_child(Ui.item_icon(it))
			ir.add_child(Ui.label(Names.item_name(it), Ui.rarity_color(it.get("rarity", "common")), 16, false))
	var ups := int(rw.get("levelUps", 0))
	if ups > 0:
		b.add_child(Ui.center(Ui.label(I18n.t("app.levelUp", {"level": rw.newLevel, "points": ups * 3, "skill": ups}), UiTheme.GOLD)))
	var unl = rw.get("unlockedOpponent")
	if unl != null:
		b.add_child(Ui.center(Ui.label("%s %s" % [Panels._plain(I18n.t("result.newRival")), unl.name], Ui.GREEN)))
	if rw.get("festival", false) and rep > 0:
		b.add_child(Ui.center(Ui.label(I18n.t("result.festival"), UiTheme.GOLD)))
	if rw.get("mode") == "rematch" and won:
		b.add_child(Ui.center(Ui.label(I18n.t("result.rematchWon"), UiTheme.GOLD)))
	if rw.get("rematchAsked", false):
		b.add_child(Ui.center(Ui.label(Panels._plain(I18n.t("result.rematchAsked", {"name": opp.name})), UiTheme.RED)))
	if int(rw.get("injuryDays", 0)) > 0:
		b.add_child(Ui.center(Ui.label(I18n.t("injury.got", {"n": rw.injuryDays}), UiTheme.RED)))
	var spared := false
	for n in notes:
		if n.text == I18n.t("result.spared"):
			spared = true
		b.add_child(Ui.center(Ui.label(Panels._plain(n.text), UiTheme.RED if n.get("bad", false) else Ui.GREEN, 14)))
	if not (won or int(rw.get("injuryDays", 0)) > 0 or rw.get("mode") in ["invite", "duo"] or spared):
		b.add_child(Ui.center(Ui.small(I18n.t("result.noLoss"))))
	var energy := int(Game.p.energy)
	b.add_child(Ui.center(Ui.small(Panels._plain(I18n.t("result.energyLeft", {"n": energy}) + (I18n.t("result.rest") if energy < 35 else "")))))
	var btns := []
	if ups > 0:
		btns.append(Ui.button(I18n.t("result.usePoints"), func(): on_action.call("points"), false, "gold"))
	btns.append(Ui.button(I18n.t("common.continue"), func(): on_action.call("close")))
	if again != "":
		var t := I18n.t("result.nextChallenger") if again == "free" else (I18n.t("invite.fightFinal") if again == "final" else I18n.t("result.retry"))
		btns.append(Ui.button(t, func(): on_action.call("again"), false, "red"))
	m.buttons(btns)
	Sfx.play("victory" if won else "defeat")


static func _reward(box: HBoxContainer, icon: String, text: String, color := UiTheme.GOLD) -> void:
	var h := Ui.hbox(2)
	box.add_child(h)
	h.add_child(Ui.icon(icon))
	h.add_child(UiTheme.title_label(text, 12, color))
