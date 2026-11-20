extends Control
## Root of the game. Composes the pixel-perfect world view (SubViewport at an
## integer scale), the touch layer that turns screen taps into world taps,
## the gameplay systems and the HUD.

const WORLD_SCALE := 2

var container: SubViewportContainer
var viewport: SubViewport
var world: World
var touch_layer: Control
var hud: Node
var wildlife: Node
var visitors: Node
var dev: Node


func _ready() -> void:
	container = SubViewportContainer.new()
	container.stretch = true
	container.stretch_shrink = WORLD_SCALE
	container.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	container.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(container)
	viewport = SubViewport.new()
	viewport.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_NEAREST
	viewport.snap_2d_transforms_to_pixel = true
	viewport.snap_2d_vertices_to_pixel = true
	viewport.audio_listener_enable_2d = false
	container.add_child(viewport)
	world = World.new()
	viewport.add_child(world)

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


func _layout() -> void:
	var vs := get_viewport_rect().size
	var base := Vector2(800, 360) * WORLD_SCALE
	var s := maxf(1.0, maxf(vs.x / base.x, vs.y / base.y))
	container.size = base
	container.scale = Vector2(s, s)
	container.position = ((vs - base * s) / 2.0).floor()


## Screen (Main local) -> world pixel coordinates.
func screen_to_world(p: Vector2) -> Vector2:
	return (p - container.position) / (WORLD_SCALE * container.scale.x)


func world_to_screen(p: Vector2) -> Vector2:
	return container.position + p * WORLD_SCALE * container.scale.x


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
