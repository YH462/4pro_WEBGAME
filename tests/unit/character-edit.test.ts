import { describe,expect,it } from "vitest";
import { characterEditSchema,characterImageUrl } from "../../src/lib/character-edit-input";
const input={name:"新しい仲間",description:"紹介文\n2行目",element:"AQUA",baseHp:150,baseAttack:30,baseDefense:25,baseSpecialChargeRate:null,isDraft:false,revision:0,imageAction:"keep"};
describe("character editing input",()=>{
  it("allows Japanese text and unset charge with explicit revision",()=>{expect(characterEditSchema.parse({...input,name:"  新しい仲間  "})).toEqual(input);});
  it("rejects invalid values and identity or unlock changes",()=>{
    for(const change of [{name:" "},{name:"x".repeat(51)},{description:"x".repeat(1001)},{name:"bad\u0000"},{baseHp:0},{baseAttack:-1},{baseDefense:1.2},{baseHp:10001},{baseSpecialChargeRate:-1},{element:"unknown"},{id:"different"},{departmentId:"civil"},{isLegendary:true},{revision:-1},{imageAction:"url"}])expect(characterEditSchema.safeParse({...input,...change}).success).toBe(false);
  });
  it("uses versioned local asset identifiers",()=>{expect(characterImageUrl(null)).toBeNull();expect(characterImageUrl("id")).toBe("/api/character-images/id");});
});
