import { describe, expect, it } from "vitest";
import { newGame, updateRun } from "./game";
import { applyBattleResult, buyItem, newRun, rerollShop } from "./run";

import {
  SAVE_VERSION,
  createSaveData,
  serializeSave,
  parseSave,
  isValidRunState,
  hasValidSaveStructure,
} from "./persistence";

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
