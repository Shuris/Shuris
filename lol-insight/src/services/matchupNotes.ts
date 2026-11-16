import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from './apiClient';

export type Difficulty = 'facil' | 'equilibrado' | 'dificil';

export interface MatchupNote {
  championId: string;
  opponentId: string;
  difficulty: Difficulty;
  note: string;
  updatedAt: number;
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { facil: 'Fácil', equilibrado: 'Equilibrado', dificil: 'Difícil' };
export const NOTE_MAX_CHARS = 1000;

/**
 * Onde ficam as anotações do caderno de matchups:
 *  - demonstração: só neste aparelho (AsyncStorage), sem conta;
 *  - dados reais: no servidor, na conta do usuário logado.
 */
export interface MatchupStore {
  list(): Promise<MatchupNote[]>;
  save(n: Omit<MatchupNote, 'updatedAt'>): Promise<MatchupNote>;
  remove(championId: string, opponentId: string): Promise<void>;
}

const DEMO_KEY = 'lolinsight.demo.matchups.v1';

export class LocalMatchupStore implements MatchupStore {
  private async read(): Promise<MatchupNote[]> {
    try {
      const raw = await AsyncStorage.getItem(DEMO_KEY);
      return raw ? (JSON.parse(raw) as MatchupNote[]) : [];
    } catch {
      return [];
    }
  }
  private async write(list: MatchupNote[]) {
    await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(list));
  }
  async list() {
    return (await this.read()).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async save(n: Omit<MatchupNote, 'updatedAt'>) {
    const note = { ...n, note: n.note.trim().slice(0, NOTE_MAX_CHARS), updatedAt: Date.now() };
    const rest = (await this.read()).filter((x) => !(x.championId === n.championId && x.opponentId === n.opponentId));
    await this.write([note, ...rest]);
    return note;
  }
  async remove(championId: string, opponentId: string) {
    await this.write((await this.read()).filter((x) => !(x.championId === championId && x.opponentId === opponentId)));
  }
}

export class RemoteMatchupStore implements MatchupStore {
  async list() {
    return (await api.request<{ notes: MatchupNote[] }>('/v1/me/matchups')).notes;
  }
  async save(n: Omit<MatchupNote, 'updatedAt'>) {
    return (await api.request<{ note: MatchupNote }>('/v1/me/matchups', { method: 'POST', body: n })).note;
  }
  async remove(championId: string, opponentId: string) {
    await api.request(`/v1/me/matchups/${encodeURIComponent(championId)}/${encodeURIComponent(opponentId)}`, { method: 'DELETE' });
  }
}

export async function clearDemoMatchups() {
  await AsyncStorage.removeItem(DEMO_KEY).catch(() => undefined);
}
