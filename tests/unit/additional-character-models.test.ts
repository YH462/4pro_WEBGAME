import { describe,expect,it } from "vitest";
import { characters } from "../../src/lib/master-data";
import { characterModels } from "../../src/lib/character-models";

describe("additional character identity",()=>{
  it("reuses the seven placeholder IDs as ordinary non-department characters",()=>{
    const additional=Object.entries(characterModels).filter(([,asset])=>asset.displayName);
    expect(additional.map(([id])=>id)).toEqual(["temp-06","temp-07","temp-08","temp-09","temp-10","temp-11","temp-12"]);
    for(const [id,asset] of additional){
      expect(characters.find(character=>character.id===id)).toMatchObject({name:asset.displayName,departmentId:null,isLegendary:false,isDraft:false});
      expect(asset.department).toBeNull();
    }
    expect(characters).toHaveLength(12);
    expect(characters.find(character=>character.id==="temp-12")).toMatchObject({name:"還暦",isDraft:false,baseHp:160,baseAttack:28,baseDefense:36});
  });
});
