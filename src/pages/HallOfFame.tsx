import { useEffect, useState } from "react";
import { fetchHallOfFame } from "../api";
import type { HallOfFameEntry } from "../types";

/** REQUIREMENT 7: Show a public ranking with separate loading, empty and error states. */
export function HallOfFame() {
  /** TODO: Refactoring, because I use duplicated entries currently, in ScoreForm and in HallOfFame.tsx */
  const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  /** REQUIREMENT 7: Ignore stale responses after navigation or retry. */
  useEffect(() => {
    /** TODO: Make this better, reactive - we act with react. Not the usual way you know, Julia */
    let active = true;
    //Get the results and act on it
    fetchHallOfFame().then((result) => {
      if (active) setEntries(result);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load the Hall of Fame.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [attempt]);

  return (
    <section className="rounded-xl border border-panel-edge bg-panel p-4">
      <h2 className="text-2xl font-bold">Hall of Fame</h2>

      <p className="py-2 text-muted">Victory before defeat, then more wins, then fewer rounds. Ties: earlier submission first.</p>
      {/** REQUIREMENT 7: The interface shows loading, empty and error states */}
      {loading ? <p role="status">Loading scores…</p> : error ? <div role="alert">
        <p>{error}</p>

        <button onClick={() => { setLoading(true); setError(null); setAttempt(attempt + 1); }}>Retry loading</button>
      
      </div> : entries.length === 0 ? <p>No runs submitted yet.</p> : (
        <div className="overflow-x-auto">

          <table className="w-full text-left">
            <thead><tr><th>Rank</th><th>Name</th><th>Outcome</th><th>Wins</th><th>Rounds</th><th>Lives</th></tr></thead>
            <tbody>{entries.map((entry, index) => <tr key={entry.runId}>
              
              <td>{index + 1}</td><td>{entry.name}</td><td>{entry.outcome}</td>
              <td>{entry.wins}</td><td>{entry.rounds}</td><td>{entry.remainingLives}</td>
            
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
