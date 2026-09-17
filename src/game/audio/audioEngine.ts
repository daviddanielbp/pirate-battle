import { SOUND_SOURCES, type SoundName } from '../assets/manifest';

export interface AudioSettings {
  volume: number;
  muted: boolean;
}

interface LoopHandle {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<SoundName, AudioBuffer>();
  private readonly pending = new Map<SoundName, Promise<AudioBuffer | null>>();
  private readonly loops = new Map<SoundName, LoopHandle>();
  private readonly requestedLoops = new Set<SoundName>();
  private settings: AudioSettings = { volume: 0.8, muted: false };
  private unlocked = false;
  private disposed = false;

  configure(settings: AudioSettings): void {
    this.settings = settings;
    this.applyMasterVolume();
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  unlock(): void {
    if (this.disposed) return;
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === 'suspended') {
      void context.resume().then(() => {
        this.unlocked = context.state === 'running';
      });
    } else {
      this.unlocked = true;
    }
  }

  preload(names: readonly SoundName[]): void {
    for (const name of names) void this.loadBuffer(name);
  }

  play(name: SoundName, options: { volume?: number; rate?: number } = {}): void {
    if (this.disposed || this.settings.muted) return;
    const context = this.ensureContext();
    const master = this.master;
    if (!context || !master || context.state !== 'running') return;
    const buffer = this.buffers.get(name);
    if (!buffer) {
      void this.loadBuffer(name);
      return;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = options.rate ?? 1;
    const gain = context.createGain();
    gain.gain.value = options.volume ?? 1;
    source.connect(gain);
    gain.connect(master);
    source.start();
  }

  startLoop(name: SoundName, volume = 1): void {
    if (this.disposed || this.loops.has(name)) return;
    this.requestedLoops.add(name);
    const context = this.ensureContext();
    const master = this.master;
    if (!context || !master) return;
    const buffer = this.buffers.get(name);
    if (!buffer) {
      void this.loadBuffer(name).then((loaded) => {
        if (loaded && !this.disposed && this.requestedLoops.has(name) && !this.loops.has(name)) {
          this.startLoop(name, volume);
        }
      });
      return;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(master);
    source.start();
    this.loops.set(name, { source, gain });
  }

  setLoopVolume(name: SoundName, volume: number, rampSeconds = 0.15): void {
    const loop = this.loops.get(name);
    const context = this.context;
    if (!loop || !context) return;
    loop.gain.gain.cancelScheduledValues(context.currentTime);
    loop.gain.gain.setTargetAtTime(volume, context.currentTime, rampSeconds);
  }

  stopLoop(name: SoundName): void {
    this.requestedLoops.delete(name);
    const loop = this.loops.get(name);
    if (!loop) return;
    try {
      loop.source.stop();
    } catch {
      return;
    } finally {
      loop.source.disconnect();
      loop.gain.disconnect();
      this.loops.delete(name);
    }
  }

  stopAllLoops(): void {
    this.requestedLoops.clear();
    for (const name of [...this.loops.keys()]) this.stopLoop(name);
  }

  dispose(): void {
    this.disposed = true;
    this.stopAllLoops();
    const context = this.context;
    this.context = null;
    this.master = null;
    if (context) void context.close();
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;
    try {
      const context = new AudioContext();
      const master = context.createGain();
      master.connect(context.destination);
      this.context = context;
      this.master = master;
      this.applyMasterVolume();
      return context;
    } catch {
      return null;
    }
  }

  private applyMasterVolume(): void {
    if (!this.master) return;
    this.master.gain.value = this.settings.muted ? 0 : this.settings.volume;
  }

  private loadBuffer(name: SoundName): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(name);
    if (cached) return Promise.resolve(cached);
    const pending = this.pending.get(name);
    if (pending) return pending;
    const context = this.ensureContext();
    if (!context) return Promise.resolve(null);
    const task = (async (): Promise<AudioBuffer | null> => {
      try {
        const response = await fetch(SOUND_SOURCES[name]);
        if (!response.ok) return null;
        const data = await response.arrayBuffer();
        const buffer = await context.decodeAudioData(data);
        if (!this.disposed) this.buffers.set(name, buffer);
        return buffer;
      } catch {
        return null;
      } finally {
        this.pending.delete(name);
      }
    })();
    this.pending.set(name, task);
    return task;
  }
}

export const GAME_SOUNDS: readonly SoundName[] = [
  'cannonFire1',
  'cannonFire2',
  'cannonFire3',
  'cannonBroadside',
  'waterHit1',
  'waterHit2',
  'woodHit1',
  'woodHit2',
  'shipCollision',
  'shipExplosion1',
  'shipExplosion2',
  'shipSinking',
  'scorePoint',
  'healthLow',
  'timeWarning',
  'gameStart',
  'gameOver',
  'gameComplete',
  'gamePause',
  'gameResume',
  'oceanLoop',
  'sailingLoop',
];

export const UI_SOUNDS: readonly SoundName[] = ['uiClick', 'uiHover', 'uiOpen', 'uiClose', 'uiBack'];
