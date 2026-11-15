/** Diagnóstico: imprime um resumo dos dados demonstrativos e valida a coerência. */
import { mockBundles } from '@/data/mock/players';
import { byChampion, byPosition, streaks, summarize } from '@/stats/aggregate';
import { computeIdentity } from '@/stats/identity';
import { computeInsights } from '@/stats/insights';
import { rankLabel, rankToAbsolute } from '@/stats/rank';

for (const b of mockBundles()) {
  const s = summarize(b.matches);
  console.log(`\n== ${b.player.gameName}#${b.player.tagLine} ${rankLabel(b.player.rank!)} ${b.player.rank!.lp} LP`);
  console.log(`partidas ${s.games} V${s.wins} D${s.losses} WR ${(s.winRate * 100).toFixed(1)} KDA ${s.kda.toFixed(2)} cs ${s.csPerMin.toFixed(1)} gpm ${s.goldPerMin.toFixed(0)} dmg ${s.avgDamage.toFixed(0)} kp ${(s.killParticipation * 100).toFixed(0)}`);
  const ranked = b.matches.filter((m) => m.rankAfter);
  const abs = ranked.map((m) => rankToAbsolute(m.rankAfter!));
  console.log(`solo ${ranked.length} início ${rankLabel(ranked[0].rankAfter!)} pico ${Math.max(...abs)} fim ${abs[abs.length - 1]}`, streaks(b.matches));
  console.log(byChampion(b.matches).sort((a, c) => c.games - a.games).map((c) => `${c.championId} ${c.games} ${(c.winRate * 100).toFixed(0)}% ${c.kda.toFixed(2)}`).join(' | '));
  console.log(byPosition(b.matches).map((p) => `${p.position} ${p.games} ${(p.winRate * 100).toFixed(0)}%`).join(' | '));
  const id = computeIdentity(b.matches);
  console.log(id.traits.map((t) => `${t.axis} ${t.score}`).join(' | '));
  const rep = computeInsights(b.matches);
  rep.insights.forEach((i) => console.log(' +', i.text));
  rep.skipped.forEach((i) => console.log(' -', i.label, ':', i.reason));

  // Coerência
  for (const m of b.matches) {
    const mine = m.participants.filter((p) => p.team === m.participants.find((x) => x.isPlayer)!.team);
    const foes = m.participants.filter((p) => !mine.includes(p));
    const k = (l: typeof mine) => l.reduce((x, p) => x + p.kills, 0);
    const d = (l: typeof mine) => l.reduce((x, p) => x + p.deaths, 0);
    if (k(mine) !== m.teamKills || k(mine) !== d(foes) || k(foes) !== d(mine)) throw new Error(`placar incoerente ${m.id}`);
    if (m.kills + m.assists > m.teamKills) throw new Error(`KP > 100% ${m.id}`);
    if (new Set(m.participants.map((p) => p.championId)).size !== 10) throw new Error(`campeão repetido ${m.id}`);
  }
  if (abs[abs.length - 1] !== rankToAbsolute(b.player.rank!)) throw new Error('elo final incoerente');
  console.log('coerência OK');
}
