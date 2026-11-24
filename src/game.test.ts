import { describe, expect, it } from "vitest";
import { newGame, updateRun, fightBlocker, startSearch, searchFailed, startBattle } from "./game";
import { buyItem, sellItem, rerollShop, moveBackpackItem } from "./run";
import type { Phase, Opponent } from "./types";

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

describe("Matchmaking phase guard [req-5.1]", () => {

  // [req-5.1]: Test starting a valid opponent search.
  // Why: Players with at least one item must be able to search.
  // Expected: The phase changes to searching and the old
  // error is cleared without changing the run.
  it("starts a valid opponent search", () => {

    // ARRANGE: Create a game in the shop phase.
    const game = newGame(123);

    // Add an item so matchmaking is allowed.
    game.run.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    // Simulate an error from a previous search.
    game.error = "Previous search failed";

    // ACT: Start the opponent search.
    const result = startSearch(game);

    // ASSERT: A successful search creates a new GameState.
    expect(result).not.toBe(game);

    // The game must enter the searching phase.
    expect(result.phase).toBe("searching");

    // Previous errors must be cleared.
    expect(result.error).toBe(null);

    // The run must remain unchanged.
    expect(result.run).toBe(game.run);

    // The original GameState must not be mutated.
    expect(game.phase).toBe("shop");
    expect(game.error).toBe("Previous search failed");
  });

  // [req-5.1]: Test matchmaking with an empty backpack.
  // Why: A player must own at least one item before fighting.
  // Expected: The search is rejected and the game stays unchanged.
  it("blocks searching with an empty backpack", () => {

    // ARRANGE: Create a game with an empty backpack.
    const game = newGame(123);

    // ACT: Check the blocker and attempt to start a search.
    const blocker = fightBlocker(game);
    const result = startSearch(game);

    // ASSERT: The player must receive an understandable reason.
    expect(blocker).toBe("Buy at least one item first");

    // The original GameState must be returned.
    expect(result).toBe(game);

    // The player must remain in the shop.
    expect(result.phase).toBe("shop");
  });

  // [req-5.1]: Test starting another search while searching.
  // Why: Only one search may be active at a time.
  // Expected: The second search leaves the GameState unchanged.
  it("blocks a second opponent search", () => {

    // ARRANGE: Create a game with one item.
    const game = newGame(123);

    game.run.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    // Start the first search.
    const searching = startSearch(game);

    // ACT: Attempt to start another search.
    const blocker = fightBlocker(searching);
    const result = startSearch(searching);

    // ASSERT: A running search must have a blocker.
    expect(blocker).toBe("Opponent search already running");

    // The second search must not create a new GameState.
    expect(result).toBe(searching);

    // The first search must remain active.
    expect(result.phase).toBe("searching");
  });

  // [req-5.1]: Test matchmaking outside the shop phase.
  // Why: Players must not search during or after a finished run.
  // Expected: The original GameState remains unchanged.
  it.each<Phase>(["battle", "finished"])(
    "blocks searching during %s phase",
    (phase) => {

      // ARRANGE: Create a game in the tested phase.
      const game = newGame(123);
      game.phase = phase;

      // Add an item so the backpack would otherwise allow searching.
      game.run.backpack[0] = {
        uid: "item-1",
        itemId: "pot-lid"
      };

      // ACT: Attempt to start an opponent search.
      const blocker = fightBlocker(game);
      const result = startSearch(game);

      // ASSERT: The phase must prevent searching.
      expect(blocker).toBe(
        "You can only search during the shop phase"
      );

      // The original GameState must be returned.
      expect(result).toBe(game);

      // The original phase must remain unchanged.
      expect(result.phase).toBe(phase);
    }
  );

  // [req-5.1]: Test recovery from a failed opponent search.
  // Why: API failures must never leave the game stuck.
  // Expected: The player returns to the shop with an error
  // while the run remains unchanged.
  it("returns to the shop after a search failure", () => {

    // ARRANGE: Create a game with one item.
    const game = newGame(123);

    game.run.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    // Start an opponent search.
    const searching = startSearch(game);

    const error = "Opponent API unavailable";

    // ACT: Simulate an API failure.
    const result = searchFailed(searching, error);

    // ASSERT: The failure creates a new GameState.
    expect(result).not.toBe(searching);

    // The player must return to the shop.
    expect(result.phase).toBe("shop");

    // The error message must be stored.
    expect(result.error).toBe(error);

    // The complete run must remain unchanged.
    expect(result.run).toBe(searching.run);

    // No battle must have been started.
    expect(result.battle).toBe(null);

    // The original GameState must not be mutated.
    expect(searching.phase).toBe("searching");
    expect(searching.error).toBe(null);
  });

  // [req-5.1]: Test retrying a failed opponent search.
  // Why: Players must be able to recover from API failures.
  // Expected: A new search starts and the previous error is cleared.
  it("allows retrying after a search failure", () => {

    // ARRANGE: Create a game with one item.
    const game = newGame(123);

    game.run.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    // Start a search and simulate a failure.
    const searching = startSearch(game);

    const failed = searchFailed(
      searching,
      "Opponent API unavailable"
    );

    // ACT: Retry the opponent search.
    const result = startSearch(failed);

    // ASSERT: A new search must be allowed.
    expect(result).not.toBe(failed);
    expect(result.phase).toBe("searching");

    // The previous error must be cleared.
    expect(result.error).toBe(null);

    // Retrying must not change the run.
    expect(result.run).toBe(failed.run);
  });

  // [req-5.1]: Test search failures outside an active search.
  // Why: An unexpected error must not interrupt another game phase.
  // Expected: The original GameState remains unchanged.
  it.each<Phase>(["shop", "battle", "finished"])(
    "ignores search failures during %s phase",
    (phase) => {

      // ARRANGE: Create a game in the tested phase.
      const game = newGame(123);
      game.phase = phase;

      // ACT: Simulate an unexpected search failure.
      const result = searchFailed(
        game,
        "Unexpected API error"
      );

      // ASSERT: The error must be ignored.
      expect(result).toBe(game);

      // Neither the phase nor the error must change.
      expect(result.phase).toBe(phase);
      expect(result.error).toBe(null);
    }
  );

  // [req-5.1]: Test starting a battle during matchmaking.
  // Why: A successful search must transition into a battle.
  // Expected: The battle starts at frame zero and the run
  // remains unchanged until the replay finishes.
  it("starts a battle during the searching phase", () => {

    // ARRANGE: Create a game with one item.
    const game = newGame(123);

    game.run.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    // Start an opponent search.
    const searching = startSearch(game);

    // Create a deterministic opponent for the test.
    const opponent: Opponent = {
      id: "test-opponent",
      name: "Test Opponent",
      icon: "",
      hp: 40,
      round: game.run.round,
      items: ["pot-lid"]
    };

    // ACT: Start the battle with the received opponent.
    const result = startBattle(searching, opponent);

    // ASSERT: A successful response creates a new GameState.
    expect(result).not.toBe(searching);

    // The game must enter the battle phase.
    expect(result.phase).toBe("battle");

    // The battle must contain the received opponent.
    expect(result.battle?.opponent).toEqual(opponent);

    // The replay must start at the first frame.
    expect(result.battle?.frame).toBe(0);

    // The run must not be scored yet.
    expect(result.run).toBe(searching.run);

    // The original GameState must remain unchanged.
    expect(searching.phase).toBe("searching");
    expect(searching.battle).toBe(null);
  });

  // [req-5.1]: Test battle creation outside matchmaking.
  // Why: Unexpected responses must not start a battle
  // outside an active search.
  // Expected: The original GameState remains unchanged.
  it.each<Phase>(["shop", "battle", "finished"])(
    "blocks battle creation during %s phase",
    (phase) => {

      // ARRANGE: Create a game in the tested phase.
      const game = newGame(123);
      game.phase = phase;

      game.run.backpack[0] = {
        uid: "item-1",
        itemId: "pot-lid"
      };

      // Create an opponent that could otherwise be used.
      const opponent: Opponent = {
        id: "test-opponent",
        name: "Test Opponent",
        icon: "",
        hp: 40,
        round: game.run.round,
        items: ["pot-lid"]
      };

      // ACT: Attempt to start a battle.
      const result = startBattle(game, opponent);

      // ASSERT: The invalid transition must be rejected.
      expect(result).toBe(game);

      // The phase must remain unchanged.
      expect(result.phase).toBe(phase);
    }
  );
});
