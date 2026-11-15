import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ChampionAvatar, EmptyState, FadeIn, ItemIcon, Meter, ResultBadge, Screen, ScreenSkeleton, SectionHeader, Segmented, StatTile, TileGrid } from '@/components/ui';
import { champion, POSITION_LABEL } from '@/data/champions';
import { ITEM_NAMES } from '@/data/items';
import { usePlayer } from '@/state/PlayerContext';
import { matchCsPerMin, matchKda, matchKp } from '@/stats/aggregate';
import { compact, dateTime, dec, duration, int, pct, QUEUE_LABEL } from '@/stats/format';
import { rankLabel } from '@/stats/rank';
import { colors, fonts, radius, space, type } from '@/theme';
import type { Match, Participant, TimelineKind } from '@/types';

type Tab = 'resumo' | 'equipes' | 'build' | 'timeline';

export function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, data } = usePlayer();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('resumo');
  const match = useMemo(() => data?.matches.find((m) => m.id === id), [data, id]);

  if (status === 'loading' || !data) {
    return (
      <Screen title="Partida" back>
        <ScreenSkeleton cards={2} />
      </Screen>
    );
  }
  if (!match) {
    return (
      <Screen title="Partida" back>
        <Card>
          <EmptyState icon="alert-circle-outline" title="Partida não encontrada" message="Esta partida não pertence à conta carregada." actionLabel="Ver histórico" onAction={() => router.replace('/partidas')} />
        </Card>
      </Screen>
    );
  }

  const c = champion(match.championId);
  return (
    <Screen title={`${match.win ? 'Vitória' : 'Derrota'} · ${c.name}`} subtitle={`${QUEUE_LABEL[match.queue]} · ${dateTime(match.timestamp)}`} back>
      <Header match={match} />
      <Segmented
        options={[
          { value: 'resumo', label: 'Resumo' },
          { value: 'equipes', label: 'Equipes' },
          { value: 'build', label: 'Build' },
          { value: 'timeline', label: 'Eventos' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <FadeIn trigger={tab} style={{ gap: space.lg }}>
        {tab === 'resumo' ? <Summary match={match} /> : null}
        {tab === 'equipes' ? <Teams match={match} /> : null}
        {tab === 'build' ? <Build match={match} /> : null}
        {tab === 'timeline' ? <Timeline match={match} /> : null}
      </FadeIn>
    </Screen>
  );
}

function Header({ match: m }: { match: Match }) {
  const c = champion(m.championId);
  const tone = m.win ? colors.win : colors.loss;
  return (
    <Card style={{ borderColor: m.win ? 'rgba(61,139,255,0.4)' : 'rgba(229,96,106,0.4)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <ChampionAvatar id={c.id} size={62} ring={tone} />
        <View style={{ flex: 1, gap: 5 }}>
          <ResultBadge win={m.win} />
          <Text style={type.h2}>{c.name}</Text>
          <Text style={type.bodySm}>
            {POSITION_LABEL[m.position]} · {duration(m.durationSec)} · vs {champion(m.opponentChampionId).name}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.kdaBig}>
            {m.kills}
            <Text style={styles.muted}>/</Text>
            <Text style={{ color: colors.loss }}>{m.deaths}</Text>
            <Text style={styles.muted}>/</Text>
            {m.assists}
          </Text>
          <Text style={type.bodySm}>KDA {dec(matchKda(m), 2)}</Text>
        </View>
      </View>
      {m.rankAfter ? (
        <View style={styles.elo}>
          <Ionicons name="shield-half-outline" size={13} color={colors.gold} />
          <Text style={type.bodySm}>
            Elo após a partida: <Text style={{ color: colors.text }}>{rankLabel(m.rankAfter)} · {m.rankAfter.lp} LP</Text>
          </Text>
          <Text style={[styles.lp, { color: m.lpDelta! > 0 ? colors.accentSoft : colors.loss }]}>
            {m.lpDelta! > 0 ? '+' : '−'}
            {Math.abs(m.lpDelta!)} LP
          </Text>
        </View>
      ) : (
        <View style={styles.elo}>
          <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
          <Text style={type.bodySm}>Elo não disponível: esta fila não altera o elo Solo/Duo.</Text>
        </View>
      )}
    </Card>
  );
}

/** Posição do jogador entre os 10 participantes em uma métrica (1 = melhor). */
function rankOf(m: Match, get: (p: Participant) => number): number {
  const me = m.participants.find((p) => p.isPlayer)!;
  return m.participants.filter((p) => get(p) > get(me)).length + 1;
}

function Summary({ match: m }: { match: Match }) {
  const me = m.participants.find((p) => p.isPlayer)!;
  const team = m.participants.filter((p) => p.team === me.team);
  const share = (get: (p: Participant) => number) => get(me) / Math.max(1, team.reduce((s, p) => s + get(p), 0));
  const comparisons = [
    { label: 'Dano causado', value: compact(m.damageDealt), get: (p: Participant) => p.damage },
    { label: 'Ouro adquirido', value: compact(m.gold), get: (p: Participant) => p.gold },
    { label: 'CS', value: `${m.cs}`, get: (p: Participant) => p.cs },
    { label: 'Abates', value: `${m.kills}`, get: (p: Participant) => p.kills },
  ];
  const o = m.objectives;
  const objTotal = o.dragons + o.barons + o.heralds;
  return (
    <>
      <Card>
        <SectionHeader title="Estatísticas individuais" />
        <TileGrid columns={3}>
          <StatTile label="Dano" value={compact(m.damageDealt)} hint={`${int(m.damageDealt / (m.durationSec / 60))}/min`} />
          <StatTile label="Recebido" value={compact(m.damageTaken)} hint="dano sofrido" />
          <StatTile label="Ouro" value={compact(m.gold)} hint={`${int(m.gold / (m.durationSec / 60))}/min`} />
          <StatTile label="CS" value={`${m.cs}`} hint={`${dec(matchCsPerMin(m))}/min`} />
          <StatTile label="KP" value={pct(matchKp(m))} hint={`${m.kills + m.assists} de ${m.teamKills}`} />
          <StatTile label="Visão" value={`${m.visionScore}`} hint="placar" />
        </TileGrid>
        {m.firstBlood ? (
          <View style={styles.flag}>
            <Ionicons name="flash" size={13} color={colors.gold} />
            <Text style={type.bodySm}>Conquistou o primeiro abate da partida.</Text>
          </View>
        ) : null}
      </Card>

      <Card>
        <SectionHeader title="Comparação com a partida" subtitle="Sua colocação entre os 10 jogadores e fatia da equipe" />
        <View style={{ gap: space.md }}>
          {comparisons.map((cmp) => {
            const place = rankOf(m, cmp.get);
            return (
              <View key={cmp.label} style={{ gap: 6 }}>
                <View style={styles.cmpHead}>
                  <Text style={type.h3}>{cmp.label}</Text>
                  <Text style={type.bodySm}>
                    <Text style={{ color: colors.text }}>{cmp.value}</Text> · {place}º de 10 · {pct(share(cmp.get))} da equipe
                  </Text>
                </View>
                <Meter value={(11 - place) / 10} color={place <= 3 ? colors.gold : colors.accent} height={5} />
              </View>
            );
          })}
        </View>
      </Card>

      <Card>
        <SectionHeader title="Participação em objetivos" subtitle={objTotal ? `Presente em ${o.playerParticipations} de ${objTotal} objetivos épicos da equipe` : 'Sua equipe não garantiu objetivos épicos'} />
        {objTotal ? <Meter value={o.playerParticipations / objTotal} color={colors.gold} /> : null}
        <View style={styles.objGrid}>
          <ObjRow label="Dragões" ours={o.dragons} theirs={o.enemyDragons} />
          <ObjRow label="Barões" ours={o.barons} theirs={o.enemyBarons} />
          <ObjRow label="Torres" ours={o.towers} theirs={o.enemyTowers} />
          <ObjRow label="Arautos" ours={o.heralds} theirs={null} />
        </View>
      </Card>
    </>
  );
}

function ObjRow({ label, ours, theirs }: { label: string; ours: number; theirs: number | null }) {
  return (
    <View style={styles.objRow}>
      <Text style={[type.h3, { color: colors.accentSoft, width: 28 }]}>{ours}</Text>
      <Text style={[type.bodySm, { flex: 1, textAlign: 'center' }]}>{label}</Text>
      <Text style={[type.h3, { color: colors.loss, width: 28, textAlign: 'right' }]}>{theirs ?? '—'}</Text>
    </View>
  );
}

type TeamMetric = 'damage' | 'gold' | 'cs';

function Teams({ match: m }: { match: Match }) {
  const [metric, setMetric] = useState<TeamMetric>('damage');
  const me = m.participants.find((p) => p.isPlayer)!;
  const get = (p: Participant) => p[metric];
  const max = Math.max(...m.participants.map(get));
  const teams = [
    { title: 'Sua equipe', won: m.win, list: m.participants.filter((p) => p.team === me.team) },
    { title: 'Equipe inimiga', won: !m.win, list: m.participants.filter((p) => p.team !== me.team) },
  ];
  return (
    <>
      <Segmented
        options={[
          { value: 'damage', label: 'Dano' },
          { value: 'gold', label: 'Ouro' },
          { value: 'cs', label: 'CS' },
        ]}
        value={metric}
        onChange={setMetric}
      />
      {teams.map((t) => {
        const kills = t.list.reduce((s, p) => s + p.kills, 0);
        return (
          <Card key={t.title}>
            <SectionHeader title={t.title} subtitle={`${kills} abates · ${compact(t.list.reduce((s, p) => s + p.gold, 0))} de ouro`} right={<ResultBadge win={t.won} small />} />
            <View style={{ gap: 10 }}>
              {t.list.map((p) => (
                <View key={p.name + p.championId} style={[styles.player, p.isPlayer && styles.playerMe]}>
                  <ChampionAvatar id={p.championId} size={34} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.cmpHead}>
                      <Text style={[type.h3, { flexShrink: 1 }, p.isPlayer && { color: colors.gold }]} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.score}>
                        {p.kills}/{p.deaths}/{p.assists}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Meter value={get(p) / max} color={t.won ? colors.win : colors.loss} height={4} />
                      </View>
                      <Text style={[type.bodySm, { width: 56, textAlign: 'right' }]}>{metric === 'cs' ? p.cs : compact(get(p))}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        );
      })}
    </>
  );
}

const SKILLS = ['Q', 'W', 'E', 'R'] as const;

function Build({ match: m }: { match: Match }) {
  const [item, setItem] = useState<number | null>(null);
  const r = m.runes;
  return (
    <>
      <Card>
        <SectionHeader title="Itens comprados" subtitle={item ? ITEM_NAMES[item] : 'Toque em um item para ver o nome'} />
        <View style={styles.items}>
          {Array.from({ length: 6 }, (_, i) => m.items[i]).map((id, i) => (
            <Pressable key={i} disabled={!id} onPress={() => setItem(id)} accessibilityRole="button" accessibilityLabel={id ? ITEM_NAMES[id] : 'Espaço vazio'} style={item === id && id ? styles.itemOn : styles.itemOff}>
              <ItemIcon id={id} size={32} />
            </Pressable>
          ))}
          <View style={styles.itemDivider} />
          <Pressable onPress={() => setItem(m.trinket)} accessibilityRole="button" accessibilityLabel={ITEM_NAMES[m.trinket]} style={item === m.trinket ? styles.itemOn : styles.itemOff}>
            <ItemIcon id={m.trinket} size={32} />
          </Pressable>
        </View>
        <Text style={[type.bodySm, { marginTop: space.md }]}>Ordem de compra: {m.items.map((id) => ITEM_NAMES[id]).join(' → ')}</Text>
      </Card>

      <Card>
        <SectionHeader title="Ordem de habilidades" subtitle={`Nível ${m.skillOrder.length} ao fim da partida`} />
        <View style={{ gap: 4 }}>
          {SKILLS.map((s) => (
            <View key={s} style={styles.skillRow}>
              <Text style={[styles.skillKey, s === 'R' && { color: colors.gold }]}>{s}</Text>
              {Array.from({ length: 18 }, (_, lvl) => {
                const on = m.skillOrder[lvl] === s;
                return (
                  <View key={lvl} style={[styles.skillCell, on && { backgroundColor: s === 'R' ? colors.gold : colors.accent, borderColor: 'transparent' }, lvl >= m.skillOrder.length && { opacity: 0.35 }]}>
                    {on ? <Text style={styles.skillLvl}>{lvl + 1}</Text> : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        <Text style={[type.bodySm, { marginTop: space.md }]}>
          Prioridade: {[...SKILLS].filter((s) => s !== 'R').sort((a, b) => countUntilMax(m, a) - countUntilMax(m, b)).join(' › ')}
        </Text>
      </Card>

      <Card>
        <SectionHeader title="Runas" />
        <View style={styles.keystone}>
          <View style={styles.keystoneIcon}>
            <Ionicons name="flash" size={18} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.label}>{r.primaryTree} · runa essencial</Text>
            <Text style={type.h2}>{r.keystone}</Text>
          </View>
        </View>
        <RuneGroup title={r.primaryTree} runes={r.primary} />
        <RuneGroup title={`${r.secondaryTree} (secundária)`} runes={r.secondary} />
        <RuneGroup title="Fragmentos" runes={r.shards} />
      </Card>
    </>
  );
}

/** Nível em que a habilidade recebeu o 5º ponto (ou 99 se não chegou lá). */
function countUntilMax(m: Match, s: string): number {
  let n = 0;
  for (let i = 0; i < m.skillOrder.length; i++) if (m.skillOrder[i] === s && ++n === 5) return i;
  return 99 - n;
}

function RuneGroup({ title, runes }: { title: string; runes: string[] }) {
  return (
    <View style={{ marginTop: space.md }}>
      <Text style={type.label}>{title}</Text>
      <View style={styles.runes}>
        {runes.map((name, i) => (
          <View key={`${name}-${i}`} style={styles.rune}>
            <Text style={styles.runeText}>{name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const EVENT_ICON: Record<TimelineKind, keyof typeof Ionicons.glyphMap> = {
  KILL: 'flash',
  DEATH: 'skull',
  ASSIST: 'people',
  DRAGON: 'flame',
  BARON: 'planet',
  HERALD: 'eye',
  TOWER: 'business',
  ITEM: 'cube',
  END: 'flag',
};

type TimelineFilter = 'all' | 'combat' | 'objectives';

function Timeline({ match: m }: { match: Match }) {
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const events = m.timeline.filter((e) =>
    filter === 'all' ? true : filter === 'combat' ? e.kind === 'KILL' || e.kind === 'DEATH' : !['KILL', 'DEATH', 'ITEM'].includes(e.kind),
  );
  return (
    <>
      <Segmented
        options={[
          { value: 'all', label: 'Tudo' },
          { value: 'combat', label: 'Combate' },
          { value: 'objectives', label: 'Objetivos' },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <Card>
        <SectionHeader title="Linha do tempo" subtitle={`${events.length} acontecimentos em ${duration(m.durationSec)}`} />
        {events.length ? (
          events.map((e, i) => {
            const color = e.kind === 'END' ? colors.gold : e.positive ? colors.win : colors.loss;
            return (
              <View key={i} style={styles.event}>
                <Text style={styles.minute}>{e.minute}′</Text>
                <View style={styles.rail}>
                  <View style={[styles.node, { backgroundColor: color }]}>
                    <Ionicons name={EVENT_ICON[e.kind]} size={11} color={colors.bg} />
                  </View>
                  {i < events.length - 1 ? <View style={styles.railLine} /> : null}
                </View>
                <Text style={[styles.eventText, e.kind === 'END' && { color: colors.text, fontFamily: fonts.bodyBold }]}>{e.text}</Text>
              </View>
            );
          })
        ) : (
          <EmptyState icon="time-outline" title="Sem acontecimentos" message="Nenhum evento deste tipo foi registrado na partida." />
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  kdaBig: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.text, letterSpacing: -0.4 },
  muted: { color: colors.textMuted },
  elo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  lp: { marginLeft: 'auto', fontFamily: fonts.bodyBold, fontSize: 12.5 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md },
  cmpHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  objGrid: { marginTop: space.md, gap: 2 },
  objRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  player: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  playerMe: { backgroundColor: colors.goldDim, borderRadius: radius.md, padding: 8, margin: -8, marginVertical: -3 },
  score: { fontFamily: fonts.display, fontSize: 13, color: colors.text },
  items: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemOff: { borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  itemOn: { borderRadius: 10, borderWidth: 2, borderColor: colors.gold },
  itemDivider: { width: 1, height: 28, backgroundColor: colors.border, marginHorizontal: 2 },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  skillKey: { width: 16, fontFamily: fonts.displayBold, fontSize: 12, color: colors.textSecondary },
  skillCell: { flex: 1, height: 22, borderRadius: 4, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  skillLvl: { fontFamily: fonts.bodyBold, fontSize: 9, color: '#fff' },
  keystone: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  keystoneIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.gold },
  runes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  rune: { paddingHorizontal: 10, height: 30, borderRadius: 15, justifyContent: 'center', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  runeText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textSecondary },
  event: { flexDirection: 'row', gap: space.md, minHeight: 40 },
  minute: { width: 30, textAlign: 'right', fontFamily: fonts.display, fontSize: 12, color: colors.textMuted, paddingTop: 3 },
  rail: { alignItems: 'center', width: 22 },
  node: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  railLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  eventText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, paddingTop: 2, paddingBottom: 12 },
});
