import { useActionState } from "react";
import { submitScore } from "../api";
import { useActiveGame } from "../state/GameContext";
import type { HallOfFameEntry, RunState } from "../types";

/** REQUIREMENT 7: Show a separate score form for the completed run. */
export function ScoreForm({
  run,
  outcome,
}: {
  run: RunState;
  outcome: HallOfFameEntry["outcome"];
}) {
  // [req-6.8]: Use the central submission state instead
  // of maintaining separate state and localStorage entries.
  const { submission, updateSubmission } = useActiveGame();

  const submitted = submission.status === "submitted";

  const [error, submitAction, pending] =
    useActionState<string | null, FormData>(
      async (_previousError, formData) => {
        const name = String(formData.get("name") ?? "").trim();

        if (submitted || !name || name.length > 30) return null;

        // [req-6.8]: Persist the name before sending the request
        // so it remains available for retries after a refresh.
        updateSubmission(run.runId, {
          name,
          status: "not_submitted",
        });

        try {
          await submitScore({
            runId: run.runId,
            name,
            outcome,
            wins: run.wins,
            rounds: run.round,
            remainingLives: run.lives,
          });

          // [req-6.8]: Persist success only after API confirmation.
          updateSubmission(run.runId, {
            name,
            status: "submitted",
          });

          return null;
        } catch (cause) {
          return cause instanceof Error
            ? cause.message
            : "Submission failed.";
        }
      },
      null,
    );

  /** REQUIREMENT 7: Use labels for each submission state. */
  return (
    <form action={submitAction}>
      <fieldset
        disabled={pending || submitted}
        className="col-span-2 mb-3 flex min-w-0 flex-col gap-3"
      >
        <label htmlFor="score-name" className="font-bold">Player name</label>

        <input
          id="score-name"
          name="name"
          required
          maxLength={30}
          value={submission.name}
          // [req-6.8]: Persist the entered name through the GameProvider.
          onChange={(event) =>
            updateSubmission(run.runId, {
              ...submission,
              name: event.target.value,
            })
          }
          className="w-full rounded border border-panel-edge bg-transparent px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <button
          type="submit"
          disabled={pending || submitted || !submission.name.trim()}
          className="col-start-1 row-start-3 justify-self-start rounded border border-panel-edge px-4 py-2 disabled:opacity-50"
        >
          {pending ? "Submitting…" : submitted ? "Submitted" : "Submit score"}
        </button>
      </fieldset>

      <div className="col-span-2 mt-3">
        {pending && <p role="status">Sending your score…</p>}
        {submitted && <p role="status">Score submitted successfully.</p>}
        {error && <p role="alert">{error}</p>}
      </div>
    </form>
  );
}
