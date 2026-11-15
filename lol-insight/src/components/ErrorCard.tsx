import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState } from '@/components/ui';
import { describeError, type ServiceError } from '@/services';
import { colors, fonts, radius, space, type } from '@/theme';

interface Action {
  label: string;
  onPress: () => void;
  primary?: boolean;
}

/** Explica uma falha de busca com título, causa e orientação específicos do tipo de erro. */
export function ErrorCard({ error, actions = [] }: { error: ServiceError; actions?: Action[] }) {
  const p = describeError(error.code);
  return (
    <Card>
      <EmptyState icon={p.icon} title={p.title} message={error.message} />
      <Text style={[type.bodySm, styles.hint]}>{p.hint}</Text>
      {actions.length ? (
        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable key={a.label} onPress={a.onPress} accessibilityRole="button" style={({ pressed }) => [styles.btn, a.primary && styles.primary, pressed && { opacity: 0.7 }]}>
              <Text style={[styles.btnText, a.primary && { color: '#fff' }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  hint: { textAlign: 'center', marginTop: -space.md, paddingHorizontal: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm, marginTop: space.lg },
  btn: { height: 38, paddingHorizontal: 16, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
});
