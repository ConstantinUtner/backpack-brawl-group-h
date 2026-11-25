import { describe, expect, it } from "vitest";
import { advanceReplay, leaveBattle, newGame, skipReplay, startBattle, startSearch, updateRun } from "./game";
import { applyBattleResult, buyItem, newRun, rerollShop } from "./run";

import {
  SAVE_VERSION,
  createSaveData,
  serializeSave,
  parseSave,
  isValidRunState,
  hasValidSaveStructure,
  isValidGameState,
  isValidSaveData,
  restoreGame,
  restoreSave,
} from "./persistence";
import type { GameState, Opponent } from "./types";

// [req-6.4]: Create a real battle through the existing game transitions
// so validation tests use realistic battle data.
function createTestBattle(
  initialGame = newGame(123)
): GameState {

  // Ensure an affordable item is available.
  initialGame.run.shop[0] = "pot-lid";

  const bought = updateRun(
    initialGame,
    (run) => buyItem(run, 0)
  );

  const search = {
    searchId: "test-search",
    round: bought.run.round
  };

  const searching = startSearch(bought, search);

  const opponent: Opponent = {
    id: "test-opponent",
    name: "Test Opponent",
    icon: "O",
    hp: 25,
    round: bought.run.round,
    items: ["chipped-dagger"]
  };

  const game = startBattle(searching, search, opponent);

  // Ensure the fixture actually contains a battle.
  if (game.phase !== "battle" || !game.battle) {
    throw new Error("Expected a battle");
  }

  return game;
}

describe("Creating save data [req-6.2]", () => {

  // [req-6.2]: Test the creation of a versioned save.
  // Why: Every save must contain the game and its format version.
  // Expected: The complete game is included with default metadata.
  it("creates a versioned save object", () => {

    // ARRANGE: Create a new game with a fixed seed.
    const game = newGame(123);

    // ACT: Wrap the game in a save object.
    const save = createSaveData(game);

    // ASSERT: The save must use the supported version.
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.version).toBe(1);

    // The complete game state must be included.
    expect(save.game).toEqual(game);

    // The original run identity must be preserved.
    expect(save.game.run.runId).toBe(game.run.runId);

    // A new save must have no submission information.
    expect(save.submittedRunId).toBeNull();
    expect(save.submissionName).toBe("");
  });


  // [req-6.2]: Test storing Hall of Fame information.
  // Why: Submission information must survive a future refresh.
  // Expected: The submitted run ID and entered name are preserved.
  it("includes Hall of Fame submission information", () => {

    // ARRANGE: Create a game and define submission metadata.
    const game = newGame(123);
    const submittedRunId = game.run.runId;
    const submissionName = "Constantin";

    // ACT: Create a save with the submission information.
    const save = createSaveData(
      game,
      submittedRunId,
      submissionName
    );

    // ASSERT: Both submission values must be preserved.
    expect(save.submittedRunId).toBe(submittedRunId);
    expect(save.submissionName).toBe(submissionName);

    // The game itself must remain unchanged.
    expect(save.game).toEqual(game);
  });


  // [req-6.2]: Test creating a save without changing the game.
  // Why: Saving must not modify the player's progress.
  // Expected: The original game remains unchanged.
  it("does not mutate the original game", () => {

    // ARRANGE: Create a game and copy its original state.
    const game = newGame(123);
    const original = structuredClone(game);

    // ACT: Create a save from the game.
    createSaveData(game);

    // ASSERT: All original game values must remain unchanged.
    expect(game).toEqual(original);
  });

});

describe("Serializing save data [req-6.2]", () => {

  // [req-6.2]: Test converting a save into JSON.
  // Why: localStorage can only store strings.
  // Expected: The result is valid JSON containing the complete save.
  it("serializes a save into a JSON string", () => {

    // ARRANGE: Create a game and its save object.
    const game = newGame(123);
    const save = createSaveData(game);

    // ACT: Convert the save into JSON.
    const serialized = serializeSave(save);

    // ASSERT: The serialized value must be a string.
    expect(typeof serialized).toBe("string");

    // Parsing the JSON must produce the original save data.
    expect(JSON.parse(serialized)).toEqual(save);
  });


  // [req-6.2]: Test serialization without state mutation.
  // Why: Converting a save to JSON must not change its contents.
  // Expected: The original save remains unchanged.
  it("does not mutate the original save", () => {

    // ARRANGE: Create a save and copy its contents.
    const save = createSaveData(newGame(123));
    const original = structuredClone(save);

    // ACT: Serialize the save.
    serializeSave(save);

    // ASSERT: The original save must remain unchanged.
    expect(save).toEqual(original);
  });

});

describe("Parsing save data [req-6.2]", () => {

  // [req-6.2]: Test parsing valid JSON.
  // Why: Stored JSON must be converted back into readable data.
  // Expected: The parsed data matches the original save.
  it("parses a valid JSON save", () => {

    // ARRANGE: Create a save and convert it to JSON.
    const save = createSaveData(newGame(123));
    const raw = JSON.stringify(save);

    // ACT: Parse the JSON string.
    const result = parseSave(raw);

    // ASSERT: All saved values must be restored.
    expect(result).toEqual(save);
  });


  // [req-6.2]: Test malformed JSON.
  // Why: Corrupted save data must not crash the application.
  // Expected: Parsing returns null instead of throwing an error.
  it("returns null for malformed JSON", () => {

    // ARRANGE: Create an incomplete JSON string.
    const raw = '{"version":1,"game":';

    // ACT: Attempt to parse the corrupted save.
    const result = parseSave(raw);

    // ASSERT: Invalid JSON must be handled safely.
    expect(result).toBeNull();
  });


  // [req-6.2]: Test an empty save string.
  // Why: Empty data cannot be parsed as JSON.
  // Expected: Parsing returns null.
  it("returns null for an empty string", () => {

    // ARRANGE: Define an empty string.
    const raw = "";

    // ACT: Attempt to parse the empty string.
    const result = parseSave(raw);

    // ASSERT: The empty input must be handled safely.
    expect(result).toBeNull();
  });


  // [req-6.2]: Test the difference between parsing and validation.
  // Why: Valid JSON does not necessarily describe a valid game.
  // Expected: Parsing returns the data without claiming it is valid.
  it("parses valid JSON without validating its game values", () => {

    // ARRANGE: Define valid JSON containing invalid game data.
    const raw = '{"version":999,"game":{"gold":-100}}';

    // ACT: Parse the JSON string.
    const result = parseSave(raw);

    // ASSERT: Parsing preserves the data for later validation.
    expect(result).toEqual({
      version: 999,
      game: {
        gold: -100
      }
    });
  });

});

describe("Save round trip [req-6.2]", () => {

  // [req-6.2]: Test the complete serialization round trip.
  // Why: Saving and parsing must preserve all player progress,
  // including spent gold, purchased items and the current shop seed.
  // Expected: The parsed save exactly matches the saved game.
  it("preserves the complete game after a purchase and reroll", () => {

    // ARRANGE: Create a game with a fixed seed.
    const game = newGame(123);

    // Buy the first shop offer.
    const bought = updateRun(game, (run) => buyItem(run, 0));

    // Reroll the shop.
    const rerolled = updateRun(bought, rerollShop);

    // ACT: Create, serialize and parse the save.
    const save = createSaveData(rerolled);
    const serialized = serializeSave(save);
    const restored = parseSave(serialized);

    // ASSERT: Both shop actions must actually have succeeded.
    expect(bought).not.toBe(game);
    expect(rerolled).not.toBe(bought);

    // All saved values must survive the round trip.
    expect(restored).toEqual(save);

    // The restored data must be a new object.
    expect(restored).not.toBe(save);

    // The purchase must have changed the original gold.
    expect(bought.run.gold).toBeLessThan(game.run.gold);

    // The reroll must have cost exactly one additional gold.
    expect(rerolled.run.gold).toBe(bought.run.gold - 1);

    // The purchased item must remain in the backpack.
    expect(rerolled.run.backpack[0]).not.toBeNull();
    expect(rerolled.run.backpack).toEqual(bought.run.backpack);

    // The reroll must have advanced the shop seed.
    expect(rerolled.run.seed).not.toBe(bought.run.seed);

    // The run identity must remain unchanged.
    expect(rerolled.run.runId).toBe(game.run.runId);
  });

});

describe("Valid persisted runs [req-6.3]", () => {

  // [req-6.3]: Test validation of a newly created run.
  // Why: A regular new run must always be accepted.
  // Expected: The new RunState passes validation.
  it("accepts a newly created run", () => {

    // ARRANGE: Create a run with a fixed seed.
    const state = newRun(123);

    // ACT: Validate the run.
    const result = isValidRunState(state);

    // ASSERT: A regular new run must be valid.
    expect(result).toBe(true);
  });


  // [req-6.3]: Test validation after successful shop actions.
  // Why: Spending gold and changing offers must not
  // make a legitimate save invalid.
  // Expected: The updated run passes validation.
  it("accepts a run after buying and rerolling", () => {

    // ARRANGE: Create a new run.
    const state = newRun(123);

    // Buy an item and reroll the shop.
    const bought = buyItem(state, 0);
    const rerolled = rerollShop(bought);

    // ACT: Validate the updated run.
    const result = isValidRunState(rerolled);

    // ASSERT: Both shop actions must have succeeded.
    expect(bought).not.toBe(state);
    expect(rerolled).not.toBe(bought);

    // The updated run must remain valid.
    expect(result).toBe(true);
  });


  // [req-6.3]: Test validation of a completed victory.
  // Why: Finished runs do not advance to another round.
  // Expected: Five wins with remaining lives are valid.
  it("accepts a completed victory", () => {

    // ARRANGE: Create a run one win away from victory.
    const state = {
      ...newRun(123),
      round: 5,
      wins: 4
    };

    const finished = applyBattleResult(state, "player");

    // ACT: Validate the finished run.
    const result = isValidRunState(finished);

    // ASSERT: The run must have reached victory.
    expect(finished.wins).toBe(5);
    expect(finished.round).toBe(5);

    // The completed run must be valid.
    expect(result).toBe(true);
  });


  // [req-6.3]: Test validation of a completed defeat.
  // Why: Zero lives are valid when the run has ended.
  // Expected: A completed defeat passes validation.
  it("accepts a completed defeat", () => {

    // ARRANGE: Create a run with one remaining life.
    const state = {
      ...newRun(123),
      round: 3,
      lives: 1
    };

    const finished = applyBattleResult(state, "opponent");

    // ACT: Validate the finished run.
    const result = isValidRunState(finished);

    // ASSERT: The run must have reached defeat.
    expect(finished.lives).toBe(0);
    expect(finished.round).toBe(3);

    // The completed run must be valid.
    expect(result).toBe(true);
  });


  // [req-6.3]: Test multiple instances of the same item.
  // Why: Duplicate item types are allowed, but UIDs must be unique.
  // Expected: The backpack passes validation.
  it("accepts duplicate item types with different UIDs", () => {

    // ARRANGE: Buy two identical items.
    const state = newRun(123);
    state.shop[0] = "pot-lid";
    state.shop[1] = "pot-lid";

    const first = buyItem(state, 0);
    const second = buyItem(first, 1);

    // ACT: Validate the updated run.
    const result = isValidRunState(second);

    // ASSERT: Both items must exist independently.
    expect(second.backpack[0]?.itemId).toBe("pot-lid");
    expect(second.backpack[1]?.itemId).toBe("pot-lid");

    expect(second.backpack[0]?.uid).not.toBe(
      second.backpack[1]?.uid
    );

    // Identical item types must not invalidate a run.
    expect(result).toBe(true);
  });

});

describe("Invalid persisted run values [req-6.3]", () => {

  // [req-6.3]: Test values that are not run objects.
  // Why: Arbitrary parsed JSON must not crash validation.
  // Expected: Every invalid structure is rejected.
  it.each([
    null,
    undefined,
    [],
    "invalid",
    42,
    {}
  ])("rejects invalid run structure: %j", (value) => {

    // ARRANGE: Use the supplied invalid value.

    // ACT: Validate the value.
    const result = isValidRunState(value);

    // ASSERT: The value must not be accepted.
    expect(result).toBe(false);
  });


  // [req-6.3]: Test invalid individual run properties.
  // Why: Saved values must respect the game's numeric and
  // identity constraints.
  // Expected: Every invalid property makes the run invalid.
  it.each([
    ["runId", ""],
    ["runId", "invalid-id"],
    ["gold", -1],
    ["gold", 11],
    ["gold", 1.5],
    ["gold", "10"],
    ["gold", NaN],
    ["gold", Infinity],
    ["round", 0],
    ["round", 8],
    ["round", 1.5],
    ["lives", -1],
    ["lives", 4],
    ["wins", -1],
    ["wins", 6],
    ["seed", -1],
    ["seed", 2 ** 32],
    ["seed", 1.5],
    ["nextUid", 0],
    ["nextUid", 1.5],
    ["nextUid", Number.MAX_SAFE_INTEGER + 1]
  ])("rejects invalid %s: %s", (property, value) => {

    // ARRANGE: Create a valid run and replace one property.
    const state = newRun(123);

    const invalid = {
      ...state,
      [property]: value
    };

    // ACT: Validate the modified run.
    const result = isValidRunState(invalid);

    // ASSERT: The invalid property must be rejected.
    expect(result).toBe(false);
  });

});

describe("Persisted shop validation [req-6.3]", () => {

  // [req-6.3]: Test invalid saved shop structures.
  // Why: The shop must contain exactly four valid offers.
  // Expected: Invalid sizes, types and item IDs are rejected.
  it.each([
    { shop: null },
    { shop: [] },
    { shop: ["pot-lid"] },
    { shop: Array(4) },
    { shop: [null, null, null, null, null] },
    { shop: ["unknown-item", null, null, null] },
    { shop: [123, null, null, null] },
    { shop: [{ itemId: "pot-lid" }, null, null, null] }
  ])("rejects invalid shop: %j", ({ shop }) => {

    // ARRANGE: Create a run with an invalid shop.
    const state = {
      ...newRun(123),
      shop
    };

    // ACT: Validate the run.
    const result = isValidRunState(state);

    // ASSERT: The invalid shop must be rejected.
    expect(result).toBe(false);
  });


  // [req-6.3]: Test a completely sold-out shop.
  // Why: All four offers can be purchased.
  // Expected: A shop containing only null values is valid.
  it("accepts a sold-out shop", () => {

    // ARRANGE: Create four affordable offers.
    let state = newRun(123);
    state.shop = [
      "pot-lid",
      "pot-lid",
      "pot-lid",
      "pot-lid"
    ];

    // Purchase all four offers.
    for (let index = 0; index < 4; index++) {
      state = buyItem(state, index);
    }

    // ACT: Validate the resulting run.
    const result = isValidRunState(state);

    // ASSERT: All offers must have been purchased.
    expect(state.shop.every((offer) => offer === null))
      .toBe(true);

    // A sold-out shop must still be valid.
    expect(result).toBe(true);
  });

});

describe("Persisted backpack validation [req-6.3]", () => {

  // [req-6.3]: Test invalid backpack sizes.
  // Why: The backpack must always contain six slots.
  // Expected: Invalid array lengths are rejected.
  it.each([
    { backpack: null },
    { backpack: [] },
    { backpack: [null] },
    { backpack: Array(7).fill(null) }
  ])("rejects invalid backpack size: %j", ({ backpack }) => {

    // ARRANGE: Create a run with an invalid backpack.
    const state = {
      ...newRun(123),
      backpack
    };

    // ACT: Validate the run.
    const result = isValidRunState(state);

    // ASSERT: The invalid backpack must be rejected.
    expect(result).toBe(false);
  });


  // [req-6.3]: Test invalid individual backpack slots.
  // Why: Occupied slots require known item IDs and valid UIDs.
  // Expected: Every invalid item instance is rejected.
  it.each([
    "pot-lid",
    123,
    {},
    { uid: "item-1" },
    { itemId: "pot-lid" },
    { uid: "item-1", itemId: "unknown-item" },
    { uid: "invalid", itemId: "pot-lid" },
    { uid: "item-0", itemId: "pot-lid" },
    { uid: "item-01", itemId: "pot-lid" }
  ])("rejects invalid backpack slot: %j", (slot) => {

    // ARRANGE: Create a run with one invalid slot.
    const state = {
      ...newRun(123),
      nextUid: 2,
      backpack: [
        slot,
        null,
        null,
        null,
        null,
        null
      ]
    };

    // ACT: Validate the run.
    const result = isValidRunState(state);

    // ASSERT: The invalid item must be rejected.
    expect(result).toBe(false);
  });


  // [req-6.3]: Test duplicated item instance IDs.
  // Why: Two different items must never share the same UID.
  // Expected: The run is rejected.
  it("rejects duplicate item UIDs", () => {

    // ARRANGE: Create two items with the same UID.
    const state = newRun(123);
    state.nextUid = 3;

    state.backpack[0] = {
      uid: "item-1",
      itemId: "pot-lid"
    };

    state.backpack[1] = {
      uid: "item-1",
      itemId: "hunting-bow"
    };

    // ACT: Validate the run.
    const result = isValidRunState(state);

    // ASSERT: Duplicate UIDs must be rejected.
    expect(result).toBe(false);
  });


  // [req-6.3]: Test an inconsistent UID counter.
  // Why: Future purchases must not reuse existing item UIDs.
  // Expected: An existing UID equal to nextUid is rejected.
  it("rejects an existing UID equal to nextUid", () => {

    // ARRANGE: Create an item whose UID would be reused.
    const state = newRun(123);
    state.nextUid = 2;

    state.backpack[0] = {
      uid: "item-2",
      itemId: "pot-lid"
    };

    // ACT: Validate the run.
    const result = isValidRunState(state);

    // ASSERT: The conflicting UID counter must be rejected.
    expect(result).toBe(false);
  });


  // [req-6.3]: Test gaps between existing item UIDs.
  // Why: Selling items can leave unused earlier IDs.
  // Expected: Missing earlier UIDs do not invalidate the run.
  it("accepts gaps between item UIDs", () => {

    // ARRANGE: Create a backpack with nonconsecutive UIDs.
    const state = newRun(123);
    state.nextUid = 5;

    state.backpack[0] = {
      uid: "item-2",
      itemId: "pot-lid"
    };

    state.backpack[1] = {
      uid: "item-4",
      itemId: "hunting-bow"
    };

    // ACT: Validate the run.
    const result = isValidRunState(state);

    // ASSERT: Missing previous UIDs must be allowed.
    expect(result).toBe(true);
  });

});

describe("Persisted run progress [req-6.3]", () => {

  // [req-6.3]: Test valid combinations of round, wins and lives.
  // Why: Both active and completed runs must be restorable.
  // Expected: Every possible progress combination is accepted.
  it.each([
    { round: 1, wins: 0, lives: 3 },
    { round: 2, wins: 1, lives: 3 },
    { round: 2, wins: 0, lives: 2 },
    { round: 4, wins: 2, lives: 2 },
    { round: 7, wins: 4, lives: 1 },
    { round: 5, wins: 5, lives: 3 },
    { round: 7, wins: 5, lives: 1 },
    { round: 3, wins: 0, lives: 0 },
    { round: 7, wins: 4, lives: 0 }
  ])("accepts valid progress: %j", (progress) => {

    // ARRANGE: Create a run with the supplied progress.
    const state = {
      ...newRun(123),
      ...progress
    };

    // ACT: Validate the run.
    const result = isValidRunState(state);

    // ASSERT: The progress combination must be accepted.
    expect(result).toBe(true);
  });


  // [req-6.3]: Test impossible combinations of progress values.
  // Why: Individually valid numbers can describe an impossible run.
  // Expected: Inconsistent progress is rejected.
  it.each([
    { round: 1, wins: 4, lives: 3 },
    { round: 4, wins: 0, lives: 3 },
    { round: 2, wins: 0, lives: 0 },
    { round: 6, wins: 5, lives: 3 },
    { round: 4, wins: 0, lives: 0 },
    { round: 7, wins: 5, lives: 0 }
  ])("rejects impossible progress: %j", (progress) => {

    // ARRANGE: Create a run with inconsistent progress.
    const state = {
      ...newRun(123),
      ...progress
    };

    // ACT: Validate the run.
    const result = isValidRunState(state);

    // ASSERT: Impossible progress must be rejected.
    expect(result).toBe(false);
  });

});

describe("Save structure validation [req-6.3]", () => {

  // [req-6.3]: Test the current save format.
  // Why: Regular saves must pass preliminary validation.
  // Expected: The outer structure and run are accepted.
  it("accepts the current save structure", () => {

    // ARRANGE: Create a regular save.
    const save = createSaveData(newGame(123));

    // ACT: Validate its structure.
    const result = hasValidSaveStructure(save);

    // ASSERT: The save structure must be accepted.
    expect(result).toBe(true);
  });


  // [req-6.3]: Test incompatible save versions.
  // Why: Unsupported formats must not be restored.
  // Expected: Every unsupported version is rejected.
  it.each([
    0,
    2,
    999,
    "1",
    null,
    undefined
  ])("rejects incompatible version: %j", (version) => {

    // ARRANGE: Create a save with an unsupported version.
    const save = {
      ...createSaveData(newGame(123)),
      version
    };

    // ACT: Validate the save structure.
    const result = hasValidSaveStructure(save);

    // ASSERT: The unsupported version must be rejected.
    expect(result).toBe(false);
  });


  // [req-6.3]: Test missing or malformed game structures.
  // Why: Saved data may not contain a usable game.
  // Expected: Invalid game structures are rejected.
  it.each([
    null,
    {},
    [],
    "invalid",
    { run: null }
  ])("rejects invalid game structure: %j", (game) => {

    // ARRANGE: Replace the game with invalid data.
    const save = {
      ...createSaveData(newGame(123)),
      game
    };

    // ACT: Validate the save structure.
    const result = hasValidSaveStructure(save);

    // ASSERT: The invalid structure must be rejected.
    expect(result).toBe(false);
  });


  // [req-6.3]: Test an invalid run inside a valid save format.
  // Why: A correct version does not guarantee valid progress.
  // Expected: Invalid run data invalidates the save structure.
  it("rejects a save containing an invalid run", () => {

    // ARRANGE: Create a save with negative gold.
    const game = newGame(123);
    game.run.gold = -10;

    const save = createSaveData(game);

    // ACT: Validate the save structure.
    const result = hasValidSaveStructure(save);

    // ASSERT: The invalid run must be rejected.
    expect(result).toBe(false);
  });


  // [req-6.3]: Test a submission ID belonging to another run.
  // Why: Submission information must belong to the saved run.
  // Expected: Unrelated submission IDs are rejected.
  it("rejects a mismatched submitted run ID", () => {

    // ARRANGE: Create two independent games.
    const first = newGame(123);
    const second = newGame(123);

    const save = createSaveData(
      first,
      second.run.runId,
      "Player"
    );

    // ACT: Validate the save structure.
    const result = hasValidSaveStructure(save);

    // ASSERT: The unrelated run ID must be rejected.
    expect(result).toBe(false);
  });


  // [req-6.3]: Test invalid submission name types.
  // Why: The saved name must be usable in the input field.
  // Expected: Non-string names are rejected.
  it.each([
    null,
    123,
    {},
    undefined
  ])("rejects invalid submission name: %j", (name) => {

    // ARRANGE: Create a save with invalid metadata.
    const save = {
      ...createSaveData(newGame(123)),
      submissionName: name
    };

    // ACT: Validate the save structure.
    const result = hasValidSaveStructure(save);

    // ASSERT: The invalid name must be rejected.
    expect(result).toBe(false);
  });

});

describe("Parsed save validation [req-6.3]", () => {

  // [req-6.3]: Test validation after a serialization round trip.
  // Why: A saved and parsed run must remain valid.
  // Expected: The restored save passes preliminary validation.
  it("accepts a serialized and parsed save", () => {

    // ARRANGE: Create a game and serialize its save.
    const game = newGame(123);
    const save = createSaveData(game);
    const raw = serializeSave(save);

    // ACT: Parse and validate the saved JSON.
    const parsed = parseSave(raw);
    const result = hasValidSaveStructure(parsed);

    // ASSERT: The original data must be preserved.
    expect(parsed).toEqual(save);

    // The parsed save structure must be accepted.
    expect(result).toBe(true);
  });


  // [req-6.3]: Test corrupted JSON during validation.
  // Why: Broken saved data must not crash the application.
  // Expected: Parsing and validation fail safely.
  it("rejects malformed JSON safely", () => {

    // ARRANGE: Define a corrupted save string.
    const raw = '{"version":1,"game":';

    // ACT: Parse and validate the corrupted JSON.
    const parsed = parseSave(raw);
    const result = hasValidSaveStructure(parsed);

    // ASSERT: Parsing must fail safely.
    expect(parsed).toBeNull();

    // The corrupted save must not be accepted.
    expect(result).toBe(false);
  });


  // [req-6.3]: Test valid JSON describing an impossible run.
  // Why: Successful parsing does not guarantee valid game data.
  // Expected: Parsing succeeds, but validation rejects the save.
  it("rejects parsed saves containing impossible progress", () => {

    // ARRANGE: Create an impossible run.
    const game = newGame(123);
    game.run.wins = 4;
    game.run.round = 1;

    const raw = serializeSave(createSaveData(game));

    // ACT: Parse and validate the saved data.
    const parsed = parseSave(raw);
    const result = hasValidSaveStructure(parsed);

    // ASSERT: The JSON itself must be readable.
    expect(parsed).not.toBeNull();

    // The impossible run must be rejected.
    expect(result).toBe(false);
  });

});

describe("Persisted game phases [req-6.4]", () => {

  // [req-6.4]: Test a valid shop phase.
  // Why: Regular shop states must be restorable.
  // Expected: The game passes validation.
  it("accepts a valid shop state", () => {

    // ARRANGE: Create a regular new game.
    const game = newGame(123);

    // ACT: Validate the game.
    const result = isValidGameState(game);

    // ASSERT: The shop state must be accepted.
    expect(result).toBe(true);
  });


  // [req-6.4]: Test a valid active search.
  // Why: Searching states must be recognized before recovery.
  // Expected: A search for the current round is valid.
  it("accepts a valid searching state", () => {

    // ARRANGE: Create a game and buy an item.
    const game = newGame(123);
    const bought = updateRun(game, (run) => buyItem(run, 0));

    const searching = startSearch(bought, {
      searchId: "test-search",
      round: bought.run.round
    });

    // ACT: Validate the searching state.
    const result = isValidGameState(searching);

    // ASSERT: The search must have started.
    expect(searching.phase).toBe("searching");

    // The searching state must be valid.
    expect(result).toBe(true);
  });


  // [req-6.4]: Test inconsistent game phases.
  // Why: The phase must match the available game data.
  // Expected: Invalid phase combinations are rejected.
  it.each([
    { phase: "unknown" },
    { phase: "searching", activeSearch: null },
    { phase: "battle", battle: null },
    { phase: "finished" }
  ])("rejects inconsistent phase: %j", (changes) => {

    // ARRANGE: Create a game with inconsistent phase data.
    const game = {
      ...newGame(123),
      ...changes
    };

    // ACT: Validate the modified game.
    const result = isValidGameState(game);

    // ASSERT: The inconsistent phase must be rejected.
    expect(result).toBe(false);
  });


  // [req-6.4]: Test a search belonging to another round.
  // Why: An outdated search must not be restored.
  // Expected: The game is rejected.
  it("rejects a search for the wrong round", () => {

    // ARRANGE: Create a valid search.
    const game = newGame(123);
    const bought = updateRun(game, (run) => buyItem(run, 0));

    const searching = startSearch(bought, {
      searchId: "test-search",
      round: bought.run.round
    });

    // Change the saved search round.
    const invalid = {
      ...searching,
      activeSearch: {
        searchId: "test-search",
        round: searching.run.round + 1
      }
    };

    // ACT: Validate the inconsistent search.
    const result = isValidGameState(invalid);

    // ASSERT: The search must have started before modification.
    expect(searching.phase).toBe("searching");

    // The incorrect search round must be rejected.
    expect(result).toBe(false);
  });

});

describe("Persisted battle replay [req-6.4]", () => {

  // [req-6.4]: Test replay data that JSON cannot represent.
  // Why: Validation accepts unknown values and must handle them safely.
  // Expected: A replay with a BigInt result is rejected without throwing.
  it("rejects a non-JSON replay result", () => {
    // ARRANGE: Replace the result of a real battle with a BigInt.
    const game = createTestBattle();
    const invalid = { ...game, battle: { ...game.battle, result: BigInt(1) } };

    // ACT: Validate the modified game.
    const valid = isValidGameState(invalid);

    // ASSERT: The malformed replay is rejected.
    expect(valid).toBe(false);
  });

  // [req-6.4]: Test an unfinished battle replay.
  // Why: A refresh during battle must preserve the existing combat.
  // Expected: The valid replay is accepted.
  it("accepts an unfinished battle replay", () => {

    // ARRANGE: Create a real battle.
    const game = createTestBattle();

    // ACT: Validate the battle state.
    const result = isValidGameState(game);

    // ASSERT: The replay must still be unfinished.
    expect(game.battle?.frame).toBe(0);

    // The battle state must be valid.
    expect(result).toBe(true);
  });


  // [req-6.4]: Test invalid replay frame indices.
  // Why: The UI must never access a nonexistent frame.
  // Expected: Invalid frame indices are rejected.
  it.each([
    -1,
    1000,
    1.5
  ])("rejects invalid replay frame: %s", (frame) => {

    // ARRANGE: Create a battle with an invalid frame.
    const game = createTestBattle();

    if (!game.battle) throw new Error("Expected a battle");

    game.battle.frame = frame;

    // ACT: Validate the corrupted replay.
    const result = isValidGameState(game);

    // ASSERT: The invalid frame must be rejected.
    expect(result).toBe(false);
  });


  // [req-6.4]: Test a changed battle winner.
  // Why: A saved replay must match the original simulation.
  // Expected: An inconsistent winner is rejected.
  it("rejects a modified battle winner", () => {

    // ARRANGE: Create a real battle.
    const game = createTestBattle();

    if (!game.battle) throw new Error("Expected a battle");

    // Change the winner to the opposite side.
    game.battle.result.winner =
      game.battle.result.winner === "player"
        ? "opponent"
        : "player";

    // ACT: Validate the changed result.
    const result = isValidGameState(game);

    // ASSERT: The modified result must be rejected.
    expect(result).toBe(false);
  });


  // [req-6.4]: Test corrupted replay data.
  // Why: BattleView requires a complete and valid frame sequence.
  // Expected: A replay without frames is rejected.
  it("rejects a replay without frames", () => {

    // ARRANGE: Create a battle and remove its frames.
    const game = createTestBattle();

    if (!game.battle) throw new Error("Expected a battle");

    game.battle.result.frames = [];

    // ACT: Validate the corrupted battle.
    const result = isValidGameState(game);

    // ASSERT: The replay must be rejected.
    expect(result).toBe(false);
  });


  // [req-6.4]: Test unknown opponent items.
  // Why: Invalid item IDs must not crash the battle simulation.
  // Expected: The saved battle is rejected safely.
  it("rejects an unknown opponent item", () => {

    // ARRANGE: Create a battle with an invalid opponent item.
    const game = createTestBattle();

    if (!game.battle) throw new Error("Expected a battle");

    game.battle.opponent.items = ["unknown-item"];

    // ACT: Validate the battle.
    const result = isValidGameState(game);

    // ASSERT: The invalid opponent must be rejected.
    expect(result).toBe(false);
  });


  // [req-6.4]: Test a completed battle in an active run.
  // Why: The run advances before leaving the completed replay.
  // Expected: The previous round's replay remains valid.
  it("accepts an already scored battle", () => {

    // ARRANGE: Create a battle and finish its replay.
    const game = createTestBattle();
    const completed = skipReplay(game);

    // ACT: Validate the completed replay.
    const result = isValidGameState(completed);

    // ASSERT: The run must have advanced.
    expect(completed.run.round).toBe(game.run.round + 1);

    // The opponent must still belong to the previous round.
    expect(completed.battle?.opponent.round)
      .toBe(game.run.round);

    // The completed replay must be valid.
    expect(result).toBe(true);
  });


  // [req-6.4]: Test resetting an already scored replay.
  // Why: A completed battle must not become unfinished again.
  // Expected: The inconsistent replay is rejected.
  it("rejects a reset replay after its result was applied", () => {

    // ARRANGE: Create and complete a battle.
    const completed = skipReplay(createTestBattle());

    if (!completed.battle) {
      throw new Error("Expected a battle");
    }

    // Reset the frame without resetting the scored run.
    completed.battle.frame = 0;

    // ACT: Validate the inconsistent game.
    const result = isValidGameState(completed);

    // ASSERT: The replay must not be accepted.
    expect(result).toBe(false);
  });

});

describe("Persisted final battle [req-6.4]", () => {

  // [req-6.4]: Test a battle that ends the entire run.
  // Why: The final battle does not advance the round.
  // Expected: Both the completed replay and result page are valid.
  it("accepts the final battle and finished game", () => {

    // ARRANGE: Create a run one battle away from completion.
    const game = newGame(123);

    game.run.round = 7;
    game.run.wins = 4;
    game.run.lives = 1;

    const battle = createTestBattle(game);

    // ACT: Finish the replay and leave the battle.
    const completed = skipReplay(battle);
    const finished = leaveBattle(completed);

    const validBattle = isValidGameState(completed);
    const validFinished = isValidGameState(finished);

    // ASSERT: The final battle must not advance the round.
    expect(completed.run.round).toBe(7);

    // Leaving the final battle must end the game.
    expect(finished.phase).toBe("finished");
    expect(finished.battle).toBeNull();

    // Both saved states must be valid.
    expect(validBattle).toBe(true);
    expect(validFinished).toBe(true);
  });

});

describe("Complete save validation [req-6.4]", () => {

  // [req-6.4]: Test validation of a serialized battle save.
  // Why: A complete battle must survive a serialization round trip.
  // Expected: The restored save matches the original and is valid.
  it("accepts a serialized and parsed battle save", () => {

    // ARRANGE: Create and serialize a battle save.
    const game = createTestBattle();
    const save = createSaveData(game);
    const raw = serializeSave(save);

    // ACT: Parse and validate the save.
    const parsed = parseSave(raw);
    const result = isValidSaveData(parsed);

    // ASSERT: All saved values must be preserved.
    expect(parsed).toEqual(save);

    // The complete save must be accepted.
    expect(result).toBe(true);
  });


  // [req-6.4]: Test an invalid game inside a valid save format.
  // Why: A valid run and version are not enough.
  // Expected: The full save is rejected.
  it("rejects a save with an inconsistent game phase", () => {

    // ARRANGE: Create a valid save with an invalid phase.
    const save = createSaveData(newGame(123));

    save.game.phase = "battle";

    // ACT: Validate the complete save.
    const result = isValidSaveData(save);

    // ASSERT: A battle phase without a replay must be rejected.
    expect(result).toBe(false);
  });


  // [req-6.4]: Test a submitted ID for an unfinished run.
  // Why: Only finished runs may be submitted.
  // Expected: The invalid submission status is rejected.
  it("rejects a submitted unfinished run", () => {

    // ARRANGE: Create a shop save marked as submitted.
    const game = newGame(123);

    const save = createSaveData(
      game,
      game.run.runId,
      "Player"
    );

    // ACT: Validate the save.
    const result = isValidSaveData(save);

    // ASSERT: An active run must not be marked as submitted.
    expect(result).toBe(false);
  });


  // [req-6.4]: Test submission metadata for a finished run.
  // Why: Successfully submitted runs must remain restorable.
  // Expected: Valid submission information is accepted.
  it("accepts a submitted finished run", () => {

    // ARRANGE: Create and complete the final battle.
    const game = newGame(123);

    game.run.round = 7;
    game.run.wins = 4;
    game.run.lives = 1;

    const battle = createTestBattle(game);
    const finished = leaveBattle(skipReplay(battle));

    const save = createSaveData(
      finished,
      finished.run.runId,
      "Player"
    );

    // ACT: Validate the finished save.
    const result = isValidSaveData(save);

    // ASSERT: The game must be finished and the save valid.
    expect(finished.phase).toBe("finished");
    expect(result).toBe(true);
  });

});

describe("Shop recovery [req-6.5]", () => {

  // [req-6.5]: Test restoring a shop after buying and rerolling.
  // Why: Refreshing must not refund gold or generate new offers.
  // Expected: The complete saved game remains unchanged.
  it("restores the shop without changing player progress", () => {

    // ARRANGE: Create a game, buy an item and reroll.
    const game = newGame(123);

    const bought = updateRun(game, (run) => buyItem(run, 0));
    const rerolled = updateRun(bought, rerollShop);

    const save = createSaveData(rerolled);
    const raw = serializeSave(save);

    // ACT: Restore the serialized save.
    const restored = restoreSave(raw);

    // ASSERT: Both shop actions must have succeeded.
    expect(bought).not.toBe(game);
    expect(rerolled).not.toBe(bought);

    // All saved values must remain unchanged.
    expect(restored).toEqual(save);
  });

  // [req-6.5]: Test recovery from interrupted matchmaking.
  // Why: The original HTTP request cannot resume after refresh.
  // Expected: Return to the same shop without changing the run.
  it("returns an interrupted search to the same shop", () => {

    // ARRANGE: Create a game and start matchmaking.
    const game = newGame(123);
    const bought = updateRun(game, (run) => buyItem(run, 0));

    const searching = startSearch(bought, {
      searchId: "test-search",
      round: bought.run.round
    });

    const original = structuredClone(searching);

    // ACT: Apply the refresh policy.
    const restored = restoreGame(searching);

    // ASSERT: The original search must have started.
    expect(searching.phase).toBe("searching");

    // The player must return to the shop.
    expect(restored.phase).toBe("shop");

    // The interrupted search must be cleared.
    expect(restored.activeSearch).toBeNull();
    expect(restored.error).toBeNull();

    // All player progress must be preserved.
    expect(restored.run).toEqual(searching.run);

    // The original game must not be mutated.
    expect(searching).toEqual(original);

    // The player must be able to search again.
    const retry = startSearch(restored, {
      searchId: "retry-search",
      round: restored.run.round
    });

    expect(retry.phase).toBe("searching");
    expect(retry.activeSearch?.round).toBe(searching.run.round);
  });

});

describe("Battle recovery [req-6.5]", () => {

  // [req-6.5]: Test restoring an unfinished battle replay.
  // Why: Refreshing must not change the opponent or battle result.
  // Expected: The same battle resumes at the saved frame.
  it("restores an unfinished replay unchanged", () => {

    // ARRANGE: Create a battle and advance its replay.
    const game = createTestBattle();
    const advanced = advanceReplay(game);

    const save = createSaveData(advanced);
    const raw = serializeSave(save);

    // ACT: Restore the battle save.
    const restored = restoreSave(raw);

    // ASSERT: The replay must have advanced before saving.
    expect(advanced.battle?.frame).toBe(1);

    // All battle and run data must be preserved.
    expect(restored).toEqual(save);

    // Continue the restored battle.
    if (!restored) throw new Error("Expected a restored save");

    const continued = advanceReplay(restored.game);

    // The replay must continue from the saved frame.
    expect(continued.battle?.frame).toBe(2);
  });

  // [req-6.5]: Test restoring an already scored battle.
  // Why: Refreshing must not apply a battle result twice.
  // Expected: Further replay actions leave the scored run unchanged.
  it("does not score a completed replay again", () => {

    // ARRANGE: Create and complete a battle.
    const game = createTestBattle();
    const completed = skipReplay(game);

    const raw = serializeSave(createSaveData(completed));

    // ACT: Restore the completed battle.
    const restored = restoreSave(raw);

    // ASSERT: The save must be restored successfully.
    expect(restored).not.toBeNull();

    if (!restored) throw new Error("Expected a restored save");

    // The already scored game must remain unchanged.
    expect(restored.game).toEqual(completed);

    // Attempt to complete the replay again.
    const skippedAgain = skipReplay(restored.game);
    const advancedAgain = advanceReplay(restored.game);

    // Both transitions must return the same game.
    expect(skippedAgain).toBe(restored.game);
    expect(advancedAgain).toBe(restored.game);

    // Leaving the replay must return to the next shop.
    const continued = leaveBattle(restored.game);

    expect(continued.phase).toBe("shop");
    expect(continued.run).toEqual(completed.run);
  });

  // [req-6.5]: Test a refresh before the final lost battle is scored.
  // Why: Refreshing must not allow the player to avoid defeat.
  // Expected: The original loss still ends the run.
  it("preserves a final defeat after refresh", () => {

    // ARRANGE: Create a run with one remaining life.
    const game = newGame(123);

    game.run.round = 3;
    game.run.lives = 1;

    // The existing test fixture uses a defensive player
    // against a damage-dealing opponent.
    const battle = createTestBattle(game);

    // Save the unfinished replay.
    const raw = serializeSave(createSaveData(battle));

    // ACT: Restore and complete the original battle.
    const restored = restoreSave(raw);

    if (!restored) throw new Error("Expected a restored save");

    const completed = skipReplay(restored.game);
    const finished = leaveBattle(completed);

    // ASSERT: The fixture must describe a losing battle.
    expect(battle.battle?.result.winner).toBe("opponent");

    // The saved winner must remain unchanged.
    expect(restored.game.battle?.result.winner).toBe("opponent");

    // The original defeat must still be applied.
    expect(completed.run.lives).toBe(0);
    expect(finished.phase).toBe("finished");

    // Completing the replay again must not change the result.
    expect(skipReplay(completed)).toBe(completed);
  });

});

describe("Finished game recovery [req-6.5]", () => {

  // [req-6.5]: Test restoring a completed and submitted run.
  // Why: Refreshing must preserve the result and submission status.
  // Expected: The complete save remains unchanged.
  it("restores a finished run with submission metadata", () => {

    // ARRANGE: Create a run one battle away from completion.
    const game = newGame(123);

    game.run.round = 7;
    game.run.wins = 4;
    game.run.lives = 1;

    const battle = createTestBattle(game);
    const finished = leaveBattle(skipReplay(battle));

    const save = createSaveData(
      finished,
      finished.run.runId,
      "Player"
    );

    const raw = serializeSave(save);

    // ACT: Restore the completed save.
    const restored = restoreSave(raw);

    // ASSERT: The run must have finished.
    expect(finished.phase).toBe("finished");

    // The run and all submission metadata must survive.
    expect(restored).toEqual(save);
  });

});

describe("Invalid save recovery [req-6.5]", () => {

  // [req-6.5]: Test malformed and incompatible save data.
  // Why: Invalid saves must not crash game initialization.
  // Expected: Recovery returns null.
  it.each([
    "",
    '{"version":1,',
    '{"version":999}'
  ])("returns null for an invalid save: %s", (raw) => {

    // ARRANGE: Use the supplied invalid JSON string.

    // ACT: Attempt to restore the save.
    const restored = restoreSave(raw);

    // ASSERT: Invalid data must not be restored.
    expect(restored).toBeNull();
  });

  // [req-6.5]: Test recovery of an impossible run.
  // Why: Valid JSON must not bypass game validation.
  // Expected: Recovery returns null.
  it("rejects a save containing impossible progress", () => {

    // ARRANGE: Create an inconsistent run.
    const game = newGame(123);

    game.run.round = 1;
    game.run.wins = 4;

    const raw = serializeSave(createSaveData(game));

    // ACT: Attempt to restore the invalid run.
    const restored = restoreSave(raw);

    // ASSERT: The impossible run must not be restored.
    expect(restored).toBeNull();
  });

});
