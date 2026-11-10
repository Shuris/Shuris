// Efeitos sonoros sintetizados em tempo real (Web Audio). Sem arquivos externos:
// impactos, metal dos escudos, lâminas cortando o ar, corneta, fanfarras e o público.

export type Sfx =
  | 'hit'
  | 'crit'
  | 'block'
  | 'whoosh'
  | 'dodge'
  | 'skill'
  | 'guard'
  | 'horn'
  | 'victory'
  | 'defeat'
  | 'click'
  | 'coin'
  | 'levelup'
  | 'train'
  | 'exhausted'
  | 'step'
  | 'equip'
  | 'error';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private crowdGain: GainNode | null = null;
  private crowdSrc: AudioBufferSourceNode | null = null;
  private volume = 0.7;
  private muted = false;
  /** contadores (diagnóstico e testes automatizados) */
  played = 0;
  lastPlayed: Sfx | null = null;

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  get contextState(): string {
    return this.ctx?.state ?? 'none';
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolume();
  }

  private applyVolume(): void {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.8, this.ctx.currentTime, 0.02);
  }

  // ------------------------------------------------------------ primitivas
  private tone(freq: number, dur: number, type: OscillatorType, gain: number, at = 0, slideTo?: number, attack = 0.005): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master!);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, filter: BiquadFilterType, freq: number, gain: number, at = 0, freqTo?: number, q = 1): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t0);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t0 + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
  }

  // ------------------------------------------------------------ efeitos
  play(name: Sfx, intensity = 1): void {
    if (this.muted || this.volume <= 0) return;
    if (!this.ensure()) return;
    this.played++;
    this.lastPlayed = name;
    const k = Math.max(0.3, Math.min(1.5, intensity));
    const r = () => 0.94 + Math.random() * 0.12; // leve variação
    switch (name) {
      case 'hit':
        this.noise(0.12, 'lowpass', 1400 * r(), 0.55 * k);
        this.tone(150 * r(), 0.16, 'sine', 0.7 * k, 0, 50);
        break;
      case 'crit':
        this.noise(0.2, 'lowpass', 2200, 0.7);
        this.tone(110, 0.3, 'sine', 0.9, 0, 38);
        this.tone(70, 0.35, 'triangle', 0.5, 0.02, 35);
        break;
      case 'block':
        for (const [f, g] of [
          [1180, 0.16],
          [1870, 0.11],
          [2650, 0.08],
          [3420, 0.05],
        ] as const)
          this.tone(f * r(), 0.35, 'square', g * k * 0.5, 0, f * 0.97);
        this.noise(0.05, 'highpass', 3000, 0.3 * k);
        this.tone(220, 0.1, 'sine', 0.25 * k, 0, 120);
        break;
      case 'whoosh':
        this.noise(0.2, 'bandpass', 500, 0.35, 0, 2200, 1.5);
        break;
      case 'dodge':
        this.noise(0.16, 'bandpass', 1400, 0.3, 0, 3800, 2);
        this.noise(0.08, 'lowpass', 300, 0.15, 0.1);
        break;
      case 'skill':
        this.tone(660, 0.18, 'triangle', 0.18);
        this.tone(990, 0.22, 'triangle', 0.16, 0.07);
        break;
      case 'guard':
        this.tone(330, 0.4, 'triangle', 0.2);
        this.tone(495, 0.4, 'triangle', 0.14, 0.05);
        this.tone(660, 0.5, 'sine', 0.1, 0.1);
        break;
      case 'horn': {
        // cornu romano: duas notas de metal
        for (const [f, at, d] of [
          [196, 0, 0.42],
          [262, 0.45, 0.7],
        ] as const) {
          this.tone(f, d, 'sawtooth', 0.12, at, undefined, 0.05);
          this.tone(f * 2, d, 'square', 0.03, at, undefined, 0.06);
        }
        break;
      }
      case 'victory':
        [392, 523, 659, 784].forEach((f, i) => this.tone(f, i === 3 ? 0.7 : 0.16, 'triangle', 0.22, i * 0.13));
        [196, 262].forEach((f, i) => this.tone(f, 0.6, 'sawtooth', 0.05, 0.39 + i * 0.01, undefined, 0.04));
        break;
      case 'defeat':
        [392, 349, 311, 262].forEach((f, i) => this.tone(f, i === 3 ? 0.9 : 0.3, 'triangle', 0.2, i * 0.28));
        break;
      case 'click':
        this.tone(880, 0.05, 'square', 0.06);
        break;
      case 'equip':
        this.tone(520, 0.08, 'square', 0.06);
        this.noise(0.06, 'highpass', 2500, 0.12, 0.02);
        break;
      case 'coin':
        this.tone(1320, 0.08, 'square', 0.07);
        this.tone(1760, 0.16, 'square', 0.07, 0.07);
        break;
      case 'levelup':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, i === 3 ? 0.5 : 0.12, 'square', 0.08, i * 0.09));
        break;
      case 'train':
        this.tone(120, 0.14, 'sine', 0.5, 0, 55);
        this.noise(0.1, 'lowpass', 900, 0.35);
        break;
      case 'exhausted':
        this.tone(300, 0.4, 'sine', 0.18, 0, 140, 0.05);
        break;
      case 'step':
        this.noise(0.06, 'lowpass', 420, 0.12 * k);
        break;
      case 'error':
        this.tone(200, 0.14, 'square', 0.08);
        break;
    }
  }

  /** Murmúrio contínuo do público na arena. */
  startCrowd(): void {
    if (this.crowdSrc || this.muted || !this.ensure()) return;
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 650;
    f.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.07, ctx.currentTime, 0.8);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.17;
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(g.gain);
    lfo.start();
    src.connect(f).connect(g).connect(this.master!);
    src.start();
    this.crowdSrc = src;
    this.crowdGain = g;
  }

  stopCrowd(): void {
    if (!this.crowdSrc || !this.ctx || !this.crowdGain) return;
    const src = this.crowdSrc;
    this.crowdGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    setTimeout(() => {
      try {
        src.stop();
      } catch {
        /* já parado */
      }
    }, 1200);
    this.crowdSrc = null;
    this.crowdGain = null;
  }

  private rainGain: GainNode | null = null;

  /** Som contínuo de chuva (0 = desligado). */
  setRain(intensity: number): void {
    if (intensity <= 0.02 && !this.rainGain) return;
    if (!this.ensure()) return;
    const ctx = this.ctx!;
    if (!this.rainGain) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1200;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 6000;
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 0;
      src.connect(hp).connect(lp).connect(this.rainGain).connect(this.master!);
      src.start();
    }
    this.rainGain.gain.setTargetAtTime(this.muted ? 0 : intensity * 0.09, ctx.currentTime, 0.5);
  }

  /** Explosão de torcida (golpes fortes, início e fim da luta). */
  cheer(intensity = 1): void {
    if (this.muted || this.volume <= 0 || !this.ensure()) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 0.6;
    const g = ctx.createGain();
    const peak = 0.22 * Math.min(1.5, intensity);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t0, Math.random());
    src.stop(t0 + 2.4);
  }
}

export const sound = new SoundManager();
