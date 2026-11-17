class_name Newspaper
## Edição do jornal da cidade: cabeçalho, matéria principal com ilustração, notas e anúncio.

const ADS := 20
const INK := Color8(40, 30, 22)
const PAPER := Color8(232, 220, 190)


static func roman(n: int) -> String:
	var map := [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]
	var out := ""
	for pair in map:
		while n >= pair[0]:
			out += pair[1]
			n -= pair[0]
	return out


static func _ink(text: String, size := 14, font: Font = null, color := INK) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0))
	l.add_theme_font_size_override("font_size", size)
	if font:
		l.add_theme_font_override("font", font)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size.x = 40
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return l


static func open(host: Node, ed: Dictionary) -> Modal:
	var m := Modal.open(host, 440)
	var sb := StyleBoxFlat.new()
	sb.bg_color = PAPER
	sb.border_color = Color8(120, 96, 64)
	sb.set_border_width_all(2)
	sb.set_content_margin_all(8)
	m.panel.add_theme_stylebox_override("panel", sb)
	var b := m.body
	var top := Ui.hbox(4)
	b.add_child(top)
	for t in [I18n.t("np.price"), I18n.t("np.edition", {"n": ed.day}), I18n.t("np.year", {"y": roman(830 + (int(ed.day) - 1) / 365)})]:
		var l := _ink(t, 14)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		top.add_child(l)
	var title := _ink(I18n.t("np.title"), 24, UiTheme.title_font)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.add_child(title)
	var sub := Ui.hbox(4)
	b.add_child(sub)
	sub.add_child(_ink("%s, %s" % [Calendar.weekday_name(int(ed.day)), I18n.t("common.dayN", {"n": ed.day})], 14))
	var motto := _ink(I18n.t("np.motto"), 14)
	motto.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	sub.add_child(motto)
	b.add_child(_rule())
	var items: Array = ed.items
	if items.size():
		_article(b, items[0], true)
	var cols := Ui.hbox(8)
	b.add_child(cols)
	var colv := [Ui.vbox(4), Ui.vbox(4)]
	for c in colv:
		c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		c.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		cols.add_child(c)
	for i in range(1, items.size()):
		_article(colv[(i - 1) % 2], items[i], false)
	var ad: VBoxContainer = colv[(items.size() - 1) % 2] if items.size() > 0 else colv[0]
	ad.add_child(_rule())
	ad.add_child(_ink(I18n.t("np.ad"), 14, UiTheme.title_font))
	ad.add_child(_ink(I18n.tk("ad.%d" % (int(ed.day) % ADS)), 14))
	m.buttons([Ui.button(I18n.t("common.close"), m.close)])
	return m


static func _rule() -> ColorRect:
	var r := ColorRect.new()
	r.color = INK
	r.custom_minimum_size = Vector2(10, 1)
	return r


static func _article(parent: Control, n: Dictionary, lead: bool) -> void:
	var img = n.get("img")
	if img != null and ResourceLoader.exists("res://assets/news/%s.png" % img):
		var tr := TextureRect.new()
		tr.texture = load("res://assets/news/%s.png" % img)
		# metade exata do tamanho original (520x320) para o pontilhado não virar moiré
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tr.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		tr.custom_minimum_size = Vector2(0, 160 if lead else 80)
		parent.add_child(tr)
		var cap := _ink(I18n.tk("news.img.%s" % img), 12, null, Color8(90, 74, 56))
		cap.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		parent.add_child(cap)
	parent.add_child(_ink(News.headline(n), 16 if lead else 14, UiTheme.title_font))
	parent.add_child(_ink(News.body(n), 14))
