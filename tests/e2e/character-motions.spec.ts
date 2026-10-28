import { test, expect } from "@playwright/test";

for (const id of ["thunder-fox", "aqua-spirit", "temp-06", "temp-08", "temp-09", "temp-11"]) {
  test(`${id} previews attack and heal once and returns to its original model`, async ({page},testInfo)=>{
    test.setTimeout(90_000);
    const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
    await page.goto(`/models?character=${id}`);
    const card=page.locator("section[aria-label]"), canvas=card.locator("canvas");
    await expect(canvas).toHaveAttribute("data-raid-motions-ready","true",{timeout:45_000});
    await page.clock.install(); await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+200)));
    for(const [kind,label] of [["attack","攻撃"],["heal","回復"]] as const){
      await card.getByRole("button",{name:label,exact:true}).click(); await page.clock.runFor(850);
      await expect(canvas).toHaveAttribute("data-raid-motion",kind);
      await canvas.screenshot({path:testInfo.outputPath(`${id}-${kind}.png`)});
      await page.clock.runFor(1600); await expect(canvas).toHaveAttribute("data-raid-motion","idle");
    }
    await card.getByRole("button",{name:"攻撃",exact:true}).click(); await page.clock.runFor(400);
    await card.getByRole("button",{name:"停止",exact:true}).click(); await page.clock.runFor(50);
    await expect(canvas).toHaveAttribute("data-raid-motion","idle");
    expect(errors).toEqual([]);
  });
}

test("characters without motion files keep the existing preview",async({page})=>{
  await page.goto("/models?character=forest-golem");
  await expect(page.locator('[data-character-id="forest-golem"]')).toHaveAttribute("data-model-state","ready");
  await expect(page.getByRole("button",{name:"攻撃",exact:true})).toHaveCount(0);
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
  for(const id of ["thunder-fox","temp-09","temp-11"]){
    await picker.selectOption(id); await expect(attack).toBeEnabled({timeout:45_000});
    await expect(canvas).toHaveAttribute("data-character-models",id);
    if(!clockInstalled){await page.clock.install();clockInstalled=true;}
    await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+200)));
    await attack.click(); await page.clock.runFor(800);
    await expect(canvas).toHaveAttribute("data-character-motions",`0:${id}:attack`);
    await page.getByRole("button",{name:"自己回復",exact:true}).click();await page.clock.runFor(800);
    await expect(canvas).toHaveAttribute("data-character-motions",`0:${id}:heal`);
    await page.getByRole("button",{name:"今の演出をもう一度",exact:true}).click();await page.clock.runFor(500);
    await expect(canvas).toHaveAttribute("data-character-motions",`0:${id}:heal`);
    await page.clock.resume();
  }
  await page.screenshot({path:testInfo.outputPath("selected-bushirakko-heal.png")});
  await picker.selectOption("forest-golem");await expect(attack).toBeEnabled();
  await attack.click();await expect(canvas).toHaveAttribute("data-character-motions","");
  await page.getByRole("link",{name:"4人デモ",exact:true}).click();
  await expect(page.getByRole("combobox",{name:"確認するキャラ"})).toHaveValue("");
  await expect(canvas).toHaveAttribute("data-character-models",/^[^,]+,[^,]+,[^,]+,[^,]+$/);
  expect(mutations).toEqual([]);
});
