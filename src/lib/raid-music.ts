export type RaidMusicTrack = "lobby" | "battle";
export const raidBattleMusic = ["BattleBGM1", "BattleBGM2", "BattleBGM3"] as const;
export type RaidBattleMusic = typeof raidBattleMusic[number];
type MusicFile = "LobbyBGM" | RaidBattleMusic;
type Voice = { file: MusicFile; source: AudioBufferSourceNode; gain: GainNode };

/** Cache decoded songs, loop on the audio clock and start each new scene's song at zero. */
export class RaidMusic {
  private context: AudioContext;
  private master: GainNode;
  private buffers = new Map<MusicFile, Promise<AudioBuffer>>();
  private voices = new Set<Voice>();
  private current?: Voice;
  private abort = new AbortController();
  private suspendTimer?: ReturnType<typeof setTimeout>;
  private enabled = false;
  private disposed = false;
  private ducked = false;

  constructor(private track: RaidMusicTrack, private battleMusic: RaidBattleMusic = "BattleBGM1") {
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

  private file(): MusicFile { return this.track === "lobby" ? "LobbyBGM" : this.battleMusic; }

  private load(file: MusicFile) {
    let loaded = this.buffers.get(file);
    if (loaded) return loaded;
    loaded = (async () => {
      const response = await fetch(`/music/${file}.mp3`, { signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(30_000)]) });
      if (!response.ok) throw new Error("BGMの音源を読み込めませんでした。");
      return this.context.decodeAudioData(await response.arrayBuffer());
    })().catch(error => { this.buffers.delete(file); throw error; });
    this.buffers.set(file, loaded);
    return loaded;
  }

  private prefetchBattle() {
    if (this.enabled && !this.disposed && this.track === "lobby") void this.load(this.battleMusic).catch(() => {});
  }

  private async playCurrent() {
    while (this.enabled && !this.disposed) {
      const file = this.file();
      let buffer: AudioBuffer;
      try { buffer = await this.load(file); }
      catch (error) {
        if (!this.enabled || this.disposed) return;
        if (file !== this.file()) continue;
        throw error;
      }
      if (!this.enabled || this.disposed) return;
      if (file !== this.file()) continue; // A slower previous selection must never start late.
      if (this.current?.file === file) return;
      const source = this.context.createBufferSource(), gain = this.context.createGain();
      source.buffer = buffer; source.loop = true;
      source.loopStart = 0; source.loopEnd = buffer.duration;
      gain.gain.value = 0;
      source.connect(gain); gain.connect(this.master);
      const voice = { file, source, gain }, previous = this.current;
      this.voices.add(voice); this.current = voice;
      source.onended = () => { source.disconnect(); gain.disconnect(); this.voices.delete(voice); };
      source.start(this.context.currentTime, 0);
      this.ramp(gain.gain, 1, .65);
      if (previous) {
        this.ramp(previous.gain.gain, 0, .65);
        previous.source.stop(this.context.currentTime + .65);
      }
      return;
    }
  }

  async setTrack(track: RaidMusicTrack, battleMusic: RaidBattleMusic = this.battleMusic) {
    if (this.disposed) return;
    this.track = track; this.battleMusic = battleMusic;
    if (this.enabled) { this.prefetchBattle(); await this.playCurrent(); }
  }

  setDucked(ducked: boolean) {
    this.ducked = ducked;
    if (this.enabled && !this.disposed) this.ramp(this.master.gain, ducked ? .12 : .4, .15);
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
    await Promise.all([this.context.resume(), this.playCurrent()]);
    if (!this.enabled || this.disposed) return false;
    if (this.context.state !== "running") throw new Error("BGMをオンにし直してください。");
    this.ramp(this.master.gain, this.ducked ? .12 : .4, .12);
    this.prefetchBattle();
    return true;
  }

  dispose() {
    this.disposed = true; this.enabled = false;
    clearTimeout(this.suspendTimer); this.abort.abort();
    this.voices.forEach(({source,gain}) => { source.onended = null; source.stop(); source.disconnect(); gain.disconnect(); });
    this.voices.clear(); this.current = undefined; this.buffers.clear(); this.master.disconnect();
    void this.context.close().catch(() => {});
  }
}
