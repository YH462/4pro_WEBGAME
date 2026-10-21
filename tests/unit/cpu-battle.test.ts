import { describe, expect, it } from "vitest";
import { chooseCpuAction, cpuRules, createCpuBattle, resolveCpuTurn, type Fighter, type CpuAction } from "../../src/lib/cpu-battle";
import { characters } from "../../src/lib/master-data";

const player: Fighter = { id: "test", name: "テスト", maxHp: 170, attack: 27, defense: 38, charge: 25 };
describe("CPU practice battle", () => {
  it("starts with independent fighter snapshots and full HP", () => {
    const battle = createCpuBattle(player);
    expect(battle.playerHp).toBe(170); expect(battle.cpuHp).toBe(180);
    expect(battle.playerEp).toBe(0); expect(battle.result).toBe("playing");
    expect(battle.player).not.toBe(player);
  });
  it("resolves the advertised move, damages both sides and preserves the previous state", () => {
    let before = createCpuBattle(player);
    for (const advertised of ["attack", "defend", "special", "attack", "defend", "special"]) {
      expect(chooseCpuAction(before)).toBe(advertised);
      const next = resolveCpuTurn(before, "defend");
      expect(next.lastTurn?.cpuAction).toBe(advertised);
      expect(next.turn).toBe(before.turn + 1);
      expect(before.lastTurn).not.toBe(next.lastTurn);
      before = next;
    }
    const first = createCpuBattle(player);
    const next = resolveCpuTurn(first, "attack");
    expect(next.cpuHp).toBe(160); expect(next.playerHp).toBe(153);
    expect(next.playerEp).toBe(25); expect(next.cpuEp).toBe(50);
    expect(first.cpuHp).toBe(180); expect(first.lastTurn).toBeNull();
  });
  it("blocks unaffordable specials and spends the gauge exactly once", () => {
    const before = createCpuBattle(player);
    expect(resolveCpuTurn(before, "special")).toBe(before);
    const next = resolveCpuTurn({ ...before, playerEp: 100 }, "special");
    expect(next.playerEp).toBe(0); expect(next.cpuHp).toBeLessThan(180);
    expect(resolveCpuTurn(next, "special")).toBe(next);
  });
  it("rewards a successful guard with damage reduction and bonus EP, but not an idle guard", () => {
    const before = createCpuBattle(player);
    const guarded = resolveCpuTurn(before, "defend");
    expect(guarded.playerHp).toBe(164); expect(guarded.cpuHp).toBe(180); expect(guarded.playerEp).toBe(50);
    const idleGuard = resolveCpuTurn(guarded, "defend");
    expect(idleGuard.lastTurn?.damageToPlayer).toBe(0); expect(idleGuard.playerEp).toBe(75);
  });
  it("caps EP and exposes the CPU for exactly one turn after a special", () => {
    const before = { ...createCpuBattle(player), playerEp: 90, cpuEp: 100 };
    const guarded = resolveCpuTurn(before, "defend");
    expect(guarded.playerEp).toBe(100); expect(guarded.cpuEp).toBe(0);
    expect(guarded.cpuOpening).toBe(true); expect(guarded.lastTurn?.damageToPlayer).toBe(21);
    const counter = resolveCpuTurn(guarded, "special");
    expect(counter.lastTurn?.damageToCpu).toBe(87); expect(counter.cpuOpening).toBe(false);
    expect(resolveCpuTurn(counter, "attack").lastTurn?.damageToCpu).toBe(20);
  });
  it("supports all results, simultaneous knockout and immutable terminal states", () => {
    const base = createCpuBattle(player);
    const win = resolveCpuTurn({ ...base, cpuHp: 1 }, "attack");
    expect(win.result).toBe("win"); expect(win.cpuHp).toBe(0);
    expect(resolveCpuTurn({ ...base, playerHp: 1 }, "defend").result).toBe("lose");
    const draw = resolveCpuTurn({ ...base, playerHp: 1, cpuHp: 1 }, "attack");
    expect(draw.result).toBe("draw"); expect(draw.playerHp).toBe(0); expect(draw.cpuHp).toBe(0);
    expect(resolveCpuTurn(win, "attack")).toBe(win);
    expect(resolveCpuTurn({ ...base, turn: cpuRules.maxTurns - 1 }, "attack").result).toBe("draw");
  });
  it("punishes attack spamming, while reading specials and openings lets the starter win", () => {
    let spam = createCpuBattle(player);
    while (spam.result === "playing") spam = resolveCpuTurn(spam, "attack");
    expect(spam.result).toBe("lose");
    let tactical = createCpuBattle(player);
    while (tactical.result === "playing") {
      const intent = chooseCpuAction(tactical);
      const action: CpuAction = intent === "special" ? "defend" : tactical.playerEp >= 100 && intent !== "defend" ? "special" : "attack";
      tactical = resolveCpuTurn(tactical, action);
    }
    expect(tactical.result).toBe("win"); expect(tactical.playerHp).toBeGreaterThan(0);
  });
  it.each(characters)("allows $name to win with a suitable sequence of the three commands", (character) => {
    const initial = createCpuBattle({ id: character.id, name: character.name, maxHp: character.baseHp, attack: character.baseAttack, defense: character.baseDefense, charge: character.baseSpecialChargeRate ?? cpuRules.fallbackCharge });
    // Explore legal command choices, merging equivalent states. No luck or upgrades required.
    let states = [initial];
    let won = false;
    for (let turn = 0; turn < 15 && !won; turn++) {
      const next = new Map<string, typeof initial>();
      for (const state of states) for (const action of ["attack", "defend", "special"] as const) {
        const result = resolveCpuTurn(state, action);
        if (result === state) continue;
        if (result.result === "win") { won = true; break; }
        if (result.result === "playing") next.set(`${result.playerHp}/${result.cpuHp}/${result.playerEp}`, result);
      }
      states = [...next.values()];
    }
    expect(won).toBe(true);
  });
});
