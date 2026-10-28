import {describe,it,expect} from "vitest";
import {eligibleAchievements,achievementViews,raidVictoryPoints} from "../../src/lib/achievement-rules";

describe("achievement milestones",()=>{
  it("grants no achievements before collection or a completed raid",()=>{
    expect(eligibleAchievements({collected:0,departments:0,raids:0,victories:0})).toEqual([]);
    expect(raidVictoryPoints).toBe(100);
  });
  it("requires all four different departments, not just four owned characters",()=>{
    const facts={collected:4,departments:0,raids:0,victories:0};
    expect(eligibleAchievements(facts).map(rule=>rule.code)).toEqual(["first-companion"]);
    expect(eligibleAchievements({...facts,departments:4}).map(rule=>rule.code)).toContain("department-complete");
  });
  it("awards completion on defeat, but victory badges only at 1, 3 and 10 wins",()=>{
    const facts={collected:0,departments:0,raids:1,victories:0};
    expect(eligibleAchievements(facts).map(rule=>rule.code)).toEqual(["first-raid"]);
    for(const [wins,expected] of [[1,["victory-1"]],[2,["victory-1"]],[3,["victory-1","victory-3"]],[9,["victory-1","victory-3"]],[10,["victory-1","victory-3","victory-10"]]] as const){
      expect(eligibleAchievements({...facts,raids:20,victories:wins}).filter(rule=>rule.metric==="victories").map(rule=>rule.code)).toEqual(expected);
    }
  });
  it("shows only a persisted earned title and selects the highest milestone",()=>{
    const facts={collected:5,departments:4,raids:12,victories:10};
    expect(achievementViews(facts,[]).activeTitle).toBeNull();
    const earned=[{code:"victory-10",earnedAt:new Date(1)},{code:"first-companion",earnedAt:new Date(2)}];
    const result=achievementViews(facts,earned);
    expect(result.activeTitle).toBe("レイドの英雄");
    expect(result.achievements.find(item=>item.code==="victory-3")).toMatchObject({earnedAt:null,progress:3,target:3});
    expect(result.achievements.find(item=>item.code==="victory-10")?.earnedAt).toBe(new Date(1).toISOString());
  });
});
