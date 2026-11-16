import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildCoachReport, emptyCoachState, recordQuizAttempt, setGoal, setPlanDay, type CoachReport, type CoachState, type QuizResult } from '@/coach';
import type { DataSourceKind, Match, Player, Rank, RankSnapshot } from '@/types';

import { api } from './apiClient';

/** O que o treinador precisa saber sobre a conta carregada. */
export interface CoachContextData {
  player: Player;
  matches: Match[];
  rankHistory: RankSnapshot[];
  asOf: number;
  source: DataSourceKind;
}

/**
 * Contrato do treinador (Academy + Rank Predictor), com duas implementações:
 *  - LocalCoachService: modo demonstração. Roda o motor (src/coach) no aparelho
 *    e guarda o progresso no AsyncStorage.
 *  - RemoteCoachService: dados reais. Os cálculos e a persistência ficam no backend.
 * As duas usam o mesmo motor, então os resultados seguem as mesmas regras.
 */
export interface CoachService {
  getReport(ctx: CoachContextData): Promise<CoachReport>;
  submitAttempt(ctx: CoachContextData, lessonId: string, answers: number[], durationSec: number): Promise<{ result: QuizResult; report: CoachReport }>;
  setGoal(ctx: CoachContextData, rank: Rank | null): Promise<CoachReport>;
  setPlanDay(ctx: CoachContextData, day: number, done: boolean): Promise<CoachReport>;
}

const key = (playerId: string) => `lolinsight:coach:${playerId}`;

export class LocalCoachService implements CoachService {
  private async load(playerId: string): Promise<CoachState> {
    try {
      const raw = await AsyncStorage.getItem(key(playerId));
      const parsed = raw ? (JSON.parse(raw) as CoachState) : null;
      return parsed?.version === 1 ? parsed : emptyCoachState();
    } catch {
      return emptyCoachState();
    }
  }

  private async save(playerId: string, state: CoachState): Promise<void> {
    try {
      await AsyncStorage.setItem(key(playerId), JSON.stringify(state));
    } catch {
      // Sem persistência o treinador continua funcionando durante a sessão.
    }
  }

  private async build(ctx: CoachContextData, state: CoachState): Promise<CoachReport> {
    const result = buildCoachReport({ ...ctx, now: Date.now() }, state);
    await this.save(ctx.player.id, result.state);
    return result.report;
  }

  async getReport(ctx: CoachContextData) {
    return this.build(ctx, await this.load(ctx.player.id));
  }

  async submitAttempt(ctx: CoachContextData, lessonId: string, answers: number[], durationSec: number) {
    const { state, result } = recordQuizAttempt(await this.load(ctx.player.id), lessonId, answers, durationSec, Date.now());
    return { result, report: await this.build(ctx, state) };
  }

  async setGoal(ctx: CoachContextData, rank: Rank | null) {
    return this.build(ctx, setGoal(await this.load(ctx.player.id), rank, Date.now()));
  }

  async setPlanDay(ctx: CoachContextData, day: number, done: boolean) {
    return this.build(ctx, setPlanDay(await this.load(ctx.player.id), day, done, Date.now()));
  }
}

/**
 * Dados reais: o servidor usa o usuário autenticado e a conta Riot principal
 * vinculada a ele. Nenhum identificador de usuário ou de conta é enviado pelo app.
 */
export class RemoteCoachService implements CoachService {
  private baseUrl: string;

  constructor(
    baseUrl: string,
    private count: number,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private call<T>(suffix: string, body?: unknown): Promise<T> {
    api.setBaseUrl(this.baseUrl);
    return api.request<T>(`/v1/me/coach${suffix}?count=${this.count}`, body === undefined ? {} : { method: 'POST', body });
  }

  getReport() {
    return this.call<CoachReport>('');
  }

  submitAttempt(_ctx: CoachContextData, lessonId: string, answers: number[], durationSec: number) {
    return this.call<{ result: QuizResult; report: CoachReport }>('/attempts', { lessonId, answers, durationSec });
  }

  setGoal(_ctx: CoachContextData, rank: Rank | null) {
    return this.call<CoachReport>('/goal', { rank });
  }

  setPlanDay(_ctx: CoachContextData, day: number, done: boolean) {
    return this.call<CoachReport>('/plan-day', { day, done });
  }
}

const local = new LocalCoachService();

export function createCoachService(source: DataSourceKind, serverUrl: string, count: number): CoachService {
  return source === 'riot' ? new RemoteCoachService(serverUrl, count) : local;
}
