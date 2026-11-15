import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { champion, championIconUrl, itemIconUrl, ITEM_FALLBACK } from '@/data/champions';
import { ITEM_NAMES } from '@/data/items';
import { TIER_COLOR } from '@/stats/rank';
import { colors, fonts } from '@/theme';
import type { Rank } from '@/types';

/**
 * Imagem remota sobre um fallback desenhado localmente. Enquanto a imagem
 * oficial não carrega (ou se não houver rede), o fallback permanece visível.
 */
function RemoteImage({ uri, size, radius }: { uri: string; size: number; radius: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      style={{ position: 'absolute', width: size, height: size, borderRadius: radius }}
      resizeMode="cover"
    />
  );
}

const initials = (name: string) =>
  name
    .replace(/[^A-Za-zÀ-ú ]/g, '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export function ChampionAvatar({ id, size = 44, ring }: { id: string; size?: number; ring?: string }) {
  const c = champion(id);
  const r = Math.round(size * 0.28);
  return (
    <View
      accessibilityLabel={c.name}
      style={[
        styles.box,
        { width: size, height: size, borderRadius: r, backgroundColor: c.color },
        ring ? { borderWidth: 2, borderColor: ring } : null,
      ]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(7,9,13,0.38)' }]} />
      <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initials(c.name)}</Text>
      <RemoteImage uri={championIconUrl(id)} size={size} radius={ring ? r - 2 : r} />
    </View>
  );
}

export function ItemIcon({ id, size = 34 }: { id?: number; size?: number }) {
  const r = 8;
  if (!id) return <View style={[styles.itemEmpty, { width: size, height: size, borderRadius: r }]} />;
  const name = ITEM_NAMES[id] ?? 'Item';
  return (
    <View accessibilityLabel={name} style={[styles.box, { width: size, height: size, borderRadius: r, backgroundColor: ITEM_FALLBACK }]}>
      <Text style={[styles.initials, { fontSize: size * 0.3, color: colors.gold }]}>{initials(name)}</Text>
      <RemoteImage uri={itemIconUrl(id)} size={size} radius={r} />
    </View>
  );
}

export function ProfileAvatar({ name, uri, size = 64, level }: { name: string; uri: string; size?: number; level?: number }) {
  const r = Math.round(size * 0.3);
  return (
    <View style={{ width: size, height: size + (level ? 8 : 0) }}>
      <View style={[styles.box, { width: size, height: size, borderRadius: r, backgroundColor: '#16233D', borderWidth: 1.5, borderColor: colors.gold }]}>
        <Text style={[styles.initials, { fontSize: size * 0.36, color: colors.accentSoft }]}>{initials(name)}</Text>
        <RemoteImage uri={uri} size={size - 3} radius={r - 2} />
      </View>
      {level ? (
        <View style={styles.level}>
          <Text style={styles.levelText}>{level}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Emblema de elo desenhado em vetor, colorido pela liga. */
export function RankEmblem({ rank, size = 44 }: { rank: Rank; size?: number }) {
  const color = TIER_COLOR[rank.tier];
  const id = `rank-${rank.tier}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel={`Emblema ${rank.tier}`}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={1} />
          <Stop offset="1" stopColor={color} stopOpacity={0.35} />
        </LinearGradient>
      </Defs>
      <Path d="M24 3 L41 12 V28 C41 36 33.5 42 24 45 C14.5 42 7 36 7 28 V12 Z" fill="rgba(255,255,255,0.03)" stroke={`url(#${id})`} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M24 12 L33 24 L24 36 L15 24 Z" fill={`url(#${id})`} />
      <Path d="M24 12 L28 24 L24 36 L20 24 Z" fill="rgba(255,255,255,0.28)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { fontFamily: fonts.displayBold, color: 'rgba(255,255,255,0.92)', letterSpacing: 0.5 },
  itemEmpty: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  level: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    paddingHorizontal: 8,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.gold,
    justifyContent: 'center',
  },
  levelText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.gold },
});
