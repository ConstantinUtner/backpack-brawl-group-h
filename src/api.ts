import type { HallOfFameEntry, Opponent } from "./types";

/** Asks the API for this round's opponent; throws with the server's error text on failure. */
export async function fetchOpponent(round: number): Promise<Opponent> {
  const response = await fetch(`/api/opponents?round=${encodeURIComponent(round)}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Opponent search failed (${response.status})`);
  }
  return response.json() as Promise<Opponent>;
}

/** REQUIREMENT 7: Handle HTTP failures, redirects and unreadable API responses. */
/** TODO: Change from T to a real element, like Promise<HallOfFameEntry> or so */
async function hallOfFameRequest<T>(init?: RequestInit): Promise<T> {
  const response = await fetch("/api/hall-of-fame", { ...init, redirect: "error" });
  
  //Automatically returns a Promise with response.json
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    //Request the hall-of-fame api call
    throw new Error(body?.error ?? `Hall of Fame request failed (${response.status})`);
  }
  if (!body) { 
    //The Promise is nothing that can be parsed to get the information (await gets the information e.g. getName() from Promise<string>)
    throw new Error("The Hall of Fame API returned an unreadable response");
  }
  return body as T;
}

/** REQUIREMENT 7: Fetch the HallOfFame data to load the list */
export const fetchHallOfFame = () =>
  hallOfFameRequest<HallOfFameEntry[]>();

/** REQUIREMENT 7: Submit the score as HallOfFameEntry and trigger the function above*/
export const submitScore = (entry: HallOfFameEntry) => hallOfFameRequest<HallOfFameEntry>({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(entry),
});
