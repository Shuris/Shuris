extends Node
## Testes da versão Godot (rodam sem tela): godot --headless --path . res://tests/run_tests.tscn
## Lógica (save compatível, criação, calendário) e o fluxo da interface (menu, criação,
## local, mapa e viagem, pausa).

var passed := 0
var failed := 0


func ok(cond: bool, msg: String) -> void:
	if cond:
		passed += 1
	else:
		failed += 1
		print("  FALHOU: ", msg)


func _ready() -> void:
	OS.set_environment("COLOSSEUM_ELECTRON_SAVES", "user://__sem_saves_electron__")
	for s in SaveSystem.SLOTS:
		Saves.remove(s)
	test_compile()
	test_save_compat()
	test_factory()
	test_calendar()
	load("res://tests/test_combat.gd").run(self)
	load("res://tests/test_systems.gd").run(self)
	await test_flow()
	print("Testes: %d ok, %d falharam" % [passed, failed])
	get_tree().quit(1 if failed else 0)


func test_compile() -> void:
	print("todos os scripts compilam")
	var bad := []
	var stack := ["res://scripts"]
	while stack.size() > 0:
		var dir: String = stack.pop_back()
		var da := DirAccess.open(dir)
		for sub in da.get_directories():
			stack.append(dir.path_join(sub))
		for f in da.get_files():
			if f.ends_with(".gd"):
				var sc = load(dir.path_join(f))
				if sc == null or not sc.can_instantiate():
					bad.append(f)
	ok(bad.is_empty(), "scripts sem erro " + str(bad))


func test_save_compat() -> void:
	print("save compatível com a versão Electron")
	var ref := FileAccess.open("res://data/reference_save.json", FileAccess.READ).get_as_text()
	var r := SaveSystem.parse(ref)
	ok(r.ok, "abre o save da versão Electron")
	var p: Dictionary = r.player
	ok(p.name == "Maximus Decimus" and p.origin == "thracian", "nome e origem")
	ok(int(p.baseAttributes.agi) == 7 and int(p.coins) == 150, "atributos e moedas")
	ok(p.news.editions.size() == 1 and p.career.has("chatDays"), "campos da carreira e do jornal preservados")
	# ida e volta: o que o Godot grava a versão Electron lê (mesmo envelope e campos)
	var again := SaveSystem.parse(SaveSystem.serialize(p, 1))
	ok(again.ok and again.player.name == p.name, "salvar e abrir de novo")
	var env: Dictionary = JSON.parse_string(SaveSystem.serialize(p, 2))
	ok(env.format == "colosseum-save" and int(env.version) == 5 and env.has("player"), "envelope igual ao da versão Electron")
	# saves antigos sem campos novos são completados
	var old: Dictionary = JSON.parse_string(ref)
	old.player.erase("career")
	old.player.erase("events")
	var r2 := SaveSystem.parse(JSON.stringify(old))
	ok(r2.ok and r2.player.career.has("respect") and r2.player.events.has("armDay"), "save antigo completado")
	# valores absurdos são corrigidos
	old.player.energy = 999
	old.player.level = -4
	old.player.equipment.mainHand = "nao_existe"
	var r3 := SaveSystem.parse(JSON.stringify(old))
	ok(int(r3.player.energy) == 100 and int(r3.player.level) == 1 and r3.player.equipment.mainHand == null, "valores corrigidos")
	ok(not SaveSystem.parse("{lixo").ok, "save corrompido recusado")
	old.version = 99
	ok(not SaveSystem.parse(JSON.stringify(old)).ok, "save de versão mais nova recusado")


func test_factory() -> void:
	print("criação do gladiador")
	var p := PlayerFactory.create("  Spartacus  ", "thracian", {"skin": 1, "hairStyle": 2, "hairColor": 1, "beard": true, "clothColor": 3}, 1000)
	ok(p.name == "Spartacus", "nome limpo")
	ok(int(p.baseAttributes.agi) == 7 and int(p.baseAttributes.prec) == 6, "bônus da origem trácia")
	ok(p.location == "home" and int(p.day) == 1 and int(p.minutes) == 480 and int(p.energy) == 100, "começa no alojamento às 8h")
	ok(PlayerFactory.validate_name("X") != null, "nome curto recusado")
	ok(PlayerFactory.validate_name("Marcus Aurelius") == null, "nome válido")
	ok(PlayerFactory.validate_name("<b>") != null, "caracteres inválidos recusados")


func test_calendar() -> void:
	print("calendário e viagens")
	var p := PlayerFactory.create("Teste", "gaul", {"skin": 0, "hairStyle": 0, "hairColor": 0, "beard": false, "clothColor": 0}, 1)
	ok(Calendar.travel(p, "market") == null and p.location == "market" and int(p.minutes) == 500, "viagem leva 20 minutos")
	ok(Calendar.travel(p, "market") != null, "não viaja para onde já está")
	var market := Data.location("market")
	ok(Calendar.is_open(market, 600, 1) and not Calendar.is_open(market, 600, 7), "mercado fecha aos domingos")
	ok(not Calendar.is_open(market, 21 * 60, 1), "mercado fecha à noite")
	ok(Calendar.clock_label(485) == "08:05", "relógio")
	p.minutes = Calendar.DAY_END - 5
	ok(Calendar.travel(p, "forum") != null, "não viaja depois da meia-noite")


func test_flow() -> void:
	print("fluxo do jogo (menu, criação, local, mapa, viagem, pausa)")
	var main: Node = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	await _frames(3)
	ok(main.screen is TitleScreen, "abre no menu principal")
	ok(main.screen.find_child("btn_continue", true, false) == null, "sem save: sem Continuar")
	(main.screen.find_child("btn_new", true, false) as Button).pressed.emit()
	await _frames(2)
	(main.screen.find_child("play_1", true, false) as Button).pressed.emit()
	await _frames(2)
	ok(main.screen is CreateScreen, "abre a criação do gladiador")
	var c: CreateScreen = main.screen
	c.name_edit.text = "X"
	c._finish()
	ok(c.error_label.text != "", "nome curto mostra erro")
	c.name_edit.text = "Maximus Decimus"
	c._finish()
	await _wait(1.5)
	ok(Game.has_player() and Game.p.name == "Maximus Decimus", "gladiador criado")
	ok(FileAccess.file_exists(Saves.path(1)), "save gravado no espaço 1")
	ok(main.view is LocationView and main.hud != null, "entra no alojamento com os painéis")
	main.show_map()
	await _frames(2)
	ok(main.view is MapView, "abre o mapa")
	var m0 := int(Game.p.minutes)
	main._travel("forum")
	await _wait(2.5)
	ok(Game.p.location == "forum" and int(Game.p.minutes) == m0 + 20, "viaja ao fórum pelo mapa")
	ok(main.view is LocationView, "mostra o fórum")
	main._open_pause()
	await _frames(2)
	ok(main.pause != null, "Esc abre a pausa")
	main._close_pause()
	main.show_title()
	await _frames(3)
	ok(main.screen.find_child("btn_continue", true, false) != null, "menu mostra Continuar com save")
	var back := Saves.read(1)
	ok(back.player != null and back.player.location == "forum", "save reabre no fórum")
	main.queue_free()


func _wait(sec: float) -> void:
	await get_tree().create_timer(sec).timeout


func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame
