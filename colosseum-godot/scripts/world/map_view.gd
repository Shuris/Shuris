class_name MapView
extends Node2D
## Mapa de Cápua: clique num prédio para viajar (o marcador anda até lá).

signal picked(loc_id: String)

var marker: Node2D
var current := "home"
var labels := {}
var traveling := false


func setup(cur: String) -> void:
	current = cur
	var bg := Sprite2D.new()
	bg.texture = load("res://assets/backgrounds/map.png")
	bg.centered = false
	add_child(bg)
	for l in Data.locations:
		var p := Vector2(l.map[0], l.map[1])
		var lab := Label.new()
		lab.text = Data.loc_name(l.id)
		lab.add_theme_font_override("font", UiTheme.font)
		lab.add_theme_font_size_override("font_size", 16)
		lab.add_theme_color_override("font_outline_color", Color8(26, 14, 8))
		lab.add_theme_constant_override("outline_size", 3)
		lab.position = p + Vector2(-40, 14)
		lab.size = Vector2(80, 16)
		lab.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		lab.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(lab)
		labels[l.id] = lab
	marker = Node2D.new()
	var dot := Polygon2D.new()
	dot.polygon = PackedVector2Array([Vector2(-4, -14), Vector2(4, -14), Vector2(0, -6)])
	dot.color = Color8(224, 88, 74)
	marker.add_child(dot)
	var ring := Polygon2D.new()
	ring.polygon = _circle(4)
	ring.color = Color8(255, 228, 154)
	ring.position = Vector2(0, -2)
	marker.add_child(ring)
	var lp: Array = Data.location(cur).map
	marker.position = Vector2(lp[0], lp[1])
	add_child(marker)
	var tw := create_tween().set_loops()
	tw.tween_property(dot, "position:y", -3.0, 0.5)
	tw.tween_property(dot, "position:y", 0.0, 0.5)


static func _circle(r: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in 12:
		pts.append(Vector2(cos(i * TAU / 12), sin(i * TAU / 12)) * r)
	return pts


func _unhandled_input(event: InputEvent) -> void:
	if traveling or not (event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT):
		return
	var wp := get_global_mouse_position()
	var best := ""
	var bd := 1e9
	for l in Data.locations:
		var d := wp.distance_to(Vector2(l.map[0], l.map[1]))
		if d < bd:
			bd = d
			best = l.id
	if bd < 48:
		picked.emit(best)


## Anima o marcador até o destino e chama done ao chegar.
func travel_to(id: String, done: Callable) -> void:
	traveling = true
	var lp: Array = Data.location(id).map
	var tw := create_tween()
	tw.tween_property(marker, "position", Vector2(lp[0], lp[1]), 0.9).set_trans(Tween.TRANS_SINE)
	tw.finished.connect(func():
		traveling = false
		current = id
		done.call())
