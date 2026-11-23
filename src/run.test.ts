import { describe, expect, it } from "vitest";
import { newRun, rerollShop, sellBlocker, sellItem } from "./run";

describe("Selling items", () => {
  it("sells an item for half its price, rounded down", () => {
    const state = newRun(123);
    state.gold = 5;
    state.backpack[0] = { uid: "item-1", itemId: "oak-buckler" };

    const result = sellItem(state, 0);

    // [req-1.2]: A 3-gold item sells for 1 gold.
    expect(result.gold).toBe(6);
    expect(result.backpack[0]).toBeNull();
  });

  it("does not sell an empty slot", () => {
    const state = newRun(123);

    // [req-1.2]: Invalid sales return the original state.
    expect(sellBlocker(state, 0)).toBe("Empty backpack slot");
    expect(sellItem(state, 0)).toBe(state);
  });

  it("only removes the selected item instance", () => {
    const state = newRun(123);
    state.backpack[0] = { uid: "item-1", itemId: "pot-lid" };
    state.backpack[1] = { uid: "item-2", itemId: "pot-lid" };

    const result = sellItem(state, 0);

    // [req-1.2]: Only slot 0 is emptied.
    expect(result.backpack[0]).toBeNull();
    expect(result.backpack[1]).toEqual({ uid: "item-2", itemId: "pot-lid" });
  });
});

// [req-1.3]: Verify that a reroll costs one gold.
// Expected: Four offers are generated and the seed advances.
it("rerolls the shop for one gold", () => {
  const state = newRun(123);

  const result = rerollShop(state);

  expect(result.gold).toBe(state.gold - 1);
  expect(result.shop).toHaveLength(4);
  expect(result.seed).not.toBe(state.seed);
});

// [req-1.3]: Verify that rerolling without gold is rejected.
// Expected: The original RunState is returned unchanged.
it("does not reroll without enough gold", () => {
  const state = newRun(123);
  state.gold = 0;

  const result = rerollShop(state);

  expect(result).toBe(state);
});
