extends Node
## Automated smoke test (run with: -- --selftest --out=/some/dir).
## Drives the real input path (screen touches through the TouchLayer and
## HUD), checks game-state effects and captures screenshots of each screen.

var main: Node
var out := "user://selftest"
var results: Array = []


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
	DirAccess.make_dir_recursive_absolute(out)
	_run.call_deferred()


func _check(name: String, ok: bool, detail: String = "") -> void:
	results.append([name, ok])
	print("%s  %s %s" % ["PASS" if ok else "FAIL", name, detail])


func _wait(frames: int) -> void:
	for i in frames:
		await get_tree().process_frame


func _shot(name: String) -> void:
	await _wait(3)
	get_viewport().get_texture().get_image().save_png(out.path_join(name + ".png"))


func _touch(screen: Vector2, pressed: bool) -> void:
	var e := InputEventScreenTouch.new()
	e.position = screen
	e.pressed = pressed
	e.index = 0
	Input.parse_input_event(e)


func _tap_screen(screen: Vector2) -> void:
	_touch(screen, true)
	await _wait(2)
	_touch(screen, false)
	await _wait(2)


func _run() -> void:
	await _wait(30)
	var gs := GameState
	var hud = main.hud
	var world: World = main.world
	# dismiss any welcome dialog
	for c in hud.overlay.get_children():
		c.queue_free()
	await _wait(2)
	gs.water = 2000.0
	gs.seeds = 200.0

	# 1) tap the creek through the real input path
	var taps0: int = gs.total_taps
	var w0 := gs.water
	var wp := world.random_water_point(260.0)
	await _tap_screen(main.world_to_screen(wp))
	_check("tap water increases taps", gs.total_taps == taps0 + 1, "(%d -> %d)" % [taps0, gs.total_taps])
	_check("tap water gives water", gs.water > w0)

	# 2) build drawer
	hud.open_panel("build")
	await _wait(20)
	await _shot("02_build_panel")
	_check("build drawer opens", hud.drawer_open and hud.drawer_name == "build")

	# 3) placement via touch
	hud.start_placement("flowers")
	await _wait(5)
	var n0: int = gs.placed.size()
	var target := Vector2(250, 240)
	for tx in range(150, 380, 12):
		var cand := Vector2(tx, 250)
		if world.placement_error("flowers", cand) == "":
			target = cand
			break
	var sp: Vector2 = main.world_to_screen(target)
	_touch(sp, true)
	await _wait(3)
	await _shot("03_placing_ghost")
	_touch(sp, false)
	await _wait(5)
	_check("place flowers by touch", gs.placed.size() == n0 + 1, "at %s" % target)
	# invalid placement (in water) must fail
	var n1: int = gs.placed.size()
	await _tap_screen(main.world_to_screen(wp))
	_check("cannot place flowers in water", gs.placed.size() == n1)
	# aquatic plant in water must succeed
	hud.start_placement("aquatic")
	var placed_aquatic := false
	for row in GameData.scene["creek_rows"]:
		var y := float(row["y"])
		if y < 250:
			continue
		var cand := Vector2((float(row["l"]) + float(row["r"])) / 2.0, y)
		if world.placement_error("aquatic", cand) == "":
			await _tap_screen(main.world_to_screen(cand))
			placed_aquatic = true
			break
	_check("place aquatic plant in water", placed_aquatic and gs.counts.get("aquatic", 0) >= 1)
	hud.cancel_modes()
	await _wait(10)

	# 4) upgrades
	hud.open_panel("upgrades")
	await _wait(20)
	await _shot("04_upgrades_panel")
	var lvl0 := gs.upgrade_level("filter")
	var q0 := gs.quality
	gs.buy_upgrade("filter")
	_check("buy filter upgrade", gs.upgrade_level("filter") == lvl0 + 1 and gs.quality > q0,
		"quality %.0f -> %.0f" % [q0, gs.quality])

	# 5) eco + info panels
	hud.open_panel("eco")
	await _wait(20)
	await _shot("05_eco_panel")
	hud.open_panel("info")
	await _wait(20)
	await _shot("06_info_panel")
	hud.close_drawer()
	await _wait(20)

	# 6) progression to stage 2 by placing more items
	for i in 12:
		var id: String = ["flowers", "grass", "fern", "big_rock"][i % 4]
		for k in 40:
			var c := Vector2(randf_range(130, 690), randf_range(200, 345))
			if world.placement_error(id, c) == "":
				gs.place_item(id, c, 0)
				break
	await _wait(10)
	_check("reached stage 2", gs.stage >= 2, "stage=%d beauty=%d vit=%d" % [gs.stage, int(gs.beauty), int(gs.vitality)])
	await _wait(60)
	await _shot("07_stage_banner")

	# 7) wildlife eligibility
	gs.recompute()
	_check("butterflies eligible with flowers", gs.eligible_animals.has("butterfly"))
	_check("fish eligible after filter+aquatic", gs.eligible_animals.has("fish") == (gs.quality >= 45.0))

	# 8) save / load round trip
	SaveSystem._loaded = true
	SaveSystem.save_now()
	var f := FileAccess.open(SaveSystem.SAVE_PATH, FileAccess.READ)
	var data: Dictionary = JSON.parse_string(f.get_as_text())
	_check("save file written", data.has("state") and data["state"]["placed"].size() == gs.placed.size())
	var placed_before: int = gs.placed.size()
	var stage_before: int = gs.stage
	gs.reset_state()
	gs.from_dict(data["state"])
	_check("load restores placed items", gs.placed.size() == placed_before and gs.stage == stage_before)
	# offline progress (simulate 1h away)
	var wb := gs.water
	var rep: Dictionary = SaveSystem._apply_offline(Time.get_unix_time_from_system() - 3600.0)
	_check("offline progress", gs.water > wb and rep.has("water"), "+%.0f water for 1h" % float(rep.get("water", 0)))
	var rep2: Dictionary = SaveSystem._apply_offline(Time.get_unix_time_from_system() - 3600.0 * 48)
	_check("offline progress capped", bool(rep2.get("capped", false)))
	SaveSystem.delete_save()

	var fails := 0
	for r in results:
		if not r[1]:
			fails += 1
	print("SELFTEST DONE: %d checks, %d failed" % [results.size(), fails])
	get_tree().quit(1 if fails > 0 else 0)
