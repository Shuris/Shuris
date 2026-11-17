class_name Panels
## Conteúdo do painel lateral de cada local (porte das telas do jogo em HTML).
## Cada função recebe a Hud (`h`): `h.body` é onde se monta, `h.app` executa as ações
## e `h.st` guarda o estado da interface (abas internas, seleção).

static func build(h: Hud, id: String) -> void:
	match id:
		"arena":
			arena(h)
		"ludus":
			ludus(h)
		"market":
			market(h)
		"temple":
			temple(h)
		"home":
			home(h)
		"baths":
			baths(h)
		"tavern":
			tavern(h)
		"forum":
			forum(h)


static func _add(h: Hud, c: Control) -> Control:
	h.body.add_child(c)
	return c


static func _hint(h: Hud, text: String, bad := false) -> void:
	_add(h, Ui.center(Ui.small(text, UiTheme.RED if bad else UiTheme.DIM)))


static func _setst(h: Hud, key: String, v) -> void:
	h.st[key] = v
	h.refresh()


static func _upd(fn: Callable, toast_ok := "", sound := "coin") -> Variant:
	var r = Game.update(fn)
	return r


# ------------------------------------------------------------------ arena
static func _chance_tag(def: Dictionary) -> Label:
	var c := Act.win_chance(Game.p, def)
	var d := Act.difficulty(c)
	return Ui.tag("%s %d%%" % [d.label, roundi(c * 100)], d.color)


static func arena(h: Hud) -> void:
	var p := Game.p
	var fight_err = Calendar.can_fight(p)
	if Events.is_festival(int(p.day)):
		_add(h, Ui.center(Ui.label(I18n.t("event.festivalBanner"), UiTheme.GOLD, 14)))
	if p.get("injury") != null:
		_add(h, Ui.label(I18n.t("injury.note", {"n": p.injury.days}), UiTheme.RED, 14))
	# cartão do gladiador
	var st: Dictionary = Stats.player_combatant(p).spec.stats
	var hc := Ui.card(h.body)
	var top := Ui.hbox(4)
	hc.add_child(top)
	top.add_child(Ui.player_portrait(p, 24))
	var info := Ui.vbox(0)
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(info)
	info.add_child(Ui.label("%s  %s" % [p.name, I18n.t("common.lv", {"n": p.level})], UiTheme.GOLD, 14))
	var sr := Ui.hbox(2)
	info.add_child(sr)
	for pair in [["attr_vit", str(int(st.maxHp))], ["attr_str", str(roundi(float(st.baseDamage)))], ["attr_res", "%d%%" % roundi(float(st.damageReduction) * 100)]]:
		sr.add_child(Ui.icon(pair[0]))
		sr.add_child(Ui.tag(pair[1], UiTheme.CREAM))
	if int(p.unspentPoints) > 0:
		top.add_child(Ui.button("+%d" % p.unspentPoints, func(): h.open_sheet("gladiator"), false, "gold"))
	# abas
	var tab: String = h.st.get("arenaTab", "fights")
	if tab == "duo" and not Duo.unlocked(p):
		tab = "fights"
	var badge := " •" if (Venatio.is_day(int(p.createdAt), int(p.day)) and Venatio.check(p) == null) or Invites.open_invites(p).size() > 0 else ""
	var tabs := [["fights", I18n.t("arena.tabFights")], ["events", I18n.t("arena.tabEvents") + badge]]
	if Duo.unlocked(p):
		tabs.append(["duo", I18n.t("arena.tabDuo")])
	Ui.subtabs(h.body, tabs, tab, func(id): _setst(h, "arenaTab", id))
	_hint(h, str(fight_err) if fight_err != null else I18n.t("arena.cost", {"energy": Calendar.FIGHT_ENERGY}), fight_err != null)
	match tab:
		"fights":
			_arena_fights(h, fight_err)
		"events":
			_venatio_card(h, fight_err)
			_tournament_card(h)
			_invite_cards(h, fight_err)
		"duo":
			_duo_card(h, fight_err)


static func _arena_fights(h: Hud, fight_err) -> void:
	var p := Game.p
	# estratégia
	var strat := Ui.hbox(2)
	h.body.add_child(strat)
	for s in Data.d.strategies.keys():
		var id: String = s
		var b := Ui.button(Names.strategy_name(id), func(): Game.update(func(pl): pl.strategy = id))
		b.toggle_mode = true
		b.button_pressed = p.strategy == id
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.clip_text = true
		b.add_theme_font_size_override("font_size", 14)
		strat.add_child(b)
	_add(h, Ui.small(Names.strategy_desc(str(p.strategy))))
	# pedido de revanche
	var rem = null
	if p.get("rematch") != null and Rivals.rematch_active(p, str(p.rematch.opponentId)):
		rem = Data.opponent(str(p.rematch.opponentId))
	if rem != null and not rem.is_empty():
		var rc := Ui.card(h.body, UiTheme.RED)
		var row := Ui.hbox(4)
		rc.add_child(row)
		row.add_child(Ui.portrait(rem.id, 24))
		var col := Ui.vbox(0)
		col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(col)
		col.add_child(Ui.label(I18n.t("rival.asked", {"name": rem.name}), UiTheme.CREAM, 14))
		col.add_child(Ui.small(I18n.t("rival.askedHint", {"day": p.rematch.expires})))
		var rid: String = rem.id
		rc.add_child(Ui.button(I18n.t("rival.accept"), func(): h.app.start_battle({"mode": "ladder", "opponentId": rid}), fight_err != null, "red"))
	# desafiante avulso
	var c := Act.todays_challenger(p)
	var cc := Ui.card(h.body)
	var crow := Ui.hbox(4)
	cc.add_child(crow)
	crow.add_child(Ui.portrait(c.id, 32))
	var ci := Ui.vbox(0)
	ci.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	crow.add_child(ci)
	ci.add_child(Ui.small(I18n.t("arena.challenger")))
	ci.add_child(Ui.label(str(c.name), UiTheme.CREAM, 14))
	ci.add_child(Ui.small(Names.opponent_epithet(c)))
	var cr := Ui.hbox(4)
	cc.add_child(cr)
	cr.add_child(Ui.tag(I18n.t("common.lv", {"n": c.level}), UiTheme.DIM))
	cr.add_child(_chance_tag(c))
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cr.add_child(sp)
	cr.add_child(Ui.button(I18n.t("arena.fight"), func(): h.app.start_battle({"mode": "free"}), fight_err != null, "red"))
	# adversário escolhido
	_add(h, Ui.heading(I18n.t("arena.opponents")))
	var sel := Data.opponent(str(p.selectedOpponent))
	if sel.is_empty():
		sel = Data.d.opponents[0]
	var sel_err = Rivals.ladder_check(p, sel.id)
	var sel_def := Rivals.fight_def(p, sel)
	if Rivals.is_unlocked(p, sel.id):
		var dc := Ui.card(h.body, UiTheme.BRONZE)
		var drow := Ui.hbox(4)
		dc.add_child(drow)
		drow.add_child(Ui.portrait(sel.id, 40))
		var di := Ui.vbox(0)
		di.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		drow.add_child(di)
		var ep := Names.opponent_epithet(sel)
		di.add_child(Ui.label(str(sel.name) + (", " + ep if ep != "" else ""), UiTheme.GOLD, 14))
		var rec = p.rivals.get(sel.id)
		var trait_id: String = Data.d.get("personality", {}).get(sel.id, "proud")
		di.add_child(Ui.small(I18n.tk("trait." + trait_id) + " · " + (I18n.t("rival.record", {"w": rec.wins, "l": rec.losses}) if rec != null else I18n.t("rival.firstMeet"))))
		dc.add_child(Ui.small(Names.opponent_desc(sel)))
		var boost := int(sel_def.level) - int(sel.level)
		if boost > 0:
			dc.add_child(Ui.small(I18n.t("rival.trained", {"n": boost}), UiTheme.RED))
	var fb := Ui.card(h.body)
	var frow := Ui.hbox(4)
	fb.add_child(frow)
	var fl := Ui.small("vs %s · %s" % [sel.name, Names.arena_name(Fighters.arena_for_opponent(sel.id).id)], UiTheme.CREAM)
	frow.add_child(fl)
	if sel_err != null:
		fb.add_child(Ui.small(str(sel_err)))
	else:
		frow.add_child(_chance_tag(sel_def))
	fb.add_child(Ui.wide(Ui.button(I18n.t("rival.accept") if Rivals.rematch_active(p, sel.id) else I18n.t("arena.fight"),
		func(): h.app.start_battle({"mode": "ladder"}), sel_err != null or fight_err != null, "red")))
	# escada de adversários por arena
	for ar in Data.d.arenas:
		var opps: Array = Data.d.opponents.filter(func(o): return Fighters.arena_for_opponent(o.id).id == ar.id)
		if opps.is_empty():
			continue
		_add(h, Ui.small(Names.arena_name(ar.id), UiTheme.BRONZE))
		for o in opps:
			_opp_row(h, o, sel.id)


static func _opp_row(h: Hud, o: Dictionary, sel_id: String) -> void:
	var p := Game.p
	var unlocked := Rivals.is_unlocked(p, o.id)
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(0, 22)
	b.toggle_mode = true
	b.button_pressed = o.id == sel_id
	b.disabled = not unlocked
	h.body.add_child(b)
	var row := Ui.hbox(3)
	row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	row.offset_left = 2
	row.offset_right = -3
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(row)
	row.add_child(Ui.portrait(o.id if unlocked else "locked", 18))
	var beaten: bool = p.defeatedOpponents.has(o.id)
	var rematch := Rivals.rematch_active(p, o.id)
	var n := Ui.label(str(o.name) if unlocked else "???", UiTheme.GOLD if rematch else (UiTheme.DIM if beaten else UiTheme.CREAM), 14, false)
	n.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	n.clip_text = true
	n.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(n)
	if beaten:
		var lr := Ui.icon("laurel")
		lr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(lr)
	var rec = p.rivals.get(o.id)
	var lv := Ui.tag(("%d–%d " % [rec.wins, rec.losses] if rec != null and unlocked else "") + I18n.t("common.lv", {"n": o.level}), UiTheme.DIM)
	lv.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(lv)
	var oid: String = o.id
	b.pressed.connect(func(): Game.update(func(pl): pl.selectedOpponent = oid))


static func _venatio_card(h: Hud, fight_err) -> void:
	var p := Game.p
	if not Venatio.is_day(int(p.createdAt), int(p.day)):
		var nx := Venatio.next_day(int(p.createdAt), int(p.day) + 1)
		if nx > 0:
			_hint(h, I18n.t("venatio.next", {"day": nx}))
		return
	var beast := Venatio.beast_of_day(p)
	var err = Venatio.check(p)
	var c := Ui.card(h.body, Color8(150, 110, 60))
	var row := Ui.hbox(4)
	c.add_child(row)
	row.add_child(Ui.portrait(beast.id, 32))
	var col := Ui.vbox(0)
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(col)
	col.add_child(Ui.small(I18n.t("venatio.today"), UiTheme.GOLD))
	col.add_child(Ui.label(I18n.tk("beast.%s.name" % beast.beast), UiTheme.CREAM, 14))
	col.add_child(Ui.small("%s · %s" % [I18n.t("common.lv", {"n": beast.level}), I18n.t("venatio.fame", {"n": Venatio.FAME_MUL})]))
	c.add_child(Ui.button(I18n.t("venatio.done") if err == "done" else I18n.t("venatio.fight"), func(): h.app.start_battle({"mode": "beast"}), err != null or fight_err != null, "red"))


static func _tournament_card(h: Hud) -> void:
	var p := Game.p
	var tr: Dictionary = p.tournament
	var sat := Tournament.next_saturday(int(p.day))
	var hour := Tournament.START / 60
	var c := Ui.card(h.body, UiTheme.BRONZE)
	var head := Ui.hbox(4)
	c.add_child(head)
	head.add_child(Ui.label(I18n.t("tour.title"), UiTheme.GOLD, 14))
	head.add_child(Ui.tag(I18n.t("tour.when", {"hour": hour}) + (" · " + I18n.t("tour.titles", {"n": tr.titles}) if int(tr.get("titles", 0)) > 0 else ""), UiTheme.DIM))
	if tr.run != null:
		c.add_child(Ui.button(I18n.t("tour.openBracket"), func(): h.app.tournament("bracket"), false, "gold"))
	elif tr.registered != null and int(tr.registered) == sat:
		if Tournament.is_saturday(int(p.day)):
			var err = Tournament.can_start(p)
			c.add_child(Ui.button(I18n.t("tour.start"), func(): h.app.tournament("start"), err != null, "red"))
			c.add_child(Ui.center(Ui.small(str(err) if err != null else I18n.t("tour.startHint"), UiTheme.RED if err != null else UiTheme.DIM)))
		else:
			c.add_child(Ui.center(Ui.small(I18n.t("tour.registered", {"day": sat, "hour": hour}), UiTheme.GOLD)))
	else:
		var err2 = Tournament.can_register(p)
		c.add_child(Ui.button("%s  %d" % [I18n.t("tour.register"), Tournament.entry_fee(p)], func(): h.app.tournament("register"), err2 != null, "gold", "coin"))
		c.add_child(Ui.center(Ui.small(str(err2) if err2 != null else I18n.t("tour.registerHint", {"day": sat, "hour": hour}), UiTheme.RED if err2 != null else UiTheme.DIM)))


static func _invite_cards(h: Hud, fight_err) -> void:
	var p := Game.p
	var open := Invites.open_invites(p)
	var next = null
	for d in Invites.DEFS:
		if not p.career.invites.any(func(i): return i.id == d.id):
			next = d
			break
	if open.is_empty() and next == null:
		return
	_add(h, Ui.heading(I18n.t("invite.title")))
	for inv in open:
		var def := Invites.def(inv.id)
		var foe = Invites.foe(inv)
		if def.is_empty() or foe == null:
			continue
		var c := Ui.card(h.body, Color8(168, 120, 220))
		var head := Ui.hbox(4)
		c.add_child(head)
		head.add_child(Ui.label(I18n.tk("invite.%s.title" % inv.id), UiTheme.GOLD, 14))
		if def.kind == "tournament":
			head.add_child(Ui.tag(I18n.t("invite.semi") if int(inv.round) == 0 else I18n.t("invite.final")))
		c.add_child(Ui.small(I18n.tk("invite.%s.desc" % inv.id)))
		var row := Ui.hbox(4)
		c.add_child(row)
		row.add_child(Ui.portrait(foe.id, 24))
		row.add_child(Ui.small("vs %s, %s · %s\n%s" % [foe.name, Names.opponent_epithet(foe), I18n.t("common.lv", {"n": foe.level}), Names.arena_name(inv.id)], UiTheme.CREAM))
		var iid: String = inv.id
		c.add_child(Ui.button(I18n.t("invite.go"), func(): h.app.start_battle({"mode": "invite", "inviteId": iid}), fight_err != null, "red"))
	if next != null:
		_hint(h, I18n.t("invite.next", {"n": next.fame}))


static func _duo_card(h: Hud, fight_err) -> void:
	var p := Game.p
	_add(h, Ui.heading(I18n.t("duo.title")))
	var fr := Duo.friends(p)
	if fr.is_empty():
		_add(h, Ui.small(I18n.t("duo.howTo")))
		return
	var partner = Duo.partner_def(p)
	var c := Ui.card(h.body)
	c.add_child(Ui.small(I18n.t("duo.rules")))
	for o in fr:
		var chosen: bool = partner != null and partner.id == o.id
		var row := Ui.hbox(4)
		c.add_child(row)
		row.add_child(Ui.portrait(o.id, 18))
		var n := Ui.label(str(o.name), UiTheme.CREAM, 14)
		row.add_child(n)
		var oid: String = o.id
		row.add_child(Ui.button(I18n.t("duo.partner") if chosen else I18n.t("duo.choose"), func(): h.app.set_partner(oid), false, "gold" if chosen else ""))
	if partner != null:
		var fs := Duo.foes(p)
		var fr2 := Ui.hbox(3)
		c.add_child(fr2)
		fr2.add_child(Ui.small("vs"))
		fr2.add_child(Ui.portrait(fs[0].id, 18))
		fr2.add_child(Ui.portrait(fs[1].id, 18))
		fr2.add_child(Ui.small("%s & %s · %s" % [fs[0].name, fs[1].name, I18n.t("common.lv", {"n": fs[0].level})], UiTheme.CREAM))
	var err = Duo.check(p)
	var label := I18n.t("duo.fight", {"n": Duo.ENERGY})
	if err != null:
		label = I18n.t({"notToday": "duo.notToday", "noPartner": "duo.needPartner", "done": "duo.done"}.get(err, "arena.unavailable"))
	c.add_child(Ui.button(label, func(): h.app.start_battle({"mode": "duo"}), err != null or fight_err != null, "red"))


# ------------------------------------------------------------------ ludus
static func ludus(h: Hud) -> void:
	var p := Game.p
	if p.get("injury") != null:
		var err = Rivals.can_see_medic(p)
		var mc := Ui.card(h.body, UiTheme.RED)
		var head := Ui.hbox(4)
		mc.add_child(head)
		head.add_child(Ui.label(I18n.t("injury.medicName"), UiTheme.GOLD, 14))
		head.add_child(Ui.tag(I18n.t("injury.days", {"n": p.injury.days}), UiTheme.RED))
		mc.add_child(Ui.small(I18n.t("injury.medicDesc", {"min": Rivals.MEDIC_MINUTES})))
		mc.add_child(Ui.button("%s  %d" % [I18n.t("injury.treat"), Rivals.medic_cost(p)], h.app.see_medic, err != null, "gold", "coin"))
	var err2 = Calendar.can_train(p)
	var tm := Calendar.train_minutes(p)
	_hint(h, str(err2) if err2 != null else _plain(I18n.t("ludus.cost", {"icon": "", "energy": Calendar.train_energy(p), "time": I18n.t("ludus.oneHour") if tm >= 60 else I18n.t("ludus.minutes", {"n": tm})})), err2 != null)
	var busy: bool = h.app.busy
	for tr in Data.d.trainings:
		var id: String = tr.id
		var c := Ui.card(h.body)
		var head := Ui.hbox(4)
		c.add_child(head)
		head.add_child(Ui.icon("attr_" + id))
		head.add_child(Ui.label(Data.attr_name(id), UiTheme.CREAM, 16))
		head.add_child(Ui.tag(str(int(p.baseAttributes[id]) + int(p.trainedBonus[id]))))
		c.add_child(Ui.bar(float(p.training[id].progress), Training.THRESHOLD, Color8(214, 168, 64), "", 5))
		var left := Training.sessions_to_next(p, id)
		var boosted := Upgrades.training_mul(p, id) > 1
		c.add_child(Ui.center(Ui.small(I18n.t("ludus.leftMany" if left > 1 else "ludus.leftOne", {"n": left}) + (" · " + I18n.t("ludus.boosted") if boosted else ""))))
		c.add_child(Ui.button("…" if busy else I18n.t("ludus.train"), func(): h.app.train(id), busy or err2 != null, "gold"))


## Remove marcação HTML dos textos do jogo.
static func _plain(s: String) -> String:
	var re := RegEx.create_from_string("<[^>]*>")
	return re.sub(s, "", true).replace("  ", " ").strip_edges()


# ------------------------------------------------------------------ mercado
static func market(h: Hud) -> void:
	var p := Game.p
	var here := Events.merchant_here(p)
	var tab: String = h.st.get("marketTab", "buy")
	if tab == "merchant" and not here:
		tab = "buy"
	var tabs := [["buy", I18n.t("market.buy")], ["sell", I18n.t("market.sell")], ["upgrades", I18n.t("market.upgrades")], ["forge", I18n.t("market.forge")]]
	if here:
		tabs.append(["merchant", I18n.t("market.merchant")])
	Ui.subtabs(h.body, tabs, tab, func(id): _setst(h, "marketTab", id))
	var closed = Calendar.can_trade(p)
	if here and tab != "merchant":
		_add(h, Ui.button(I18n.t("event.merchantHere"), func(): _setst(h, "marketTab", "merchant"), false, "gold"))
	var coins := Ui.hbox(2)
	coins.add_child(Ui.icon("coin"))
	coins.add_child(Ui.label("%d %s" % [p.coins, I18n.t("common.coinsLower")], UiTheme.GOLD, 14))
	h.body.add_child(coins)
	if closed != null:
		_hint(h, str(closed), true)
	match tab:
		"buy":
			var items: Array = Data.d.items.filter(func(i): return i.get("shop", false))
			items.sort_custom(func(a, b): return a.minLevel < b.minLevel or (a.minLevel == b.minLevel and a.price < b.price))
			for item in items:
				var err = closed if closed != null else Equip.can_buy(p, item.id)
				var iid: String = item.id
				var need := I18n.t("common.lv", {"n": item.minLevel}) if int(p.level) < int(item.minLevel) else ""
				Ui.item_row(h.body, item, [Ui.button(str(item.price), func(): h.app.market_buy(iid), err != null, "gold", "coin")], need)
		"sell":
			var any := false
			for inv in p.inventory:
				if Equip.is_equipped(p, inv.uid):
					continue
				var item = Stats.inv_item(inv)
				if item == null:
					continue
				any = true
				var uid: String = inv.uid
				Ui.item_row(h.body, item, [Ui.button(I18n.t("market.sellFor", {"n": Stats.sell_price(item, int(inv.get("plus", 0)))}), func(): h.app.market_sell(uid), closed != null)])
			if not any:
				_add(h, Ui.small(I18n.t("market.nothingToSell")))
		"upgrades":
			_add(h, Ui.small(I18n.t("market.upgradesHint")))
			for u in Data.d.upgrades:
				if not Upgrades.visible(p, u):
					continue
				var owned := Upgrades.has(p, u.id)
				var c := Ui.card(h.body)
				var row := Ui.hbox(4)
				c.add_child(row)
				row.add_child(Ui.icon(u.icon))
				var col := Ui.vbox(0)
				col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				row.add_child(col)
				col.add_child(Ui.label(I18n.tk("upgrade.%s.name" % u.id), UiTheme.GOLD if owned else UiTheme.CREAM, 14))
				var tags := Data.loc_name(u.place)
				if int(u.get("tier", 1)) == 2:
					tags += " · " + I18n.t("market.tier2")
				col.add_child(Ui.small(tags))
				c.add_child(Ui.small(I18n.tk("upgrade.%s.desc" % u.id), Ui.GREEN))
				if owned:
					c.add_child(Ui.tag(I18n.t("market.owned")))
				else:
					var e = closed if closed != null else _upgrade_err(p, u.id)
					var uid2: String = u.id
					c.add_child(Ui.button(str(u.price), func(): h.app.market_upgrade(uid2), e != null, "gold", "coin"))
					if e != null and closed == null:
						c.add_child(Ui.small(str(e), UiTheme.RED))
		"forge":
			Ui.say(h.body, I18n.t("forge.smithName"), I18n.t("forge.greet"))
			_add(h, Ui.small(I18n.t("forge.hint")))
			for inv in p.inventory:
				var base := Data.item(str(inv.itemId))
				var item = Stats.inv_item(inv)
				if base.is_empty() or item == null or base.id == "rudis":
					continue
				var plus := int(inv.get("plus", 0))
				var e2 = closed if closed != null else Equip.can_forge(p, inv.uid)
				var ctl: Control
				if plus >= Stats.MAX_PLUS:
					ctl = Ui.tag(I18n.t("forge.max"))
				else:
					var uid3: String = inv.uid
					ctl = Ui.button("%s %d" % [I18n.t("forge.improve", {"n": plus + 1}), Stats.forge_cost(base, plus)], func(): h.app.market_forge(uid3), e2 != null, "gold", "coin")
				var note := ""
				if plus < Stats.MAX_PLUS and int(p.level) < Stats.forge_level(base, plus):
					note = I18n.t("common.lv", {"n": Stats.forge_level(base, plus)})
				if Equip.is_equipped(p, inv.uid):
					note = (note + " " if note != "" else "") + I18n.t("forge.equipped")
				Ui.item_row(h.body, item, [ctl], note)
		"merchant":
			Ui.say(h.body, I18n.t("event.merchantName"), I18n.t("event.merchantGreet", {"name": p.name}))
			for o in Events.merchant_stock(int(p.createdAt), int(p.day), int(p.level)):
				var sold := Events.merchant_sold_out(p, o.item.id)
				var e3 = Events.can_buy_from_merchant(p, o.item.id)
				var mid: String = o.item.id
				var ctl2: Control = Ui.tag(I18n.t("event.soldOut"), UiTheme.DIM) if sold else Ui.button(str(o.price), func(): h.app.merchant_buy(mid), e3 != null, "gold", "coin")
				Ui.item_row(h.body, o.item, [Ui.tag(I18n.t("event.exotic") if o.exotic else I18n.t("event.discount")), ctl2])


static func _upgrade_err(p: Dictionary, id: String) -> Variant:
	var e = Upgrades.can_buy(p, id)
	if e == null:
		return null
	var u := Upgrades.get_def(id)
	match e:
		"level":
			return I18n.t("market.needLevel", {"n": u.get("minLevel", 1)})
		"requires":
			return I18n.t("market.needFirst", {"name": I18n.tk("upgrade.%s.name" % u.get("requires"))})
		"coins":
			return I18n.t("market.noCoins")
	return I18n.t("market.owned")


# ------------------------------------------------------------------ templo
static func temple(h: Hud) -> void:
	var p := Game.p
	var say := I18n.t("monk.later")
	if int(p.skillPoints) > 0:
		say = I18n.t("monk.continue") if p.perks.size() > 0 else I18n.t("monk.choose")
	Ui.say(h.body, I18n.t("monk.name"), say)
	if float(Weather.now(int(p.createdAt), int(p.day)).rain) > 0.08:
		_add(h, Ui.small(I18n.t("temple.rainNote")))
	var top := Ui.hbox(4)
	h.body.add_child(top)
	top.add_child(Ui.label("%d %s" % [p.skillPoints, I18n.t("temple.points")], UiTheme.GOLD, 16))
	top.add_child(Ui.button(I18n.t("temple.respec", {"cost": SkillTree.respec_cost(p)}), h.app.temple_respec, p.perks.is_empty(), "dark"))
	var sel_id = h.st.get("perk")
	# árvore: três caminhos lado a lado, cinco degraus
	var tree := Ui.hbox(2)
	h.body.add_child(tree)
	for b in Data.d.branches.keys():
		var br: Dictionary = Data.d.branches[b]
		var col := Ui.vbox(2)
		col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		tree.add_child(col)
		col.add_child(Ui.center(Ui.label(Names.branch_name(b), Color(br.color), 14, false)))
		col.add_child(Ui.center(Ui.small(Names.branch_subtitle(b))))
		for tier in [1, 2, 3, 4, 5]:
			for pk in Data.d.perks:
				if pk.branch == b and int(pk.tier) == tier:
					col.add_child(_perk_node(h, pk, sel_id, Color(br.color)))
	if sel_id == null:
		_hint(h, I18n.t("temple.pick"))
		return
	var sel := Stats.perk(str(sel_id))
	if sel.is_empty():
		return
	var c := Ui.card(h.body, UiTheme.GOLD)
	var row := Ui.hbox(4)
	c.add_child(row)
	row.add_child(Ui.icon(sel.icon))
	row.add_child(Ui.label(Names.perk_name(sel), UiTheme.GOLD, 14))
	row.add_child(Ui.tag(I18n.t("temple.cost", {"n": sel.cost}), UiTheme.DIM))
	c.add_child(Ui.small(Names.perk_short(sel), UiTheme.CREAM))
	if p.perks.has(sel.id):
		c.add_child(Ui.small(I18n.t("temple.learned"), UiTheme.GOLD))
	else:
		var err = Stats.can_learn(p, sel.id)
		var sid: String = sel.id
		c.add_child(Ui.button(str(err) if err != null else I18n.t("temple.learn"), func(): h.app.temple_learn(sid), err != null, "gold"))


static func _perk_node(h: Hud, pk: Dictionary, sel_id, color: Color) -> Button:
	var p := Game.p
	var owned: bool = p.perks.has(pk.id)
	var err = Stats.can_learn(p, pk.id)
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.icon = Ui.tex("res://assets/ui/icons/%s.png" % pk.icon)
	b.text = "•".repeat(int(pk.cost))
	b.add_theme_font_size_override("font_size", 14)
	b.expand_icon = false
	var sb := UiTheme.button_box("normal")
	if owned:
		sb.bg_color = color.darkened(0.35)
		sb.border_color = UiTheme.GOLD
	elif err == null:
		sb.bg_color = Color8(110, 80, 40)
		sb.border_color = color
	else:
		sb.bg_color = Color8(40, 30, 24)
		b.modulate = Color(0.75, 0.72, 0.7)
	if sel_id == pk.id:
		sb.border_color = Color.WHITE
		sb.set_border_width_all(2)
	for st in ["normal", "hover", "pressed", "focus"]:
		b.add_theme_stylebox_override(st, sb)
	var pid: String = pk.id
	b.pressed.connect(func(): _setst(h, "perk", pid))
	return b


# ------------------------------------------------------------------ alojamento, termas
static func home(h: Hud) -> void:
	var p := Game.p
	var c := Ui.card(h.body)
	c.add_child(Ui.center(UiTheme.title_label(I18n.t("common.dayN", {"n": p.day}), 16, UiTheme.GOLD)))
	c.add_child(Ui.center(Ui.small(I18n.t("common.energy"))))
	c.add_child(Ui.bar(float(p.energy), 100, Color8(90, 190, 110), "%d / 100" % int(p.energy)))
	_add(h, Ui.button(I18n.t("home.sleep"), h.app.sleep, h.app.busy, "gold"))
	_hint(h, I18n.t("home.sleepHint"))
	var nerr = Calendar.can_nap(p)
	_add(h, Ui.button(I18n.t("home.nap", {"hours": Calendar.NAP_MINUTES / 60, "energy": Calendar.nap_energy(p)}), h.app.nap, nerr != null))
	if nerr != null:
		_hint(h, str(nerr), true)
	var bed := I18n.t("home.bedNoble") if Upgrades.has(p, "bed_noble") else (I18n.t("home.bedWool") if Upgrades.has(p, "bed_wool") else I18n.t("home.bedStraw"))
	_hint(h, I18n.t("home.bed", {"bed": bed}))
	var unread := News.unread_count(p)
	if unread > 0:
		_add(h, Ui.button(I18n.t("status.news"), h.app.read_unread, false, "dark"))


static func baths(h: Hud) -> void:
	var p := Game.p
	var err = Calendar.can_bathe(p)
	var c := Ui.card(h.body)
	c.add_child(Ui.center(Ui.small(I18n.t("common.energy"))))
	c.add_child(Ui.bar(float(p.energy), 100, Color8(90, 190, 110), "%d / 100" % int(p.energy)))
	_add(h, Ui.button("%s  %d" % [I18n.t("baths.bath"), Calendar.baths_cost(p)], h.app.bathe, err != null, "gold", "coin"))
	_hint(h, str(err) if err != null else I18n.t("baths.gain", {"energy": Calendar.BATHS_ENERGY, "hours": Calendar.BATHS_MINUTES / 60}), err != null)


# ------------------------------------------------------------------ taverna
static func tavern(h: Hud) -> void:
	var p := Game.p
	var say: Dictionary = h.st.get("tavernSay", {"who": I18n.t("tavern.keeperName"), "text": I18n.t("tavern.greet", {"name": p.name})})
	Ui.say(h.body, say.who, say.text)
	var rival := News.next_rival(p)
	var cards := [
		["eat", I18n.t("tavern.meal"), I18n.t("tavern.mealDesc", {"energy": Tavern.MEAL_ENERGY, "min": Tavern.MEAL_MINUTES}), "%s  %d" % [I18n.t("tavern.eat"), Tavern.meal_cost(p)], Tavern.can_eat(p)],
		["rumor", I18n.t("tavern.wine"), I18n.t("tavern.wineDesc", {"rival": rival.name, "min": Tavern.RUMOR_MINUTES}), "%s  %d" % [I18n.t("tavern.listen"), Tavern.RUMOR_COST], Tavern.can_hear_rumor(p)],
	]
	for cd in cards:
		var c := Ui.card(h.body)
		c.add_child(Ui.label(cd[1], UiTheme.GOLD, 14))
		c.add_child(Ui.small(cd[2]))
		var act: String = cd[0]
		c.add_child(Ui.button(cd[3], func(): h.app.tavern(act), cd[4] != null, "gold", "coin"))
		if cd[4] != null:
			c.add_child(Ui.small(str(cd[4]), UiTheme.RED))
	# queda de braço
	var night := Events.is_arm_night(int(p.day), int(p.minutes))
	var when := I18n.t("event.armWhen", {"from": Events.ARM_START / 60, "to": Events.ARM_END / 60})
	var ac := Ui.card(h.body, UiTheme.RED if night else Color8(80, 60, 44))
	var head := Ui.hbox(4)
	ac.add_child(head)
	head.add_child(Ui.label(I18n.t("event.armTitle"), UiTheme.GOLD if night else UiTheme.DIM, 14))
	if not night:
		ac.add_child(Ui.small(when if Calendar.weekday_index(int(p.day)) == 0 else I18n.t("event.armOnlySunday", {"when": when})))
		return
	head.add_child(Ui.tag(I18n.t("event.armTonight")))
	ac.add_child(Ui.small(I18n.t("event.armDesc", {"prize": Events.arm_prize(p)})))
	var err = Events.can_arm_wrestle(p)
	ac.add_child(Ui.button("%s  %d" % [I18n.t("event.armJoin"), Events.arm_fee(p)], h.app.arm_wrestle, err != null, "red", "coin"))
	if err != null:
		ac.add_child(Ui.small(str(err), UiTheme.RED))


# ------------------------------------------------------------------ fórum
static func forum(h: Hud) -> void:
	var p := Game.p
	ranking(h.body, p)
	if p.news.editions.is_empty():
		_add(h, Ui.small(I18n.t("forum.none")))
		return
	for e in p.news.editions:
		var day := int(e.day)
		var head := News.headline(e.items[0]) if e.items.size() else ""
		var b := Ui.button("", func(): h.app.read_edition(day), false, "" if e.read else "gold")
		b.text = "%s · %s%s" % [I18n.t("common.dayN", {"n": day}), head, "" if e.read else "  (" + I18n.t("forum.new") + ")"]
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.add_theme_font_size_override("font_size", 14)
		h.body.add_child(b)


static func ranking(parent: Control, p: Dictionary) -> void:
	var rows := Ranking.table(p)
	var me: Dictionary = {}
	for r in rows:
		if r.get("player", false):
			me = r
	var show: Array = rows.slice(0, 10)
	if int(me.pos) > 10:
		show.append(me)
	var c := Ui.card(parent, UiTheme.BRONZE)
	var head := Ui.hbox(4)
	c.add_child(head)
	head.add_child(Ui.label(I18n.t("rank.title"), UiTheme.GOLD, 14))
	head.add_child(Ui.tag(I18n.t("rank.you", {"n": me.pos}), UiTheme.DIM))
	var hdr := Ui.hbox(3)
	c.add_child(hdr)
	for k in [["#", 18], [I18n.t("rank.name"), 0], [I18n.t("rank.record"), 34], [I18n.t("rank.points"), 26]]:
		var l := Ui.tag(k[0], UiTheme.DIM)
		l.clip_text = true
		if k[1] > 0:
			l.custom_minimum_size.x = k[1]
		else:
			l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			l.custom_minimum_size.x = 20
		hdr.add_child(l)
	for r in show:
		var is_me: bool = r.get("player", false)
		var col := UiTheme.GOLD if is_me else UiTheme.CREAM
		var row := Ui.hbox(3)
		c.add_child(row)
		var pos := Ui.tag(str(r.pos), col)
		pos.custom_minimum_size.x = 18
		row.add_child(pos)
		var prev := int(r.get("prev", 0))
		var arrow := "" if prev == 0 or prev == int(r.pos) else ("▲" if prev > int(r.pos) else "▼")
		var nm := Ui.tag(str(p.name) if is_me else Fighters.any_fighter_name(str(r.id)), col)
		nm.clip_text = true
		nm.custom_minimum_size.x = 20
		nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(nm)
		if arrow != "":
			row.add_child(Ui.tag(arrow, Ui.GREEN if arrow == "▲" else UiTheme.RED))
		var rec := Ui.tag("%d–%d" % [r.w, r.l], col)
		rec.custom_minimum_size.x = 34
		row.add_child(rec)
		var pts := Ui.tag(str(r.pts), col)
		pts.custom_minimum_size.x = 26
		row.add_child(pts)
	c.add_child(Ui.small(I18n.t("rank.hint")))


# ------------------------------------------------------------------ gladiador e histórico
static func gladiator(h: Hud) -> void:
	var p := Game.p
	var tab: String = h.st.get("charTab", "attrs")
	Ui.subtabs(h.body, [["attrs", I18n.t("char.attrs")], ["gear", I18n.t("char.gear")], ["history", I18n.t("hist.title")]], tab, func(id): _setst(h, "charTab", id))
	if tab == "gear":
		_gear(h)
	elif tab == "history":
		history(h)
	else:
		_attrs(h)


static func _attrs(h: Hud) -> void:
	var p := Game.p
	var pending: Dictionary = h.st.get("pending", Stats.empty_attrs())
	var total := 0
	for k in Stats.ATTR_KEYS:
		total += int(pending[k])
	if total > int(p.unspentPoints):
		pending = Stats.empty_attrs()
		total = 0
	h.st.pending = pending
	var c := Ui.card(h.body)
	var top := Ui.hbox(4)
	c.add_child(top)
	top.add_child(Ui.player_portrait(p, 24))
	var col := Ui.vbox(0)
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(col)
	col.add_child(Ui.label(str(p.name), UiTheme.GOLD, 16))
	col.add_child(Ui.small(I18n.t("common.level", {"n": p.level}) + " · " + Data.origin_name(str(p.origin))))
	if int(p.level) < int(Data.constant("MAX_LEVEL")):
		c.add_child(Ui.bar(float(p.xp), Data.xp_to_next(int(p.level)), Color8(80, 140, 220), "%d / %d XP" % [p.xp, Data.xp_to_next(int(p.level))]))
	var left := int(p.unspentPoints) - total
	var hd := Ui.hbox(4)
	h.body.add_child(hd)
	hd.add_child(Ui.heading(I18n.t("char.attrs")))
	if int(p.unspentPoints) > 0:
		hd.add_child(Ui.tag(I18n.t("char.pointsLeft", {"n": left})))
	var gear := Stats.equipped_items(p)
	var nat := Stats.natural_attributes(p)
	var planned := nat.duplicate()
	for k in Stats.ATTR_KEYS:
		planned[k] = int(planned[k]) + int(pending[k])
	var gb := {}
	var fin_nat := Stats.final_attributes(nat, gear)
	for k in Stats.ATTR_KEYS:
		gb[k] = int(fin_nat[k]) - int(nat[k])
	for k in Stats.ATTR_KEYS:
		var key: String = k
		var value := int(p.baseAttributes[k]) + int(p.trainedBonus[k])
		var row := Ui.hbox(3)
		h.body.add_child(row)
		row.add_child(Ui.icon("attr_" + k))
		var nm := Ui.vbox(0)
		nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(nm)
		nm.add_child(Ui.label(Data.attr_name(k), UiTheme.CREAM, 14, false))
		nm.add_child(Ui.small(I18n.t("attr.hint." + k)))
		var vt := str(value + int(pending[k]))
		if int(pending[k]) > 0:
			vt += " +%d" % pending[k]
		if int(gb[k]) != 0:
			vt += " (%+d)" % gb[k]
		row.add_child(Ui.tag(vt, Ui.GREEN if int(pending[k]) > 0 else UiTheme.GOLD))
		if int(p.unspentPoints) > 0:
			row.add_child(Ui.button("-", func():
				pending[key] = maxi(0, int(pending[key]) - 1)
				h.refresh(), int(pending[k]) == 0))
			row.add_child(Ui.button("+", func():
				pending[key] = int(pending[key]) + 1
				h.refresh(), left <= 0 or value + int(pending[k]) >= int(Data.constant("MAX_ATTRIBUTE")), "gold"))
	if total > 0:
		var br := Ui.hbox(4)
		br.alignment = BoxContainer.ALIGNMENT_END
		h.body.add_child(br)
		br.add_child(Ui.button(I18n.t("common.cancel"), func():
			h.st.pending = Stats.empty_attrs()
			h.refresh()))
		br.add_child(Ui.button(I18n.t("common.confirm"), func(): h.app.allocate(pending.duplicate()), false, "gold"))
	# atributos em combate (antes → depois)
	var before := Stats.compute(Stats.final_attributes(nat, gear), gear)
	var after := Stats.compute(Stats.final_attributes(planned, gear), gear)
	h.body.add_child(Ui.heading(I18n.t("char.inCombat")))
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 8)
	h.body.add_child(grid)
	var pct := func(v): return "%d%%" % roundi(float(v) * 100)
	var stats := [["stat.hp", "maxHp", func(v): return str(roundi(float(v))), true], ["stat.damage", "baseDamage", func(v): return str(roundi(float(v))), true],
		["stat.defense", "damageReduction", pct, true], ["stat.dodge", "dodgeChance", pct, true],
		["stat.interval", "attackInterval", func(v): return "%.1fs" % float(v), false], ["stat.crit", "critChance", pct, true]]
	for s in stats:
		var a := float(before[s[1]])
		var b := float(after[s[1]])
		var good: bool = (b > a) == s[3]
		var txt: String = I18n.t(s[0]) + " " + s[2].call(b) + (" ▲" if absf(b - a) > 1e-6 else "")
		grid.add_child(Ui.tag(txt, (Ui.GREEN if good else UiTheme.RED) if absf(b - a) > 1e-6 else UiTheme.CREAM))
	var hd2 := Ui.hbox(4)
	h.body.add_child(hd2)
	hd2.add_child(Ui.heading(I18n.t("char.skills")))
	if int(p.skillPoints) > 0:
		hd2.add_child(Ui.tag(I18n.t("char.forTemple", {"n": p.skillPoints})))
	var learned := Stats.skills_from_perks(p.perks)
	if learned.is_empty():
		h.body.add_child(Ui.small(I18n.t("char.noSkills")))
	for id in learned:
		var sc := Ui.card(h.body)
		var row := Ui.hbox(4)
		sc.add_child(row)
		row.add_child(Ui.icon(Data.d.skills[id].icon))
		row.add_child(Ui.label(Names.skill_name(id), UiTheme.GOLD, 14))
		sc.add_child(Ui.small(I18n.t("skill.hint." + id)))


static func _gear(h: Hud) -> void:
	var p := Game.p
	var gear := Data.gear_of(p)
	var c := Ui.card(h.body)
	for slot in Stats.SLOTS:
		var row := Ui.hbox(4)
		c.add_child(row)
		var sl := Ui.small(Data.slot_name(slot))
		sl.custom_minimum_size.x = 52
		sl.size_flags_horizontal = Control.SIZE_FILL
		row.add_child(sl)
		var it = gear.get(slot)
		if it == null:
			row.add_child(Ui.small(I18n.t("godot.empty")))
			continue
		row.add_child(Ui.item_icon(it))
		var nm := Ui.label(Ui.item_title(it), Ui.rarity_color(it.get("rarity", "common")), 14)
		row.add_child(nm)
		if slot != "mainHand" or it.id != "rudis":
			var s2: String = slot
			row.add_child(Ui.button("x", func(): h.app.unequip(s2)))
	h.body.add_child(Ui.heading(I18n.t("char.stored")))
	var any := false
	for inv in p.inventory:
		if Equip.is_equipped(p, inv.uid):
			continue
		var item = Stats.inv_item(inv)
		if item == null:
			continue
		any = true
		var uid: String = inv.uid
		Ui.item_row(h.body, item, [Ui.button(I18n.t("char.equip"), func(): h.app.equip(uid), int(p.level) < int(item.minLevel), "gold")],
			I18n.t("common.lv", {"n": item.minLevel}) if int(p.level) < int(item.minLevel) else "")
	if not any:
		h.body.add_child(Ui.small(I18n.t("char.nothingStored")))


static func history(h: Hud) -> void:
	var p := Game.p
	var battles := int(p.stats.battles)
	var rate := roundi(float(p.stats.wins) / battles * 100) if battles > 0 else 0
	var c := Ui.card(h.body)
	c.add_child(Ui.center(Ui.label("%d %s · %d %s · %d%%" % [p.stats.wins, I18n.t("hist.wins"), p.stats.losses, I18n.t("hist.losses"), rate], UiTheme.GOLD, 14)))
	if p.history.is_empty():
		h.body.add_child(Ui.small(I18n.t("hist.none")))
	for rec in p.history:
		var won: bool = rec.result == "win"
		var hc := Ui.card(h.body, Color8(90, 140, 70) if won else Color8(140, 60, 50))
		var o := Data.opponent(str(rec.opponentId))
		var name: String = o.name if not o.is_empty() else str(rec.opponentName).split(",")[0]
		var row := Ui.hbox(4)
		hc.add_child(row)
		row.add_child(Ui.label("%s · %s" % [I18n.t("common.victory") if won else I18n.t("common.defeat"), name], Ui.GREEN if won else UiTheme.RED, 14))
		row.add_child(Ui.tag(Ui.fmt_duration(float(rec.duration)), UiTheme.DIM))
		var extra := "+%d XP · %d %s" % [rec.xp, rec.coins, I18n.t("common.coinsLower")]
		if rec.get("itemId") != null:
			var it := Data.item(str(rec.itemId))
			if not it.is_empty():
				extra += " · " + Names.item_name(it)
		if int(rec.get("levelUps", 0)) > 0:
			extra += " · " + I18n.t("hist.levelUp")
		hc.add_child(Ui.small(extra))
