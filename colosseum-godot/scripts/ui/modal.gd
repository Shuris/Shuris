class_name Modal
extends Control
## Janela centralizada sobre um fundo escurecido. `body` recebe o conteúdo.

signal closed

var body: VBoxContainer
var panel: PanelContainer
var dismissable := true
var _closing := false
static var default_theme: Theme


static func open(host: Node, width := 300, dismiss := true) -> Modal:
	var m := Modal.new()
	m.dismissable = dismiss
	m.theme = default_theme
	m._build(width)
	host.add_child(m)
	return m


func _build(width: int) -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var dim := ColorRect.new()
	dim.color = Color(0.03, 0.02, 0.01, 0.62)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.gui_input.connect(func(e):
		if dismissable and e is InputEventMouseButton and e.pressed:
			close())
	add_child(dim)
	var cc := CenterContainer.new()
	cc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	cc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(cc)
	panel = PanelContainer.new()
	panel.custom_minimum_size.x = width
	cc.add_child(panel)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.custom_minimum_size = Vector2(width - 12, 0)
	body = Ui.vbox(4)
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(body)
	panel.add_child(scroll)
	scroll.resized.connect(_fit.bind(scroll))
	body.resized.connect(_fit.bind(scroll))


func _fit(scroll: ScrollContainer) -> void:
	scroll.custom_minimum_size.y = minf(body.size.y, 330.0)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel") and dismissable:
		get_viewport().set_input_as_handled()
		close()


func close() -> void:
	if _closing:
		return
	_closing = true
	closed.emit()
	queue_free()


## Linha de botões centralizada.
func buttons(items: Array) -> HBoxContainer:
	var row := Ui.hbox(6)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	for b in items:
		row.add_child(b)
	body.add_child(row)
	return row


## Pergunta sim/não. `on_ok` é chamado só na confirmação.
static func confirm(host: Node, title: String, text: String, ok_text: String, on_ok: Callable) -> Modal:
	var m := open(host, 260)
	m.body.add_child(Ui.center(Ui.heading(title)))
	m.body.add_child(Ui.center(Ui.label(text)))
	m.buttons([Ui.button(I18n.t("common.cancel"), m.close), Ui.button(ok_text, func():
		m.close()
		on_ok.call(), false, "red")])
	return m
