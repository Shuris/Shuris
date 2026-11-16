import { useRouter } from 'expo-router';
import React from 'react';

import type { CoachReport } from '@/coach';
import { ErrorCard } from '@/components/ErrorCard';
import { Card, EmptyState, ScreenSkeleton } from '@/components/ui';
import { AuthPrompt } from '@/components/auth/AccountCard';
import { useAuth } from '@/state/AuthContext';
import { useCoach } from '@/state/CoachContext';
import { usePlayer } from '@/state/PlayerContext';

/**
 * Estados comuns das telas do treinador: carregando, sem conta, falha do
 * servidor. Quando há relatório, entrega-o ao conteúdo.
 */
export function CoachGate({ children }: { children: (report: CoachReport) => React.ReactNode }) {
  const { status, data, settings } = usePlayer();
  const { report, loading, error, reload } = useCoach();
  const auth = useAuth();
  const router = useRouter();

  if (settings.mode === 'riot' && auth.status === 'signedOut') return <AuthPrompt />;
  if (status === 'loading' || (!report && loading)) return <ScreenSkeleton hero={false} cards={3} />;
  if (!report && error?.code === 'NO_RIOT_ACCOUNT') {
    return (
      <Card>
        <EmptyState icon="link-outline" title="Vincule sua conta Riot" message="Com dados reais, a Academy e a previsão de elo usam a conta Riot principal do seu perfil." actionLabel="Vincular conta Riot" onAction={() => router.push('/conta/riot')} />
      </Card>
    );
  }
  if (!data) {
    return (
      <Card>
        <EmptyState icon="search-outline" title="Nenhuma conta carregada" message="Pesquise um jogador na aba Início para liberar o treinador." actionLabel="Ir para o início" onAction={() => router.navigate('/')} />
      </Card>
    );
  }
  if (!report && error) return <ErrorCard error={error} actions={[{ label: 'Tentar novamente', primary: true, onPress: reload }]} />;
  if (!report) return <ScreenSkeleton hero={false} cards={3} />;
  return <>{children(report)}</>;
}
