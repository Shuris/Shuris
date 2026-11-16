import AsyncStorage from '@react-native-async-storage/async-storage';

import { attemptKey, buildState, dayOf, demoHistory, grade, type ChallengeAttempt, type ChallengeState } from '@/challenge';

import { api } from './apiClient';

export interface RankingEntry {
  position: number;
  username: string;
  xp: number;
  solved: number;
  you: boolean;
}
export interface Ranking {
  entries: RankingEntry[];
  optedIn: boolean;
  you: RankingEntry | null;
  /** true quando os nomes são fictícios (demonstração). */
  demo: boolean;
}

/**
 * LOL Challenge com duas origens, mesmas regras (src/challenge):
 *  - demonstração: histórico fictício + respostas guardadas neste aparelho;
 *  - conta real: o servidor corrige e guarda; o app só monta a visão.
 */
export interface ChallengeService {
  readonly kind: 'demo' | 'account';
  load(): Promise<ChallengeState>;
  submit(challengeId: string, answer: number, daily: boolean): Promise<{ attempt: ChallengeAttempt; alreadyAnswered: boolean; state: ChallengeState }>;
  ranking(): Promise<Ranking>;
  setRanking(optIn: boolean): Promise<void>;
}

/** Deslocamento do fuso local em minutos (Brasília = −180). */
export const tzOffset = () => -new Date().getTimezoneOffset();
const today = () => dayOf(Date.now(), tzOffset());

const DEMO_KEY = 'lolinsight.demo.challenge.v1';

export class LocalChallengeService implements ChallengeService {
  readonly kind = 'demo' as const;
  private async own(): Promise<ChallengeAttempt[]> {
    try {
      const raw = await AsyncStorage.getItem(DEMO_KEY);
      return raw ? (JSON.parse(raw) as ChallengeAttempt[]) : [];
    } catch {
      return [];
    }
  }
  async load() {
    const t = today();
    return buildState([...demoHistory(t), ...(await this.own())], t);
  }
  async submit(challengeId: string, answer: number, daily: boolean) {
    const t = today();
    const own = await this.own();
    const all = [...demoHistory(t), ...own];
    const attempt = grade(challengeId, answer, Date.now(), t, daily);
    const existing = all.find((a) => attemptKey(a) === attemptKey(attempt));
    if (existing) return { attempt: existing, alreadyAnswered: true, state: buildState(all, t) };
    const next = [...own, attempt];
    await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(next)).catch(() => undefined);
    return { attempt, alreadyAnswered: false, state: buildState([...demoHistory(t), ...next], t) };
  }
  async ranking(): Promise<Ranking> {
    const s = await this.load();
    const names: Array<[string, number, number]> = [
      ['Faísca_Hextech', 1640, 52],
      ['LuaDeZaun', 1210, 41],
      ['Piltover_Pro', 980, 33],
      ['MidOuNada', 760, 27],
      ['SentinelaAzul', 420, 15],
    ];
    const rows = [...names.map(([username, xp, solved]) => ({ username, xp, solved, you: false })), { username: 'Gregory (você)', xp: s.xp, solved: s.attempts.filter((a) => a.correct).length, you: true }]
      .sort((a, b) => b.xp - a.xp)
      .map((r, i) => ({ ...r, position: i + 1 }));
    return { entries: rows, optedIn: true, you: rows.find((r) => r.you) ?? null, demo: true };
  }
  async setRanking() {}
}

export class RemoteChallengeService implements ChallengeService {
  readonly kind = 'account' as const;
  async load() {
    const r = await api.request<{ today: string; attempts: ChallengeAttempt[] }>(`/v1/me/challenge?tz=${tzOffset()}`);
    return buildState(r.attempts, r.today);
  }
  async submit(challengeId: string, answer: number, daily: boolean) {
    const r = await api.request<{ attempt: ChallengeAttempt; alreadyAnswered: boolean }>('/v1/me/challenge/attempts', { method: 'POST', body: { challengeId, answer, daily, tzOffsetMin: tzOffset() } });
    return { ...r, state: await this.load() };
  }
  async ranking(): Promise<Ranking> {
    const r = await api.request<Omit<Ranking, 'demo'>>('/v1/me/challenge/ranking');
    return { ...r, demo: false };
  }
  async setRanking(optIn: boolean) {
    await api.request('/v1/me/challenge/ranking', { method: 'POST', body: { optIn } });
  }
}
