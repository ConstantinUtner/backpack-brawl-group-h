import { describe, expect, it } from "vitest";
import {
  advanceReplay,
  fightBlocker,
  isReplayDone,
  leaveBattle,
  newGame,
  searchFailed,
  showFrame,
  skipReplay,
  startBattle,
  startSearch,
  updateRun,
} from "./game";
import { buyItem, sellItem, rerollShop, moveBackpackItem, GOLD_PER_ROUND } from "./run";
import type { ActiveSearch, Phase, Opponent } from "./types";

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
  // Expected: The phase changes to searching, the search is stored
  // and the old error is cleared without changing the run.
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

    // [req-5.2]: Create a deterministic search identity.
    const search: ActiveSearch = {
      searchId: "search-1",
      round: game.run.round
    };

    // ACT: Start the opponent search.
    const result = startSearch(game, search);

    // ASSERT: A successful search creates a new GameState.
    expect(result).not.toBe(game);

    // The game must enter the searching phase.
    expect(result.phase).toBe("searching");

    // [req-5.2]: The active search must be stored.
    expect(result.activeSearch).toEqual(search);

    // Previous errors must be cleared.
    expect(result.error).toBe(null);

    // The run must remain unchanged.
    expect(result.run).toBe(game.run);

    // The original GameState must not be mutated.
    expect(game.phase).toBe("shop");
    expect(game.error).toBe("Previous search failed");
    expect(game.activeSearch).toBe(null);
  });

  // [req-5.1]: Test matchmaking with an empty backpack.
  // Why: A player must own at least one item before fighting.
  // Expected: The search is rejected and the game stays unchanged.
  it("blocks searching with an empty backpack", () => {

    // ARRANGE: Create a game with an empty backpack.
    const game = newGame(123);

    // [req-5.2]: Create a deterministic search identity for this round.
    const search: ActiveSearch = { searchId: "search-1", round: game.run.round };

    // ACT: Check the blocker and attempt to start a search.
    const blocker = fightBlocker(game);
    const result = startSearch(game, search);

    // ASSERT: The player must receive an understandable reason.
    expect(blocker).toBe("Buy at least one item first");

    // The original GameState must be returned.
    expect(result).toBe(game);

    // The player must remain in the shop.
    expect(result.phase).toBe("shop");
  });

  // [req-5.1]: Test starting another search while searching.
  // Why: Only one search may be active at a time.
  // Expected: The second search leaves the first search unchanged.
  it("blocks a second opponent search", () => {

    // ARRANGE: Create a game with one item.
    const game = newGame(123);

    game.run.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    // [req-5.2]: Create two different searches for the same round.
    const searchA: ActiveSearch = {
      searchId: "search-A",
      round: game.run.round
    };

    const searchB: ActiveSearch = {
      searchId: "search-B",
      round: game.run.round
    };

    // Start the first search.
    const searching = startSearch(game, searchA);

    // ACT: Attempt to start a second search.
    const blocker = fightBlocker(searching);
    const result = startSearch(searching, searchB);

    // ASSERT: A running search must have a blocker.
    expect(blocker).toBe("Opponent search already running");

    // The second search must be rejected.
    expect(result).toBe(searching);

    // The phase must remain searching.
    expect(result.phase).toBe("searching");

    // The first search must remain active.
    expect(result.activeSearch).toEqual(searchA);
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

      // [req-5.2]: Create a deterministic search identity for this round.
      const search: ActiveSearch = { searchId: "search-1", round: game.run.round };

      // ACT: Attempt to start an opponent search.
      const blocker = fightBlocker(game);
      const result = startSearch(game, search);

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
  // Expected: The player returns to the shop, the active search
  // is cleared and the run remains unchanged.
  it("returns to the shop after a search failure", () => {

    // ARRANGE: Create a game with one item.
    const game = newGame(123);

    game.run.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    // Create and start a search.
    const search: ActiveSearch = {
      searchId: "search-1",
      round: game.run.round
    };

    const searching = startSearch(game, search);

    const error = "Opponent API unavailable";

    // ACT: Simulate a failure of the current search.
    const result = searchFailed(searching, search, error);

    // ASSERT: The failure creates a new GameState.
    expect(result).not.toBe(searching);

    // The player must return to the shop.
    expect(result.phase).toBe("shop");

    // The error message must be stored.
    expect(result.error).toBe(error);

    // [req-5.2]: The failed search must be cleared.
    expect(result.activeSearch).toBe(null);

    // The complete run must remain unchanged.
    expect(result.run).toBe(searching.run);

    // No battle must have been started.
    expect(result.battle).toBe(null);

    // The original GameState must remain unchanged.
    expect(searching.phase).toBe("searching");
    expect(searching.error).toBe(null);
    expect(searching.activeSearch).toEqual(search);
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

    // [req-5.2]: Create a deterministic search identity for this round.
    const search: ActiveSearch = { searchId: "search-1", round: game.run.round };

    // Start a search and simulate a failure.
    const searching = startSearch(game, search);

    const failed = searchFailed(
      searching,
      search,
      "Opponent API unavailable"
    );

    // [req-5.2]: Assign the retry a new identity for the same round.
    const retry: ActiveSearch = { searchId: "search-2", round: search.round };

    // ACT: Retry the opponent search.
    const result = startSearch(failed, retry);

    // ASSERT: A new search must be allowed.
    expect(result).not.toBe(failed);
    expect(result.phase).toBe("searching");

    // The previous error must be cleared.
    expect(result.error).toBe(null);

    // [req-5.2]: The retry must become the active search.
    expect(result.activeSearch).toEqual(retry);

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

      // [req-5.2]: Create a deterministic search identity for this round.
      const search: ActiveSearch = { searchId: "search-1", round: game.run.round };

      // ACT: Simulate an unexpected search failure.
      const result = searchFailed(
        game,
        search,
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

    // [req-5.2]: Create a deterministic search identity for this round.
    const search: ActiveSearch = { searchId: "search-1", round: game.run.round };

    // Start an opponent search.
    const searching = startSearch(game, search);

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
    const result = startBattle(searching, search, opponent);

    // ASSERT: A successful response creates a new GameState.
    expect(result).not.toBe(searching);

    // The game must enter the battle phase.
    expect(result.phase).toBe("battle");

    // The battle must contain the received opponent.
    expect(result.battle?.opponent).toEqual(opponent);

    // The replay must start at the first frame.
    expect(result.battle?.frame).toBe(0);

    // [req-5.2]: The successful search must be cleared.
    expect(result.activeSearch).toBe(null);

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

      // [req-5.2]: Create a deterministic search identity for this round.
      const search: ActiveSearch = { searchId: "search-1", round: game.run.round };

      // ACT: Attempt to start a battle.
      const result = startBattle(game, search, opponent);

      // ASSERT: The invalid transition must be rejected.
      expect(result).toBe(game);

      // The phase must remain unchanged.
      expect(result.phase).toBe(phase);
    }
  );
});

describe("Matchmaking response validation [req-5.2]", () => {

  // [req-5.2]: Test the initial matchmaking state.
  // Why: A new game must not contain an active search.
  // Expected: The game starts in the shop with activeSearch set to null.
  it("starts a new game without an active search", () => {

    // ARRANGE: Define a deterministic seed.
    const seed = 123;

    // ACT: Create a new game.
    const game = newGame(seed);

    // ASSERT: The game must start in the shop.
    expect(game.phase).toBe("shop");

    // No matchmaking attempt must be active.
    expect(game.activeSearch).toBe(null);
  });

  // [req-5.2]: Test starting a search for an outdated round.
  // Why: Matchmaking must only start for the current round.
  // Expected: The original GameState remains unchanged.
  it("rejects a search for the wrong round", () => {

    // ARRANGE: Create a game with one item.
    const game = newGame(123);

    game.run.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    // Create a search for a different round.
    const search: ActiveSearch = {
      searchId: "search-1",
      round: game.run.round + 1
    };

    // ACT: Attempt to start the invalid search.
    const result = startSearch(game, search);

    // ASSERT: The original GameState must be returned.
    expect(result).toBe(game);

    // The game must remain in the shop.
    expect(result.phase).toBe("shop");

    // No search must have been stored.
    expect(result.activeSearch).toBe(null);
  });

  // [req-5.2]: Test a late response from a previous search.
  // Why: An outdated response must not start a battle
  // during a newer search for the same round.
  // Expected: The newer search remains active.
  it("ignores a response from an outdated search", () => {

    // ARRANGE: Create a game with one item.
    const game = newGame(123);

    game.run.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    // Create two searches for the same round.
    const searchA: ActiveSearch = {
      searchId: "search-A",
      round: game.run.round
    };

    const searchB: ActiveSearch = {
      searchId: "search-B",
      round: game.run.round
    };

    // Start search A.
    const searchingA = startSearch(game, searchA);

    // Simulate a timeout of search A.
    const failed = searchFailed(
      searchingA,
      searchA,
      "Search timed out"
    );

    // Start search B for the same round.
    const searchingB = startSearch(failed, searchB);

    // Create an opponent from the outdated response.
    const opponent: Opponent = {
      id: "test-opponent",
      name: "Test Opponent",
      icon: "",
      hp: 40,
      round: game.run.round,
      items: ["pot-lid"]
    };

    // ACT: Process the late response from search A.
    const result = startBattle(searchingB, searchA, opponent);

    // ASSERT: The outdated response must be ignored.
    expect(result).toBe(searchingB);

    // The newer search must remain active.
    expect(result.phase).toBe("searching");
    expect(result.activeSearch).toEqual(searchB);

    // No battle must have been started.
    expect(result.battle).toBe(null);

    // The run must remain unchanged.
    expect(result.run).toBe(searchingB.run);
  });

  // [req-5.2]: Test a late error from a previous search.
  // Why: An outdated failure must not interrupt a newer search.
  // Expected: The newer search remains active without an error.
  it("ignores a failure from an outdated search", () => {

    // ARRANGE: Create a game with one item.
    const game = newGame(123);

    game.run.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    // Create two different searches for the same round.
    const searchA: ActiveSearch = {
      searchId: "search-A",
      round: game.run.round
    };

    const searchB: ActiveSearch = {
      searchId: "search-B",
      round: game.run.round
    };

    // Start and end the first search.
    const searchingA = startSearch(game, searchA);

    const failed = searchFailed(
      searchingA,
      searchA,
      "Search timed out"
    );

    // Start the second search.
    const searchingB = startSearch(failed, searchB);

    // ACT: Process another late error from search A.
    const result = searchFailed(
      searchingB,
      searchA,
      "Late API error"
    );

    // ASSERT: The outdated error must be ignored.
    expect(result).toBe(searchingB);

    // The newer search must remain active.
    expect(result.phase).toBe("searching");
    expect(result.activeSearch).toEqual(searchB);

    // No outdated error message must be displayed.
    expect(result.error).toBe(null);
  });

  // [req-5.2]: Test an opponent from the wrong round.
  // Why: A valid search must not start a battle against
  // an opponent belonging to another round.
  // Expected: No battle is created and GameState remains unchanged.
  it("rejects an opponent from the wrong round", () => {

    // ARRANGE: Create a game with one item.
    const game = newGame(123);

    game.run.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    // Start a valid search for the current round.
    const search: ActiveSearch = {
      searchId: "search-1",
      round: game.run.round
    };

    const searching = startSearch(game, search);

    // Create an opponent for a different round.
    const opponent: Opponent = {
      id: "test-opponent",
      name: "Test Opponent",
      icon: "",
      hp: 40,
      round: game.run.round + 1,
      items: ["pot-lid"]
    };

    // ACT: Attempt to start a battle with the invalid opponent.
    const result = startBattle(searching, search, opponent);

    // ASSERT: The invalid opponent must be rejected.
    expect(result).toBe(searching);

    // No battle must have been started.
    expect(result.battle).toBe(null);

    // The active search must remain unchanged.
    expect(result.activeSearch).toEqual(search);
  });

  // [req-5.2]: Test a response with an outdated search round.
  // Why: Matching search IDs alone must not bypass round validation.
  // Expected: The response is ignored and no battle is started.
  it("ignores responses with an outdated search round", () => {

    // ARRANGE: Create a game with one item.
    const game = newGame(123);

    game.run.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    // Start a valid search for the current round.
    const search: ActiveSearch = {
      searchId: "search-1",
      round: game.run.round
    };

    const searching = startSearch(game, search);

    // Create response metadata with the same ID but a wrong round.
    const outdatedSearch: ActiveSearch = {
      searchId: search.searchId,
      round: search.round + 1
    };

    // Create an opponent for the actual current round.
    const opponent: Opponent = {
      id: "test-opponent",
      name: "Test Opponent",
      icon: "",
      hp: 40,
      round: game.run.round,
      items: ["pot-lid"]
    };

    // ACT: Process a response with invalid search metadata.
    const result = startBattle(
      searching,
      outdatedSearch,
      opponent
    );

    // ASSERT: Matching search IDs must not be sufficient.
    expect(result).toBe(searching);

    // The current search must remain active.
    expect(result.activeSearch).toEqual(search);

    // No battle must have been started.
    expect(result.battle).toBe(null);
  });

  // [req-5.2]: Test processing the same response twice.
  // Why: Duplicate responses must not restart an existing battle.
  // Expected: The battle and its current replay frame remain unchanged.
  it("ignores a duplicate response during battle", () => {

    // ARRANGE: Create a game with one item.
    const game = newGame(123);

    game.run.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    // Create and start an opponent search.
    const search: ActiveSearch = {
      searchId: "search-1",
      round: game.run.round
    };

    const searching = startSearch(game, search);

    // Create a deterministic opponent.
    const opponent: Opponent = {
      id: "test-opponent",
      name: "Test Opponent",
      icon: "",
      hp: 40,
      round: game.run.round,
      items: ["pot-lid"]
    };

    // Accept the first response and start the battle.
    const battling = startBattle(searching, search, opponent);

    // Advance the battle replay by one frame.
    const advanced = advanceReplay(battling);

    // Verify that the replay has actually advanced.
    expect(advanced.battle?.frame).toBe(1);

    // ACT: Process the same response again.
    const result = startBattle(advanced, search, opponent);

    // ASSERT: The duplicate response must be ignored.
    expect(result).toBe(advanced);

    // The existing battle must remain unchanged.
    expect(result.battle).toBe(advanced.battle);

    // The replay must not restart at frame zero.
    expect(result.battle?.frame).toBe(1);

    // No search must remain active.
    expect(result.activeSearch).toBe(null);

    // The run must remain unchanged.
    expect(result.run).toBe(advanced.run);
  });

  // [req-5.2]: Test a valid response after retrying matchmaking.
  // Why: Rejecting outdated responses must not block valid new searches.
  // Expected: Only the response of the current search starts a battle.
  it("accepts a valid response after retrying", () => {

    // ARRANGE: Create a game with one item.
    const game = newGame(123);

    game.run.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    // Create two searches for the same round.
    const searchA: ActiveSearch = {
      searchId: "search-A",
      round: game.run.round
    };

    const searchB: ActiveSearch = {
      searchId: "search-B",
      round: game.run.round
    };

    // Start and fail the first search.
    const searchingA = startSearch(game, searchA);

    const failed = searchFailed(
      searchingA,
      searchA,
      "Opponent API unavailable"
    );

    // Retry with a new search identity.
    const searchingB = startSearch(failed, searchB);

    // Create a valid opponent for the current round.
    const opponent: Opponent = {
      id: "test-opponent",
      name: "Test Opponent",
      icon: "",
      hp: 40,
      round: game.run.round,
      items: ["pot-lid"]
    };

    // ACT: Process the valid response from search B.
    const result = startBattle(searchingB, searchB, opponent);

    // ASSERT: The current response must be accepted.
    expect(result).not.toBe(searchingB);

    // The game must enter the battle phase.
    expect(result.phase).toBe("battle");

    // The correct opponent must be used.
    expect(result.battle?.opponent).toEqual(opponent);

    // The replay must start at frame zero.
    expect(result.battle?.frame).toBe(0);

    // The successful search must be cleared.
    expect(result.activeSearch).toBe(null);

    // The previous error must remain cleared.
    expect(result.error).toBe(null);

    // The run must not be scored yet.
    expect(result.run).toBe(searchingB.run);

    // The original GameState must remain unchanged.
    expect(searchingB.phase).toBe("searching");
    expect(searchingB.activeSearch).toEqual(searchB);
  });
});

describe("Battle result idempotency [req-5.4]", () => {

  // [req-5.4]: Create a deterministic battle for the tests.
  function createBattle() {
    const game = newGame(123);

    game.run.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    const search: ActiveSearch = {
      searchId: "search-1",
      round: game.run.round
    };

    const opponent: Opponent = {
      id: "test-opponent",
      name: "Test Opponent",
      icon: "",
      hp: 40,
      round: game.run.round,
      items: ["pot-lid"]
    };

    const searching = startSearch(game, search);

    return startBattle(searching, search, opponent);
  }

  // [req-5.4]: Test advancing an unfinished replay.
  // Why: Results must only be applied at the final frame.
  // Expected: The replay advances without changing the run.
  it("does not apply the result before the final frame", () => {

    // ARRANGE: Create a battle.
    const game = createBattle();

    // ACT: Advance the replay.
    const result = advanceReplay(game);

    // ASSERT: Only the replay frame changes.
    expect(result.battle?.frame).toBe(1);
    expect(result.run).toBe(game.run);
  });

  // [req-5.4]: Test completing a battle replay.
  // Why: A completed battle must be scored.
  // Expected: The result is applied and the next round starts.
  it("applies the battle result when the replay ends", () => {

    // ARRANGE: Create a battle.
    const game = createBattle();

    const winner = game.battle?.result.winner;

    // ACT: Complete the replay.
    const result = skipReplay(game);

    // ASSERT: The replay must be completed.
    expect(result.battle && isReplayDone(result.battle)).toBe(true);

    // The round and gold must increase exactly once.
    expect(result.run.round).toBe(game.run.round + 1);
    expect(result.run.gold).toBe(game.run.gold + GOLD_PER_ROUND);

    // The correct battle result must be applied.
    expect(result.run.wins).toBe(
      game.run.wins + (winner === "player" ? 1 : 0)
    );

    expect(result.run.lives).toBe(
      game.run.lives - (winner === "player" ? 0 : 1)
    );
  });

  // [req-5.4]: Test skipping a completed replay again.
  // Why: A second skip must not apply another result.
  // Expected: The entire GameState remains unchanged.
  it("does not apply the result twice when skipping", () => {

    // ARRANGE: Create and complete a battle.
    const game = createBattle();
    const completed = skipReplay(game);

    // ACT: Skip the completed replay again.
    const result = skipReplay(completed);

    // ASSERT: Nothing must change.
    expect(result).toBe(completed);
    expect(result.run).toBe(completed.run);
  });

  // [req-5.4]: Test a replay update after skipping.
  // Why: A pending timer must not score the battle again.
  // Expected: The completed GameState remains unchanged.
  it("ignores a replay advance after skipping", () => {

    // ARRANGE: Create and complete a battle.
    const game = createBattle();
    const completed = skipReplay(game);

    // ACT: Simulate a late timer callback.
    const result = advanceReplay(completed);

    // ASSERT: No additional result is applied.
    expect(result).toBe(completed);
    expect(result.run).toBe(completed.run);
  });

  // [req-5.4]: Test skipping a normally completed replay.
  // Why: A late skip must not apply the result again.
  // Expected: The completed GameState remains unchanged.
  it("ignores skipping after the final frame", () => {

    // ARRANGE: Complete a battle through showFrame().
    const game = createBattle();

    if (!game.battle) throw new Error("Expected a battle");

    const last = game.battle.result.frames.length - 1;
    const completed = showFrame(game, last);

    // ACT: Skip the already completed replay.
    const result = skipReplay(completed);

    // ASSERT: Nothing must change.
    expect(result).toBe(completed);
  });

  // [req-5.4]: Test a replay update after leaving the battle.
  // Why: Old replay callbacks must not change the next round.
  // Expected: The shop state remains unchanged.
  it("ignores replay updates after leaving battle", () => {

    // ARRANGE: Complete and leave the battle.
    const game = createBattle();
    const completed = skipReplay(game);
    const shopping = leaveBattle(completed);

    // ACT: Simulate a late replay update.
    const result = advanceReplay(shopping);

    // ASSERT: The shop and run remain unchanged.
    expect(result.phase).toBe("shop");
    expect(result).toBe(shopping);
  });
});
