import { test, expect } from "@playwright/test";
import sharp from "sharp";

for (const id of ["forest-golem", "thunder-fox", "flame-dragon", "aqua-spirit", "temp-06", "temp-07", "temp-08", "temp-09", "temp-10", "temp-11"]) {
  test(`${id} previews its usable actions once and returns to its original model`, async ({page},testInfo)=>{
    test.setTimeout(90_000);
    const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
    await page.goto(`/models?character=${id}`);
    const card=page.locator("section[aria-label]"), canvas=card.locator("canvas");
    await expect(canvas).toHaveAttribute("data-raid-motions-ready","true",{timeout:45_000});
    await page.clock.install(); await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+200)));
    if(["forest-golem","flame-dragon","temp-07","temp-10"].includes(id))await canvas.screenshot({path:testInfo.outputPath(`${id}-idle.png`)});
    for(const [kind,label] of [["attack","攻撃"],["heal","回復"]] as const){
      if((id==="temp-07"&&kind==="heal")||(id==="flame-dragon"&&kind==="attack"))continue;
      await card.getByRole("button",{name:label,exact:true}).click(); await page.clock.runFor(850);
      await expect(canvas).toHaveAttribute("data-raid-motion",kind);
      const screenshot=await canvas.screenshot({path:testInfo.outputPath(`${id}-${kind}.png`)});
      if(["forest-golem","flame-dragon","temp-07","temp-10"].includes(id)){
        const {data,info}=await sharp(screenshot).removeAlpha().raw().toBuffer({resolveWithObject:true});
        let visible=0;
        for(let pixel=0;pixel<data.length;pixel+=info.channels){
          if(Math.abs(data[pixel]-data[0])+Math.abs(data[pixel+1]-data[1])+Math.abs(data[pixel+2]-data[2])>60)visible++;
        }
        expect(visible/(info.width*info.height),`${id} ${kind} must remain visibly framed`).toBeGreaterThan(.02);
      }
      await page.clock.runFor(1600); await expect(canvas).toHaveAttribute("data-raid-motion","idle");
    }
    await card.getByRole("button",{name:id==="flame-dragon"?"回復":"攻撃",exact:true}).click(); await page.clock.runFor(400);
    await card.getByRole("button",{name:"停止",exact:true}).click(); await page.clock.runFor(50);
    await expect(canvas).toHaveAttribute("data-raid-motion","idle");
    expect(errors).toEqual([]);
  });
}

test("the single-frame PasoconMon healing source is kept out of the runtime motion catalog",async({page})=>{
  await page.goto("/models?character=temp-07");
  await expect(page.locator('[data-character-id="temp-07"]')).toHaveAttribute("data-model-state","ready");
  await expect(page.getByRole("button",{name:"攻撃",exact:true})).toHaveCount(1);
  await expect(page.getByRole("button",{name:"回復",exact:true})).toHaveCount(0);
});

test("the boss counter plays the uploaded attack and returns to the complete static boss",async({page},testInfo)=>{
  test.setTimeout(60_000);
  await page.goto("/raid/screen?demo=effects");
  const canvas=page.getByRole("region",{name:"ボスとエフェクト"}).locator("canvas");
  await expect(canvas).toHaveAttribute("data-boss-motions-ready","true",{timeout:30_000});
  await page.clock.install(); await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+200)));
  await page.getByRole("button",{name:"ボスの反撃",exact:true}).click(); await page.clock.runFor(800);
  await expect(canvas).toHaveAttribute("data-boss-motion","attack");
  await canvas.screenshot({path:testInfo.outputPath("boss-authored-attack.png")});
  await page.clock.runFor(1700); await expect(canvas).toHaveAttribute("data-boss-motion","idle");
  await expect(canvas).toHaveAttribute("data-boss-model-url","/models/bosses/des-dragoon-red.glb");
});

test("effects demo selects DB characters and plays their attack/heal without entering a live raid",async({page},testInfo)=>{
  test.setTimeout(120_000);
  const mutations:string[]=[];
  page.on("request",request=>{if(/\/api\/(local-raid|raid)(?:\?|$)/.test(new URL(request.url()).pathname)&&request.method()!=="GET")mutations.push(request.method());});
  await page.setViewportSize({width:1280,height:720});
  await page.goto("/raid/screen?demo=effects&character=thunder-fox");
  const picker=page.getByRole("combobox",{name:"確認するキャラ"});
  const attack=page.getByRole("button",{name:"通常攻撃",exact:true});
  const canvas=page.getByRole("region",{name:"ボスとエフェクト"}).locator("canvas");
  await expect(picker).toHaveValue("thunder-fox");
  await expect(picker.locator('option[value="temp-09"]')).toContainText("デンラコ");
  await expect(picker.locator('option[value="temp-11"]')).toContainText("ブシラッコ");
  let clockInstalled=false;
  for(const id of ["forest-golem","thunder-fox","flame-dragon","temp-07","temp-09","temp-10","temp-11"]){
    await picker.selectOption(id); await expect(attack).toBeEnabled({timeout:45_000});
    await expect(canvas).toHaveAttribute("data-character-models",id);
    if(!clockInstalled){await page.clock.install();clockInstalled=true;}
    await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+200)));
    await attack.click(); await page.clock.runFor(800);
    await expect(canvas).toHaveAttribute("data-character-motions",id==="flame-dragon"?"":`0:${id}:attack`);
    await page.getByRole("button",{name:"自己回復",exact:true}).click();await page.clock.runFor(800);
    await expect(canvas).toHaveAttribute("data-character-motions",id==="temp-07"?"":`0:${id}:heal`);
    if(["forest-golem","flame-dragon","temp-07","temp-10"].includes(id))await canvas.screenshot({path:testInfo.outputPath(`${id}-screen-heal.png`)});
    await page.getByRole("button",{name:"今の演出をもう一度",exact:true}).click();await page.clock.runFor(500);
    await expect(canvas).toHaveAttribute("data-character-motions",id==="temp-07"?"":`0:${id}:heal`);
    await page.clock.resume();
  }
  await page.screenshot({path:testInfo.outputPath("selected-bushirakko-heal.png")});
  await picker.selectOption("forest-golem");await expect(attack).toBeEnabled();
  await attack.click();
  await expect(canvas).toHaveAttribute("data-character-motions","0:forest-golem:attack");
  await page.getByRole("link",{name:"4人デモ",exact:true}).click();
  await expect(page.getByRole("combobox",{name:"確認するキャラ"})).toHaveValue("");
  await expect(canvas).toHaveAttribute("data-character-models",/^[^,]+,[^,]+,[^,]+,[^,]+$/);
  expect(mutations).toEqual([]);
});
