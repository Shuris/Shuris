extends Node
## Raiz do jogo: mundo (local, mapa ou fundo do menu), filtro de paleta por cima do
## mundo e a interface (menu, criação, painéis, pausa) por cima de tudo.

var world: Node2D
var ui: CanvasLayer
var fx_layer: CanvasLayer
var palette_rect: ColorRect
var view: Node = null        # LocationView ou MapView atual
var screen: Control = null   # tela de interface atual
var hud: Control = null
var pause: Control = null
var fade: ColorRect
var fade_label: Label
var fade_sub: Label
var theme: Theme
var busy := false
var battle = null            # contexto da luta em andamento
var arena: ArenaView = null
var bhud: BattleHud = null


func _ready() -> void:
	theme = UiTheme.build()
	Modal.default_theme = theme
	get_tree().root.theme = theme
	# os controles dentro das camadas não herdam o tema da janela: cada tela recebe o tema
	ui_child_theme_hook()
	world = Node2D.new()
	add_child(world)
	fx_layer = CanvasLayer.new()
	fx_layer.layer = 1
	add_child(fx_layer)
	palette_rect = ColorRect.new()
	palette_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	palette_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var mat := ShaderMaterial.new()
	mat.shader = load("res://shaders/palette.gdshader")
	mat.set_shader_parameter("palette", load("res://assets/palette.png"))
	palette_rect.material = mat
	fx_layer.add_child(palette_rect)
	ui = CanvasLayer.new()
	ui.layer = 2
	add_child(ui)
	fade = ColorRect.new()
	fade.color = Color8(10, 6, 4)
	fade.set_anchors_preset(Control.PRESET_FULL_RECT)
	fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fade.modulate.a = 0
	var fl := CanvasLayer.new()
	fl.layer = 5
	add_child(fl)
	fl.add_child(fade)
	fade_label = UiTheme.title_label("", 32, UiTheme.GOLD)
	fade_label.set_anchors_preset(Control.PRESET_CENTER)
	fade_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	fade_label.position = Vector2(-200, -28)
	fade_label.size = Vector2(400, 40)
	fade.add_child(fade_label)
	fade_sub = Label.new()
	fade_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	fade_sub.set_anchors_preset(Control.PRESET_CENTER)
	fade_sub.position = Vector2(-200, 12)
	fade_sub.size = Vector2(400, 20)
	fade.add_child(fade_sub)
	fade.theme = theme
	I18n.lang_changed.connect(func(_l): _refresh_texts())
	Game.changed.connect(_on_game_changed)
	show_title()
	if OS.has_feature("editor") == false and DisplayServer.get_name() != "headless":
		pass
	_test_hook()


func ui_child_theme_hook() -> void:
	pass


## Toda tela/painel adicionado à interface recebe o tema de pixel art.
func _themed(c: Control) -> Control:
	c.theme = theme
	return c


# ------------------------------------------------------------------ telas
func _clear_world() -> void:
	for c in world.get_children():
		c.queue_free()
	view = null


func _set_screen(c: Control) -> void:
	if screen:
		screen.queue_free()
	screen = c
	if c:
		ui.add_child(_themed(c))


func show_title() -> void:
	Game.close()
	_clear_world()
	if hud:
		hud.queue_free()
		hud = null
	palette_rect.visible = false  # a arte do menu já vem pintada na paleta
	Music.play("menu")
	var t := TitleScreen.new()
	t.play.connect(_play_slot)
	t.options.connect(_open_options)
	t.quit.connect(func(): get_tree().quit())
	_set_screen(t)


func _play_slot(slot: int, info: Dictionary) -> void:
	if info.player == null:
		_show_create(slot)
	else:
		Game.start(slot, info.player)
		enter_location(true)


func _show_create(slot: int) -> void:
	_clear_world()
	palette_rect.visible = true
	var lv := LocationView.new()
	lv.panel_right = 0
	world.add_child(lv)
	lv.setup("ludus", {"skin": 0, "hairStyle": 0, "hairColor": 0, "beard": false, "clothColor": 0}, {"mainHand": Data.item("rudis")})
	view = lv
	var c := CreateScreen.new()
	c.preview_changed.connect(func(a): lv.hero.set_visual(a, {"mainHand": Data.item("rudis")}))
	c.finished.connect(func(name, origin, a):
		var p := PlayerFactory.new_player(name, origin, a, int(Time.get_unix_time_from_system() * 1000.0))
		Game.start(slot, p)
		enter_location(true))
	c.back.connect(show_title)
	_set_screen(c)


## Mostra o local atual do gladiador (cena + painéis).
func enter_location(with_fade := false) -> void:
	var p := Game.p
	if with_fade:
		await _fade_in_out(Data.loc_name(p.location), Calendar.hours_label(Data.location(p.location), int(p.day)))
	_clear_world()
	palette_rect.visible = true
	var lv := LocationView.new()
	lv.app = self
	world.add_child(lv)
	lv.setup(p.location, p.appearance, Data.gear_of(p))
	view = lv
	_set_screen(null)
	if not hud:
		hud = Hud.new()
		hud.app = self
		hud.go_map.connect(show_map)
		hud.go_location.connect(func(): enter_location())
		ui.add_child(_themed(hud))
	update_music()
	hud.visible = true
	if hud.tab == "gladiator":
		hud.refresh()
	else:
		hud.show_location()


func show_map() -> void:
	_clear_world()
	var mv := MapView.new()
	world.add_child(mv)
	mv.setup(Game.p.location)
	mv.picked.connect(_travel)
	view = mv
	if hud:
		hud.show_map()


func _travel(to: String) -> void:
	var err = Calendar.can_travel(Game.p, to)
	if err != null:
		if hud:
			hud.toast(str(err))
		return
	Sfx.play("step")
	(view as MapView).travel_to(to, func():
		Game.update(func(p): return Calendar.travel(p, to))
		enter_location(true))


func _fade_in_out(title: String, sub: String) -> void:
	fade_label.text = title
	fade_sub.text = sub
	var tw := create_tween()
	tw.tween_property(fade, "modulate:a", 1.0, 0.25)
	await tw.finished
	await get_tree().create_timer(0.35).timeout
	var tw2 := create_tween()
	tw2.tween_interval(0.05)
	tw2.tween_property(fade, "modulate:a", 0.0, 0.45)


## Trilha conforme o lugar e a hora (taverna, noite ou cidade); chuva conforme o clima.
func update_music() -> void:
	if battle != null or not Game.has_player():
		return
	var p := Game.p
	var m := int(p.minutes)
	if p.location == "tavern":
		Music.play("tavern")
	elif m >= 20 * 60 or m < 6 * 60:
		Music.play("night")
	else:
		Music.play("city")
	var w := Weather.now(int(p.createdAt), int(p.day))
	var outdoor: bool = Data.location(p.location).get("outdoor", true)
	Sfx.set_rain(float(w.rain) * (1.0 if outdoor else 0.35))


func _on_game_changed() -> void:
	if Game.has_player():
		Names.champion_beaten = Game.p.defeatedOpponents.has("flamma")
	if hud and battle == null:
		hud.refresh()
		update_music()
	if view is LocationView:
		(view as LocationView).refresh_time()


func _refresh_texts() -> void:
	if screen and screen.has_method("rebuild"):
		screen.rebuild()
	if hud:
		hud.refresh()


# ------------------------------------------------------------------ pausa
func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		if battle != null:
			return
		if pause:
			_close_pause()
		elif Game.has_player():
			_open_pause()
	if event is InputEventKey and event.pressed and event.keycode == KEY_F11:
		_toggle_fullscreen()


func _toggle_fullscreen() -> void:
	var fs := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if fs else DisplayServer.WINDOW_MODE_FULLSCREEN)


func _open_pause() -> void:
	pause = PauseMenu.new()
	pause.resumed.connect(_close_pause)
	pause.to_menu.connect(func():
		_close_pause()
		show_title())
	pause.quit.connect(func():
		Game.save()
		get_tree().quit())
	pause.options.connect(_open_options)
	ui.add_child(_themed(pause))
	get_tree().paused = false


func _close_pause() -> void:
	if pause:
		pause.queue_free()
		pause = null


func _open_options() -> void:
	var o := OptionsPanel.new()
	o.fullscreen_toggled.connect(_toggle_fullscreen)
	ui.add_child(_themed(o))


# ------------------------------------------------------------------ ações dos locais
func _rng() -> Rng:
	return Rng.new(Rng.random_seed())


func _toast(text, kind := "info", ms := 3000) -> void:
	if hud and text != null and str(text) != "":
		hud.toast(str(text), kind, ms)


## Fala de um morador: balão na cena (quando ele está lá) ou aviso no canto.
func npc_say(who: String, text: String) -> void:
	if text == "":
		return
	if view is LocationView and (view as LocationView).say(who, text):
		return
	_toast("%s: “%s”" % [I18n.tk("npcName." + who, {}, who.capitalize()), text], "info", 4500)


func go_to(to: String) -> void:
	if Game.p.location == to or battle != null:
		return
	var err = Calendar.can_travel(Game.p, to)
	if err != null:
		_toast(err, "bad")
		return
	Game.update(func(p): return Calendar.travel(p, to))
	enter_location(true)


func train(id: String) -> void:
	if busy or battle != null:
		return
	var err = Calendar.can_train(Game.p)
	if err != null:
		Sfx.play("error")
		_toast(err, "bad")
		return
	busy = true
	hud.refresh()
	var apply := func():
		busy = false
		var r: Dictionary = Game.update(func(pl):
			var res := Training.train(pl, id, _rng())
			if res.ok:
				Calendar.apply_training(pl)
			return res)
		if not r.ok:
			Sfx.play("error")
			_toast(r.message, "bad")
			hud.refresh()
			return
		var msg := I18n.t("train.attrGained") if r.attributeGained else I18n.t("train.done", {"xp": r.xp})
		_toast(msg, "gold" if r.attributeGained else "good")
		if view is LocationView:
			(view as LocationView).show_gain(I18n.t("train.attrGained") if r.attributeGained else "+%d XP" % r.xp)
		if r.attributeGained:
			Sfx.play("levelup")
			var who := "doctore" if Upgrades.has(Game.p, "doctore") else "instructor"
			npc_say(who, Dialogue.npc_line("attrUp." + id, randi() % 1000, {"name": Game.p.name, "attr": Data.attr_name(id)}))
		if int(r.levelUps) > 0:
			Sfx.play("levelup")
			_toast(I18n.t("app.levelUp", {"level": Game.p.level, "points": int(r.levelUps) * 3, "skill": r.levelUps}), "gold", 5000)
	if view is LocationView:
		(view as LocationView).play_training(id, apply)
	else:
		apply.call()


func see_medic() -> void:
	var err = Game.update(func(p): return Rivals.see_medic(p))
	if err != null:
		Sfx.play("error")
		_toast(err, "bad")
		return
	Sfx.play("guard")
	npc_say("medic", Dialogue.npc_line("medicDone", randi() % 1000))
	_toast(I18n.t("injury.healed"), "good", 4000)


func sleep() -> void:
	if busy or Game.p.location != "home":
		return
	busy = true
	await _fade_in_out(I18n.t("common.dayN", {"n": int(Game.p.day) + 1}), I18n.t("home.sleepFade") if I18n.tk("home.sleepFade", {}, "") != "" else "")
	var out: Dictionary = Game.update(func(p): return Act.sleep(p))
	busy = false
	if view is LocationView:
		(view as LocationView).refresh_time()
	hud.refresh()
	if out.noShow:
		_toast(I18n.t("tour.noShowToast"), "bad", 5000)
	if out.edition != null:
		var day := int(out.edition.day)
		get_tree().create_timer(1.2).timeout.connect(func(): read_edition(day))


func nap() -> void:
	var err = Game.update(func(p): return Calendar.nap(p))
	if err != null:
		_toast(err, "bad")
	else:
		_toast(I18n.t("home.napped"), "good")


func bathe() -> void:
	var err = Game.update(func(p): return Calendar.bathe(p))
	if err != null:
		Sfx.play("error")
		_toast(err, "bad")
	else:
		Sfx.play("coin")
		_toast(I18n.t("baths.done"), "good")


func tavern(action: String) -> void:
	if busy:
		return
	var rng := _rng()
	if action == "eat":
		var err = Game.update(func(p): return Tavern.eat(p))
		if err != null:
			Sfx.play("error")
			_toast(err, "bad")
			return
		Sfx.play("coin")
		var line := Dialogue.npc_line("keeperServe", int(rng.next() * 1000))
		hud.st.tavernSay = {"who": I18n.t("tavern.keeperName"), "text": line}
		npc_say("keeper", line)
		_toast(I18n.t("tavern.ate"), "good")
	else:
		var r: Dictionary = Game.update(func(p): return Tavern.hear_rumor(p, rng))
		if r.error != null:
			Sfx.play("error")
			_toast(r.error, "bad")
			return
		Sfx.play("coin")
		var text := I18n.variant(I18n.tk("rumor." + str(r.rivalId)), int(rng.next() * 1000))
		hud.st.tavernSay = {"who": I18n.t("tavern.quintusName"), "text": text}
		npc_say("quintus", text)
		_toast(I18n.t("tavern.rumorHeard"), "gold", 4000)
	hud.refresh()


func arm_wrestle() -> void:
	if busy:
		return
	var err = Events.can_arm_wrestle(Game.p)
	if err != null:
		Sfx.play("error")
		_toast(err, "bad")
		return
	busy = true
	var game := ArmWrestle.new()
	game.theme = theme
	ui.add_child(game)
	game.setup(Events.arm_setup(Game.p), str(Game.p.name))
	var won: bool = await game.done
	busy = false
	var rng := _rng()
	var r: Dictionary = Game.update(func(pl):
		var res := Events.finish_arm_wrestle(pl, won)
		if won:
			News.on_event(pl, "armWin", rng)
		return res)
	npc_say("patron", Dialogue.npc_line("armCheer" if won else "armTease", int(rng.next() * 1000)))
	_toast(I18n.t("event.armWonToast", {"coins": r.coins, "fame": r.fame}) if won else I18n.t("event.armLostToast"), "gold" if won else "info", 5000)


func read_unread() -> void:
	for e in Game.p.news.editions:
		if not e.read:
			return read_edition(int(e.day))


func read_edition(day: int) -> void:
	if not Game.has_player():
		return
	var ed = null
	for e in Game.p.news.editions:
		if int(e.day) == day:
			ed = e
	if ed == null:
		return
	if not ed.read:
		Game.update(func(_p): ed.read = true)
	Sfx.play("equip")
	Newspaper.open(ui, ed)


func market_buy(id: String) -> void:
	var r: Dictionary = Game.update(func(p): return Equip.buy(p, id))
	_toast(r.message, "good" if r.ok else "bad")
	Sfx.play("coin" if r.ok else "error")


func market_sell(uid: String) -> void:
	var inv = null
	for i in Game.p.inventory:
		if i.uid == uid:
			inv = i
	var item = Stats.inv_item(inv) if inv != null else null
	if item == null:
		return
	Modal.confirm(ui, I18n.t("market.sellTitle"), Panels._plain(I18n.t("market.sellBody", {"name": Names.item_name(item), "n": Stats.sell_price(item, int(inv.get("plus", 0)))})), I18n.t("market.sell"), func():
		var r: Dictionary = Game.update(func(p): return Equip.sell(p, uid))
		_toast(r.message, "good" if r.ok else "bad")
		Sfx.play("coin" if r.ok else "error"))


func market_upgrade(id: String) -> void:
	var msg = Panels._upgrade_err(Game.p, id)
	var err = Game.update(func(p): return Upgrades.buy(p, id))
	if err != null:
		Sfx.play("error")
		_toast(msg if msg != null else I18n.t("market.noCoins"), "bad")
		return
	Sfx.play("coin")
	_toast(I18n.t("market.upgradeBought", {"name": I18n.tk("upgrade.%s.name" % id), "place": Data.loc_name(str(Upgrades.get_def(id).get("place", "home")))}), "gold", 4500)
	if view is LocationView:
		(view as LocationView).refresh_props()


func market_forge(uid: String) -> void:
	var r: Dictionary = Game.update(func(p): return Equip.forge(p, uid))
	if r.error != null:
		Sfx.play("error")
		_toast(r.error, "bad")
		return
	Sfx.play("forge")
	_toast(I18n.t("forge.toast", {"name": r.name, "n": r.plus}), "gold", 4000)
	_refresh_hero()


func merchant_buy(id: String) -> void:
	var err = Game.update(func(p): return Events.buy_from_merchant(p, id))
	if err != null:
		Sfx.play("error")
		_toast(err, "bad")
		return
	Sfx.play("coin")
	_toast(I18n.t("event.merchantBought", {"name": Names.item_name(Data.item(id))}), "gold", 4000)


func temple_learn(id: String) -> void:
	var err = Game.update(func(p): return SkillTree.learn(p, id))
	if err != null:
		Sfx.play("error")
		_toast(err, "bad")
		return
	Sfx.play("levelup")
	_toast(I18n.t("temple.taught", {"name": Names.perk_name(Stats.perk(id))}), "gold")


func temple_respec() -> void:
	Modal.confirm(ui, I18n.t("temple.respecTitle"), I18n.t("temple.respecBody", {"cost": SkillTree.respec_cost(Game.p)}), I18n.t("temple.respecOk"), func():
		var err = Game.update(func(p): return SkillTree.respec(p))
		_toast(err if err != null else I18n.t("temple.respecDone"), "bad" if err != null else "good"))


func allocate(alloc: Dictionary) -> void:
	var err = Game.update(func(p): return SkillTree.allocate(p, alloc))
	if err != null:
		_toast(err, "bad")
		return
	hud.st.pending = Stats.empty_attrs()
	_toast(I18n.t("char.improved"), "good")
	hud.refresh()


func equip(uid: String) -> void:
	var r: Dictionary = Game.update(func(p): return Equip.equip(p, uid))
	_toast(r.message, "good" if r.ok else "bad")
	Sfx.play("equip" if r.ok else "error")
	_refresh_hero()


func unequip(slot: String) -> void:
	var r: Dictionary = Game.update(func(p): return Equip.unequip(p, slot))
	_toast(r.message, "good" if r.ok else "bad")
	Sfx.play("equip" if r.ok else "error")
	_refresh_hero()


func _refresh_hero() -> void:
	if view is LocationView:
		(view as LocationView).hero.set_visual(Game.p.appearance, Data.gear_of(Game.p))


func set_partner(id: String) -> void:
	if Game.update(func(p): return Duo.set_partner(p, id)):
		Sfx.play("equip")
		_toast(I18n.t("duo.partnerSet", {"name": Data.opponent(id).get("name", id)}), "good")


## Clique num rival pela cidade: uma conversa por dia com cada um; a amizade sobe sem números.
func rival_talk(id: String) -> String:
	var name := str(Game.p.name)
	var r = Game.update(func(p): return RivalTown.chat(p, id))
	if r is String or r == null:
		return ""
	if r.friend:
		Sfx.play("levelup")
		_toast(I18n.t("duo.newFriend", {"name": Data.opponent(id).get("name", id)}), "gold", 5000)
	return Dialogue.npc_line("rival." + id, randi() % 1000, {"name": name})


# ------------------------------------------------------------------ torneio
func tournament(action: String) -> void:
	if battle != null:
		return
	if action == "register":
		var err = Game.update(func(p): return Tournament.register(p))
		if err != null:
			Sfx.play("error")
			_toast(err, "bad")
			return
		Sfx.play("coin")
		_toast(I18n.t("tour.registeredToast", {"day": Game.p.tournament.registered}), "gold", 5000)
		return
	if action == "start":
		var err2 = Game.update(func(p): return Tournament.start(p))
		if err2 != null:
			Sfx.play("error")
			_toast(err2, "bad")
			return
		Sfx.play("horn")
	show_bracket()


func show_bracket() -> void:
	var run = Game.p.tournament.run
	if run == null:
		return
	var m := Modal.open(ui, 420)
	BracketView.fill(m, Game.p, run, func():
		m.close()
		start_battle({"mode": "tournament"}), func():
		m.close()
		_claim_tournament())


func _claim_tournament() -> void:
	var rng := _rng()
	var pr = Game.update(func(p):
		var r = Tournament.close(p, rng)
		if r != null:
			News.on_event(p, "tourneyWin" if int(r.reached) == 3 else ("tourneyFinal" if int(r.reached) == 2 else "tourneyOut"), rng, {"opp": "" if r.champion == "player" else r.champion})
		return r)
	if pr == null:
		return
	Sfx.play("victory" if int(pr.reached) == 3 else "coin")
	_toast(I18n.t("tour.toast%d" % pr.reached, {"coins": pr.coins, "fame": pr.fame}), "gold" if int(pr.reached) == 3 else "info", 6000)
	if pr.itemId != null:
		_toast(I18n.t("tour.trophy", {"name": Names.item_name(Data.item(str(pr.itemId)))}), "gold", 6000)
	if int(pr.levelUps) > 0:
		_toast(I18n.t("app.levelUp", {"level": Game.p.level, "points": int(pr.levelUps) * 3, "skill": pr.levelUps}), "gold", 5000)


# ------------------------------------------------------------------ batalha
func start_battle(opts: Dictionary = {}) -> void:
	if battle != null or busy or not Game.has_player():
		return
	var p := Game.p
	var fight = Act.prepare_fight(p, opts)
	if fight is String:
		Sfx.play("error")
		_toast(fight, "bad", 5000)
		return
	if p.get("injury") != null and not opts.get("injuredOk", false):
		var o2 := opts.duplicate()
		o2.injuredOk = true
		Modal.confirm(ui, I18n.t("injury.fightTitle"), I18n.t("injury.fightBody", {"n": p.injury.days}), I18n.t("injury.fightAnyway"), func(): start_battle(o2))
		return
	var me := Stats.player_combatant(p)
	battle = {"opponent": fight.def, "mode": fight.mode, "strategy": p.strategy, "favor": Crowd.FAVOR_START, "inviteId": opts.get("inviteId"), "duo": null}
	if fight.mode == "duo" and fight.get("back") != null:
		battle.duo = {"run": Duo.new_run(), "partner": fight.back[0], "foes": [fight.def, fight.back[1]]}
	hud.visible = false
	Music.play("arena")
	Sfx.set_rain(0)
	Sfx.start_crowd()
	Sfx.play("horn")
	_launch_bout(me, int(p.level), str(p.name), fight, [null, null])


func _launch_bout(me: Dictionary, my_level: int, my_name: String, fight: Dictionary, start_hp: Array) -> void:
	var p := Game.p
	var them := Stats.opponent_combatant(fight.def)
	_clear_world()
	_close_battle_hud()
	palette_rect.visible = true
	arena = ArenaView.new()
	var fresh: bool = start_hp[0] == null and start_hp[1] == null
	var s := {
		"fighters": [me, them], "arena": fight.arena, "seed": Rng.random_seed(), "speed": int(p.settings.get("battleSpeed", 1)),
		"festival": fight.mode != "invite" and Events.is_festival(int(p.day)), "startHp": start_hp,
		"talk": {"opponentId": fight.voice, "playerName": my_name, "intro": fight.intro},
	}
	if fresh:
		var sub0 := "%s · %s" % [Data.origin_name(str(p.origin)), I18n.t("common.lv", {"n": my_level})] if my_name == str(p.name) else I18n.t("common.lv", {"n": my_level})
		var nm1: String = I18n.tk("beast.%s.name" % fight.def.beast) if fight.def.get("beast") else str(fight.def.name)
		var ep := Names.opponent_epithet(fight.def)
		s.cards = [{"name": my_name, "sub": sub0}, {"name": nm1, "sub": (ep + " · " if ep != "" else "") + I18n.t("common.lv", {"n": fight.def.level})}]
	if fight.get("back") != null:
		var b0 := Stats.opponent_combatant(fight.back[0])
		var b1 := Stats.opponent_combatant(fight.back[1])
		s.back = {"fighters": [b0, b1], "seed": Rng.random_seed()}
	world.add_child(arena)
	arena.setup(s)
	view = arena
	bhud = BattleHud.new()
	bhud.theme = theme
	ui.add_child(bhud)
	bhud.setup(arena.engine, int(p.settings.get("battleSpeed", 1)), [my_level, fight.def.level], [me.visual.get("beast"), them.visual.get("beast")])
	bhud.set_favor(battle.favor)
	if arena.back_engine:
		bhud.show_back(arena.back_engine, [fight.back[0].level, fight.back[1].level])
		arena.back_event.connect(func(_e, eng): pass)
	arena.combat_event.connect(func(e, eng):
		bhud.event(e, eng)
		if battle != null:
			battle.favor = Crowd.after(float(battle.favor), e)
			bhud.set_favor(battle.favor))
	arena.frame.connect(func(eng):
		bhud.update(eng)
		if arena.back_engine:
			bhud.update_back(arena.back_engine))
	arena.finished.connect(_finish_battle)
	arena.speed_reset.connect(func(): bhud.set_speed(1))
	bhud.speed_changed.connect(_set_speed)
	bhud.forfeit_pressed.connect(_forfeit)


func _close_battle_hud() -> void:
	if bhud:
		bhud.queue_free()
		bhud = null


func _set_speed(s: int) -> void:
	Game.update(func(p): p.settings.battleSpeed = s)
	if arena:
		arena.set_speed(s)
	if bhud:
		bhud.set_speed(s)


func _forfeit() -> void:
	if arena == null or (arena.engine.finished and (arena.back_engine == null or arena.back_engine.finished)):
		return
	Modal.confirm(ui, I18n.t("battle.forfeitTitle"), I18n.t("battle.forfeitBody"), I18n.t("battle.forfeit"), func():
		if arena:
			arena.forfeit())


func _finish_battle(res: Dictionary, back_res) -> void:
	var ctx = battle
	if ctx == null:
		return
	var won: bool = int(res.winner) == 0
	var rng := _rng()
	if ctx.mode == "duo" and ctx.duo != null:
		return _finish_duo_bout(res, ctx, rng, back_res)
	arena.show_thumb(Crowd.thumb(float(ctx.favor)))
	if ctx.mode == "invite" and ctx.inviteId != null:
		var out = Game.update(func(p): return Act.finish_invite(p, ctx, res, rng))
		if out == null:
			return exit_battle()
		var again_final: bool = out.rw.get("final", false)
		_show_result(res, out.rw, ctx.opponent, "final" if again_final else "", out.notes, I18n.tk("invite.%s.title" % ctx.inviteId))
		return
	if ctx.mode == "tournament":
		var inj: int = Game.update(func(p): return Act.finish_tournament(p, ctx, res, rng))
		exit_battle()
		if inj > 0:
			_toast(I18n.t("injury.got", {"n": inj}), "bad", 5000)
		get_tree().create_timer(0.6).timeout.connect(show_bracket)
		return
	var out2: Dictionary = Game.update(func(p): return Act.finish_normal(p, ctx, res, rng))
	var rw: Dictionary = out2.rw
	if int(rw.get("levelUps", 0)) > 0:
		get_tree().create_timer(0.6).timeout.connect(func(): Sfx.play("levelup"))
	if int(rw.get("coins", 0)) > 0:
		Sfx.play("coin")
	var again := "free" if ctx.mode == "free" else ("retry" if ctx.mode == "ladder" and not won else "")
	_show_result(res, rw, ctx.opponent, again, out2.notes, I18n.t("venatio.today") if ctx.mode == "beast" else "")


func _show_result(res: Dictionary, rw: Dictionary, opp: Dictionary, again: String, notes: Array, title: String) -> void:
	var ctx = battle
	var m := Modal.open(ui, 300)
	ResultView.fill(m, res, rw, opp, again, notes, title)
	m.closed.connect(func():
		if battle != null and battle == ctx:
			exit_battle())
	m.set_meta("action", "")
	ResultView.on_action = func(a: String):
		if a == "points":
			m.close()
			hud.open_sheet("attrs")
		elif a == "again":
			if again == "final":
				battle = null
				m.close()
				start_battle({"mode": "invite", "inviteId": ctx.inviteId, "injuredOk": true})
			else:
				var err = Calendar.can_fight(Game.p)
				if err != null:
					Sfx.play("error")
					_toast(err, "bad", 5000)
					return
				battle = null
				m.close()
				start_battle({"mode": "free"} if ctx.mode == "free" else {"mode": "ladder", "opponentId": ctx.opponent.id})
		else:
			m.close()


func _finish_duo_bout(res: Dictionary, ctx: Dictionary, rng: Rng, back_res) -> void:
	var d: Dictionary = ctx.duo
	var outcome: String
	if int(d.run.bouts) == 0 and back_res != null:
		outcome = Duo.clash(d.run, {"winner": res.winner, "hp": [res.fighters[0].hp, res.fighters[1].hp]}, {"winner": back_res.winner, "hp": [back_res.fighters[0].hp, back_res.fighters[1].hp]})
	else:
		outcome = Duo.decider(d.run, int(res.winner))
	if outcome == "decider":
		var name: String = d.partner.name if d.run.playerOut else str(Game.p.name)
		_toast(I18n.t("duo.next", {"name": name, "foe": d.foes[int(d.run.b)].name}), "info", 3500)
		get_tree().create_timer(1.8).timeout.connect(_next_duo_bout)
		return
	arena.show_thumb(Crowd.thumb(float(ctx.favor)))
	var won := outcome == "win"
	var out: Dictionary = Game.update(func(p): return Act.finish_duo(p, ctx, res, won, rng))
	Sfx.play("coin")
	_show_result(res, out.rw, d.foes[mini(1, int(d.run.b))], "", out.notes, I18n.t("duo.title.result"))


func _next_duo_bout() -> void:
	var ctx = battle
	if ctx == null or ctx.duo == null:
		return
	var d: Dictionary = ctx.duo
	var p := Game.p
	var mine: bool = int(d.run.a) == 0
	var me := Stats.player_combatant(p) if mine else Stats.opponent_combatant(d.partner)
	var foe: Dictionary = d.foes[int(d.run.b)]
	ctx.opponent = foe
	var plan := {"def": foe, "mode": "duo", "arena": Fighters.arena_for_opponent(News.next_rival(p).id), "voice": "pool", "intro": "intro"}
	_launch_bout(me, int(p.level) if mine else int(d.partner.level), str(p.name) if mine else str(d.partner.name), plan, [d.run.ours[int(d.run.a)], d.run.theirs[int(d.run.b)]])


func exit_battle() -> void:
	battle = null
	arena = null
	_close_battle_hud()
	Sfx.stop_crowd()
	if Game.has_player():
		enter_location()


# ------------------------------------------------------------------ testes
## Ganchos para os testes automáticos (tests/run_tests.gd lê estes métodos).
func _test_hook() -> void:
	set_meta("ready", true)
