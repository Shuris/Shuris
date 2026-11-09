// Persistência em disco do progresso, em app.getPath('userData')/saves.
// Gravação atômica (arquivo temporário + rename) com cópia de segurança.
import fs from 'node:fs';
import path from 'node:path';
import { MAX_SAVE_BYTES, type SaveReadResult, type SaveWriteResult } from '../shared/ipc';

export class SaveStore {
  readonly dir: string;
  readonly file: string;
  readonly backup: string;

  constructor(userData: string) {
    this.dir = path.join(userData, 'saves');
    this.file = path.join(this.dir, 'gladiador.json');
    this.backup = path.join(this.dir, 'gladiador.backup.json');
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

  read(): SaveReadResult {
    const primary = this.readValid(this.file);
    if (primary) return { ok: true, data: primary, source: 'primary' };
    const backup = this.readValid(this.backup);
    if (backup) {
      const corrupted = fs.existsSync(this.file);
      return { ok: true, data: backup, source: 'backup', error: corrupted ? 'Arquivo principal corrompido; backup carregado.' : undefined };
    }
    return { ok: true, data: null, source: 'none' };
  }

  write(data: string): SaveWriteResult {
    try {
      if (typeof data !== 'string' || data.length === 0) return { ok: false, error: 'Dados vazios.' };
      if (Buffer.byteLength(data, 'utf8') > MAX_SAVE_BYTES) return { ok: false, error: 'Dados muito grandes.' };
      JSON.parse(data);
      fs.mkdirSync(this.dir, { recursive: true });
      const tmp = `${this.file}.tmp`;
      const fd = fs.openSync(tmp, 'w');
      try {
        fs.writeSync(fd, data, 0, 'utf8');
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      if (this.readValid(this.file)) fs.copyFileSync(this.file, this.backup);
      fs.renameSync(tmp, this.file);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  remove(): SaveWriteResult {
    try {
      for (const f of [this.file, this.backup]) if (fs.existsSync(f)) fs.rmSync(f);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
