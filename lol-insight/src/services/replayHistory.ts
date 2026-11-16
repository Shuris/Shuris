import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ReplayAnalysisRecord } from '@/replay/decisions';

import { api } from './apiClient';

/** Histórico do Replay Challenge: no aparelho (demonstração) ou na conta (dados reais). */
export interface ReplayHistoryStore {
  list(): Promise<ReplayAnalysisRecord[]>;
  save(r: Omit<ReplayAnalysisRecord, 'at' | 'score'>): Promise<ReplayAnalysisRecord>;
}

const KEY = 'lolinsight.demo.replay.v1';

export class LocalReplayHistory implements ReplayHistoryStore {
  async list() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as ReplayAnalysisRecord[]) : [];
    } catch {
      return [];
    }
  }
  async save(r: Omit<ReplayAnalysisRecord, 'at' | 'score'>) {
    const rec: ReplayAnalysisRecord = { ...r, at: Date.now(), score: r.answers.filter((a) => a.correct).length / Math.max(1, r.answers.length) };
    const next = [rec, ...(await this.list()).filter((x) => x.matchId !== r.matchId)].slice(0, 100);
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
    return rec;
  }
}

export class RemoteReplayHistory implements ReplayHistoryStore {
  async list() {
    return (await api.request<{ analyses: ReplayAnalysisRecord[] }>('/v1/me/replay-analyses')).analyses;
  }
  async save(r: Omit<ReplayAnalysisRecord, 'at' | 'score'>) {
    return (await api.request<{ analysis: ReplayAnalysisRecord }>('/v1/me/replay-analyses', { method: 'POST', body: r })).analysis;
  }
}
