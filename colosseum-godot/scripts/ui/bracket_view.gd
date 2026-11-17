class_name BracketView
## Chave do torneio de sábado: quartas, semifinais, final e campeão.

static func _name_at(p: Dictionary, run: Dictionary, slot: int) -> String:
	var id: String = run.bracket[slot]
	return str(p.name) if id == "player" else Fighters.any_fighter_name(id)


static func _fighter(p: Dictionary, run: Dictionary, slot, winner) -> Control:
	var pc := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color8(40, 28, 20)
	sb.set_content_margin_all(2)
	pc.add_theme_stylebox_override("panel", sb)
	pc.custom_minimum_size = Vector2(96, 20)
	if slot == null:
		pc.add_child(Ui.center(Ui.small("—")))
		return pc
	var me: bool = run.bracket[slot] == "player"
	var lost: bool = winner != null and int(winner) != int(slot)
	var won: bool = winner != null and int(winner) == int(slot)
	sb.border_color = UiTheme.GOLD if me else (Ui.GREEN if won else Color8(80, 60, 44))
	sb.set_border_width_all(1)
	var row := Ui.hbox(2)
	pc.add_child(row)
	row.add_child(Ui.player_portrait(p, 16) if me else Ui.portrait(str(run.bracket[slot]), 16))
	var n := Ui.label(_name_at(p, run, slot), UiTheme.GOLD if me else UiTheme.CREAM, 14, false)
	n.clip_text = true
	n.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(n)
	row.add_child(Ui.tag(str(run.levels[slot]), UiTheme.DIM))
	if lost:
		pc.modulate = Color(0.6, 0.55, 0.5)
	return pc


static func fill(m: Modal, p: Dictionary, run: Dictionary, on_fight: Callable, on_claim: Callable) -> void:
	var b := m.body
	b.add_child(Ui.center(UiTheme.title_label("%s · %s" % [I18n.t("tour.title"), I18n.t("common.dayN", {"n": run.day})], 14, UiTheme.GOLD)))
	var cols := Ui.hbox(4)
	b.add_child(cols)
	for r in 3:
		var pairs: Array = Tournament.round_pairs(run, r) if r <= Tournament.current_round(run) else []
		var start: int = [0, 4, 6][r]
		var count: int = [4, 2, 1][r]
		var col := Ui.vbox(4)
		col.alignment = BoxContainer.ALIGNMENT_CENTER
		cols.add_child(col)
		col.add_child(Ui.center(Ui.small(I18n.t("tour.round%d" % r), UiTheme.BRONZE)))
		for i in count:
			var pair = pairs[i] if i < pairs.size() else null
			var w = run.winners[start + i] if start + i < run.winners.size() else null
			var mv := Ui.vbox(1)
			col.add_child(mv)
			mv.add_child(_fighter(p, run, pair[0] if pair != null else null, w))
			mv.add_child(_fighter(p, run, pair[1] if pair != null else null, w))
	var champ = run.winners[6] if run.winners.size() > 6 else null
	var cc := Ui.vbox(4)
	cc.alignment = BoxContainer.ALIGNMENT_CENTER
	cols.add_child(cc)
	cc.add_child(Ui.center(Ui.small(I18n.t("tour.champion"), UiTheme.GOLD)))
	cc.add_child(_fighter(p, run, champ, champ) if champ != null else Ui.icon("laurel"))
	var match = Tournament.player_match(run)
	if match != null:
		b.add_child(Ui.center(Ui.label(Panels._plain(I18n.t("tour.next", {"round": I18n.t("tour.round%d" % match.round), "name": match.opponent.name, "cls": I18n.tk("class.%s.ep" % Fighters.pool_fighter(str(run.bracket[match.opponentSlot])).get("cls", ""))})), UiTheme.CREAM, 14)))
		m.buttons([Ui.button(I18n.t("tour.later"), m.close), Ui.button(I18n.t("arena.fight"), on_fight, false, "red")])
	else:
		var reached := Tournament.reached_round(run)
		var pr := Tournament.prize(int(p.level), reached)
		b.add_child(Ui.center(Ui.label(I18n.t("tour.result%d" % reached), UiTheme.GOLD if reached == 3 else UiTheme.CREAM)))
		var rb := Ui.hbox(10)
		rb.alignment = BoxContainer.ALIGNMENT_CENTER
		b.add_child(rb)
		if int(pr.coins) > 0:
			ResultView._reward(rb, "coin", "+%d" % pr.coins)
		ResultView._reward(rb, "laurel", "+%d" % pr.fame)
		ResultView._reward(rb, "xp", "+%d XP" % pr.xp)
		m.buttons([Ui.button(I18n.t("tour.claim"), on_claim, false, "gold")])
	m.panel.custom_minimum_size.x = 440
