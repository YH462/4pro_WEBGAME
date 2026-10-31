import { test, expect, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { hashAdminPassword } from "../../src/lib/admin-password";
import type { LocalRaidSnapshot } from "../../src/lib/local-raid-types";
import { collectSmallText } from "../../scripts/ui-review/small-text";
import { LocalRaidRoom, raidTutorialMs } from "../../src/lib/local-raid-room";

const eventId = "raid-production-test", origin = "http://localhost:13026";
const configured = process.env.EVENT_ID === eventId && new URL(process.env.DATABASE_URL || "postgresql://localhost:5432/unused").port === "55436";
test.skip(!configured, "Use playwright.production.config.ts with the isolated production-raid test database.");
// Three recorded software-WebGL surfaces can dominate the ten-second input
// window. Other test files retain traces; this suite checks the live surfaces.
test.use({trace:"off"});
const db = new PrismaClient(), playerIds: string[] = [], adminIds: string[] = [];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
let adminHeaders: Record<string, string>, adminToken: string;
let adminUsername: string, adminPassword: string;
async function player() {
  const token = randomBytes(32).toString("base64url");
  const row = await db.player.create({ data: { eventId, nickname: `同期${playerIds.length + 1}`, sessions: { create: { tokenHash: hash(token), expiresAt: new Date(Date.now() + 3600_000) } } } });
  playerIds.push(row.id);
  return { ...row, token, headers: { origin, cookie: `fourpro_guest=${token}` } };
}
async function post(request: APIRequestContext, headers: Record<string, string>, data: object) {
  if ((data as { type?: string }).type === "join" && !(data as { roomId?: string }).roomId) {
    const response = await request.get("/api/raid", { headers: adminHeaders });
    expect(response.status()).toBe(200);
    data = { ...data, roomId: (await response.json()).state.roomId };
  }
  return request.post("/api/raid", { headers, data });
}
async function snapshot(request: APIRequestContext, headers = adminHeaders, personal = false): Promise<LocalRaidSnapshot> {
  const response = await request.get(`/api/raid${personal ? "?personal=1" : ""}`, { headers });
  expect(response.status()).toBe(200); return (await response.json()).state;
}

// Shift server deadlines only in this isolated database; production has no clock override.
async function endExplanation(request: APIRequestContext) {
  await expect.poll(async () => (await snapshot(request)).round.phase).toBe("tutorial");
  await db.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ state: { phase: string; closesAt: number; admissionClosesAt: number } }[]>`SELECT "state" FROM "RaidRoom" WHERE "eventId" = ${eventId} FOR UPDATE`;
    const state = rows[0].state;
    expect(state.phase).toBe("tutorial");
    const elapsed = state.closesAt - Date.now() + 100;
    await tx.raidRoom.update({ where: { eventId }, data: { state: { ...state, closesAt: state.closesAt - elapsed, admissionClosesAt: state.admissionClosesAt - elapsed } } });
  });
  return snapshot(request);
}

test.beforeEach(async () => {
  await db.event.upsert({ where: { id: eventId }, create: { id: eventId, name: "本番同期の専用検証" }, update: { status: "ACTIVE", endedAt: null, purgeAt: null } });
  await db.raidRoom.deleteMany({ where: { eventId } });
  adminToken = randomBytes(32).toString("base64url");
  adminUsername = `raid_${randomUUID().slice(0,8)}`; adminPassword = randomUUID();
  const admin = await db.adminUser.create({ data: { username: adminUsername, passwordHash: await hashAdminPassword(adminPassword), sessions: { create: { tokenHash: hash(adminToken), expiresAt: new Date(Date.now() + 3600_000) } } } });
  adminIds.push(admin.id); adminHeaders = { origin, cookie: `fourpro_admin=${adminToken}` };
});
test.afterEach(async () => {
  await db.event.update({ where: { id: eventId }, data: { status: "ACTIVE", endedAt: null, purgeAt: null } });
  await db.raidRoom.deleteMany({ where: { eventId } });
  await db.player.deleteMany({ where: { id: { in: playerIds.splice(0) } } });
  await db.adminUser.deleteMany({ where: { id: { in: adminIds.splice(0) } } });
  await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "raid-" } } });
});
test.afterAll(async () => { await db.$disconnect(); });

type MusicProbe = { contexts: AudioContext[]; sources: AudioBufferSourceNode[]; gains: GainNode[]; analyser?: AnalyserNode };
declare global { interface Window { __raidMusicProbe: MusicProbe } }
async function observeMusic(page: import("@playwright/test").Page, accelerate = true) {
  await page.addInitScript(({ accelerate }) => {
    const probe: MusicProbe = { contexts: [], sources: [], gains: [] };
    window.__raidMusicProbe = probe;
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) { super(options); probe.contexts.push(this); }
      createBufferSource() {
        const source = super.createBufferSource(); probe.sources.push(source);
        // Traverse the actual MP3 loop boundaries in a short browser test.
        if (accelerate) source.playbackRate.value = 100;
        return source;
      }
      createGain() {
        const gain = super.createGain(); probe.gains.push(gain);
        if (probe.gains.length === 1) { probe.analyser = this.createAnalyser(); gain.connect(probe.analyser); }
        return gain;
      }
    };
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      return kind.includes("webgl") ? null : Reflect.apply(original, this, [kind, ...args]);
    } as typeof original;
  }, { accelerate });
}

test("attack effects sound once at contact, distinguish critical hits and respect independent mute and replay", async ({ page }, testInfo) => {
  await observeMusic(page, false);
  await page.goto("/raid/screen?demo=effects");
  await expect(page.getByRole("button", { name: "通常攻撃", exact: true })).toBeEnabled();
  const enable = page.getByRole("button", { name: "効果音をオンにする", exact: true });
  await expect(enable).toHaveAttribute("aria-pressed", "false");
  await enable.click();
  await expect(page.getByRole("button", { name: "効果音をオフにする", exact: true })).toHaveText("効果音 オン");
  await page.screenshot({ path: testInfo.outputPath("attack-sound-control.png") });
  await expect(page.getByRole("button", { name: "BGMをオンにする", exact: true })).toBeVisible();
  await page.clock.install();
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 200)));
  const voices = () => page.evaluate(() => window.__raidMusicProbe.sources.length);
  await page.getByRole("button", { name: "通常攻撃", exact: true }).click();
  await page.clock.runFor(600); expect(await voices()).toBe(0);
  await page.clock.runFor(100); expect(await voices()).toBe(1);
  expect(await page.evaluate(() => window.__raidMusicProbe.sources[0].buffer?.duration)).toBeCloseTo(.42, 3);
  await expect.poll(() => page.evaluate(() => {
    const analyser = window.__raidMusicProbe.analyser!, data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data); return data.some(sample => Math.abs(sample) > .001);
  }), { intervals: [10, 20, 50] }).toBe(true);
  await page.clock.runFor(1800); expect(await voices()).toBe(1);
  await page.getByRole("button", { name: "効果音をオフにする", exact: true }).click();
  await page.getByRole("button", { name: "2倍攻撃", exact: true }).click();
  await page.clock.runFor(900); expect(await voices()).toBe(1);
  // Enabling after contact must not emit an old hit.
  await enable.click(); await page.clock.runFor(400); expect(await voices()).toBe(1);
  await page.getByRole("button", { name: "今の演出をもう一度", exact: true }).click();
  await page.clock.runFor(700); expect(await voices()).toBe(2);
  expect(await page.evaluate(() => window.__raidMusicProbe.sources[1].buffer?.duration)).toBeCloseTo(.9, 3);
  await page.clock.runFor(1400); expect(await voices()).toBe(2);
  // Cancelling an attack before contact cannot leave a delayed sound behind.
  await page.getByRole("button", { name: "通常攻撃", exact: true }).click(); await page.clock.runFor(300);
  await page.getByRole("button", { name: "待機", exact: true }).click(); await page.clock.runFor(1000);
  expect(await voices()).toBe(2);
  await page.getByRole("button", { name: "通常攻撃", exact: true }).click(); await page.clock.runFor(300);
  await page.getByRole("button", { name: "演出を一時停止", exact: true }).click(); await page.clock.runFor(1000);
  expect(await voices()).toBe(2);
  await page.getByRole("button", { name: "演出を再開", exact: true }).click(); await page.clock.runFor(400);
  expect(await voices()).toBe(3);
  await page.clock.resume();
  await page.getByRole("button", { name: "BGMをオンにする", exact: true }).click();
  await expect(page.getByRole("button", { name: "BGMをオフにする", exact: true })).toHaveText("BGM オン");
  await page.getByRole("button", { name: "効果音をオフにする", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__raidMusicProbe.contexts.map(context => context.state))).toEqual(["suspended", "running"]);
  await expect(page.getByRole("button", { name: "BGMをオフにする", exact: true })).toBeVisible();
  await page.reload(); await expect(enable).toBeVisible();
  expect(await page.evaluate(() => window.__raidMusicProbe.contexts.length)).toBe(0);
});

test("counter effects use a distinct breath sound at the team impact and obey mute and replay", async ({ page }) => {
  await observeMusic(page, false);
  await page.goto("/raid/screen?demo=effects");
  await expect(page.getByRole("button", { name: "ボスの反撃", exact: true })).toBeEnabled();
  const enable = page.getByRole("button", { name: "効果音をオンにする", exact: true });
  await enable.click();
  await expect(page.getByRole("button", { name: "効果音をオフにする", exact: true })).toHaveText("効果音 オン");
  await page.clock.install(); await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 200)));
  const voices = () => page.evaluate(() => window.__raidMusicProbe.sources.length);
  await page.getByRole("button", { name: "ボスの反撃", exact: true }).click();
  await page.clock.runFor(1500); expect(await voices()).toBe(0);
  await page.clock.runFor(100); expect(await voices()).toBe(1);
  expect(await page.evaluate(() => window.__raidMusicProbe.sources[0].buffer?.duration)).toBeCloseTo(1.3, 3);
  await expect.poll(() => page.evaluate(() => {
    const analyser = window.__raidMusicProbe.analyser!, samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples); return samples.some(sample => Math.abs(sample) > .001);
  }), { intervals: [10, 20, 50] }).toBe(true);
  await page.clock.runFor(2000); expect(await voices()).toBe(1);
  await page.getByRole("button", { name: "効果音をオフにする", exact: true }).click();
  await page.getByRole("button", { name: "今の演出をもう一度", exact: true }).click();
  await page.clock.runFor(1700); expect(await voices()).toBe(1);
  await enable.click(); await page.clock.runFor(400); expect(await voices()).toBe(1);
  await page.getByRole("button", { name: "今の演出をもう一度", exact: true }).click();
  await page.clock.runFor(1600); expect(await voices()).toBe(2);
  await page.getByRole("button", { name: "ボスの反撃", exact: true }).click(); await page.clock.runFor(800);
  await page.getByRole("button", { name: "待機", exact: true }).click(); await page.clock.runFor(1000);
  expect(await voices()).toBe(2);
  await page.clock.resume();
});

test("twenty simultaneous attackers share one attack and one counter sound across polling and the next round", async ({ page, request }) => {
  await observeMusic(page, false);
  await page.context().addCookies([{ name: "fourpro_admin", value: adminToken, url: origin }]);
  await page.goto("/raid/screen");
  await page.getByRole("button", { name: "効果音をオンにする", exact: true }).click();
  await expect(page.getByRole("button", { name: "効果音をオフにする", exact: true })).toHaveText("効果音 オン");
  let now = Date.now();
  const room = new LocalRaidRoom(() => "paper", () => now);
  const guests = [];
  for (let i = 0; i < 20; i++) { const guest = await player(); guests.push(guest); room.join(guest.id, "forest-golem", 170, guest.nickname!); }
  const roomId = room.snapshot().roomId; room.start(roomId); now += raidTutorialMs; room.snapshot();
  for (const guest of guests) room.command(guest.id, { roomId, round: 1, requestId: randomUUID(), action: "attack", hand: "scissors" });
  now += 10_000; room.snapshot(); room.reveal(roomId, 1);
  await db.raidRoom.update({ where: { eventId }, data: { state: JSON.parse(JSON.stringify(room.save())) } });
  await expect.poll(() => page.evaluate(() => window.__raidMusicProbe.sources.length)).toBe(1);
  expect((await snapshot(request)).participants).toBe(20);
  expect(await page.evaluate(() => window.__raidMusicProbe.sources[0].loop)).toBe(false);
  await expect.poll(async () => (await snapshot(request)).round.number, { timeout: 15_000 }).toBe(2);
  expect(await page.evaluate(() => window.__raidMusicProbe.sources.length)).toBe(2);
  expect(await page.evaluate(() => window.__raidMusicProbe.sources.map(source => source.buffer?.duration))).toEqual([.9, 1.3]);
  await expect(page.getByRole("button", { name: "BGMをオンにする", exact: true })).toBeVisible();
});

test("screen BGM loops continuously, follows reception and battle, and obeys the operator mute", async ({ page, request }, testInfo) => {
  await observeMusic(page);
  const downloads: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/music/")) downloads.push(request.url()); });
  await page.context().addCookies([{ name: "fourpro_admin", value: adminToken, url: origin }]);
  await page.setViewportSize({ width: 1292, height: 724 }); await page.goto("/raid/screen");
  const turnOn = page.getByRole("button", { name: "BGMをオンにする", exact: true });
  await expect(turnOn).toHaveAttribute("aria-pressed", "false");
  expect(downloads).toHaveLength(0);
  expect(await page.evaluate(() => window.__raidMusicProbe.contexts.length)).toBe(0);
  const selection=page.getByRole("combobox",{name:"バトルBGM",exact:true});
  await expect(selection.locator("option")).toHaveText(["BattleBGM1","BattleBGM2","BattleBGM3"]);
  await selection.selectOption("BattleBGM2");expect(downloads).toHaveLength(0);
  await turnOn.click();
  await expect(page.getByRole("button", { name: "BGMをオフにする", exact: true })).toHaveText("BGM オン");
  await expect.poll(()=>downloads.length).toBe(2);
  expect(downloads.map(url=>new URL(url).pathname).sort()).toEqual(["/music/BattleBGM2.mp3","/music/LobbyBGM.mp3"]);
  expect(await page.evaluate(() => window.__raidMusicProbe.sources.length)).toBe(1);
  const lobbyLoopSeconds=await page.evaluate(()=>window.__raidMusicProbe.sources[0].buffer!.duration*2/100+.2);
  await expect.poll(() => page.evaluate(() => window.__raidMusicProbe.contexts[0].currentTime), { timeout: 15_000 }).toBeGreaterThan(lobbyLoopSeconds);
  const audible = () => page.evaluate(() => {
    const analyser = window.__raidMusicProbe.analyser!, samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples); return samples.some(sample => Math.abs(sample) > .0001);
  });
  await expect.poll(audible).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__raidMusicProbe.gains.map(gain => Math.round(gain.gain.value * 1000) / 1000))).toEqual([.4, 1]);
  await selection.selectOption("BattleBGM3");
  await expect.poll(()=>downloads.length).toBe(3);
  expect(await page.evaluate(() => window.__raidMusicProbe.sources.length)).toBe(1);
  await page.screenshot({ path: testInfo.outputPath("lobby-bgm-on.png") });
  const guest = await player();
  expect((await post(request, guest.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(200);
  await page.getByRole("button", { name: "ルール説明を開始（49秒）", exact: true }).click();
  await endExplanation(request);
  await expect.poll(() => page.evaluate(() => window.__raidMusicProbe.gains.slice(1).map(gain => gain.gain.value))).toEqual([0, 1]);
  await expect.poll(audible).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("battle-bgm-on.png") });
  const battleLoopEnd=await page.evaluate(()=>window.__raidMusicProbe.contexts[0].currentTime+window.__raidMusicProbe.sources[1].buffer!.duration*2/100+.2);
  await expect.poll(()=>page.evaluate(()=>window.__raidMusicProbe.contexts[0].currentTime),{timeout:15_000}).toBeGreaterThan(battleLoopEnd);
  expect(await page.evaluate(()=>window.__raidMusicProbe.sources.length)).toBe(2);
  await selection.selectOption("BattleBGM1");
  await expect.poll(()=>page.evaluate(()=>window.__raidMusicProbe.sources.length)).toBe(3);
  await selection.selectOption("BattleBGM2");
  await expect.poll(()=>page.evaluate(()=>window.__raidMusicProbe.sources.length)).toBe(4);
  await selection.selectOption("BattleBGM3");
  await expect.poll(()=>page.evaluate(()=>window.__raidMusicProbe.sources.length)).toBe(5);
  const current = await snapshot(request);
  expect((await post(request, adminHeaders, { type: "reset", roomId: current.roomId })).status()).toBe(200);
  await expect.poll(() => page.evaluate(() => window.__raidMusicProbe.gains.slice(1).map(gain => gain.gain.value))).toEqual([0, 0, 0, 0, 0, 1]);
  await expect(selection).toHaveValue("BattleBGM3");
  await page.getByRole("button", { name: "BGMをオフにする", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__raidMusicProbe.contexts[0].state)).toBe("suspended");
  await turnOn.click();
  await expect.poll(() => page.evaluate(() => window.__raidMusicProbe.contexts[0].state)).toBe("running");
  await expect.poll(audible).toBe(true);
  expect(await page.evaluate(() => window.__raidMusicProbe.sources.length)).toBe(6);
  expect(downloads).toHaveLength(4);
  expect(await page.evaluate(()=>window.__raidMusicProbe.sources.every(source=>source.loop&&source.loopStart===0&&source.loopEnd===source.buffer!.duration))).toBe(true);
  await page.reload(); await expect(turnOn).toBeVisible();
  expect(await page.evaluate(() => window.__raidMusicProbe.contexts.length)).toBe(0);
});

test("screen BGM can cancel loading and recover from an audio download failure", async ({ page }) => {
  await observeMusic(page);
  await page.context().addCookies([{ name: "fourpro_admin", value: adminToken, url: origin }]);
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/music/*.mp3", async route => { await delayed; await route.continue(); });
  await page.goto("/raid/screen");
  await page.getByRole("button", { name: "BGMをオンにする", exact: true }).click();
  await expect(page.getByRole("button", { name: "BGMをオフにする", exact: true })).toHaveText("BGM 読込中");
  await page.getByRole("button", { name: "BGMをオフにする", exact: true }).click();
  release();
  expect(await page.evaluate(() => window.__raidMusicProbe.sources.length)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__raidMusicProbe.contexts[0].state)).toBe("suspended");
  await expect(page.getByRole("button", { name: "BGMをオンにする", exact: true })).toBeVisible();
  await page.unroute("**/music/*.mp3");
  await page.reload();
  await page.route("**/music/*.mp3", route => route.fulfill({ status: 503, body: "unavailable" }));
  await page.getByRole("button", { name: "BGMをオンにする", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "BGMを再生できません" })).toBeVisible();
  await page.unroute("**/music/*.mp3");
  await page.getByRole("button", { name: "BGMをオンにする", exact: true }).click();
  await expect(page.getByRole("button", { name: "BGMをオフにする", exact: true })).toHaveText("BGM オン");
  await expect(page.getByRole("alert").filter({ hasText: "BGMを再生できません" })).toHaveCount(0);
});

test("reception QR, removal and voluntary leave prevent silent re-entry and close admission after the grace period", async ({ page, browser, request }, testInfo) => {
  test.setTimeout(90_000);
  const first = await player(), second = await player(), late = await player();
  await db.playerCharacter.create({ data: { playerId: first.id, characterId: "forest-golem" } });
  const initial = await snapshot(request);
  expect((await request.get(`/api/raid/entry?roomId=${initial.roomId}`)).status()).toBe(401);
  const getEntry = async (roomId: string) => {
    const response = await request.get(`/api/raid/entry?roomId=${roomId}`, { headers: adminHeaders });
    expect(response.status()).toBe(200); return (await response.json()).target as { url: string; qrImage: string };
  };
  const entry = await getEntry(initial.roomId);
  expect(new URL(entry.url).searchParams.get("room")).toBe(initial.roomId);
  const withoutWebGl = () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      return kind.includes("webgl") ? null : Reflect.apply(original, this, [kind, ...args]);
    } as typeof original;
  };
  await page.addInitScript(withoutWebGl);
  await page.context().addCookies([{ name: "fourpro_admin", value: adminToken, url: origin }]);
  await page.setViewportSize({ width: 1292, height: 724 }); await page.goto("/raid/screen");
  await expect(page.getByRole("link", { name: `参加URL ${entry.url}`, exact: true })).toBeVisible();
  const phoneContext = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    await phoneContext.addInitScript(withoutWebGl);
    await phoneContext.addCookies([{ name: "fourpro_guest", value: first.token, url: origin }]);
    const phone = await phoneContext.newPage(); await phone.goto(entry.url);
    await expect(phone.getByRole("button", { name: "このレイドに参加", exact: true })).toBeEnabled();
    expect((await snapshot(request)).participants).toBe(0);
    await phone.getByRole("button", { name: "このレイドに参加", exact: true }).click();
    await expect.poll(async () => (await snapshot(request)).participants).toBe(1);
    await page.getByRole("button", { name: "参加者管理", exact: true }).click();
    const roster = page.getByRole("dialog", { name: "参加者管理", exact: true });
    await expect(roster).toBeVisible();
    await roster.getByRole("button", { name: `${first.nickname}の参加を解除`, exact: true }).click();
    await expect(phone.getByRole("heading", { name: "参加が解除されています", exact: true })).toBeVisible();
    expect((await snapshot(request)).participants).toBe(0);
    await phone.reload();
    expect((await post(request, first.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(409);
    expect(await db.playerCharacter.count({ where: { playerId: first.id } })).toBe(1);
    expect(await db.raidResult.count({ where: { playerId: first.id } })).toBe(0);
    await page.getByRole("button", { name: "参加者管理を閉じる", exact: true }).click();
    await phoneContext.addCookies([{ name: "fourpro_guest", value: second.token, url: origin }]);
    await phone.goto(entry.url); await phone.getByRole("button", { name: "このレイドに参加", exact: true }).click();
    await phone.getByRole("button", { name: "参加取消", exact: true }).click();
    await expect(phone.getByRole("button", { name: "このレイドに参加", exact: true })).toBeEnabled();
    expect((await snapshot(request)).participants).toBe(0);
    await phone.getByRole("button", { name: "このレイドに参加", exact: true }).click();
    await expect.poll(async () => (await snapshot(request)).participants).toBe(1);
    const waiting = await snapshot(request);
    expect((await post(request, second.headers, { type: "remove", roomId: waiting.roomId, participantId: waiting.members[0].id })).status()).toBe(401);
    await page.getByRole("button", { name: "参加QRを大きく表示", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "スマホでレイドに参加", exact: true })).toBeVisible();
    expect((await post(request, adminHeaders, { type: "start", roomId: waiting.roomId })).status()).toBe(200);
    await expect(page.getByRole("region", { name: "バトル前のルール説明", exact: true })).toBeVisible();
    expect((await request.get(`/api/raid/entry?roomId=${waiting.roomId}`, { headers: adminHeaders })).status()).toBe(200);
    expect((await post(request, late.headers, { type: "join", roomId: waiting.roomId, characterId: "forest-golem" })).status()).toBe(200);
    await endExplanation(request);
    await db.$executeRaw`UPDATE "RaidRoom" SET "state" = jsonb_set("state", '{admissionClosesAt}', to_jsonb(${Date.now() - 1}::bigint)) WHERE "eventId" = ${eventId}`;
    await expect(page.getByRole("region", { name: "レイド参加案内", exact: true })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "スマホでレイドに参加", exact: true })).toHaveCount(0);
    expect((await request.get(`/api/raid/entry?roomId=${waiting.roomId}`, { headers: adminHeaders })).status()).toBe(409);
    expect((await post(request, (await player()).headers, { type: "join", roomId: waiting.roomId, characterId: "forest-golem" })).status()).toBe(409);
    expect((await post(request, adminHeaders, { type: "remove", roomId: waiting.roomId, participantId: waiting.members[0].id })).status()).toBe(409);
    expect((await post(request, second.headers, { type: "leave", roomId: waiting.roomId })).status()).toBe(409);
    expect((await snapshot(request)).participants).toBe(2);
    await page.screenshot({ path: testInfo.outputPath("battle-admission-closed.png") });
    expect((await post(request, adminHeaders, { type: "reset", roomId: waiting.roomId })).status()).toBe(200);
    const reset = await snapshot(request), nextEntry = await getEntry(reset.roomId);
    expect(nextEntry.url).not.toBe(entry.url); expect(nextEntry.qrImage).not.toBe(entry.qrImage);
    await expect(page.getByRole("link", { name: `参加URL ${nextEntry.url}`, exact: true })).toBeVisible();
    await expect(phone.getByRole("heading", { name: "次の受付QRを読み取ってください", exact: true })).toBeVisible();
    await phone.reload();
    expect((await snapshot(request)).participants).toBe(0);
    expect((await post(request, late.headers, { type: "join", roomId: waiting.roomId, characterId: "forest-golem" })).status()).toBe(409);
    expect((await request.post("/api/raid", { headers: late.headers, data: { type: "join", characterId: "forest-golem" } })).status()).toBe(409);
    await phoneContext.addCookies([{ name: "fourpro_guest", value: first.token, url: origin }]);
    await phone.goto(nextEntry.url); await phone.getByRole("button", { name: "このレイドに参加", exact: true }).click();
    await expect.poll(async () => (await snapshot(request)).participants).toBe(1);
    await phone.screenshot({ path: testInfo.outputPath("new-reception-explicit-admission.png") });
  } finally { await phoneContext.close(); }
});

test("the full opening voice precedes battle and phones can join until thirty seconds after it begins", async ({ page, browser, request }, testInfo) => {
  test.setTimeout(120_000);
  const host = await player(), duringRules = await player(), duringAnimation = await player(), tooLate = await player();
  expect((await post(request, host.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(200);
  const initial = await snapshot(request), entryUrl = `${origin}/battle/raid?room=${initial.roomId}`;
  await observeMusic(page, false);
  await page.context().addCookies([{ name: "fourpro_admin", value: adminToken, url: origin }]);
  await page.setViewportSize({ width: 1366, height: 768 }); await page.goto("/raid/screen");
  const phoneContext = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    await phoneContext.addCookies([{ name: "fourpro_guest", value: duringRules.token, url: origin }]);
    const phone = await phoneContext.newPage(); await observeMusic(phone, false); await phone.goto(entryUrl);
    await expect(phone.getByRole("region", { name: "レイド参加受付" })).toContainText("まだ参加は完了していません");
    await page.getByRole("button", { name: "ルール説明を開始（49秒）", exact: true }).click();
    const rules = page.getByRole("region", { name: "バトル前のルール説明" });
    await expect(rules).toBeVisible(); await expect(rules).toContainText("勝ち ×2 ／ あいこ ×1 ／ 負け ×0.5");
    await expect(page.getByRole("region", { name: "レイド参加案内" })).toBeVisible();
    const explaining = await snapshot(request);
    expect(explaining.round.phase).toBe("tutorial"); expect(explaining.round.closesAt! - explaining.serverNow).toBeGreaterThan(44_000);
    expect((await post(request, host.headers, { type: "command", roomId: initial.roomId, round: 1, requestId: randomUUID(), action: "attack", hand: "rock" })).status()).toBe(409);
    await phone.getByRole("button", { name: "このレイドに参加", exact: true }).click();
    await expect(phone.getByRole("status", { name: "レイド参加状況" })).toContainText("参加完了！");
    await expect(phone.getByRole("button", { name: "攻撃を選択", exact: true })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath("raid-rules-screen.png") });
    await phone.screenshot({ path: testInfo.outputPath("raid-rules-phone.png") });
    const rulesRect = await rules.boundingBox(), qrRect = await page.getByRole("region", { name: "レイド参加案内" }).boundingBox();
    expect(rulesRect!.x + rulesRect!.width).toBeLessThanOrEqual(qrRect!.x);
    await page.reload(); await phone.reload();
    expect((await snapshot(request)).round.closesAt).toBe(explaining.round.closesAt);
    await expect(rules).toBeVisible();
    await expect(page.getByRole("timer", { name: "全員共通の入力受付" })).toBeVisible({ timeout: 55_000 });
    await expect(rules).toHaveCount(0);
    const battling = await snapshot(request);
    expect(battling.round.phase).toBe("collecting");
    expect(battling.admissionClosesAt! - battling.serverNow).toBeGreaterThan(25_000);
    expect((await request.get(`/api/raid/entry?roomId=${initial.roomId}`, { headers: adminHeaders })).status()).toBe(200);
    await phone.getByRole("button", { name: "攻撃を選択", exact: true }).click();
    await phone.getByRole("button", { name: "チョキを選択", exact: true }).click();
    await expect.poll(async () => (await snapshot(request)).round.phase, { timeout: 15_000 }).toBe("playing");
    await phoneContext.addCookies([{ name: "fourpro_guest", value: duringAnimation.token, url: origin }]);
    await phone.goto(entryUrl);
    await expect(phone.getByRole("combobox", { name: "参加キャラクター" })).toBeEnabled();
    await phone.getByRole("combobox", { name: "参加キャラクター" }).selectOption("aqua-spirit");
    await phone.getByRole("button", { name: "このレイドに参加", exact: true }).click();
    await expect(phone.getByRole("status", { name: "レイド参加状況" })).toContainText("次の入力受付から操作できます");
    expect((await snapshot(request, duringAnimation.headers, true)).me).toMatchObject({ characterId: "aqua-spirit", hp: 135, eligibleRound: 2, lastResult: null });
    await phone.screenshot({ path: testInfo.outputPath("raid-late-join-phone.png") });
    await expect.poll(async () => (await snapshot(request)).round.number, { timeout: 15_000 }).toBe(2);
    await expect(phone.getByRole("button", { name: "攻撃を選択", exact: true })).toBeEnabled();
    // The real server deadline closes QR display and API entry, without a screen reload.
    await expect(page.getByRole("region", { name: "レイド参加案内" })).toHaveCount(0, { timeout: 20_000 });
    expect((await post(request, tooLate.headers, { type: "join", roomId: initial.roomId, characterId: "forest-golem" })).status()).toBe(409);
    expect((await request.get(`/api/raid/entry?roomId=${initial.roomId}`, { headers: adminHeaders })).status()).toBe(409);
    await phoneContext.addCookies([{ name: "fourpro_guest", value: tooLate.token, url: origin }]); await phone.goto(entryUrl);
    await expect(phone.getByRole("heading", { name: "このレイドの参加受付は終了しました" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("raid-late-admission-closed.png") });
  } finally { await phoneContext.close(); }
});

test("phone admission status stays below the controls and never covers the character", async ({ page }, testInfo) => {
  await observeMusic(page, false);
  const guest = await player(), late = await player();
  let now = Date.now(), viewer = guest.id;
  const room = new LocalRaidRoom(() => "paper", () => now);
  room.join(guest.id, "forest-golem", 170, guest.nickname!, "フォレストゴーレム");
  const roomId = room.snapshot().roomId;
  await page.context().addCookies([{ name: "fourpro_guest", value: guest.token, url: origin }]);
  await page.route("**/api/raid*", route => route.fulfill({ json: { state: room.snapshot(viewer) } }));
  await page.goto(`/battle/raid?room=${roomId}`);
  const status = page.getByRole("status", { name: "レイド参加状況", exact: true });
  const character = page.getByRole("img", { name: "フォレストゴーレム：正面を向いた自分のキャラクター", exact: true });
  const check = async (phase: string, message: string) => {
    await expect(status).toContainText("参加完了！"); await expect(status).toContainText(message);
    for (const [width, height] of [[375, 667], [390, 844], [430, 932], [844, 390]]) {
      await page.setViewportSize({ width, height }); await status.scrollIntoViewIfNeeded();
      const badge = (await status.boundingBox())!, model = (await character.boundingBox())!;
      expect(badge.x + badge.width <= model.x || model.x + model.width <= badge.x || badge.y + badge.height <= model.y || model.y + model.height <= badge.y).toBe(true);
      expect(badge.x).toBeGreaterThanOrEqual(0); expect(badge.x + badge.width).toBeLessThanOrEqual(width);
      expect(badge.y + badge.height).toBeLessThanOrEqual(height);
      expect(await page.getByRole("region", { name: "自分のキャラクター", exact: true }).getByRole("status", { name: "レイド参加状況", exact: true }).count()).toBe(0);
      await page.screenshot({ path: testInfo.outputPath(`admission-${phase}-${width}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
  };
  await check("lobby", "ルール説明の開始を待っています");
  const cancel = page.getByRole("button", { name: "参加取消", exact: true });
  await expect(cancel).toBeEnabled(); await cancel.click({ trial: true });
  room.start(roomId); await check("tutorial", "ルール説明中");
  now += raidTutorialMs; await check("collecting", "① 攻撃か回復を選ぼう");
  await expect(page.getByRole("button", { name: "攻撃を選択", exact: true })).toBeEnabled();
  now += 10000; room.snapshot(); room.join(late.id, "forest-golem", 170, late.nickname!, "フォレストゴーレム"); viewer = late.id;
  await page.context().addCookies([{ name: "fourpro_guest", value: late.token, url: origin }]);
  await page.reload(); await check("late", "次の入力受付から操作できます");
});

test("Japanese narration follows the explanation, lowers BGM and resumes from the current step", async ({ page }, testInfo) => {
  await observeMusic(page, false);
  await page.addInitScript(() => {
    const record = window as unknown as { narrationOffsets: number[] };
    record.narrationOffsets = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...args: Parameters<AudioBufferSourceNode["start"]>) {
      if (!this.loop && this.buffer && this.buffer.duration > 48 && this.buffer.duration < 49) record.narrationOffsets.push(args[1] ?? 0);
      return Reflect.apply(start, this, args);
    };
  });
  await page.context().addCookies([{ name: "fourpro_admin", value: adminToken, url: origin }]);
  let now = Date.now(); const room = new LocalRaidRoom(() => "paper", () => now);
  room.join("example", "forest-golem", 170, "音声説明");
  await db.raidRoom.create({ data: { eventId, state: JSON.parse(JSON.stringify(room.save())) } });
  await page.route("**/api/raid", async route => {
    if (route.request().method() === "POST" && route.request().postDataJSON().type === "start") room.start(room.snapshot().roomId);
    await route.fulfill({ json: { state: room.snapshot() } });
  });
  await page.setViewportSize({ width: 1366, height: 768 }); await page.goto("/raid/screen");
  const on = page.getByRole("button", { name: "説明音声をオンにする", exact: true });
  await expect(on).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "BGMをオンにする", exact: true }).click();
  await on.click(); await expect(page.getByRole("button", { name: "説明音声をオフにする", exact: true })).toHaveText("説明音声 オン");
  const offsets = () => page.evaluate(() => (window as unknown as { narrationOffsets: number[] }).narrationOffsets);
  expect(await offsets()).toHaveLength(0);
  await page.getByRole("button", { name: "ルール説明を開始（49秒）", exact: true }).click();
  await expect.poll(async () => (await offsets()).length).toBe(1);
  expect(await page.evaluate(() => window.__raidMusicProbe.sources.find(source => !source.loop && source.buffer!.duration > 48)?.buffer?.duration)).toBeCloseTo(48.92733333333333, 2);
  await expect.poll(() => page.evaluate(() => window.__raidMusicProbe.gains[0].gain.value)).toBeCloseTo(.12, 2);
  await page.screenshot({ path: testInfo.outputPath("japanese-narration-on.png") });
  await page.getByRole("button", { name: "説明音声をオフにする", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__raidMusicProbe.gains[0].gain.value)).toBeCloseTo(.4, 2);
  now += 26000;
  await expect(page.getByRole("region", { name: "バトル前のルール説明" })).toHaveAttribute("data-tutorial-step", "3");
  await on.click(); await expect.poll(async () => (await offsets()).length).toBe(2);
  expect((await offsets())[1]).toBeGreaterThanOrEqual(26); expect((await offsets())[1]).toBeLessThan(28);
  now += 23000;
  await expect(page.getByRole("region", { name: "バトル前のルール説明" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__raidMusicProbe.gains[0].gain.value)).toBeCloseTo(.4, 2);
  await page.reload(); await expect(on).toHaveAttribute("aria-pressed", "false");
});

test("phone screenshots highlight all four tutorial steps and leave the reception QR accessible", async ({ page, request }, testInfo) => {
  await observeMusic(page, false);
  await page.context().addCookies([{ name: "fourpro_admin", value: adminToken, url: origin }]);
  let now = Date.now();
  const room = new LocalRaidRoom(() => "paper", () => now);
  room.join("example", "forest-golem", 170, "操作説明", "フォレストゴーレム");
  room.start(room.snapshot().roomId);
  await db.raidRoom.create({ data: { eventId, state: JSON.parse(JSON.stringify(room.save())) } });
  await page.route("**/api/raid", route => route.fulfill({ json: { state: room.snapshot() } }));
  const downloads: string[] = [];
  page.on("response", response => { if (response.url().includes("/raid-tutorial/") && response.status() === 200) downloads.push(response.url()); });
  await page.setViewportSize({ width: 1366, height: 768 }); await page.goto("/raid/screen");
  const tutorial = page.getByRole("region", { name: "バトル前のルール説明" });
  await expect(tutorial).toHaveAttribute("data-tutorial-step", "1");
  await expect(page.getByRole("region", { name: "レイド参加案内" })).toBeVisible();
  const steps = ["join", "action", "hand", "sent"], starts = [0, 16000, 26000, 38000];
  for (let index = 0; index < steps.length; index++) {
    if (index) {
      now += starts[index] - starts[index - 1] - 1000;
      await expect(tutorial).toHaveAttribute("data-tutorial-step", String(index));
      now += 1000;
    }
    await expect(tutorial).toHaveAttribute("data-tutorial-step", String(index + 1));
    await expect(tutorial.locator('li[aria-current="step"]')).toHaveCount(1);
    const image = tutorial.locator('img[data-active="true"]');
    await expect(image).toHaveAttribute("src", `/raid-tutorial/${steps[index]}.jpg`);
    await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`phone-guide-${index + 1}.png`) });
  }
  expect(new Set(downloads).size).toBe(4);
  for (const [width, height] of [[1920, 1080], [1366, 768], [1024, 768]]) {
    await page.setViewportSize({ width, height });
    const panel = (await tutorial.boundingBox())!, qr = (await page.getByRole("region", { name: "レイド参加案内" }).boundingBox())!;
    expect(panel.x + panel.width).toBeLessThanOrEqual(qr.x);
    expect(await tutorial.evaluate(node => node.scrollHeight <= node.clientHeight)).toBe(true);
    const image = (await tutorial.locator('img[data-active="true"]').boundingBox())!;
    const list = (await tutorial.locator("ol").boundingBox())!, footer = (await tutorial.locator("footer").boundingBox())!;
    expect(image.y + image.height).toBeLessThanOrEqual(footer.y + 1);
    expect(list.y + list.height).toBeLessThanOrEqual(footer.y + 1);
    await page.screenshot({ path: testInfo.outputPath(`phone-guide-${width}.png`) });
  }
  await page.reload();
  await expect(tutorial).toHaveAttribute("data-tutorial-step", "4");
  now += 10000;
  await expect(tutorial).toHaveAttribute("data-tutorial-step", "4");
  await expect(page.getByRole("timer", { name: "全員共通の入力受付" })).toHaveCount(0);
  now += 1000;
  await expect(tutorial).toHaveCount(0);
  await expect(page.getByRole("timer", { name: "全員共通の入力受付" })).toBeVisible();
});

test("a simultaneous explanation start and arrival accepts all visitors within the cap", async ({ request }) => {
  const host = await player(); expect((await post(request, host.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(200);
  const initial = await snapshot(request), arrivals = await Promise.all(Array.from({ length: 10 }, player));
  const [started, ...joined] = await Promise.all([
    post(request, adminHeaders, { type: "start", roomId: initial.roomId }),
    ...arrivals.map(guest => post(request, guest.headers, { type: "join", roomId: initial.roomId, characterId: "forest-golem" })),
  ]);
  expect(started.status()).toBe(200); expect(joined.every(response => response.status() === 200)).toBe(true);
  const accepted = joined.filter(response => response.status() === 200).length;
  const state = await snapshot(request);
  expect(state.participants).toBe(1 + accepted); expect(state.difficultyPlayers).toBe(state.participants);
  expect(state.bossMaxHp).toBe(state.participants * 450);
  expect(state.round.phase).toBe("tutorial");
  expect((await post(request, (await player()).headers, { type: "join", roomId: initial.roomId, characterId: "forest-golem" })).status()).toBe(200);
});

test("screen controls and participant labels remain readable at laptop sizes and browser zoom", async ({ page, request }, testInfo) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      if (kind.includes("webgl")) return null;
      return original.apply(this, [kind, ...args] as never);
    } as typeof original;
  });
  await page.context().addCookies([{ name: "fourpro_admin", value: adminToken, url: origin }]);
  await page.goto("/raid/screen");
  const start = page.getByRole("button", { name: "ルール説明を開始（49秒）", exact: true });
  await expect(start).toBeDisabled();
  for (let i = 0; i < 7; i++) {
    const guest = await player();
    expect((await post(request, guest.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(200);
  }
  await expect(start).toBeEnabled();
  const participants = page.getByRole("list", { name: "参加者とキャラクター" });
  await expect(participants.getByRole("listitem")).toHaveCount(7);
  for (const [width, height] of [[1292, 724], [1366, 768], [1920, 1080], [1024, 768], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const audit = await page.evaluate(() => {
      const controls = document.querySelector('footer[aria-label="レイドの進行操作"]')!;
      const labels = document.querySelectorAll('[data-participant-id] > span, [data-participant-id] b, [data-participant-id] small, [data-participant-id] strong, footer[aria-label="レイドの進行操作"] button, footer[aria-label="レイドの進行操作"] a, a[aria-label^="参加URL"]');
      const hidden = [...labels].filter(node => parseFloat(getComputedStyle(node).fontSize) < 12).map(node => node.textContent);
      const blocked = [...controls.querySelectorAll('button,a')].filter(node => {
        if (!node.getClientRects().length || node.closest("details:not([open])")) return false;
        const rect = node.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return rect.height < 44 || rect.left < 0 || rect.right > innerWidth || rect.top < 0 || rect.bottom > innerHeight || !hit || !node.contains(hit);
      }).map(node => node.textContent || node.getAttribute('aria-label'));
      return { hidden, blocked, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(audit, `${width}x${height}`).toEqual({ hidden: [], blocked: [], overflow: false });
    expect((await collectSmallText(page)).filter(item => item.size <= 10)).toEqual([]);
    if (width === 1292 || width === 844) await page.screenshot({ path: testInfo.outputPath(`readable-lobby-${width}.png`) });
  }
  await start.click();
  await endExplanation(request);
  await expect(page.getByRole("button", { name: "入力受付中", exact: true })).toBeDisabled();
  await expect(page.getByRole("timer", { name: "全員共通の入力受付" })).toContainText("秒");
  expect((await snapshot(request)).round.phase).toBe("collecting");
});

test("a completed raid exposes the next battle action and retains results when returning to reception", async ({ page, request }, testInfo) => {
  test.setTimeout(90_000);
  let now = Date.now();
  const room = new LocalRaidRoom(() => "paper", () => now);
  const guests = [];
  for (let i = 0; i < 7; i++) {
    const guest = await player(); guests.push(guest);
    room.join(guest.id, "temp-09", 170, guest.nickname!, "デンラコ");
  }
  const roomId = room.snapshot().roomId;
  room.start(roomId); now += raidTutorialMs; room.snapshot();
  for (let turn = 1; turn <= 5; turn++) {
    for (const guest of guests) room.command(guest.id, { roomId, round: turn, requestId: randomUUID(), action: "attack", hand: "scissors" });
    now += 10_000; room.snapshot(); room.finish(roomId, turn);
  }
  expect(room.snapshot().round.phase).toBe("finished");
  await db.raidRoom.create({ data: { eventId, state: JSON.parse(JSON.stringify(room.save())) } });
  await page.context().addCookies([{ name: "fourpro_admin", value: adminToken, url: origin }]);
  await page.setViewportSize({ width: 1292, height: 724 });
  await page.goto("/raid/screen");
  const next = page.getByRole("button", { name: "次のバトルを準備", exact: true });
  await expect(next).toBeEnabled();
  await expect(page.getByRole("main")).toHaveAttribute("data-cue", "victory");
  await expect(page.getByRole("region", { name: "ボスとエフェクト" })).toHaveAttribute("data-renderer", "webgl");
  await expect(page.locator('canvas[data-boss-model="ready"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("readable-victory-next-battle.png") });
  await expect.poll(() => db.raidResult.count({ where: { roomId } })).toBe(7);
  const [resetResponse] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/raid") && response.request().method() === "POST"),
    next.click(),
  ]);
  expect(resetResponse.status(), await resetResponse.text()).toBe(200);
  await expect(page.getByRole("button", { name: "ルール説明を開始（49秒）", exact: true })).toBeDisabled({ timeout: 10_000 });
  const reception = await snapshot(request);
  expect(reception.roomId).not.toBe(roomId); expect(reception.participants).toBe(0);
  expect(await db.raidResult.count({ where: { roomId } })).toBe(7);
  expect(await db.raidReward.count({ where: { playerId: { in: guests.map(guest => guest.id) } } })).toBe(7);
  for (let i = 7; i < 20; i++) guests.push(await player());
  for (const guest of guests) expect((await post(request, guest.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(200);
  const participants = page.getByRole("list", { name: "参加者とキャラクター" });
  await expect(participants.getByRole("listitem")).toHaveCount(20);
  await participants.getByRole("listitem").last().scrollIntoViewIfNeeded();
  await expect(participants.getByRole("listitem").last()).toBeInViewport();
  await expect(page.getByRole("button", { name: "ルール説明を開始（49秒）", exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("readable-twenty-participants.png") });
});

test("staff login returns to the live screen and the cleaned header retains its screen link", async ({ page }) => {
  await page.goto("/raid/screen");
  await expect(page).toHaveURL(/\/admin\/login\?next=raid-screen$/);
  await page.getByRole("textbox", { name: "ユーザー名" }).fill(adminUsername);
  await page.getByLabel("パスワード", { exact: true }).fill(adminPassword);
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/raid/screen`);
  await expect(page.locator("canvas[data-boss-model='ready']")).toHaveAttribute("data-boss-model-url", "/models/bosses/des-dragoon-red.glb");
  await expect(page.getByRole("heading", { name: "デスドラグーン", exact: true })).toBeVisible();
  expect((await page.request.get("/api/raid")).status()).toBe(200);
  await page.goto("/admin");
  await expect(page.getByText("ADMINISTRATION", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "会場スクリーン", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/raid/screen`);
});

test("NFC acquisition, profile data and model delivery survive UI integration", async ({ page, request }, testInfo) => {
  const guest = await player(), token = randomBytes(32).toString("base64url");
  const tag = await db.acquisitionTag.create({ data: { eventId, departmentId: "mechanical", tokenHash: hash(token) } });
  try {
    const first = await request.post("/api/acquisitions", { headers: guest.headers, data: { token } });
    expect(first.status()).toBe(200); expect((await first.json()).acquired).toBe(true);
    const owned = await db.playerCharacter.findUniqueOrThrow({ where: { playerId_characterId: { playerId: guest.id, characterId: "forest-golem" } } });
    const repeated = await request.post("/api/acquisitions", { headers: guest.headers, data: { token } });
    expect(repeated.status()).toBe(200); expect((await repeated.json()).acquired).toBe(false);
    expect(await db.playerCharacter.findUniqueOrThrow({ where: { id: owned.id } })).toEqual(owned);
    expect((await request.patch("/api/me", { headers: guest.headers, data: { nickname: "統合確認" } })).status()).toBe(200);
    expect((await db.player.findUniqueOrThrow({ where: { id: guest.id } })).nickname).toBe("統合確認");
    const models = await request.get("/api/character-models");
    expect(models.status()).toBe(200); expect(Object.keys((await models.json()).models)).toHaveLength(10);
    for (const color of ["red", "blue", "green", "yellow"]) {
      const asset = await request.get(`/models/bosses/des-dragoon-${color}.glb`);
      expect(asset.status()).toBe(200);
      expect((await asset.body()).readUInt32LE(0)).toBe(0x46546c67);
    }
    await page.context().addCookies([{ name: "fourpro_guest", value: guest.token, url: origin }]);
    await page.goto("/collection");
    await expect(page.getByRole("link", { name: "フォレストゴーレムの詳細を見る（獲得済み）", exact: true })).toBeVisible();
    for (const viewport of [{width:375,height:667},{width:390,height:844},{width:430,height:932}]) {
      await page.setViewportSize(viewport); await page.goto("/collection/forest-golem");
      await expect(page.getByRole("tab", {name:"ステータス",exact:true})).toBeVisible();
      expect((await collectSmallText(page)).filter(item=>item.size<=10)).toEqual([]);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
    }
    await page.getByRole("link", { name: /^次のキャラクター：/ }).click();
    await expect(page).toHaveURL(`${origin}/collection/thunder-fox`);
    await page.getByRole("link", { name: /^前のキャラクター：/ }).click();
    await expect(page.getByRole("region", { name: "フォレストゴーレム", exact: true }).getByText("獲得済み", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/battle");
    await expect(page.getByRole("heading", { name: "同期レイド", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "QRでレイドに参加", exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "デスドラグーン", exact: true })).toHaveAttribute("src", "/models/bosses/des-dragoon-red.webp");
    await expect(page.getByText("CPU対戦", { exact: true })).toHaveCount(0);
    expect((await collectSmallText(page)).filter(item=>item.size<=10)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("raid-entry-mobile.png") });
  } finally {
    await db.acquisitionLog.deleteMany({ where: { tagId: tag.id } });
    await db.acquisitionTag.delete({ where: { id: tag.id } });
  }
});

test("production raid protects staff controls, event boundaries and character ownership", async ({ request, page }) => {
  expect((await request.get("/api/local-raid")).status()).toBe(404);
  expect((await request.get("/raid/screen?sync=local")).status()).toBe(404);
  await page.goto("/raid/screen"); await expect(page).toHaveURL(/\/admin\/login\?next=raid-screen$/);
  expect((await request.get("/api/raid")).status()).toBe(401);
  expect((await request.get("/api/raid?personal=1")).status()).toBe(401);
  const guest = await player(), state = await snapshot(request);
  for (const data of [{ type: "start", roomId: state.roomId }, { type: "reset", roomId: state.roomId }, { type: "reveal", roomId: state.roomId, turn: 1 }, { type: "impact", roomId: state.roomId, turn: 1, kind: "action" }, { type: "finish", roomId: state.roomId, turn: 1 }]) expect((await post(request, guest.headers, data)).status()).toBe(401);
  expect((await post(request, { ...guest.headers, origin: "https://evil.example" }, { type: "join", characterId: "forest-golem" })).status()).toBe(403);
  expect((await post(request, guest.headers, { type: "join", characterId: "four-pro" })).status()).toBe(403);
  const previousDraft=await db.character.findUniqueOrThrow({where:{id:"temp-12"},select:{isDraft:true}});
  await db.character.update({where:{id:"temp-12"},data:{isDraft:true}});
  try { expect((await post(request, guest.headers, { type: "join", characterId: "temp-12" })).status()).toBe(403); }
  finally { await db.character.update({where:{id:"temp-12"},data:{isDraft:previousDraft.isDraft}}); }
  expect((await post(request, guest.headers, { type: "join", characterId: "forest-golem", maxHp: 99999 })).status()).toBe(400);
  await db.playerCharacter.create({ data: { playerId: guest.id, characterId: "forest-golem", hpGrowth: 8 } });
  expect((await post(request, guest.headers, { type: "join", characterId: "aqua-spirit" })).status()).toBe(403);
  expect((await post(request, guest.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(200);
  expect((await snapshot(request, guest.headers, true)).me?.maxHp).toBe(178);
  const foreign = await db.event.create({ data: { id: `raid-foreign-${randomUUID()}`, name: "別イベント" } });
  try {
    await db.player.update({ where: { id: guest.id }, data: { eventId: foreign.id } });
    expect((await post(request, guest.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(401);
  } finally { await db.player.update({ where: { id: guest.id }, data: { eventId } }); await db.event.delete({ where: { id: foreign.id } }); }
  await db.event.update({ where: { id: eventId }, data: { status: "ENDED", endedAt: new Date(), purgeAt: new Date(Date.now() + 3600_000) } });
  expect((await post(request, adminHeaders, { type: "start", roomId: state.roomId })).status()).toBe(409);
  expect((await request.get("/api/raid?personal=1", { headers: guest.headers })).status()).toBe(409);
});

test("Kanreki reuses slot 12 as a non-legendary trial character without granting ownership",async({request})=>{
  const guest=await player();
  expect((await post(request,guest.headers,{type:"join",characterId:"temp-12"})).status()).toBe(200);
  const state=await snapshot(request,guest.headers,true);
  expect(state.me).toMatchObject({characterId:"temp-12",maxHp:160});
  expect(await db.playerCharacter.count({where:{playerId:guest.id}})).toBe(0);
});

test("twenty concurrent phones keep all inputs, deduplicate retries and share one persisted outcome", async ({ request }) => {
  const guests = await Promise.all(Array.from({ length: 20 }, () => player()));
  const joins = await Promise.all(guests.map((guest) => post(request, guest.headers, { type: "join", characterId: "forest-golem" })));
  expect(joins.map((response) => response.status())).toEqual(Array(20).fill(200));
  const state = await snapshot(request); expect(state.participants).toBe(20);
  const overflow = await player(); expect((await post(request, overflow.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(409);
  expect((await post(request, adminHeaders, { type: "start", roomId: state.roomId })).status()).toBe(200);
  await endExplanation(request);
  const commands = guests.map(() => ({ type: "command", roomId: state.roomId, round: 1, requestId: randomUUID(), action: "attack", hand: "scissors" }));
  const sent = await Promise.all(guests.map((guest, i) => post(request, guest.headers, commands[i])));
  expect(sent.map((response) => response.status())).toEqual(Array(20).fill(200));
  expect((await post(request, guests[0].headers, commands[0])).status()).toBe(200);
  expect((await post(request, guests[0].headers, { ...commands[0], hand: "rock" })).status()).toBe(409);
  expect((await post(request, guests[0].headers, { ...commands[0], requestId: randomUUID() })).status()).toBe(409);
  const accepted = await snapshot(request); expect(accepted.round.submitted).toBe(20); expect(accepted.results).toEqual([]);
  const secondConnection = new PrismaClient();
  try {
    const saved = (await secondConnection.raidRoom.findUniqueOrThrow({ where: { eventId } })).state as unknown as { members: unknown[]; receipts: unknown[] };
    expect(saved.members).toHaveLength(20); expect(saved.receipts).toHaveLength(20);
  } finally { await secondConnection.$disconnect(); }
  await expect.poll(async () => (await snapshot(request)).round.phase, { timeout: 15_000 }).toBe("playing");
  const resolved = await snapshot(request); expect(resolved.results).toHaveLength(20); expect(new Set(resolved.results.map((entry) => entry.boss)).size).toBe(1);
  expect(resolved).toMatchObject({ bossMaxHp: 9000, bossAttack: 17, difficultyPlayers: 20 });
  expect(resolved.bossHp).toBeGreaterThan(0); expect(resolved.totalDamage).toBeLessThanOrEqual(2000);
  const finishes = await Promise.all(Array.from({ length: 4 }, () => post(request, adminHeaders, { type: "finish", roomId: state.roomId, turn: 1 })));
  expect(finishes.map((response) => response.status())).toEqual(Array(4).fill(200));
  let ongoing = await snapshot(request);
  expect(ongoing.round.phase).toBe("collecting");
  while (ongoing.round.phase === "collecting" && ongoing.round.number <= 9) {
    const round = ongoing.round.number;
    const inputs = await Promise.all(guests.map((guest, i) => post(request, guest.headers, { type: "command", roomId: state.roomId, round, requestId: randomUUID(), action: "attack", hand: ["rock", "paper", "scissors"][i % 3] })));
    expect(inputs.every(response => response.status() === 200)).toBe(true);
    const row = await db.raidRoom.findUniqueOrThrow({ where: { eventId } });
    await db.raidRoom.update({ where: { eventId }, data: { state: { ...row.state as object, closesAt: Date.now() - 1 } } });
    await snapshot(request);
    expect((await post(request, adminHeaders, { type: "finish", roomId: state.roomId, turn: round })).status()).toBe(200);
    ongoing = await snapshot(request);
  }
  expect(ongoing.round.phase).toBe("finished"); expect(ongoing.totalDamage).toBe(9000);
  expect(await db.raidReward.count({where:{playerId:{in:guests.map(guest=>guest.id)}}})).toBe(20);
  expect((await db.raidReward.aggregate({where:{playerId:{in:guests.map(guest=>guest.id)}},_sum:{points:true}}))._sum.points).toBe(2000);
  expect((await post(request, adminHeaders, { type: "reset", roomId: state.roomId })).status()).toBe(200);
  expect((await post(request, adminHeaders, { type: "reset", roomId: state.roomId })).status()).toBe(409);
  expect((await post(request, guests[0].headers, commands[0])).status()).toBe(409);
});

test("ten-player strength stays synchronized on screen and phone as new players join", async ({ page, browser, request }, testInfo) => {
  const guests = [];
  for (let i = 0; i < 2; i++) {
    const guest = await player(); guests.push(guest);
    expect((await post(request, guest.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(200);
  }
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      if (kind.includes("webgl")) return null;
      return original.apply(this, [kind, ...args] as never);
    } as typeof original;
  });
  await page.context().addCookies([{ name: "fourpro_admin", value: adminToken, url: origin }]);
  await page.setViewportSize({ width: 1292, height: 724 }); await page.goto("/raid/screen");
  await expect(page.getByRole("progressbar", { name: "ボスHP", exact: true })).toHaveAttribute("aria-valuemax", "900");
  const phoneContext = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    await phoneContext.addCookies([{ name: "fourpro_guest", value: guests[0].token, url: origin }]);
    await phoneContext.addInitScript(() => { HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext; });
    const phone = await phoneContext.newPage(); await phone.goto("/battle/raid");
    await expect(phone.getByRole("progressbar", { name: "ボスHP（同期）" })).toHaveAttribute("aria-valuemax", "900");
    for (let i = 2; i < 10; i++) {
      const guest = await player(); guests.push(guest);
      expect((await post(request, guest.headers, { type: "join", characterId: "forest-golem" })).status()).toBe(200);
    }
    await expect(page.getByRole("progressbar", { name: "ボスHP", exact: true })).toHaveAttribute("aria-valuemax", "4500");
    await expect(page.getByLabel("ボスの強さ", { exact: true })).toContainText("全体攻撃 14");
    await expect(phone.getByRole("progressbar", { name: "ボスHP（同期）" })).toHaveAttribute("aria-valuemax", "4500");
    await expect(phone.getByLabel("ボスの全体攻撃", { exact: true })).toHaveText("全体攻撃 14");
    const stored = await db.raidRoom.findUniqueOrThrow({ where: { eventId } });
    expect(stored.state).toMatchObject({ balance: { participants: 10, maxHp: 4500, attack: 14 } });
    await page.reload();
    await expect(page.getByRole("progressbar", { name: "ボスHP", exact: true })).toHaveAttribute("aria-valuenow", "4500");
    await page.screenshot({ path: testInfo.outputPath("ten-player-scaled-screen.png") });
    for (const [width, height] of [[375, 667], [390, 844], [430, 932], [844, 390]]) {
      await phone.setViewportSize({ width, height });
      const layout = await phone.evaluate(() => {
        const heading = document.querySelector('section[aria-label="ボスの状況"] h2')!;
        const badge = document.querySelector('[aria-label="ボスの全体攻撃"]')!;
        const title = heading.getBoundingClientRect(), box = badge.getBoundingClientRect();
        const panel = badge.closest('section')!.getBoundingClientRect();
        return { lines: title.height / parseFloat(getComputedStyle(heading).lineHeight), font: parseFloat(getComputedStyle(badge).fontSize), clipped: box.bottom > panel.bottom || box.top < panel.top || box.left < panel.left || box.right > panel.right, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      expect(layout.lines, `${width} title`).toBeLessThan(1.1);
      expect(layout.font).toBeGreaterThanOrEqual(12);
      expect(layout.clipped, `${width} badge`).toBe(false); expect(layout.overflow).toBe(false);
      expect((await collectSmallText(phone)).filter(item => item.size <= 10)).toEqual([]);
      await phone.screenshot({ path: testInfo.outputPath(`ten-player-scaled-phone-${width}.png`) });
    }
  } finally { await phoneContext.close(); }
});

test("a real screen and two phones complete a round and reconnect after reload", async ({ page, browser, request }, testInfo) => {
  const withoutWebGl = () => { const original = HTMLCanvasElement.prototype.getContext; Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: function(this: HTMLCanvasElement, type: string, ...args: unknown[]) { return type.startsWith("webgl") || type === "experimental-webgl" ? null : Reflect.apply(original, this, [type, ...args]); } }); };
  await page.context().addCookies([{ name: "fourpro_admin", value: adminToken, url: origin }]);
  await page.context().addInitScript(withoutWebGl); await page.setViewportSize({ width: 1366, height: 768 });
  const phoneContexts = await Promise.all(Array.from({ length: 2 }, () => browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })));
  try {
    const phones = await Promise.all(phoneContexts.map(async (context) => { await context.addInitScript(withoutWebGl); return context.newPage(); }));
    const roomId = (await snapshot(request)).roomId;
    const entryResponse = await request.get('/api/raid/entry?roomId=' + roomId, { headers: adminHeaders });
    expect(entryResponse.status()).toBe(200); const entryUrl = (await entryResponse.json()).target.url;
    await phones[0].goto(entryUrl); await expect(phones[0]).toHaveURL(origin + '/start?next=raid&room=' + roomId);
    await phones[0].getByRole("textbox", { name: "ニックネーム" }).fill("本番参加確認");
    await phones[0].getByRole("button", { name: "この名前ではじめる" }).click(); await expect(phones[0]).toHaveURL(entryUrl); await phones[0].getByRole("button", { name: "このレイドに参加", exact: true }).click();
    const registered = await phoneContexts[0].request.get("/api/me"); playerIds.push((await registered.json()).player.id);
    const second = await player(); await phoneContexts[1].addCookies([{ name: "fourpro_guest", value: second.token, url: origin }]); await phones[1].goto(entryUrl); await phones[1].getByRole("button", { name: "このレイドに参加", exact: true }).click();
    await page.goto("/raid/screen");
    await expect(page.locator(".enemy-fallback-art image")).toHaveAttribute("href", "/models/bosses/des-dragoon-red.webp");
    await expect(page.getByRole("heading", { name: "デスドラグーン", exact: true })).toBeVisible();
    await expect.poll(async () => (await snapshot(request)).participants).toBe(2);
    await expect(page.getByRole("link", { name: `参加URL ${entryUrl}`, exact: true })).toHaveAttribute("href", entryUrl);
    await page.getByRole("button", { name: "ルール説明を開始（49秒）", exact: true }).click();
  await endExplanation(request);
    for (const phone of phones) { await phone.getByRole("button", { name: "攻撃を選択", exact: true }).click(); await phone.getByRole("button", { name: "チョキを選択", exact: true }).click(); }
    await phones[0].reload(); await expect(phones[0].getByRole("group", { name: "送信した行動とじゃんけんの手" })).toContainText("攻撃 / チョキ");
    await page.reload();
    await expect.poll(async () => (await snapshot(request)).round.number, { timeout: 30_000 }).toBe(2);
    for (const phone of phones) { await expect(phone.getByRole("progressbar", { name: "自分のHP（同期）" })).toHaveAttribute("aria-valuenow", "158"); await expect(phone.getByRole("button", { name: "攻撃を選択", exact: true })).toBeEnabled(); }
    await page.screenshot({ path: testInfo.outputPath("production-raid-screen.png") });
    await phones[0].screenshot({ path: testInfo.outputPath("production-raid-phone.png") });
    const stored = await db.raidRoom.findUniqueOrThrow({ where: { eventId } }); expect(JSON.stringify(stored.state)).toContain('"completedTurn":1');
    await page.getByRole("button", { name: "同期設定", exact: true }).click(); await page.getByRole("button", { name: "同期をリセット", exact: true }).click();
    await expect(phones[0].getByRole("heading", { name: "次の受付QRを読み取ってください", exact: true })).toBeVisible();
    expect((await snapshot(request)).participants).toBe(0);
  } finally { for (const context of phoneContexts) await context.close(); }
});

test("authored motions follow two synchronized participants with the same character and different actions", async ({ page, browser, request }) => {
  test.setTimeout(120_000);
  const guests = await Promise.all([player(), player()]);
  for (const guest of guests) expect((await post(request, guest.headers, { type: "join", characterId: "temp-09" })).status()).toBe(200);
  await page.context().addCookies([{ name: "fourpro_admin", value: adminToken, url: origin }]);
  const contexts = await Promise.all(guests.map(()=>browser.newContext({baseURL:origin,viewport:{width:390,height:844},isMobile:true,hasTouch:true})));
  try {
    const phones = await Promise.all(contexts.map(async(context,index)=>{
      await context.addCookies([{name:"fourpro_guest",value:guests[index].token,url:origin}]);
      const phone=await context.newPage(); await phone.goto("/battle/raid");
      await expect(phone.locator('[data-character-id="temp-09"] canvas')).toHaveAttribute("data-raid-motions-ready","true",{timeout:30_000});
      return phone;
    }));
    await page.goto("/raid/screen");
    const screen=page.getByRole("region",{name:"ボスとエフェクト"}).locator("canvas");
    await expect(screen).toHaveAttribute("data-character-models","temp-09,temp-09",{timeout:30_000});
    const state=await snapshot(request);
    expect((await post(request,adminHeaders,{type:"start",roomId:state.roomId})).status()).toBe(200);
    await endExplanation(request);
    const commands=await Promise.all(guests.map((guest,index)=>post(request,guest.headers,{type:"command",roomId:state.roomId,round:1,requestId:randomUUID(),action:index===0?"attack":"heal",hand:"rock"})));
    expect(commands.map(response=>response.status())).toEqual([200,200]);
    await Promise.all([
      expect(screen).toHaveAttribute("data-character-motions",/0:temp-09:attack,1:temp-09:heal/,{timeout:30_000}),
      expect(phones[0].locator('[data-character-id="temp-09"] canvas')).toHaveAttribute("data-raid-motion","attack",{timeout:30_000}),
      expect(phones[1].locator('[data-character-id="temp-09"] canvas')).toHaveAttribute("data-raid-motion","heal",{timeout:30_000}),
    ]);
    await expect.poll(async()=>(await snapshot(request)).round.number,{timeout:30_000}).toBe(2);
    const resolved=await snapshot(request);
    expect(resolved.results.map(result=>result.action).sort()).toEqual(["attack","heal"]);
    await phones[0].reload();
    await expect(phones[0].locator('[data-character-id="temp-09"] canvas')).toHaveAttribute("data-raid-motion","idle",{timeout:30_000});
  } finally { for(const context of contexts) await context.close(); }
});
