/** Normal: a compact armored strike. Critical: a deep, rolling detonation.
 * Generated locally; no character-specific files or network delay at contact. */
export function raidImpactSamples(sampleRate: number, critical: boolean) {
  const duration = critical ? .9 : .42;
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  const low = critical ? 30 : 65, high = critical ? 90 : 220;
  const decay = critical ? .22 : .085, pitchFall = critical ? .075 : .026;
  const bassAt = (t: number) => {
    if (t < 0) return 0;
    const phase = 2 * Math.PI * (low * t + (high - low) * pitchFall * (1 - Math.exp(-t / pitchFall)));
    return (Math.sin(phase) + (critical ? .45 : .3) * Math.sin(phase * 2)) * (1 - Math.exp(-t / .002)) * Math.exp(-t / decay);
  };
  const rumbleAlpha = 1 - Math.exp(-2 * Math.PI * 180 / sampleRate);
  const gritAlpha = 1 - Math.exp(-2 * Math.PI * 950 / sampleRate);
  let random = 0x4f50524f, rumble = 0, grit = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    random ^= random << 13; random ^= random >>> 17; random ^= random << 5;
    const noise = (random >>> 0) / 0xffffffff * 2 - 1;
    rumble += (noise - rumble) * rumbleAlpha;
    grit += (noise - grit) * gritAlpha;
    const attack = 1 - Math.exp(-t / .0015);
    const fade = Math.min(1, (samples.length - 1 - i) / (sampleRate * .07));
    // Harmonics and shell tones retain weight on speakers that cannot play sub-bass.
    const shellFrequency = critical ? 100 : 380;
    const shell = (Math.sin(2 * Math.PI * shellFrequency * t) + .35 * Math.sin(2 * Math.PI * shellFrequency * 1.53 * t)) * Math.exp(-t / (critical ? .12 : .035));
    const debris = critical
      ? (2.4 * rumble + .95 * grit) * Math.exp(-t / .22)
      : (rumble + .22 * grit) * Math.exp(-t / .065);
    const crack = (noise - grit) * Math.exp(-t / (critical ? .025 : .013));
    const reflections = critical
      ? .4 * bassAt(t - .035) + .24 * bassAt(t - .08) + .12 * bassAt(t - .14)
      : .1 * bassAt(t - .03) + .04 * bassAt(t - .06);
    samples[i] = .65 * Math.tanh((critical ? 1.35 : 1.15) * bassAt(t) + (critical ? .25 : .38) * shell + debris + (critical ? .24 : .3) * crack + reflections) * attack * fade * fade;
  }
  return samples;
}

/** A dragon-like breath impact built around the existing critical detonation. */
export function raidCounterSamples(sampleRate: number) {
  const impact = raidImpactSamples(sampleRate, true);
  const samples = new Float32Array(Math.ceil(sampleRate * 1.3));
  const lowAlpha = 1 - Math.exp(-2 * Math.PI * 140 / sampleRate);
  const airAlpha = 1 - Math.exp(-2 * Math.PI * 1800 / sampleRate);
  let random = 0x44524147, lowNoise = 0, airNoise = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    random ^= random << 13; random ^= random >>> 17; random ^= random << 5;
    const noise = (random >>> 0) / 0xffffffff * 2 - 1;
    lowNoise += (noise - lowNoise) * lowAlpha;
    airNoise += (noise - airNoise) * airAlpha;
    const attack = 1 - Math.exp(-t / .003);
    const fade = Math.min(1, (samples.length - 1 - i) / (sampleRate * .12));
    const phase = 2 * Math.PI * (44 * t + 3.3 * (1 - Math.exp(-t / .11))) + .35 * Math.sin(2 * Math.PI * 8 * t);
    const growl = (Math.sin(phase) + .5 * Math.sin(phase * 2) + .2 * Math.sin(phase * 4)) * Math.exp(-t / .32);
    const breath = (airNoise - lowNoise) * Math.exp(-t / .28);
    const rumble = lowNoise * Math.exp(-t / .38);
    samples[i] = .65 * Math.tanh(.8 * (impact[i] ?? 0) / .65 + growl + 1.2 * breath + 1.8 * rumble) * attack * fade * fade;
  }
  return samples;
}

export type RaidSoundEffect = "attack" | "critical" | "counter";

export class RaidAttackSound {
  private context = new AudioContext();
  private output = this.context.createGain();
  private buffers: Record<RaidSoundEffect, AudioBuffer>;
  private active: AudioBufferSourceNode | null = null;
  private enabled = false;
  private disposed = false;

  constructor() {
    this.output.gain.value = .7; this.output.connect(this.context.destination);
    const makeBuffer = (samples: Float32Array) => {
      const buffer = this.context.createBuffer(1, samples.length, this.context.sampleRate);
      buffer.getChannelData(0).set(samples); return buffer;
    };
    this.buffers = {
      attack: makeBuffer(raidImpactSamples(this.context.sampleRate, false)),
      critical: makeBuffer(raidImpactSamples(this.context.sampleRate, true)),
      counter: makeBuffer(raidCounterSamples(this.context.sampleRate)),
    };
  }

  async setEnabled(enabled: boolean) {
    if (this.disposed) return false;
    this.enabled = enabled;
    if (!enabled) { this.stop(); await this.context.suspend(); return false; }
    await this.context.resume();
    return this.enabled && !this.disposed && this.context.state === "running";
  }

  play(effect: RaidSoundEffect) {
    if (!this.enabled || this.disposed || this.context.state !== "running") return;
    // At most one impact voice, even when the whole team strikes together.
    this.stop();
    const source = this.context.createBufferSource();
    source.buffer = this.buffers[effect]; source.connect(this.output);
    source.onended = () => { if (this.active === source) this.active = null; source.disconnect(); };
    this.active = source; source.start();
  }

  stop() {
    if (!this.active) return;
    this.active.onended = null; this.active.stop(); this.active.disconnect(); this.active = null;
  }

  dispose() {
    this.enabled = false; this.disposed = true; this.stop(); this.output.disconnect();
    void this.context.close().catch(() => {});
  }
}
