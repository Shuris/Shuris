import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip, ChipRow, Sheet, SheetOption } from '@/components/ui';
import { parseRiotId, type AccountQuery, type AccountSuggestion } from '@/services';
import { colors, fonts, radius, space, type } from '@/theme';
import type { Region } from '@/types';

export const REGIONS: Array<{ value: Region; label: string }> = [
  { value: 'BR', label: 'Brasil' },
  { value: 'NA', label: 'América do Norte' },
  { value: 'EUW', label: 'Europa Ocidental' },
  { value: 'EUNE', label: 'Europa Nórdica e Leste' },
  { value: 'KR', label: 'Coreia' },
  { value: 'LAN', label: 'América Latina Norte' },
  { value: 'LAS', label: 'América Latina Sul' },
  { value: 'JP', label: 'Japão' },
  { value: 'OCE', label: 'Oceania' },
  { value: 'TR', label: 'Turquia' },
];

interface SearchBarProps {
  region: Region;
  onRegionChange: (r: Region) => void;
  onSearch: (q: AccountQuery) => void;
  recent: AccountSuggestion[];
  suggestions: AccountSuggestion[];
  busy?: boolean;
}

export function SearchBar({ region, onRegionChange, onSearch, recent, suggestions, busy }: SearchBarProps) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);

  const submit = () => {
    const { gameName, tagLine } = parseRiotId(text);
    if (!gameName) return;
    Keyboard.dismiss();
    onSearch({ gameName, tagLine, region });
  };
  const choose = (a: AccountSuggestion) => {
    setText(`${a.gameName}#${a.tagLine}`);
    onRegionChange(a.region);
    Keyboard.dismiss();
    onSearch(a);
  };

  const shortcuts = [...recent, ...suggestions.filter((s) => !recent.some((r) => r.gameName === s.gameName && r.tagLine === s.tagLine))];

  return (
    <View style={{ gap: space.sm }}>
      <View style={[styles.field, focused && { borderColor: 'rgba(92,155,255,0.6)' }]}>
        <Pressable
          onPress={() => setRegionOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Região: ${region}. Toque para alterar`}
          style={({ pressed }) => [styles.region, pressed && { opacity: 0.7 }]}>
          <Text style={styles.regionText}>{region}</Text>
          <Ionicons name="chevron-down" size={12} color={colors.gold} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={submit}
          placeholder="Buscar invocador (Nome#TAG)"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Buscar invocador"
          style={styles.input}
        />
        {text.length > 0 ? (
          <Pressable onPress={() => setText('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Limpar busca">
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={submit}
          disabled={busy || !text.trim()}
          accessibilityRole="button"
          accessibilityLabel="Pesquisar"
          style={({ pressed }) => [styles.go, (busy || !text.trim()) && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}>
          <Ionicons name="search" size={17} color="#fff" />
        </Pressable>
      </View>

      {shortcuts.length > 0 ? (
        <ChipRow>
          {shortcuts.map((a) => (
            <Chip
              key={`${a.gameName}#${a.tagLine}`}
              icon={recent.includes(a) ? 'time-outline' : 'person-outline'}
              label={`${a.gameName}#${a.tagLine} · ${a.region}`}
              onPress={() => choose(a)}
            />
          ))}
        </ChipRow>
      ) : null}

      <Sheet visible={regionOpen} title="Região" onClose={() => setRegionOpen(false)}>
        {REGIONS.map((r) => (
          <SheetOption
            key={r.value}
            label={r.label}
            detail={r.value}
            selected={r.value === region}
            onPress={() => {
              onRegionChange(r.value);
              setRegionOpen(false);
            }}
          />
        ))}
        <Text style={[type.bodySm, { marginTop: space.sm, paddingHorizontal: space.md }]}>
          A região define em qual servidor a conta será procurada.
        </Text>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    paddingLeft: 6,
    paddingRight: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  region: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: colors.goldDim,
  },
  regionText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.gold, letterSpacing: 0.5 },
  input: { flex: 1, minWidth: 0, height: 46, fontFamily: fonts.body, fontSize: 14, color: colors.text, outlineStyle: 'none' } as never,
  go: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
});
