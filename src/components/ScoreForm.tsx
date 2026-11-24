import { useActionState, useState } from "react";
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

  //BUGFIX:The code down below is no longer needed, preventDefault() is also prevented

  /* const [submitting, setSubmitting] = useState(false);
  //contains latest error message
  const [error, setError] = useState<string | null>(null);
 
  //useRef for blocking another submission if immediately supported afterwards
  const requestInProgress = useRef(false); */

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
  /** Bugfix: Let React track pending state and return submission errors. */
  //Error is returned by the action, either error or null
  //Function submitAction is passed through the action in the form below
  //Pending is automatically true while React processes the action
const [error, submitAction, pending] = useActionState<string | null, FormData>(
  async (_previousError, formData) => {
    //name ="name" in html code makes the input available through FormData to get the information
    const name = String(formData.get("name") ?? "").trim();
 
    if (submitted || !name) return null;
 
    saveSubmission({ name, status: "not_submitted" });
 
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
      return null;
    } catch (cause) {
      return cause instanceof Error ? cause.message : "Submission failed.";
    }
  },
  null
);

   /** REQUIREMENT 7: Use labels for each submission state. */
 return (
  //action connects the submission to React´s async function
  <form action={submitAction}>
    <fieldset disabled={pending || submitted}>
      <label htmlFor="score-name">Player name</label>
 
      <input
        id="score-name"
        name="name"
        required
        maxLength={30}
        /** The submission.name is not cleared if disabled or if submit fails. Retry has the same value (part of requirement) */
        value={submission.name}
        //OnChange event for submission, triggers saveSubmission function with target value (name) - ... submission for new object because of manipulation
        onChange={(event) =>
          saveSubmission({ ...submission, name: event.target.value })
        }
      />
 
      <button type="submit" disabled={!submission.name.trim()}>
        {pending ? "Submitting…" : submitted ? "Submitted" : "Submit score"}
      </button>
    </fieldset>
 
    {pending && <p role="status">Sending your score…</p>}
    {submitted && <p role="status">Score submitted successfully.</p>}
    {error && <p role="alert">{error}</p>}
  </form>
);
}
