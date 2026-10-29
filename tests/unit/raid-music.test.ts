import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RaidMusic } from "../../src/lib/raid-music";

const param=()=>({value:0,cancelScheduledValues:vi.fn(),setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()});
const sourceStub=()=>({buffer:null as AudioBuffer|null,loop:false,loopStart:0,loopEnd:0,onended:null as (()=>void)|null,connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn()});
class AudioContextStub {
  static instances:AudioContextStub[]=[];
  currentTime=12;state="running";
  destination={};
  sources:ReturnType<typeof sourceStub>[]=[];
  constructor(){AudioContextStub.instances.push(this);}
  createGain(){return {gain:param(),connect:vi.fn(),disconnect:vi.fn()};}
  createBufferSource(){
    const source=sourceStub();
    this.sources.push(source);return source;
  }
  decodeAudioData=vi.fn(async(bytes:ArrayBuffer)=>({duration:180,file:new TextDecoder().decode(bytes)}) as unknown as AudioBuffer);
  resume=vi.fn(async()=>{this.state="running";});
  suspend=vi.fn(async()=>{this.state="suspended";});
  close=vi.fn(async()=>{this.state="closed";});
}
const response=(file:string)=>({ok:true,arrayBuffer:async()=>new TextEncoder().encode(file).buffer});
const fileOf=(source:{buffer:AudioBuffer|null})=>(source.buffer as unknown as {file:string}).file;
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));

describe("raid song selection",()=>{
  const players:RaidMusic[]=[];
  beforeEach(()=>{
    AudioContextStub.instances=[];
    vi.stubGlobal("AudioContext",AudioContextStub);
    vi.stubGlobal("fetch",vi.fn(async(url:string)=>response(url)));
  });
  afterEach(()=>{players.forEach(p=>p.dispose());players.length=0;vi.unstubAllGlobals();});
  const player=(...args:ConstructorParameters<typeof RaidMusic>)=>{const p=new RaidMusic(...args);players.push(p);return p;};

  it("loops the lobby, starts the selected battle song at zero and caches all three choices",async()=>{
    const music=player("lobby","BattleBGM2"),context=AudioContextStub.instances[0];
    expect(fetch).not.toHaveBeenCalled();
    await music.setEnabled(true);await settle();
    expect(context.sources.map(fileOf)).toEqual(["/music/LobbyBGM.mp3"]);
    await music.setTrack("lobby","BattleBGM3");await settle();
    expect(context.sources).toHaveLength(1);
    await music.setTrack("battle");
    expect(context.sources.map(fileOf)).toEqual(["/music/LobbyBGM.mp3","/music/BattleBGM3.mp3"]);
    for(const source of context.sources){expect(source).toMatchObject({loop:true,loopStart:0,loopEnd:180});expect(source.start).toHaveBeenCalledExactlyOnceWith(12,0);}
    await music.setTrack("battle");expect(context.sources).toHaveLength(2);
    await music.setTrack("battle","BattleBGM1");
    await music.setTrack("battle","BattleBGM2");
    await music.setTrack("lobby");
    expect(context.sources.map(fileOf)).toEqual(["/music/LobbyBGM.mp3","/music/BattleBGM3.mp3","/music/BattleBGM1.mp3","/music/BattleBGM2.mp3","/music/LobbyBGM.mp3"]);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(context.sources[0].stop).toHaveBeenCalledWith(12.65);
    context.sources[0].onended?.();expect(context.sources[0].disconnect).toHaveBeenCalledOnce();
    await music.setEnabled(false);await music.setEnabled(true);expect(context.sources).toHaveLength(5);
  });

  it("ignores a slower old song selection even when its download fails",async()=>{
    let reject!:(error:Error)=>void;
    vi.mocked(fetch).mockImplementation(async(url)=>{
      if(String(url).includes("BattleBGM2"))return new Promise((_,fail)=>{reject=fail;});
      return response(String(url)) as unknown as Response;
    });
    const music=player("battle");await music.setEnabled(true);
    const old=music.setTrack("battle","BattleBGM2");
    await music.setTrack("battle","BattleBGM3");reject(new Error("old request failed"));await old;
    expect(AudioContextStub.instances[0].sources.map(fileOf)).toEqual(["/music/BattleBGM1.mp3","/music/BattleBGM3.mp3"]);
  });

  it("cannot start a delayed download after mute or disposal",async()=>{
    let release!:(value:Response)=>void;
    vi.mocked(fetch).mockImplementation(()=>new Promise(resolve=>{release=resolve;}));
    const music=player("lobby"),pending=music.setEnabled(true);
    await music.setEnabled(false);release(response("lobby") as unknown as Response);
    expect(await pending).toBe(false);expect(AudioContextStub.instances[0].sources).toHaveLength(0);
    const other=player("battle"),loading=other.setEnabled(true);other.dispose();
    release(response("battle") as unknown as Response);expect(await loading).toBe(false);
    expect(AudioContextStub.instances[1].sources).toHaveLength(0);
  });

  it("retries a failed song without restarting a healthy lobby",async()=>{
    const music=player("lobby");await music.setEnabled(true);await settle();
    vi.mocked(fetch).mockResolvedValueOnce({ok:false} as Response);
    await expect(music.setTrack("battle","BattleBGM2")).rejects.toThrow("BGMの音源");
    expect(AudioContextStub.instances[0].sources).toHaveLength(1);
    await music.setTrack("battle","BattleBGM2");
    expect(AudioContextStub.instances[0].sources.map(fileOf)).toEqual(["/music/LobbyBGM.mp3","/music/BattleBGM2.mp3"]);
  });
});
