import React from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop, Text as SvgText, TSpan } from 'react-native-svg';

import { EmblemGraphic } from '@/components/ui/RankEmblem';
import { champion } from '@/data/champions';
import { dec, pct } from '@/stats/format';
import { rankLabel, TIER_COLOR } from '@/stats/rank';
import { colors, fonts } from '@/theme';
import type { Rank } from '@/types';

/** Dados do cartão (já calculados para o período escolhido). */
export interface ShareCardData {
  name: string;
  tag: string;
  region: string;
  rank: Rank | null;
  period: string;
  games: number;
  winRate: number;
  kda: number;
  csPerMin: number;
  champions: Array<{ id: string; games: number; winRate: number }>;
  identity?: string;
  lpChange?: number;
  demo: boolean;
}

export const CARD_W = 1080;
export const CARD_H = 1350;

const hex = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

/**
 * Cartão de 1080 × 1350 (formato de post) desenhado só com vetores e texto, sem
 * imagens remotas: assim ele pode ser exportado como PNG no aparelho e no navegador.
 */
export const ShareCard = React.forwardRef<Svg, { data: ShareCardData; width: number }>(function ShareCard({ data: d, width }, ref) {
  const tierColor = d.rank ? TIER_COLOR[d.rank.tier] : colors.textMuted;
  const stats: Array<[string, string]> = [
    ['PARTIDAS', String(d.games)],
    ['VITÓRIAS', pct(d.winRate)],
    ['KDA', dec(d.kda, 2)],
    ['CS/MIN', dec(d.csPerMin, 1)],
  ];
  return (
    <Svg ref={ref} width={width} height={(width * CARD_H) / CARD_W} viewBox={`0 0 ${CARD_W} ${CARD_H}`}>
      <Defs>
        <RadialGradient id="card-bg" cx="0.5" cy="0.3" r="0.9">
          <Stop offset="0" stopColor="#17294A" />
          <Stop offset="0.55" stopColor="#0B1220" />
          <Stop offset="1" stopColor="#07090D" />
        </RadialGradient>
        <LinearGradient id="card-gold" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#7C5219" />
          <Stop offset="0.5" stopColor="#F5D894" />
          <Stop offset="1" stopColor="#7C5219" />
        </LinearGradient>
        <RadialGradient id="card-glow" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={tierColor} stopOpacity={0.35} />
          <Stop offset="1" stopColor={tierColor} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={CARD_W} height={CARD_H} fill="url(#card-bg)" />
      {/* Padrão hexagonal discreto */}
      {Array.from({ length: 7 }, (_, row) =>
        Array.from({ length: 6 }, (_, col) => (
          <Polygon key={`${row}-${col}`} points={hex(90 + col * 180 + (row % 2) * 90, 80 + row * 156, 70)} fill="none" stroke="#FFFFFF" strokeOpacity={0.025} strokeWidth={2} />
        )),
      )}
      <Rect x="36" y="36" width={CARD_W - 72} height={CARD_H - 72} rx="36" fill="none" stroke="url(#card-gold)" strokeOpacity={0.6} strokeWidth={3} />

      {/* Marca */}
      <G transform="translate(84 92)">
        <Polygon points={hex(28, 28, 26)} fill="#0B1220" stroke="#D9AE5C" strokeWidth={5} />
        <Path d="M28 12 L37 28 L28 45 L19 28 Z" fill="#3D86FF" />
        <SvgText x="72" y="40" fontFamily={fonts.title} fontSize="34" fill={colors.text} letterSpacing="5">
          LOL <TSpan fill={colors.gold}>INSIGHT</TSpan>
        </SvgText>
      </G>
      <SvgText x={CARD_W - 84} y="132" textAnchor="end" fontFamily={fonts.bodySemi} fontSize="26" fill={colors.textSecondary}>
        {d.period}
      </SvgText>

      {/* Jogador e elo */}
      <Circle cx={CARD_W / 2} cy="420" r="230" fill="url(#card-glow)" />
      {d.rank ? <EmblemGraphic tier={d.rank.tier} transform={`translate(${CARD_W / 2 - 170} 250) scale(3.4)`} /> : null}
      <SvgText x={CARD_W / 2} y="640" textAnchor="middle" fontFamily={fonts.title} fontSize="76" fill={colors.text}>
        {d.name}
      </SvgText>
      <SvgText x={CARD_W / 2} y="690" textAnchor="middle" fontFamily={fonts.display} fontSize="34" fill={colors.textMuted} letterSpacing="2">
        #{d.tag} · {d.region}
      </SvgText>
      <SvgText x={CARD_W / 2} y="760" textAnchor="middle" fontFamily={fonts.title} fontSize="52" fill={tierColor}>
        {d.rank ? `${rankLabel(d.rank)} · ${d.rank.lp} LP` : 'Sem elo'}
      </SvgText>
      {d.lpChange !== undefined && d.lpChange !== 0 ? (
        <SvgText x={CARD_W / 2} y="806" textAnchor="middle" fontFamily={fonts.displayBold} fontSize="32" fill={d.lpChange > 0 ? colors.good : colors.loss}>
          {d.lpChange > 0 ? '▲' : '▼'} {Math.abs(d.lpChange)} LP no período
        </SvgText>
      ) : null}

      {/* Números */}
      {stats.map(([label, value], i) => {
        const x = 84 + i * 237;
        return (
          <G key={label}>
            <Rect x={x} y="850" width="219" height="150" rx="24" fill="#FFFFFF" fillOpacity={0.045} />
            <SvgText x={x + 110} y="938" textAnchor="middle" fontFamily={fonts.displayBold} fontSize="64" fill={colors.text}>
              {value}
            </SvgText>
            <SvgText x={x + 110} y="978" textAnchor="middle" fontFamily={fonts.bodyBold} fontSize="20" fill={colors.textMuted} letterSpacing="3">
              {label}
            </SvgText>
          </G>
        );
      })}

      {/* Campeões */}
      <SvgText x="84" y="1068" fontFamily={fonts.bodyBold} fontSize="22" fill={colors.gold} letterSpacing="3">
        {d.identity ? `CAMPEÕES · ${d.identity.toUpperCase()}` : 'CAMPEÕES MAIS JOGADOS'}
      </SvgText>
      {d.champions.slice(0, 3).map((c, i) => {
        const x = 84 + i * 316;
        const ch = champion(c.id);
        return (
          <G key={c.id}>
            <Circle cx={x + 44} cy="1140" r="40" fill={ch.color} />
            <Circle cx={x + 44} cy="1140" r="40" fill="none" stroke="#D9AE5C" strokeOpacity={0.7} strokeWidth={3} />
            <SvgText x={x + 44} y="1153" textAnchor="middle" fontFamily={fonts.displayBold} fontSize="34" fill="#FFFFFF">
              {ch.name.slice(0, 1)}
            </SvgText>
            <SvgText x={x + 100} y="1132" fontFamily={fonts.bodyBold} fontSize="30" fill={colors.text}>
              {ch.name.length > 11 ? `${ch.name.slice(0, 10)}…` : ch.name}
            </SvgText>
            <SvgText x={x + 100} y="1170" fontFamily={fonts.bodySemi} fontSize="24" fill={colors.textSecondary}>
              {c.games} jogos · {pct(c.winRate)}
            </SvgText>
          </G>
        );
      })}

      <SvgText x={CARD_W / 2} y="1270" textAnchor="middle" fontFamily={fonts.body} fontSize="20" fill={colors.textMuted}>
        {d.demo ? 'DADOS DEMONSTRATIVOS (FICTÍCIOS) · ' : ''}LOL Insight · não é endossado pela Riot Games
      </SvgText>
    </Svg>
  );
});
