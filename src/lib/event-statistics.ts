import { createHash } from "node:crypto";

export type StatisticsSource = {
  event: {id:string;name:string;status:string};
  players: {id:string;nickname:string|null;createdAt:Date}[];
  characters: {id:string;name:string;departmentId:string|null;isLegendary:boolean;sortOrder:number}[];
  collections: {playerId:string;characterId:string;acquiredAt:Date}[];
  results: {id:string;roomId:string;playerId:string;characterId:string;characterName:string;bossName:string;won:boolean;turns:number;finishedAt:Date}[];
  rewards: {playerId:string;raidResultId:string;points:number}[];
};
export const rankingMetrics = ["collected", "victories", "points"] as const;
export type RankingMetric = typeof rankingMetrics[number];
export type StatisticsParticipant = {id:string;nickname:string|null;displayName:string;code:string;registeredAt:string;collected:number;departments:number;raids:number;victories:number;points:number;ranks:Record<RankingMetric,number|null>};
const departmentNames:Record<string,string>={mechanical:"機械科",electrical:"電気情報",control:"電子制御",civil:"建設システム"};
export function japaneseDate(date:Date|string) { return new Date(new Date(date).getTime()+9*3600_000).toISOString().replace("Z","+09:00"); }

export function buildEventStatistics(source:StatisticsSource, now=new Date()) {
  const names=new Map<string,number>();
  for(const p of source.players)names.set(p.nickname??"",(names.get(p.nickname??"")??0)+1);
  const people=new Map<string,StatisticsParticipant>();
  const codes=new Set<string>();
  for(const p of [...source.players].sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime()||a.id.localeCompare(b.id))){
    const hash=createHash("sha256").update(p.id).digest("hex");let length=6;
    while(codes.has(hash.slice(0,length)))length++;
    const code=hash.slice(0,length);codes.add(code);
    people.set(p.id,{id:p.id,nickname:p.nickname,displayName:!p.nickname?`ゲスト・${code}`:names.get(p.nickname)!>1?`${p.nickname}・${code}`:p.nickname,code,registeredAt:p.createdAt.toISOString(),collected:0,departments:0,raids:0,victories:0,points:0,ranks:{collected:null,victories:null,points:null}});
  }
  const characters=new Map(source.characters.map(c=>[c.id,c]));
  const owned=new Map<string,Set<string>>(),depts=new Map<string,Set<string>>();
  const acquisitionCounts=new Map<string,number>(),usageCounts=new Map<string,number>();
  const collections=source.collections.filter(c=>people.has(c.playerId)&&characters.has(c.characterId)).map(c=>{
    const character=characters.get(c.characterId)!;
    if(!owned.has(c.playerId))owned.set(c.playerId,new Set());
    owned.get(c.playerId)!.add(c.characterId);
    if(!depts.has(c.playerId))depts.set(c.playerId,new Set());
    if(character.departmentId&&departmentNames[character.departmentId])depts.get(c.playerId)!.add(character.departmentId);
    acquisitionCounts.set(c.characterId,(acquisitionCounts.get(c.characterId)??0)+1);
    return {...c,acquiredAt:c.acquiredAt.toISOString(),characterName:character.name,department:departmentNames[character.departmentId??""]??"学科なし",isLegendary:character.isLegendary};
  });
  const rewards=new Map<string,number>();
  for(const r of source.rewards)if(people.has(r.playerId)){
    people.get(r.playerId)!.points+=r.points;
    rewards.set(r.raidResultId,(rewards.get(r.raidResultId)??0)+r.points);
  }
  const battles=new Map<string,{roomId:string;bossName:string;won:boolean;turns:number;participants:number;finishedAt:string}>();
  const results=source.results.filter(r=>people.has(r.playerId)).map(r=>{
    const p=people.get(r.playerId)!;p.raids++;if(r.won)p.victories++;
    usageCounts.set(r.characterId,(usageCounts.get(r.characterId)??0)+1);
    const battle=battles.get(r.roomId);
    if(battle)battle.participants++;
    else battles.set(r.roomId,{roomId:r.roomId,bossName:r.bossName,won:r.won,turns:r.turns,participants:1,finishedAt:r.finishedAt.toISOString()});
    return {...r,finishedAt:r.finishedAt.toISOString(),points:rewards.get(r.id)??0};
  });
  const participants=[...people.values()];
  for(const p of participants){p.collected=owned.get(p.id)?.size??0;p.departments=depts.get(p.id)?.size??0;}
  const rankings={} as Record<RankingMetric,StatisticsParticipant[]>;
  for(const metric of rankingMetrics){
    const sorted=participants.filter(p=>p[metric]>0).sort((a,b)=>b[metric]-a[metric]||a.registeredAt.localeCompare(b.registeredAt)||a.id.localeCompare(b.id));
    let rank=0;sorted.forEach((p,i)=>{if(!i||p[metric]!==sorted[i-1][metric])rank=i+1;p.ranks[metric]=rank;});
    rankings[metric]=sorted;
  }
  const raids=[...battles.values()].sort((a,b)=>a.finishedAt.localeCompare(b.finishedAt)||a.roomId.localeCompare(b.roomId));
  const won=raids.filter(r=>r.won),complete=participants.filter(p=>p.departments===4).length;
  const hours=new Map<string,number>();
  for(const p of participants){const hour=japaneseDate(p.registeredAt).slice(0,13);hours.set(hour,(hours.get(hour)??0)+1);}
  const departmentStats=Object.entries(departmentNames).map(([id,name])=>({id,name,owners:participants.filter(p=>depts.get(p.id)?.has(id)).length}));
  const characterStats=[...source.characters].sort((a,b)=>(acquisitionCounts.get(b.id)??0)-(acquisitionCounts.get(a.id)??0)||a.sortOrder-b.sortOrder).map(c=>({id:c.id,name:c.name,isLegendary:c.isLegendary,owners:acquisitionCounts.get(c.id)??0,uses:usageCounts.get(c.id)??0}));
  const sizes=[...new Set(raids.map(r=>r.participants))].sort((a,b)=>a-b).map(size=>{const group=raids.filter(r=>r.participants===size);return {participants:size,battles:group.length,victories:group.filter(r=>r.won).length};});
  const dashboard={event:source.event,generatedAt:now.toISOString(),summary:{registered:participants.length,collectors:participants.filter(p=>p.collected>0).length,complete,completionRate:participants.length?complete/participants.length:null,raidPlayers:participants.filter(p=>p.raids>0).length,battles:raids.length,victories:won.length,defeats:raids.length-won.length,winRate:raids.length?won.length/raids.length:null,averageTurns:won.length?won.reduce((n,r)=>n+r.turns,0)/won.length:null},hours:[...hours].sort(([a],[b])=>a.localeCompare(b)).map(([hour,count])=>({hour,count})),characters:characterStats,departments:departmentStats,sizes,rankings};
  return {dashboard,participants,collections,raids,results};
}
export type StatisticsSnapshot=ReturnType<typeof buildEventStatistics>;
export type EventStatistics=StatisticsSnapshot["dashboard"];
