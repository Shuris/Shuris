class_name PauseMenu
extends Control
## Menu de pausa (Esc): continuar, opções, salvar e voltar ao menu, salvar e sair.

signal resumed
signal options
signal to_menu
signal quit


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.55)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(dim)
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.custom_minimum_size = Vector2(200, 0)
	panel.position = Vector2(-100, -80)
	add_child(panel)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 5)
	panel.add_child(v)
	var t := UiTheme.title_label(I18n.t("pause.title"), 16, UiTheme.GOLD)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(t)
	for b in [["resume", I18n.t("pause.resume"), resumed], ["options", I18n.t("app.options"), options], ["menu", I18n.t("pause.toMenu"), to_menu], ["quit", I18n.t("pause.quit"), quit]]:
		var btn := Button.new()
		btn.name = b[0]
		btn.text = b[1]
		var sig: Signal = b[2]
		btn.pressed.connect(func(): sig.emit())
		v.add_child(btn)
	var hint := Label.new()
	hint.text = I18n.t("pause.hint")
	hint.add_theme_color_override("font_color", UiTheme.DIM)
	v.add_child(hint)
	(v.get_child(1) as Control).call_deferred("grab_focus")
