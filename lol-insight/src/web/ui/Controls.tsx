import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';

import { colors, fonts, radius, space } from '@/theme';

import { css } from '../hooks';

/** No navegador o Pressable também informa `hovered`. */
export type WebPress = PressableStateCallbackType & { hovered?: boolean };

export interface Opt<T extends string | number> {
  value: T;
  label: string;
}

/** Menu suspenso compacto para filtros. Fecha ao escolher ou ao clicar fora. */
export function Dropdown<T extends string | number>({ label, value, options, onChange, width = 180 }: { label: string; value: T; options: ReadonlyArray<Opt<T>>; onChange: (v: T) => void; width?: number }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={{ position: 'relative', zIndex: open ? 100 : 1 }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? ''}`}
        style={[styles.trigger, open && { borderColor: 'rgba(92,155,255,0.55)' }, css({ cursor: 'pointer' })]}>
        <Text style={styles.triggerLabel}>{label}</Text>
        <Text style={styles.triggerValue} numberOfLines={1}>
          {current?.label ?? '—'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <>
          <Pressable onPress={() => setOpen(false)} style={[{ position: 'absolute' }, css({ position: 'fixed', inset: 0 })]} accessibilityLabel="Fechar menu" />
          <View style={[styles.menu, { minWidth: width }]} accessibilityRole="menu">
            {options.map((o) => (
              <Pressable
                key={String(o.value)}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: o.value === value }}
                style={({ hovered }: WebPress) => [styles.item, (hovered || o.value === value) && { backgroundColor: colors.surfaceHigh }, css({ cursor: 'pointer' })]}>
                <Text style={[styles.itemText, o.value === value && { color: colors.text, fontFamily: fonts.bodyBold }]}>{o.label}</Text>
                {o.value === value ? <Ionicons name="checkmark" size={14} color={colors.accentSoft} /> : null}
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** Abas horizontais (seleção exclusiva) no estilo da versão web. */
export function Tabs<T extends string | number>({ value, options, onChange }: { value: T; options: ReadonlyArray<Opt<T>>; onChange: (v: T) => void }) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            style={({ hovered }: WebPress) => [styles.tab, on && styles.tabOn, hovered && !on && { backgroundColor: colors.surfaceAlt }, css({ cursor: 'pointer' })]}>
            <Text style={[styles.tabText, on && { color: colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Button({ label, icon, onPress, kind = 'primary', disabled, accessibilityLabel }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; accessibilityLabel?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ hovered, pressed }: WebPress) => [
        styles.btn,
        kind === 'primary' ? styles.btnPrimary : kind === 'danger' ? styles.btnDanger : styles.btnGhost,
        (hovered || pressed) && { opacity: 0.85 },
        disabled && { opacity: 0.4 },
        css({ cursor: disabled ? 'not-allowed' : 'pointer' }),
      ]}>
      {icon ? <Ionicons name={icon} size={15} color={kind === 'primary' ? '#fff' : kind === 'danger' ? colors.loss : colors.accentSoft} /> : null}
      <Text style={[styles.btnText, { color: kind === 'primary' ? '#fff' : kind === 'danger' ? colors.loss : colors.accentSoft }]}>{label}</Text>
    </Pressable>
  );
}

export function Tag({ text, color = colors.accentSoft }: { text: string; color?: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: `${color}1f` }]}>
      <Text style={[styles.tagText, { color }]}>{text}</Text>
    </View>
  );
}

/** Aviso padrão quando a amostra não permite conclusões. */
export function SampleNotice({ have, need, what = 'partidas' }: { have: number; need: number; what?: string }) {
  return (
    <View style={styles.notice}>
      <Ionicons name="hourglass-outline" size={16} color={colors.textMuted} />
      <Text style={styles.noticeText}>
        Amostra insuficiente: {have} {what} (mínimo {need}). O LOL Insight não tira conclusões com tão poucos dados.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: 'transparent' },
  triggerLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.textMuted, letterSpacing: 0.4 },
  triggerValue: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text, maxWidth: 160 },
  menu: { position: 'absolute', top: 40, left: 0, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 4, zIndex: 101, ...css({ boxShadow: '0 12px 32px rgba(0,0,0,0.5)', maxHeight: 360, overflowY: 'auto' }) },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8, paddingHorizontal: 12 },
  itemText: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 3, alignSelf: 'flex-start' },
  tab: { paddingHorizontal: 14, height: 30, borderRadius: radius.md - 3, justifyContent: 'center' },
  tabOn: { backgroundColor: colors.surfaceHigh },
  tabText: { fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.textMuted },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 36, paddingHorizontal: 14, borderRadius: radius.md },
  btnPrimary: { backgroundColor: colors.accent },
  btnGhost: { backgroundColor: colors.accentDim },
  btnDanger: { backgroundColor: colors.lossDim },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  tag: { borderRadius: radius.pill, paddingHorizontal: 8, height: 20, justifyContent: 'center', alignSelf: 'flex-start' },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.4 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  noticeText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
});
