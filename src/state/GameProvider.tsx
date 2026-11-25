import { useRef, useState, type ReactNode } from "react";
import { newGame } from "../game";
import type { SaveData } from "../types";
import { createSaveData, loadGame, saveGame } from "../persistence";
import { GameContext, type GameContextValue } from "./GameContext";

const randomSeed = () => Math.floor(Math.random() * 2 ** 32);

/** Holds and persists the game state across navigation and refreshes. */
export function GameProvider({ children }: { children: ReactNode }) {
  // [req-6.7]: Restore the saved game and its metadata on initialization.
  const [save, setSave] = useState<SaveData | null>(loadGame);

  // [req-6.7]: Keep the latest state available between React renders.
  const saveRef = useRef(save);

  // [req-6.7]: Persist changes before publishing them to React.
  function commitSave(next: SaveData): void {
    if (!saveGame(next)) {
      console.warn("Game progress could not be saved.");
    }

    saveRef.current = next;
    setSave(next);
  }

  const value: GameContextValue = {
    game: save?.game ?? null,

    // [req-6.8]: Derive the form state from the persisted save
    // instead of maintaining a separate submission state.
    submission: {
      name: save?.submissionName ?? "",
      status:
        save && save.submittedRunId === save.game.run.runId
          ? "submitted"
          : "not_submitted",
    },

    // [req-6.8]: Persist submission changes together with the game.
    updateSubmission: (runId, submission) => {
      const current = saveRef.current;

      // Ignore updates for missing, different or unfinished runs.
      if (
        !current ||
        current.game.run.runId !== runId ||
        current.game.phase !== "finished"
      ) return;

      // Prevent changes after a successful submission.
      if (current.submittedRunId === runId) return;

      commitSave({
        ...current,
        submissionName: submission.name,
        submittedRunId:
          submission.status === "submitted" ? runId : null,
      });
    },

    // [req-6.7]: Immediately persist a newly created run.
    startNewRun: () => {
      commitSave(createSaveData(newGame(randomSeed())));
    },

    // [req-6.7]: Save successful transitions without losing metadata.
    update: (transition) => {
      const current = saveRef.current;

      if (!current) return;

      const next = transition(current.game);

      if (next === current.game) return;

      commitSave({
        ...current,
        game: next,
      });
    },
  };

  return <GameContext value={value}>{children}</GameContext>;
}
