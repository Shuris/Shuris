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
		if a.begins_with("--seed="):
			seed(int(a.substr(7)))
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
		elif a.begins_with("--time="):
			var t := a.substr(7)
			var hours := {"dawn": 6.4, "day": 11.0, "dusk": 18.2, "night": 22.5}
			Clock.set_hour(float(hours.get(t, t.to_float())))
		elif a.begins_with("--season="):
			var parts := a.substr(9).split(":")
			Clock.set_season(Clock.SEASONS.find(parts[0]), float(parts[1]) if parts.size() > 1 else 14.0)
		elif a.begins_with("--weather="):
			Weather.force(a.substr(10), 3.0)
		elif a == "--fillall":
			call_deferred("_fillall")
		elif a == "--autofill":
			call_deferred("_autofill")
		elif a.begins_with("--photo="):
			call_deferred("_photo", a.substr(8))
		elif a == "--clean":
			call_deferred("_clean")
		elif a == "--perf":
			call_deferred("_perf")
		elif a == "--prewarm":
			call_deferred("_prewarm")
		elif a == "--rainbow":
			call_deferred("_rainbow")
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
			"crosser":
				# a visitor standing on the bridge, mid-crossing
				var v3 := Visitor.new()
				main.world.entities.add_child(v3)
				v3.add_to_group("visitors")
				v3.setup(main.world, randi() % 3, main.visitors)
				for k in 20:
					v3.build_route()
					if v3.crosses:
						break
				v3.plan = []
				var off: int = [-4, 1][get_tree().get_nodes_in_group("visitors").size() % 2]
				v3.idx = v3.bridge_mid_idx + off + 1
				v3.position = v3.path[v3.bridge_mid_idx + off]
				v3.modulate.a = 1.0
			"sitter", "feeder", "photo", "look":
				var v2 := Visitor.new()
				main.world.entities.add_child(v2)
				v2.add_to_group("visitors")
				v2.setup(main.world, {"sitter": 1, "feeder": 0, "photo": 1, "look": 2}[n], main.visitors)
				v2.modulate.a = 1.0
				var poi: String = {"sitter": "bench", "feeder": "feeder"}.get(n, "")
				var nodes: Array = main.world.items_with_poi(poi) if poi != "" else []
				if poi != "" and not nodes.is_empty():
					var node: Node2D = nodes[0]
					v2.position = node.position + (Vector2(0, 1) if poi == "bench" else Vector2(-16, 4))
					v2.activity = {"type": poi, "node": node}
				else:
					v2.position = v2.path[min(5, v2.path.size() - 1)] if n == "look" else Vector2(470, 316)
					v2.activity = {"type": "view"}
				v2._start_activity()
				v2.wait = 999.0
				if n == "photo":
					v2.position = Vector2(560, 318)
					v2.face(-1.0)
					v2.play("photo")
				elif n == "look":
					v2.play("look")
			"fox", "maned_wolf":
				var wn: Wanderer = wd.spawn_wanderer(n)
				wn.position = wn.waypoints[0]
				wn.wi = 1
				wn.set_state("pause")
				wn.pause = 999.0
				wn.play("look")
			"fawn":
				var df: Deer = wd.spawn_deer(true)
				df.position = Vector2(float(df.spot["x"]), float(df.spot["y"]))
				df.face(float(df.spot["face"]))
				df.set_state("drink")
				df.wait = 999.0
				df.play("drink")
				df.fawn.position = df.position + Vector2(-17.0 * df.facing, 4.0)
			"nest":
				var ns: Node = main.get_node("Systems/NestSystem")
				if ns.start_nest():
					ns.nests[-1]["start_h"] = Clock.total_hours - 80.0
					var it: PlacedItem = main.world.items[int(ns.nests[-1]["tree_uid"])]
					print("NEST at ", ns._nest_pos(it), " tree ", it.id, " ", it.position)
			"owl_perched":
				var ow: Owl = wd._spawn("owl")
				ow.position = ow.target
				ow.t = 1.0
			"rabbit", "rabbits":
				for k in (3 if n == "rabbits" else 1):
					var rb: Rabbit = wd.spawn_rabbit(k % 3)
					rb.modulate.a = 1.0
					var gr: Array = main.world.items_of("grass")
					if k < gr.size():
						var g: PlacedItem = gr[(k * 3) % gr.size()]
						for j in gr.size():
							g = gr[(k * 3 + j) % gr.size()]
							if main.world.walkable(g.position + Vector2(11, 2)):
								break
						rb.position = g.position + Vector2(11, 2)
						if n == "rabbits" and k > 0:
							# group the three near the first one (showcase)
							var first: Vector2 = get_tree().get_meta("rabbit0", rb.position)
							for t in 30:
								var q := first + Vector2(randf_range(-40, 40), randf_range(-12, 12))
								if main.world.animal_spot_ok(q, 3.0):
									rb.position = q
									break
						elif n == "rabbits":
							get_tree().set_meta("rabbit0", rb.position)
						rb.focus = g
						rb.face(-1.0)
						rb.set_state("forage")
						rb.play(["eat", "look", "idle"][k % 3])
						rb.wait = 999.0
			"duck":
				GameState.ducks_resident = true
				GameState.recompute(false)
				wd._spawn("duck")
			_:
				wd._spawn(n)


## Fill the creek by buying through the AutoPlacer (like a player would).
func _autofill() -> void:
	await get_tree().process_frame
	SaveSystem._loaded = false
	GameState.stage = 4
	GameState.water = 1e7
	GameState.seeds = 1e5
	GameState.upgrades = {"filter": 5, "spring": 4, "tap": 3}
	var order := ["flowers", "flowers", "grass", "shrub", "tree_small", "fern", "big_rock", "flowers", "aquatic",
		"tree_big", "shrub", "grass", "flowers", "fern", "small_rock", "tree_small", "aquatic", "shrub",
		"flowers", "tree_big", "bench", "feeder", "grass", "fern", "flowers", "bridge", "tree_small", "shrub"]
	for id in order:
		main.world.buy(id)
	GameState.recompute(false)
	main.world.trail_amount = 1.0


## Fill fireflies and leaves immediately (for screenshots).
func _prewarm() -> void:
	await get_tree().create_timer(0.3).timeout
	var w: World = main.world
	for i in w.fireflies.target_count():
		w.fireflies._spawn()
		w.fireflies.flies[-1]["life"] = 5.0
	if Clock.season() == 2:
		for i in 18:
			w.leaf_system._spawn()
			var L: Dictionary = w.leaf_system.leaves[-1]
			var n: Node2D = L["node"]
			if i < 10:
				n.position = w.random_water_point(220.0)
				L["state"] = "float"
			else:
				n.position.y = randf_range(40, 200)


## Photo mode at a zoom level, centred on a world point "z,x,y".
func _photo(arg: String) -> void:
	await get_tree().create_timer(0.5).timeout
	var p := arg.split(",")
	main.enter_photo_mode()
	main.zoom = float(p[0])
	main.pan = Vector2(float(p[1]), float(p[2])) - Vector2(400, 180)
	main._apply_view()
	main.photo._update_label()


## Screenshots: hide the start-up discovery toasts and the tutorial hint.
func _clean() -> void:
	await get_tree().process_frame
	main.hud.toast_box.visible = false
	main.hud.hint_panel.modulate.a = 0.0


func _perf() -> void:
	await get_tree().create_timer(6.0).timeout
	var t0 := Time.get_ticks_usec()
	var frames := 0
	var proc := 0.0
	while Time.get_ticks_usec() - t0 < 4000000:
		await get_tree().process_frame
		frames += 1
		proc += Performance.get_monitor(Performance.TIME_PROCESS)
	# per-system cost of _process (ms per call), measured by toggling processing
	var report := []
	for path in ["Systems/WildlifeDirector", "Systems/VisitorDirector", "Systems/Atmosphere", "Systems/NestSystem",
			"Systems/NatureEvents", "HUD"]:
		var n: Node = main.get_node_or_null(path)
		if n == null:
			continue
		var t1 := Time.get_ticks_usec()
		for k in 50:
			n._process(0.016)
		report.append("%s=%.3f" % [path.get_file(), (Time.get_ticks_usec() - t1) / 50000.0])
	for sysname in ["fireflies", "leaf_system", "weather_fx"]:
		var n2: Node = main.world.get(sysname)
		var t2 := Time.get_ticks_usec()
		for k in 50:
			n2._process(0.016)
		report.append("%s=%.3f" % [sysname, (Time.get_ticks_usec() - t2) / 50000.0])
	var t3 := Time.get_ticks_usec()
	for k in 50:
		main.world._process(0.016)
	report.append("world=%.3f" % ((Time.get_ticks_usec() - t3) / 50000.0))
	for al in ["GameState", "Clock", "Weather", "AudioManager", "SaveSystem"]:
		var an: Node = get_node("/root/" + al)
		var t4 := Time.get_ticks_usec()
		for k in 50:
			an._process(0.016)
		report.append("%s=%.3f" % [al, (Time.get_ticks_usec() - t4) / 50000.0])
	print("PERFSYS ", " ".join(report))
	print("PERF fps=%.1f process_ms=%.2f nodes=%d objects=%d draw_calls=%d creatures=%d" % [
		frames / 4.0, proc / frames * 1000.0, Performance.get_monitor(Performance.OBJECT_NODE_COUNT),
		Performance.get_monitor(Performance.OBJECT_COUNT),
		Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		get_tree().get_nodes_in_group("creatures").size()])


## Buys every element up to its limit, interleaved like a player would.
func _fillall() -> void:
	await get_tree().process_frame
	SaveSystem._loaded = false
	GameState.stage = 4
	GameState.water = 1e8
	GameState.seeds = 1e6
	GameState.upgrades = {"filter": 5, "spring": 4, "tap": 3}
	var ids := ["grass", "flowers", "small_rock", "big_rock", "fern", "shrub", "log", "aquatic", "tree_small", "tree_big",
		"bench", "feeder", "deck", "bridge"]
	for round in 16:
		for id in ids:
			main.world.buy(id)
	GameState.recompute(false)
	main.world.trail_amount = 1.0
	var counts := {}
	for id in ids:
		counts[id] = "%d/%d" % [GameState.item_count(id), GameState.item_limit(id)]
	print("FILLALL ", counts)


func _rainbow() -> void:
	await get_tree().process_frame
	Weather.wetness = 0.7
	main.world.weather_fx.show_rainbow(2.0)
	main.world.weather_fx.rainbow_amount = 1.0


func _print_layout() -> void:
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	var it: PlacedItem = main.world.items.values()[0]
	print("item ", it.id, " autumn=", it.mat.get_shader_parameter("season_autumn"), " k=", it.mat.get_shader_parameter("season_k"), " shader=", it.mat.shader.resource_path)
	print("season globals ", RenderingServer.global_shader_parameter_get("season_autumn"), " ", Clock.foliage_state(), " ", Clock.date_string())
	print("main ", main.size, " vp ", main.get_viewport_rect().size, " hud ", main.hud.size,
		" overlay ", main.hud.overlay.size, " buttons ", main.hud.buttons.position)


func _open_ui(name: String) -> void:
	await get_tree().create_timer(2.2).timeout
	if main.hud and main.hud.has_method("open_panel"):
		main.hud.open_panel(name)


func seed_state(name: String) -> void:
	SaveSystem._loaded = false  # never overwrite the player's save from a demo
	var lvl: int = {"stage2": 2, "stage3": 3, "stage4": 4}.get(name, 1)
	GameState.water = 5000.0
	GameState.seeds = 400.0
	var layout := [
		["flowers", 236, 256], ["flowers", 300, 312], ["flowers", 610, 280], ["grass", 268, 290],
		["fern", 372, 318], ["shrub", 170, 292], ["big_rock", 340, 262], ["flowers", 650, 326],
	]
	if lvl >= 3:
		layout += [["aquatic", 470, 300], ["aquatic", 480, 336], ["tree_small", 604, 236],
			["tree_small", 262, 226], ["shrub", 664, 304], ["fern", 566, 330], ["tree_big", 176, 250],
			["shrub", 552, 252], ["flowers", 214, 318], ["grass", 590, 300], ["flowers", 196, 272]]
	if lvl >= 4:
		layout += [["bench", 236, 300], ["feeder", 154, 318], ["tree_big", 650, 268]]
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
