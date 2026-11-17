extends Node2D
func _ready():
	var p := PlayerFactory.new_player("Teste", "thracian", {"skin": 1, "hairStyle": 3, "hairColor": 2, "beard": true, "clothColor": 0}, 1700000000000)
	for d in range(2, 80):
		if float(Weather.now(int(p.createdAt), d).rain) > 0.5:
			p.day = d
			break
	p.location = "forum"
	p.minutes = 660
	Game.p = p
	var lv := LocationView.new()
	add_child(lv)
	lv.setup("forum", p.appearance, Data.gear_of(p))
	await get_tree().create_timer(0.8).timeout
	print("rain layer ", lv.life.rain_layer, " drops ", lv.life.drops.size())
	if lv.life.drops.size():
		var d = lv.life.drops[0]
		print(d.position, " vis ", d.is_visible_in_tree(), " z ", d.z_index, " gz ", lv.life.rain_layer.z_index)
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
	get_tree().quit()
