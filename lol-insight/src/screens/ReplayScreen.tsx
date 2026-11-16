import React from 'react';
import { Text } from 'react-native';

import { Card, EmptyState, Screen } from '@/components/ui';
import { type } from '@/theme';

/** No Android, o Replay Challenge fica para a versão web (importar arquivos e analisar com espaço). */
export function ReplayScreen() {
  return (
    <Screen title="Replay Challenge" back>
      <Card>
        <EmptyState icon="film-outline" title="Disponível na versão web" message="Importar replays e analisar decisões em momentos reais das partidas pede uma tela maior. Abra o LOL Insight no navegador do computador." />
        <Text style={[type.bodySm, { textAlign: 'center' }]}>O relatório pós-partida, com o mapa das mortes, continua disponível em cada partida do app.</Text>
      </Card>
    </Screen>
  );
}
