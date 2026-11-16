import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { MatchReportView } from '@/components/report/MatchReportView';
import { Card, ChampionAvatar, ChampionBackdrop, EmptyState, FadeIn, ItemIcon, Meter, ResultBadge, Screen, ScreenSkeleton, SectionHeader, Segmented, Skeleton, StatTile, TileGrid } from '@/components/ui';
import { champion, POSITION_LABEL, runeIconUrl, spellIconUrl } from '@/data/champions';
import { itemName } from '@/data/items';
import { describeError, ServiceError } from '@/services';
import { markReportSeen } from '@/services/reportSeen';
import { usePlayer } from '@/state/PlayerContext';
import { matchCsPerMin, matchKda, matchKp } from '@/stats/aggregate';
import { compact, dateTime, dec, duration, int, pct, QUEUE_LABEL } from '@/stats/format';
import { rankLabel } from '@/stats/rank';
import { colors, fonts, radius, space, type } from '@/theme';
import type { DataSourceKind, Match, Participant, TimelineKind } from '@/types';

type Tab = 'relatorio' | 'resumo' | 'equipes' | 'build' | 'timeline';

export function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, data } = usePlayer();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('relatorio');
  const base = useMemo(() => data?.matches.find((m) => m.id === id), [data, id]);
  const { match, details, completedItems } = useMatchDetails(base);
  useEffect(() => {
    // Só a partida mais recente tem o destaque "NOVO" na Início.
    if (data && base && tab === 'relatorio' && data.matches[0]?.id === base.id) void markReportSeen(data.source, data.player.id, base.id);
  }, [data, base, tab]);

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
      <MatchHeader match={match} source={data.source} />
      <Segmented
        options={[
          { value: 'relatorio', label: 'Relatório' },
          { value: 'resumo', label: 'Resumo' },
          { value: 'equipes', label: 'Equipes' },
          { value: 'build', label: 'Build' },
          { value: 'timeline', label: 'Eventos' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <FadeIn trigger={tab} style={{ gap: space.lg }}>
        {tab === 'relatorio' ? <MatchReportView match={match} tier={data.player.rank?.tier} /> : null}
        {tab === 'resumo' ? <MatchSummary match={match} /> : null}
        {tab === 'equipes' ? <MatchTeams match={match} /> : null}
        {tab === 'build' ? <MatchBuild match={match} details={details} completedItems={completedItems} /> : null}
        {tab === 'timeline' ? <MatchTimeline match={match} details={details} /> : null}
      </FadeIn>
    </Screen>
  );
}

type DetailsState = { status: 'ready' } | { status: 'loading' } | { status: 'error'; error: ServiceError };

/**
 * Ordem de habilidades e linha do tempo. Na demonstração já vêm com a partida;
 * nos dados reais são buscadas sob demanda (Match-V5 timeline) ao abrir a tela.
 */
export function useMatchDetails(base: Match | undefined): { match: Match | undefined; details: DetailsState; completedItems: number[] } {
  const { dataSource, data } = usePlayer();
  const [loaded, setLoaded] = useState<{ id: string; patch: Partial<Match>; completedItems: number[] } | null>(null);
  const [failure, setFailure] = useState<{ id: string; error: ServiceError } | null>(null);
  const needs = !!base && base.detailsLoaded === false;
  const player = data?.player;

  useEffect(() => {
    if (!base || !needs || !player) return;
    let cancelled = false;
    dataSource
      .loadMatchDetails(base, player)
      .then((d) => {
        if (cancelled) return;
        setLoaded({ id: base.id, patch: { skillOrder: d.skillOrder, timeline: d.timeline, detailsLoaded: true }, completedItems: d.itemOrder });
      })
      .catch((e) => {
        if (!cancelled) setFailure({ id: base.id, error: e instanceof ServiceError ? e : new ServiceError('UNKNOWN', 'Não foi possível carregar os detalhes.') });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base?.id, needs, dataSource, player?.id]);

  if (!base) return { match: undefined, details: { status: 'ready' }, completedItems: [] };
  if (!needs) return { match: base, details: { status: 'ready' }, completedItems: [] };
  if (loaded?.id === base.id) return { match: { ...base, ...loaded.patch }, details: { status: 'ready' }, completedItems: loaded.completedItems };
  if (failure?.id === base.id) return { match: base, details: { status: 'error', error: failure.error }, completedItems: [] };
  return { match: base, details: { status: 'loading' }, completedItems: [] };
}

function DetailsPending({ details, what }: { details: DetailsState; what: string }) {
  if (details.status === 'loading') {
    return (
      <View style={{ gap: 8 }} accessibilityLabel={`Carregando ${what}`}>
        <Skeleton height={18} />
        <Skeleton height={18} />
        <Skeleton height={18} width="70%" />
      </View>
    );
  }
  if (details.status === 'error') {
    const p = describeError(details.error.code);
    return <EmptyState icon={p.icon} title={`${what[0].toUpperCase()}${what.slice(1)} indisponível`} message={`${details.error.message} ${p.hint}`} />;
  }
  return null;
}

export function MatchHeader({ match: m, source }: { match: Match; source: DataSourceKind }) {
  const c = champion(m.championId);
  const tone = m.win ? colors.win : colors.loss;
  return (
    <Card padded={false} style={{ borderColor: m.win ? 'rgba(61,139,255,0.4)' : 'rgba(229,96,106,0.4)' }}>
      <ChampionBackdrop id={c.id} height={96} tint={tone} />
      <View style={{ padding: space.lg, paddingTop: 0, marginTop: -40 }}>
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
          <Text style={[type.bodySm, { flex: 1 }]}>
            {source === 'riot' ? 'A Riot API não informa o elo no momento de cada partida.' : 'Elo não disponível: esta fila não altera o elo Solo/Duo.'}
          </Text>
        </View>
      )}
      </View>
    </Card>
  );
}

/** Posição do jogador entre os 10 participantes em uma métrica (1 = melhor). */
function rankOf(m: Match, get: (p: Participant) => number): number {
  const me = m.participants.find((p) => p.isPlayer)!;
  return m.participants.filter((p) => get(p) > get(me)).length + 1;
}

export function MatchSummary({ match: m }: { match: Match }) {
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
  const parts = o.playerParticipations;
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
        <SectionHeader
          title="Participação em objetivos"
          subtitle={
            !objTotal
              ? 'Sua equipe não garantiu objetivos épicos'
              : parts === undefined
                ? 'Objetivos épicos garantidos por cada equipe'
                : `Presente em ${Math.min(parts, objTotal)} de ${objTotal} objetivos épicos da equipe`
          }
        />
        {objTotal && parts !== undefined ? <Meter value={Math.min(1, parts / objTotal)} color={colors.gold} /> : null}
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

export function MatchTeams({ match: m }: { match: Match }) {
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

export function MatchBuild({ match: m, details, completedItems }: { match: Match; details: DetailsState; completedItems: number[] }) {
  const [item, setItem] = useState<number | null>(null);
  const r = m.runes;
  const order = m.itemsInPurchaseOrder ? m.items : completedItems;
  const skillsReady = details.status === 'ready' && m.skillOrder.length > 0;
  return (
    <>
      <Card>
        <SectionHeader title="Itens" subtitle={item ? itemName(item) : 'Toque em um item para ver o nome'} />
        <View style={styles.items}>
          {Array.from({ length: 6 }, (_, i) => m.items[i]).map((id, i) => (
            <Pressable key={i} disabled={!id} onPress={() => setItem(id)} accessibilityRole="button" accessibilityLabel={id ? itemName(id) : 'Espaço vazio'} style={item === id && id ? styles.itemOn : styles.itemOff}>
              <ItemIcon id={id} size={32} />
            </Pressable>
          ))}
          <View style={styles.itemDivider} />
          {m.trinket ? (
            <Pressable onPress={() => setItem(m.trinket)} accessibilityRole="button" accessibilityLabel={itemName(m.trinket)} style={item === m.trinket ? styles.itemOn : styles.itemOff}>
              <ItemIcon id={m.trinket} size={32} />
            </Pressable>
          ) : (
            <ItemIcon size={32} />
          )}
        </View>
        {order.length ? (
          <Text style={[type.bodySm, { marginTop: space.md }]}>
            {m.itemsInPurchaseOrder ? 'Ordem de compra' : 'Itens concluídos, em ordem'}: {order.map(itemName).join(' → ')}
          </Text>
        ) : details.status === 'loading' ? (
          <Skeleton height={12} width="80%" style={{ marginTop: space.md }} />
        ) : null}
        {m.summonerSpells?.length ? (
          <View style={styles.spells}>
            <Text style={type.label}>Feitiços</Text>
            {m.summonerSpells.map((sp) => (
              <View key={sp.name} style={styles.spell}>
                <RemoteIcon uri={spellIconUrl(sp.icon)} size={22} />
                <Text style={styles.runeText}>{sp.name}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Card>
        <SectionHeader title="Ordem de habilidades" subtitle={skillsReady ? `Nível ${m.skillOrder.length} ao fim da partida` : undefined} />
        {skillsReady ? (
          <>
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
          </>
        ) : details.status === 'ready' ? (
          <EmptyState icon="git-branch-outline" title="Ordem indisponível" message="A linha do tempo desta partida não trouxe a evolução de habilidades." />
        ) : (
          <DetailsPending details={details} what="ordem de habilidades" />
        )}
      </Card>

      <Card>
        <SectionHeader title="Runas" />
        <View style={styles.keystone}>
          <View style={styles.keystoneIcon}>
            <Ionicons name="flash" size={18} color={colors.gold} />
            {r.icons?.[r.keystone] ? (
              <View style={styles.keystoneImg}>
                <RemoteIcon uri={runeIconUrl(r.icons[r.keystone])} size={40} />
              </View>
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.label}>{r.primaryTree} · runa essencial</Text>
            <Text style={type.h2}>{r.keystone}</Text>
          </View>
        </View>
        <RuneGroup title={r.primaryTree} runes={r.primary} icons={r.icons} />
        <RuneGroup title={`${r.secondaryTree} (secundária)`} runes={r.secondary} icons={r.icons} />
        {r.shards.length ? <RuneGroup title="Fragmentos" runes={r.shards} /> : null}
      </Card>
    </>
  );
}

/** Ícone oficial (Data Dragon); se não carregar, simplesmente não aparece. */
function RemoteIcon({ uri, size }: { uri: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: size / 2 }} />;
}

/** Nível em que a habilidade recebeu o 5º ponto (ou 99 se não chegou lá). */
function countUntilMax(m: Match, s: string): number {
  let n = 0;
  for (let i = 0; i < m.skillOrder.length; i++) if (m.skillOrder[i] === s && ++n === 5) return i;
  return 99 - n;
}

function RuneGroup({ title, runes, icons }: { title: string; runes: string[]; icons?: Record<string, string> }) {
  return (
    <View style={{ marginTop: space.md }}>
      <Text style={type.label}>{title}</Text>
      <View style={styles.runes}>
        {runes.map((name, i) => (
          <View key={`${name}-${i}`} style={styles.rune}>
            {icons?.[name] ? <RemoteIcon uri={runeIconUrl(icons[name])} size={18} /> : null}
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

export function MatchTimeline({ match: m, details }: { match: Match; details: DetailsState }) {
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
        <SectionHeader title="Linha do tempo" subtitle={details.status === 'ready' ? `${events.length} acontecimentos em ${duration(m.durationSec)}` : undefined} />
        {details.status !== 'ready' ? (
          <DetailsPending details={details} what="linha do tempo" />
        ) : events.length ? (
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
  kdaBig: { fontFamily: fonts.displayBold, fontSize: 24.5, color: colors.text },
  muted: { color: colors.textMuted },
  elo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  lp: { marginLeft: 'auto', fontFamily: fonts.bodyBold, fontSize: 12.5 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md },
  cmpHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  objGrid: { marginTop: space.md, gap: 2 },
  objRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  player: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  playerMe: { backgroundColor: colors.goldDim, borderRadius: radius.md, padding: 8, margin: -8, marginVertical: -3 },
  score: { fontFamily: fonts.display, fontSize: 14.5, color: colors.text },
  items: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemOff: { borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  itemOn: { borderRadius: 10, borderWidth: 2, borderColor: colors.gold },
  itemDivider: { width: 1, height: 28, backgroundColor: colors.border, marginHorizontal: 2 },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  skillKey: { width: 16, fontFamily: fonts.displayBold, fontSize: 13.5, color: colors.textSecondary },
  skillCell: { flex: 1, height: 22, borderRadius: 4, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  skillLvl: { fontFamily: fonts.bodyBold, fontSize: 9, color: '#fff' },
  keystone: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  keystoneImg: { position: 'absolute', top: 1, left: 1 },
  keystoneIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.goldDim, borderWidth: 1, borderColor: colors.gold },
  runes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  spells: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  spell: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10, paddingLeft: 4, height: 30, borderRadius: 15, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  rune: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  runeText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.textSecondary },
  event: { flexDirection: 'row', gap: space.md, minHeight: 40 },
  minute: { width: 30, textAlign: 'right', fontFamily: fonts.display, fontSize: 13.5, color: colors.textMuted, paddingTop: 3 },
  rail: { alignItems: 'center', width: 22 },
  node: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  railLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  eventText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, paddingTop: 2, paddingBottom: 12 },
});
