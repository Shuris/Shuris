extends Node2D
func _ready():
	var g := Gladiator.new()
	g.position = Vector2(80, 100)
	add_child(g)
	g.set_visual({"skin": 1, "hairStyle": 3, "hairColor": 2, "beard": true, "clothColor": 0}, {"mainHand": Data.item("rudis")})
	print("layers ", g.layers.size(), " children ", g.get_child_count())
	for l in g.layers:
		print(l.texture, " ", l.hframes, " ", l.frame, " ", l.modulate)
	await get_tree().create_timer(0.3).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
	get_tree().quit()
