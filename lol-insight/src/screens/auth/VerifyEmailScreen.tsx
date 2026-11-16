import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Field, FormError, FormNotice } from '@/components/auth/Form';
import { Card, Screen, SectionHeader } from '@/components/ui';
import { ServiceError } from '@/services';
import { useAuth } from '@/state/AuthContext';
import { space } from '@/theme';

import { useEmailDelivery } from './useServerInfo';

export function VerifyEmailScreen() {
  const auth = useAuth();
  const router = useRouter();
  const delivery = useEmailDelivery();
  const [code, setCode] = useState('');
  const [error, setError] = useState<ServiceError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'verify' | 'resend' | null>(null);

  useEffect(() => {
    if (auth.status === 'signedOut') router.replace('/entrar');
  }, [auth.status, router]);

  const run = async (kind: 'verify' | 'resend') => {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      if (kind === 'verify') {
        await auth.verifyEmail(code.trim());
        router.replace('/conta');
      } else {
        await auth.resendVerification();
        setNotice('Enviamos um novo código. O anterior deixou de valer.');
      }
    } catch (e) {
      setError(e instanceof ServiceError ? e : new ServiceError('UNKNOWN', 'Não foi possível concluir.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title="Confirmar e-mail" subtitle={auth.user?.email} back>
      <Card>
        <SectionHeader title="Digite o código de 6 dígitos" subtitle={`Enviado para ${auth.user?.email ?? 'o seu e-mail'}. Vale por 24 horas.`} />
        <View style={{ gap: space.lg }}>
          <Field label="Código" icon="keypad-outline" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" placeholder="000000" onSubmitEditing={() => void run('verify')} />
          <FormError error={error} />
          {notice ? <FormNotice tone="success" icon="checkmark-circle-outline">{notice}</FormNotice> : null}
          <Button label="Confirmar e-mail" onPress={() => void run('verify')} loading={busy === 'verify'} disabled={code.length !== 6} />
          <Button label="Enviar novo código" variant="ghost" onPress={() => void run('resend')} loading={busy === 'resend'} />
        </View>
      </Card>
      {delivery === 'console' ? (
        <FormNotice tone="warning" icon="construct-outline">
          Servidor em modo de desenvolvimento: nenhum e-mail é enviado de verdade. O código aparece no terminal onde o servidor está rodando.
        </FormNotice>
      ) : null}
      <Button label="Fazer isso depois" variant="secondary" onPress={() => router.replace('/conta')} />
    </Screen>
  );
}
