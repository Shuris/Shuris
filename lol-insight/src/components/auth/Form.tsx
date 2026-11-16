import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { describeError, type ServiceError } from '@/services';
import { colors, fonts, radius, space, type } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  icon?: IconName;
  error?: string | null;
  hint?: string;
  /** Campo de senha com botão para mostrar/ocultar. */
  secret?: boolean;
}

export function Field({ label, icon, error, hint, secret, ...input }: FieldProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={type.label}>{label}</Text>
      <View style={[styles.field, focused && { borderColor: 'rgba(92,155,255,0.6)' }, !!error && { borderColor: colors.loss }]}>
        {icon ? <Ionicons name={icon} size={16} color={colors.textMuted} /> : null}
        <TextInput
          {...input}
          secureTextEntry={secret && !visible}
          autoCapitalize={input.autoCapitalize ?? 'none'}
          autoCorrect={false}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={label}
          onFocus={(e) => (setFocused(true), input.onFocus?.(e))}
          onBlur={(e) => (setFocused(false), input.onBlur?.(e))}
          style={styles.input}
        />
        {secret ? (
          <Pressable onPress={() => setVisible((v) => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}>
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={type.bodySm}>{hint}</Text> : null}
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName;
}

export function Button({ label, onPress, loading, disabled, variant = 'primary', icon }: ButtonProps) {
  const off = disabled || loading;
  const tone = {
    primary: { bg: colors.accent, border: colors.accent, text: '#fff' },
    secondary: { bg: colors.surfaceAlt, border: colors.border, text: colors.text },
    danger: { bg: colors.lossDim, border: colors.loss, text: colors.loss },
    ghost: { bg: 'transparent', border: 'transparent', text: colors.accentSoft },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [styles.button, { backgroundColor: tone.bg, borderColor: tone.border }, off && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}>
      {loading ? (
        <ActivityIndicator size="small" color={tone.text} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={16} color={tone.text} /> : null}
          <Text style={[styles.buttonText, { color: tone.text }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Erro de um formulário: título e orientação específicos do código devolvido pelo servidor. */
export function FormError({ error }: { error: ServiceError | null }) {
  if (!error) return null;
  const p = describeError(error.code);
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Ionicons name={p.icon} size={16} color={colors.loss} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={[type.h3, { color: colors.loss }]}>{p.title}</Text>
        <Text style={type.bodySm}>{error.message}</Text>
      </View>
    </View>
  );
}

export function FormNotice({ icon = 'information-circle-outline', tone = 'info', children }: { icon?: IconName; tone?: 'info' | 'success' | 'warning'; children: React.ReactNode }) {
  const color = tone === 'success' ? colors.good : tone === 'warning' ? colors.warning : colors.accentSoft;
  return (
    <View style={[styles.banner, { borderColor: `${color}66`, backgroundColor: `${color}14` }]} accessibilityLiveRegion="polite">
      <Ionicons name={icon} size={16} color={color} style={{ marginTop: 1 }} />
      <Text style={[type.bodySm, { flex: 1, color: colors.text }]}>{children}</Text>
    </View>
  );
}

/** Selo de status (ex.: "E-mail confirmado", "Não verificada"). */
export function StatusBadge({ label, tone }: { label: string; tone: 'success' | 'warning' | 'neutral' }) {
  const color = tone === 'success' ? colors.good : tone === 'warning' ? colors.warning : colors.textSecondary;
  return (
    <View style={[styles.badge, { borderColor: `${color}66`, backgroundColor: `${color}1A` }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const USERNAME_RE = /^[A-Za-z0-9_.-]{3,20}$/;
export const PASSWORD_MIN = 8;

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, minWidth: 0, height: 46, fontFamily: fonts.body, fontSize: 14.5, color: colors.text, outlineStyle: 'none' } as never,
  error: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.loss },
  button: { flexDirection: 'row', gap: 8, height: 48, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  banner: { flexDirection: 'row', gap: 10, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(229,96,106,0.45)', backgroundColor: colors.lossDim },
  badge: { alignSelf: 'flex-start', height: 22, paddingHorizontal: 8, borderRadius: 11, borderWidth: 1, justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.4 },
});
