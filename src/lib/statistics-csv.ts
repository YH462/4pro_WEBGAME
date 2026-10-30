import { japaneseDate, type StatisticsSnapshot } from "./event-statistics";

export const statisticsFiles=["summary","participants","collections","raids","raid-participants"] as const;
export type StatisticsFile=typeof statisticsFiles[number];
type Cell=string|number|boolean|null;
export function statisticsCsv(rows:Cell[][]){
  const cell=(value:Cell)=>{
    let text=value===null?"":String(value);
    if(typeof value==="string"&&/^[\s\u0000-\u001f]*[=+\-@\t\r\n]/.test(text))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  return Buffer.from("\ufeff"+rows.map(row=>row.map(cell).join(",")).join("\r\n")+"\r\n","utf8");
}
export function exportStatistics(snapshot:StatisticsSnapshot){
  const {dashboard:d,participants,collections,raids,results}=snapshot;
  const person=new Map(participants.map(p=>[p.id,p.nickname??""]));
  const meta:Cell[]=[d.event.id,japaneseDate(d.generatedAt)];
  const headers=(columns:string[])=>[...columns,"イベントID","出力日時"];
  const csv=(head:string[],rows:Cell[][])=>statisticsCsv([headers(head),...rows.map(row=>[...row,...meta])]);
  const summary:[string,number|null,string][]=[
    ["参加登録数",d.summary.registered,"人"],["収集参加者数",d.summary.collectors,"人"],["4学科達成人数",d.summary.complete,"人"],["4学科達成率",d.summary.completionRate===null?null:d.summary.completionRate*100,"%"],
    ["レイド参加者数",d.summary.raidPlayers,"人"],["完了した戦闘数",d.summary.battles,"戦"],["討伐成功数",d.summary.victories,"戦"],["全滅数",d.summary.defeats,"戦"],["討伐成功率",d.summary.winRate===null?null:d.summary.winRate*100,"%"],["平均討伐ターン",d.summary.averageTurns,"ターン"],
  ];
  return {
    summary:csv(["指標","値","単位"],summary),
    participants:csv(["参加者ID","ニックネーム","登録日時","収集数","学科数","完了レイド数","討伐成功数","討伐ポイント","収集順位","討伐順位","ポイント順位"],participants.map(p=>[p.id,p.nickname,japaneseDate(p.registeredAt),p.collected,p.departments,p.raids,p.victories,p.points,p.ranks.collected,p.ranks.victories,p.ranks.points])),
    collections:csv(["参加者ID","ニックネーム","キャラID","キャラ名","学科","レジェンド","獲得日時"],collections.map(c=>[c.playerId,person.get(c.playerId)??"",c.characterId,c.characterName,c.department,c.isLegendary,japaneseDate(c.acquiredAt)])),
    raids:csv(["戦闘ID","ボス名","勝敗","ターン数","記録された参加者数","完了日時"],raids.map(r=>[r.roomId,r.bossName,r.won?"討伐成功":"全滅",r.turns,r.participants,japaneseDate(r.finishedAt)])),
    "raid-participants":csv(["戦闘ID","参加者ID","ニックネーム","使用キャラID","戦闘時のキャラ名","勝敗","ターン数","完了日時","付与ポイント"],results.map(r=>[r.roomId,r.playerId,person.get(r.playerId)??"",r.characterId,r.characterName,r.won?"討伐成功":"全滅",r.turns,japaneseDate(r.finishedAt),r.points])),
  } satisfies Record<StatisticsFile,Buffer>;
}

/** Five small UTF-8 CSV entries in standard ZIP32 (stored, with CRC-32). No runtime dependency. */
export function csvZip(files:Record<string,Buffer>){
  const crc32=(data:Buffer)=>{let crc=0xffffffff;for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
  const local:Buffer[]=[],central:Buffer[]=[];let offset=0;
  for(const [filename,data] of Object.entries(files)){
    const name=Buffer.from(filename,"utf8"),crc=crc32(data);
    const head=Buffer.alloc(30);head.writeUInt32LE(0x04034b50);head.writeUInt16LE(20,4);head.writeUInt16LE(0x800,6);head.writeUInt16LE(0x21,12);head.writeUInt32LE(crc,14);head.writeUInt32LE(data.length,18);head.writeUInt32LE(data.length,22);head.writeUInt16LE(name.length,26);
    const directory=Buffer.alloc(46);directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(0x800,8);directory.writeUInt16LE(0x21,14);directory.writeUInt32LE(crc,16);directory.writeUInt32LE(data.length,20);directory.writeUInt32LE(data.length,24);directory.writeUInt16LE(name.length,28);directory.writeUInt32LE(offset,42);
    local.push(head,name,data);central.push(directory,name);offset+=head.length+name.length+data.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
