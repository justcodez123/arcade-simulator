/**
 * Hybrid Audio Engine:
 * - 100% procedural Web Audio API sound effects synthesizer (zero-latency SFX)
 * - Offline-bundled Gemini 3.8 TTS announcer voiceovers + Lyria 3.5 BGM loop
 */
let sharedAudioContext: AudioContext | null = null;
let bgmAudio: HTMLAudioElement | null = null;
let welcomeAudio: HTMLAudioElement | null = null;
let gameOverAudio: HTMLAudioElement | null = null;
let highScoreAudio: HTMLAudioElement | null = null;
let reviveAudio: HTMLAudioElement | null = null;
let welcomePlayedThisSession = false;

function getOrCreateAudio(
  current: HTMLAudioElement | null,
  src: string,
  volume = 0.75,
  loop = false
): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!current) {
    current = new Audio(src);
    current.preload = 'auto';
    current.volume = volume;
    current.loop = loop;
  }
  return current;
}

function safePlayClip(clip: HTMLAudioElement | null): void {
  if (!clip) return;
  try {
    clip.currentTime = 0;
    const p = clip.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {});
    }
  } catch {
    // Ignore autoplay/browser audio restrictions gracefully
  }
}

export class SoundEffects {
  private muted: boolean = false;

  constructor(initialMuted = false) {
    this.muted = initialMuted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!sharedAudioContext) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioContext = new AudioCtx();
      }
    }
    if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.syncBgmState();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public syncBgmState(): void {
    bgmAudio = getOrCreateAudio(bgmAudio, './audio/arcade-bgm.mp3', 0.25, true);
    if (!bgmAudio) return;

    if (this.muted) {
      bgmAudio.pause();
    } else if (bgmAudio.paused) {
      const p = bgmAudio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    }
  }

  public playVoiceWelcome(): void {
    if (this.muted || welcomePlayedThisSession) return;
    welcomePlayedThisSession = true;
    welcomeAudio = getOrCreateAudio(welcomeAudio, './audio/voice-welcome.wav', 0.72);
    safePlayClip(welcomeAudio);
  }

  public playVoiceGameOver(isNewBest: boolean): void {
    if (this.muted) return;
    if (isNewBest) {
      highScoreAudio = getOrCreateAudio(highScoreAudio, './audio/voice-highscore.wav', 0.78);
      safePlayClip(highScoreAudio);
    } else {
      gameOverAudio = getOrCreateAudio(gameOverAudio, './audio/voice-gameover.wav', 0.72);
      safePlayClip(gameOverAudio);
    }
  }

  public playVoiceRevive(): void {
    if (this.muted) return;
    reviveAudio = getOrCreateAudio(reviveAudio, './audio/voice-revive.wav', 0.78);
    safePlayClip(reviveAudio);
  }

  /** Crisp dual-tone UI blip when selecting/launching a game cartridge or button */
  public playMenuSelect(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [540, 810].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.045);

      gain.gain.setValueAtTime(0.14, now + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.085);
    });
  }

  /** Descending two-note chime when returning to the Hub */
  public playBack(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [620, 410].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.13, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.085);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.09);
    });
  }

  /** Ascending 4-note major arpeggio fanfare for IAP unlock / restore confirmation */
  public playPurchaseSuccess(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.06;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.16, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.17);
    });
  }

  /** Energetic ascending power-up sweep + voice callout when using a Continue Token */
  public playRevive(): void {
    this.playVoiceRevive();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.24);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  /** Short crisp blip when switching orbit ring */
  public playSwitch(innerRing = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const startFreq = innerRing ? 520 : 380;
    const endFreq = innerRing ? 680 : 460;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.07);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  /** Harmonic chime when collecting an energy orb or data node */
  public playCollect(combo = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const baseFreq = Math.min(440 + combo * 45, 1100);

    [baseFreq, baseFreq * 1.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + idx * 0.04 + 0.11);

      gain.gain.setValueAtTime(0.16, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.12);
    });
  }

  /** Short bounce sound for Neon Breaker paddle/wall/brick collisions */
  public playBounce(pitchMultiplier = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    const baseFreq = 320 * Math.max(0.6, Math.min(2.2, pitchMultiplier));
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.05);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.065);
  }

  /** High-to-mid frequency sweep for Astro Dodge plasma shots */
  public playLaser(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.075);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.085);
  }

  /** Low frequency sawtooth + detuned burst when destroying asteroids/bricks */
  public playExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [150, 112].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);

      gain.gain.setValueAtTime(idx === 0 ? 0.12 : 0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    });
  }

  /** Rising harmonic chord on perfect stack alignment or percussive thud on normal slice */
  public playStackDrop(perfect: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (perfect) {
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.035);

        gain.gain.setValueAtTime(0.14, now + idx * 0.035);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.14);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.035);
        osc.stop(now + idx * 0.035 + 0.15);
      });
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.09);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.105);
    }
  }

  /** Low synth impact when colliding with a hazard */
  public playGameOver(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.35);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
  }
}
