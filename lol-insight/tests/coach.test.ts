/// <reference types="node" />
/**
 * Testes do treinador (src/coach): Rank Predictor e Academy.
 * Usam perfis de jogador simulados, com resultados controlados.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildCoachReport,
  CATEGORY_IDS,
  diagnose,
  emptyCoachState,
  estimateLpPerGame,
  LESSONS,
  lessonsBySkill,
  predict,
  recordQuizAttempt,
  setGoal,
  setPlanDay,
  SKILL_IDS,
  trainingStreak,
  type CoachState,
} from '@/coach';
import { computeIdentity, softScore } from '@/stats/identity';
import { rankToAbsolute } from '@/stats/rank';
import type { Match, Player, Position, Rank, RankSnapshot } from '@/types';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 15, 20).getTime();
const SILVER_2: Rank = { tier: 'PRATA', division: 2, lp: 40 };

interface Profile {
  games: number;
  /** Taxa de vitória em função da posição da partida no histórico (0 = mais antiga, 1 = mais recente). */
  winRate: (progress: number) => number;
  kills?: number;
  deaths?: number;
  assists?: number;
  csPerMin?: number;
  position?: Position;
  perDay?: number;
  champions?: string[];
  vision?: number;
}

/** Gera um histórico determinístico: as vitórias são distribuídas de forma uniforme conforme a taxa pedida. */
function history(p: Profile): Match[] {
  const out: Match[] = [];
  const perDay = p.perDay ?? 3;
  let acc = 0;
  for (let i = 0; i < p.games; i++) {
    const rate = p.winRate(p.games === 1 ? 1 : i / (p.games - 1));
    acc += rate;
    const win = acc >= 1;
    if (win) acc -= 1;
    const position = p.position ?? 'MID';
    const cs = Math.round((p.csPerMin ?? 7.2) * 30);
    const k = p.kills ?? (win ? 8 : 4);
    const d = p.deaths ?? (win ? 3 : 6);
    const a = p.assists ?? (win ? 8 : 5);
    const daysAgo = (p.games - 1 - i) / perDay;
    const team = (isPlayer: boolean, t: 'BLUE' | 'RED', pos: Position, csv: number) => ({
      name: isPlayer ? 'Teste' : 'Outro', championId: 'Ahri', team: t, position: pos, kills: isPlayer ? k : 3, deaths: isPlayer ? d : 4, assists: isPlayer ? a : 4,
      cs: csv, gold: 11_000, damage: isPlayer ? 22_000 : 17_000, isPlayer,
    });
    out.push({
      id: `P_${i}`,
      timestamp: NOW - daysAgo * DAY - 3_600_000,
      durationSec: 1800,
      queue: 'SOLO',
      win,
      championId: p.champions ? p.champions[i % p.champions.length] : 'Zoe',
      position,
      opponentChampionId: 'Ahri',
      kills: k,
      deaths: d,
      assists: a,
      cs,
      gold: 12_000,
      damageDealt: 22_000,
      damageTaken: 16_000,
      visionScore: Math.round((p.vision ?? 0.75) * 30),
      teamKills: Math.round((k + a) / 0.56),
      firstBlood: false,
      items: [],
      trinket: 0,
      runes: { keystone: '', primaryTree: '', primary: [], secondaryTree: '', secondary: [], shards: [] },
      skillOrder: [],
      participants: [team(true, 'BLUE', position, cs), team(false, 'RED', position, 200)],
      objectives: { dragons: 2, barons: 1, heralds: 1, towers: 6, enemyDragons: 2, enemyBarons: 0, enemyTowers: 5, playerParticipations: 2 },
      timeline: [],
      detailsLoaded: false,
    });
  }
  return out;
}

const forecast = (matches: Match[], rank: Rank | null = SILVER_2, extra: { rankHistory?: RankSnapshot[]; goal?: Rank } = {}) =>
  predict({ rank, matches, rankHistory: extra.rankHistory ?? [], asOf: NOW, goal: extra.goal ?? null });
const START = rankToAbsolute(SILVER_2);
const flat = (rate: number) => () => rate;

// ---------------------------------------------------------------------------------
// Rank Predictor — sete perfis
// ---------------------------------------------------------------------------------

test('perfil 1 — 70% de vitórias: projeção de subida em todos os horizontes', () => {
  const { prediction: p } = forecast(history({ games: 60, winRate: flat(0.7) }));
  assert.equal(p.status, 'ok');
  assert.ok(p.inputs!.smoothedWinRate > 0.6 && p.inputs!.smoothedWinRate < 0.7, 'a suavização puxa 70% um pouco para baixo, sem anular');
  for (const h of p.horizons) assert.ok(h.central > START, `${h.days}d deve projetar subida`);
  assert.ok(p.horizons[2].central > p.horizons[1].central && p.horizons[1].central > p.horizons[0].central, 'mais tempo, mais LP');
  assert.ok(p.horizons[2].low > START, 'até o limite inferior fica acima do elo atual');
});

test('perfil 2 — 50% de vitórias: projeção perto do elo atual, com o elo atual dentro do intervalo', () => {
  const { prediction: p } = forecast(history({ games: 60, winRate: flat(0.5) }));
  const h = p.horizons[2];
  assert.ok(Math.abs(h.central - START) <= 60, `central a ${h.central - START} LP do atual`);
  assert.ok(h.low < START && h.high > START);
  assert.ok(Math.abs(p.inputs!.smoothedWinRate - 0.5) < 0.02);
});

test('perfil 3 — 35% de vitórias: projeção de queda', () => {
  const { prediction: p } = forecast(history({ games: 60, winRate: flat(0.35) }));
  for (const h of p.horizons) assert.ok(h.central < START, `${h.days}d deve projetar queda`);
  assert.ok(p.horizons[2].high < START + 60, 'nem o limite superior indica subida relevante');
  assert.ok(p.horizons[2].low >= 0, 'LP nunca fica negativo');
});

test('perfil 4 — poucas partidas: sem previsão e com explicação, nunca números inventados', () => {
  const { prediction: p, goal } = forecast(history({ games: 6, winRate: flat(0.8) }), SILVER_2, { goal: { tier: 'OURO', division: 4, lp: 0 } });
  assert.equal(p.status, 'insufficient');
  assert.deepEqual(p.horizons, []);
  assert.deepEqual(p.path, []);
  assert.match(p.message!, /ao menos 10 partidas ranqueadas/);
  assert.equal(goal, null);
});

test('perfis 5 e 6 — desempenho em queda e em evolução: as partidas recentes pesam mais', () => {
  const falling = history({ games: 60, winRate: (t) => (t < 0.66 ? 0.65 : 0.3) });
  const rising = history({ games: 60, winRate: (t) => (t < 0.66 ? 0.3 : 0.65) });
  const wr = (l: Match[]) => l.filter((m) => m.win).length / l.length;
  const f = forecast(falling).prediction;
  const r = forecast(rising).prediction;
  // Em queda: taxa geral acima de 50%, mas a ponderada fica abaixo.
  assert.ok(wr(falling) > 0.5 && f.inputs!.weightedWinRate < wr(falling) - 0.05);
  assert.ok(f.horizons[2].central < START, 'jogador em queda: projeção de queda apesar do histórico positivo');
  // Em evolução: taxa geral abaixo de 50%, mas a ponderada fica acima.
  assert.ok(wr(rising) < 0.5 && r.inputs!.weightedWinRate > wr(rising) + 0.05);
  assert.ok(r.horizons[2].central > START, 'jogador em evolução: projeção de subida apesar do histórico negativo');
  assert.ok(r.horizons[2].central > f.horizons[2].central);
});

test('perfil 7 — KDA alto com poucas vitórias: o KDA não engana a previsão', () => {
  const high = history({ games: 60, winRate: flat(0.4), kills: 10, deaths: 2, assists: 9 });
  const low = history({ games: 60, winRate: flat(0.4), kills: 3, deaths: 7, assists: 4 });
  const h = forecast(high).prediction;
  const l = forecast(low).prediction;
  assert.ok(h.horizons[2].central < START, 'com 40% de vitórias a projeção é de queda, mesmo com KDA 9,5');
  assert.ok(Math.abs(h.inputs!.trendAdjustment) <= 0.015, 'indicadores auxiliares movem a taxa em no máximo 1,5 p.p.');
  assert.ok(Math.abs(h.inputs!.smoothedWinRate - l.inputs!.smoothedWinRate) <= 0.03, 'KDA constante não altera a taxa usada');
  // E o diagnóstico não aponta mortes em excesso para quem morre pouco.
  assert.notEqual(diagnose(high, NOW).skills.find((s) => s.skill === 'LANE')!.status, 'weakness');
});

// ---------------------------------------------------------------------------------
// Rank Predictor — propriedades do modelo
// ---------------------------------------------------------------------------------

test('cenários: conservador ≤ realista ≤ otimista, com taxa, partidas e explicação', () => {
  const { prediction: p } = forecast(history({ games: 50, winRate: flat(0.55) }));
  for (const h of p.horizons) {
    const [c, r, o] = h.scenarios;
    assert.deepEqual([c.key, r.key, o.key], ['conservative', 'realistic', 'optimistic']);
    assert.ok(c.projectedAbs <= r.projectedAbs && r.projectedAbs <= o.projectedAbs);
    assert.ok(c.winRate < r.winRate && r.winRate < o.winRate);
    assert.ok(c.games <= r.games && r.games <= o.games);
    assert.ok(h.low <= h.central && h.central <= h.high);
    for (const s of h.scenarios) {
      assert.ok(s.explanation.length >= 4);
      assert.equal(s.currentAbs, START);
      assert.equal(s.lpChange, s.projectedAbs - START);
    }
  }
  assert.equal(p.path[0].p50, START);
  assert.equal(p.path.at(-1)!.day, 30);
});

test('a projeção central confere com a conta direta: partidas × (p × ganho − (1 − p) × perda)', () => {
  const { prediction: p } = forecast(history({ games: 80, winRate: flat(0.6) }));
  const i = p.inputs!;
  const games = (i.gamesPerWeek * 30) / 7;
  const expected = games * (i.smoothedWinRate * i.lpGain - (1 - i.smoothedWinRate) * i.lpLoss);
  assert.ok(Math.abs(p.horizons[2].central - START - expected) < 45, `simulação ${p.horizons[2].central - START} vs conta ${Math.round(expected)}`);
});

test('determinismo: os mesmos dados geram exatamente a mesma previsão', () => {
  const m = history({ games: 40, winRate: flat(0.52) });
  assert.deepEqual(forecast(m).prediction, forecast(m).prediction);
});

test('volume: quem joga mais tem projeção de mudança maior e mais partidas estimadas', () => {
  const few = forecast(history({ games: 40, winRate: flat(0.6), perDay: 1 })).prediction;
  const many = forecast(history({ games: 40, winRate: flat(0.6), perDay: 4 })).prediction;
  assert.ok(many.inputs!.gamesPerWeek > few.inputs!.gamesPerWeek * 2);
  assert.ok(many.horizons[2].expectedGames > few.horizons[2].expectedGames);
  assert.ok(many.horizons[2].central > few.horizons[2].central);
});

test('janelas de 10, 20, 50 e 100 partidas: só aparecem quando há partidas suficientes', () => {
  const { prediction: p } = forecast(history({ games: 30, winRate: flat(0.5) }));
  assert.deepEqual(p.inputs!.winRates.map((w) => [w.window, w.winRate === null]), [[10, false], [20, false], [50, true], [100, true]]);
});

test('conta sem elo e jogador inativo: sem previsão, com o motivo', () => {
  assert.equal(forecast(history({ games: 40, winRate: flat(0.5) }), null).prediction.status, 'unranked');
  const old = history({ games: 40, winRate: flat(0.5) }).map((m) => ({ ...m, timestamp: m.timestamp - 60 * DAY }));
  const p = forecast(old).prediction;
  assert.equal(p.status, 'insufficient');
  assert.match(p.message!, /últimos 28 dias/);
});

test('confiança: cai com pouca amostra e sem histórico de LP; o texto nunca cita MMR como conhecido', () => {
  const small = forecast(history({ games: 12, winRate: flat(0.6) })).prediction;
  const big = forecast(history({ games: 90, winRate: flat(0.6) })).prediction;
  assert.ok(small.confidence!.score < big.confidence!.score);
  assert.equal(small.confidence!.level, 'baixa');
  assert.equal(small.inputs!.lpSource, 'default');
  assert.match(small.inputs!.lpSourceText, /não informa o MMR/);
});

test('LP por partida: medido nos snapshots quando existem, sem presumir ganho igual à perda', () => {
  const snap = (t: number, lp: number, wins: number, losses: number): RankSnapshot => ({ t, queue: 'SOLO', rank: { tier: 'PRATA', division: 2, lp }, wins, losses });
  // +24 por vitória, −16 por derrota
  const history2 = [snap(1, 10, 10, 10), snap(2, 34, 11, 10), snap(3, 58, 12, 10), snap(4, 42, 12, 11), snap(5, 26, 12, 12), snap(6, 50, 13, 12), snap(7, 34, 13, 13), snap(8, 58, 14, 13)];
  const est = estimateLpPerGame([], history2);
  assert.equal(est.source, 'observed');
  assert.equal(Math.round(est.gain), 24);
  assert.equal(Math.round(est.loss), 16);
  // Intervalo com 2 vitórias e 1 derrota (+32): usa o ganho conhecido para isolar a perda.
  const mixed = estimateLpPerGame([], [snap(1, 10, 10, 10), snap(2, 34, 11, 10), snap(3, 58, 12, 10), snap(4, 82, 13, 10), snap(5, 14, 15, 11)].map((s, i) => (i === 4 ? { ...s, rank: { tier: 'PRATA', division: 1, lp: 14 } } : s)));
  assert.equal(mixed.source, 'default', 'uma única derrota observada não basta para medir a perda');
  // Sem snapshots: valor neutro e sinalizado.
  const none = estimateLpPerGame([], []);
  assert.deepEqual([none.source, none.gain, none.loss], ['default', 20, 20]);
  // Com ganho maior que a perda, 50% de vitórias já sobe.
  const p = forecast(history({ games: 60, winRate: flat(0.5) }), SILVER_2, { rankHistory: history2 }).prediction;
  assert.equal(p.inputs!.lpSource, 'observed');
  assert.ok(p.horizons[2].central > START + 40);
});

test('meta de elo: distância, partidas necessárias e taxa de vitória exigida', () => {
  const gold4: Rank = { tier: 'OURO', division: 4, lp: 0 };
  const { goal, prediction } = forecast(history({ games: 60, winRate: flat(0.58) }), SILVER_2, { goal: gold4 });
  assert.ok(goal);
  assert.equal(goal.distance, rankToAbsolute(gold4) - START); // 160 LP
  assert.equal(goal.distance, 160);
  const i = prediction.inputs!;
  const perGame = i.smoothedWinRate * i.lpGain - (1 - i.smoothedWinRate) * i.lpLoss;
  assert.equal(goal.gamesNeeded, Math.ceil(160 / perGame));
  // Taxa exigida em 100 partidas: (160/100 + 20) / 40 = 54%
  const in100 = goal.requiredWinRates.find((r) => r.games === 100)!;
  assert.ok(Math.abs(in100.winRate - 0.54) < 1e-9);
  assert.ok(goal.probability30 > 0 && goal.probability30 <= 1);

  // Com 45% de vitórias e LP neutro a tendência não leva à meta.
  const stuck = forecast(history({ games: 60, winRate: flat(0.45) }), SILVER_2, { goal: gold4 }).goal!;
  assert.equal(stuck.gamesNeeded, null);
  assert.match(stuck.summary.join(' '), /exige melhorar a taxa de vitória/);

  // Meta já atingida.
  const done = forecast(history({ games: 60, winRate: flat(0.5) }), SILVER_2, { goal: { tier: 'BRONZE', division: 1, lp: 0 } }).goal!;
  assert.deepEqual([done.reached, done.distance, done.probability30], [true, 0, 1]);
});

// ---------------------------------------------------------------------------------
// Academy — conteúdo
// ---------------------------------------------------------------------------------

test('conteúdo: pelo menos 20 aulas completas, em todas as categorias e habilidades', () => {
  assert.ok(LESSONS.length >= 20, `${LESSONS.length} aulas`);
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, LESSONS.length);
  for (const c of CATEGORY_IDS) assert.ok(LESSONS.filter((l) => l.category === c).length >= 4, c);
  for (const s of SKILL_IDS) assert.ok(lessonsBySkill(s).length >= 1, s);
  for (const l of LESSONS) {
    assert.ok(l.objective.length > 40, l.id);
    assert.ok(l.theory.length >= 3 && l.theory.every((t) => t.text.length > 150), `${l.id}: teoria`);
    assert.ok(l.examples.length >= 2 && l.mistakes.length >= 3 && l.apply.length >= 3, `${l.id}: seções`);
    assert.ok(l.exercise.steps.length >= 3 && l.exercise.success.length > 20, `${l.id}: exercício`);
    assert.ok(l.quiz.length >= 3, `${l.id}: teste`);
    for (const q of l.quiz) {
      assert.ok(q.options.length >= 3 && q.correct >= 0 && q.correct < q.options.length && q.explanation.length > 20, `${l.id}: ${q.question}`);
      assert.equal(new Set(q.options).size, q.options.length);
    }
  }
});

// ---------------------------------------------------------------------------------
// Academy — diagnóstico e recomendações
// ---------------------------------------------------------------------------------

const player = (rank: Rank | null = SILVER_2): Player => ({ id: 'p', gameName: 'Teste', tagLine: 'BR1', region: 'BR', level: 100, profileIconId: 1, rank, seasonHistory: [] });
const report = (matches: Match[], state: CoachState = emptyCoachState(), now = NOW) =>
  buildCoachReport({ player: player(), matches, rankHistory: [], source: 'demo', asOf: NOW, now }, state);

test('farm baixo: diagnóstico aponta farm, recomenda aulas de farm e monta o plano em torno disso', () => {
  const { report: r } = report(history({ games: 40, winRate: flat(0.5), csPerMin: 5.0 }));
  const farm = r.diagnosis.skills.find((s) => s.skill === 'FARM')!;
  assert.equal(farm.status, 'weakness');
  assert.equal(r.diagnosis.weaknesses[0], 'FARM');
  assert.match(farm.evidence, /5,0 CS\/min em 40 partidas/);
  assert.equal(r.academy.recommended[0].lessonId, 'f-last-hit');
  assert.equal(r.academy.recommended[0].skill, 'FARM');
  assert.equal(r.plan!.focus, 'FARM');
  assert.equal(r.plan!.title, 'Semana 1 — Melhorando o farm');
  assert.equal(r.plan!.days.length, 7);
  assert.deepEqual(r.plan!.days.map((d) => d.kind), ['lesson', 'exercise', 'lesson', 'apply', 'review', 'exercise', 'evaluate']);
  assert.equal(r.plan!.days[0].lessonId, 'f-last-hit');
  assert.equal(r.plan!.baselineDisplay, '5,0 CS/min');
  assert.equal(r.plan!.targetDisplay, '5,4 CS/min');
});

test('referência por posição e por elo: o mesmo CS pode ser fraco no Diamante e adequado na Prata', () => {
  const farm = (m: Match[], rank: Rank) => diagnose(m, NOW, rank).skills.find((s) => s.skill === 'FARM')!;
  const diamond: Rank = { tier: 'DIAMANTE', division: 4, lp: 0 };
  const mid = history({ games: 30, winRate: flat(0.5), csPerMin: 5.6 });
  assert.equal(farm(mid, diamond).status, 'weakness');
  assert.notEqual(farm(mid, SILVER_2).status, 'weakness');
  assert.match(farm(mid, SILVER_2).evidence, /referência para o seu elo/);
  // Na selva a referência é menor: o mesmo número não é ponto fraco nem no Diamante.
  assert.notEqual(farm(history({ games: 30, winRate: flat(0.5), csPerMin: 5.6, position: 'JUNGLE' }), diamond).status, 'weakness');
  // Suporte não é avaliado por farm.
  assert.equal(farm(history({ games: 30, winRate: flat(0.5), csPerMin: 1.1, position: 'SUPPORT' }), diamond).status, 'insufficient');
});

test('escala das notas: diferenças moderadas não zeram nem estouram a nota', () => {
  // Jogador mediano de Prata: farm 15% abaixo da referência do elo, mais mortes e menos participação.
  const average = history({ games: 30, winRate: flat(0.48), csPerMin: 4.9, deaths: 7, kills: 4, assists: 5 }).map((m) => ({ ...m, teamKills: 20 }));
  const d = diagnose(average, NOW, SILVER_2);
  const practice = (skill: string) => d.skills.find((s) => s.skill === skill)!.practice!;
  for (const skill of ['FARM', 'LANE', 'TEAMFIGHT', 'VISION']) {
    assert.ok(practice(skill) >= 10 && practice(skill) <= 90, `${skill}: ${practice(skill)}`);
  }
  assert.ok(practice('FARM') > 25 && practice('FARM') < 45, `farm 15% abaixo fica em ${practice('FARM')}`);
  const id = computeIdentity(average, SILVER_2);
  // (Consistência e Impacto ficam de fora: o histórico sintético tem KDA idêntico e só dois participantes.)
  const checked = id.traits.filter((t) => ['aggression', 'farm', 'teamfight', 'vision', 'survival'].includes(t.key));
  assert.ok(checked.every((t) => t.score >= 10 && t.score <= 90), checked.map((t) => `${t.axis} ${t.score}`).join(', '));
  // Só um desempenho realmente extremo chega perto dos limites.
  assert.ok(softScore(0.2) <= 8 && softScore(1) === 50 && softScore(0.9) === 40 && softScore(1.3) === 77);
});

test('mortes em excesso, pouca visão e pool disperso geram as recomendações correspondentes', () => {
  const deaths = report(history({ games: 30, winRate: flat(0.5), deaths: 9 })).report;
  assert.equal(deaths.diagnosis.weaknesses[0], 'LANE');
  assert.ok(lessonsBySkill('LANE').some((l) => l.id === deaths.academy.recommended[0].lessonId));

  const vision = report(history({ games: 30, winRate: flat(0.5), vision: 0.3 })).report;
  assert.ok(vision.diagnosis.weaknesses.includes('VISION'));
  assert.ok(vision.academy.recommended.some((x) => x.lessonId === 'f-visao'));

  const pool = report(history({ games: 40, winRate: flat(0.5), champions: ['Zoe', 'Ahri', 'Syndra', 'Orianna', 'Leblanc', 'Viktor', 'Yasuo', 'Akali'] })).report;
  assert.ok(pool.diagnosis.weaknesses.includes('POOL'));
  assert.ok(pool.academy.recommended.some((x) => x.lessonId === 't-consistencia'));
});

test('comparação consigo mesmo: queda recente de farm é sinalizada mesmo perto da referência', () => {
  const base = history({ games: 40, winRate: flat(0.5), csPerMin: 7.4 });
  const dropped = base.map((m, i) => (i >= 30 ? { ...m, cs: Math.round(6.4 * 30), participants: m.participants.map((p) => (p.isPlayer ? { ...p, cs: Math.round(6.4 * 30) } : p)) } : m));
  const farm = diagnose(dropped, NOW).skills.find((s) => s.skill === 'FARM')!;
  assert.equal(farm.trend, 'down');
  assert.match(farm.evidence, /Caiu nas últimas 10 partidas/);
});

test('amostra pequena: nenhum ponto fraco é declarado e as aulas sugeridas são a trilha geral', () => {
  const { report: r } = report(history({ games: 6, winRate: flat(0.2), csPerMin: 3, deaths: 12 }));
  assert.equal(r.diagnosis.enough, false);
  assert.deepEqual(r.diagnosis.weaknesses, []);
  assert.ok(r.diagnosis.skills.every((s) => s.status === 'insufficient' && s.practice === null));
  assert.equal(r.academy.recommended[0].lessonId, LESSONS[0].id);
  assert.match(r.academy.recommended[0].reason, /não há partidas suficientes/);
});

// ---------------------------------------------------------------------------------
// Academy — progresso, testes e plano
// ---------------------------------------------------------------------------------

test('teste de conhecimento: registra acertos, erros e tempo; a aula conclui com 60% ou mais', () => {
  const lesson = LESSONS.find((l) => l.id === 'f-last-hit')!;
  const right = lesson.quiz.map((q) => q.correct);
  const wrong = lesson.quiz.map((q) => (q.correct + 1) % q.options.length);

  const fail = recordQuizAttempt(emptyCoachState(), lesson.id, wrong, 95, NOW);
  assert.deepEqual(fail.result, { correct: 0, total: 3, score: 0, passed: false });
  assert.equal(fail.state.lessons[lesson.id].completedAt, null);

  const pass = recordQuizAttempt(fail.state, lesson.id, [right[0], right[1], wrong[2]], 80, NOW + 60_000);
  assert.equal(pass.result.correct, 2);
  assert.equal(pass.result.passed, true);
  const progress = pass.state.lessons[lesson.id];
  assert.equal(progress.completedAt, NOW + 60_000);
  assert.equal(progress.attempts.length, 2);
  assert.deepEqual(progress.attempts.map((a) => [a.correct, a.total, a.durationSec]), [[0, 3, 95], [2, 3, 80]]);
  assert.ok(Math.abs(progress.bestScore - 2 / 3) < 1e-9);
  assert.throws(() => recordQuizAttempt(emptyCoachState(), 'nao-existe', [], 1, NOW));
});

test('teoria e prática são medidas separadas: acertar o teste não muda a nota prática', () => {
  const matches = history({ games: 40, winRate: flat(0.5), csPerMin: 5.0 });
  const before = report(matches).report.academy.mastery.find((m) => m.skill === 'FARM')!;
  assert.equal(before.theory, null);
  const lesson = LESSONS.find((l) => l.id === 'f-last-hit')!;
  const { state } = recordQuizAttempt(emptyCoachState(), lesson.id, lesson.quiz.map((q) => q.correct), 60, NOW);
  const after = report(matches, state).report.academy.mastery.find((m) => m.skill === 'FARM')!;
  assert.ok(after.theory! > 0, 'a teoria sobe com o teste');
  assert.equal(after.practice, before.practice, 'a prática só muda com partidas novas');
  assert.equal(after.lessonsDone, 1);
  assert.match(after.practiceChange!.text, /são necessárias 5 para medir a evolução prática/);
});

test('ciclo completo: aula concluída → partidas novas melhores → prática sobe, plano avalia e previsão recalcula', () => {
  const weak = history({ games: 40, winRate: flat(0.45), csPerMin: 5.0 });
  let state = report(weak).state;
  const lesson = LESSONS.find((l) => l.id === 'f-last-hit')!;
  state = recordQuizAttempt(state, lesson.id, lesson.quiz.map((q) => q.correct), 70, NOW).state;
  const first = report(weak, state);
  assert.equal(first.report.plan!.days[0].done, true, 'o dia da aula é marcado sozinho');
  assert.equal(first.report.plan!.evaluation!.verdict, 'insufficient');
  assert.equal(first.report.predictionHistory.length, 1);

  // Dez partidas novas, com farm melhor e mais vitórias.
  const later = NOW + 5 * DAY;
  const fresh = history({ games: 10, winRate: flat(0.7), csPerMin: 6.6 }).map((m, i) => ({ ...m, id: `N_${i}`, timestamp: NOW + (i + 1) * 0.4 * DAY }));
  const all = [...weak, ...fresh];
  const second = buildCoachReport({ player: player({ tier: 'PRATA', division: 2, lp: 75 }), matches: all, rankHistory: [], source: 'demo', asOf: later, now: later }, first.state);

  const farm = second.report.academy.mastery.find((m) => m.skill === 'FARM')!;
  assert.equal(farm.practiceChange!.improved, true);
  assert.match(farm.practiceChange!.text, /5,0 CS\/min → 6,6 CS\/min \(10 partidas\)/);
  assert.equal(second.report.plan!.evaluation!.verdict, 'improved');
  assert.match(second.report.plan!.evaluation!.text, /de 5,0 CS\/min para 6,6 CS\/min em 10 partidas novas/);
  assert.equal(second.report.predictionHistory.length, 2, 'nova previsão registrada com os dados novos');
  assert.ok(second.report.prediction.inputs!.smoothedWinRate > first.report.prediction.inputs!.smoothedWinRate);
  assert.ok(second.state.diagnoses.length >= 1);
});

test('plano semanal: renova após 7 dias, arquiva o anterior e não repete o foco sem necessidade', () => {
  // Dois pontos fracos: farm e visão.
  const matches = history({ games: 40, winRate: flat(0.5), csPerMin: 5.0, vision: 0.3 });
  const week1 = report(matches);
  const focus1 = week1.report.plan!.focus;
  assert.ok(week1.report.diagnosis.weaknesses.length >= 2);

  const same = report(matches, week1.state, NOW + 3 * DAY);
  assert.equal(same.report.plan!.id, week1.report.plan!.id, 'dentro da semana o plano não muda');

  const week2 = report(matches, week1.state, NOW + 8 * DAY);
  assert.notEqual(week2.report.plan!.id, week1.report.plan!.id);
  assert.equal(week2.report.plan!.sequence, 2);
  assert.notEqual(week2.report.plan!.focus, focus1, 'o segundo ponto fraco assume o foco');
  assert.equal(week2.report.pastPlans.length, 1);
  assert.equal(week2.report.pastPlans[0].focus, focus1);
});

test('dias do plano e sequência de treino', () => {
  const base = report(history({ games: 30, winRate: flat(0.5) })).state;
  const marked = setPlanDay(base, 4, true, NOW);
  assert.equal(marked.plan!.days[3].done, true);
  assert.equal(setPlanDay(marked, 4, false, NOW).plan!.days[3].done, false);

  const key = (offset: number) => {
    const d = new Date(NOW - offset * DAY);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  assert.equal(trainingStreak([], NOW), 0);
  assert.equal(trainingStreak([key(0), key(1), key(2)], NOW), 3);
  assert.equal(trainingStreak([key(1), key(2)], NOW), 2, 'hoje ainda sem treino: a sequência de ontem continua valendo');
  assert.equal(trainingStreak([key(0), key(2), key(3)], NOW), 1, 'um dia sem treino interrompe a sequência');
  assert.equal(report(history({ games: 30, winRate: flat(0.5) }), marked).report.academy.streakDays, 1);
});

test('meta de elo no relatório: obstáculos ligados às aulas da Academy', () => {
  const state = setGoal(emptyCoachState(), { tier: 'OURO', division: 4, lp: 0 }, NOW);
  const { report: r } = report(history({ games: 40, winRate: flat(0.5), csPerMin: 5.0 }), state);
  assert.ok(r.goal);
  assert.equal(r.goal.obstacles[0].skill, 'FARM');
  assert.ok(r.goal.obstacles[0].lessonIds.includes('f-last-hit'));
  assert.ok(r.academy.objectives.some((o) => o.id === 'rank' && /Ouro IV/.test(o.title)));
  assert.equal(report(history({ games: 40, winRate: flat(0.5) }), setGoal(state, null, NOW)).report.goal, null);
});
