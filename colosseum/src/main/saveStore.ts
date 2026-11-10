// Persistência em disco do progresso, em app.getPath('userData')/saves.
// Três espaços de salvamento (slot1..slot3). Gravação atômica (arquivo temporário
// + rename) com cópia de segurança. O save único das versões antigas vira o slot 1.
import fs from 'node:fs';
import path from 'node:path';
import { MAX_SAVE_BYTES, isSlot, type SaveReadResult, type SaveWriteResult } from '../shared/ipc';

export class SaveStore {
  readonly dir: string;

  constructor(userData: string) {
    this.dir = path.join(userData, 'saves');
    this.migrateLegacy();
  }

  file(slot: number): string {
    return path.join(this.dir, `slot${slot}.json`);
  }

  private backupOf(slot: number): string {
    return path.join(this.dir, `slot${slot}.backup.json`);
  }

  /** Versões até a 0.5 tinham um único save: ele passa a ser o slot 1. */
  private migrateLegacy(): void {
    try {
      const old = path.join(this.dir, 'gladiador.json');
      const oldBackup = path.join(this.dir, 'gladiador.backup.json');
      if (fs.existsSync(this.file(1))) return;
      if (fs.existsSync(old)) fs.renameSync(old, this.file(1));
      if (fs.existsSync(oldBackup)) fs.renameSync(oldBackup, this.backupOf(1));
    } catch {
      /* se falhar, o save antigo continua onde estava */
    }
  }

  private readValid(file: string): string | null {
    try {
      if (!fs.existsSync(file)) return null;
      const stat = fs.statSync(file);
      if (stat.size === 0 || stat.size > MAX_SAVE_BYTES) return null;
      const text = fs.readFileSync(file, 'utf8');
      JSON.parse(text); // valida estrutura JSON; a validação de conteúdo ocorre no jogo
      return text;
    } catch {
      return null;
    }
  }

  read(slot: number): SaveReadResult {
    if (!isSlot(slot)) return { ok: false, data: null, source: 'none', error: 'slot inválido' };
    const primary = this.readValid(this.file(slot));
    if (primary) return { ok: true, data: primary, source: 'primary' };
    const backup = this.readValid(this.backupOf(slot));
    if (backup) {
      const corrupted = fs.existsSync(this.file(slot));
      return { ok: true, data: backup, source: 'backup', error: corrupted ? 'Arquivo principal corrompido; backup carregado.' : undefined };
    }
    return { ok: true, data: null, source: 'none' };
  }

  write(slot: number, data: string): SaveWriteResult {
    try {
      if (!isSlot(slot)) return { ok: false, error: 'slot inválido' };
      const file = this.file(slot);
      if (typeof data !== 'string' || data.length === 0) return { ok: false, error: 'Dados vazios.' };
      if (Buffer.byteLength(data, 'utf8') > MAX_SAVE_BYTES) return { ok: false, error: 'Dados muito grandes.' };
      JSON.parse(data);
      fs.mkdirSync(this.dir, { recursive: true });
      const tmp = `${file}.tmp`;
      const fd = fs.openSync(tmp, 'w');
      try {
        fs.writeSync(fd, data, 0, 'utf8');
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      if (this.readValid(file)) fs.copyFileSync(file, this.backupOf(slot));
      fs.renameSync(tmp, file);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  remove(slot: number): SaveWriteResult {
    try {
      if (!isSlot(slot)) return { ok: false, error: 'slot inválido' };
      for (const f of [this.file(slot), this.backupOf(slot)]) if (fs.existsSync(f)) fs.rmSync(f);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
