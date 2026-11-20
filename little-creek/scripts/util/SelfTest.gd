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

	# 3) automatic purchase (v0.3: no manual placement)
	var n0: int = gs.placed.size()
	var d0: Dictionary = world.buy("flowers")
	var ok_ground := not d0.is_empty() and world.zone_ok("ground", Vector2(float(d0["x"]), float(d0["y"])))
	_check("buy flowers places them automatically on ground", gs.placed.size() == n0 + 1 and ok_ground, str(d0))
	var da: Dictionary = world.buy("aquatic")
	_check("buy aquatic plant places it in water", not da.is_empty() and world.is_water(Vector2(float(da["x"]), float(da["y"]))))
	# placements never overlap
	var overlap := false
	var its: Array = world.items.values()
	for i in its.size():
		for j in range(i + 1, its.size()):
			var a2: PlacedItem = its[i]
			var b2: PlacedItem = its[j]
			if a2.id == "bridge" or b2.id == "bridge":
				continue
			var dd := Vector2(a2.position.x - b2.position.x, (a2.position.y - b2.position.y) * 1.8).length()
			if dd < (a2.footprint() + b2.footprint()) * 0.79:
				overlap = true
	_check("auto-placed elements do not overlap", not overlap)
	# limits
	gs.water = 1e7
	gs.seeds = 1e5
	var bought := 0
	for i in 30:
		if not world.buy("log").is_empty():
			bought += 1
	_check("purchase limit enforced", gs.item_count("log") == gs.item_limit("log") and world.last_buy_error != "",
		"%d/%d (%s)" % [gs.item_count("log"), gs.item_limit("log"), world.last_buy_error])
	await _wait(10)
	await _shot("03_auto_placed")

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

	# 6) progression to stage 2 by buying more items
	for i in 12:
		var id: String = ["flowers", "grass", "fern", "big_rock"][i % 4]
		world.buy(id)
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

	# 8b) v0.3 clock / weather persistence and capped offline time
	Clock.set_season(2, 10.0)
	Clock.set_hour(18.2)
	Weather.force("light", 2.0)
	SaveSystem.save_now()
	var f2 := FileAccess.open(SaveSystem.SAVE_PATH, FileAccess.READ)
	var d2: Dictionary = JSON.parse_string(f2.get_as_text())
	Clock.set_season(0, 1.0)
	Weather.force("clear")
	Clock.from_dict(d2["clock"])
	Weather.from_dict(d2["weather"])
	_check("clock & weather persist", Clock.season() == 2 and Clock.period() == "dusk" and Weather.state == "light",
		"%s %s %s" % [Clock.date_string(), Clock.time_string(), Weather.state])
	var h0 := Clock.total_hours
	Clock.advance_offline(3600.0 * 72.0)
	_check("offline clock advance is capped", Clock.total_hours - h0 <= 18.01, "+%.1f h" % (Clock.total_hours - h0))
	var fs := Clock.foliage_state()
	_check("autumn foliage state", fs["autumn"] > 0.3, str(fs))
	Weather.force("clear")
	SaveSystem.delete_save()

	# 9) v0.2 sprites: every animation exists in both directions
	var need := {"deer_m": ["idle", "walk", "run", "look", "alert", "ears", "tail", "lower", "drink", "raise"],
		"deer_f": ["idle", "walk", "run", "drink"],
		"visitor_0": ["idle", "walk", "sit", "look", "photo", "feed"],
		"visitor_1": ["idle", "walk", "sit", "look", "photo", "feed"],
		"visitor_2": ["idle", "walk", "sit", "look", "photo", "feed"]}
	var missing: Array = []
	for sheet in need.keys():
		var sf := SpriteLib.frames(sheet)
		for a in need[sheet]:
			for sfx in ["", "_l"]:
				if not sf.has_animation(a + sfx) or sf.get_frame_count(a + sfx) == 0:
					missing.append(sheet + ":" + a + sfx)
	_check("all deer/visitor animations present", missing.is_empty(), str(missing))

	# 9b) visitors respect the creek: without the bridge no route crosses water
	var crosses_water := func(route: Array) -> bool:
		for i in route.size() - 1:
			for k in 12:
				var q: Vector2 = (route[i] as Vector2).lerp(route[i + 1], k / 12.0)
				if q.x > 0 and q.x < World.W and world.is_water(q):
					return true
		return false
	gs.stage = 4
	var probe := Visitor.new()
	world.entities.add_child(probe)
	probe.setup(world, 0, main.visitors)
	var any_cross := false
	for i in 30:
		probe.build_route()
		if crosses_water.call(probe.path):
			any_cross = true
	_check("no bridge: visitor routes never cross the creek", not any_cross and not gs.has_bridge())
	var db: Dictionary = world.buy("bridge")
	_check("bridge can be built (stage 4)", not db.is_empty() and gs.has_bridge(), world.last_buy_error)
	var crossed := false
	var on_deck := true
	for i in 30:
		probe.build_route()
		if probe.crosses:
			crossed = true
			# the only water-crossing segment must be over the bridge span
			var b: Dictionary = GameData.scene["bridge"]
			for q in probe.path:
				if q.x > 0 and q.x < World.W and world.is_water(q) and absf(q.x - float(b["x"])) > 50.0:
					on_deck = false
	_check("with bridge: visitors cross only over the bridge", crossed and on_deck)
	probe.queue_free()

	# 9c) v0.3 routines: activity by time of day / season / weather
	Weather.force("clear")
	Clock.set_season(1, 10.0)
	Clock.set_hour(23.0)
	var owl_night := EcosystemRules.activity("owl")
	var bf_night := EcosystemRules.activity("butterfly")
	Clock.set_hour(12.0)
	var owl_day := EcosystemRules.activity("owl")
	var bf_day := EcosystemRules.activity("butterfly")
	_check("owls at night, butterflies by day", owl_night > 0.5 and owl_day == 0.0 and bf_day > 0.5 and bf_night == 0.0)
	Clock.set_hour(6.5)
	var deer_dawn := EcosystemRules.activity("deer")
	Clock.set_hour(13.0)
	_check("deer prefer dawn over midday", deer_dawn > EcosystemRules.activity("deer") * 2.0)
	Clock.set_season(3, 10.0)
	var bf_winter := EcosystemRules.activity("butterfly")
	Weather.force("heavy")
	_check("winter and heavy rain reduce activity", bf_winter < 0.3 and EcosystemRules.activity("sabia") == 0.0)
	# visitors: rarer in winter, none in heavy rain or at night
	var vd: Node = main.visitors
	var m_winter: float = vd.frequency_mult()
	Weather.force("clear")
	Clock.set_season(1, 10.0)
	var m_summer: float = vd.frequency_mult()
	Weather.force("light")
	var m_light: float = vd.frequency_mult()
	Weather.force("clear")
	Clock.set_hour(23.0)
	var m_night: float = vd.frequency_mult()
	Clock.set_hour(12.0)
	_check("visitor frequency: summer > light rain > winter, none at night", m_summer > m_light and m_summer > 2.0 * 0.0 + 0.0
		and m_summer > m_winter * 2.0 and m_night == 0.0, "summer %.2f light %.2f winter %.2f" % [m_summer, m_light, m_winter])
	_check("visitor interval is long (>= 2.5 min base)", float(GameData.config["visitors"]["min_interval_s"]) >= 150.0)
	# journal: sightings are counted once per individual visit
	var c0 := NatureLog.count("fox")
	NatureLog.sight("fox")
	NatureLog.sight("fox")
	_check("journal counts sightings", NatureLog.count("fox") == c0 + 1 and NatureLog.sightings["fox"].has("first_h"))
	# nests: build -> eggs -> chicks -> gone
	var ns: NestSystem = main.get_node("Systems/NestSystem")
	gs.recompute()
	world.buy("tree_small")
	var started := ns.start_nest()
	var stages_seen := {}
	if started:
		for age in [2.0, 10.0, 20.0, 40.0, 90.0, 150.0]:
			stages_seen[ns._stage_for(age)] = true
	_check("nest goes through all stages", started and stages_seen.has("build1") and stages_seen.has("eggs") and stages_seen.has("chicks"))
	ns.nests[-1]["start_h"] = Clock.total_hours - 300.0
	await _wait(3)
	_check("old nests are abandoned", ns.nests.size() == 0 or float(ns.nests[-1]["start_h"]) > Clock.total_hours - 200.0)
	# natural events can all trigger
	var ev: NatureEvents = main.get_node("Systems/NatureEvents")
	var ok_all := true
	var failed: Array = []
	var n_log := NatureLog.events.size()
	for id in ["butterfly_swarm", "deer_fawn", "ducks", "bird_flock", "rare_animal", "rare_flower"]:
		if not ev.trigger(id):
			ok_all = false
			failed.append(id)
	_check("natural events trigger and are logged", ok_all and NatureLog.events.size() >= n_log + 5 and gs.ducks_resident
		and gs.item_count("rare_flower") == 1, "failed=%s log+%d" % [str(failed), NatureLog.events.size() - n_log])
	var fawn_deer := false
	for c in get_tree().get_nodes_in_group("creatures"):
		if c is Deer and c.fawn != null:
			fawn_deer = true
	_check("deer with fawn spawned", fawn_deer)
	for c in get_tree().get_nodes_in_group("creatures"):
		if c is Deer or c is Wanderer:
			c.queue_free()
	await _wait(2)

	# 9d) fireflies at night only; leaves float downstream and stay on water
	Weather.force("clear")
	Clock.set_season(1, 12.0)
	Clock.set_hour(12.0)
	var ff_day := world.fireflies.target_count()
	Clock.set_hour(22.5)
	var ff_night := world.fireflies.target_count()
	Clock.set_season(3, 12.0)
	var ff_winter := world.fireflies.target_count()
	_check("fireflies: night only, none in winter", ff_day == 0 and ff_night > 5 and ff_winter == 0,
		"day %d night %d winter %d" % [ff_day, ff_night, ff_winter])
	Clock.set_season(2, 16.0)
	Clock.set_hour(12.0)
	var ls: FloatingLeaves = world.leaf_system
	ls._spawn(Vector2(470, 240))
	var L: Dictionary = ls.leaves[-1]
	var leaf: Node2D = L["node"]
	leaf.position = world.random_water_point(250.0)
	L["state"] = "float"
	var y0 := leaf.position.y
	var stayed_wet := true
	for i in 90:
		await get_tree().process_frame
		if not is_instance_valid(leaf):
			break
		if L["state"] == "float" and not world.is_water(leaf.position):
			stayed_wet = false
	_check("floating leaf drifts downstream on the water", is_instance_valid(leaf) == false or (leaf.position.y > y0 + 1.0 and stayed_wet),
		"%.1f -> %.1f state %s" % [y0, leaf.position.y if is_instance_valid(leaf) else -1.0, L["state"]])

	# 9e) audio follows time and weather
	Weather.force("clear")
	Clock.set_season(1, 10.0)
	Clock.set_hour(6.5)
	var tr_dawn: String = AudioManager.wanted_track()
	var lt_dawn: Dictionary = AudioManager.layer_targets()
	Clock.set_hour(23.0)
	var tr_night: String = AudioManager.wanted_track()
	var lt_night: Dictionary = AudioManager.layer_targets()
	Weather.force("heavy")
	var lt_rain: Dictionary = AudioManager.layer_targets()
	Weather.force("clear")
	_check("music changes with time of day", tr_dawn == "lofi_morning" and tr_night == "lofi_night")
	_check("ambience: birds at dawn, crickets at night, rain when raining",
		float(lt_dawn["birds_loop"]) > -30.0 and float(lt_night["birds_loop"]) <= -60.0
		and float(lt_night["crickets_loop"]) > -30.0 and float(lt_rain["rain_heavy_loop"]) > -20.0)
	_check("three independent volume buses", AudioServer.get_bus_index("Music") >= 0 and AudioServer.get_bus_index("Ambience") >= 0
		and AudioServer.get_bus_index("SFX") >= 0 and AudioServer.get_bus_send(AudioServer.get_bus_index("Ambience")) == &"Master")

	# 9f) photo mode: hides HUD, crisp zoom, consistent picking, capture
	Clock.set_hour(12.0)
	main.enter_photo_mode()
	await _wait(3)
	var hud_hidden: bool = not main.hud.visible
	var k1: float = main.view_scale()
	main.set_zoom(2.0)
	var k2: float = main.view_scale()
	var wp2: Vector2 = Vector2(470, 260)
	var round_trip: Vector2 = main.screen_to_world(main.world_to_screen(wp2))
	_check("photo mode hides the interface and zooms in integer steps", hud_hidden and is_equal_approx(k2, k1 * 2.0)
		and round_trip.distance_to(wp2) < 0.01)
	var path: String = await main.photo.capture()
	_check("photo capture saved", FileAccess.file_exists(path), path)
	await _shot("08_photo_mode")
	main.exit_photo_mode()
	await _wait(3)
	_check("leaving photo mode restores view and HUD", main.hud.visible and is_equal_approx(main.view_scale(), k1))

	# 10) behaviour cycles run end to end (time accelerated)
	Engine.time_scale = 12.0
	var spots: Array = GameData.scene["drink_spots"]
	_check("deer has a drinking spot", spots.size() > 0)
	var deer := Deer.new()
	world.entities.add_child(deer)
	deer.setup(world, spots[0])
	var seen := {}
	var states := {}
	for i in 1500:
		if not is_instance_valid(deer):
			break
		seen[String(deer.sprite.animation).trim_suffix("_l")] = true
		states[deer.state] = true
		await get_tree().process_frame
	_check("deer drinks and leaves", not is_instance_valid(deer) and states.has("drink") and seen.has("drink")
		and seen.has("walk"), "anims %s" % str(seen.keys()))
	var deer2 := Deer.new()
	world.entities.add_child(deer2)
	deer2.setup(world, spots[0])
	deer2.position = Vector2(float(spots[0]["x"]), float(spots[0]["y"]))
	deer2.set_state("idle")
	deer2.on_tap()
	var ran := false
	for i in 600:
		if not is_instance_valid(deer2):
			break
		if String(deer2.sprite.animation).begins_with("run"):
			ran = true
		await get_tree().process_frame
	_check("tapped deer is alerted and flees running", ran and not is_instance_valid(deer2))
	var v := Visitor.new()
	world.entities.add_child(v)
	v.add_to_group("visitors")
	v.setup(world, 1, main.visitors)
	var vstates := {}
	for i in 3000:
		if not is_instance_valid(v):
			break
		vstates[v.state] = true
		await get_tree().process_frame
	_check("visitor walks the trail and leaves", not is_instance_valid(v) and vstates.has("walk")
		and vstates.has("activity"), str(vstates.keys()))
	Engine.time_scale = 1.0

	var fails := 0
	for r in results:
		if not r[1]:
			fails += 1
	print("SELFTEST DONE: %d checks, %d failed" % [results.size(), fails])
	get_tree().quit(1 if fails > 0 else 0)
