import React from 'react';
import { Text, View } from 'react-native';

import { AuthPrompt } from '@/components/auth/AccountCard';
import { ErrorCard } from '@/components/ErrorCard';
import { EmptyState, ScreenSkeleton } from '@/components/ui';
import { useAuth } from '@/state/AuthContext';
import { usePlayer, type Derived } from '@/state/PlayerContext';
import { type } from '@/theme';

import { Panel } from './Panel';

/**
 * Decide o que a página mostra antes dos dados: carregando, login necessário
 * (dados reais), erro da busca ou "pesquise um jogador". Com dados, chama
 * `children(data)`. Assim nenhuma página web repete essa lógica.
 */
export function DataGate({ children, needMatches = true }: { children: (data: Derived) => React.ReactNode; needMatches?: boolean }) {
  const { status, data, error, settings, setMode, dismissError } = usePlayer();
  const auth = useAuth();
  const real = settings.mode === 'riot';
  if (real && auth.status === 'signedOut') return <AuthPrompt />;
  if (status === 'loading' && !data) return <ScreenSkeleton cards={3} />;
  if (error && !data)
    return (
      <ErrorCard
        error={error}
        actions={[
          { label: 'Usar demonstração', onPress: () => setMode('demo') },
          { label: 'Fechar', onPress: dismissError },
        ]}
      />
    );
  if (!data)
    return (
      <Panel>
        <EmptyState
          icon={real && auth.status === 'signedIn' && !auth.primary ? 'link-outline' : 'search-outline'}
          title={real && auth.status === 'signedIn' && !auth.primary ? 'Vincule sua conta Riot' : 'Pesquise um jogador'}
          message={real ? 'Use a busca no topo (Nome#TAG) ou vincule sua conta Riot em Conta.' : 'Use a busca no topo para carregar uma conta demonstrativa.'}
          actionLabel={real ? undefined : 'Abrir a demonstração'}
          onAction={real ? undefined : () => setMode('demo')}
        />
      </Panel>
    );
  if (needMatches && !data.matches.length)
    return (
      <Panel>
        <EmptyState icon="game-controller-outline" title={data.sync?.state === 'syncing' ? 'Carregando partidas…' : 'Sem partidas para analisar'} message="As análises aparecem assim que houver partidas de Summoner's Rift." />
      </Panel>
    );
  return (
    <View style={{ gap: 20 }}>
      {error ? (
        <Text style={[type.bodySm, { color: 'rgba(229,96,106,0.9)' }]} onPress={dismissError}>
          {error.message} (clique para fechar)
        </Text>
      ) : null}
      {children(data)}
    </View>
  );
}
