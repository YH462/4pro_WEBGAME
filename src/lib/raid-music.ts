export type RaidMusicTrack = "lobby" | "battle";
const tracks: RaidMusicTrack[] = ["lobby", "battle"];
const files = {
  lobby: "/music/raid_boss_lobby_128bpm_loop.wav",
  battle: "/music/raid_boss_battle_128bpm_loop.wav",
};

/** Decode once and loop on the audio clock, without media-element reload gaps.
 * Both 128-BPM tracks share a start time, keeping their beats aligned in fades. */
export class RaidMusic {
  private context: AudioContext;
  private master: GainNode;
  private gains: Partial<Record<RaidMusicTrack, GainNode>> = {};
  private sources: AudioBufferSourceNode[] = [];
  private loaded?: Promise<void>;
  private abort = new AbortController();
  private suspendTimer?: ReturnType<typeof setTimeout>;
  private enabled = false;
  private disposed = false;

  constructor(private track: RaidMusicTrack) {
    // Constructed and resumed by the operator's click, never during hydration.
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.context.destination);
  }

  private ramp(param: AudioParam, target: number, duration: number) {
    const now = this.context.currentTime, value = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(value, now);
    param.linearRampToValueAtTime(target, now + duration);
  }

  private load() {
    if (this.loaded) return this.loaded;
    this.loaded = Promise.all(tracks.map(async track => {
      const response = await fetch(files[track], { signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(20_000)]) });
      if (!response.ok) throw new Error("BGMの音源を読み込めませんでした。");
      return this.context.decodeAudioData(await response.arrayBuffer());
    })).then(buffers => {
      if (this.disposed) return;
      const startAt = this.context.currentTime;
      tracks.forEach((track, index) => {
        const source = this.context.createBufferSource(), gain = this.context.createGain();
        source.buffer = buffers[index]; source.loop = true;
        source.loopStart = 0; source.loopEnd = buffers[index].duration;
        gain.gain.value = track === this.track ? 1 : 0;
        source.connect(gain); gain.connect(this.master);
        this.gains[track] = gain; this.sources.push(source);
        source.start(startAt);
      });
    }).catch(error => { this.loaded = undefined; throw error; });
    return this.loaded;
  }

  setTrack(track: RaidMusicTrack) {
    if (this.track === track || this.disposed) return;
    this.track = track;
    tracks.forEach(key => { const gain = this.gains[key]; if (gain) this.ramp(gain.gain, key === track ? 1 : 0, .65); });
  }

  async setEnabled(enabled: boolean) {
    if (this.disposed) return false;
    this.enabled = enabled; clearTimeout(this.suspendTimer);
    if (!enabled) {
      this.ramp(this.master.gain, 0, .05);
      this.suspendTimer = setTimeout(() => {
        if (!this.enabled && !this.disposed) void this.context.suspend().catch(() => {});
      }, 80);
      return false;
    }
    // Call resume before awaiting downloads so the user activation is retained.
    await Promise.all([this.context.resume(), this.load()]);
    if (!this.enabled || this.disposed) return false;
    if (this.context.state !== "running") throw new Error("BGMをオンにし直してください。");
    this.ramp(this.master.gain, .4, .12);
    return true;
  }

  dispose() {
    this.disposed = true; this.enabled = false;
    clearTimeout(this.suspendTimer); this.abort.abort();
    this.sources.forEach(source => { source.stop(); source.disconnect(); });
    this.sources = []; this.master.disconnect();
    void this.context.close().catch(() => {});
  }
}
