import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { forwardRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { REGIONS } from '@/components/SearchBar';
import { parseRiotId, type AccountSuggestion } from '@/services/PlayerDataSource';
import { usePlayer } from '@/state/PlayerContext';
import { colors, fonts, radius } from '@/theme';
import type { Region } from '@/types';

import { css } from '../hooks';
import { Dropdown } from '../ui';

/** Busca global por Riot ID na barra superior. "/" coloca o foco aqui. */
export type SearchInputRef = React.ComponentRef<typeof TextInput>;

export const WebSearch = forwardRef<SearchInputRef, { compact?: boolean }>(function WebSearch({ compact }, ref) {
  const { search, recent, suggestions, status, data } = usePlayer();
  const router = useRouter();
  const [text, setText] = useState('');
  const [region, setRegion] = useState<Region>(data?.player.region ?? 'BR');
  const [focused, setFocused] = useState(false);
  const busy = status === 'loading';

  const go = async (q: { gameName: string; tagLine?: string; region: Region }) => {
    setFocused(false);
    const ok = await search(q);
    if (ok) router.navigate('/');
  };
  const submit = () => {
    const { gameName, tagLine } = parseRiotId(text);
    if (gameName) void go({ gameName, tagLine, region });
  };
  const same = (a: AccountSuggestion, b: AccountSuggestion) => a.gameName === b.gameName && a.tagLine === b.tagLine && a.region === b.region;
  const list = [...recent, ...suggestions.filter((s) => !recent.some((r) => same(r, s)))].slice(0, 6);

  return (
    <View style={[styles.wrap, compact && { maxWidth: undefined }]}>
      <Dropdown label="" value={region} options={REGIONS.map((r) => ({ value: r.value, label: r.value }))} onChange={setRegion} width={120} />
      <View style={[styles.field, focused && { borderColor: 'rgba(92,155,255,0.6)' }]}>
        <Ionicons name="search" size={15} color={colors.textMuted} />
        <TextInput
          ref={ref}
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Buscar invocador (Nome#TAG)"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Buscar invocador"
          style={[styles.input, css({ outlineStyle: 'none' })]}
        />
        {busy ? <ActivityIndicator size="small" color={colors.accentSoft} /> : compact ? null : <Text style={styles.kbd}>/</Text>}
      </View>
      {focused && list.length ? (
        <View style={styles.menu}>
          <Text style={styles.menuTitle}>{recent.length ? 'Recentes e sugestões' : 'Contas demonstrativas'}</Text>
          {list.map((a) => (
            <Pressable
              key={`${a.gameName}#${a.tagLine}@${a.region}`}
              onPress={() => void go(a)}
              style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surfaceHigh }, css({ cursor: 'pointer' })]}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${a.gameName}#${a.tagLine}`}>
              <Ionicons name="person-outline" size={14} color={colors.textMuted} />
              <Text style={styles.itemText}>
                {a.gameName}
                <Text style={{ color: colors.textMuted }}>#{a.tagLine}</Text>
              </Text>
              <Text style={styles.itemRegion}>{a.region}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 8, flex: 1, maxWidth: 560, position: 'relative', zIndex: 20 },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: 'transparent' },
  input: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 13.5, height: 34 },
  kbd: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.textMuted, borderWidth: 1, borderColor: colors.border, borderRadius: 4, paddingHorizontal: 5 },
  menu: { position: 'absolute', top: 42, left: 0, right: 0, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, ...css({ boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }) },
  menuTitle: { fontFamily: fonts.bodySemi, fontSize: 10.5, letterSpacing: 0.8, color: colors.textMuted, textTransform: 'uppercase', paddingHorizontal: 12, paddingVertical: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  itemText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  itemRegion: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.textMuted },
});
