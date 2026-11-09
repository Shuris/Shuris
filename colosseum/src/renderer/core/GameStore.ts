// Contêiner de estado do jogo: mantém o PlayerState, notifica a interface
// e salva automaticamente (com debounce) através de um adaptador de persistência.
import type { PlayerState } from './model/types';
import { parseSave, serialize } from './systems/SaveSystem';

export interface Persistence {
  read(): Promise<{ data: string | null; source: string; error?: string }>;
  write(data: string): Promise<{ ok: boolean; error?: string }>;
  writeSync(data: string): { ok: boolean; error?: string };
}

type Listener = (p: PlayerState) => void;

export class GameStore {
  private player: PlayerState | null = null;
  private listeners = new Set<Listener>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  lastSaveError: string | null = null;
  lastSavedAt = 0;
  onSaveError: ((msg: string) => void) | null = null;

  constructor(private readonly persistence: Persistence, private readonly debounceMs = 400) {}

  async load(): Promise<{ player: PlayerState | null; notice: string | null }> {
    const res = await this.persistence.read();
    if (!res.data) return { player: null, notice: res.error ?? null };
    const parsed = parseSave(res.data);
    if (!parsed.ok) return { player: null, notice: `Não foi possível carregar o progresso: ${parsed.error}` };
    this.player = parsed.player;
    let notice = res.error ?? null;
    if (parsed.warnings.length) notice = `Alguns dados salvos foram corrigidos (${parsed.warnings.length}).`;
    return { player: parsed.player, notice };
  }

  get state(): PlayerState {
    if (!this.player) throw new Error('Nenhum gladiador carregado.');
    return this.player;
  }

  get hasPlayer(): boolean {
    return !!this.player;
  }

  setPlayer(p: PlayerState): void {
    this.player = p;
    this.commit();
  }

  /** Aplica uma mutação ao estado, notifica a interface e agenda o salvamento. */
  update<T>(fn: (p: PlayerState) => T): T {
    const result = fn(this.state);
    this.commit();
    return result;
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private commit(): void {
    const p = this.state;
    p.updatedAt = Date.now();
    this.listeners.forEach((l) => l(p));
    this.scheduleSave();
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), this.debounceMs);
  }

  async flush(): Promise<boolean> {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (!this.player || !this.dirty) return true;
    this.dirty = false;
    const res = await this.persistence.write(serialize(this.player));
    return this.handleResult(res);
  }

  flushSync(): boolean {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (!this.player || !this.dirty) return true;
    this.dirty = false;
    return this.handleResult(this.persistence.writeSync(serialize(this.player)));
  }

  private handleResult(res: { ok: boolean; error?: string }): boolean {
    if (res.ok) {
      this.lastSaveError = null;
      this.lastSavedAt = Date.now();
      return true;
    }
    this.dirty = true;
    this.lastSaveError = res.error ?? 'erro desconhecido';
    this.onSaveError?.(this.lastSaveError);
    return false;
  }

  reset(): void {
    this.player = null;
    this.dirty = false;
  }
}
