/** Diagnóstico: imprime o relatório do treinador (Academy + previsão) para as contas demonstrativas. */
import { buildCoachReport, emptyCoachState, LESSONS, setGoal } from '@/coach';
import { mockBundles } from '@/data/mock/players';
import { absoluteLabel } from '@/stats/rank';

console.log(`${LESSONS.length} aulas`);
for (const b of mockBundles()) {
  const input = { player: b.player, matches: b.matches, rankHistory: [], source: 'demo' as const, asOf: b.asOf, now: b.asOf };
  const state = setGoal(emptyCoachState(), { tier: b.player.rank!.tier === 'DIAMANTE' ? 'MESTRE' : 'DIAMANTE', division: b.player.rank!.tier === 'DIAMANTE' ? 1 : 4, lp: 0 }, b.asOf);
  const t0 = Date.now();
  const { report } = buildCoachReport(input, state);
  console.log(`\n== ${b.player.gameName} (${Date.now() - t0} ms)`);
  for (const s of report.diagnosis.skills) console.log(`  ${s.skill.padEnd(10)} ${s.status.padEnd(12)} prática ${String(s.practice).padStart(4)} sev ${String(s.severity).padStart(3)} ${s.trend ?? '-'} | ${s.evidence}`);
  console.log('  pontos fracos:', report.diagnosis.weaknesses.join(', ') || 'nenhum');
  console.log('  recomendadas:', report.academy.recommended.map((r) => r.lessonId).join(', '));
  console.log('  plano:', report.plan?.title, '|', report.plan?.baselineDisplay, '→', report.plan?.targetDisplay);
  const p = report.prediction;
  console.log('  previsão:', p.status, p.message ?? '');
  if (p.inputs) {
    const i = p.inputs;
    console.log(`  WR pond ${(i.weightedWinRate * 100).toFixed(1)} suav ${(i.smoothedWinRate * 100).toFixed(1)} ±${(i.stdError * 100).toFixed(1)} | ${i.gamesPerWeek.toFixed(1)}/sem (${i.gamesPerWeekBasis}) | LP +${i.lpGain.toFixed(1)}/−${i.lpLoss.toFixed(1)} ${i.lpSource} | ${i.trendText}`);
    console.log('  janelas:', i.winRates.map((w) => `${w.window}:${w.winRate === null ? 'n/d' : Math.round(w.winRate * 100) + '%'}`).join(' '));
    for (const h of p.horizons) console.log(`  ${h.days}d: ${absoluteLabel(h.low)} | ${absoluteLabel(h.central)} | ${absoluteLabel(h.high)} · cenários ${h.scenarios.map((s) => `${s.label} ${absoluteLabel(s.projectedAbs)} (${s.games}j)`).join(' / ')}`);
    console.log('  confiança:', p.confidence?.level, p.confidence?.score, p.confidence?.reasons.join(' '));
    console.log('  ', p.headline);
    console.log('  ', p.horizons[2].scenarios[1].explanation.join('\n   '));
  }
  if (report.goal) console.log('  meta:', report.goal.summary.join(' '), '| exigido:', report.goal.requiredWinRates.map((r) => `${r.label} ${(r.winRate * 100).toFixed(0)}%`).join('; '));
}
