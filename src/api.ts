import type { Opponent } from "./types";

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
