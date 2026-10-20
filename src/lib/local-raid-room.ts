import { randomInt, randomUUID } from "node:crypto";
import { battlePreview } from "./battle-preview";
import { raidHands, resolveRaidRps, type RaidHand } from "./raid-rps";
import type { LocalRaidAction, LocalRaidMember, LocalRaidResult, LocalRaidSnapshot } from "./local-raid-types";

type Member = LocalRaidMember & { screenId: string; characterName: string; nickname: string; lastAt: number };
export class LocalRaidError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// One room in one local Node process. Player ownership/growth/rewards are never persisted here.
export class LocalRaidRoom {
  private roomId = randomUUID();
  private revision = 0;
  private bossHp: number = battlePreview.bossHp;
  private turn = 0;
  private revealedTurn = 0;
  private revealListeners = new Set<() => void>();
  private totalDamage = 0;
  private totalHealing = 0;
  private lastResult: LocalRaidResult | null = null;
  private results: LocalRaidResult[] = [];
  private members = new Map<string, Member>();
  private receipts = new Map<string, { fingerprint: string; result: LocalRaidResult }>();

  constructor(private drawHand: () => RaidHand = () => raidHands[randomInt(raidHands.length)].id, private now = () => Date.now()) {}

  join(playerId: string, characterId: string, maxHp: number, nickname: string, characterName = characterId) {
    const existing = this.members.get(playerId);
    if (!existing && this.members.size >= 20) throw new LocalRaidError(409, "ローカルテストの参加上限は20人です。スクリーンの同期設定からリセットしてください。");
    if (!Number.isSafeInteger(maxHp) || maxHp <= 0) throw new LocalRaidError(400, "キャラクターのHPを確認してください。");
    if (!existing) this.members.set(playerId, { screenId: randomUUID(), characterId, characterName, maxHp, hp: maxHp, nickname, lastAt: -Infinity, lastResult: null });
    else if (existing.characterId !== characterId || existing.maxHp !== maxHp) {
      existing.hp = Math.floor(existing.hp / existing.maxHp * maxHp);
      existing.characterId = characterId;
      existing.characterName = characterName;
      existing.maxHp = maxHp;
      existing.nickname = nickname;
    } else return this.snapshot(playerId);
    this.revision++;
    return this.snapshot(playerId);
  }

  command(playerId: string, input: { roomId: string; requestId: string; action: LocalRaidAction; hand: RaidHand }) {
    if (input.roomId !== this.roomId) throw new LocalRaidError(409, "同期がリセットされました。最新の状態でやり直してください。");
    const member = this.members.get(playerId);
    if (!member) throw new LocalRaidError(409, "先にローカルレイドへ参加してください。");
    const key = `${playerId}:${input.requestId}`;
    const fingerprint = `${input.action}:${input.hand}`;
    const receipt = this.receipts.get(key);
    if (receipt) {
      if (receipt.fingerprint !== fingerprint) throw new LocalRaidError(409, "同じ送信IDで行動を変更できません。");
      return { state: this.snapshot(playerId), result: receipt.result };
    }
    if (this.bossHp <= 0) throw new LocalRaidError(409, "討伐成功！ スクリーンの同期設定からリセットできます。");
    if (member.hp <= 0) throw new LocalRaidError(409, "戦闘不能です。スクリーンの同期設定からリセットできます。");
    const now = this.now();
    if (now - member.lastAt < 1200) throw new LocalRaidError(429, "前の行動の演出が終わるまで少しお待ちください。");
    const boss = this.drawHand();
    const rps = resolveRaidRps(input.hand, boss);
    const base = input.action === "attack" ? battlePreview.baseAttack : battlePreview.baseSelfHeal;
    const bossHpBefore = this.bossHp;
    const playerHpBefore = member.hp;
    const amount = Math.min(base * rps.multiplier, input.action === "attack" ? this.bossHp : member.maxHp - member.hp);
    if (input.action === "attack") { this.bossHp -= amount; this.totalDamage += amount; }
    else { member.hp += amount; this.totalHealing += amount; }
    // Provisional sync-test rule: the boss counters only the acting player for 20 HP.
    const counterDamage = this.bossHp > 0 ? Math.min(20, member.hp) : 0;
    member.hp -= counterDamage;
    member.lastAt = now;
    const result: LocalRaidResult = { id: input.requestId, participantId: member.screenId, characterId: member.characterId, characterName: member.characterName, bossHpBefore, bossHpAfter: this.bossHp, playerHpBefore, playerHpAfter: member.hp, turn: ++this.turn, nickname: member.nickname, action: input.action, hand: input.hand, boss, ...rps, amount, counterDamage, at: now };
    member.lastResult = result;
    this.lastResult = result;
    this.results.push(result);
    if (this.results.length > 200) this.results.shift();
    this.receipts.set(key, { fingerprint, result });
    this.revision++;
    return { state: this.snapshot(playerId), result };
  }

  // The screen calls this only after painting its actual RPS reveal. Duplicate acknowledgements are harmless.
  reveal(roomId: string, turn: number) {
    if (roomId !== this.roomId) throw new LocalRaidError(409, "同期がリセットされました。");
    if (!Number.isSafeInteger(turn) || turn < 1 || turn > this.turn) throw new LocalRaidError(400, "公開する行動を確認してください。");
    if (turn > this.revealedTurn) {
      this.revealedTurn = turn;
      this.revision++;
      this.revealListeners.forEach((notify) => notify());
    }
    return this.snapshot();
  }

  // Hold a waiting phone's poll briefly so the reveal is delivered without another polling interval.
  waitForReveal(roomId: string, turn: number, signal?: AbortSignal) {
    if (roomId !== this.roomId || turn <= this.revealedTurn || signal?.aborted) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => { clearTimeout(timer); this.revealListeners.delete(done); signal?.removeEventListener("abort", done); resolve(); };
      const timer = setTimeout(done, 3000);
      this.revealListeners.add(done);
      signal?.addEventListener("abort", done, { once: true });
    });
  }

  reset() {
    this.roomId = randomUUID();
    this.bossHp = battlePreview.bossHp;
    this.turn = this.totalDamage = this.totalHealing = 0;
    this.revealedTurn = 0;
    this.lastResult = null;
    this.results = [];
    this.receipts.clear();
    this.members.clear(); // Connected phones rejoin the new room; closed phones disappear.
    this.revision++;
    this.revealListeners.forEach((notify) => notify());
    return this.snapshot();
  }

  snapshot(playerId?: string): LocalRaidSnapshot {
    const members = [...this.members.values()];
    const me = playerId ? this.members.get(playerId) : undefined;
    return {
      roomId: this.roomId, revision: this.revision, revealedTurn: this.revealedTurn, bossName: battlePreview.bossName,
      bossHp: this.bossHp, bossMaxHp: battlePreview.bossHp, turn: Math.max(1, this.turn),
      participants: members.length, alive: members.filter((member) => member.hp > 0).length,
      attackCount: members.filter((member) => member.lastResult?.action === "attack").length,
      healCount: members.filter((member) => member.lastResult?.action === "heal").length,
      totalDamage: this.totalDamage, totalHealing: this.totalHealing,
      lastResult: this.lastResult ? { ...this.lastResult } : null,
      me: me ? { characterId: me.characterId, hp: me.hp, maxHp: me.maxHp, lastResult: me.lastResult ? { ...me.lastResult } : null } : null,
      members: members.map((member) => ({ id: member.screenId, characterId: member.characterId, characterName: member.characterName, nickname: member.nickname, hp: member.hp, maxHp: member.maxHp })),
      results: this.results.map((result) => ({ ...result })),
    };
  }
}

const localGlobal = globalThis as typeof globalThis & { fourProLocalRaidV3?: LocalRaidRoom };
export function localRaidRoom() { return localGlobal.fourProLocalRaidV3 ??= new LocalRaidRoom(); }
