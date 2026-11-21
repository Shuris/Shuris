class_name SeasonDecor
extends Node
## Season-dependent decorations tied to the scene's elements:
##  - canopy shadows under trees (strongest on bright summer days, sparse in
##    winter when trees are bare, gone in rain, snow and at night)
##  - leaf piles at the foot of trees in late autumn, buried later by snow
## Both layers are rebuilt when elements are bought or the scene reloads.

var world: World
var shadow_layer: Node2D
var pile_layer: Node2D
var _dirty := true


func setup(w: World, shadows: Node2D, piles: Node2D) -> void:
	world = w
	shadow_layer = shadows
	pile_layer = piles
	GameState.item_placed.connect(func(_d: Dictionary) -> void: _dirty = true)
	GameState.item_removed.connect(func(_u: int) -> void: _dirty = true)


func rebuild() -> void:
	_dirty = false
	for c in shadow_layer.get_children():
		c.queue_free()
	for c in pile_layer.get_children():
		c.queue_free()
	var trees: Array = []
	for it in world.items.values():
		if it.id in ["tree_small", "tree_big"]:
			trees.append({"pos": it.position, "crown": 25.0 if it.id == "tree_small" else 48.0, "seed": it.uid})
	for t in GameData.scene.get("frame_trees", []):
		trees.append({"pos": Vector2(float(t["x"]), float(t["base_y"])), "crown": 40.0, "seed": int(t["x"])})
	for t in trees:
		var p: Vector2 = t["pos"]
		var cr: float = t["crown"]
		# canopy shadow: offset away from the sun (light comes from the right)
		var sh := Sprite2D.new()
		sh.texture = SpriteLib.shadow_tex(int(cr * 1.7), int(cr * 0.5))
		sh.position = (p + Vector2(-cr * 0.35, -cr * 0.08)).round()
		shadow_layer.add_child(sh)
		# 1-3 leaf piles around the trunk, never on roads or water
		var rng := RandomNumberGenerator.new()
		rng.seed = int(t["seed"]) * 7919
		for k in rng.randi_range(1, 3):
			var q := (p + Vector2(rng.randf_range(-cr * 0.8, cr * 0.8), rng.randf_range(-3, 6))).round()
			if not world.walkable(q) or world.zones.get_pixel(int(q.x), int(q.y)).r < 0.5:
				continue
			var pile := Sprite2D.new()
			pile.texture = SpriteLib.tex("res://assets/sprites/vegetation/leaf_pile_%d.png" % (k % 3))
			pile.centered = false
			pile.offset = Vector2(-9, -7)
			pile.position = q
			pile_layer.add_child(pile)


func _process(_d: float) -> void:
	if world == null or not world._initialized:
		return
	if _dirty:
		rebuild()
	var L := Clock.lighting()
	var fs := Clock.foliage_state()
	var leafy := 1.0 - float(fs["bare"]) * 0.75
	var sun := float(L["rays"]) * (1.0 - Weather.rain) * (1.0 - Weather.snow)
	var summer := 1.15 if Clock.season() == 1 else 1.0
	shadow_layer.modulate.a = clampf(sun * leafy * 0.85 * summer, 0.0, 1.0)
	# piles: build up as leaves fall (late autumn), linger into early winter
	var piles := clampf(float(fs["bare"]) * 1.6, 0.0, 1.0) if Clock.season() in [2, 3] else 0.0
	pile_layer.modulate.a = piles
	pile_layer.visible = piles > 0.02
