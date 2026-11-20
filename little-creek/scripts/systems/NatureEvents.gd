class_name NatureEvents
extends Node
## Spontaneous natural events. Checked once per game hour; each event has a
## chance, a cooldown (game hours) and conditions on the ecosystem, time,
## season and weather (data/config.json -> events). A global minimum gap
## keeps things rare and special. Offline time never triggers a burst: the
## check runs once when the clock jumps.

var world: World
var wildlife: Node
var nests: NestSystem
var cfg: Dictionary = {}
var last: Dictionary = {}        # event id -> game hour
var last_any := -999.0
var _next_check := 0.0

const IDS := ["butterfly_swarm", "deer_fawn", "nest", "ducks", "rare_flower", "bird_flock", "rare_animal"]


func _ready() -> void:
	cfg = GameData.config.get("events", {})
	SaveSystem.register("events", self)
	Weather.weather_changed.connect(func(st: String) -> void:
		if st == "heavy":
			NatureLog.record_event("surge", "A chuva forte aumentou a correnteza do riacho.", true))
	Clock.season_changed.connect(func(s: int) -> void:
		NatureLog.record_event("season", "Começou %s." % ["a Primavera", "o Verão", "o Outono", "o Inverno"][s], true))


func _process(_d: float) -> void:
	var now := Clock.total_hours
	if now < _next_check:
		return
	_next_check = now + float(cfg.get("check_every_hours", 1.0))
	if now - last_any < float(cfg.get("min_gap_hours", 3.0)):
		return
	var order := IDS.duplicate()
	order.shuffle()
	for id in order:
		var e: Dictionary = cfg.get(id, {})
		if now - float(last.get(id, -9999.0)) < float(e.get("cooldown", 24)):
			continue
		if not conditions(id):
			continue
		if randf() < float(e.get("chance", 0.05)):
			if trigger(id):
				last[id] = now
				last_any = now
				return


func conditions(id: String) -> bool:
	var gs := GameState
	var c: Dictionary = gs.counts
	var p := Clock.period()
	var sk := Clock.season_key()
	var dry := Weather.state == "clear"
	match id:
		"butterfly_swarm":
			return dry and p == "day" and sk in ["spring", "summer"] and int(c.get("flowers", 0)) >= 3
		"deer_fawn":
			return gs.eligible_animals.has("deer") and sk in ["spring", "summer"] and p in ["dawn", "dusk", "day"] and Weather.state != "heavy"
		"nest":
			return sk in ["spring", "summer"] and nests.can_start()
		"ducks":
			return not gs.ducks_resident and gs.quality >= 50.0 and int(c.get("aquatic", 0)) >= 1
		"rare_flower":
			return gs.stage >= 3 and sk in ["spring", "summer"] and gs.item_count("rare_flower") == 0
		"bird_flock":
			return dry and p in ["dawn", "day"] and gs.eligible_animals.has("sabia") and gs.stage >= 2
		"rare_animal":
			return gs.stage >= 3 and gs.vitality >= 65.0 and p in ["dusk", "night"] and Weather.state != "heavy" \
				and get_tree().get_nodes_in_group("visitors").is_empty()
	return false


func trigger(id: String) -> bool:
	match id:
		"butterfly_swarm":
			for i in 6:
				wildlife._spawn("butterfly")
			NatureLog.record_event(id, "Um grupo de borboletas chegou às flores.", true)
		"deer_fawn":
			wildlife.spawn_deer(true)
			NatureLog.record_event(id, "Um veado apareceu acompanhado de um filhote.", true)
		"nest":
			return nests.start_nest()
		"ducks":
			GameState.ducks_resident = true
			GameState.recompute()
			NatureLog.record_event(id, "Patos começaram a frequentar o riacho.", true)
		"rare_flower":
			var d: Dictionary = world.place_free("rare_flower")
			if d.is_empty():
				return false
			NatureLog.record_event(id, "Uma flor rara começou a florescer perto da margem.", true)
		"bird_flock":
			wildlife.spawn_flock(randi_range(4, 6))
			NatureLog.record_event(id, "Um bando de pássaros pousou ao mesmo tempo nas árvores.", false)
		"rare_animal":
			wildlife.spawn_wanderer("maned_wolf")
			NatureLog.record_event(id, "Um visitante especial chegou ao riacho: um lobo-guará!", true)
	return true


func to_dict() -> Dictionary:
	return {"last": last, "last_any": last_any}


func from_dict(d: Dictionary) -> void:
	last = d.get("last", {})
	last_any = float(d.get("last_any", -999.0))
