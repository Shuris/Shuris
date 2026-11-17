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
	get_tree().quit()


func shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join(name + ".png"))


func _wait(sec: float) -> void:
	await get_tree().create_timer(sec).timeout
