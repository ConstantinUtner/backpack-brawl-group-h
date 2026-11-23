import { describe, expect, it } from "vitest";
import { newGame, updateRun } from "./game";
import { buyItem, sellItem, rerollShop, moveBackpackItem } from "./run";
import type { Phase } from "./types";

describe("Shop phase guard [req-1.4]", () => {

  // [req-1.1]: Test buying during the shop phase.
  // Why: Valid purchases must be allowed while shopping.
  // Expected: The GameState changes and the item enters the backpack.
  it("allows buying during shop phase", () => {

    // ARRANGE: newGame() starts in the shop phase.
    const game = newGame(123);

    // Remember the first available shop item.
    const itemId = game.run.shop[0];
    if (!itemId) throw new Error("Expected a shop offer");

    // ACT: Execute the purchase through updateRun().
    const result = updateRun(
      game,
      (run) => buyItem(run, 0)
    );

    // ASSERT: A new GameState must be returned.
    expect(result).not.toBe(game);

    // The item must appear in the backpack.
    expect(result.run.backpack[0]?.itemId).toBe(itemId);

    // The phase must remain shop.
    expect(result.phase).toBe("shop");
  });

  // [req-1.2]: Test selling during the shop phase.
  // Why: Players must be able to sell owned items while shopping.
  // Expected: The item disappears and gold is added.
  it("allows selling during shop phase", () => {

    // ARRANGE: Create a game in the shop phase.
    const game = newGame(123);

    // Put a Pot Lid worth 2 gold into the backpack.
    game.run.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    // ACT: Sell the item through updateRun().
    const result = updateRun(
      game,
      (run) => sellItem(run, 0)
    );

    // ASSERT: Selling must create a new GameState.
    expect(result).not.toBe(game);

    // The item must be removed.
    expect(result.run.backpack[0]).toBe(null);

    // A Pot Lid sells for one gold.
    expect(result.run.gold).toBe(game.run.gold + 1);

    // The phase must stay shop.
    expect(result.phase).toBe("shop");
  });

  // [req-1.3]: Test rerolling during the shop phase.
  // Why: Players must be able to refresh offers while shopping.
  // Expected: One gold is deducted and the shop is rerolled.
  it("allows reroll during shop phase", () => {

    // ARRANGE: Create a game in the shop phase.
    const game = newGame(123);

    // ACT: Execute reroll through updateRun().
    const result = updateRun(
      game,
      (run) => rerollShop(run)
    );

    // ASSERT: The action must create a new GameState.
    expect(result).not.toBe(game);

    // One gold must be deducted.
    expect(result.run.gold).toBe(game.run.gold - 1);

    // The phase must remain shop.
    expect(result.phase).toBe("shop");
  });

  // [req-1.4]: Test all shop actions outside the shop phase.
  // Why: Searching, battle and finished must block every shop action.
  // Expected: Buying, selling and rerolling leave GameState unchanged.
  it.each<Phase>(["searching", "battle", "finished"])(
    "blocks all shop actions during %s phase",
    (phase) => {

      // ARRANGE: Create a game and set the tested phase.
      const game = newGame(123);
      game.phase = phase;

      // Add an item so selling would otherwise be valid.
      game.run.backpack[0] = {
        uid: "item-1",
        itemId: "pot-lid"
      };

      // ACT: Attempt all three actions through updateRun().
      const buyResult = updateRun(
        game,
        (run) => buyItem(run, 0)
      );

      const sellResult = updateRun(
        game,
        (run) => sellItem(run, 0)
      );

      const rerollResult = updateRun(
        game,
        (run) => rerollShop(run)
      );

      // ASSERT: Every action must return the original GameState.
      expect(buyResult).toBe(game);
      expect(sellResult).toBe(game);
      expect(rerollResult).toBe(game);
    }
  );

  // [req-1.4]: Test that updateRun does not execute blocked actions.
  // Why: Invalid phases must stop actions before their logic runs.
  // Expected: The action callback is never called.
  it("does not execute an action outside shop phase", () => {

    // ARRANGE: Create a game in the searching phase.
    const game = newGame(123);
    game.phase = "searching";

    // Track whether the action gets executed.
    let actionCalled = false;

    // ACT: Pass an action to updateRun().
    const result = updateRun(game, (run) => {
      actionCalled = true;
      return buyItem(run, 0);
    });

    // ASSERT: The action must not have been executed.
    expect(actionCalled).toBe(false);

    // The original GameState must be returned.
    expect(result).toBe(game);
  });
});

describe("Backpack phase guard [req-2.3]", () => {

  // [req-2.3]: Test moving an item during the shop phase.
  // Why: Backpack arrangement must work through updateRun().
  // Expected: The item moves, the phase stays "shop" and the original game remains unchanged.
  it("allows moving items during shop phase", () => {

    // ARRANGE: Create a game in the shop phase.
    const game = newGame(123);

    // Place an item in the first backpack slot.
    const item = { uid: "item-1", itemId: "pot-lid" };
    game.run.backpack[0] = item;

    // ACT: Move the item from slot 0 to slot 2 through updateRun().
    const result = updateRun(game, (run) => moveBackpackItem(run, 0, 2));

    // ASSERT: A successful move must create a new GameState.
    expect(result).not.toBe(game);

    // The source slot becomes empty and the target contains the item.
    expect(result.run.backpack[0]).toBe(null);
    expect(result.run.backpack[2]).toEqual(item);

    // Moving an item must not change the game phase.
    expect(result.phase).toBe("shop");

    // The original backpack must remain unchanged.
    expect(game.run.backpack[0]).toEqual(item);
    expect(game.run.backpack[2]).toBe(null);
  });

  // [req-2.3]: Test moving items outside the shop phase.
  // Why: Backpack changes must be blocked during searching, battle and finished.
  // Expected: Every blocked move returns the original GameState unchanged.
  it.each<Phase>(["searching", "battle", "finished"])(
    "blocks backpack moves during %s phase",
    (phase) => {

      // ARRANGE: Create a game and set the phase being tested.
      const game = newGame(123);
      game.phase = phase;

      // Add an item that could otherwise be moved.
      game.run.backpack[0] = {
        uid: "item-1",
        itemId: "pot-lid"
      };

      // ACT: Attempt moving the item outside the shop phase.
      const result = updateRun(game, (run) => moveBackpackItem(run, 0, 2));

      // ASSERT: The original GameState must be returned.
      expect(result).toBe(game);

      // The item must remain in its original slot.
      expect(result.run.backpack[0]?.uid).toBe("item-1");
      expect(result.run.backpack[2]).toBe(null);
    }
  );

  // [req-2.5]: Test that blocked backpack actions are never executed.
  // Why: updateRun() must stop invalid actions before calling moveBackpackItem().
  // Expected: The callback is not called and the GameState remains unchanged.
  it("does not execute backpack moves outside shop phase", () => {

    // ARRANGE: Create a game in the searching phase.
    const game = newGame(123);
    game.phase = "searching";

    // Place an item in the first backpack slot.
    game.run.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    // Track whether the move callback gets executed.
    let actionCalled = false;

    // ACT: Attempt a move through updateRun().
    const result = updateRun(game, (run) => {
      actionCalled = true;
      return moveBackpackItem(run, 0, 2);
    });

    // ASSERT: The phase guard must prevent the callback from running.
    expect(actionCalled).toBe(false);

    // The original GameState must be returned.
    expect(result).toBe(game);

    // The backpack must remain unchanged.
    expect(result.run.backpack[0]?.uid).toBe("item-1");
    expect(result.run.backpack[2]).toBe(null);
  });
});
