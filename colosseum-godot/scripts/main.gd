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


func _ready() -> void:
	theme = UiTheme.build()
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
		var p := PlayerFactory.create(name, origin, a, int(Time.get_unix_time_from_system() * 1000.0))
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
	world.add_child(lv)
	lv.setup(p.location, p.appearance, Data.gear_of(p))
	view = lv
	_set_screen(null)
	if not hud:
		hud = Hud.new()
		hud.go_map.connect(show_map)
		hud.go_location.connect(func(): enter_location())
		ui.add_child(_themed(hud))
	hud.show_location()
	hud.refresh()


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


func _on_game_changed() -> void:
	if hud:
		hud.refresh()
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


# ------------------------------------------------------------------ testes
## Ganchos para os testes automáticos (tests/run_tests.gd lê estes métodos).
func _test_hook() -> void:
	set_meta("ready", true)
