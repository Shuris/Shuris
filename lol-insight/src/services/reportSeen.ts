import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Última partida cujo relatório o usuário já abriu, por origem dos dados e
 * conta. Serve para destacar "relatório novo" e para não notificar a mesma
 * partida duas vezes. Fica só no aparelho.
 */
const key = (source: string, playerId: string) => `lolinsight:reportSeen:${source}:${playerId}`;
const listeners = new Set<() => void>();

export async function lastSeenReport(source: string, playerId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key(source, playerId));
  } catch {
    return null;
  }
}

export async function markReportSeen(source: string, playerId: string, matchId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(source, playerId), matchId);
  } catch {
    // Sem armazenamento: o destaque só reaparece na próxima abertura.
  }
  listeners.forEach((l) => l());
}

export function onReportSeen(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
