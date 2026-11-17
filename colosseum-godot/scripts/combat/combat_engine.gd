class_name CombatEngine
extends RefCounted
## Motor de combate automático (porte fiel de CombatEngine.ts): simulação determinística
## em passos fixos de 0,05 s. Mesma semente = mesma luta da versão TypeScript.

const TICK := 0.05
const ARENA_MIN_X := 96.0
const ARENA_MAX_X := 544.0
const ENTRY_X := [56.0, 584.0]
const START_X := [262.0, 378.0]
const BODY_GAP := 18.0
const DEFAULT_TIME_LIMIT := 120.0
const DEFAULT_INTRO := 3.5
const ATTACK_COST := 9.0
const DODGE_COST := 9.0
const BLOCK_START_COST := 2.0
const EXHAUST_DURATION := 1.8
# resolução dos golpes (CombatResolver.ts)
const DAMAGE_PACE := 0.36
const CRIT_MULTIPLIER := 1.6
const MIN_HIT := 0.5
const MAX_HIT := 0.98

const PROFILES := {
	"normal": {"windup": 0.38, "recover": 0.32, "intervalMul": 1.0, "defendable": true, "skill": null},
	"power_strike": {"windup": 0.65, "recover": 0.45, "intervalMul": 1.3, "defendable": true, "skill": "power_strike"},
	"quick_strike": {"windup": 0.18, "recover": 0.18, "intervalMul": 0.55, "defendable": true, "skill": "quick_strike"},
	"counter": {"windup": 0.16, "recover": 0.3, "intervalMul": 0.8, "defendable": false, "skill": "counter"},
}
const FREE := ["idle", "advance", "retreat"]
const VULNERABLE := ["recover", "hitstun", "exhausted", "buff"]
const REGEN := {"idle": 1.0, "advance": 0.9, "retreat": 1.2, "windup": 0.3, "recover": 0.3, "block": 0.2,
	"dodge": 0.0, "hitstun": 0.5, "exhausted": 2.2, "buff": 0.5}

var fighters: Array = []
var time := 0.0
var finished := false
var started := false
var result = null
var time_limit: float
var intro_duration: float
var rng: Rng
var events: Array = []
var tick_count := 0


func _init(a: Dictionary, b: Dictionary, opts: Dictionary) -> void:
	rng = Rng.new(int(opts.seed))
	time_limit = float(opts.get("timeLimit", DEFAULT_TIME_LIMIT))
	intro_duration = float(opts.get("introDuration", DEFAULT_INTRO))
	fighters = [_make(0, a), _make(1, b)]
	var sh = opts.get("startHp")
	if sh != null:
		for i in 2:
			if sh[i] != null:
				var f: Dictionary = fighters[i]
				f.hp = maxf(1, minf(f.spec.stats.maxHp, round(float(sh[i]))))


func _make(side: int, spec: Dictionary) -> Dictionary:
	return {
		"side": side, "spec": spec, "x": ENTRY_X[side], "facing": 1 if side == 0 else -1,
		"hp": float(spec.stats.maxHp), "stamina": float(spec.stats.maxStamina),
		"action": "intro", "actionStart": 0.0, "actionDuration": intro_duration,
		"attack": null, "reaction": null, "nextAttackAt": 0.0, "cooldowns": {},
		"fortifyUntil": 0.0, "fortifyMul": 1.0, "passiveTime": 0.0, "secondWindUsed": false,
		"counters": {"attacks": 0, "hits": 0, "misses": 0, "dodged": 0, "blocked": 0, "crits": 0, "damageDealt": 0, "skillsUsed": 0},
	}


func fight_time() -> float:
	return maxf(0.0, time - intro_duration)


func time_remaining() -> float:
	return maxf(0.0, time_limit - fight_time())


func step() -> Array:
	events = []
	if finished:
		return events
	time += TICK
	tick_count += 1
	if time < intro_duration:
		_update_intro()
		return events
	if not started:
		started = true
		for f in fighters:
			f.x = START_X[f.side]
			f.nextAttackAt = time + 0.4 + rng.next() * 0.4
			_set_action(f, "idle", 0)
		_emit({"type": "start", "t": time})
	var order := [0, 1] if tick_count % 2 == 0 else [1, 0]
	for s in order:
		_update_fighter(fighters[s], fighters[1 - s])
	_check_end()
	return events


func run_to_end(max_seconds := 600.0) -> Dictionary:
	while not finished and time < max_seconds:
		step()
	if result == null:
		_finish(_decision_winner(), "decision")
	return result


func forfeit(side: int) -> void:
	if finished:
		return
	events = []
	_finish(1 if side == 0 else 0, "forfeit")


func drain_events() -> Array:
	var e := events
	events = []
	return e


# ------------------------------------------------------------------ interno
func _emit(e: Dictionary) -> void:
	events.append(e)


func _strategy(f: Dictionary) -> Dictionary:
	return Data.d.strategies[f.spec.strategy]


func _set_action(f: Dictionary, action: String, duration: float) -> void:
	var changed: bool = f.action != action
	f.action = action
	f.actionStart = time
	f.actionDuration = duration
	if changed or duration > 0:
		_emit({"type": "action", "t": time, "side": f.side, "action": action, "duration": duration})


func _update_intro() -> void:
	var walk := intro_duration * 0.7
	var k := minf(1.0, time / walk)
	for f in fighters:
		f.x = ENTRY_X[f.side] + (START_X[f.side] - ENTRY_X[f.side]) * k
		if k >= 1 and f.action == "intro":
			_set_action(f, "idle", 0)


func _fatigued(f: Dictionary) -> bool:
	return f.stamina < f.spec.stats.maxStamina * 0.25


func _spend(f: Dictionary, amount: float) -> void:
	f.stamina = maxf(0.0, f.stamina - amount * f.spec.stats.fatigueMul * float(_strategy(f).staminaMul))


func _skill_ready(f: Dictionary, skill: String) -> bool:
	return f.spec.skills.has(skill) and float(f.cooldowns.get(skill, 0.0)) <= time


func _cost_of(kind: String) -> float:
	var sk = PROFILES[kind].skill
	return float(Data.d.skills[sk].staminaCost) if sk != null else ATTACK_COST


func _regen(f: Dictionary) -> void:
	var k: float = REGEN.get(f.action, 0.0)
	f.stamina = minf(float(f.spec.stats.maxStamina), f.stamina + f.spec.stats.staminaRegen * k * TICK)


func _sign(v: float) -> int:
	return 1 if v > 0 else (-1 if v < 0 else 0)


func _update_fighter(f: Dictionary, e: Dictionary) -> void:
	if f.action == "victory" or f.action == "defeat":
		return
	_regen(f)
	if f.fortifyMul != 1.0 and time >= f.fortifyUntil:
		f.fortifyMul = 1.0
		_emit({"type": "buffEnd", "t": time, "side": f.side})
	var elapsed: float = time - f.actionStart
	var dir := _sign(e.x - f.x)
	if dir == 0:
		dir = f.facing
	match f.action:
		"windup":
			if f.attack != null and time >= f.attack.impactAt:
				_resolve_impact(f, e)
			return
		"dodge":
			_move(f, -dir * 50 * TICK, e)
			if elapsed >= f.actionDuration:
				_set_action(f, "idle", 0)
			return
		"recover", "block", "hitstun", "buff", "exhausted":
			if elapsed >= f.actionDuration:
				_set_action(f, "idle", 0)
			return
	f.facing = dir
	if f.reaction != null:
		if time >= f.reaction.startAt:
			var r: Dictionary = f.reaction
			f.reaction = null
			var cost := DODGE_COST if r.kind == "dodge" else BLOCK_START_COST
			if f.stamina >= cost:
				_spend(f, cost)
				_set_action(f, r.kind, r.duration)
				return
		else:
			if f.action != "idle":
				_set_action(f, "idle", 0)
			return
	if f.stamina < 3:
		_set_action(f, "exhausted", EXHAUST_DURATION)
		_emit({"type": "exhausted", "t": time, "side": f.side})
		return
	_decide(f, e, dir, elapsed)


func _decide(f: Dictionary, e: Dictionary, dir: int, elapsed: float) -> void:
	var st: Dictionary = f.spec.stats
	var strat := _strategy(f)
	var gap := absf(e.x - f.x)
	var in_range: bool = gap <= st.reach
	var can_attack: bool = time >= f.nextAttackAt
	var sk: Dictionary = Data.d.skills
	if _skill_ready(f, "iron_guard") and f.fortifyMul == 1.0 and f.hp / st.maxHp < 0.65 and gap < e.spec.stats.reach + 30 and f.stamina >= float(sk.iron_guard.staminaCost):
		_spend(f, float(sk.iron_guard.staminaCost))
		f.cooldowns["iron_guard"] = time + float(sk.iron_guard.cooldown)
		f.fortifyMul = maxf(0.4, 0.65 - st.technique * 0.004)
		f.fortifyUntil = time + 0.45 + (4 + st.technique * 0.04)
		f.counters.skillsUsed += 1
		_set_action(f, "buff", 0.45)
		_emit({"type": "skill", "t": time, "side": f.side, "skill": "iron_guard"})
		return
	if in_range and can_attack and f.stamina >= ATTACK_COST * 0.6:
		var kind := "normal"
		if _skill_ready(f, "quick_strike") and VULNERABLE.has(e.action) and f.stamina >= float(sk.quick_strike.staminaCost):
			kind = "quick_strike"
		elif _skill_ready(f, "power_strike") and f.stamina >= float(sk.power_strike.staminaCost) and f.stamina / st.maxStamina > 0.45 and rng.next() < float(strat.powerChance):
			kind = "power_strike"
		_start_attack(f, e, kind)
		return
	if (f.action == "advance" or f.action == "retreat") and elapsed < f.actionDuration:
		if f.action == "advance" and gap <= st.reach * 0.9:
			_set_action(f, "idle", 0)
			return
		var d := dir if f.action == "advance" else -dir
		_move(f, d * st.moveSpeed * (0.75 if f.action == "retreat" else 1.0) * TICK, e)
		return
	if not in_range:
		var outreach: bool = e.spec.stats.reach > st.reach + 6
		var wants_wait: bool = (float(strat.caution) >= 0.5 and not outreach and f.passiveTime < 2.5) or (_fatigued(f) and float(strat.caution) >= 0.25 and gap > e.spec.stats.reach + 12 and f.passiveTime < 3)
		if wants_wait:
			f.passiveTime += TICK
			if f.action != "idle":
				_set_action(f, "idle", 0)
		else:
			f.passiveTime = 0.0
			_set_action(f, "advance", 0.3)
			_move(f, dir * st.moveSpeed * TICK, e)
		return
	var too_close: bool = st.reach > 30 and gap < st.reach * 0.6
	var catch_breath: bool = _fatigued(f) and rng.next() < float(strat.caution) * 0.08
	var back_room: float = (f.x - ARENA_MIN_X) if dir == 1 else (ARENA_MAX_X - f.x)
	if (too_close or catch_breath) and back_room > 12:
		_set_action(f, "retreat", 0.3 if too_close else 0.6)
		_move(f, -dir * st.moveSpeed * 0.75 * TICK, e)
		return
	if f.action != "idle":
		_set_action(f, "idle", 0)


func _move(f: Dictionary, dx: float, e: Dictionary) -> void:
	var nx: float = minf(ARENA_MAX_X, maxf(ARENA_MIN_X, f.x + dx))
	if absf(e.x - nx) < BODY_GAP:
		var s := _sign(e.x - f.x)
		if s == 0:
			s = f.facing
		nx = e.x - s * BODY_GAP
	f.x = minf(ARENA_MAX_X, maxf(ARENA_MIN_X, nx))


func _start_attack(f: Dictionary, e: Dictionary, kind: String) -> void:
	var st: Dictionary = f.spec.stats
	var p: Dictionary = PROFILES[kind]
	var strat := _strategy(f)
	_spend(f, _cost_of(kind))
	var windup: float = p.windup + (0.06 if kind == "normal" and st.reach > 30 else 0.0)
	var dmul := 1.0
	if kind == "power_strike":
		dmul = (1.6 + st.technique * 0.012) + st.powerStrikeBonus
	elif kind == "quick_strike":
		dmul = 0.75 + st.technique * 0.005
	elif kind == "counter":
		dmul = 1.3 + st.technique * 0.008
	f.attack = {"kind": kind, "startedAt": time, "impactAt": time + windup, "windup": windup, "recover": p.recover, "damageMul": dmul, "defendable": p.defendable}
	var fatigue_mul := 1.25 if _fatigued(f) else 1.0
	f.nextAttackAt = time + st.attackInterval * p.intervalMul * float(strat.intervalMul) * fatigue_mul
	f.counters.attacks += 1
	if p.skill != null:
		f.cooldowns[p.skill] = time + float(Data.d.skills[p.skill].cooldown)
		f.counters.skillsUsed += 1
		_emit({"type": "skill", "t": time, "side": f.side, "skill": p.skill})
	_set_action(f, "windup", windup)
	_emit({"type": "attack", "t": time, "side": f.side, "kind": kind, "windup": windup})
	if p.defendable:
		_consider_reaction(e, f)


func _consider_reaction(d: Dictionary, a: Dictionary) -> void:
	if not FREE.has(d.action) or d.reaction != null or a.attack == null:
		return
	var strat := _strategy(d)
	var p_block: float = float(strat.blockChance) * (1.0 if d.spec.stats.hasShield else 0.55)
	var p_dodge: float = float(strat.dodgeChance)
	if a.attack.kind == "power_strike":
		p_block += 0.15
		p_dodge += 0.1
	if _fatigued(d):
		p_block *= 0.5
		p_dodge *= 0.4
	var r := rng.next()
	var impact: float = a.attack.impactAt
	if r < p_block:
		var start := time + 0.08
		d.reaction = {"kind": "block", "startAt": start, "duration": maxf(0.2, impact - start) + 0.25}
	elif r < p_block + p_dodge:
		var start2 := maxf(time + 0.05, impact - 0.2)
		d.reaction = {"kind": "dodge", "startAt": start2, "duration": 0.45}


func _hit_chance(a: Dictionary, d: Dictionary, fatigued: bool, d_exhausted: bool) -> float:
	var c: float = 0.85 + (a.precision - d.precision) * 0.005 + a.hitBonus
	if fatigued:
		c -= 0.05
	if d_exhausted:
		c += 0.1
	return clampf(c, MIN_HIT, MAX_HIT)


func _dodge_chance(d: Dictionary, strat: Dictionary, active: bool) -> float:
	if active:
		return minf(Stats.DODGE_CAP, d.dodgeChance + float(strat.dodgeBonus))
	return minf(Stats.DODGE_CAP, d.dodgeChance * 0.5)


func _block_eff(d: Dictionary, strat: Dictionary, vs_power: bool, pierce: float) -> float:
	var b: float = d.blockPower + float(strat.blockBonus)
	if vs_power:
		b *= 0.6
	b *= 1 - pierce
	return clampf(b, 0, 0.85)


func _damage(a: Dictionary, d: Dictionary, a_strat: Dictionary, dmul: float, variance: float, crit: bool, fatigued: bool, block_eff: float, fortify: float) -> int:
	var dmg: float = a.baseDamage * DAMAGE_PACE
	dmg *= 0.88 + variance * 0.24
	dmg *= dmul * float(a_strat.damageMul) * a.damageMul
	if fatigued:
		dmg *= 0.85
	if crit:
		dmg *= CRIT_MULTIPLIER
	var def := maxf(0.0, d.defense - a.armorPierce)
	dmg *= 1 - minf(0.7, def / (def + 100))
	dmg *= 1 - block_eff
	dmg *= fortify
	dmg *= d.damageTakenMul
	return maxi(1, int(round(dmg)))


func _resolve_impact(a: Dictionary, d: Dictionary) -> void:
	var atk = a.attack
	if atk == null:
		return
	var as_: Dictionary = a.spec.stats
	var ds: Dictionary = d.spec.stats
	var gap := absf(d.x - a.x)
	var fatigued := _fatigued(a)
	var outcome := ""
	var damage := 0
	var crit := false
	var stagger := false
	if gap > as_.reach + 8:
		outcome = "miss"
	elif rng.next() > _hit_chance(as_, ds, fatigued, d.action == "exhausted"):
		outcome = "miss"
	elif atk.defendable and (d.action == "dodge" or FREE.has(d.action)) and rng.next() < _dodge_chance(ds, _strategy(d), d.action == "dodge"):
		outcome = "dodge"
	else:
		var blocking: bool = atk.defendable and d.action == "block"
		var beff := _block_eff(ds, _strategy(d), atk.kind == "power_strike", as_.blockPierce) if blocking else 0.0
		crit = rng.next() < as_.critChance
		damage = _damage(as_, ds, _strategy(a), atk.damageMul, rng.next(), crit, fatigued, beff, d.fortifyMul)
		outcome = "block" if blocking else "hit"
	var dir_ad := _sign(d.x - a.x)
	if dir_ad == 0:
		dir_ad = a.facing
	var counter_key: String = {"hit": "hits", "miss": "misses", "dodge": "dodged", "block": "blocked"}[outcome]
	a.counters[counter_key] += 1
	if damage > 0:
		d.hp = maxf(0.0, d.hp - damage)
		a.counters.damageDealt += damage
		if crit:
			a.counters.crits += 1
		if ds.secondWind and not d.secondWindUsed and d.hp > 0 and d.hp < ds.maxHp * 0.25:
			d.secondWindUsed = true
			var heal := int(round(ds.maxHp * 0.12))
			d.hp = minf(float(ds.maxHp), d.hp + heal)
			_emit({"type": "secondWind", "t": time, "side": d.side, "heal": heal})
	if outcome == "hit":
		stagger = crit or damage >= ds.maxHp * 0.08 or atk.kind == "power_strike"
		if d.action != "windup" or stagger:
			d.attack = null
			d.reaction = null
			_set_action(d, "hitstun", 0.45 if stagger else 0.25)
		_move(d, dir_ad * (10 if stagger else 4), a)
	elif outcome == "block":
		_spend(d, 2 + damage * 0.5)
		_move(d, dir_ad * 3, a)
		if d.stamina <= 0:
			d.reaction = null
			_set_action(d, "exhausted", EXHAUST_DURATION)
			_emit({"type": "exhausted", "t": time, "side": d.side})
	elif outcome == "dodge":
		_move(d, dir_ad * 8, a)
	_emit({"type": "impact", "t": time, "side": a.side, "target": d.side, "kind": atk.kind, "outcome": outcome, "damage": damage, "crit": crit, "stagger": stagger})
	a.attack = null
	_set_action(a, "recover", atk.recover)
	if (outcome == "block" or outcome == "dodge") and d.hp > 0 and d.action != "exhausted" and _skill_ready(d, "counter") and d.stamina >= float(Data.d.skills.counter.staminaCost) and rng.next() < minf(0.75, 0.3 + ds.technique * 0.006):
		d.reaction = null
		_start_attack(d, a, "counter")


func _decision_winner() -> int:
	var a: Dictionary = fighters[0]
	var b: Dictionary = fighters[1]
	var pa: float = a.hp / a.spec.stats.maxHp
	var pb: float = b.hp / b.spec.stats.maxHp
	if absf(pa - pb) > 1e-6:
		return 0 if pa > pb else 1
	return 0 if a.counters.damageDealt >= b.counters.damageDealt else 1


func _check_end() -> void:
	var a: Dictionary = fighters[0]
	var b: Dictionary = fighters[1]
	if a.hp <= 0 or b.hp <= 0:
		var w := _decision_winner() if a.hp <= 0 and b.hp <= 0 else (1 if a.hp <= 0 else 0)
		_finish(w, "ko")
	elif fight_time() >= time_limit:
		_finish(_decision_winner(), "decision")


func _finish(winner: int, reason: String) -> void:
	finished = true
	var w: Dictionary = fighters[winner]
	var l: Dictionary = fighters[1 - winner]
	w.attack = null
	l.attack = null
	w.reaction = null
	l.reaction = null
	_set_action(w, "victory", 0)
	_set_action(l, "defeat", 0)
	result = {"winner": winner, "reason": reason, "duration": fight_time(), "fighters": [_summary(fighters[0]), _summary(fighters[1])]}
	_emit({"type": "end", "t": time, "winner": winner, "reason": reason})


func _summary(f: Dictionary) -> Dictionary:
	return {"name": f.spec.name, "hp": f.hp, "maxHp": f.spec.stats.maxHp, "counters": f.counters.duplicate()}
