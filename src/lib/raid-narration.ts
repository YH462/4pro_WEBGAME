import { raidTutorialAudio, raidTutorialSeconds } from "./raid-tutorial-timing";

/** A prerecorded timeline: no Japanese voice installation is needed on the venue PC. */
export class RaidNarration {
  private context = new AudioContext();
  private abort = new AbortController();
  private buffer?: Promise<AudioBuffer>;
  private source?: AudioBufferSourceNode;
  private enabled = false;
  private disposed = false;
  private pending = false;
  private generation = 0;
  private cue: { roomId: string; deadline: number } | null = null;
  private finished = "";

  constructor(private onPlaying: (playing: boolean) => void) {}

  private load() {
    return this.buffer ??= fetch(raidTutorialAudio, { signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(20_000)]) })
      .then(response => { if (!response.ok) throw new Error("説明音声を読み込めませんでした。"); return response.arrayBuffer(); })
      .then(bytes => this.context.decodeAudioData(bytes))
      .catch(error => { this.buffer = undefined; throw error; });
  }

  private stop() {
    this.generation++; this.pending = false;
    if (this.source) { this.source.onended = null; this.source.stop(); this.source.disconnect(); this.source = undefined; }
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
      this.source = source; source.start(0, offset); this.onPlaying(true);
    } catch (error) { if (generation === this.generation) throw error; }
    finally { if (generation === this.generation) this.pending = false; }
  }

  async setCue(roomId: string | undefined, seconds: number | undefined) {
    const next = roomId && seconds !== undefined && seconds > 0 ? { roomId, deadline: performance.now() + seconds * 1000 } : null;
    if (next?.roomId !== this.cue?.roomId) { this.stop(); this.finished = ""; }
    this.cue = next;
    await this.play();
  }

  async setEnabled(enabled: boolean) {
    if (this.disposed) return false;
    this.enabled = enabled;
    if (!enabled) { this.stop(); return false; }
    // Unlock playback directly from the operator's click and preload before start.
    await Promise.all([this.context.resume(), this.load()]);
    if (!this.enabled || this.disposed) return false;
    if (this.context.state !== "running") throw new Error("説明音声をオンにし直してください。");
    await this.play(); return true;
  }

  async visibilityChanged() {
    if (document.hidden) this.stop(); else await this.play();
  }

  dispose() { this.disposed = true; this.enabled = false; this.abort.abort(); this.stop(); void this.context.close().catch(() => {}); }
}
