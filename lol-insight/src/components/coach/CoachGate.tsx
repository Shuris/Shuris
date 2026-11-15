import { useRouter } from 'expo-router';
import React from 'react';

import type { CoachReport } from '@/coach';
import { ErrorCard } from '@/components/ErrorCard';
import { Card, EmptyState, ScreenSkeleton } from '@/components/ui';
import { useCoach } from '@/state/CoachContext';
import { usePlayer } from '@/state/PlayerContext';

/**
 * Estados comuns das telas do treinador: carregando, sem conta, falha do
 * servidor. Quando há relatório, entrega-o ao conteúdo.
 */
export function CoachGate({ children }: { children: (report: CoachReport) => React.ReactNode }) {
  const { status, data } = usePlayer();
  const { report, loading, error, reload } = useCoach();
  const router = useRouter();

  if (status === 'loading' || (!report && loading)) return <ScreenSkeleton hero={false} cards={3} />;
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
