import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/theme';

import { css } from '../hooks';

/** Ícone "i" com explicação ao passar o mouse (ou ao tocar, em telas de toque). */
export function InfoTip({ text, side = 'bottom' }: { text: string; side?: 'bottom' | 'top' }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onHoverIn={() => setOpen(true)}
      onHoverOut={() => setOpen(false)}
      onPress={() => setOpen((o) => !o)}
      onBlur={() => setOpen(false)}
      accessibilityRole="button"
      accessibilityLabel={`Explicação: ${text}`}
      style={[{ position: 'relative' }, css({ cursor: 'help' })]}
      hitSlop={6}>
      <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
      {open ? (
        <View style={[styles.bubble, side === 'top' ? { bottom: 20 } : { top: 20 }]} pointerEvents="none">
          <Text style={styles.text}>{text}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Envolve qualquer elemento e mostra um texto ao passar o mouse. */
export function Hint({ text, children }: { text: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onHoverIn={() => setOpen(true)} onHoverOut={() => setOpen(false)} style={{ position: 'relative' }} accessibilityHint={text}>
      {children}
      {open ? (
        <View style={[styles.bubble, { bottom: '100%', marginBottom: 6 }]} pointerEvents="none">
          <Text style={styles.text}>{text}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    left: -8,
    zIndex: 50,
    width: 260,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...css({ boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }),
  },
  text: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
});
