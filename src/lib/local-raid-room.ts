import { randomInt, randomUUID } from "node:crypto";
import { battlePreview } from "./battle-preview";
import { raidHands, resolveRaidRps, type RaidHand } from "./raid-rps";
import type { LocalRaidAction, LocalRaidMember, LocalRaidResult, LocalRaidRoundResult, LocalRaidSnapshot } from "./local-raid-types";

type Member = LocalRaidMember & { screenId: string; characterName: string; nickname: string };
type Command = { roomId: string; round: number; requestId: string; action: LocalRaidAction; hand: RaidHand };
export type SavedRaidRoom = {
  version: 1; roomId: string; revision: number; bossHp: number; turn: number;
  phase: LocalRaidSnapshot["round"]["phase"]; closesAt: number | null;
  revealedTurn: number; actionTurn: number; counterTurn: number; completedTurn: number;
  totalDamage: number; totalHealing: number; rounds: LocalRaidRoundResult[];
  members: [string, Member][]; receipts: [string, string][];
};
export const raidInputMs = 10_000;
export class LocalRaidError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Apportion lethal damage without favoring whoever happened to submit first. */
export function allocateRaidDamage(requested: number[], remaining: number) {
  const sum = requested.reduce((total, amount) => total + amount, 0);
  if (sum <= remaining) return requested;
  const scaled = requested.map((amount) => amount * remaining / sum);
  const amounts = scaled.map(Math.floor);
  let extra = remaining - amounts.reduce((total, amount) => total + amount, 0);
  const order = scaled.map((value, i) => ({ i, remainder: value - amounts[i] })).sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const { i } of order) if (extra-- > 0) amounts[i]++;
  return amounts;
}

// Shared rules for local and database-backed rooms. Ownership/growth/rewards are separate.
export class LocalRaidRoom {
  private roomId = randomUUID();
  private revision = 0;
  private bossHp: number = battlePreview.bossHp;
  private turn = 0;
  private phase: LocalRaidSnapshot["round"]["phase"] = "lobby";
  private closesAt: number | null = null;
  private revealedTurn = 0;
  private actionTurn = 0;
  private counterTurn = 0;
  private completedTurn = 0;
  private listeners = new Set<() => void>();
  private totalDamage = 0;
  private totalHealing = 0;
  private results: LocalRaidResult[] = [];
  private rounds: LocalRaidRoundResult[] = [];
  private members = new Map<string, Member>();
  private receipts = new Map<string, string>();

  constructor(private drawHand: () => RaidHand = () => raidHands[randomInt(raidHands.length)].id, private now = () => Date.now()) {}

  save(): SavedRaidRoom {
    return structuredClone({ version: 1, roomId: this.roomId, revision: this.revision, bossHp: this.bossHp, turn: this.turn,
      phase: this.phase, closesAt: this.closesAt, revealedTurn: this.revealedTurn, actionTurn: this.actionTurn,
      counterTurn: this.counterTurn, completedTurn: this.completedTurn, totalDamage: this.totalDamage,
      totalHealing: this.totalHealing, rounds: this.rounds, members: [...this.members], receipts: [...this.receipts] });
  }

  static restore(saved: SavedRaidRoom, now = () => Date.now()) {
    if (saved.version !== 1) throw new Error("Unsupported raid state version.");
    const room = new LocalRaidRoom(undefined, now);
    const { version: _version, members, receipts, ...fields } = structuredClone(saved);
    Object.assign(room, fields);
    room.members = new Map(members); room.receipts = new Map(receipts);
    room.results = room.rounds.flatMap((round) => round.results);
    return room;
  }

  private changed() { this.revision++; this.listeners.forEach((notify) => notify()); }
  private checkRoom(roomId: string) {
    if (roomId !== this.roomId) throw new LocalRaidError(409, "同期がリセットされました。最新の状態でやり直してください。");
  }
  join(playerId: string, characterId: string, maxHp: number, nickname: string, characterName = characterId) {
    this.tick();
    const existing = this.members.get(playerId);
    if (this.phase === "finished") {
      if (!existing) throw new LocalRaidError(409, "終了したレイドです。次の受付をお待ちください。");
      return this.snapshot(playerId);
    }
    if (!existing && this.members.size >= 20) throw new LocalRaidError(409, "参加上限は20人です。");
    if (!Number.isSafeInteger(maxHp) || maxHp <= 0) throw new LocalRaidError(400, "キャラクターのHPを確認してください。");
    if (!existing) this.members.set(playerId, { screenId: randomUUID(), characterId, characterName, maxHp, hp: maxHp, nickname, lastResult: null, submission: null, eligibleRound: this.phase === "playing" ? this.turn + 1 : Math.max(1, this.turn) });
    else if (existing.characterId !== characterId || existing.maxHp !== maxHp) {
      if (this.phase === "playing" || existing.submission) throw new LocalRaidError(409, "次の入力受付までキャラクター変更をお待ちください。");
      existing.hp = Math.floor(existing.hp / existing.maxHp * maxHp);
      Object.assign(existing, { characterId, characterName, maxHp, nickname });
    } else return this.snapshot(playerId);
    this.changed();
    return this.snapshot(playerId);
  }
  start(roomId: string) {
    this.checkRoom(roomId);
    if (this.phase !== "lobby") return this.snapshot();
    if (![...this.members.values()].some((member) => member.hp > 0)) throw new LocalRaidError(409, "参加者が入ってから開始してください。");
    this.openRound();
    return this.snapshot();
  }
  private openRound() {
    this.turn++; this.phase = "collecting"; this.closesAt = this.now() + raidInputMs;
    this.members.forEach((member) => { member.submission = null; });
    this.changed();
  }
  command(playerId: string, input: Command) {
    this.checkRoom(input.roomId); this.tick();
    const member = this.members.get(playerId);
    if (!member) throw new LocalRaidError(409, "先にレイドへ参加してください。");
    const key = `${playerId}:${input.requestId}`;
    const fingerprint = `${input.round}:${input.action}:${input.hand}`;
    const receipt = this.receipts.get(key);
    if (receipt) {
      if (receipt !== fingerprint) throw new LocalRaidError(409, "同じ送信IDで行動を変更できません。");
      return { state: this.snapshot(playerId) };
    }
    if (this.phase !== "collecting" || input.round !== this.turn) throw new LocalRaidError(409, "このラウンドの受付は終了しました。次の受付をお待ちください。");
    if (member.hp <= 0) throw new LocalRaidError(409, "戦闘不能です。");
    if (member.submission) throw new LocalRaidError(409, "このラウンドは送信済みです。");
    member.submission = { round: this.turn, action: input.action, hand: input.hand };
    this.receipts.set(key, fingerprint); this.changed();
    return { state: this.snapshot(playerId) };
  }
  private tick() {
    if (this.phase !== "collecting" || this.closesAt === null || this.now() < this.closesAt) return;
    const eligible = [...this.members.values()].filter((member) => member.hp > 0 && member.eligibleRound <= this.turn);
    const boss = this.drawHand(); // One draw per round, after every player's input is locked.
    const bossHpBefore = this.bossHp;
    const requested = eligible.map((member) => member.submission?.action === "attack" ? battlePreview.baseAttack * resolveRaidRps(member.submission.hand, boss).multiplier : 0);
    const damage = allocateRaidDamage(requested, this.bossHp);
    this.bossHp -= damage.reduce((total, amount) => total + amount, 0);
    const results = eligible.map((member, i): LocalRaidResult => {
      const submitted = member.submission !== null;
      const hand = member.submission?.hand ?? "rock";
      const action = member.submission?.action ?? "attack";
      const rps = resolveRaidRps(hand, boss);
      const playerHpBefore = member.hp;
      const amount = !submitted ? 0 : action === "attack" ? damage[i] : Math.min(battlePreview.baseSelfHeal * rps.multiplier, member.maxHp - member.hp);
      if (action === "heal") member.hp += amount;
      const counterDamage = this.bossHp > 0 ? Math.min(20, member.hp) : 0;
      member.hp -= counterDamage;
      const result = { id: `${this.turn}:${member.screenId}`, submitted, participantId: member.screenId, characterId: member.characterId, characterName: member.characterName, bossHpBefore, bossHpAfter: this.bossHp, playerHpBefore, playerHpAfter: member.hp, turn: this.turn, nickname: member.nickname, action, hand, boss, ...rps, ...(submitted ? {} : { label: "未入力", multiplier: 0 }), amount, counterDamage, at: this.closesAt! };
      member.lastResult = result; return result;
    });
    const round: LocalRaidRoundResult = { turn: this.turn, boss, bossHpBefore, bossHpAfter: this.bossHp, damage: damage.reduce((a, b) => a + b, 0), healing: results.filter((result) => result.action === "heal").reduce((sum, result) => sum + result.amount, 0), results };
    this.rounds.push(round); if (this.rounds.length > 10) this.rounds.shift();
    for (const [key, receipt] of this.receipts) if (Number(receipt.split(":")[0]) < this.turn - 9) this.receipts.delete(key);
    this.results = this.rounds.flatMap((entry) => entry.results);
    this.totalDamage += round.damage; this.totalHealing += round.healing;
    this.phase = "playing"; this.changed();
  }
  reveal(roomId: string, turn: number) { return this.present(roomId, turn, "reveal"); }
  impact(roomId: string, turn: number, kind: "action" | "counter") { return this.present(roomId, turn, kind); }
  private present(roomId: string, turn: number, stage: "reveal" | "action" | "counter") {
    this.checkRoom(roomId); this.tick();
    if (!Number.isSafeInteger(turn) || !this.rounds.some((round) => round.turn === turn)) throw new LocalRaidError(400, "公開するラウンドを確認してください。");
    const revealed = Math.max(this.revealedTurn, turn);
    const action = Math.max(this.actionTurn, stage === "reveal" ? turn - 1 : turn);
    const noCounter = stage === "action" && this.rounds.find((round) => round.turn === turn)!.results.every((result) => result.counterDamage === 0);
    const counter = Math.max(this.counterTurn, stage === "counter" || noCounter ? turn : turn - 1);
    if (revealed !== this.revealedTurn || action !== this.actionTurn || counter !== this.counterTurn) {
      this.revealedTurn = revealed; this.actionTurn = action; this.counterTurn = counter; this.changed();
    }
    return this.snapshot();
  }
  finish(roomId: string, turn: number) {
    this.checkRoom(roomId);
    if (turn <= this.completedTurn) return this.snapshot();
    if (this.phase !== "playing" || turn !== this.turn) throw new LocalRaidError(409, "進行中のラウンドを確認してください。");
    this.present(roomId, turn, "counter"); this.completedTurn = turn;
    if (this.bossHp <= 0 || ![...this.members.values()].some((member) => member.hp > 0)) { this.phase = "finished"; this.closesAt = null; this.changed(); }
    else this.openRound();
    return this.snapshot();
  }
  waitForRevision(roomId: string, revision: number, signal?: AbortSignal) {
    this.tick();
    if (roomId !== this.roomId || revision < this.revision || signal?.aborted) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => { clearTimeout(timer); this.listeners.delete(done); signal?.removeEventListener("abort", done); resolve(); };
      const timer = setTimeout(done, 3000); this.listeners.add(done); signal?.addEventListener("abort", done, { once: true });
    });
  }
  reset() {
    this.roomId = randomUUID(); this.bossHp = battlePreview.bossHp; this.turn = this.completedTurn = 0;
    this.phase = "lobby"; this.closesAt = null; this.revealedTurn = this.actionTurn = this.counterTurn = 0;
    this.totalDamage = this.totalHealing = 0; this.results = []; this.rounds = []; this.receipts.clear(); this.members.clear(); this.changed();
    return this.snapshot();
  }
  snapshot(playerId?: string): LocalRaidSnapshot {
    this.tick();
    const members = [...this.members.values()], me = playerId ? this.members.get(playerId) : undefined;
    const eligible = members.filter((member) => member.eligibleRound <= this.turn && (member.hp > 0 || member.lastResult?.turn === this.turn));
    return {
      roomId: this.roomId, revision: this.revision, serverNow: this.now(), round: { number: this.turn, phase: this.phase, closesAt: this.closesAt, submitted: eligible.filter((member) => member.submission).length, eligible: eligible.length },
      rounds: this.rounds.map((round) => ({ ...round, results: round.results.map((result) => ({ ...result })) })),
      revealedTurn: this.revealedTurn, actionTurn: this.actionTurn, counterTurn: this.counterTurn,
      bossName: battlePreview.bossName, bossHp: this.bossHp, bossMaxHp: battlePreview.bossHp, turn: Math.max(1, this.turn),
      participants: members.length, alive: members.filter((member) => member.hp > 0).length,
      attackCount: members.filter((member) => member.submission?.action === "attack").length, healCount: members.filter((member) => member.submission?.action === "heal").length,
      totalDamage: this.totalDamage, totalHealing: this.totalHealing, lastResult: this.results.at(-1) ? { ...this.results.at(-1)! } : null,
      me: me ? { characterId: me.characterId, hp: me.hp, maxHp: me.maxHp, lastResult: me.lastResult ? { ...me.lastResult } : null, submission: me.submission ? { ...me.submission } : null, eligibleRound: me.eligibleRound } : null,
      members: members.map((member) => ({ id: member.screenId, characterId: member.characterId, characterName: member.characterName, nickname: member.nickname, hp: member.hp, maxHp: member.maxHp })), results: this.results.map((result) => ({ ...result })),
    };
  }
}
const localGlobal = globalThis as typeof globalThis & { fourProLocalRaidV5?: LocalRaidRoom };
export function localRaidRoom() { return localGlobal.fourProLocalRaidV5 ??= new LocalRaidRoom(); }
