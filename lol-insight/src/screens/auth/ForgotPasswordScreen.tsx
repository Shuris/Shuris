import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, EMAIL_RE, Field, FormError, FormNotice, PASSWORD_MIN } from '@/components/auth/Form';
import { Card, Screen, SectionHeader } from '@/components/ui';
import { ServiceError } from '@/services';
import { authApi } from '@/services/authApi';
import { space } from '@/theme';

import { useEmailDelivery } from './useServerInfo';

export function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const delivery = useEmailDelivery();
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<ServiceError | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const attempt = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ServiceError ? e : new ServiceError('UNKNOWN', 'Não foi possível concluir.'));
    } finally {
      setBusy(false);
    }
  };

  const requestCode = () =>
    attempt(async () => {
      setTouched(true);
      if (!EMAIL_RE.test(email.trim())) return;
      const res = await authApi.forgot(email.trim());
      setMessage(res.message);
      setTouched(false);
      setStep('reset');
    });

  const reset = () =>
    attempt(async () => {
      setTouched(true);
      if (code.length !== 6 || password.length < PASSWORD_MIN || password !== confirm) return;
      await authApi.reset({ email: email.trim(), code, password });
      setStep('done');
    });

  return (
    <Screen title="Recuperar senha" subtitle="Redefina a senha com um código enviado ao seu e-mail" back>
      {step === 'email' ? (
        <Card>
          <SectionHeader title="Qual é o e-mail da conta?" subtitle="Enviaremos um código de redefinição que vale por 15 minutos." />
          <View style={{ gap: space.lg }}>
            <Field label="E-mail" icon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" error={touched && !EMAIL_RE.test(email.trim()) ? 'Informe um e-mail válido.' : null} onSubmitEditing={requestCode} />
            <FormError error={error} />
            <Button label="Enviar código" onPress={requestCode} loading={busy} />
          </View>
        </Card>
      ) : null}

      {step === 'reset' ? (
        <Card>
          <SectionHeader title="Crie uma nova senha" subtitle={email.trim()} />
          <View style={{ gap: space.lg }}>
            {message ? <FormNotice>{message}</FormNotice> : null}
            <Field label="Código" icon="keypad-outline" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" placeholder="000000" error={touched && code.length !== 6 ? 'O código tem 6 dígitos.' : null} />
            <Field label="Nova senha" icon="lock-closed-outline" value={password} onChangeText={setPassword} secret autoComplete="new-password" error={touched && password.length < PASSWORD_MIN ? `Use pelo menos ${PASSWORD_MIN} caracteres.` : null} />
            <Field label="Confirmar nova senha" icon="lock-closed-outline" value={confirm} onChangeText={setConfirm} secret autoComplete="new-password" error={touched && confirm !== password ? 'As senhas não coincidem.' : null} onSubmitEditing={reset} />
            <FormError error={error} />
            <Button label="Redefinir senha" onPress={reset} loading={busy} />
            <Button label="Usar outro e-mail" variant="ghost" onPress={() => (setStep('email'), setCode(''), setError(null))} />
          </View>
        </Card>
      ) : null}

      {step === 'done' ? (
        <Card>
          <View style={{ gap: space.lg }}>
            <FormNotice tone="success" icon="checkmark-circle-outline">
              Senha redefinida. Por segurança, todas as sessões abertas foram encerradas: entre de novo com a nova senha.
            </FormNotice>
            <Button label="Ir para o login" onPress={() => router.replace('/entrar')} />
          </View>
        </Card>
      ) : null}

      {delivery === 'console' && step !== 'done' ? (
        <FormNotice tone="warning" icon="construct-outline">
          Servidor em modo de desenvolvimento: nenhum e-mail é enviado de verdade. O código aparece no terminal onde o servidor está rodando.
        </FormNotice>
      ) : null}
    </Screen>
  );
}
