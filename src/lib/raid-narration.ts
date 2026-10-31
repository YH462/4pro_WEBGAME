import { raidTutorialAudio, raidTutorialSeconds } from "./raid-tutorial-timing";
import { gameVoiceAudio, RaidGameVoiceTimeline, type GameVoice, type RaidGameVoiceState } from "./raid-game-voice";

/** A prerecorded timeline: no Japanese voice installation is needed on the venue PC. */
export class RaidNarration {
  private context = new AudioContext();
  private abort = new AbortController();
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private source?: AudioBufferSourceNode;
  private sourceKind?: "opening" | GameVoice;
  private game = new RaidGameVoiceTimeline();
  private clock?: ReturnType<typeof setInterval>;
  private survey?: ReturnType<typeof setTimeout>;
  private enabled = false;
  private disposed = false;
  private pending = false;
  private generation = 0;
  private cue: { roomId: string; deadline: number } | null = null;
  private finished = "";

  constructor(private onPlaying: (playing: boolean) => void) {}

  private load(url = raidTutorialAudio) {
    let buffer = this.buffers.get(url);
    if (buffer) return buffer;
    buffer = fetch(url, { signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(20_000)]) })
      .then(response => { if (!response.ok) throw new Error("説明音声を読み込めませんでした。"); return response.arrayBuffer(); })
      .then(bytes => this.context.decodeAudioData(bytes))
      .catch(error => { this.buffers.delete(url); throw error; });
    this.buffers.set(url, buffer); return buffer;
  }

  private stop() {
    this.generation++; this.pending = false;
    clearTimeout(this.survey); this.survey = undefined;
    if (this.source) { this.source.onended = null; this.source.stop(); this.source.disconnect(); this.source = undefined; }
    this.sourceKind = undefined;
    this.onPlaying(false);
  }

  private async play() {
    if (!this.enabled || this.disposed || !this.cue || this.source || this.pending || this.finished === this.cue.roomId || document.hidden) return;
    const generation = this.generation, roomId = this.cue.roomId;
    this.pending = true;
    try {
      const buffer = await this.load();
      if (generation !== this.generation || !this.enabled || !this.cue || document.hidden) return;
      const offset = Math.max(0, raidTutorialSeconds - (this.cue.deadline - performance.now()) / 1000);
      if (offset >= buffer.duration) return;
      const source = this.context.createBufferSource();
      source.buffer = buffer; source.connect(this.context.destination);
      source.onended = () => {
        if (this.source !== source) return;
        source.disconnect(); this.source = undefined; this.finished = roomId; this.onPlaying(false);
      };
      this.source = source; this.sourceKind = "opening"; source.start(0, offset); this.onPlaying(true);
    } catch (error) { if (generation === this.generation) throw error; }
    finally { if (generation === this.generation) this.pending = false; }
  }

  async setCue(roomId: string | undefined, seconds: number | undefined) {
    const next = roomId && seconds !== undefined && seconds > 0 ? { roomId, deadline: performance.now() + seconds * 1000 } : null;
    if (next?.roomId !== this.cue?.roomId) { this.stop(); this.finished = ""; }
    this.cue = next;
    await this.play();
  }

  async setBattle(state: RaidGameVoiceState | undefined) {
    if (this.disposed) return;
    const event = this.game.update(state, performance.now());
    if (event.reset && this.sourceKind !== "opening") this.stop();
    if (event.voice) await this.playGame(event.voice);
  }

  private async playGame(voice: GameVoice) {
    if (!this.enabled || this.disposed || document.hidden) return;
    // A newer milestone replaces a now-outdated explanation. One voice at a time.
    this.stop();
    const generation = this.generation;
    this.pending = true;
    try {
      const buffer = await this.load(gameVoiceAudio(voice));
      if (generation !== this.generation || !this.enabled || this.disposed || document.hidden) return;
      const source = this.context.createBufferSource();
      source.buffer = buffer; source.connect(this.context.destination);
      source.onended = () => {
        if (this.source !== source) return;
        source.disconnect(); this.source = undefined; this.sourceKind = undefined; this.onPlaying(false);
        if (voice === 4) this.survey = setTimeout(() => {
          if (generation === this.generation) void this.playGame(5).catch(() => { this.stop(); });
        }, 3000);
      };
      this.source = source; this.sourceKind = voice; source.start(0, 0); this.onPlaying(true);
    } catch (error) { if (generation === this.generation) throw error; }
    finally { if (generation === this.generation) this.pending = false; }
  }

  async setEnabled(enabled: boolean) {
    if (this.disposed) return false;
    this.enabled = enabled;
    clearInterval(this.clock); this.clock = undefined;
    if (!enabled) { this.stop(); return false; }
    // Unlock playback directly from the operator's click and preload before start.
    await Promise.all([this.context.resume(), this.load(), ...([1, 2, 3, 4, 5] as GameVoice[]).map(voice => this.load(gameVoiceAudio(voice)))]);
    if (!this.enabled || this.disposed) return false;
    if (this.context.state !== "running") throw new Error("説明音声をオンにし直してください。");
    this.clock = setInterval(() => {
      const voice = this.game.tick(performance.now());
      if (voice) void this.playGame(voice).catch(() => { this.stop(); });
    }, 100);
    await this.play(); return true;
  }

  async visibilityChanged() {
    if (document.hidden) this.stop(); else await this.play();
  }

  dispose() { this.disposed = true; this.enabled = false; clearInterval(this.clock); this.abort.abort(); this.stop(); void this.context.close().catch(() => {}); }
}
