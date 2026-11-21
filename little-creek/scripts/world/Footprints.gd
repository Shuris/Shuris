class_name Footprints
extends Node2D
## Tracks in the snow. Polls walking creatures and drops prints along their
## path with a stride that matches the animal (rabbit hops, deer and fox
## steps, visitors' boots). Prints only appear on snow, fade with time and
## disappear quickly under new snowfall. Drawn in one _draw call (cheap).

const MAX_PRINTS := 420
const LIFE_HOURS := 30.0
## stride (px), pattern of (dx, dy, w, h) cells in facing direction
const KINDS := {
	"rabbit": {"stride": 8.0, "cells": [[0, 0, 1, 1], [0, 2, 1, 1], [-3, 0, 2, 1], [-3, 2, 2, 1]]},
	"deer": {"stride": 6.0, "cells": [[0, 0, 1, 1], [1, 0, 1, 1]]},
	"fox": {"stride": 4.0, "cells": [[0, 0, 1, 1]]},
	"human": {"stride": 5.0, "cells": [[0, 0, 2, 1]]},
}

var world: World
var prints: Array = []   # [x, y, kind, facing, side, age_h]
var _last: Dictionary = {}  # instance_id -> [Vector2 last print, side]
var _redraw_t := 0.0


func _kind(c: Node) -> String:
	if c is Rabbit:
		return "rabbit" if (c as Rabbit).state == "move" or (c as Rabbit).state == "exit" else ""
	if c is Deer:
		return "deer" if (c as Deer).base_anim in ["walk", "run"] else ""
	if c is Wanderer:
		return "fox" if (c as Wanderer).state == "walk" else ""
	if c is Visitor:
		return "human" if (c as Visitor).state in ["walk", "back", "goto"] else ""
	return ""


func on_snow(p: Vector2) -> bool:
	return Weather.snow_cover > 0.35 and world.walkable(p)


func _process(delta: float) -> void:
	var dh := delta * GameState.time_scale * Clock.hours_per_real_second()
	# new snow buries tracks fast; otherwise they slowly fade
	var aging := dh * (1.0 + Weather.snow * 25.0 + (0.0 if Weather.snow_cover > 0.3 else 40.0))
	for i in range(prints.size() - 1, -1, -1):
		prints[i][5] = float(prints[i][5]) + aging
		if float(prints[i][5]) > LIFE_HOURS:
			prints.remove_at(i)
	if Weather.snow_cover > 0.35:
		for c in get_tree().get_nodes_in_group("creatures"):
			var k := _kind(c)
			if k == "":
				continue
			var id: int = c.get_instance_id()
			var p: Vector2 = c.position
			if not _last.has(id):
				_last[id] = [p, 1]
				continue
			var st: float = KINDS[k]["stride"]
			if p.distance_to(_last[id][0]) >= st:
				var side: int = -int(_last[id][1])
				_last[id] = [p, side]
				if on_snow(p):
					prints.append([roundf(p.x), roundf(p.y), k, c.facing, side, 0.0])
					if prints.size() > MAX_PRINTS:
						prints.pop_front()
	_redraw_t += delta
	if _redraw_t > 0.25:
		_redraw_t = 0.0
		queue_redraw()


func _draw() -> void:
	var base := Color(0.50, 0.60, 0.74)
	for pr in prints:
		var a := (1.0 - float(pr[5]) / LIFE_HOURS) * 0.85
		if a <= 0.02:
			continue
		var cells: Array = KINDS[pr[2]]["cells"]
		var f: int = pr[3]
		var off := float(pr[4]) if pr[2] != "rabbit" else 0.0
		for cl in cells:
			var x := float(pr[0]) + float(cl[0]) * f
			var y := float(pr[1]) + float(cl[1]) + off - 1.0
			draw_rect(Rect2(x - (float(cl[2]) - 1.0 if f < 0 else 0.0), y, float(cl[2]), float(cl[3])), Color(base, a))


func clear() -> void:
	prints.clear()
	queue_redraw()
