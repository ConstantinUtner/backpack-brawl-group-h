import { useRef, useState, type SubmitEvent } from "react";
import { submitScore } from "../api";
import type { HallOfFameEntry, RunState, Submission } from "../types";

/** REQUIREMENT 7: Persist only the name, retry lock and confirmed submission status. */
const emptySubmission: Submission = { name: "", status: "not_submitted" };


/** REQUIREMENT 7: Restore saved form data from localStorage */
function readSubmission(key: string): Submission {
  try {
    //read run data from localStorage
    const saved = JSON.parse(localStorage.getItem(key) ?? "null");
 
    // Small check if saved is present
    if (saved) {
      return saved;
    }
  } catch {
    /** REQUIREMENT 7: Allow submission even when browser storage is unavailable. */
  }
  return emptySubmission;
}


/** REQUIREMENT 7: Show a separate score form for the completed run. */
export function ScoreForm({
  run,
  outcome,
}: {
  run: RunState;
  outcome: HallOfFameEntry["outcome"];
}) {
  //Looking for the run in the local storage (submission of the run)
  const storageKey = `backpack-brawl-submission:${run.runId}`;
 
  //contains persistent form data
  const [submission, setSubmission] = useState(() => readSubmission(storageKey));
  //controls temporary loading display
  const [submitting, setSubmitting] = useState(false);
  //contains latest error message
  const [error, setError] = useState<string | null>(null);
 
  //useRef for blocking another submission if immediately supported afterwards
  const requestInProgress = useRef(false);

  //set the submit-status for the submission and save for later checks
  const submitted = submission.status === "submitted";
 
  /** REQUIREMENT 7: Keep React state and browser storage together. */
  function saveSubmission(data: Submission) {
    //function for form data to change the data ()
    setSubmission(data);
 
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      /** REQUIREMENT 7: Keep the form usable without persistent storage. */
    }
  }

   /** REQUIREMENT 7: Submit once and retain identical data for safe retries. */
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    //Stops the browser from reloading the page
    event.preventDefault();
 
    const name = submission.name.trim();
 
    //requestInProgress blocks overlap of submits
    if (requestInProgress.current || submitted || !name) return;

    requestInProgress.current = true;

    //Load and disable button - manually currently
    setSubmitting(true);
    setError(null);

    saveSubmission({...submission, name});
 
    try {
      await submitScore({
        runId: run.runId,
        name,
        outcome,
        wins: run.wins,
        rounds: run.round,
        remainingLives: run.lives,
      });
 
      //Saves name for entry with status submitted
      saveSubmission({ name, status: "submitted" });
    } catch (cause) {
      //sets error (useState) with the message or Submission failed
      setError(
        cause instanceof Error ? cause.message : "Submission failed."
      );
    } finally {
      //Now the request is free again
      requestInProgress.current = false;
      setSubmitting(false);
    }
  }

   /** REQUIREMENT 7: Use labels for each submission state. */
  let buttonText = "Submit score";
  if (submitted) buttonText = "Submitted";
  if (submitting) buttonText = "Submitting…";
 
  /** REQUIREMENT 7: Display the name field and submission feedback. */
  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-panel-edge bg-panel p-4"
    >
      <h2 className="text-xl font-bold">Submit your score</h2>
 
      <label htmlFor="score-name" className="block py-2">
        Player name (1–30 characters)
      </label>
 
      <input
        id="score-name"
        required
        maxLength={30}
        value={submission.name}
        //OnChange event for submission, triggers saveSubmission function with target value (name)
        onChange={(event) =>
          saveSubmission({ ...submission, name: event.target.value })
        }
        className="rounded border border-panel-edge p-2"
      />
 
      <button
        type="submit"
        disabled={submitting || submitted || !submission.name.trim()}
        className="ml-2 rounded border border-panel-edge px-4 py-2 disabled:opacity-50"
      >
        {/**Only enabled if the name is no submission is running, if the run was already submitted or the name is empty*/}
        {buttonText}
      </button>
 
      {submitting && <p role="status">Sending your score…</p>}
      {submitted && <p role="status">Score submitted successfully.</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
