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
	if hud and hud.has_method("on_game_loaded"):
		hud.on_game_loaded(report)

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
	_apply_view()


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
	var pos := (vs / 2.0 - c * k).floor()
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
