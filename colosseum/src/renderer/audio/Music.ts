// Música de fundo sintetizada em tempo real (Web Audio), sem arquivos externos.
// Cada faixa é um pequeno sequenciador: lira dedilhada, flauta, bordão, metais e
// tambores, em escalas mediterrâneas (dórica, frígia dominante, pentatônica).
// Pode ser desligada nas Opções (preferência guardada no computador).
import { sound } from './SoundManager';

export type Track = 'menu' | 'city' | 'night' | 'tavern' | 'arena' | 'none';

interface Prefs {
  on: boolean;
  volume: number;
}

const KEY = 'colosseum.music';

function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
    return { on: raw.on !== false, volume: typeof raw.volume === 'number' ? Math.max(0, Math.min(1, raw.volume)) : 0.45 };
  } catch {
    return { on: true, volume: 0.45 };
  }
}

/** Frequência de uma nota MIDI. */
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Escalas (graus em semitons a partir da tônica). */
const SCALES = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygianDom: [0, 1, 4, 5, 7, 8, 10],
  minorPenta: [0, 3, 5, 7, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

interface Song {
  bpm: number;
  root: number;
  scale: number[];
  /** acordes (graus da escala) por compasso */
  chords: number[];
  /** padrão da lira: graus relativos ao acorde por semicolcheia (null = pausa) */
  lyre: Array<number | null>;
  /** melodia (flauta ou metais) por compasso: [semicolcheia, grau, duração em semicolcheias] */
  melody: Array<Array<[number, number, number]>>;
  lead: 'flute' | 'horn' | 'none';
  /** tambor grave e pandeiro (16 posições, 1 = bate) */
  drum: number[];
  tamb: number[];
  drone: boolean;
  lyreGain: number;
}

const SONGS: Record<Exclude<Track, 'none'>, Song> = {
  menu: {
    bpm: 70, root: 50, scale: SCALES.phrygianDom, chords: [0, 0, 5, 6, 0, 0, 5, 4],
    lyre: [0, null, null, null, 2, null, null, null, 4, null, null, null, 2, null, null, null],
    melody: [
      [[0, 7, 6], [8, 8, 4], [12, 9, 4]],
      [[0, 8, 8], [8, 7, 8]],
      [[0, 5, 6], [8, 6, 4], [12, 7, 4]],
      [[0, 6, 12]],
      [[0, 7, 4], [4, 9, 4], [8, 10, 8]],
      [[0, 9, 8], [8, 8, 8]],
      [[0, 7, 6], [8, 6, 4], [12, 5, 4]],
      [[0, 4, 16]],
    ],
    lead: 'horn', drum: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0], tamb: Array(16).fill(0), drone: true, lyreGain: 0.07,
  },
  city: {
    bpm: 96, root: 50, scale: SCALES.dorian, chords: [0, 6, 5, 6, 0, 3, 4, 0],
    lyre: [0, 2, 4, 2, 7, 4, 2, 4, 0, 2, 4, 2, 7, 4, 2, 4],
    melody: [
      [[0, 7, 4], [4, 8, 2], [6, 9, 2], [8, 11, 6], [14, 9, 2]],
      [[0, 8, 8], [8, 6, 4], [12, 7, 4]],
      [], [[8, 6, 2], [10, 7, 2], [12, 8, 4]],
      [[0, 9, 6], [6, 8, 2], [8, 7, 8]],
      [[0, 5, 4], [4, 7, 4], [8, 8, 8]],
      [[0, 6, 4], [4, 5, 4], [8, 4, 4], [12, 6, 4]],
      [[0, 7, 16]],
    ],
    lead: 'flute', drum: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0], tamb: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], drone: false, lyreGain: 0.06,
  },
  night: {
    bpm: 62, root: 45, scale: SCALES.minorPenta, chords: [0, 0, 3, 2, 0, 0, 2, 1],
    lyre: [0, null, null, 2, null, null, 4, null, null, 3, null, null, 2, null, null, null],
    melody: [[], [[0, 7, 8], [8, 6, 8]], [], [[4, 5, 4], [8, 6, 8]], [], [[0, 8, 8], [8, 7, 8]], [], [[0, 5, 16]]],
    lead: 'flute', drum: Array(16).fill(0), tamb: Array(16).fill(0), drone: true, lyreGain: 0.05,
  },
  tavern: {
    bpm: 128, root: 52, scale: SCALES.mixolydian, chords: [0, 0, 3, 4, 0, 0, 6, 4],
    lyre: [0, 4, 2, 4, 0, 4, 2, 4, 1, 4, 2, 4, 0, 4, 7, 4],
    melody: [
      [[0, 7, 2], [2, 8, 2], [4, 9, 4], [8, 7, 2], [10, 8, 2], [12, 9, 4]],
      [[0, 10, 4], [4, 9, 4], [8, 8, 8]],
      [[0, 8, 2], [2, 9, 2], [4, 10, 4], [8, 8, 4], [12, 7, 4]],
      [[0, 8, 4], [4, 7, 4], [8, 6, 8]],
      [[0, 7, 2], [2, 8, 2], [4, 9, 4], [8, 11, 4], [12, 9, 4]],
      [[0, 10, 4], [4, 9, 4], [8, 8, 8]],
      [[0, 9, 4], [4, 8, 4], [8, 7, 4], [12, 6, 4]],
      [[0, 7, 8], [12, 4, 4]],
    ],
    lead: 'flute', drum: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], tamb: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1], drone: false, lyreGain: 0.055,
  },
  arena: {
    bpm: 116, root: 50, scale: SCALES.phrygianDom, chords: [0, 0, 1, 0, 0, 0, 5, 1],
    lyre: [0, null, 0, null, 2, null, 0, null, 0, null, 0, null, 1, null, 0, null],
    melody: [
      [[0, 7, 4], [4, 7, 2], [6, 8, 2], [8, 9, 8]],
      [[0, 8, 4], [4, 7, 4], [8, 8, 8]],
      [[0, 7, 4], [4, 7, 2], [6, 8, 2], [8, 10, 8]],
      [[0, 9, 4], [4, 8, 4], [8, 7, 8]],
      [[0, 10, 4], [4, 9, 4], [8, 10, 4], [12, 11, 4]],
      [[0, 12, 8], [8, 11, 8]],
      [[0, 10, 4], [4, 9, 4], [8, 8, 4], [12, 9, 4]],
      [[0, 7, 16]],
    ],
    lead: 'horn', drum: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1], tamb: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], drone: true, lyreGain: 0.045,
  },
};

class MusicPlayer {
  private prefs = loadPrefs();
  private bus: GainNode | null = null;
  private trackGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private current: Track = 'none';
  private wanted: Track = 'none';
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  /** faixa tocando agora (testes e diagnóstico) */
  get track(): Track {
    return this.current;
  }
  get enabled(): boolean {
    return this.prefs.on;
  }
  get volume(): number {
    return this.prefs.volume;
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.prefs));
    } catch {
      /* preferência opcional */
    }
  }

  setEnabled(on: boolean): void {
    this.prefs.on = on;
    this.save();
    if (!on) this.stop();
    else this.play(this.wanted);
  }

  setVolume(v: number): void {
    this.prefs.volume = Math.max(0, Math.min(1, v));
    this.save();
    const ctx = this.ctx();
    if (ctx && this.bus) this.bus.gain.setTargetAtTime(this.prefs.volume * 0.6, ctx.currentTime, 0.1);
  }

  private ctx(): AudioContext | null {
    const ctx = sound.audioContext();
    if (!ctx) return null;
    if (!this.bus) {
      this.bus = ctx.createGain();
      this.bus.gain.value = this.prefs.volume * 0.6;
      this.bus.connect(ctx.destination);
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return ctx;
  }

  /** Troca de faixa com fade (a mesma faixa continua tocando sem reiniciar). */
  play(track: Track): void {
    this.wanted = track;
    if (!this.prefs.on || track === 'none') return this.stop();
    if (track === this.current) return;
    const ctx = this.ctx();
    if (!ctx || !this.bus) return;
    this.fadeOut();
    this.current = track;
    this.trackGain = ctx.createGain();
    this.trackGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.trackGain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.5);
    this.trackGain.connect(this.bus);
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 60);
    if (SONGS[track].drone) this.startDrone(SONGS[track]);
  }

  stop(): void {
    this.fadeOut();
    this.current = 'none';
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private fadeOut(): void {
    const ctx = sound.audioContext();
    const g = this.trackGain;
    if (!ctx || !g) return;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    setTimeout(() => g.disconnect(), 1500);
    this.trackGain = null;
  }

  private note(song: Song, degree: number, octave = 0): number {
    const sc = song.scale;
    const o = Math.floor(degree / sc.length);
    const idx = ((degree % sc.length) + sc.length) % sc.length;
    return hz(song.root + sc[idx] + 12 * (o + octave));
  }

  private schedule(): void {
    const ctx = sound.audioContext();
    if (!ctx || this.current === 'none' || !this.trackGain) return;
    const song = SONGS[this.current as Exclude<Track, 'none'>];
    const sixteenth = 60 / song.bpm / 4;
    // se o relógio de áudio pulou (janela travada, troca de dispositivo, suspensão),
    // pula as notas perdidas em vez de tocar todas de uma vez
    if (this.nextTime < ctx.currentTime - 0.1) this.nextTime = ctx.currentTime + 0.05;
    let guard = 0;
    while (this.nextTime < ctx.currentTime + 0.2 && guard++ < 16) {
      const bar = Math.floor(this.step / 16) % song.chords.length;
      const pos = this.step % 16;
      const chord = song.chords[bar];
      const t = this.nextTime;
      const lyre = song.lyre[pos];
      if (lyre !== null && lyre !== undefined) this.pluck(t, this.note(song, chord + lyre, 0), song.lyreGain);
      if (pos === 0) this.pluck(t, this.note(song, chord, -1), song.lyreGain * 1.2, 1.4);
      for (const [at, deg, dur] of song.melody[bar] ?? []) {
        if (at !== pos) continue;
        if (song.lead === 'flute') this.flute(t, this.note(song, deg, 0), dur * sixteenth);
        else if (song.lead === 'horn') this.horn(t, this.note(song, deg, -1), dur * sixteenth);
      }
      if (song.drum[pos]) this.drum(t, pos === 0 ? 1 : 0.7);
      if (song.tamb[pos]) this.tamb(t);
      this.nextTime += sixteenth;
      this.step++;
    }
  }

  private out(): GainNode {
    return this.trackGain as GainNode;
  }

  private pluck(t: number, f: number, gain: number, dur = 0.9): void {
    const ctx = sound.audioContext()!;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    o.type = 'triangle';
    o2.type = 'square';
    o.frequency.value = f;
    o2.frequency.value = f * 2.003;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 6, t);
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur);
    const g2 = ctx.createGain();
    g2.gain.value = 0.12;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(lp).connect(this.out());
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }

  private flute(t: number, f: number, dur: number): void {
    const ctx = sound.audioContext()!;
    const o = ctx.createOscillator();
    const vib = ctx.createOscillator();
    const vg = ctx.createGain();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f * 2;
    vib.frequency.value = 5.2;
    vg.gain.value = f * 0.012;
    vib.connect(vg).connect(o.frequency);
    const end = t + Math.max(0.15, dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.06);
    g.gain.setValueAtTime(0.05, end - 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.1);
    o.connect(g).connect(this.out());
    // sopro (ruído suave)
    if (this.noise) {
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * 2;
      bp.Q.value = 8;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.012, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      n.connect(bp).connect(ng).connect(this.out());
      n.start(t);
      n.stop(t + 0.15);
    }
    o.start(t);
    vib.start(t);
    o.stop(end + 0.15);
    vib.stop(end + 0.15);
  }

  private horn(t: number, f: number, dur: number): void {
    const ctx = sound.audioContext()!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 1.5, t);
    lp.frequency.linearRampToValueAtTime(f * 5, t + 0.08);
    lp.frequency.linearRampToValueAtTime(f * 3, t + Math.max(0.2, dur));
    const end = t + Math.max(0.2, dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.05);
    g.gain.setValueAtTime(0.04, end - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.12);
    for (const det of [0, 4]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(g);
      o.start(t);
      o.stop(end + 0.15);
    }
    g.connect(lp).connect(this.out());
  }

  private drum(t: number, k: number): void {
    const ctx = sound.audioContext()!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    g.gain.setValueAtTime(0.22 * k, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.out());
    o.start(t);
    o.stop(t + 0.32);
    if (this.noise) {
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 500;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.08 * k, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      n.connect(lp).connect(ng).connect(this.out());
      n.start(t, Math.random() * 0.5);
      n.stop(t + 0.1);
    }
  }

  private tamb(t: number): void {
    if (!this.noise) return;
    const ctx = sound.audioContext()!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.035, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    n.connect(hp).connect(g).connect(this.out());
    n.start(t, Math.random() * 0.5);
    n.stop(t + 0.1);
  }

  /** Bordão contínuo (tônica e quinta) enquanto a faixa toca. */
  private startDrone(song: Song): void {
    const ctx = sound.audioContext()!;
    const g = ctx.createGain();
    g.gain.value = 0.018;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const oscs = [hz(song.root - 12), hz(song.root - 5)].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = i ? -5 : 5;
      o.connect(lp);
      o.start();
      return o;
    });
    lp.connect(g).connect(this.out());
    const owner = this.trackGain;
    const check = setInterval(() => {
      if (this.trackGain !== owner) {
        clearInterval(check);
        setTimeout(() => oscs.forEach((o) => o.stop()), 1600);
      }
    }, 500);
  }
}

export const music = new MusicPlayer();
