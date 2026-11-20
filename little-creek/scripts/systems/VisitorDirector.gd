extends Node
## Occasional, quiet human presence once the creek becomes a natural refuge
## (stage 4). Never more than two visitors at a time.

const MAX_VISITORS := 2
var world: World
var wildlife: Node
var _timer := 8.0


func _process(delta: float) -> void:
	if GameState.stage < 4:
		return
	_timer -= delta
	if _timer > 0.0:
		return
	_timer = randf_range(25.0, 55.0) / maxf(1.0, GameState.time_scale * 0.5)
	if get_tree().get_nodes_in_group("visitors").size() >= MAX_VISITORS:
		return
	var v := Visitor.new()
	world.entities.add_child(v)
	v.add_to_group("visitors")
	v.setup(world, randi() % 3, self)


func call_bird_to(feeder: Node2D) -> void:
	var wd := get_parent().get_node_or_null("WildlifeDirector")
	if wd:
		wd.call_bird_to(feeder)


## Visitors leave donations (water/seeds) and build reputation.
func reward(v: Node2D, kind: String, subject: String) -> void:
	var w := 0.0
	var rep := 0.0
	var txt := ""
	match kind:
		"photo":
			rep = 2.0
			w = GameState.water_rate * 6.0
			txt = "foto"
			if subject == "deer":
				rep = 6.0
				w *= 3.0
				txt = "foto do veado!"
			elif subject != "":
				rep = 3.0
				txt = "foto da vida selvagem"
		"bench":
			rep = 2.0
			w = GameState.water_rate * 4.0
			txt = "descanso"
		"feeder":
			rep = 2.0
			w = GameState.water_rate * 3.0
			txt = "alimentou os pássaros"
		"view":
			rep = 1.0
			w = GameState.water_rate * 3.0
			txt = "contemplou o riacho"
		"wave":
			rep = 0.5
			txt = "acenou"
	GameState.add_resources(w, 0.0, rep)
	world.floating_text.emit(v.position + Vector2(0, -44), "%s  +%s" % [txt, NumFmt.short(w)] if w > 0 else txt, Palette.GOLD)
