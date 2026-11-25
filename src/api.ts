import type { HallOfFameEntry, Opponent } from "./types";

/** Requests an opponent for the given round or throws an error. */
export async function fetchOpponent(
  round: number,

  // [req-5.3]: Allow cancellation of the request.
  signal?: AbortSignal,
): Promise<Opponent> {
  let response: Response;

  try {
    // [req-5.3]: Send the request with the optional abort signal.
    response = await fetch(
      `/api/opponents?round=${encodeURIComponent(round)}`,
      { signal },
    );
  } catch (error) {
    // [req-5.3]: Rethrow cancellation errors unchanged.
    if (signal?.aborted) throw error;

    // [req-5.3]: Throw a readable network error and preserve its cause.
    throw new Error("Could not reach the opponent service. Please try again.", {
      cause: error,
    });
  }

  // Handle unsuccessful HTTP responses.
  if (!response.ok) {
    // Try to read the server's error message.
    const body = (await response.json().catch(() => {
      // [req-5.3]: Do not swallow cancellation errors while reading the body.
      signal?.throwIfAborted();

      // Use null if the body cannot be read.
      return null;
    })) as { error?: string } | null;

    // Throw the server's error message or a fallback with the HTTP status.
    throw new Error(
      body?.error ?? `Opponent search failed (${response.status})`,
    );
  }

  // Parse and return the opponent.
  return response.json() as Promise<Opponent>;
}

/** REQUIREMENT 7: Handle HTTP failures, redirects and unreadable API responses. */
/** Refactoring not needed: Reuse response handling for a single entry or a ranking. */ 
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

/** REQUIREMENT 7: Fetch the HallOfFame data to load the list, return the complete list */
export const fetchHallOfFame = (): Promise<HallOfFameEntry[]> =>
  hallOfFameRequest<HallOfFameEntry[]>();

/** REQUIREMENT 7: Submit the(one confirmed) score as HallOfFameEntry and trigger the function above*/
export const submitScore = (entry: HallOfFameEntry): Promise<HallOfFameEntry> => hallOfFameRequest<HallOfFameEntry>({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(entry),
});
