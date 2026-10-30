import { describe, expect, it } from "vitest";
import { buildEventStatistics, japaneseDate, type StatisticsSource } from "../../src/lib/event-statistics";
import { csvZip, exportStatistics, statisticsCsv } from "../../src/lib/statistics-csv";

const at=new Date("2026-10-30T23:30:00Z");
function fixture():StatisticsSource{
  return {event:{id:"test",name:"展示",status:"ACTIVE"},players:Array.from({length:20},(_,i)=>({id:`p${i}`,nickname:i<2?"サクラ":null,createdAt:at})),
    characters:["mechanical","electrical","control","civil"].map((departmentId,i)=>({id:`c${i}`,name:`キャラ${i}`,departmentId,isLegendary:false,sortOrder:i})),
    collections:[0,1,2,3].map(i=>({playerId:"p0",characterId:`c${i}`,acquiredAt:at})),
    results:Array.from({length:20},(_,i)=>({id:`r${i}`,playerId:`p${i}`,roomId:"one-battle",characterId:"c0",characterName:"当時の名前",bossName:"ボス",won:true,turns:9,finishedAt:at})),
    rewards:[{playerId:"p0",raidResultId:"r0",points:250},{playerId:"p1",raidResultId:"r1",points:100}]};
}
describe("event statistics",()=>{
  it("counts twenty participants as one battle and uses the reward ledger",()=>{
    const result=buildEventStatistics(fixture(),at);
    expect(result.dashboard.summary).toEqual({registered:20,collectors:1,complete:1,completionRate:.05,raidPlayers:20,battles:1,victories:1,defeats:0,winRate:1,averageTurns:9});
    expect(result.raids[0].participants).toBe(20);
    expect(result.dashboard.sizes).toEqual([{participants:20,battles:1,victories:1}]);
    expect(result.participants[0].points).toBe(250);
    expect(result.dashboard.rankings.points[0].id).toBe("p0");
    expect(result.dashboard.rankings.victories.every(p=>p.ranks.victories===1)).toBe(true);
    expect(result.dashboard.characters[0].uses).toBe(20);
    expect(result.dashboard.hours).toEqual([{hour:"2026-10-31T08",count:20}]);
    expect(japaneseDate(at)).toBe("2026-10-31T08:30:00.000+09:00");
  });
  it("excludes other players, gives shared ranks and does not identify people by nickname",()=>{
    const source=fixture();source.rewards.push({playerId:"p2",raidResultId:"r2",points:100},{playerId:"outsider",raidResultId:"foreign",points:9999});
    source.results.push({...source.results[0],id:"foreign",roomId:"foreign",playerId:"outsider"});
    source.collections.push({...source.collections[0],playerId:"outsider"});
    const result=buildEventStatistics(source);
    expect(result.dashboard.rankings.points.map(p=>p.ranks.points)).toEqual([1,2,2]);
    expect(result.participants.filter(p=>p.nickname==="サクラ")).toHaveLength(2);
    expect(new Set(result.participants.map(p=>p.displayName)).size).toBe(20);
    expect(JSON.stringify(result)).not.toContain("outsider");
    expect(result.dashboard.summary.battles).toBe(1);
  });
  it("handles no data and distinguishes a loss and a non-department collection",()=>{
    const empty=buildEventStatistics({...fixture(),players:[],collections:[],results:[],rewards:[]});
    expect(empty.dashboard.summary).toMatchObject({registered:0,completionRate:null,winRate:null,averageTurns:null});
    expect(empty.dashboard.rankings.collected).toEqual([]);
    const source=fixture();source.results.push({...source.results[0],id:"loss",roomId:"loss",won:false,turns:20});
    source.characters=source.characters.map(c=>({...c,departmentId:null}));
    const result=buildEventStatistics(source);
    expect(result.dashboard.summary).toMatchObject({complete:0,battles:2,victories:1,defeats:1,winRate:.5,averageTurns:9});
  });
});
describe("statistics exports",()=>{
  it("quotes Japanese, commas, quotes and line breaks and protects formula cells",()=>{
    const text=statisticsCsv([["名前",'サクラ,"春"\n組',"=1+1"," \t@SUM(1)","\ttext",-2,0,null]]).toString("utf8");
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('"サクラ,""春""\n組"');
    expect(text).toContain('"\'=1+1"');expect(text).toContain('"\' \t@SUM(1)"');
    expect(text).toContain('"\'\ttext"');expect(text).toContain('"-2","0",""\r\n');
  });
  it("exports one consistent set of files with complete participants and one battle row",()=>{
    const source=fixture();source.players[0].nickname="=1+1";
    const files=exportStatistics(buildEventStatistics(source,at));
    expect(Object.keys(files)).toEqual(["summary","participants","collections","raids","raid-participants"]);
    for(const file of Object.values(files)){expect(file.subarray(0,3).toString("hex")).toBe("efbbbf");expect(file.toString()).toContain("2026-10-31T08:30:00.000+09:00");}
    expect(files.participants.toString().split("\r\n")).toHaveLength(22);
    expect(files.raids.toString().split("\r\n")).toHaveLength(3);
    expect(files["raid-participants"].toString()).toContain("当時の名前");
    expect(files.participants.toString()).toContain("'=1+1");expect(source.players[0].nickname).toBe("=1+1");
  });
  it("writes valid ZIP headers, offsets and the standard CRC-32 check value",()=>{
    const bytes=csvZip({"check.csv":Buffer.from("123456789")});
    expect(bytes.readUInt32LE(0)).toBe(0x04034b50);
    expect(bytes.readUInt32LE(14)).toBe(0xcbf43926);
    const end=bytes.length-22,central=bytes.readUInt32LE(end+16);
    expect(bytes.readUInt32LE(end)).toBe(0x06054b50);expect(bytes.readUInt16LE(end+10)).toBe(1);
    expect(bytes.readUInt32LE(central)).toBe(0x02014b50);expect(bytes.readUInt32LE(central+42)).toBe(0);
    expect(bytes.subarray(30+bytes.readUInt16LE(26),central).toString()).toBe("123456789");
  });
});
