import { ScoreForm } from "../components/ScoreForm";
import { RunHeader } from "../components/RunHeader";
import { RunOver } from "../components/RunOver";
import { runOutcome } from "../run";
import { useActiveGame } from "../state/GameContext";
import { useEffect, useRef } from "react";

export function ResultPage() {
  const { game, startNewRun } = useActiveGame();
  const outcome = runOutcome(game.run);

    /** REQUIREMENT 7: Access the native score submission dialog. */
  const dialogRef = useRef<HTMLDialogElement>(null);

  
  /** REQUIREMENT 7: Offer score submission when a finished run is shown. */
  useEffect(() => {
    //Don't trigger if there is no runOutcome
    if (!outcome) return;
 
    //Otherwise show the modal window (dialog) from the return below
    const dialog = dialogRef.current;
    dialog?.showModal();
 
    return () => dialog?.close();
  }, [outcome, game.run.runId]);
 
  if (!outcome) return null;

  // Starting a new run moves the phase to "shop", so RequireRoute redirects to the shop.
  /** REQUIREMENT 7: Embed the separate submission form only for finished runs. */
  return (
    <>
      <RunHeader run={game.run} />
      <RunOver run={game.run} outcome={outcome} onNewRun={startNewRun} />
      
       {/** REQUIREMENT 7: Create a popup to submit the current run to the existing ScoreForm */}
        <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded border border-panel-edge px-4 py-2"
      >
        Submit score
      </button>
 
      <dialog
        ref={dialogRef}
        aria-labelledby="score-dialog-title"
        className="m-auto w-full max-w-lg rounded-xl border border-panel-edge bg-panel p-6 text-inherit backdrop:bg-black/60"
      >
        <h2 id="score-dialog-title" className="mb-4 text-xl font-bold">
          Add your run to the Hall of Fame
        </h2>
 
        {/*Embed the ScoreForm into the dialog window (Popup)*/}
        <ScoreForm key={game.run.runId} run={game.run} outcome={outcome}/>
 
        <button
          type="button"
          //Closing the dialog window after click on Close button
          onClick={() => dialogRef.current?.close()}
          className="mt-4 rounded border border-panel-edge px-4 py-2"
        >
          Close
        </button>
      </dialog>
    </>
  );
}
