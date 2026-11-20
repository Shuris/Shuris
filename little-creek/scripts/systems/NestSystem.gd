class_name NestSystem
extends Node
## Birds build nests in planted trees. Timeline in game hours:
##   0-8 twigs, 8-16 half nest, 16-30 finished, 30-70 eggs, 70-130 chicks
##   (adults fly in to feed them), 130-200 empty nest, then it disappears.
## Persisted via SaveSystem.register("nests").

const STAGES := [[0.0, "build1"], [8.0, "build2"], [16.0, "nest"], [30.0, "eggs"], [70.0, "chicks"], [130.0, "nest"]]
const END_H := 200.0
const MAX_NESTS := 2

var world: World
var wildlife: Node
var nests: Array = []          # [{tree_uid, start_h, announced}]
var sprites: Dictionary = {}   # tree_uid -> AnimatedSprite2D
var _feed_t := 0.0


func _ready() -> void:
	SaveSystem.register("nests", self)


func can_start() -> bool:
	return nests.size() < MAX_NESTS and GameState.eligible_animals.has("sabia") and not _free_trees().is_empty()


func _free_trees() -> Array:
	var used := {}
	for n in nests:
		used[int(n["tree_uid"])] = true
	var out: Array = []
	for it in world.items.values():
		if it.id in ["tree_small", "tree_big"] and not used.has(it.uid):
			out.append(it)
	return out


func start_nest() -> bool:
	var trees := _free_trees()
	if trees.is_empty():
		return false
	var t: PlacedItem = trees[randi() % trees.size()]
	nests.append({"tree_uid": t.uid, "start_h": Clock.total_hours, "announced": 0})
	NatureLog.record_event("nest_start", "Um sabiá começou a construir um ninho.", false)
	return true


func _stage_for(age: float) -> String:
	var st := "build1"
	for s in STAGES:
		if age >= float(s[0]):
			st = s[1]
	return st


func _nest_pos(it: PlacedItem) -> Vector2:
	var pp: Variant = it.perch_point()
	var base: Vector2 = pp if pp != null else it.position + Vector2(0, -60)
	# a fork near the lit edge of the crown, where it reads against the sky
	return base + Vector2(30 if it.id == "tree_big" else 16, 40 if it.id == "tree_big" else 26)


func _process(delta: float) -> void:
	if world == null:
		return
	var now := Clock.total_hours
	for i in range(nests.size() - 1, -1, -1):
		var n: Dictionary = nests[i]
		var uid := int(n["tree_uid"])
		var age := now - float(n["start_h"])
		if not world.items.has(uid) or age > END_H:
			nests.remove_at(i)
			if sprites.has(uid):
				sprites[uid].queue_free()
				sprites.erase(uid)
			continue
		var st := _stage_for(age)
		if not sprites.has(uid):
			var s := AnimatedSprite2D.new()
			s.sprite_frames = SpriteLib.frames("nest")
			s.centered = false
			s.offset = Vector2(-7, -9)
			world.flyers.add_child(s)
			sprites[uid] = s
		var spr: AnimatedSprite2D = sprites[uid]
		spr.position = _nest_pos(world.items[uid])
		if spr.animation != st:
			spr.play(st)
		# notable moments (once each)
		var ann := int(n["announced"])
		if st == "nest" and age < 130.0 and ann < 1:
			n["announced"] = 1
			NatureLog.record_event("nest", "Um novo ninho foi encontrado entre as árvores.", true)
		elif st == "chicks" and ann < 2:
			n["announced"] = 2
			NatureLog.record_event("chicks", "Filhotes nasceram em um ninho!", true)
		# adults feeding the chicks
		if st == "chicks" and not Clock.is_night():
			_feed_t -= delta
			if _feed_t <= 0.0:
				_feed_t = randf_range(25.0, 50.0)
				if wildlife and wildlife.has_method("bird_to_point"):
					wildlife.bird_to_point(spr.position + Vector2(0, -3))


func to_dict() -> Dictionary:
	return {"nests": nests}


func from_dict(d: Dictionary) -> void:
	nests = d.get("nests", [])
