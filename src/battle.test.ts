import { describe, expect, it } from "vitest";
import { buildFighter, simulateBattle } from "./battle";
import type { Fighter, ItemEffects } from "./types";
 
function fighterWithEffect(
  itemId: string,
  effects: ItemEffects,
  cooldown = 1,
): Fighter {
  const fighter = buildFighter([itemId], 100);
 
  fighter.items[0].effects = effects;
  fighter.items[0].cooldown = cooldown;
 
  return fighter;
}

it("starts with full HP and no block or status stacks", () => {
    const player = buildFighter([], 40);
    const opponent = buildFighter([], 60);
  
    const { frames } = simulateBattle(player, opponent);
  
    expect(frames[0]).toMatchObject({
      tick: 0,
      player: {
        hp: 40,
        maxHp: 40,
        block: 0,
        poison: 0,
        burn: 0,
      },
      opponent: {
        hp: 60,
        maxHp: 60,
        block: 0,
        poison: 0,
        burn: 0,
      },
      events: [],
    });
  });

  it("heals missing HP without exceeding max HP and emits a heal event", () => {
    const player = fighterWithEffect("chipped-dagger", { damage: 3 });
    const opponent = fighterWithEffect("small-potion", { heal: 10 }, 2);

    const { frames } = simulateBattle(player, opponent);

    expect(frames[1].opponent.hp).toBe(97);
    expect(frames[2].opponent.hp).toBe(100);
    expect(frames[3].opponent.hp).toBe(97);
    expect(frames[4].opponent.hp).toBe(100);

    expect(frames[2].events).toContainEqual(
      expect.objectContaining({
        source: "opponent",
        target: "opponent",
        kind: "heal",
        itemId: "small-potion",
      }),
    );

    for (const frame of frames) {
      expect(frame.opponent.hp).toBeLessThanOrEqual(
        frame.opponent.maxHp,
      );
    }
  });

describe("battle status effects", () => {
  it("stacks poison and deals damage every 4 ticks, ignoring block", () => {
    const player = fighterWithEffect("poison-dagger", { poison: 3 });
    const opponent = fighterWithEffect("oak-buckler", { block: 5 });
 
    const { frames } = simulateBattle(player, opponent);
 
    expect(frames[1].opponent).toMatchObject({
      hp: 100,
      poison: 3,
      block: 5,
    });
 
    expect(frames[3].opponent).toMatchObject({
      hp: 100,
      poison: 9,
      block: 15,
    });
 
    expect(frames[4].opponent).toMatchObject({
      hp: 88,
      poison: 12,
      block: 20,
    });
 
    expect(frames[4].events).toContainEqual(
      expect.objectContaining({
        kind: "poison",
        source: "player",
        target: "opponent",
        amount: 12,
      }),
    );
  });
 
  it("stacks burn, damages every 2 ticks, and decays every tick", () => {
    const player = fighterWithEffect("fire-dagger", { burn: 3 });
    const opponent = buildFighter([], 100);
 
    const { frames } = simulateBattle(player, opponent);
 
    expect(frames[1].opponent).toMatchObject({
      hp: 100,
      burn: 2,
    });
 
    expect(frames[2].opponent).toMatchObject({
      hp: 95,
      burn: 4,
    });
 
    expect(frames[3].opponent).toMatchObject({
      hp: 95,
      burn: 6,
    });
 
    expect(frames[4].opponent).toMatchObject({
      hp: 86,
      burn: 8,
    });
  });
 
  it("absorbs burn damage with block before reducing HP", () => {
    const player = fighterWithEffect("fire-dagger", { burn: 3 });
    const opponent = fighterWithEffect("oak-buckler", { block: 2 });
 
    const { frames } = simulateBattle(player, opponent);
 
    expect(frames[2].opponent).toMatchObject({
      hp: 99,
      block: 0,
      burn: 4,
    });
 
    expect(frames[2].events).toContainEqual(
      expect.objectContaining({
        kind: "burn",
        source: "player",
        target: "opponent",
        amount: 1,
        message: "Fighter takes 1 burn damage (4 fire damage blocked)",
      }),
    );
  });
 
  it("lets burn wear off between item activations", () => {
    const player = fighterWithEffect("fire-dagger", { burn: 3 }, 6);
    const opponent = buildFighter([], 100);
 
    const { frames } = simulateBattle(player, opponent);
 
    expect(frames[6].opponent).toMatchObject({
      hp: 97,
      burn: 2,
    });
 
    expect(frames[7].opponent.burn).toBe(1);
 
    expect(frames[8].opponent).toMatchObject({
      hp: 96,
      burn: 0,
    });
 
    expect(frames[10].opponent).toMatchObject({
      hp: 96,
      burn: 0,
    });
  });
 
  it("adds one extra burn per activation when the Fire set is active", () => {
    const player = buildFighter(["fire-dagger", "fire-bow"], 100);
    const opponent = buildFighter([], 100);
 
    for (const item of player.items) {
      item.cooldown = 1;
      item.effects = { burn: 3 };
    }
 
    const { frames } = simulateBattle(player, opponent);
 
    expect(frames[1].opponent.burn).toBe(7);
 
    expect(frames[1].events.filter((event) => event.kind === "burn"))
      .toHaveLength(2);
 
    for (const event of frames[1].events) {
      expect(event.amount).toBe(4);
    }
  });
 
  it("caps periodic poison and burn damage at remaining HP", () => {
    for (const effects of [{ poison: 50 }, { burn: 50 }]) {
      const player = fighterWithEffect("poison-dagger", effects);
      const opponent = buildFighter([], 5);
 
      const result = simulateBattle(player, opponent);
      const lastFrame = result.frames[result.frames.length - 1];
 
      const damageEvent = result.events.find(
        (event) =>
          event.itemId === undefined &&
          event.target === "opponent",
      );
 
      expect(result.winner).toBe("player");
      expect(result.reason).toBe("knockout");
      expect(lastFrame.opponent.hp).toBe(0);
      expect(damageEvent?.amount).toBe(5);
    }
  });
 
  it("produces the same result for identical fighters", () => {
    const player = buildFighter(["fire-dagger", "fire-bow"], 100);
    const opponent = buildFighter(["poison-dagger", "oak-buckler"], 100);
 
    expect(simulateBattle(player, opponent)).toEqual(
      simulateBattle(player, opponent),
    );
  });

});