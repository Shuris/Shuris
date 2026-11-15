import { champion, CLASS_LABEL } from '@/data/champions';
import type { ChampionClass, Match } from '@/types';

import { byChampion, chronological, matchCsPerMin, mean, summarize } from './aggregate';
import { dec, pct, WEEKDAYS_LONG } from './format';

/**
 * Motor de insights.
 *
 * Cada regra calcula uma estatística sobre as partidas e só gera texto quando
 * (1) a amostra atinge o mínimo exigido e (2) o efeito observado é relevante.
 * Regras que não passam nesses critérios viram itens em `skipped`, exibidos de
 * forma transparente como "amostra insuficiente" — nunca viram conclusões.
 */

export type InsightTone = 'positive' | 'negative' | 'neutral';
export type InsightCategory = 'Campeões' | 'Mental' | 'Horários' | 'Farm' | 'Início de jogo' | 'Estilo' | 'Forma';

export interface Insight {
  id: string;
  category: InsightCategory;
  tone: InsightTone;
  /** Número em destaque (ex.: "64%"). */
  metric: string;
  metricLabel: string;
  text: string;
  /** Sugestão prática derivada do dado. */
  action?: string;
  /** Tamanho da amostra que sustenta a conclusão. */
  sample: number;
  confidence: 'alta' | 'média';
  /** Relevância para ordenar a lista. */
  weight: number;
}

export interface SkippedInsight {
  id: string;
  label: string;
  reason: string;
}

export interface InsightReport {
  insights: Insight[];
  skipped: SkippedInsight[];
}

const SESSION_GAP_MS = 3 * 3_600_000;
const confidence = (n: number, high: number): 'alta' | 'média' => (n >= high ? 'alta' : 'média');
const wr = (list: Match[]) => (list.length ? list.filter((m) => m.win).length / list.length : 0);

export function computeInsights(all: Match[]): InsightReport {
  const matches = chronological(all);
  const insights: Insight[] = [];
  const skipped: SkippedInsight[] = [];
  const overall = summarize(matches);
  const skip = (id: string, label: string, reason: string) => skipped.push({ id, label, reason });

  if (matches.length < 10) {
    skip('geral', 'Análise geral', `São necessárias ao menos 10 partidas (há ${matches.length}).`);
    return { insights, skipped };
  }

  // 1 — Melhor campeão por taxa de vitória
  const champs = byChampion(matches);
  const eligible = champs.filter((c) => c.games >= 10).sort((a, b) => b.winRate - a.winRate);
  if (eligible.length && eligible[0].winRate >= 0.55) {
    const c = eligible[0];
    insights.push({
      id: 'best-champion',
      category: 'Campeões',
      tone: 'positive',
      metric: pct(c.winRate),
      metricLabel: `vitórias com ${champion(c.championId).name}`,
      text: `Sua taxa de vitória com ${champion(c.championId).name} é ${pct(c.winRate)} em ${c.games} partidas — ${Math.round((c.winRate - overall.winRate) * 100)} pontos acima da sua média geral.`,
      action: 'Priorize esse campeão em partidas decisivas.',
      sample: c.games,
      confidence: confidence(c.games, 20),
      weight: 90 + (c.winRate - overall.winRate) * 100,
    });
  } else {
    skip('best-champion', 'Melhor campeão', 'Nenhum campeão com 10+ partidas e taxa de vitória acima de 55%.');
  }

  // 2 — Campeão que mais custa partidas
  const weak = champs.filter((c) => c.games >= 8).sort((a, b) => a.winRate - b.winRate)[0];
  if (weak && weak.winRate <= 0.42) {
    insights.push({
      id: 'weak-champion',
      category: 'Campeões',
      tone: 'negative',
      metric: pct(weak.winRate),
      metricLabel: `vitórias com ${champion(weak.championId).name}`,
      text: `Com ${champion(weak.championId).name} você vence apenas ${pct(weak.winRate)} das ${weak.games} partidas, com KDA ${dec(weak.kda, 2)}.`,
      action: 'Evite essa escolha em filas ranqueadas até evoluir o desempenho em partidas normais.',
      sample: weak.games,
      confidence: confidence(weak.games, 15),
      weight: 70 + (overall.winRate - weak.winRate) * 100,
    });
  } else {
    skip('weak-champion', 'Campeão com pior resultado', 'Nenhum campeão com 8+ partidas e taxa de vitória abaixo de 42%.');
  }

  // 3 — Efeito de sequências de derrotas (tilt) dentro da mesma sessão
  const afterStreak: Match[] = [];
  const others: Match[] = [];
  let run = 0;
  matches.forEach((m, i) => {
    const prev = matches[i - 1];
    if (prev && m.timestamp - (prev.timestamp + prev.durationSec * 1000) > SESSION_GAP_MS) run = 0;
    (run >= 3 ? afterStreak : others).push(m);
    run = m.win ? 0 : run + 1;
  });
  if (afterStreak.length >= 5) {
    const diff = wr(others) - wr(afterStreak);
    if (diff >= 0.1) {
      const kdaDrop = summarize(others).kda - summarize(afterStreak).kda;
      insights.push({
        id: 'tilt',
        category: 'Mental',
        tone: 'negative',
        metric: pct(wr(afterStreak)),
        metricLabel: 'vitórias após 3 derrotas seguidas',
        text: `Seu desempenho cai significativamente após três derrotas consecutivas: ${pct(wr(afterStreak))} de vitórias nessas ${afterStreak.length} partidas, contra ${pct(wr(others))} nas demais${kdaDrop > 0.3 ? `, e o KDA recua ${dec(kdaDrop, 1)} ponto${kdaDrop >= 2 ? 's' : ''}` : ''}.`,
        action: 'Faça uma pausa ao perder três partidas seguidas na mesma sessão.',
        sample: afterStreak.length,
        confidence: confidence(afterStreak.length, 12),
        weight: 85 + diff * 100,
      });
    } else {
      skip('tilt', 'Sequências de derrotas', 'Não há queda relevante de desempenho após derrotas seguidas.');
    }
  } else {
    skip('tilt', 'Sequências de derrotas', `Apenas ${afterStreak.length} partida(s) após 3 derrotas seguidas (mínimo: 5).`);
  }

  // 4 — Período do dia
  const periods = [
    { key: 'madrugada', label: 'de madrugada', from: 0, to: 6 },
    { key: 'manha', label: 'pela manhã', from: 6, to: 12 },
    { key: 'tarde', label: 'no período da tarde', from: 12, to: 18 },
    { key: 'noite', label: 'no período da noite', from: 18, to: 24 },
  ].map((p) => {
    const inside = matches.filter((m) => {
      const h = new Date(m.timestamp).getHours();
      return h >= p.from && h < p.to;
    });
    return { ...p, inside, rest: matches.filter((m) => !inside.includes(m)) };
  });
  const validPeriods = periods.filter((p) => p.inside.length >= 12 && p.rest.length >= 12);
  const bestPeriod = [...validPeriods].sort((a, b) => wr(b.inside) - wr(a.inside))[0];
  if (bestPeriod && wr(bestPeriod.inside) - wr(bestPeriod.rest) >= 0.06) {
    insights.push({
      id: 'best-period',
      category: 'Horários',
      tone: 'positive',
      metric: pct(wr(bestPeriod.inside)),
      metricLabel: `vitórias ${bestPeriod.label}`,
      text: `Você apresenta melhor desempenho jogando ${bestPeriod.label}: ${pct(wr(bestPeriod.inside))} de vitórias em ${bestPeriod.inside.length} partidas, contra ${pct(wr(bestPeriod.rest))} nos demais horários.`,
      action: 'Concentre suas partidas ranqueadas nesse período.',
      sample: bestPeriod.inside.length,
      confidence: confidence(bestPeriod.inside.length, 30),
      weight: 80 + (wr(bestPeriod.inside) - wr(bestPeriod.rest)) * 100,
    });
  } else {
    skip('best-period', 'Melhor período do dia', 'Não há diferença relevante entre períodos com 12+ partidas.');
  }
  const worstPeriod = [...validPeriods].sort((a, b) => wr(a.inside) - wr(b.inside))[0];
  if (worstPeriod && worstPeriod !== bestPeriod && wr(worstPeriod.rest) - wr(worstPeriod.inside) >= 0.1) {
    insights.push({
      id: 'worst-period',
      category: 'Horários',
      tone: 'negative',
      metric: pct(wr(worstPeriod.inside)),
      metricLabel: `vitórias ${worstPeriod.label}`,
      text: `Seu rendimento ${worstPeriod.label} é o mais baixo: ${pct(wr(worstPeriod.inside))} de vitórias em ${worstPeriod.inside.length} partidas.`,
      sample: worstPeriod.inside.length,
      confidence: confidence(worstPeriod.inside.length, 30),
      weight: 55 + (wr(worstPeriod.rest) - wr(worstPeriod.inside)) * 100,
    });
  }

  // 5 — Dia da semana
  const days = WEEKDAYS_LONG.map((label, d) => ({
    label,
    list: matches.filter((m) => new Date(m.timestamp).getDay() === d),
  })).filter((d) => d.list.length >= 12);
  const bestDay = [...days].sort((a, b) => wr(b.list) - wr(a.list))[0];
  if (bestDay && wr(bestDay.list) - overall.winRate >= 0.1) {
    insights.push({
      id: 'best-day',
      category: 'Horários',
      tone: 'positive',
      metric: pct(wr(bestDay.list)),
      metricLabel: `vitórias de ${bestDay.label}`,
      text: `${bestDay.label[0].toUpperCase()}${bestDay.label.slice(1)} é o seu melhor dia: ${pct(wr(bestDay.list))} de vitórias em ${bestDay.list.length} partidas.`,
      sample: bestDay.list.length,
      confidence: confidence(bestDay.list.length, 25),
      weight: 50 + (wr(bestDay.list) - overall.winRate) * 100,
    });
  } else {
    skip('best-day', 'Melhor dia da semana', 'Nenhum dia com 12+ partidas se destaca ao menos 10 pontos da média.');
  }

  // 6 — Farm recente vs média
  const farm = matches.filter((m) => m.position !== 'SUPPORT');
  if (farm.length >= 20) {
    const last = farm.slice(-10);
    const before = farm.slice(0, -10);
    const recent = mean(last.map(matchCsPerMin));
    const base = mean(before.map(matchCsPerMin));
    const change = recent / base - 1;
    if (Math.abs(change) >= 0.04) {
      insights.push({
        id: 'farm-trend',
        category: 'Farm',
        tone: change < 0 ? 'negative' : 'positive',
        metric: dec(recent, 1),
        metricLabel: 'CS/min nas últimas 10',
        text: `Seu CS/min está ${change < 0 ? 'abaixo' : 'acima'} da sua média nas últimas 10 partidas: ${dec(recent, 1)} contra ${dec(base, 1)} nas anteriores (${change < 0 ? '−' : '+'}${Math.abs(Math.round(change * 100))}%).`,
        action: change < 0 ? 'Revise as ondas perdidas entre os minutos 10 e 20.' : undefined,
        sample: 10,
        confidence: 'média',
        weight: 60 + Math.abs(change) * 200,
      });
    } else {
      skip('farm-trend', 'Tendência de farm', 'Seu CS/min recente está dentro de ±4% da sua média.');
    }
  } else {
    skip('farm-trend', 'Tendência de farm', `São necessárias 20 partidas fora do suporte (há ${farm.length}).`);
  }

  // 7 — Primeiro abate
  const fb = matches.filter((m) => m.firstBlood);
  const noFb = matches.filter((m) => !m.firstBlood);
  if (fb.length >= 8 && noFb.length >= 8) {
    const diff = wr(fb) - wr(noFb);
    if (diff >= 0.08) {
      insights.push({
        id: 'first-blood',
        category: 'Início de jogo',
        tone: 'positive',
        metric: pct(wr(fb)),
        metricLabel: 'vitórias com o primeiro abate',
        text: `Você possui uma taxa de vitória de ${pct(wr(fb))} quando consegue a primeira eliminação (${fb.length} partidas), contra ${pct(wr(noFb))} quando não consegue.`,
        action: 'Vale buscar vantagens cedo: seu início de jogo converte em vitórias.',
        sample: fb.length,
        confidence: confidence(fb.length, 25),
        weight: 75 + diff * 100,
      });
    } else {
      skip('first-blood', 'Primeiro abate', 'O primeiro abate não altera sua taxa de vitória de forma relevante.');
    }
  } else {
    skip('first-blood', 'Primeiro abate', `Apenas ${fb.length} partida(s) com o primeiro abate (mínimo: 8).`);
  }

  // 8 — Comparação entre classes de campeões
  const classStats = (Object.keys(CLASS_LABEL) as ChampionClass[])
    .map((cls) => {
      const list = matches.filter((m) => champion(m.championId).classes[0] === cls);
      return { cls, list, kda: summarize(list).kda };
    })
    .filter((c) => c.list.length >= 10)
    .sort((a, b) => b.kda - a.kda);
  if (classStats.length >= 2) {
    const top = classStats[0];
    const bottom = classStats[classStats.length - 1];
    if (top.kda - bottom.kda >= 0.4) {
      insights.push({
        id: 'class-kda',
        category: 'Estilo',
        tone: 'neutral',
        metric: dec(top.kda, 2),
        metricLabel: `KDA com ${CLASS_LABEL[top.cls]}`,
        text: `Seu KDA com ${CLASS_LABEL[top.cls]} (${dec(top.kda, 2)} em ${top.list.length} partidas) é superior ao seu KDA com ${CLASS_LABEL[bottom.cls]} (${dec(bottom.kda, 2)} em ${bottom.list.length}).`,
        sample: top.list.length + bottom.list.length,
        confidence: confidence(Math.min(top.list.length, bottom.list.length), 20),
        weight: 50 + (top.kda - bottom.kda) * 10,
      });
    } else {
      skip('class-kda', 'Classes de campeões', 'Seu KDA é semelhante entre as classes que você joga.');
    }
  } else {
    skip('class-kda', 'Classes de campeões', 'É preciso ter 10+ partidas em pelo menos duas classes.');
  }

  // 9 — Duração das partidas
  const short = matches.filter((m) => m.durationSec < 27 * 60);
  const long = matches.filter((m) => m.durationSec >= 34 * 60);
  if (short.length >= 12 && long.length >= 12) {
    const diff = wr(short) - wr(long);
    if (Math.abs(diff) >= 0.12) {
      const better = diff > 0 ? 'curtas (até 27 min)' : 'longas (34 min ou mais)';
      insights.push({
        id: 'duration',
        category: 'Estilo',
        tone: 'neutral',
        metric: pct(Math.max(wr(short), wr(long))),
        metricLabel: `vitórias em partidas ${diff > 0 ? 'curtas' : 'longas'}`,
        text: `Você rende mais em partidas ${better}: ${pct(wr(short))} de vitórias nas curtas (${short.length}) e ${pct(wr(long))} nas longas (${long.length}).`,
        sample: short.length + long.length,
        confidence: confidence(Math.min(short.length, long.length), 25),
        weight: 45 + Math.abs(diff) * 100,
      });
    } else {
      skip('duration', 'Duração das partidas', 'Sua taxa de vitória é parecida em partidas curtas e longas.');
    }
  } else {
    skip('duration', 'Duração das partidas', 'Poucas partidas curtas ou longas para comparar (mínimo: 12 de cada).');
  }

  // 10 — Forma recente
  if (matches.length >= 30) {
    const last = matches.slice(-15);
    const before = matches.slice(0, -15);
    const diff = wr(last) - wr(before);
    if (Math.abs(diff) >= 0.1) {
      insights.push({
        id: 'form',
        category: 'Forma',
        tone: diff > 0 ? 'positive' : 'negative',
        metric: pct(wr(last)),
        metricLabel: 'vitórias nas últimas 15',
        text: `Sua forma recente está ${diff > 0 ? 'acima' : 'abaixo'} do seu padrão: ${pct(wr(last))} de vitórias nas últimas 15 partidas, contra ${pct(wr(before))} no restante do período.`,
        sample: 15,
        confidence: 'média',
        weight: 65 + Math.abs(diff) * 100,
      });
    } else {
      skip('form', 'Forma recente', 'Suas últimas 15 partidas estão em linha com o restante do período.');
    }
  }

  insights.sort((a, b) => b.weight - a.weight);
  return { insights, skipped };
}
