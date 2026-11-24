import type { GameState, SaveData } from "./types";

// [req-6.2]: Define the currently supported save format version.
export const SAVE_VERSION = 1;

// [req-6.2]: Wrap the current game and submission information
// in a versioned save object.
export function createSaveData(
  game: GameState,
  submittedRunId: string | null = null,
  submissionName = "",
): SaveData {
  return {
    version: SAVE_VERSION,
    game,
    submittedRunId,
    submissionName,
  };
}

// [req-6.2]: Convert the complete save object into a JSON string
// so it can later be stored in localStorage.
export function serializeSave(save: SaveData): string {
  return JSON.stringify(save);
}

// [req-6.2]: Parse saved JSON without assuming that its contents
// are valid. Malformed JSON returns null instead of crashing.
export function parseSave(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
