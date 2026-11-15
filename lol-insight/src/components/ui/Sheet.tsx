import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius, space, type } from '@/theme';

interface SheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** Painel inferior usado pelos seletores de filtro. */
export function Sheet({ visible, title, onClose, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.grabber} />
        <View style={styles.head}>
          <Text style={type.h2}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fechar">
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: space.sm }}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

interface SheetOptionProps {
  label: string;
  detail?: string;
  selected?: boolean;
  onPress: () => void;
  left?: React.ReactNode;
}

export function SheetOption({ label, detail, selected, onPress, left }: SheetOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && { opacity: 0.7 }]}>
      {left}
      <Text style={[styles.optionLabel, selected && { color: colors.text }]}>{label}</Text>
      {detail ? <Text style={styles.optionDetail}>{detail}</Text> : null}
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={18} color={selected ? colors.accentSoft : colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.surfaceHigh, marginBottom: space.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 50,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    marginBottom: 4,
  },
  optionSelected: { backgroundColor: colors.accentDim },
  optionLabel: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.textSecondary },
  optionDetail: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
});
