extends Control
## Root of the game. Composes the pixel-perfect world view (SubViewport at an
## integer scale), the touch layer that turns screen taps into world taps,
## the gameplay systems and the HUD.

const WORLD_SCALE := 2
const GRADE := preload("res://shaders/grade.gdshader")

var display: Control          # holds the world image and the light layer
var world_rect: TextureRect
var light_rect: TextureRect
var viewport: SubViewport
var light_viewport: SubViewport
var grade_mat: ShaderMaterial
var base_scale := 1.0          # fit-to-screen scale
var zoom := 1.0                # photo-mode zoom (integer steps)
var pan := Vector2.ZERO        # photo-mode pan, in art pixels
var world: World
var touch_layer: Control
var hud: Node
var wildlife: Node
var visitors: Node
var dev: Node


func _ready() -> void:
	viewport = _make_viewport(false)
	light_viewport = _make_viewport(true)
	display = Control.new()
	display.name = "WorldDisplay"
	display.mouse_filter = Control.MOUSE_FILTER_IGNORE
	display.clip_contents = false
	add_child(display)
	world_rect = TextureRect.new()
	world_rect.texture = viewport.get_texture()
	world_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	world_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	world_rect.stretch_mode = TextureRect.STRETCH_SCALE
	world_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	grade_mat = ShaderMaterial.new()
	grade_mat.shader = GRADE
	world_rect.material = grade_mat
	display.add_child(world_rect)
	light_rect = TextureRect.new()
	light_rect.texture = light_viewport.get_texture()
	light_rect.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	light_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	light_rect.stretch_mode = TextureRect.STRETCH_SCALE
	light_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	var add := CanvasItemMaterial.new()
	add.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	light_rect.material = add
	display.add_child(light_rect)
	world = World.new()
	viewport.add_child(world)
	var lights := Node2D.new()
	lights.name = "Lights"
	light_viewport.add_child(lights)
	world.lights_root = lights

	touch_layer = Control.new()
	touch_layer.name = "TouchLayer"
	touch_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	touch_layer.mouse_filter = Control.MOUSE_FILTER_STOP
	touch_layer.gui_input.connect(_on_touch)
	add_child(touch_layer)

	var systems := Node.new()
	systems.name = "Systems"
	add_child(systems)
	if ResourceLoader.exists("res://scripts/systems/WildlifeDirector.gd"):
		wildlife = load("res://scripts/systems/WildlifeDirector.gd").new()
		wildlife.name = "WildlifeDirector"
		wildlife.world = world
		systems.add_child(wildlife)
	if ResourceLoader.exists("res://scripts/systems/VisitorDirector.gd"):
		visitors = load("res://scripts/systems/VisitorDirector.gd").new()
		visitors.name = "VisitorDirector"
		visitors.world = world
		systems.add_child(visitors)

	var nests := NestSystem.new()
	nests.name = "NestSystem"
	nests.world = world
	nests.wildlife = wildlife
	systems.add_child(nests)
	var events := NatureEvents.new()
	events.name = "NatureEvents"
	events.world = world
	events.wildlife = wildlife
	events.nests = nests
	systems.add_child(events)

	var atmo := Atmosphere.new()
	atmo.name = "Atmosphere"
	atmo.main = self
	atmo.world = world
	systems.add_child(atmo)

	if ResourceLoader.exists("res://scripts/ui/HUD.gd"):
		hud = load("res://scripts/ui/HUD.gd").new()
		hud.main = self
		add_child(hud)

	get_viewport().size_changed.connect(_layout)
	_layout()

	var report := SaveSystem.load_game()
	world.rebuild_items()
	AudioManager.start_ambience()
	Settings.world = world
	Settings.apply_display()
	Settings.apply_effects()
	_setup_input()
	if hud and hud.has_method("on_game_loaded"):
		hud.on_game_loaded(report)
	# title screen (skipped for automated runs: screenshots / self-test)
	var dev_run := false
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot") or a == "--selftest" or a == "--notitle":
			dev_run = true
	if not dev_run:
		open_menu(false)

	dev = load("res://scripts/util/DevTools.gd").new()
	dev.main = self
	add_child(dev)
	if "--selftest" in OS.get_cmdline_user_args():
		var t: Node = load("res://scripts/util/SelfTest.gd").new()
		t.set("main", self)
		add_child(t)


func _make_viewport(transparent: bool) -> SubViewport:
	var vp := SubViewport.new()
	vp.size = Vector2i(800, 360)
	vp.transparent_bg = transparent
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NEAREST
	vp.snap_2d_transforms_to_pixel = true
	vp.snap_2d_vertices_to_pixel = true
	vp.audio_listener_enable_2d = false
	add_child(vp)
	return vp


func _layout() -> void:
	var vs := get_viewport_rect().size
	var base := Vector2(800, 360) * WORLD_SCALE
	base_scale = maxf(1.0, maxf(vs.x / base.x, vs.y / base.y))
	if Settings.is_desktop():
		# PC: whole window pixels per art pixel (crisp pixels at any window
		# size). Rounded cover scale; a slightly short axis gets thin bars.
		var cs := _content_scale()
		var cover := maxf(vs.x / 800.0, vs.y / 360.0) * cs
		var n := maxf(1.0, roundf(cover))
		base_scale = n / (WORLD_SCALE * cs)
	_apply_view()


## Window pixels per viewport unit (stretch mode "canvas_items").
func _content_scale() -> float:
	return get_viewport().get_final_transform().get_scale().x


## Pixels of screen per art pixel (integer in photo mode zoom steps).
func view_scale() -> float:
	return WORLD_SCALE * base_scale * zoom


func _apply_view() -> void:
	var vs := get_viewport_rect().size
	var k := view_scale()
	var size := Vector2(800, 360) * k
	# centre of the view in art pixels (pan moves it); clamp so no void shows
	var half := vs / (2.0 * k)
	var c := Vector2(400, 180) + pan
	c.x = clampf(c.x, half.x, 800.0 - half.x) if half.x < 400.0 else 400.0
	c.y = clampf(c.y, half.y, 360.0 - half.y) if half.y < 180.0 else 180.0
	pan = c - Vector2(400, 180)
	var cs := _content_scale()
	var pos := ((vs / 2.0 - c * k) * cs).floor() / cs
	for r in [world_rect, light_rect]:
		r.position = pos
		r.size = size
	display.size = vs


func set_zoom(z: float, focus_screen: Vector2 = Vector2(-1, -1)) -> void:
	var vs := get_viewport_rect().size
	if focus_screen.x < 0:
		focus_screen = vs / 2.0
	var before := screen_to_world(focus_screen)
	zoom = clampf(z, 1.0, 4.0)
	_apply_view()
	var after := screen_to_world(focus_screen)
	pan += before - after
	_apply_view()


func reset_view() -> void:
	zoom = 1.0
	pan = Vector2.ZERO
	_apply_view()


var photo: PhotoMode


func enter_photo_mode() -> void:
	if photo:
		return
	if hud:
		hud.close_drawer()
		hud.visible = false
	touch_layer.visible = false
	photo = PhotoMode.new()
	photo.main = self
	add_child(photo)


func exit_photo_mode() -> void:
	if photo == null:
		return
	photo.queue_free()
	photo = null
	reset_view()
	touch_layer.visible = true
	if hud:
		hud.visible = true


# ------------------------------------------------------------------ PC: menus & keys
var menu: MenuScreen


func open_menu(as_pause: bool) -> void:
	if menu:
		return
	if hud:
		hud.close_drawer()
		hud.visible = false
	touch_layer.visible = false
	menu = MenuScreen.new()
	menu.main = self
	menu.pause = as_pause
	add_child(menu)


func close_menu() -> void:
	if menu == null:
		return
	get_tree().paused = false
	var m := menu
	menu = null
	var t := m.create_tween()
	t.tween_property(m, "modulate:a", 0.0, 0.3)
	t.tween_callback(m.queue_free)
	if photo == null:
		touch_layer.visible = true
		if hud:
			hud.visible = true


const KEYS := {
	"lc_menu": [KEY_ESCAPE], "lc_build": [KEY_B], "lc_upgrades": [KEY_U], "lc_eco": [KEY_E],
	"lc_journal": [KEY_J], "lc_info": [KEY_I], "lc_photo": [KEY_P, KEY_F12], "lc_fullscreen": [KEY_F11],
	"lc_zoom_in": [KEY_EQUAL, KEY_KP_ADD, KEY_PAGEUP], "lc_zoom_out": [KEY_MINUS, KEY_KP_SUBTRACT, KEY_PAGEDOWN],
	"lc_left": [KEY_LEFT, KEY_A], "lc_right": [KEY_RIGHT, KEY_D], "lc_up": [KEY_UP, KEY_W], "lc_down": [KEY_DOWN, KEY_S],
	"lc_capture": [KEY_SPACE, KEY_ENTER],
}


func _setup_input() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for action in KEYS.keys():
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		for k in KEYS[action]:
			var e := InputEventKey.new()
			e.physical_keycode = k
			InputMap.action_add_event(action, e)


func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey) or not event.pressed or event.echo:
		if photo and event is InputEventKey and event.pressed:
			pass
		else:
			return
	if event.is_action_pressed("lc_fullscreen"):
		Settings.toggle_fullscreen()
		get_viewport().set_input_as_handled()
		return
	if event.is_action_pressed("lc_menu"):
		get_viewport().set_input_as_handled()
		if menu:
			if not menu.back() and not menu.pause:
				close_menu()   # Esc on the title screen also starts the game
			return
		if photo:
			exit_photo_mode()
			return
		if hud and hud.drawer_open:
			hud.close_drawer()
			return
		open_menu(true)
		return
	if menu:
		return
	if photo:
		var step := 24.0 / view_scale()
		if event.is_action_pressed("lc_zoom_in"):
			photo._step(1)
		elif event.is_action_pressed("lc_zoom_out"):
			photo._step(-1)
		elif event.is_action_pressed("lc_capture"):
			photo.capture()
		elif event.is_action("lc_left"):
			pan.x -= step * 4.0
			_apply_view()
		elif event.is_action("lc_right"):
			pan.x += step * 4.0
			_apply_view()
		elif event.is_action("lc_up"):
			pan.y -= step * 4.0
			_apply_view()
		elif event.is_action("lc_down"):
			pan.y += step * 4.0
			_apply_view()
		elif event.is_action_pressed("lc_photo"):
			exit_photo_mode()
		return
	if event.is_action_pressed("lc_photo"):
		enter_photo_mode()
	elif hud:
		for pair in [["lc_build", "build"], ["lc_upgrades", "upgrades"], ["lc_eco", "eco"], ["lc_journal", "journal"],
				["lc_info", "info"]]:
			if event.is_action_pressed(pair[0]):
				hud.open_panel(pair[1])
				get_viewport().set_input_as_handled()
				return


## Screen (Main local) -> world pixel coordinates.
func screen_to_world(p: Vector2) -> Vector2:
	return (p - world_rect.position) / view_scale()


func world_to_screen(p: Vector2) -> Vector2:
	return world_rect.position + p * view_scale()


var _press_pos := Vector2.ZERO
var _pressed := false


func _on_touch(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var wp := screen_to_world(event.position)
		if hud and hud.has_method("world_touch") and hud.world_touch(event, wp):
			return
		if event.pressed:
			_pressed = true
			_press_pos = event.position
		elif _pressed:
			_pressed = false
			if event.position.distance_to(_press_pos) < 24.0:
				world.handle_tap(wp)
	elif event is InputEventScreenDrag:
		if hud and hud.has_method("world_drag"):
			hud.world_drag(event, screen_to_world(event.position))
