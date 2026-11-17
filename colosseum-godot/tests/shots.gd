extends Node
## Capturas para conferência visual: godot --path . res://tests/shots.tscn -- <pasta>

var out := "user://shots"


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	DirAccess.make_dir_recursive_absolute(out)
	OS.set_environment("COLOSSEUM_ELECTRON_SAVES", "user://__sem__")
	for s in SaveSystem.SLOTS:
		Saves.remove(s)
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
	DisplayServer.window_set_size(Vector2i(1280, 720))
	var main: Node = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	await _wait(0.6)
	await shot("01-menu")
	(main.screen.find_child("btn_new", true, false) as Button).pressed.emit()
	await _wait(0.2)
	await shot("02-saves")
	(main.screen.find_child("play_1", true, false) as Button).pressed.emit()
	await _wait(0.4)
	var c: CreateScreen = main.screen
	c.appearance = {"skin": 1, "hairStyle": 3, "hairColor": 2, "beard": true, "clothColor": 0}
	c.name_edit.text = "Maximus Decimus"
	c.rebuild()
	await _wait(0.3)
	await shot("03-criacao")
	c._finish()
	await _wait(1.6)
	await shot("04-alojamento")
	for loc in [["forum", 11 * 60], ["market", 15 * 60], ["ludus", 18 * 60 + 30], ["tavern", 21 * 60], ["temple", 22 * 60], ["baths", 6 * 60 + 20]]:
		Game.p.location = loc[0]
		Game.p.minutes = loc[1]
		main.enter_location()
		await _wait(0.5)
		await shot("05-%s" % loc[0])
	main.show_map()
	await _wait(0.4)
	await shot("06-mapa")
	main.hud.tab = "gladiator"
	Game.p.location = "forum"
	main.enter_location()
	main.hud.tab = "gladiator"
	main.hud.refresh()
	await _wait(0.4)
	await shot("07-gladiador")
	if OS.get_environment("SHOTS_PART") == "1":
		get_tree().quit()
		return
	# etapa 2/3: painéis, luta, resultado, jornal, chave
	var p := Game.p
	p.level = 6
	p.coins = 900
	p.unspentPoints = 3
	p.skillPoints = 2
	p.day = 9
	p.reputation = 160
	p.defeatedOpponents = ["marcus", "cassius"]
	p.rivals = {"marcus": {"wins": 1, "losses": 0}, "cassius": {"wins": 1, "losses": 1}}
	p.selectedOpponent = "rufus"
	main.hud.tab = "location"
	main.hud.st.charTab = "attrs"
	for loc in [["arena", 14 * 60], ["ludus", 10 * 60], ["market", 11 * 60], ["temple", 12 * 60], ["tavern", 20 * 60], ["forum", 13 * 60], ["home", 21 * 60], ["baths", 15 * 60]]:
		p.location = loc[0]
		p.minutes = loc[1]
		main.enter_location()
		await _wait(0.5)
		await shot("10-painel-%s" % loc[0])
	# moradores falando e um dia de chuva
	p.location = "tavern"
	p.minutes = 20 * 60
	main.enter_location()
	await _wait(0.5)
	var lv: LocationView = main.view
	if lv.life.talkers.size() > 1:
		lv.life.talk(lv.life.talkers[1])
	await _wait(0.6)
	await shot("15-taverna-fala")
	p.location = "ludus"
	p.minutes = 10 * 60
	p.upgrades = ["stone_weights", "sand_track", "agility_stakes", "doctore"]
	main.enter_location()
	await _wait(1.0)
	await shot("16-ludus-gente")
	var keep_day := int(p.day)
	for d in range(1, 120):
		if float(Weather.now(int(p.createdAt), d).rain) > 0.5:
			p.day = d
			break
	p.location = "forum"
	p.minutes = 11 * 60
	main.enter_location()
	await _wait(1.2)
	await shot("17-forum-chuva")
	p.day = keep_day
	p.location = "market"
	main.enter_location()
	await _wait(0.8)
	await shot("18-mercado-gente")
	main.hud.st.marketTab = "upgrades"
	p.location = "market"
	main.enter_location()
	await _wait(0.4)
	await shot("11-mercado-melhorias")
	main.hud.st.arenaTab = "events"
	p.location = "arena"
	main.enter_location()
	await _wait(0.4)
	await shot("12-arena-eventos")
	main.hud.st.arenaTab = "fights"
	main.hud.tab = "gladiator"
	main.hud.refresh()
	await _wait(0.3)
	await shot("13-gladiador-atributos")
	main.hud.st.charTab = "gear"
	main.hud.refresh()
	await _wait(0.3)
	await shot("14-gladiador-equipamento")
	main.hud.tab = "location"
	# luta
	p.minutes = 14 * 60
	p.energy = 100
	main.start_battle({"mode": "ladder", "opponentId": "rufus"})
	await _wait(0.9)
	await shot("20-luta-intro")
	main.arena.set_speed(2)
	await _wait(3.5)
	await shot("21-luta-meio")
	await _wait(2.0)
	await shot("22-luta-meio2")
	var t := 0.0
	while main.battle != null and main.bhud != null and t < 60:
		main.arena.set_speed(3)
		await _wait(0.5)
		t += 0.5
		if main.arena and main.arena.engine.finished:
			break
	await _wait(1.2)
	await shot("23-luta-fim")
	await _wait(4.0)
	await shot("24-resultado")
	for m in main.ui.get_children():
		if m is Modal:
			m.close()
	await _wait(1.0)
	# jornal
	var rng := Rng.new(42)
	News.publish(p, rng)
	if p.news.editions.size():
		main.read_edition(int(p.news.editions[0].day))
		await _wait(0.4)
		await shot("25-jornal")
		for m in main.ui.get_children():
			if m is Modal:
				m.close()
	# chave do torneio
	p.day = 13
	p.tournament.registered = 13
	p.minutes = Tournament.START
	Tournament.start(p)
	main.show_bracket()
	await _wait(0.4)
	await shot("26-torneio")
	for m in main.ui.get_children():
		if m is Modal:
			m.close()
	# dupla (duelos simultâneos)
	p.day = 9
	p.tournament.run = null
	p.minutes = 10 * 60
	p.energy = 100
	p.career.respect["marcus"] = 100
	p.career.partner = "marcus"
	main.start_battle({"mode": "duo", "injuredOk": true})
	await _wait(3.0)
	await shot("27-dupla")
	get_tree().quit()


func shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join(name + ".png"))


func _wait(sec: float) -> void:
	await get_tree().create_timer(sec).timeout
