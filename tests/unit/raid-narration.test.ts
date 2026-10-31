import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { raidTutorialSeconds } from "../../src/lib/raid-tutorial-timing";
import { RaidNarration } from "../../src/lib/raid-narration";
import type { RaidGameVoiceState } from "../../src/lib/raid-game-voice";

const createSource = () => ({ buffer: null as AudioBuffer | null, onended: null as (() => void) | null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() });
class AudioStub {
  static instances: AudioStub[] = [];
  state = "running";
  destination = {};
  sources: ReturnType<typeof createSource>[] = [];
  constructor() { AudioStub.instances.push(this); }
  createBufferSource() {
    const source = createSource();
    this.sources.push(source); return source;
  }
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
  decodeAudioData = vi.fn(async () => ({ duration: 48.92733333333333 } as AudioBuffer));
}

describe("Japanese raid narration timeline", () => {
  let now = 0, hidden = false;
  const players: RaidNarration[] = [];
  const response = () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) as Response;
  beforeEach(() => {
    now = 0; hidden = false; AudioStub.instances = [];
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("AudioContext", AudioStub);
    vi.stubGlobal("document", { get hidden() { return hidden; } });
    vi.stubGlobal("fetch", vi.fn(async () => response()));
  });
  afterEach(() => { players.forEach(player => player.dispose()); players.length = 0; vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  const player = () => { const playing = vi.fn(), narration = new RaidNarration(playing); players.push(narration); return { narration, playing }; };

  it("preloads silently, plays once through updates and resumes at the current explanation after a mute", async () => {
    const { narration } = player(); await narration.setEnabled(true);
    const context = AudioStub.instances[0]; expect(context.sources).toHaveLength(0);
    await narration.setCue("room", raidTutorialSeconds); expect(context.sources[0].start).toHaveBeenCalledWith(0, 0);
    now = 9000; await narration.setCue("room", raidTutorialSeconds - 9); expect(context.sources).toHaveLength(1);
    await narration.setEnabled(false); expect(context.sources[0].stop).toHaveBeenCalledOnce();
    now = 24000; await narration.setCue("room", raidTutorialSeconds - 24); await narration.setEnabled(true);
    expect(context.sources[1].start).toHaveBeenCalledWith(0, 24);
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it("does not play a delayed download after the operator cancels it", async () => {
    let release!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const { narration } = player(); await narration.setCue("room", raidTutorialSeconds);
    const loading = narration.setEnabled(true); await narration.setEnabled(false);
    release(response()); expect(await loading).toBe(false);
    expect(AudioStub.instances[0].sources).toHaveLength(0);
  });

  it("stops hidden screens, resumes from the current step and clears old audio on reset", async () => {
    const { narration, playing } = player(); await narration.setEnabled(true); await narration.setCue("old", raidTutorialSeconds);
    hidden = true; await narration.visibilityChanged(); expect(playing).toHaveBeenLastCalledWith(false);
    now = 20000; await narration.setCue("old", raidTutorialSeconds - 20); expect(AudioStub.instances[0].sources).toHaveLength(1);
    hidden = false; await narration.visibilityChanged();
    expect(AudioStub.instances[0].sources[1].start).toHaveBeenCalledWith(0, 20);
    await narration.setCue(undefined, undefined); expect(playing).toHaveBeenLastCalledWith(false);
    await narration.setCue("new", raidTutorialSeconds); expect(AudioStub.instances[0].sources[2].start).toHaveBeenCalledWith(0, 0);
  });

  it("does not replay a completed track when another snapshot arrives", async () => {
    const { narration } = player(); await narration.setEnabled(true); await narration.setCue("room", raidTutorialSeconds);
    AudioStub.instances[0].sources[0].onended!();
    await narration.setCue("room", 1); expect(AudioStub.instances[0].sources).toHaveLength(1);
  });

  const battle = (patch: Partial<RaidGameVoiceState> = {}): RaidGameVoiceState => ({ roomId: "room", phase: "collecting", bossHp: 450, bossMaxHp: 450, victory: false, failed: false, ...patch });

  it("replaces an outdated cue, ducks while speaking and starts survey three seconds after victory audio ends", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const { narration, playing } = player(); await narration.setBattle(battle()); await narration.setEnabled(true);
    now = 15_000; await vi.advanceTimersByTimeAsync(100);
    const context = AudioStub.instances[0]; expect(context.sources).toHaveLength(1);
    await narration.setBattle(battle({ bossHp: 225 })); expect(context.sources[0].stop).toHaveBeenCalledOnce();
    await narration.setBattle(battle({ bossHp: 100 })); expect(context.sources[1].stop).toHaveBeenCalledOnce();
    await narration.setBattle(battle({ bossHp: 0, victory: true })); expect(context.sources[2].stop).toHaveBeenCalledOnce();
    context.sources[3].onended!(); expect(playing).toHaveBeenLastCalledWith(false);
    await narration.setBattle(battle({ bossHp: 0, victory: true, phase: "finished" }));
    await vi.advanceTimersByTimeAsync(2999); expect(context.sources).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(1); expect(context.sources).toHaveLength(5);
    expect(playing).toHaveBeenLastCalledWith(true);
    context.sources[4].onended!();
    await vi.advanceTimersByTimeAsync(10_000); expect(context.sources).toHaveLength(5);
  });

  it.each(["mute", "reset", "hidden", "dispose"])("cancels the pending survey on %s", async reason => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const { narration } = player(); await narration.setBattle(battle()); await narration.setEnabled(true);
    await narration.setBattle(battle({ bossHp: 0, victory: true }));
    const context = AudioStub.instances[0]; context.sources[0].onended!();
    if (reason === "mute") await narration.setEnabled(false);
    if (reason === "reset") await narration.setBattle(battle({ roomId: "next", phase: "lobby" }));
    if (reason === "hidden") { hidden = true; await narration.visibilityChanged(); }
    if (reason === "dispose") narration.dispose();
    await vi.advanceTimersByTimeAsync(3000); expect(context.sources).toHaveLength(1);
  });

  it("does not replay a milestone that happened while muted or hidden", async () => {
    const { narration } = player(); await narration.setBattle(battle());
    await narration.setBattle(battle({ bossHp: 225 })); await narration.setEnabled(true);
    const context = AudioStub.instances[0]; expect(context.sources).toHaveLength(0);
    hidden = true; await narration.setBattle(battle({ bossHp: 100 })); hidden = false;
    await narration.visibilityChanged(); await narration.setBattle(battle({ bossHp: 100 }));
    expect(context.sources).toHaveLength(0);
  });
});
