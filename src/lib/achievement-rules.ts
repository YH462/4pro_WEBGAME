export const raidVictoryPoints = 100;
export const collectionDepartmentIds = ["mechanical", "electrical", "control", "civil"] as const;
export type AchievementFacts = { collected: number; departments: number; raids: number; victories: number };
export const achievementRules = [
  { code:"first-companion",badge:"最初のパートナー",title:"駆け出しの冒険者",condition:"パートナーを1体獲得",metric:"collected",target:1,priority:10,icon:"collection" },
  { code:"first-raid",badge:"はじめてのレイド",title:"レイドの仲間",condition:"レイドを1回完了",metric:"raids",target:1,priority:15,icon:"raid" },
  { code:"department-complete",badge:"4学科コンプリート",title:"4学科の探究者",condition:"4学科のパートナーを集める",metric:"departments",target:4,priority:20,icon:"departments" },
  { code:"victory-1",badge:"初討伐",title:"ドラグーン討伐者",condition:"レイドで1回討伐成功",metric:"victories",target:1,priority:30,icon:"victory" },
  { code:"victory-3",badge:"討伐の達人",title:"レイドの勇士",condition:"レイドで3回討伐成功",metric:"victories",target:3,priority:40,icon:"victory" },
  { code:"victory-10",badge:"討伐の英雄",title:"レイドの英雄",condition:"レイドで10回討伐成功",metric:"victories",target:10,priority:50,icon:"victory" },
] as const;
export type AchievementCode = (typeof achievementRules)[number]["code"];
export type AchievementView = {
  code:AchievementCode;badge:string;title:string;condition:string;icon:"collection"|"raid"|"departments"|"victory";
  earnedAt:string|null;progress:number;target:number;
};
export type PlayerAwardsView = {
  points:number;activeTitle:string|null;achievements:AchievementView[];
  rewards:{id:string;points:number;bossName:string;awardedAt:string}[];
};
export function eligibleAchievements(facts:AchievementFacts) {
  return achievementRules.filter(rule=>facts[rule.metric]>=rule.target);
}
export function achievementViews(facts:AchievementFacts, earned:readonly {code:string;earnedAt:Date}[]) {
  const byCode=new Map(earned.map(item=>[item.code,item.earnedAt]));
  const achievements=achievementRules.map(rule=>({code:rule.code,badge:rule.badge,title:rule.title,condition:rule.condition,icon:rule.icon,target:rule.target,progress:Math.min(rule.target,facts[rule.metric]),earnedAt:byCode.get(rule.code)?.toISOString()??null}));
  const active=achievementRules.filter(rule=>byCode.has(rule.code)).sort((a,b)=>b.priority-a.priority)[0];
  return {achievements,activeTitle:active?.title??null};
}
