extends Node
## Developer helpers driven by command-line user args (after "--"):
##   --shot=res_or_abs_path.png   take a screenshot after --frames=N frames
##   --state=stage2|stage3|stage4 seed a demo ecosystem (no save is written)
##   --quit                       quit after the screenshot
## Used for automated visual checks; harmless in normal play.

var main: Node
var _shot := ""
var _frames := 90
var _quit := false
var _count := 0


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="):
			_shot = a.substr(7)
		elif a.begins_with("--frames="):
			_frames = int(a.substr(9))
		elif a == "--quit":
			_quit = true
		elif a.begins_with("--state="):
			seed_state(a.substr(8))
		elif a.begins_with("--spawn="):
			call_deferred("_spawn", a.substr(8).split(","))
		elif a == "--layout":
			call_deferred("_print_layout")
		elif a.begins_with("--ui="):
			call_deferred("_open_ui", a.substr(5))


func _spawn(names: PackedStringArray) -> void:
	await get_tree().process_frame
	var wd: Node = main.wildlife
	for n in names:
		match n:
			"deer":
				var d := Deer.new()
				main.world.entities.add_child(d)
				var spots: Array = GameData.scene["drink_spots"]
				d.setup(main.world, spots[randi() % spots.size()])
				d.position = Vector2(float(d.spot["x"]), float(d.spot["y"]))
				d.face(float(d.spot["face"]))
				d.set_state("lower")
				d.play("lower")
			"visitor":
				var v := Visitor.new()
				main.world.entities.add_child(v)
				v.add_to_group("visitors")
				v.setup(main.world, randi() % 3, main.visitors)
				v.position = v.path[3] if v.path.size() > 3 else v.position
				v.idx = 4
			_:
				wd._spawn(n)


func _print_layout() -> void:
	await get_tree().process_frame
	print("main ", main.size, " vp ", main.get_viewport_rect().size, " hud ", main.hud.size,
		" overlay ", main.hud.overlay.size, " buttons ", main.hud.buttons.position)


func _open_ui(name: String) -> void:
	if main.hud and main.hud.has_method("open_panel"):
		main.hud.open_panel(name)


func seed_state(name: String) -> void:
	SaveSystem._loaded = false  # never overwrite the player's save from a demo
	var lvl: int = {"stage2": 2, "stage3": 3, "stage4": 4}.get(name, 1)
	GameState.water = 5000.0
	GameState.seeds = 400.0
	var layout := [
		["flowers", 230, 250], ["flowers", 300, 300], ["flowers", 600, 270], ["grass", 270, 280],
		["fern", 380, 300], ["shrub", 170, 280], ["big_rock", 330, 248], ["flowers", 640, 316],
	]
	if lvl >= 3:
		layout += [["aquatic", 456, 268], ["aquatic", 470, 330], ["tree_small", 600, 230],
			["tree_small", 250, 222], ["shrub", 650, 300], ["fern", 560, 320], ["tree_big", 180, 244],
			["shrub", 540, 240], ["flowers", 200, 306]]
	if lvl >= 4:
		layout += [["bench", 400, 296], ["feeder", 230, 262], ["tree_big", 640, 262]]
	GameState.upgrades = {"filter": 2 + (lvl - 2) * 3, "spring": 4, "tap": 3}
	GameState.stage = lvl
	for e in layout:
		var p := Vector2(e[1], e[2])
		GameState.placed.append({"uid": GameState.next_uid, "id": e[0], "x": p.x, "y": p.y, "v": randi() % int(GameData.items[e[0]]["variants"])})
		GameState.next_uid += 1
	GameState.recompute(false)
	main.world.rebuild_items()


func _process(_d: float) -> void:
	if _shot == "":
		return
	_count += 1
	if _count == _frames:
		var img := get_viewport().get_texture().get_image()
		img.save_png(_shot)
		print("screenshot saved: ", _shot)
		if _quit:
			get_tree().quit()
