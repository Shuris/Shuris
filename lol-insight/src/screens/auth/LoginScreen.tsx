import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, EMAIL_RE, Field, FormError, FormNotice } from '@/components/auth/Form';
import { Card, Screen } from '@/components/ui';
import { ServiceError } from '@/services';
import { useAuth } from '@/state/AuthContext';
import { usePlayer } from '@/state/PlayerContext';
import { colors, fonts, space, type } from '@/theme';

export function LoginScreen() {
  const auth = useAuth();
  const { settings, setMode } = usePlayer();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ServiceError | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const emailError = touched && !EMAIL_RE.test(email.trim()) ? 'Informe um e-mail válido.' : null;
  const submit = async () => {
    setTouched(true);
    if (!EMAIL_RE.test(email.trim()) || !password) return;
    setBusy(true);
    setError(null);
    try {
      await auth.login({ email: email.trim(), password });
      if (settings.mode !== 'riot') setMode('riot');
      router.replace('/conta');
    } catch (e) {
      setError(e instanceof ServiceError ? e : new ServiceError('UNKNOWN', 'Não foi possível entrar.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Entrar" subtitle="Acesse sua conta do LOL Insight" back>
      <Card>
        <View style={{ gap: space.lg }}>
          <Field label="E-mail" icon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" error={emailError} placeholder="voce@exemplo.com" />
          <Field label="Senha" icon="lock-closed-outline" value={password} onChangeText={setPassword} secret autoComplete="current-password" textContentType="password" onSubmitEditing={submit} returnKeyType="go" />
          <FormError error={error} />
          <Button label="Entrar" onPress={submit} loading={busy} />
          <Pressable onPress={() => router.push({ pathname: '/recuperar-senha', params: { email: email.trim() } })} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center' }}>
            <Text style={styles.link}>Esqueci minha senha</Text>
          </Pressable>
        </View>
      </Card>
      <View style={styles.footer}>
        <Text style={type.bodySm}>Ainda não tem conta?</Text>
        <Pressable onPress={() => router.replace('/cadastro')} hitSlop={8} accessibilityRole="button">
          <Text style={styles.link}>Criar conta</Text>
        </Pressable>
      </View>
      {settings.mode === 'demo' ? <FormNotice>Ao entrar, o app passa para o modo de dados reais. O modo demonstração continua disponível em Perfil → Fonte de dados e não exige conta.</FormNotice> : null}
    </Screen>
  );
}

export const styles = StyleSheet.create({
  link: { fontFamily: fonts.bodySemi, fontSize: 13.5, color: colors.accentSoft },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
});
