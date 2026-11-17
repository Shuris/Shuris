class_name LocationView
extends Node2D
## Um local da cidade: céu (ao ar livre), cenário, braseiros e lamparinas com luz 2D
## de verdade à noite, e o gladiador andando até onde o jogador clicar.

const GROUND := 312.0
const LIGHTS := {
	"ludus": [[430, 240, true, 120, 1.1]],
	"home": [[244, 291, false, 220, 1.1]],
	"tavern": [[262, 236, false, 140, 1.1], [430, 236, false, 140, 1.1]],
	"temple": [[320, 258, true, 120, 1.1]],
	"forum": [[300, 240, true, 120, 1.1], [556, 302, true, 120, 1.05]],
	"market": [[170, 240, true, 120, 1.05], [470, 240, true, 120, 1.05]],
	"baths": [[236, 242, true, 130, 1.05], [466, 242, true, 130, 1.05]],
	"arena": [[112, 200, true, 120, 1.0], [528, 200, true, 120, 1.0]],
}
const HERO_X := {"ludus": 318, "home": 340, "temple": 360, "tavern": 344}

var loc: Dictionary
var hero: Gladiator
var sky_sprite: Sprite2D
var modulate_node: CanvasModulate
var lights: Array[PointLight2D] = []
var cam: Camera2D
var target_x := -1.0
var _sky_f := -1.0
var panel_right := 210.0
var life: TownLife = null
var busy := false
var app: Node = null


func setup(loc_id: String, appearance: Dictionary, gear: Dictionary) -> void:
	loc = Data.location(loc_id)
	sky_sprite = Sprite2D.new()
	sky_sprite.centered = false
	sky_sprite.z_index = -10
	add_child(sky_sprite)
	var bg_name: String = loc.bg.replace("bg:", "")
	if loc.id == "arena":
		bg_name = "arena_capua"
	var bg := Sprite2D.new()
	bg.texture = load("res://assets/backgrounds/%s.png" % bg_name)
	bg.centered = false
	add_child(bg)
	if loc.id == "arena":
		var crowd := Sprite2D.new()
		crowd.texture = load("res://assets/backgrounds/crowd_capua.png")
		crowd.hframes = 5
		crowd.centered = false
		add_child(crowd)
	for L in LIGHTS.get(loc.id, []):
		if L[2]:
			var br := AnimatedSprite2D.new()
			br.sprite_frames = _brazier_frames()
			br.play("burn")
			br.centered = false
			br.offset = Vector2(-8, -32)
			br.position = Vector2(L[0], L[1])
			add_child(br)
		var pl := PointLight2D.new()
		pl.texture = _light_texture()
		pl.position = Vector2(L[0], L[1] - 16)
		pl.texture_scale = float(L[3]) / 64.0
		pl.color = Color8(255, 184, 104)
		pl.energy = 0.0
		pl.set_meta("power", float(L[4]))
		add_child(pl)
		lights.append(pl)
	hero = Gladiator.new()
	hero.position = Vector2(HERO_X.get(loc.id, 300), GROUND)
	hero.set_visual(appearance, gear)
	hero.play("idle")
	hero.z_index = 73
	add_child(hero)
	if Game.has_player():
		life = TownLife.new()
		add_child(life)
		life.setup(self)
	modulate_node = CanvasModulate.new()
	add_child(modulate_node)
	cam = Camera2D.new()
	cam.zoom = Vector2(2, 2)
	cam.limit_left = 0
	cam.limit_top = 0
	cam.limit_right = 640
	cam.limit_bottom = 360
	add_child(cam)
	cam.make_current()
	_frame_camera()
	refresh_time()


## Enquadra a câmera mostrando a área do chão à esquerda do painel lateral.
func _frame_camera() -> void:
	var view_w := 640.0 / cam.zoom.x
	var right_cover := panel_right / cam.zoom.x
	var cx := 335.0 + right_cover / 2.0
	cam.position = Vector2(clampf(cx, view_w / 2, 640 - view_w / 2), 250)


## Atualiza céu, tinta do dia/noite e intensidade das luzes conforme o relógio do jogo.
func refresh_time() -> void:
	var f := Calendar.day_fraction(int(Game.p.get("minutes", 600)) if Game.has_player() else 600)
	var c := SkyPainter.colors(f)
	if loc.outdoor:
		if absf(f - _sky_f) > 0.004:
			_sky_f = f
			sky_sprite.texture = ImageTexture.create_from_image(SkyPainter.image(f))
		modulate_node.color = c[2]
	else:
		sky_sprite.texture = null
		# dentro de casa a noite pesa menos (há sempre alguma luz)
		modulate_node.color = (c[2] as Color).lerp(Color.WHITE, 0.45)
	# dia de chuva: tudo mais acinzentado e escuro
	var w := Weather.now(int(Game.p.get("createdAt", 0)), int(Game.p.get("day", 1))) if Game.has_player() else {"rain": 0.0, "cloud": 0.0}
	var gloom := float(w.rain) * 0.22 + float(w.cloud) * 0.08
	if gloom > 0:
		modulate_node.color = (modulate_node.color as Color).lerp(Color(0.55, 0.6, 0.7), gloom * (1.0 if loc.outdoor else 0.4))
	var dark := 1.0 - (modulate_node.color as Color).v
	for pl in lights:
		# dentro de casa as lamparinas pesam mais à noite
		var k := 2.6 if not loc.outdoor else 2.0
		pl.energy = clampf(dark * k, 0.0, 1.3) * float(pl.get_meta("power"))


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var wp := get_global_mouse_position()
		if life and life.click(wp):
			get_viewport().set_input_as_handled()
			return
		target_x = clampf(wp.x, 40, 600)


func _process(delta: float) -> void:
	if target_x >= 0:
		var dx := target_x - hero.position.x
		if absf(dx) < 1.5:
			target_x = -1
			hero.play("idle")
		else:
			hero.set_facing(1 if dx > 0 else -1)
			hero.play("walk", {"fps": 10})
			hero.position.x += signf(dx) * minf(absf(dx), 46.0 * delta)
	for pl in lights:
		# chama tremendo
		pl.texture_scale *= 1.0 + (randf() - 0.5) * 0.01


static var _bf: SpriteFrames
static func _brazier_frames() -> SpriteFrames:
	if _bf:
		return _bf
	_bf = SpriteFrames.new()
	_bf.add_animation("burn")
	_bf.set_animation_speed("burn", 8)
	var sheet: Texture2D = load("res://assets/sprites/fx/brazier.png")
	for i in 4:
		var at := AtlasTexture.new()
		at.atlas = sheet
		at.region = Rect2(i * 16, 0, 16, 32)
		_bf.add_frame("burn", at)
	return _bf


static var _lt: Texture2D
## Mancha de luz em faixas (pixelada), não um degradê liso.
static func _light_texture() -> Texture2D:
	if _lt:
		return _lt
	var n := 128
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	for y in n:
		for x in n:
			var d := Vector2(x - n / 2.0, y - n / 2.0).length() / (n / 2.0)
			var v := clampf(1.0 - d, 0.0, 1.0)
			v = floorf(v * v * 6.0) / 6.0
			img.set_pixel(x, y, Color(1, 1, 1, v))
	_lt = ImageTexture.create_from_image(img)
	return _lt


## Balão de fala de um morador presente na cena. Devolve false se ele não está aqui.
func say(who: String, text: String) -> bool:
	return life != null and life.say(who, text)


## Fala do próprio gladiador.
func hero_say(text: String) -> void:
	Balloon.speak(self, hero, text, 50, 4.2)


## Conversa com um rival pela cidade (a regra fica na App).
func app_rival_talk(id: String) -> String:
	return app.rival_talk(id) if app else ""


## Texto que sobe da cabeça do gladiador (ganho do treino).
func show_gain(text: String) -> void:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", UiTheme.title_font)
	l.add_theme_font_size_override("font_size", 8)
	l.add_theme_color_override("font_color", UiTheme.GOLD)
	l.add_theme_color_override("font_outline_color", Color8(30, 14, 6))
	l.add_theme_constant_override("outline_size", 2)
	l.position = hero.position + Vector2(-24, -60)
	l.z_index = 50
	add_child(l)
	var tw := create_tween()
	tw.tween_property(l, "position:y", l.position.y - 14, 1.2)
	tw.parallel().tween_property(l, "modulate:a", 0.0, 1.2).set_delay(0.5)
	tw.tween_callback(l.queue_free)


## Treino: o gladiador golpeia (força/técnica), defende (resistência) ou se esquiva
## (agilidade) por um instante; depois `done` aplica o resultado.
func play_training(id: String, done: Callable) -> void:
	target_x = -1
	busy = true
	var anim: String = {"str": "attack", "tech": "attack", "prec": "attack", "res": "block", "vit": "block", "agi": "dodge"}.get(id, "attack")
	hero.play(anim, {"fps": 7, "restart": true})
	for i in 3:
		Sfx.play("train" if anim == "attack" else ("block" if anim == "block" else "dodge"), 0.6)
		await get_tree().create_timer(0.47).timeout
	hero.play("idle")
	busy = false
	done.call()


## Melhorias compradas mudam a mobília (camas, pesos...). Redesenhadas na etapa 4.
func refresh_props() -> void:
	if life:
		var old := life
		life = TownLife.new()
		add_child(life)
		life.setup(self)
		old.queue_free()
