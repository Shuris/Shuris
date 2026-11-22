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
	# events are injected in window pixels; the UI works in viewport units
	e.position = get_viewport().get_final_transform() * screen
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
			for pi in probe.path.size() - 1:
				for k in 10:
					var q: Vector2 = (probe.path[pi] as Vector2).lerp(probe.path[pi + 1], k / 10.0)
					if q.x > 0 and q.x < World.W and world.is_water(q) and (q.x < float(b["x0"]) or q.x > float(b["x1"])
							or absf(q.y - float(b["y"])) > float(b["half_depth"]) + float(b["arch"])):
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
		if L["state"] == "float" and leaf.position.y < World.H - 1 and not world.is_water(leaf.position):
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

	# 11) v0.4 distribution: many consecutive purchases (all items to their limits)
	for c in get_tree().get_nodes_in_group("creatures"):
		c.queue_free()
	gs.reset_state()
	world.rebuild_items()
	await _wait(2)
	gs.stage = 4
	gs.water = 1e9
	gs.seeds = 1e7
	var ids := ["grass", "flowers", "small_rock", "big_rock", "fern", "shrub", "log", "aquatic", "tree_small",
		"tree_big", "bench", "feeder", "deck", "bridge"]
	for round in 16:
		for id in ids:
			world.buy(id)
	var at_limit := true
	for id in ids:
		if gs.item_count(id) < gs.item_limit(id):
			at_limit = false
			print("  not at limit: ", id, " ", gs.item_count(id), "/", gs.item_limit(id), " ", world.last_buy_error)
	_check("all elements bought up to their limits", at_limit)
	var on_road: Array = []
	for it in world.items.values():
		if it.id != "bridge" and not world.footprint_clear(it.id, it.position):
			on_road.append("%s@%s" % [it.id, it.position])
	_check("no element (whole footprint) on roads or the bridge", on_road.is_empty(), str(on_road))
	var ov := false
	var its2: Array = world.items.values()
	for i in its2.size():
		for j in range(i + 1, its2.size()):
			var a3: PlacedItem = its2[i]
			var b3: PlacedItem = its2[j]
			if a3.id == "bridge" or b3.id == "bridge":
				continue
			if Vector2(a3.position.x - b3.position.x, (a3.position.y - b3.position.y) * 1.8).length() < (a3.footprint() + b3.footprint()) * 0.79:
				ov = true
				print("  overlap: ", a3.id, a3.position, " ", b3.id, b3.position)
	_check("no overlapping elements after many purchases", not ov)
	var cells := func(id: String) -> Dictionary:
		var d := {}
		for it in world.items_of(id):
			var c3 := AutoPlacer._cell(it.position)
			d[c3] = int(d.get(c3, 0)) + 1
		return d
	var fc: Dictionary = cells.call("flowers")
	var gc: Dictionary = cells.call("grass")
	var sc: Dictionary = cells.call("shrub")
	_check("flowers spread over many regions in small drifts", fc.size() >= 4 and fc.values().max() <= 4, str(fc))
	_check("grass covers the terrain widely", gc.size() >= 7 and gc.values().max() <= 3, str(gc))
	_check("shrubs in several groups", sc.size() >= 3, str(sc))
	var trees2: Array = world.items_of("tree_small") + world.items_of("tree_big")
	var tmin := 9999.0
	for i in trees2.size():
		for j in range(i + 1, trees2.size()):
			tmin = minf(tmin, AutoPlacer._dist(trees2[i].position, trees2[j].position))
	_check("trees keep their spacing", tmin >= 54.0, "min %.0f" % tmin)
	await _wait(10)
	await _shot("09_distribution")
	# persistence of the exact positions
	SaveSystem._loaded = true
	SaveSystem.save_now()
	var before := {}
	for d in gs.placed:
		before[int(d["uid"])] = Vector2(float(d["x"]), float(d["y"]))
	var fsv := FileAccess.open(SaveSystem.SAVE_PATH, FileAccess.READ)
	var dsv: Dictionary = JSON.parse_string(fsv.get_as_text())
	gs.reset_state()
	gs.from_dict(dsv["state"])
	world.rebuild_items()
	var same_pos := gs.placed.size() == before.size()
	for d in gs.placed:
		if not before.has(int(d["uid"])) or before[int(d["uid"])].distance_to(Vector2(float(d["x"]), float(d["y"]))) > 0.01:
			same_pos = false
	for it in world.items.values():
		if it.id != "bridge" and before.has(it.uid) and it.position.distance_to(before[it.uid].round()) > 0.6:
			same_pos = false
	_check("positions identical after save + load", same_pos)
	SaveSystem.delete_save()

	# 12) bridge joins both roads exactly
	var bd: Dictionary = GameData.scene["bridge"]
	var spur_end := Vector2(float(GameData.scene["trail_spur"][-1]["x"]), float(GameData.scene["trail_spur"][-1]["y"]))
	var east_start := Vector2(float(GameData.scene["trail_east"][0]["x"]), float(GameData.scene["trail_east"][0]["y"]))
	var p0 := Vector2(float(bd["path"][0]["x"]), float(bd["path"][0]["y"]))
	var p1 := Vector2(float(bd["path"][-1]["x"]), float(bd["path"][-1]["y"]))
	_check("bridge ends coincide with both trail ends", p0.distance_to(spur_end) < 0.01 and p1.distance_to(east_start) < 0.01)
	var road_vhalf := (8.0 + 16.0 * clampf((float(bd["y"]) - 164.0) / 190.0, 0.15, 1.0)) / 2.2
	_check("bridge width matches the road", absf(float(bd["half_depth"]) - road_vhalf) < 1.0)
	var bimg := (load("res://assets/sprites/environment/bridge_0.png") as Texture2D).get_image()
	var timg := (load("res://assets/sprites/environment/trail_bridge.png") as Texture2D).get_image()
	var gap := false
	for side in [[int(bd["x0"]), -1], [int(bd["x1"]), 1]]:
		for dy in range(-3, 4):
			var yy := int(bd["y"]) + dy
			var deck := bimg.get_pixel(side[0], yy).a > 0.5
			var road := timg.get_pixel(side[0] + side[1] * 3, yy).a > 0.5
			if not (deck and road):
				gap = true
	_check("no gap between deck and roads", not gap)

	# 13) rabbits: routines, behaviour, journal
	Weather.force("clear")
	Clock.set_season(0, 14.0)
	Clock.set_hour(6.5)
	var ra_dawn := EcosystemRules.activity("rabbit")
	Clock.set_hour(13.0)
	var ra_day := EcosystemRules.activity("rabbit")
	Clock.set_season(3, 14.0)
	var ra_winter := EcosystemRules.activity("rabbit")
	Weather.force("heavy")
	var ra_rain := EcosystemRules.activity("rabbit")
	Weather.force("clear")
	Clock.set_season(0, 14.0)
	Clock.set_hour(17.8)
	gs.recompute()
	_check("rabbits: dawn/dusk > midday, fewer in winter, none in heavy rain",
		ra_dawn > ra_day * 2.0 and ra_winter < ra_dawn and ra_rain == 0.0 and gs.eligible_animals.has("rabbit"))
	for v in get_tree().get_nodes_in_group("visitors"):
		v.queue_free()
	await _wait(2)
	Engine.time_scale = 8.0
	var rab: Rabbit = main.wildlife.spawn_rabbit(2)
	var rstates := {}
	var bad_spot := false
	for i in 2200:
		if not is_instance_valid(rab):
			break
		rstates[rab.state] = true
		if rab.state in ["look", "forage", "rest"] and not world.walkable(rab.position):
			bad_spot = true
		await get_tree().process_frame
	var still := is_instance_valid(rab)
	_check("rabbit hops, looks around, eats/rests/hides", rstates.has("move") and rstates.has("look")
		and (rstates.has("forage") or rstates.has("rest") or rstates.has("hide")), str(rstates.keys()))
	_check("rabbit never stops on roads or water", not bad_spot)
	if still:
		rab.queue_free()
	var rab2: Rabbit = main.wildlife.spawn_rabbit(0)
	for i in 30:
		await get_tree().process_frame
	rab2.on_tap()
	var fled := false
	for i in 400:
		if not is_instance_valid(rab2):
			fled = true
			break
		if rab2._flee or rab2.state in ["hide", "exit"]:
			fled = true
		await get_tree().process_frame
	_check("rabbit flees when startled", fled)
	if is_instance_valid(rab2):
		rab2.queue_free()
	Engine.time_scale = 1.0
	var nr := NatureLog.count("rabbit")
	NatureLog.sight("rabbit")
	_check("rabbit is in the biodiversity journal", "rabbit" in JournalPanel.ANIMALS and GameData.species.has("rabbit")
		and NatureLog.count("rabbit") >= nr and NatureLog.sightings.has("rabbit"))

	# 14) v0.5 seasons: winter trees, snow, ice, footprints, settings
	Weather.force("clear")
	Clock.set_season(3, 15.0)
	var fsw := Clock.foliage_state()
	_check("winter: deciduous trees fully bare", float(fsw["bare"]) >= 0.95)
	Clock.set_season(0, 2.0)
	var fs_sp0 := Clock.foliage_state()
	Clock.set_season(0, 18.0)
	var fs_sp1 := Clock.foliage_state()
	_check("spring: leaves come back gradually", float(fs_sp0["bare"]) > 0.8 and float(fs_sp1["bare"]) < 0.05)
	Clock.set_season(2, 28.0)
	var fs_au := Clock.foliage_state()
	_check("late autumn: trees partly bare, colours turned", float(fs_au["bare"]) > 0.4 and float(fs_au["autumn"]) > 0.9)
	var deciduous := 0
	var ever := 0
	for it in world.items.values():
		if it.id in ["tree_small", "tree_big"]:
			if it.mat.get_shader_parameter("evergreen"):
				ever += 1
			elif it.mat.get_shader_parameter("has_bare") and it.mat.get_shader_parameter("bare_tex") != null:
				deciduous += 1
	_check("trees have bare-branch twins (evergreens excepted)", deciduous > 0, "deciduous %d evergreen %d" % [deciduous, ever])
	# snow builds up gradually and melts in spring
	Clock.set_season(3, 10.0)
	Weather.snow_cover = 0.0
	Weather.force("snow", 10.0)
	for i in 4:
		Weather._update_snow_cover(1.0)
	var after4 := Weather.snow_cover
	Weather.force("blizzard", 5.0)
	for i in 4:
		Weather._update_snow_cover(1.0)
	var after8 := Weather.snow_cover
	_check("snow accumulates gradually (not instantly)", after4 > 0.4 and after4 < 0.9 and after8 >= after4, "4h %.2f, 8h %.2f" % [after4, after8])
	Weather.force("clear")
	Clock.set_season(0, 3.0)
	var sc0 := Weather.snow_cover
	for i in 5:
		Weather._update_snow_cover(1.0)
	_check("snow melts gradually in spring", Weather.snow_cover < sc0 and Weather.snow_cover > 0.0, "%.2f -> %.2f" % [sc0, Weather.snow_cover])
	for i in 20:
		Weather._update_snow_cover(1.0)
	_check("snow eventually melts away", Weather.snow_cover == 0.0)
	# winter precipitation is snow, with three intensities
	Clock.set_season(3, 12.0)
	var kinds := {}
	for i in 300:
		Weather.cooldown_hours = 0.0
		Weather.state = "clear"
		Weather._roll()
		kinds[Weather.state] = true
	Weather.force("clear")
	_check("winter weather: light snow, snow and blizzard (no rain)", kinds.has("snow_light") and kinds.has("snow")
		and kinds.has("blizzard") and not kinds.has("light") and not kinds.has("heavy"), str(kinds.keys()))
	# ice on the creek in winter, never in summer
	Weather.snow_cover = 0.9
	Clock.set_hour(7.0)
	await _wait(4)
	var ice_w: float = world.water_mat.get_shader_parameter("ice")
	Clock.set_season(1, 10.0)
	Weather.snow_cover = 0.0
	await _wait(4)
	var ice_s: float = world.water_mat.get_shader_parameter("ice")
	_check("winter shelf ice on the creek, none in summer", ice_w > 0.5 and ice_s < 0.01, "%.2f / %.2f" % [ice_w, ice_s])
	# footprints: a rabbit hopping on snow leaves tracks; new snow buries them
	Clock.set_season(3, 12.0)
	Clock.set_hour(17.8)
	Weather.snow_cover = 0.9
	world.footprints.clear()
	Engine.time_scale = 6.0
	var rb3: Rabbit = main.wildlife.spawn_rabbit(1)
	for i in 500:
		await get_tree().process_frame
		if world.footprints.prints.size() > 6:
			break
	var nprints := world.footprints.prints.size()
	var old_prints: Array = world.footprints.prints.duplicate()
	Engine.time_scale = 1.0
	if is_instance_valid(rb3):
		rb3.queue_free()
	_check("animals leave footprints on snow", nprints > 6, "%d prints" % nprints)
	Weather.force("blizzard", 2.0)
	for i in 120:
		await get_tree().process_frame
	GameState.time_scale = 60.0
	for i in 120:
		await get_tree().process_frame
	GameState.time_scale = 1.0
	var survived := 0
	for o in old_prints:
		for q in world.footprints.prints:
			if is_same(o, q):
				survived += 1
				break
	_check("new snowfall buries old tracks", survived == 0, "%d of %d old prints left, snow %.2f" % [survived, old_prints.size(), Weather.snow])
	Weather.force("clear")
	Weather.snow_cover = 0.0
	# graphics settings really change the scene
	var sq0 := Settings.quality
	var sp0 := Settings.particles
	Settings.quality = 0
	Settings.particles = 0.5
	Settings.apply_effects()
	var low_ok: bool = not world.rays_mat.get_meta("node").visible and world.weather_fx.particle_density < 0.3 \
		and world.fireflies.budget < 0.3
	Settings.quality = 2
	Settings.particles = 1.0
	Settings.apply_effects()
	var high_ok: bool = world.rays_mat.get_meta("node").visible and is_equal_approx(world.weather_fx.particle_density, 1.0)
	_check("effects quality / particle density settings take effect", low_ok and high_ok)
	Settings.quality = sq0
	Settings.particles = sp0
	Settings.apply_effects()
	Settings.store()
	_check("video settings are saved", SaveSystem.settings.has("quality") and SaveSystem.settings.has("particles")
		and SaveSystem.settings.has("fullscreen") and SaveSystem.settings.has("vsync"))
	_check("save stores snow cover", Weather.to_dict().has("snow_cover"))
	# pause menu (Esc) pauses the world and resumes
	main.open_menu(true)
	await _wait(3)
	var paused := get_tree().paused
	main.close_menu()
	await _wait(3)
	_check("Esc pause menu pauses and resumes the game", paused and not get_tree().paused)

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
