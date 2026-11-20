class_name SpriteLib
extends RefCounted
## Builds (and caches) SpriteFrames from generated sprite sheets.
## Sheet metadata lives in res://data/creatures.json:
##   {"bird_sabia": {"sheet": "res://...png", "w": 9, "h": 8,
##                   "anims": {"idle": {"frames": [0, 1], "fps": 2, "loop": true}}}}

static var _frames_cache: Dictionary = {}
static var _tex_cache: Dictionary = {}


static func frames(name: String) -> SpriteFrames:
	if _frames_cache.has(name):
		return _frames_cache[name]
	var meta: Dictionary = GameData.creatures[name]
	var tex: Texture2D = load(meta["sheet"])
	var fw := int(meta["w"])
	var fh := int(meta["h"])
	var cols := int(tex.get_width() / fw)
	var sf := SpriteFrames.new()
	sf.remove_animation(&"default")
	for anim_name in meta["anims"].keys():
		var a: Dictionary = meta["anims"][anim_name]
		sf.add_animation(anim_name)
		sf.set_animation_speed(anim_name, float(a.get("fps", 6)))
		sf.set_animation_loop(anim_name, bool(a.get("loop", true)))
		for idx in a["frames"]:
			var at := AtlasTexture.new()
			at.atlas = tex
			at.region = Rect2((int(idx) % cols) * fw, int(int(idx) / cols) * fh, fw, fh)
			sf.add_frame(anim_name, at)
	_frames_cache[name] = sf
	return sf


static func tex(path: String) -> Texture2D:
	if path == "":
		return null
	if not _tex_cache.has(path):
		_tex_cache[path] = load(path)
	return _tex_cache[path]


## Simple horizontal strip -> SpriteFrames with one animation.
static func strip(path: String, frame_w: int, fps: float, loop: bool) -> SpriteFrames:
	var key := "%s#%d" % [path, frame_w]
	if _frames_cache.has(key):
		return _frames_cache[key]
	var t: Texture2D = load(path)
	var sf := SpriteFrames.new()
	sf.set_animation_speed(&"default", fps)
	sf.set_animation_loop(&"default", loop)
	for i in int(t.get_width() / frame_w):
		var at := AtlasTexture.new()
		at.atlas = t
		at.region = Rect2(i * frame_w, 0, frame_w, t.get_height())
		sf.add_frame(&"default", at)
	_frames_cache[key] = sf
	return sf
