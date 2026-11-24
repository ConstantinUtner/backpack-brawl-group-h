import { describe, expect, it } from "vitest";
import { newGame, updateRun } from "./game";
import { buyItem, rerollShop } from "./run";

import {
  SAVE_VERSION,
  createSaveData,
  serializeSave,
  parseSave
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
