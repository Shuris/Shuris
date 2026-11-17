class_name ArmWrestle
extends Control
## Minijogo da queda de braço: um marcador corre de um lado para o outro; apertar
## quando ele está na faixa dourada empurra o braço do adversário. Errar devolve terreno.

signal done(won: bool)

var cfg: Dictionary
var pos := 50.0
var marker := 0.0
var dir := 1.0
var started := false
var finished := false
var last_press := 0
var rope: ProgressBar
var meter: Control
var msg: Label
var push_btn: Button


func setup(c: Dictionary, player_name: String) -> void:
	cfg = c
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var dim := ColorRect.new()
	dim.color = Color(0.03, 0.02, 0.01, 0.62)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(dim)
	var cc := CenterContainer.new()
	cc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(cc)
	var panel := PanelContainer.new()
	panel.custom_minimum_size.x = 300
	cc.add_child(panel)
	var v := Ui.vbox(6)
	panel.add_child(v)
	v.add_child(Ui.center(Ui.heading(I18n.t("event.armTitle"))))
	v.add_child(Ui.center(Ui.small(I18n.t("event.armHow"))))
	var names := Ui.hbox(4)
	v.add_child(names)
	names.add_child(Ui.label(player_name, UiTheme.GOLD, 16))
	var r := Ui.label(str(c.champion), Color8(255, 170, 150), 16)
	r.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	names.add_child(r)
	rope = Ui.bar(50, 100, Color8(214, 168, 64), "", 10)
	v.add_child(rope)
	meter = Control.new()
	meter.custom_minimum_size = Vector2(280, 12)
	meter.draw.connect(_draw_meter)
	v.add_child(meter)
	msg = Ui.center(Ui.label(I18n.t("event.armReady"), UiTheme.CREAM))
	v.add_child(msg)
	push_btn = Ui.button(I18n.t("event.armPush"), _press, false, "red")
	var row := Ui.hbox(4)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_child(push_btn)
	v.add_child(row)


func _draw_meter() -> void:
	var w := meter.size.x
	meter.draw_rect(Rect2(0, 0, w, 12), Color8(14, 9, 6))
	var z0 := (0.5 - float(cfg.zone) / 2.0) * w
	meter.draw_rect(Rect2(z0, 1, float(cfg.zone) * w, 10), Color8(214, 168, 64))
	meter.draw_rect(Rect2(roundf(marker * (w - 2)), 0, 2, 12), Color.WHITE)
	meter.draw_rect(Rect2(0, 0, w, 12), UiTheme.BRONZE, false)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and (event.keycode == KEY_SPACE or event.keycode == KEY_ENTER):
		get_viewport().set_input_as_handled()
		_press()


func _press() -> void:
	if finished:
		return
	if not started:
		started = true
		msg.text = I18n.t("event.armGo")
		return
	var now := Time.get_ticks_msec()
	if now - last_press < 220:
		return
	last_press = now
	var z0 := 0.5 - float(cfg.zone) / 2.0
	var hit := marker >= z0 and marker <= z0 + float(cfg.zone)
	pos = clampf(pos + (float(cfg.push) if hit else -float(cfg.push) * 0.5), 0, 100)
	Sfx.play("hit" if hit else "error")
	msg.text = I18n.t("event.armGood") if hit else I18n.t("event.armMiss")
	if pos >= 100:
		_end(true)


func _process(delta: float) -> void:
	rope.value = pos
	meter.queue_redraw()
	if not started or finished:
		return
	var dt := minf(0.05, delta)
	marker += dir * dt * 1.25
	if marker > 1:
		marker = 1
		dir = -1
	if marker < 0:
		marker = 0
		dir = 1
	pos -= float(cfg.pull) * dt * 1.4
	if pos <= 0:
		_end(false)


func _end(won: bool) -> void:
	finished = true
	msg.text = I18n.t("event.armWin") if won else I18n.t("event.armLose")
	msg.add_theme_color_override("font_color", UiTheme.GOLD if won else UiTheme.RED)
	push_btn.disabled = true
	Sfx.play("victory" if won else "defeat")
	await get_tree().create_timer(1.6).timeout
	done.emit(won)
	queue_free()
