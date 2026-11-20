extends Node
## Biodiversity journal data: sightings per species (count, first sighting
## date, last seen) and a log of notable natural events. Persisted through
## SaveSystem.register("journal", self).

signal sighting_added(species: String, first: bool)
signal event_logged(id: String, text: String)
signal notify(text: String)

var sightings: Dictionary = {}   # species -> {count, first_h, last_h}
var events: Array = []           # [{id, text, h}] newest last (capped)
const MAX_EVENTS := 60


func _ready() -> void:
	SaveSystem.register("journal", self)


## A creature became visible in the scene.
func sight(species: String) -> void:
	var now := Clock.total_hours
	var e: Dictionary = sightings.get(species, {})
	var first := e.is_empty()
	if first:
		e = {"count": 0, "first_h": now, "last_h": now}
	# repeated reports of the same individual within an hour count once
	if not first and now - float(e.get("last_h", 0.0)) < 1.0:
		e["last_h"] = now
		sightings[species] = e
		return
	e["count"] = int(e["count"]) + 1
	e["last_h"] = now
	sightings[species] = e
	if first:
		GameState.discover(species)
	sighting_added.emit(species, first)


func count(species: String) -> int:
	return int(sightings.get(species, {}).get("count", 0))


## Notable event (nest built, fawn born, rainbow...). `toast` shows a
## discreet notification; journal-worthy events are stored.
func record_event(id: String, text: String, toast: bool = false) -> void:
	events.append({"id": id, "text": text, "h": Clock.total_hours})
	while events.size() > MAX_EVENTS:
		events.pop_front()
	event_logged.emit(id, text)
	if toast:
		notify.emit(text)


func to_dict() -> Dictionary:
	return {"sightings": sightings, "events": events}


func from_dict(d: Dictionary) -> void:
	sightings = d.get("sightings", {})
	events = d.get("events", [])
