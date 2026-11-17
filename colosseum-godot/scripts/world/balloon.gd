class_name Balloon
extends Node2D
## Balão de fala preso à cabeça de quem fala; só a caixa desliza para dentro da tela
## (sem passar por baixo do painel lateral). Fica no ar pelo menos 3 segundos.

const PAPER := Color8(255, 246, 220)
const INK := Color8(26, 14, 8)
static var active := {}

var who: Node2D
var head := 50.0
var box: PanelContainer
var tail: Polygon2D
var life := 3.0
var max_w := 200.0
var on_done: Callable


static func speak(host: Node2D, speaker: Node2D, text: String, head_h: float, seconds := -1.0, done := Callable()) -> Balloon:
	var key := speaker.get_instance_id()
	if active.has(key) and is_instance_valid(active[key]):
		active[key].queue_free()
	var b := Balloon.new()
	b.who = speaker
	b.head = head_h
	b.on_done = done
	b.life = maxf(3.0, seconds if seconds > 0 else minf(5.6, 2.2 + text.length() * 0.045))
	b._build(text)
	host.add_child(b)
	active[key] = b
	return b


func _build(text: String) -> void:
	z_index = 300
	box = PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = PAPER
	sb.border_color = INK
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(6)
	sb.set_content_margin_all(5)
	sb.content_margin_top = 2
	sb.content_margin_bottom = 3
	box.add_theme_stylebox_override("panel", sb)
	var l := Label.new()
	l.text = text
	l.add_theme_color_override("font_color", Color8(42, 26, 16))
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0))
	l.add_theme_font_size_override("font_size", 16)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_constant_override("line_spacing", -4)
	var font: Font = UiTheme.font
	var w := minf(max_w, font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x + 4)
	l.custom_minimum_size.x = w
	box.add_child(l)
	box.scale = Vector2(0.5, 0.5)
	add_child(box)
	tail = Polygon2D.new()
	tail.polygon = PackedVector2Array([Vector2(-3, -5), Vector2(2, -5), Vector2(-2, 0)])
	tail.color = INK
	add_child(tail)
	var inner := Polygon2D.new()
	inner.polygon = PackedVector2Array([Vector2(-2, -6), Vector2(1, -6), Vector2(-1.5, -2)])
	inner.color = PAPER
	tail.add_child(inner)
	modulate.a = 0
	create_tween().tween_property(self, "modulate:a", 1.0, 0.14)
	Sfx.play("click", 0.5)


func _process(delta: float) -> void:
	if not is_instance_valid(who):
		queue_free()
		return
	life -= delta
	if life <= 0:
		set_process(false)
		var tw := create_tween()
		tw.tween_property(self, "modulate:a", 0.0, 0.25)
		tw.tween_callback(queue_free)
		if on_done.is_valid():
			on_done.call()
		return
	var cam := get_viewport().get_camera_2d()
	var view_l := 0.0
	var view_r := 640.0
	if cam:
		var half := 320.0 / cam.zoom.x
		view_l = cam.get_screen_center_position().x - half
		view_r = cam.get_screen_center_position().x + half
		var lv := get_parent()
		while lv and not (lv is LocationView):
			lv = lv.get_parent()
		if lv:
			view_r -= (lv as LocationView).panel_right / cam.zoom.x
	var bw := box.size.x * box.scale.x
	var bh := box.size.y * box.scale.y
	var hx := roundf(clampf(who.position.x, view_l + 6, view_r - 6))
	position = Vector2(hx, roundf(who.position.y - head))
	var by := -bh - 4
	var left := view_l + 2
	# desvia do painel de status (canto superior esquerdo) quando o balão está na altura dele
	if cam and Hud.status_rect.size.x > 0:
		var top_screen := (position.y + by - (cam.get_screen_center_position().y - 180.0 / cam.zoom.y)) * cam.zoom.y
		if top_screen < Hud.status_rect.end.y + 4:
			left = maxf(left, view_l + (Hud.status_rect.end.x + 4) / cam.zoom.x)
	var bx := clampf(hx - bw / 2.0, left, maxf(left, view_r - bw - 2))
	box.position = Vector2(roundf(bx - hx), by)
