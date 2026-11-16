import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, EMAIL_RE, Field, FormError, FormNotice, PASSWORD_MIN, USERNAME_RE } from '@/components/auth/Form';
import { Card, Screen } from '@/components/ui';
import { ServiceError } from '@/services';
import { useAuth } from '@/state/AuthContext';
import { usePlayer } from '@/state/PlayerContext';
import { space, type } from '@/theme';

import { styles } from './LoginScreen';

export function RegisterScreen() {
  const auth = useAuth();
  const { settings, setMode } = usePlayer();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<ServiceError | null>(null);
  const [busy, setBusy] = useState(false);

  const errors = {
    username: !USERNAME_RE.test(username.trim()) ? 'De 3 a 20 caracteres: letras, números, ponto, hífen ou sublinhado.' : null,
    email: !EMAIL_RE.test(email.trim()) ? 'Informe um e-mail válido.' : null,
    password: password.length < PASSWORD_MIN ? `Use pelo menos ${PASSWORD_MIN} caracteres.` : null,
    confirm: confirm !== password ? 'As senhas não coincidem.' : null,
  };
  const valid = !Object.values(errors).some(Boolean);

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await auth.register({ username: username.trim(), email: email.trim(), password });
      if (settings.mode !== 'riot') setMode('riot');
      router.replace('/verificar-email');
    } catch (e) {
      setError(e instanceof ServiceError ? e : new ServiceError('UNKNOWN', 'Não foi possível criar a conta.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Criar conta" subtitle="Seu perfil individual no LOL Insight" back>
      <Card>
        <View style={{ gap: space.lg }}>
          <Field label="Nome de usuário" icon="person-outline" value={username} onChangeText={setUsername} autoComplete="username" textContentType="username" error={touched ? errors.username : null} hint="Visível no seu perfil." />
          <Field label="E-mail" icon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" error={touched ? errors.email : null} hint="Usado para confirmar a conta e recuperar a senha." />
          <Field label="Senha" icon="lock-closed-outline" value={password} onChangeText={setPassword} secret autoComplete="new-password" textContentType="newPassword" error={touched ? errors.password : null} hint={`Pelo menos ${PASSWORD_MIN} caracteres. Frases longas são mais seguras.`} />
          <Field label="Confirmar senha" icon="lock-closed-outline" value={confirm} onChangeText={setConfirm} secret autoComplete="new-password" error={touched ? errors.confirm : null} onSubmitEditing={submit} returnKeyType="go" />
          <FormError error={error} />
          <Button label="Criar conta" onPress={submit} loading={busy} />
        </View>
      </Card>
      <FormNotice icon="shield-checkmark-outline">Sua senha é guardada apenas como hash no servidor. O LOL Insight nunca pede a senha da sua conta Riot.</FormNotice>
      <View style={styles.footer}>
        <Text style={type.bodySm}>Já tem conta?</Text>
        <Pressable onPress={() => router.replace('/entrar')} hitSlop={8} accessibilityRole="button">
          <Text style={styles.link}>Entrar</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
