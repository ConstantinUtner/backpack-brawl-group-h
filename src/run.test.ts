import { describe, expect, it } from "vitest";
import { getItem } from "./items";
import {
  newRun,
  buyBlocker,
  buyItem,
  sellBlocker,
  sellItem,
  rerollBlocker,
  rerollShop,
  REROLL_COST
} from "./run";
import { rollShop, SHOP_SIZE } from "./shop";

describe("Buying items [req-1.1]", () => {

  // [req-1.1]: Test a successful purchase.
  // Why: Buying must update gold, shop, backpack and nextUid together.
  // Expected: All purchase changes are correct and the original state
  // remains unchanged.
  it("completes a valid purchase fully", () => {

    // ARRANGE: Create a new run with a fixed seed.
    const state = newRun(123);

    // Read the first shop offer and check that it exists.
    const itemId = state.shop[0];
    if (!itemId) throw new Error("Expected a shop offer");

    // Look up the price of the selected item.
    const price = getItem(itemId).price;

    // ACT: Buy the first shop offer.
    const result = buyItem(state, 0);

    // ASSERT: A successful purchase creates a new state.
    expect(result).not.toBe(state);

    // The item price must be deducted from the player's gold.
    expect(result.gold).toBe(state.gold - price);

    // The purchased offer must be marked as sold.
    expect(result.shop[0]).toBe(null);

    // The item must appear in the first free backpack slot.
    expect(result.backpack[0]).toEqual({
      uid: `item-${state.nextUid}`,
      itemId
    });

    // The UID counter must increase by one.
    expect(result.nextUid).toBe(state.nextUid + 1);

    // The original state must not be mutated.
    expect(state.gold).toBe(10);
    expect(state.shop[0]).toBe(itemId);
    expect(state.backpack[0]).toBe(null);
    expect(state.nextUid).toBe(1);
  });

  // [req-1.1]: Test buying without enough gold.
  // Why: The player must never spend gold they do not have.
  // Expected: The purchase is blocked and the entire state stays unchanged.
  it("rejects buying without enough gold", () => {

    // ARRANGE: Create a run and remove all available gold.
    const state = newRun(123);
    state.gold = 0;

    // The blocker should explain why buying is not allowed.
    expect(buyBlocker(state, 0)).toBe("Not enough gold");

    // ACT: Attempt to buy the first item.
    const result = buyItem(state, 0);

    // ASSERT: The original state must be returned.
    expect(result).toBe(state);

    // Gold must never become negative.
    expect(result.gold).toBeGreaterThanOrEqual(0);
  });

  // [req-1.1]: Test buying when all backpack slots are occupied.
  // Why: An item must never be paid for without entering the backpack.
  // Expected: The complete RunState remains unchanged.
  it("rejects buying when backpack is full", () => {

    // ARRANGE: Create a new run.
    const state = newRun(123);

    // Fill all six slots with uniquely identified test items.
    state.backpack = state.backpack.map((_, index) => ({
      uid: `item-${index + 1}`,
      itemId: "pot-lid"
    }));

    // Give the player enough gold to isolate the backpack rule.
    state.gold = 100;
    state.nextUid = 7;

    // Verify that the blocker recognizes the full backpack.
    expect(buyBlocker(state, 0)).toBe("Backpack is full");

    // ACT: Try to purchase another item.
    const result = buyItem(state, 0);

    // ASSERT: No purchase may take place.
    expect(result).toBe(state);
  });

  // [req-1.1]: Test buying an offer that was already purchased.
  // Why: The same shop position must not be purchased twice.
  // Expected: No additional item is created and the state stays unchanged.
  it("rejects an already sold offer", () => {

    // ARRANGE: Mark the first shop offer as sold.
    const state = newRun(123);
    state.shop[0] = null;

    // Verify that the blocker recognizes the sold offer.
    expect(buyBlocker(state, 0)).toBe("Already sold");

    // ACT: Attempt to purchase the sold offer again.
    const result = buyItem(state, 0);

    // ASSERT: The attempted purchase must change nothing.
    expect(result).toBe(state);
  });

  // [req-1.1]: Test indices outside the valid shop range.
  // Why: Invalid array positions must never create items.
  // Expected: Every invalid index is rejected without changing the state.
  it("rejects invalid shop indices", () => {

    // ARRANGE: Create a run with four shop offers.
    const state = newRun(123);

    // Test a negative, oversized and non-integer index.
    const invalidIndices = [-1, 4, 1.5];

    for (const index of invalidIndices) {

      // The blocker should report an invalid shop position.
      expect(buyBlocker(state, index)).toBe("Invalid shop offer");

      // ACT: Attempt to purchase at the invalid index.
      const result = buyItem(state, index);

      // ASSERT: The original state must be returned.
      expect(result).toBe(state);
    }
  });

  // [req-1.1]: Test buying when only one backpack slot is free.
  // Why: A nearly full backpack must still allow a valid purchase.
  // Expected: The item is placed in the last slot without overwriting others.
  it("buys into the last free backpack slot", () => {

    // ARRANGE: Fill the first five backpack slots.
    const state = newRun(123);

    state.backpack = state.backpack.map((_, index) =>
      index === 5
        ? null
        : { uid: `item-${index + 1}`, itemId: "pot-lid" }
    );

    state.nextUid = 6;
    state.gold = 100;

    // Remember the item offered in the first shop position.
    const itemId = state.shop[0];
    if (!itemId) throw new Error("Expected a shop offer");

    // ACT: Purchase the item.
    const result = buyItem(state, 0);

    // ASSERT: The new item must occupy the last free slot.
    expect(result.backpack[5]).toEqual({
      uid: "item-6",
      itemId
    });

    // Previously occupied slots must remain unchanged.
    expect(result.backpack.slice(0, 5)).toEqual(
      state.backpack.slice(0, 5)
    );

    // The purchase must deduct gold and advance the UID counter.
    expect(result.gold).toBe(100 - getItem(itemId).price);
    expect(result.nextUid).toBe(7);

    // The shop position must be marked as sold.
    expect(result.shop[0]).toBe(null);

    // The original backpack must remain unchanged.
    expect(state.backpack[5]).toBe(null);
  });

  // [req-1.1]: Test buying two items without selling between purchases.
  // Why: Every purchased item must be stored with its own unique UID.
  // Expected: Both items remain in separate slots with different UIDs.
  it("stores consecutive purchases with unique UIDs", () => {
    // ARRANGE: Create a new run with enough gold.
    const state = newRun(123);
    state.gold = 100;

    // Remember the first two shop offers.
    const firstItemId = state.shop[0];
    const secondItemId = state.shop[1];

    // Verify that both offers exist.
    if (!firstItemId || !secondItemId) {
      throw new Error("Expected two shop offers");
    }

    // ACT 1: Buy the first shop offer.
    const afterFirstBuy = buyItem(state, 0);

    // ACT 2: Buy the second shop offer.
    const afterSecondBuy = buyItem(afterFirstBuy, 1);

    // ASSERT: Both items must exist in separate slots.
    expect(afterSecondBuy.backpack[0]).toEqual({
      uid: "item-1",
      itemId: firstItemId
    });

    expect(afterSecondBuy.backpack[1]).toEqual({
      uid: "item-2",
      itemId: secondItemId
    });

    // The two item instances must have different UIDs.
    expect(afterSecondBuy.backpack[0]?.uid)
      .not.toBe(afterSecondBuy.backpack[1]?.uid);

    // Both purchased offers must be marked as sold.
    expect(afterSecondBuy.shop[0]).toBe(null);
    expect(afterSecondBuy.shop[1]).toBe(null);

    // The UID counter must advance after both purchases.
    expect(afterSecondBuy.nextUid).toBe(3);

    // The gold must decrease by both item prices.
    expect(afterSecondBuy.gold).toBe(
      100 -
      getItem(firstItemId).price -
      getItem(secondItemId).price
    );

    // The original backpack must remain empty.
    expect(state.backpack.every((slot) => slot === null))
      .toBe(true);
  });

  // [req-1.1]: Test buying with exactly the required amount of gold.
  // Why: A purchase must be allowed when gold equals the item price.
  // Expected: The purchase succeeds and the remaining gold is zero.
  it("allows buying with exactly enough gold", () => {
    // ARRANGE: Create a new run.
    const state = newRun(123);

    // Read the first available shop item.
    const itemId = state.shop[0];
    if (!itemId) throw new Error("Expected a shop offer");

    // Set gold to exactly the item's purchase price.
    const price = getItem(itemId).price;
    state.gold = price;

    // Verify that the blocker allows buying.
    expect(buyBlocker(state, 0)).toBe(null);

    // ACT: Buy the item.
    const result = buyItem(state, 0);

    // ASSERT: The purchase must succeed.
    expect(result).not.toBe(state);

    // All available gold must be spent.
    expect(result.gold).toBe(0);

    // The purchased item must appear in the backpack.
    expect(result.backpack[0]?.itemId).toBe(itemId);

    // The shop offer must be marked as sold.
    expect(result.shop[0]).toBe(null);

    // The UID counter must advance.
    expect(result.nextUid).toBe(state.nextUid + 1);
  });
});

describe("Selling items [req-1.2]", () => {

  // [req-1.2]: Test selling an item with an odd purchase price.
  // Why: Half the original price must always be rounded down.
  // Expected: A 3-gold item sells for 1 gold.
  it("sells an item for half its price rounded down", () => {

    // ARRANGE: Create a run with 5 gold.
    const state = newRun(123);
    state.gold = 5;

    // Put an Oak Buckler worth 3 gold into the first slot.
    state.backpack[0] = {
      uid: "item-1",
      itemId: "oak-buckler"
    };

    // ACT: Sell the item from slot 0.
    const result = sellItem(state, 0);

    // ASSERT: Half of 3 rounded down is 1.
    expect(result.gold).toBe(6);

    // The sold item must be removed.
    expect(result.backpack[0]).toBe(null);

    // A successful sale must create a new state.
    expect(result).not.toBe(state);

    // The original item and gold must remain unchanged.
    expect(state.gold).toBe(5);
    expect(state.backpack[0]).toEqual({
      uid: "item-1",
      itemId: "oak-buckler"
    });
  });

  // [req-1.2]: Test selling an item with an even purchase price.
  // Why: Prices must also be correct when no rounding is required.
  // Expected: A 4-gold item sells for exactly 2 gold.
  it("sells an even-priced item correctly", () => {

    // ARRANGE: Put a Hunting Bow worth 4 gold into the backpack.
    const state = newRun(123);
    state.gold = 5;

    state.backpack[0] = {
      uid: "item-1",
      itemId: "hunting-bow"
    };

    // ACT: Sell the Hunting Bow.
    const result = sellItem(state, 0);

    // ASSERT: Half of 4 equals 2.
    expect(result.gold).toBe(7);
    expect(result.backpack[0]).toBe(null);
  });

  // [req-1.2]: Test selling an empty backpack slot.
  // Why: The player must never receive gold without selling an item.
  // Expected: The sale is rejected and the entire state stays unchanged.
  it("rejects selling an empty slot", () => {

    // ARRANGE: A new run starts with an empty backpack.
    const state = newRun(123);

    // Verify that the blocker identifies the problem.
    expect(sellBlocker(state, 0)).toBe("Empty backpack slot");

    // ACT: Attempt to sell from slot 0.
    const result = sellItem(state, 0);

    // ASSERT: Nothing may change.
    expect(result).toBe(state);
  });

  // [req-1.2]: Test invalid backpack positions.
  // Why: Only the six existing backpack slots may be accessed.
  // Expected: Invalid indices never change the RunState.
  it("rejects invalid backpack indices", () => {

    // ARRANGE: Create a new run.
    const state = newRun(123);

    // Test a negative, oversized and fractional index.
    const invalidIndices = [-1, 6, 1.5];

    for (const index of invalidIndices) {

      // The blocker must identify the invalid position.
      expect(sellBlocker(state, index)).toBe("Invalid backpack slot");

      // ACT: Attempt to sell using this index.
      const result = sellItem(state, index);

      // ASSERT: The sale must not change the state.
      expect(result).toBe(state);
    }
  });

  // [req-1.2]: Test selling one of two identical item types.
  // Why: Selling must remove only the selected item instance.
  // Expected: The other item and the nextUid counter remain unchanged.
  it("removes only the selected item instance", () => {

    // ARRANGE: Add two Pot Lids with different UIDs.
    const state = newRun(123);

    state.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    state.backpack[1] = {
      uid: "item-2",
      itemId: "pot-lid"
    };

    // The next new item must receive UID item-3.
    state.nextUid = 3;

    // Remember the current shop and seed.
    const originalShop = [...state.shop];
    const originalSeed = state.seed;

    // ACT: Sell only the item in slot 0.
    const result = sellItem(state, 0);

    // ASSERT: Slot 0 becomes empty.
    expect(result.backpack[0]).toBe(null);

    // The second Pot Lid must still exist with the same UID.
    expect(result.backpack[1]).toEqual({
      uid: "item-2",
      itemId: "pot-lid"
    });

    // Selling must not change the next available UID.
    expect(result.nextUid).toBe(3);

    // Selling must not reroll the shop.
    expect(result.shop).toEqual(originalShop);
    expect(result.seed).toBe(originalSeed);

    // A Pot Lid costs 2 gold and sells for 1.
    expect(result.gold).toBe(state.gold + 1);
  });

  // [req-1.2]: Test selling the same backpack slot twice.
  // Why: The player must not receive gold multiple times for one item.
  // Expected: The first sale succeeds and the second sale changes nothing.
  it("prevents selling the same item twice", () => {
    // ARRANGE: Create a run containing one Pot Lid.
    const state = newRun(123);
    state.gold = 5;

    state.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    state.nextUid = 2;

    // ACT 1: Sell the item from slot 0.
    const afterFirstSell = sellItem(state, 0);

    // ASSERT 1: The first sale must add one gold.
    expect(afterFirstSell.gold).toBe(6);

    // The item must be removed from the backpack.
    expect(afterFirstSell.backpack[0]).toBe(null);

    // The blocker must now identify the empty slot.
    expect(sellBlocker(afterFirstSell, 0))
      .toBe("Empty backpack slot");

    // ACT 2: Try to sell the same slot again.
    const afterSecondSell = sellItem(afterFirstSell, 0);

    // ASSERT 2: The second sale must be rejected completely.
    expect(afterSecondSell).toBe(afterFirstSell);

    // No additional gold may be added.
    expect(afterSecondSell.gold).toBe(6);

    // The UID counter must remain unchanged.
    expect(afterSecondSell.nextUid).toBe(2);
  });
});

describe("Shop reroll [req-1.3]", () => {

  // [req-1.3]: Test a successful shop reroll.
  // Why: A reroll must cost exactly one gold and replace all four offers.
  // Expected: Gold, shop and seed are updated together.
  it("rerolls all offers for one gold", () => {

    // ARRANGE: Create a new run with a fixed seed.
    const state = newRun(123);

    // Calculate the expected roll using the same current seed.
    const expectedRoll = rollShop(state.seed);

    // ACT: Reroll the shop.
    const result = rerollShop(state);

    // ASSERT: One gold must be deducted.
    expect(result.gold).toBe(state.gold - REROLL_COST);

    // The shop must contain exactly four offers.
    expect(result.shop).toHaveLength(SHOP_SIZE);

    // The offers must match the deterministic roll.
    expect(result.shop).toEqual(expectedRoll.offers);

    // The returned seed must be stored for the next roll.
    expect(result.seed).toBe(expectedRoll.seed);

    // A successful reroll must create a new state.
    expect(result).not.toBe(state);

    // The original run must not be mutated.
    expect(state.gold).toBe(10);
  });

  // [req-1.3]: Test rerolling with exactly one gold.
  // Why: One gold must be sufficient for a valid reroll.
  // Expected: The reroll succeeds and the player has zero gold.
  it("allows rerolling with exactly one gold", () => {

    // ARRANGE: Give the player exactly one gold.
    const state = newRun(123);
    state.gold = 1;

    // ACT: Reroll the shop.
    const result = rerollShop(state);

    // ASSERT: The reroll must succeed.
    expect(result).not.toBe(state);

    // The gold balance must become exactly zero.
    expect(result.gold).toBe(0);

    // Four new offers must be available.
    expect(result.shop).toHaveLength(4);
  });

  // [req-1.3]: Test rerolling with zero gold.
  // Why: The player must not be able to reroll for free.
  // Expected: Gold, offers and seed remain completely unchanged.
  it("rejects rerolling without gold", () => {

    // ARRANGE: Create a run with zero gold.
    const state = newRun(123);
    state.gold = 0;

    // Verify the blocker message.
    expect(rerollBlocker(state)).toBe("Not enough gold");

    // ACT: Attempt to reroll.
    const result = rerollShop(state);

    // ASSERT: The entire original state must be returned.
    expect(result).toBe(state);
  });

  // [req-1.3]: Test rerolling after a shop offer was purchased.
  // Why: Reroll must replace even previously sold shop positions.
  // Expected: All four positions contain available offers again.
  it("replaces previously sold offers", () => {

    // ARRANGE: Mark two shop positions as sold.
    const state = newRun(123);
    state.shop[0] = null;
    state.shop[2] = null;

    // ACT: Reroll the shop.
    const result = rerollShop(state);

    // ASSERT: Four positions must exist.
    expect(result.shop).toHaveLength(4);

    // Every position must now contain an item ID.
    expect(result.shop.every((itemId) => itemId !== null)).toBe(true);
  });

  // [req-1.3]: Test that rerolling does not affect owned items.
  // Why: A shop reroll must never remove or duplicate backpack items.
  // Expected: Backpack, nextUid and round remain unchanged.
  it("preserves backpack and UID counter", () => {

    // ARRANGE: Create a run containing one owned item.
    const state = newRun(123);

    state.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    state.nextUid = 2;

    // Remember the original backpack.
    const originalBackpack = [...state.backpack];

    // ACT: Reroll the shop.
    const result = rerollShop(state);

    // ASSERT: Owned items must remain unchanged.
    expect(result.backpack).toEqual(originalBackpack);

    // No new ItemInstance was created.
    expect(result.nextUid).toBe(2);

    // The reroll must not advance the round.
    expect(result.round).toBe(state.round);
  });

  // [req-1.3]: Test two consecutive rerolls.
  // Why: Each reroll must use the seed produced by the previous one.
  // Expected: Two rerolls cost two gold and follow the correct seed sequence.
  it("uses the updated seed for consecutive rerolls", () => {

    // ARRANGE: Create a new run with 10 gold.
    const state = newRun(123);

    // Calculate the two expected rolls in sequence.
    const firstExpected = rollShop(state.seed);
    const secondExpected = rollShop(firstExpected.seed);

    // ACT: Perform the first reroll.
    const firstResult = rerollShop(state);

    // Perform the second reroll using the updated run.
    const secondResult = rerollShop(firstResult);

    // ASSERT: Each reroll must use the correct offers and seed.
    expect(firstResult.shop).toEqual(firstExpected.offers);
    expect(firstResult.seed).toBe(firstExpected.seed);

    expect(secondResult.shop).toEqual(secondExpected.offers);
    expect(secondResult.seed).toBe(secondExpected.seed);

    // Two rerolls must cost exactly two gold.
    expect(secondResult.gold).toBe(state.gold - 2);
  });

  // [req-1.3]: Test rerolling with a completely full backpack.
  // Why: Rerolling does not require free backpack space.
  // Expected: The reroll succeeds without modifying owned items.
  it("allows reroll with a full backpack", () => {
    // ARRANGE: Create a new run with sufficient gold.
    const state = newRun(123);
    state.gold = 10;

    // Fill all six backpack slots with unique item instances.
    state.backpack = state.backpack.map((_, index) => ({
      uid: `item-${index + 1}`,
      itemId: "pot-lid"
    }));

    // The next available UID must be 7.
    state.nextUid = 7;

    // Remember the original backpack contents.
    const originalBackpack = [...state.backpack];

    // ACT: Reroll the shop despite the full backpack.
    const result = rerollShop(state);

    // ASSERT: The reroll must succeed and create a new state.
    expect(result).not.toBe(state);

    // One gold must be deducted.
    expect(result.gold).toBe(9);

    // Four shop offers must be available.
    expect(result.shop).toHaveLength(4);

    // No owned item may be removed or changed.
    expect(result.backpack).toEqual(originalBackpack);

    // The UID counter must remain unchanged.
    expect(result.nextUid).toBe(7);
  });
});

describe("Shop economy integration [req-1.5]", () => {

  // [req-1.5]: Test buying, selling and rerolling in sequence.
  // Why: Combined shop actions must preserve valid gold and item state.
  // Expected: Each action changes only the intended values.
  it("keeps the run consistent across shop actions", () => {

    // ARRANGE: Create a new run with 10 gold.
    const start = newRun(123);

    // Read the item offered in the first shop position.
    const itemId = start.shop[0];
    if (!itemId) throw new Error("Expected a shop offer");

    // Look up its original purchase price.
    const price = getItem(itemId).price;

    // ACT 1: Buy the item.
    const afterBuy = buyItem(start, 0);

    // ASSERT 1: The item must be stored in the backpack.
    expect(afterBuy.backpack[0]).toEqual({
      uid: "item-1",
      itemId
    });

    // The purchase must deduct the correct price.
    expect(afterBuy.gold).toBe(10 - price);

    // ACT 2: Sell the same item.
    const afterSell = sellItem(afterBuy, 0);

    // ASSERT 2: The item must be removed.
    expect(afterSell.backpack[0]).toBe(null);

    // The sale must return half the price, rounded down.
    expect(afterSell.gold).toBe(
      10 - price + Math.floor(price / 2)
    );

    // The UID counter must not decrease after selling.
    expect(afterSell.nextUid).toBe(2);

    // ACT 3: Reroll the shop.
    const afterReroll = rerollShop(afterSell);

    // ASSERT 3: Reroll must deduct one additional gold.
    expect(afterReroll.gold).toBe(afterSell.gold - 1);

    // The shop must contain four available offers.
    expect(afterReroll.shop).toHaveLength(4);

    // The backpack must remain empty after the reroll.
    expect(afterReroll.backpack.every((slot) => slot === null)).toBe(true);

    // Gold must never become negative.
    expect(afterReroll.gold).toBeGreaterThanOrEqual(0);
  });

  // [req-1.5]: Test buying again after selling an item.
  // Why: A sold item's UID must never be reused for a new purchase.
  // Expected: The second purchased item receives the next unique UID.
  it("does not reuse item UIDs after selling", () => {

    // ARRANGE: Create a run with enough gold for two purchases.
    const state = newRun(123);
    state.gold = 100;

    // ACT 1: Buy the first shop offer.
    const afterFirstBuy = buyItem(state, 0);

    // ASSERT 1: The first item receives UID item-1.
    expect(afterFirstBuy.backpack[0]?.uid).toBe("item-1");
    expect(afterFirstBuy.nextUid).toBe(2);

    // ACT 2: Sell the first item.
    const afterSell = sellItem(afterFirstBuy, 0);

    // ASSERT 2: The UID counter must remain at 2.
    expect(afterSell.backpack[0]).toBe(null);
    expect(afterSell.nextUid).toBe(2);

    // ACT 3: Buy another available shop offer.
    const afterSecondBuy = buyItem(afterSell, 1);

    // ASSERT 3: The new item must receive UID item-2.
    expect(afterSecondBuy.backpack[0]?.uid).toBe("item-2");
    expect(afterSecondBuy.nextUid).toBe(3);

    // The first item's UID must not be reused.
    expect(afterSecondBuy.backpack[0]?.uid).not.toBe("item-1");
  });

  // [req-1.5]: Test that successful shop actions only change intended values.
  // Why: Buying, selling and rerolling must not modify unrelated run data.
  // Expected: Round, lives and wins stay unchanged after every action.
  it("preserves unrelated run properties", () => {
    // ARRANGE: Create a new run with enough gold.
    const state = newRun(123);
    state.gold = 100;

    // Remember the original values that must not change.
    const originalRound = state.round;
    const originalLives = state.lives;
    const originalWins = state.wins;

    // ACT 1: Buy the first available shop item.
    const afterBuy = buyItem(state, 0);

    // ASSERT 1: Buying must not change round, lives or wins.
    expect(afterBuy.round).toBe(originalRound);
    expect(afterBuy.lives).toBe(originalLives);
    expect(afterBuy.wins).toBe(originalWins);

    // Buying must not change the random seed.
    expect(afterBuy.seed).toBe(state.seed);

    // ACT 2: Sell the purchased item.
    const afterSell = sellItem(afterBuy, 0);

    // ASSERT 2: Selling must preserve unrelated run properties.
    expect(afterSell.round).toBe(originalRound);
    expect(afterSell.lives).toBe(originalLives);
    expect(afterSell.wins).toBe(originalWins);

    // Selling must not change the shop or seed.
    expect(afterSell.shop).toEqual(afterBuy.shop);
    expect(afterSell.seed).toBe(afterBuy.seed);

    // ACT 3: Reroll the shop.
    const afterReroll = rerollShop(afterSell);

    // ASSERT 3: Reroll must not change progress or owned items.
    expect(afterReroll.round).toBe(originalRound);
    expect(afterReroll.lives).toBe(originalLives);
    expect(afterReroll.wins).toBe(originalWins);

    // Reroll must preserve the backpack and UID counter.
    expect(afterReroll.backpack).toEqual(afterSell.backpack);
    expect(afterReroll.nextUid).toBe(afterSell.nextUid);
  });
});
