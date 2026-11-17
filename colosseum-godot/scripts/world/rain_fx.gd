class_name RainFx
extends Node2D
## Chuva em pixels: gotas inclinadas caindo e respingos no chão.

var drops: Array = []
var floor_y := 330.0


func setup(count: int, ground := 330.0) -> void:
	floor_y = ground
	z_index = 150
	for i in count:
		var d := ColorRect.new()
		d.size = Vector2(1, 6)
		d.rotation = 0.23
		d.color = Color(0.86, 0.9, 1.0, 0.8)
		d.mouse_filter = Control.MOUSE_FILTER_IGNORE
		d.position = Vector2(randf() * 700, randf() * 360)
		add_child(d)
		drops.append(d)


func _process(delta: float) -> void:
	var dt := minf(0.1, delta)
	for d in drops:
		d.position += Vector2(-60, 260) * dt
		if d.position.y > floor_y + randf() * 30:
			if randf() < 0.3:
				var r := ColorRect.new()
				r.color = Color(0.8, 0.86, 0.95, 0.6)
				r.size = Vector2(2, 1)
				r.position = d.position.round()
				add_child(r)
				var tw := create_tween()
				tw.tween_property(r, "modulate:a", 0.0, 0.2)
				tw.tween_callback(r.queue_free)
			d.position = Vector2(randf() * 700, -10)
