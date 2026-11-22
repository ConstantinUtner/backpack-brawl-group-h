import { expect, it } from "vitest";
import { simulateBattle } from "../battle";
import type { Fighter } from "../types";

it("B3: stacks poison, bypasses block, and caps self-healing at max HP", () => {
  const player: Fighter = {
    name: "Hero",
    maxHp: 40,
    items: [
      {
        itemId: "test-poison",
        name: "Test Poison",
        icon: "",
        cooldown: 1,
        effects: { poison: 3 },
      },
    ],
  };

  const opponent: Fighter = {
    name: "Opponent",
    maxHp: 40,
    items: [
      {
        itemId: "test-shield",
        name: "Test Shield",
        icon: "",
        cooldown: 1,
        effects: { block: 5 },
      },
      {
        itemId: "test-heal",
        name: "Test Heal",
        icon: "",
        cooldown: 2,
        effects: { heal: 10 },
      },
    ],
  };

  const result = simulateBattle(player, opponent);

  expect(result.frames[0].opponent).toMatchObject({
    hp: 40,
    poison: 0,
    block: 0,
  });

  expect(result.frames[1].opponent).toMatchObject({
    hp: 37,
    poison: 3,
    block: 5,
  });

  expect(result.frames[2].opponent).toMatchObject({
    hp: 40,
    poison: 6,
    block: 10,
  });

  expect(result.frames[3].opponent).toMatchObject({
    hp: 31,
    poison: 9,
    block: 15,
  });

  expect(result.frames[3].player.hp).toBe(40);

  const healEvent = result.frames[2].events.find(
    (event) => event.kind === "heal",
  );

  expect(healEvent).toMatchObject({
    source: "opponent",
    target: "opponent",
    kind: "heal",
  });
});