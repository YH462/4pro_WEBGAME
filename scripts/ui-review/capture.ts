import 'dotenv/config';
import { chromium, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

import { LocalRaidRoom } from '../../src/lib/local-raid-room';
import { collectSmallText } from './small-text';

// Capture only on the local development instance. Never use a hosted database.
const origin = process.env.APP_URL || 'http://localhost:3000';
const appUrl = new URL(origin);
const databaseUrl = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname) || !['localhost', '127.0.0.1'].includes(appUrl.hostname) || appUrl.protocol !== 'http:' || process.env.ENABLE_DEV_SIMULATOR !== 'true') {
  throw new Error('UI capture requires a local database and local HTTP development app with ENABLE_DEV_SIMULATOR=true.');
}
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || '.local/ui-review/2026-10-26');
const db = new PrismaClient();
const masterSnapshot = async () => JSON.stringify(await Promise.all([
  db.character.findMany({orderBy:{id:'asc'}}),
  db.skill.findMany({orderBy:{id:'asc'}}),
  db.event.findMany({orderBy:{id:'asc'}}),
]));
const masterBefore = await masterSnapshot();
const players: string[] = [], tags: string[] = [], admins: string[] = [];
const records: any[] = [], failures: any[] = [];
const selectedStages = process.argv[2]?.split(',');
if (selectedStages) {
  const previous = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  records.push(...previous.records);
  failures.push(...previous.failures.filter((f: any) => !selectedStages.includes(f.name)));
}
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const viewport = { width: 390, height: 844 };
await mkdir(path.join(output, 'screenshots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const ctx = await browser.newContext({ baseURL: origin, viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo', permissions: ['camera'] });
const page = await ctx.newPage();
// Do not save character edits while capturing editor states.
await ctx.route('**/api/admin/characters/*', async route => {
  if (route.request().method() === 'PATCH') throw new Error('Character master writes are forbidden during UI capture.');
  await route.continue();
});
page.setDefaultTimeout(60000);
const errors: string[] = [];
page.on('pageerror', e => errors.push(String(e)));

async function settle(p = page) {
  await p.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })));
  });
  await p.waitForTimeout(180);
}
async function go(route: string, p = page) {
  for (let attempt = 0; ; attempt++) {
    try {
      await p.goto(route, { waitUntil: 'load', timeout: 120000 });
      break;
    } catch (error) {
      // First compilation in next dev can replace a navigation with a reload.
      if (attempt >= 2 || !/net::ERR_ABORTED|interrupted by another navigation/.test(String(error))) throw error;
      await p.waitForTimeout(500);
    }
  }
  await settle(p);
}
async function snap(id: string, title: string, group: string, note = '', p = page) {
  await settle(p);
  await expect(p.locator('[data-renderer="loading"], [data-model-state="loading"]')).toHaveCount(0, {timeout:120000});
  const file = `screenshots/${id}.png`;
  const layout = await p.evaluate(() => ({ width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight, scrollY, scrollers: Array.from(document.querySelectorAll('*')).filter(e => e instanceof HTMLElement && e.scrollHeight > e.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)).map(e => ({ className: e.className, top: e.scrollTop, visibleHeight: e.clientHeight, contentHeight: e.scrollHeight })) }));
  const smallText = process.env.UI_TEXT_AUDIT === 'true' ? await collectSmallText(p) : undefined;
  await p.screenshot({ path: path.join(output, file), animations: 'disabled' });
  const record = { id, title, group, note, file, route: p.url().replace(origin, '').replace(/(\/acquire\/)[A-Za-z0-9_-]+/, '$1[token]').replace(/tag=[^&]+/, 'tag=[token]'), layout, smallText };
  const existing = records.findIndex(r => r.id === id);
  if (existing >= 0) records.splice(existing, 1, record); else records.push(record);
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ viewport, records, failures, errors }, null, 2));
  console.log(`${records.length}: ${id} ${title}`);
}
async function stage(name: string, fn: () => Promise<void>) {
  if (selectedStages && !selectedStages.includes(name)) return;
  try { await fn(); }
  catch (error) { failures.push({ name, error: String(error) }); console.error(`FAILED ${name}: ${error}`); }
}
async function guest() {
  const r = await page.request.post('/api/guest', { headers: { origin }, data: { nickname: 'よつば' } });
  if (!r.ok()) throw new Error(`guest ${r.status()} ${await r.text()}`);
  const player = (await r.json()).player; players.push(player.id); return player.id as string;
}
async function makeTag(departmentId: string) {
  const token = randomBytes(32).toString('base64url');
  const row = await db.acquisitionTag.create({ data: { eventId: process.env.EVENT_ID || 'local-exhibition', departmentId, tokenHash: hash(token) } });
  tags.push(row.id); return token;
}

try {
  console.log('health', await (await fetch(`${origin}/api/health`)).text());
  const characters = await db.character.findMany({ orderBy: { sortOrder: 'asc' } });
  if (!characters.length) throw new Error('No character master data');
  await stage('entry', async () => {
    await go('/'); await snap('01-home-visitor', 'ホーム／ゲスト登録前', '01 はじめる');
    await page.getByRole('button', { name: '遊び方を開く' }).click();
    await snap('02-guide', '冒険のガイド', '01 はじめる');
    await page.keyboard.press('Escape');
    await go('/collection'); await snap('02a-collection-visitor', 'キャラ図鑑／ゲスト登録なし', '01 はじめる');
    await go('/collection/forest-golem'); await snap('02b-detail-visitor', 'キャラ詳細／ゲスト登録なし', '01 はじめる');
    await go('/start'); await expect(page.getByRole('button', { name: 'ゲストではじめる' })).toBeEnabled();
    await snap('03-start-empty', 'ゲスト開始／未入力', '01 はじめる');
    await page.getByRole('textbox', { name: /ニックネーム/ }).fill('よつば');
    await snap('04-start-filled', 'ゲスト開始／名前入力済み', '01 はじめる');
    await go('/start?next=local-raid'); await snap('05-start-raid', 'レイド参加からゲスト開始', '01 はじめる', 'レイドへの復帰先を持つ開始画面');
  });
  const playerId = await guest();
  await stage('home and scanner', async () => {
    await go('/'); await snap('06-home-empty', 'ホーム／未獲得', '02 ホーム・QR');
    await page.getByRole('button', { name: 'QRでレイドに参加' }).click();
    await expect(page.getByRole('status').filter({ hasText: '会場のレイド用QRコード' })).toBeVisible();
    await snap('07-qr-camera', 'レイドQR／読み取り中', '02 ホーム・QR', '撮影用の仮想カメラ映像');
    await page.keyboard.press('Escape');
    await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); }; });
    await page.getByRole('button', { name: 'QRでレイドに参加' }).click();
    await expect(page.getByText(/カメラへのアクセスが許可されていません/)).toBeVisible();
    await snap('08-qr-denied', 'レイドQR／カメラ許可エラー', '02 ホーム・QR', 'ブラウザのカメラ拒否を再現');
    await page.keyboard.press('Escape');
  });
  await stage('collection locked', async () => {
    await go('/collection'); await snap('09-collection-empty', 'キャラ図鑑／未獲得', '03 図鑑・未獲得');
    for (const c of characters) {
      await go(`/collection/${c.id}`);
      for (const [key, tab] of [['stats', 'ステータス'], ['skill', '必殺技'], ['about', '紹介']]) {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        await snap(`10-locked-${String(c.sortOrder).padStart(2, '0')}-${c.id}-${key}`, `${c.name}／${tab}／未獲得`, '03 図鑑・未獲得');
      }
    }
  });
  await stage('profile', async () => {
    await go('/profile'); await snap('11-profile', 'プロフィール／編集', '04 プロフィール');
    await page.getByRole('textbox', { name: /ニックネーム/ }).fill('よつば');
    await page.getByRole('button', { name: '変更を保存', exact: true }).click();
    await expect(page.getByText('ニックネームを保存しました。', { exact: true })).toBeVisible();
    await snap('12-profile-saved', 'プロフィール／保存完了', '04 プロフィール');
    await page.getByRole('tab', { name: '冒険の記録', exact: true }).click();
    await snap('13-profile-records-empty', '冒険の記録／未獲得', '04 プロフィール');
  });
  await stage('raid entry', async () => {
    await go('/battle');
    await snap('14-raid-entry', '同期レイド／QR参加', '05 レイド参加');
    await page.getByRole('button', { name: 'QRでレイドに参加', exact: true }).click();
    await snap('15-raid-entry-camera', '同期レイド／QR読み取り', '05 レイド参加');
    await page.getByRole('button', { name: 'QR読み取りを閉じる', exact: true }).click();
  });
  await stage('raid preview', async () => {
    await page.clock.install();
    await go('/battle/raid?preview=1');
    await page.waitForTimeout(700);
    await snap('23-raid-preview', 'レイド／操作プレビュー', '06 レイド・プレビュー');
    await page.getByRole('button', { name: 'レイドのルールを開く' }).click();
    await snap('24-raid-rules', 'レイド／遊び方', '06 レイド・プレビュー');
    await page.keyboard.press('Escape');
    for (const c of characters.filter(c => c.departmentId)) {
      await page.getByRole('combobox', { name: '参加キャラクター' }).selectOption(c.id);
      await page.waitForTimeout(400);
      await snap(`25-raid-partner-${c.id}`, `レイド／パートナー変更／${c.name}`, '06 レイド・プレビュー');
    }
    await page.getByRole('button', { name: '回復を選択', exact: true }).click();
    await page.getByRole('button', { name: 'パーを選択', exact: true }).click();
    await snap('26-raid-heal-selection', 'レイド／回復・パー選択', '06 レイド・プレビュー');
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
    await page.getByRole('button', { name: 'じゃんけんで試す', exact: true }).click();
    await snap('27-raid-preview-waiting', 'レイド／じゃんけん待機', '06 レイド・プレビュー');
    await page.clock.runFor(2100);
    await snap('28-raid-preview-result', 'レイド／プレビュー結果', '06 レイド・プレビュー');
    await page.clock.resume();
  });
  await page.clock.resume().catch(() => {});
  await stage('acquisition', async () => {
    const issued = await Promise.all(['mechanical', 'electrical', 'control', 'civil'].map(makeTag));
    const visitor = await browser.newContext({ baseURL: origin, viewport, isMobile: true, hasTouch: true, locale: 'ja-JP' });
    const vp = await visitor.newPage();
    await go(`/acquire/${issued[0]}`, vp);
    await snap('29-start-acquisition', '展示タグからゲスト開始', '07 キャラ獲得', 'タグの復帰先を持つ開始画面', vp);
    await visitor.close();
    await go(`/acquire/${issued[0]}`); await snap('30-acquire-confirm', 'キャラ獲得／確認', '07 キャラ獲得');
    await page.getByRole('button', { name: '仲間にする', exact: true }).click();
    await expect(page.getByText('新しいパートナーが仲間になりました！', { exact: true })).toBeVisible();
    await snap('31-acquire-success', 'キャラ獲得／成功', '07 キャラ獲得');
    await page.reload(); await snap('32-acquire-already-owned', 'キャラ獲得／獲得済み', '07 キャラ獲得');
    await go('/'); await snap('33-home-partial', 'ホーム／1体獲得', '02 ホーム・QR');
    await go('/collection'); await snap('34-collection-partial', 'キャラ図鑑／1体獲得', '08 図鑑・獲得済み');
    for (const token of issued.slice(1, 3)) {
      const r = await page.request.post('/api/acquisitions', { headers: { origin }, data: { token } });
      if (!r.ok()) throw new Error(await r.text());
    }
    await go(`/acquire/${issued[3]}`);
    await page.getByRole('button', { name: '仲間にする', exact: true }).click();
    await expect(page.getByText('4学科コンプリート！', { exact: true })).toBeVisible();
    await snap('35-acquire-complete', 'キャラ獲得／4学科コンプリート・4プロ解放', '07 キャラ獲得');
    await go('/'); await snap('36-home-unlocked', 'ホーム／4プロ解放', '02 ホーム・QR');
    await go('/acquire/invalid-ui-audit-link'); await snap('37-acquire-invalid', 'キャラ獲得／無効なリンク', '07 キャラ獲得');
  });
  await stage('collection owned', async () => {
    await db.playerCharacter.createMany({ data: characters.map(c => ({ playerId, characterId: c.id })), skipDuplicates: true });
    await go('/collection'); await snap('38-collection-all-owned', 'キャラ図鑑／全キャラ獲得', '08 図鑑・獲得済み', '撮影用ゲストにのみ所持データを追加');
    for (const c of characters) {
      await go(`/collection/${c.id}`);
      for (const [key, tab] of [['stats', 'ステータス'], ['skill', '必殺技'], ['about', '紹介']]) {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        await snap(`39-owned-${String(c.sortOrder).padStart(2, '0')}-${c.id}-${key}`, `${c.name}／${tab}／獲得済み`, '08 図鑑・獲得済み');
      }
    }
    await go('/profile'); await page.getByRole('tab', { name: '冒険の記録', exact: true }).click();
    await snap('40-profile-records-complete', '冒険の記録／全12体獲得', '04 プロフィール');
    await go('/battle/raid?preview=1');
    await page.getByRole('combobox', { name: '参加キャラクター' }).selectOption('four-pro');
    await page.waitForTimeout(600);
    await snap('41-raid-four-pro', 'レイド／4プロ選択', '06 レイド・プレビュー');
  });
  await stage('local raid states', async () => {
    let time = Date.now();
    let room = new LocalRaidRoom(() => 'paper', () => time);
    room.join(playerId, 'forest-golem', 170, 'よつば', characters.find(c => c.id === 'forest-golem')!.name);
    const personal = () => room.snapshot(playerId);
    await page.route('**/api/local-raid*', async route => {
      if (route.request().method() === 'POST') {
        const data = route.request().postDataJSON();
        if (data.type === 'command') room.command(playerId, data);
      }
      await route.fulfill({ json: { state: personal() } });
    });
    const note = '実装済みLocalRaidRoomで状態を再現。共有のローカル部屋は変更しない';
    await go('/battle/raid?sync=local');
    await expect(page.getByRole('status').filter({hasText:/^受付開始を待っています$/})).toBeVisible();
    await snap('42-raid-lobby', '同期レイド／受付前', '09 同期レイド', note);
    await page.getByRole('button', { name: 'レイドのルールを開く' }).click();
    await snap('43-raid-local-rules', '同期レイド／遊び方', '09 同期レイド', note);
    await page.keyboard.press('Escape');
    let roomId = room.snapshot().roomId;
    room.start(roomId);
    await expect(page.getByRole('button', { name: '攻撃を選択', exact: true })).toBeEnabled();
    await snap('44-raid-collecting', '同期レイド／10秒の入力受付', '09 同期レイド', note);
    await page.getByRole('button', { name: '攻撃を選択', exact: true }).click();
    await page.getByRole('button', { name: 'チョキを選択', exact: true }).click();
    await expect(page.getByText('送信完了！', {exact:true})).toBeVisible();
    await snap('45-raid-selected', '同期レイド／攻撃・チョキ選択', '09 同期レイド', note);
    await expect(page.getByText('送信完了！', { exact: true })).toBeVisible();
    await snap('46-raid-submitted', '同期レイド／送信完了', '09 同期レイド', note);
    time += 10000; room.snapshot();
    await expect(page.getByText('スクリーンに注目！', { exact: true })).toBeVisible();
    await snap('47-raid-screen-wait', '同期レイド／会場スクリーン待機', '09 同期レイド', note);
    room.reveal(roomId, 1);
    await expect(page.locator('.raid-rps-result')).toContainText('勝ち');
    await snap('48-raid-win', '同期レイド／じゃんけん勝ち', '09 同期レイド', note);
    room.impact(roomId, 1, 'action'); room.impact(roomId, 1, 'counter');
    await expect(page.getByRole('progressbar', { name: '自分のHP（同期）' })).toHaveAttribute('aria-valuenow', '150');
    await snap('49-raid-counter', '同期レイド／全体反撃・HP減少', '09 同期レイド', note);
    room.finish(roomId, 1);
    await expect(page.getByRole('button', { name: '回復を選択', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '回復を選択', exact: true }).click();
    await page.getByRole('button', { name: 'パーを選択', exact: true }).click();
    await expect(page.getByText('送信完了！', {exact:true})).toBeVisible();
    await snap('45b-raid-paper-selected', '同期レイド／回復・パー自動送信（黄）', '09 同期レイド', note);
    time += 10000; room.snapshot(); room.reveal(roomId, 2); room.impact(roomId, 2, 'action');
    await expect(page.locator('.raid-rps-result')).toContainText('あいこ');
    await snap('50-raid-heal-draw', '同期レイド／あいこ・自己回復', '09 同期レイド', note);
    room.finish(roomId, 2);
    await expect(page.getByRole('button', { name: '攻撃を選択', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '攻撃を選択', exact: true }).click();
    await page.getByRole('button', { name: 'グーを選択', exact: true }).click();
    await expect(page.getByText('送信完了！', {exact:true})).toBeVisible();
    await snap('45a-raid-rock-selected', '同期レイド／攻撃・グー自動送信（赤）', '09 同期レイド', note);
    time += 10000; room.snapshot(); room.reveal(roomId, 3);
    await expect(page.locator('.raid-rps-result')).toContainText('負け');
    await snap('51-raid-lose', '同期レイド／じゃんけん負け', '09 同期レイド', note);
    room.finish(roomId, 3);
    time += 10000; room.snapshot(); room.reveal(roomId, 4);
    await expect(page.locator('.raid-rps-result')).toContainText('未入力');
    await snap('52-raid-no-input', '同期レイド／未入力の結果', '09 同期レイド', note);
    // A separate deterministic room reaches the actual victory UI.
    room = new LocalRaidRoom(() => 'paper', () => time);
    room.join(playerId, 'forest-golem', 170, 'よつば', 'フォレストゴーレム');
    for (let i = 1; i < 6; i++) room.join(`fixture-${i}`, 'forest-golem', 170, `参加者${i + 1}`);
    roomId = room.snapshot().roomId; room.start(roomId);
    for (const id of [playerId, ...Array.from({ length: 5 }, (_, i) => `fixture-${i + 1}`)]) room.command(id, { roomId, round: 1, requestId: randomUUID(), action: 'attack', hand: 'scissors' });
    time += 10000; room.snapshot(); room.reveal(roomId, 1); room.impact(roomId, 1, 'action');
    await page.reload();
    await expect(page.getByRole('region', { name: '討伐成功の結果' })).toBeVisible();
    await snap('53-raid-victory', '同期レイド／討伐成功', '09 同期レイド', note);
    room = new LocalRaidRoom(() => 'paper', () => time);
    room.join(playerId, 'forest-golem', 10, 'よつば', 'フォレストゴーレム');
    roomId = room.snapshot().roomId; room.start(roomId); time += 10000;
    room.snapshot(); room.finish(roomId, 1);
    await page.reload();
    await expect(page.getByRole('status').filter({hasText:/^戦闘不能$/})).toBeVisible();
    await snap('54-raid-knocked-out', '同期レイド／戦闘不能', '09 同期レイド', note);
    await page.unroute('**/api/local-raid*');
  });
  await stage('admin', async () => {
    await go('/admin/login'); await snap('55-admin-login', '管理者ログイン', '10 管理画面');
    const token = randomBytes(32).toString('base64url');
    const admin = await db.adminUser.create({ data: { username: `ui_${randomUUID().slice(0, 8)}`, passwordHash: 'capture-session-only' } });
    admins.push(admin.id);
    await db.adminSession.create({ data: { adminId: admin.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 3600000) } });
    await ctx.addCookies([{ name: 'fourpro_admin', value: token, url: origin, httpOnly: true, sameSite: 'Strict' }]);
    await go('/admin'); await snap('56-admin-list', '管理画面／キャラ一覧・上部', '10 管理画面');
    for (let offset = 650; offset < 2600; offset += 650) {
      await page.locator('[class*="adminPage"]').evaluate((el, y) => { el.scrollTop = y; }, offset);
      await snap(`57-admin-list-scroll-${offset}`, `管理画面／キャラ一覧・スクロール${offset}`, '10 管理画面', '管理画面内部をスクロール');
    }
    await page.getByRole('heading', { name: '還暦', exact: true }).scrollIntoViewIfNeeded();
    await snap('57-admin-list-bottom', '管理画面／キャラ一覧・下部', '10 管理画面', 'スクロール後');
    await go('/admin');
    await page.getByLabel('分類', { exact: true }).selectOption('extra');
    await snap('58-admin-filter', '管理画面／追加キャラ絞り込み', '10 管理画面');
    await page.getByLabel('キャラクターを検索', { exact: true }).fill('存在しないキャラ');
    await snap('59-admin-search-empty', '管理画面／検索結果なし', '10 管理画面');
    await go('/admin/characters/temp-06'); await snap('60-admin-editor-top', 'キャラ管理／編集・上部', '10 管理画面');
    await page.getByRole('heading', {name:'3Dモデル',exact:true}).scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    await snap('60a-admin-model', 'キャラ管理／3Dモデルと正面調整', '10 管理画面', '編集内容は保存しない');
    await page.getByLabel('基本HP', { exact: true }).scrollIntoViewIfNeeded();
    await snap('61-admin-editor-stats', 'キャラ管理／基本値の編集', '10 管理画面', 'スクロール後。マスタは保存しない');
    await page.getByRole('button', { name: 'このキャラのタグを発行', exact: true }).scrollIntoViewIfNeeded();
    await snap('62-admin-tag-empty', 'キャラ管理／タグ発行', '10 管理画面', 'スクロール後');
    const issuing = page.waitForResponse(r => r.url().endsWith('/api/admin/tags') && r.request().method() === 'POST', { timeout: 60000 });
    await page.getByRole('button', { name: 'このキャラのタグを発行', exact: true }).click();
    const issued = await (await issuing).json();
    if (!issued.tag) throw new Error(JSON.stringify(issued));
    tags.push(issued.tag.id);
    await page.getByRole('img', { name: 'キャラ獲得用QRコード' }).scrollIntoViewIfNeeded();
    await snap('63-admin-tag-issued', 'キャラ管理／QR発行完了', '10 管理画面', '撮影用タグ。撮影後に削除するため利用不可');
    const toggle = page.getByRole('button', { name: `${issued.tag.id}を無効にする`, exact: true });
    await toggle.click();
    await page.getByRole('button', { name: `${issued.tag.id}を有効にする`, exact: true }).scrollIntoViewIfNeeded();
    await snap('64-admin-tag-disabled', 'キャラ管理／タグ無効化', '10 管理画面');
    await go('/admin/characters/four-pro');
    await page.getByRole('heading', { name: '解放条件', exact: true }).scrollIntoViewIfNeeded();
    await snap('65-admin-legend', 'キャラ管理／4プロの解放条件', '10 管理画面');
  });
  await stage('utility', async () => {
    await go('/dev'); await snap('66-dev', '開発用シミュレーター', '11 補助画面');
    await go('/ui-audit-page-not-found'); await snap('67-not-found', '404／ページが見つからない', '11 補助画面');
    await go('/collection/ui-audit-character-not-found'); await snap('68-character-not-found', '404／キャラが見つからない', '11 補助画面');
  });
  await stage('raid fallback', async () => {
    const fallback = await browser.newContext({ baseURL: origin, viewport, isMobile: true, hasTouch: true, locale: 'ja-JP' });
    await fallback.addCookies(await ctx.cookies());
    await fallback.addInitScript(`(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: function(type, ...args) {
        if (type.startsWith('webgl') || type === 'experimental-webgl') return null;
        return Reflect.apply(original, this, [type, ...args]);
      } });
    })()`);
    const fp = await fallback.newPage();
    try {
      await go('/battle/raid?preview=1', fp);
      await expect(fp.locator('[data-renderer]')).toHaveAttribute('data-renderer', 'fallback');
      await snap('72-raid-fallback', 'レイド／WebGL非対応の代替表示', '06 レイド・プレビュー', 'WebGLを利用できないブラウザを再現', fp);
      await fp.route('**/api/local-raid*', route => route.fulfill({ status: 503, json: { error: '同期サーバーに接続できません。' } }));
      await go('/battle/raid?sync=local', fp);
      await expect(fp.getByText('再接続中', { exact: true })).toBeVisible();
      await snap('73-raid-reconnecting', '同期レイド／接続エラー・再接続中', '09 同期レイド', '同期APIの通信失敗を撮影ブラウザだけで再現', fp);
    } finally { await fallback.close(); }
  });
  await stage('models', async () => {
    await go('/models');
    await page.waitForTimeout(1200);
    await snap('74-models-top', '3Dモデル確認／上部', '13 3Dモデル確認');
    for (const c of characters.filter(c => c.modelId)) {
      await page.getByRole('heading', {name:new RegExp(c.departmentId ? ({mechanical:'機械科',electrical:'電気情報',control:'電子制御',civil:'建設システム'} as Record<string,string>)[c.departmentId] : c.name)}).scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await snap('74-model-' + c.id, '3Dモデル確認／' + c.name, '13 3Dモデル確認');
    }
  });
  await stage('venue screen', async () => {
    // Release the ten model previews before rendering the full-size venue scene.
    await page.goto('about:blank');
    const screenContext = await browser.newContext({baseURL:origin,viewport:{width:1920,height:1080},locale:'ja-JP'});
    await screenContext.addCookies(await ctx.cookies());
    const sp=await screenContext.newPage();
    try {
      for (const [id,route,title] of [
        ['75-screen-lobby','/raid/screen','会場スクリーン／参加受付前'],
        ['76-screen-local','/raid/screen?sync=local','会場スクリーン／ローカル同期・受付前'],
        ['77-screen-effects','/raid/screen?demo=effects','会場スクリーン／演出デモ'],
      ]) {
        await go(route,sp);
        await expect(sp.locator('[data-renderer]')).toHaveAttribute('data-renderer', /^(webgl|fallback)$/, {timeout:120000});
        await sp.waitForTimeout(600);
        await snap(id,title,'14 会場スクリーン','PC用 1920×1080',sp);
      }
    } finally {await screenContext.close();}
  });
  await stage('small and large viewport', async () => {
    for (const size of [{ width: 375, height: 667 }, { width: 430, height: 932 }]) {
      await page.setViewportSize(size);
      for (const [id, route, title] of [['home', '/', 'ホーム'], ['collection', '/collection', 'キャラ図鑑'], ['detail', '/collection/forest-golem', 'キャラ詳細'], ['profile', '/profile', 'プロフィール'], ['battle', '/battle', 'レイド参加'], ['raid', '/battle/raid?preview=1', 'レイド']]) {
        await go(route);
        await snap(`69-${size.width}-${id}`, `${title}／${size.width}×${size.height}`, '12 サイズ比較');
      }
    }
    await page.setViewportSize(viewport);
  });
} finally {
  await browser.close();
  await db.rateLimitBucket.deleteMany({ where: { key: { in: [...players.map(id => `acquire:${id}`), ...admins.map(id => `admin-tags:${id}`)] } } });
  await db.player.deleteMany({ where: { id: { in: players } } });
  await db.acquisitionTag.deleteMany({ where: { id: { in: tags } } });
  await db.adminUser.deleteMany({ where: { id: { in: admins } } });
  const masterUnchanged = masterBefore === await masterSnapshot();
  if (!masterUnchanged) failures.push({name:'master data',error:'Character, skill or event master changed during capture'});
  await db.$disconnect();
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), viewport, records, failures, errors, masterUnchanged, cleanup: '撮影用プレイヤー・管理者・タグを削除済み' }, null, 2));
}

await import('./render');
if (process.env.UI_TEXT_AUDIT === 'true' && !failures.length && !errors.length) await import('./render-small-text');
if (failures.length || errors.length) process.exitCode = 1;
