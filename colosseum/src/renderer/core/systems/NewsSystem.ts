// Folha Diurna: o jornal diário da cidade. As notícias sobre o gladiador são
// geradas pelos acontecimentos (fama, vitórias, sequências...) e publicadas
// na edição da manhã seguinte.
import type { NewsItem, PlayerState } from '../model/types';
import { OPPONENTS, type OpponentDef } from '../data/opponents';
import { arenaForOpponent } from '../data/arenas';
import { getOrigin } from '../data/gladiators';
import { pick, type Rng } from './rng';

export const CITY = 'Cápua';
export const FAME_MILESTONES = [10, 25, 50, 80, 120, 180, 250, 350, 450, 600];
const MAX_EDITIONS = 30;

type Vars = Record<string, string | number>;

function fill(t: string, v: Vars): string {
  return t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
}

const T = {
  debut: [
    ['Novo gladiador chega a {cidade}', 'Um {origem} chamado {nome} foi comprado pelo ludus. Será que aguenta a areia da arena?'],
  ],
  fame: [
    ['O recém-chegado {nome} ganha força em {cidade}', 'O público já grita o nome do gladiador nas arquibancadas. É melhor {rival} tomar cuidado!'],
    ['Quem é {nome}?', 'As tabernas só falam do {origem} que vem derrubando adversários. {rival} diz não estar preocupado.'],
    ['{nome}, a nova paixão da plebe', 'Vendedores já oferecem estatuetas de barro do gladiador. {rival} seria a próxima vítima?'],
    ['A fama de {nome} chega aos senadores', 'Até no Senado se comenta o estilo do gladiador. {rival} treina dobrado, dizem.'],
    ['Multidões seguem {nome} pelas ruas', 'Crianças imitam seus golpes com espadas de madeira. {rival} que se cuide!'],
  ],
  victory: [
    ['{nome} derrota {vencido} em {arena}!', 'A multidão aplaudiu de pé. Agora {rival} aguarda o desafiante.'],
    ['Vitória de {nome} sobre {vencido}', 'Em {arena}, o gladiador mostrou garra. Os apostadores já olham para o duelo contra {rival}.'],
  ],
  champion: [['NOVO CAMPEÃO DE ROMA!', '{nome} derrotou Flamma no Coliseu. O imperador em pessoa ergueu o polegar diante de 50 mil pessoas.']],
  arena: [['{nome} é chamado para lutar em {arena}', 'Os organizadores dos jogos querem o gladiador em palcos maiores.']],
  // uma manchete diferente para cada marco (sem repetir a mesma ideia)
  streak3: [['Três vitórias seguidas para {nome}', 'O público já decorou o nome do gladiador. Os apostadores estão de olho.']],
  streak5: [['{nome} vence pela quinta vez seguida', 'Cinco lutas, cinco vitórias. {rival} começa a ficar preocupado.']],
  streak10: [['Dez vitórias seguidas!', 'Ninguém derrota {nome} há dez lutas. Já falam em levar o gladiador a Roma.']],
  comeback: [['{nome} dá a volta por cima', 'Depois de uma fase ruim, o gladiador voltou a vencer em {arena}.']],
  lossKo: [
    ['{vencedor} derruba {nome} em {arena}', 'A torcida silenciou quando o gladiador caiu na areia. Nas tabernas, já pedem uma revanche.'],
    ['Dia difícil para {nome}', '{vencedor} foi superior em {arena}. Os instrutores pedem mais disciplina no ludus.'],
  ],
  lossDecision: [['{vencedor} vence {nome} por decisão', 'A luta foi até o fim, mas os juízes deram a vitória a {vencedor}.']],
  lossForfeit: [['{nome} desiste diante de {vencedor}', 'O gladiador ergueu o dedo pedindo clemência. Parte do público vaiou.']],
  slump: [['Três derrotas seguidas para {nome}', 'O lanista está preocupado e exige mais treino no ludus.']],
  level: [
    ['{nome} impressiona nos treinos', 'Os instrutores do ludus dizem que o gladiador está mais forte do que nunca.'],
    ['Músculos de ferro', 'Quem viu {nome} treinar no palus garante: {rival} terá trabalho.'],
  ],
  rival: [
    ['{rival} provoca {nome}', '"Esse {origem} não dura um minuto comigo!", disse {rival} numa taberna perto do fórum.'],
    ['{rival} aceita o desafio', '"Que venha! A areia de {arena} vai decidir", declarou {rival}.'],
  ],
  city: [
    ['Preço do trigo sobe no mercado', 'Os padeiros culpam as chuvas na Sicília.'],
    ['Senado anuncia novos jogos', 'Haverá distribuição de pão para o povo nos dias de luta.'],
    ['Navio do Egito chega ao porto', 'Especiarias, linho e papiro já estão à venda no mercado.'],
    ['Termas ganham piscina nova', 'A água quente agora chega por um novo aqueduto.'],
    ['Comédia lota o teatro', 'Os atores foram aplaudidos por mais de uma hora.'],
    ['Chuva forte alaga o fórum', 'Os comerciantes passaram a manhã tirando água das lojas.'],
  ],
} as const;

/** Próximo adversário ainda não derrotado (o "rival" das manchetes). */
export function nextRival(p: PlayerState): OpponentDef {
  return OPPONENTS.find((o) => !p.defeatedOpponents.includes(o.id)) ?? OPPONENTS[OPPONENTS.length - 1];
}

function vars(p: PlayerState, extra: Vars = {}): Vars {
  const rival = nextRival(p);
  return {
    nome: p.name,
    cidade: CITY,
    origem: getOrigin(p.origin).name.toLowerCase(),
    rival: rival.name,
    arena: arenaForOpponent(rival.id).name,
    ...extra,
  };
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Tipos dos quais só a notícia mais recente interessa (evita manchetes repetidas na mesma edição). */
const SINGLE: ReadonlyArray<NewsItem['kind']> = ['streak', 'defeat'];

function add(p: PlayerState, kind: NewsItem['kind'], options: readonly (readonly [string, string])[], rng: Rng, extra: Vars = {}): void {
  const [h, b] = pick(rng, options);
  const v = vars(p, extra);
  if (SINGLE.includes(kind)) p.news.pending = p.news.pending.filter((n) => n.kind !== kind);
  p.news.pending.push({ id: `n${p.day}-${p.news.pending.length}-${Math.floor(rng() * 1e6)}`, kind, headline: cap(fill(h, v)), body: cap(fill(b, v)) });
}

/** Notícia de estreia (edição do primeiro dia). */
export function debutEdition(p: PlayerState, rng: Rng): void {
  add(p, 'debut', T.debut, rng);
  add(p, 'city', T.city, rng);
  p.news.editions.unshift({ day: p.day, items: p.news.pending.splice(0), read: false });
}

export function checkFame(p: PlayerState, rng: Rng): void {
  for (const m of FAME_MILESTONES) {
    const key = `fame${m}`;
    if (p.reputation >= m && !p.news.milestones.includes(key)) {
      p.news.milestones.push(key);
      add(p, 'fame', T.fame, rng);
      if (rng() < 0.5) add(p, 'rival', T.rival, rng);
    }
  }
}

export function onLevel(p: PlayerState, rng: Rng): void {
  for (const lv of [5, 10, 15, 20, 25, 30]) {
    const key = `level${lv}`;
    if (p.level >= lv && !p.news.milestones.includes(key)) {
      p.news.milestones.push(key);
      add(p, 'level', T.level, rng);
    }
  }
}

export function onBattle(
  p: PlayerState,
  opp: OpponentDef,
  won: boolean,
  firstVictory: boolean,
  rng: Rng,
  reason: 'ko' | 'decision' | 'forfeit' = 'ko',
  prevStreak = 0,
): void {
  const where = { vencido: opp.name, vencedor: opp.name, arena: arenaForOpponent(opp.id).name };
  if (won) {
    if (firstVictory) {
      if (opp.id === OPPONENTS[OPPONENTS.length - 1].id) add(p, 'champion', T.champion, rng);
      else {
        add(p, 'victory', T.victory, rng, where);
        const next = nextRival(p);
        if (arenaForOpponent(next.id).id !== arenaForOpponent(opp.id).id) add(p, 'arena', T.arena, rng);
      }
    }
    if (prevStreak <= -2) add(p, 'streak', T.comeback, rng, where);
    if (p.streak === 3) add(p, 'streak', T.streak3, rng);
    if (p.streak === 5) add(p, 'streak', T.streak5, rng);
    if (p.streak === 10) add(p, 'streak', T.streak10, rng);
  } else {
    p.news.pending = p.news.pending.filter((n) => n.kind !== 'streak');
    if (p.streak === -3) add(p, 'defeat', T.slump, rng, where);
    else add(p, 'defeat', reason === 'forfeit' ? T.lossForfeit : reason === 'decision' ? T.lossDecision : T.lossKo, rng, where);
  }
  checkFame(p, rng);
  onLevel(p, rng);
}

/** Publica a edição do dia (ao acordar). Retorna a edição se houver notícias do gladiador. */
export function publish(p: PlayerState, rng: Rng) {
  const own = p.news.pending.splice(0, 5);
  p.news.pending = [];
  const items = [...own];
  add(p, 'city', T.city, rng);
  items.push(...p.news.pending.splice(0));
  const edition = { day: p.day, items, read: false };
  p.news.editions.unshift(edition);
  if (p.news.editions.length > MAX_EDITIONS) p.news.editions.length = MAX_EDITIONS;
  return own.length ? edition : null;
}

export function unreadCount(p: PlayerState): number {
  return p.news.editions.filter((e) => !e.read).length;
}
