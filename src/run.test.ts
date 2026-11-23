import { describe, expect, it } from "vitest";
import { newRun, sellBlocker, sellItem } from "./run";

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
