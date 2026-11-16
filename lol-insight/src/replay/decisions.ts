import { CHALLENGES } from '@/challenge/bank';
import { champion } from '@/data/champions';
import { ZONE_LABEL, zoneOf } from '@/stats/matchReport';
import type { Match, MatchAnalysis } from '@/types';

/**
 * Desafios de decisão a partir dos EVENTOS REAIS de uma partida (linha do
 * tempo da Match-V5): o jogador escolhe o que faria naquele momento e depois
 * compara com o que de fato aconteceu. Não há leitura de replay aqui: só os
 * eventos que a Riot informa.
 */
export interface DecisionMoment {
  id: string;
  minute: number;
  title: string;
  situation: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  /** O que aconteceu na partida, com os dados da linha do tempo. */
  happened: string;
  lessonId?: string;
  /** false = cenário didático (sem evento real). */
  real: boolean;
}

const m = (x: number) => Math.floor(x);

/** Embaralha as alternativas de forma determinística (a resposta certa não fica sempre no mesmo lugar). */
function shuffle(d: DecisionMoment, salt: string): DecisionMoment {
  let seed = [...`${salt}:${d.id}`].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const idx = d.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const j = seed % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return { ...d, options: idx.map((i) => d.options[i]), answer: idx.indexOf(d.answer) };
}

export function decisionMoments(match: Match, analysis: MatchAnalysis | null, max = 4): DecisionMoment[] {
  const out: DecisionMoment[] = [];
  const enemyObj = match.timeline.filter((e) => (e.kind === 'DRAGON' || e.kind === 'BARON' || e.kind === 'HERALD') && !e.positive);
  const objName = (k: string) => (k === 'DRAGON' ? 'o Dragão' : k === 'BARON' ? 'o Barão' : 'o Arauto');
  if (analysis) {
    for (const d of analysis.deaths) {
      if (out.length >= max) break;
      const zone = ZONE_LABEL[zoneOf(d, analysis.playerTeam)];
      const obj = enemyObj.find((e) => e.minute - d.minute >= 0 && e.minute - d.minute <= 2);
      const killer = d.killerChampionId ? champion(d.killerChampionId).name : 'um inimigo';
      if (obj) {
        out.push({
          id: `obj-${m(d.minute)}`,
          minute: d.minute,
          title: `Minuto ${m(d.minute)}: objetivo chegando`,
          situation: `Faltam poucos instantes para ${objName(obj.kind)} e você está na região: ${zone}. A sua equipe ainda está se aproximando.`,
          question: 'O que fazer nos próximos segundos?',
          options: ['Avançar sozinho para buscar informação', 'Agrupar com a equipe perto do objetivo, com visão no caminho', 'Ir farmar a rota do outro lado', 'Iniciar a luta antes da equipe chegar'],
          answer: 1,
          explanation: 'Perto de um objetivo, morrer custa o próprio objetivo. Chegar junto da equipe, com visão, permite disputar com números iguais.',
          happened: `Você foi abatido por ${killer}${d.enemiesInvolved > 1 ? ` com mais ${d.enemiesInvolved - 1}` : ''} em: ${zone}, aos ${m(d.minute)} min, e a equipe inimiga garantiu ${objName(obj.kind)} aos ${obj.minute} min.`,
          lessonId: obj.kind === 'BARON' ? 'm-arauto-barao' : 'm-dragoes',
          real: true,
        });
      } else if (d.enemiesInvolved >= 3) {
        out.push({
          id: `outnumbered-${m(d.minute)}`,
          minute: d.minute,
          title: `Minuto ${m(d.minute)}: inimigos aparecem`,
          situation: `Você está em: ${zone}. Vários inimigos aparecem perto de você e os seus aliados estão longe.`,
          question: 'Qual é a melhor reação?',
          options: ['Lutar para ganhar tempo', 'Recuar imediatamente em direção à equipe ou à torre', 'Usar todas as habilidades no alvo mais próximo', 'Esperar para ver o que eles fazem'],
          answer: 1,
          explanation: 'Em desvantagem numérica, a decisão é sobreviver. Uma morte nessas condições dá ouro ao inimigo e abre o mapa para objetivos.',
          happened: `Aos ${m(d.minute)} min, ${d.enemiesInvolved} inimigos participaram do seu abate em: ${zone}.`,
          lessonId: d.minute >= 15 ? 'c-posicionamento-tf' : 'f-posicionamento',
          real: true,
        });
      } else if (zone === ZONE_LABEL.RIVER || zone === ZONE_LABEL.ENEMY_JUNGLE) {
        out.push({
          id: `exposed-${m(d.minute)}`,
          minute: d.minute,
          title: `Minuto ${m(d.minute)}: sem visão`,
          situation: `Você está entrando em: ${zone}. Não há sentinelas suas por perto e parte dos inimigos não aparece no mapa.`,
          question: 'O que fazer antes de seguir?',
          options: ['Seguir em frente rápido', 'Colocar visão ou esperar um aliado antes de avançar', 'Ir por um caminho ainda mais fundo', 'Usar o Flash para chegar mais rápido'],
          answer: 1,
          explanation: 'Entrar sem informação numa área de risco é a forma mais comum de ser pego. Visão primeiro, avanço depois.',
          happened: `Você foi abatido por ${killer} em: ${zone}, aos ${m(d.minute)} min.`,
          lessonId: 'f-visao',
          real: true,
        });
      }
    }
    const peak = analysis.frames.reduce((best, f) => (f.goldDiff > best.goldDiff ? f : best), analysis.frames[0] ?? { minute: 0, goldDiff: 0 });
    if (out.length < max && peak && peak.goldDiff >= 1000) {
      const end = analysis.frames[analysis.frames.length - 1];
      out.push({
        id: `lead-${peak.minute}`,
        minute: peak.minute,
        title: `Minuto ${peak.minute}: vantagem na rota`,
        situation: `Você está ${peak.goldDiff} de ouro à frente de ${champion(match.opponentChampionId).name}. A onda está empurrada para o lado inimigo.`,
        question: 'Qual é o melhor uso dessa vantagem?',
        options: ['Ficar farmando na rota indefinidamente', 'Converter: torre, objetivo ou ajudar outra rota enquanto a vantagem existe', 'Mergulhar sozinho embaixo da torre inimiga', 'Voltar para a base sem motivo'],
        answer: 1,
        explanation: 'Vantagem que não vira objetivo diminui com o tempo. Transformá-la em torre ou dragão a torna permanente para a equipe.',
        happened: `No fim da partida a diferença para o oponente era de ${end ? end.goldDiff : 0} de ouro (${match.win ? 'vitória' : 'derrota'}).`,
        lessonId: 'r-aproveitar-vantagem',
        real: true,
      });
    }
  }
  return out.sort((a, b) => a.minute - b.minute).slice(0, max).map((d) => shuffle(d, match.id));
}

/** Cenários didáticos (sem evento real) para quando a partida não oferece momentos. */
export function didacticMoments(n = 3): DecisionMoment[] {
  return CHALLENGES.filter((c) => c.category === 'macro' || c.category === 'map' || c.category === 'teamfight')
    .slice(0, n)
    .map((c) => ({ id: `didatico-${c.id}`, minute: 0, title: c.title, situation: c.context, question: c.question, options: c.options, answer: c.answer, explanation: c.explanation, happened: 'Cenário didático: não corresponde a um evento da sua partida.', lessonId: c.lessonId, real: false }));
}

export interface ReplayAnalysisRecord {
  matchId: string;
  at: number;
  championId: string;
  answers: Array<{ momentId: string; correct: boolean }>;
  score: number;
}
