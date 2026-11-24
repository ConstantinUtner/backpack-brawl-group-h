import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOpponent } from "./api";
import type { Opponent } from "./types";

// [req-5.3]: Restore the original fetch function after each test
// so mocks cannot affect other tests.
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Opponent API requests [req-5.3]", () => {

  // [req-5.3]: Test a successful opponent request.
  // Why: Request lifecycle changes must preserve normal matchmaking.
  // Expected: The correct endpoint is called and the opponent is returned.
  it("returns an opponent from a successful request", async () => {

    // ARRANGE: Create a deterministic opponent.
    const opponent: Opponent = {
      id: "test-opponent",
      name: "Test Opponent",
      icon: "",
      hp: 40,
      round: 1,
      items: ["pot-lid"]
    };

    // Simulate a successful HTTP response.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(opponent), {
        status: 200
      })
    );

    // Replace the real fetch function.
    vi.stubGlobal("fetch", fetchMock);

    // ACT: Request an opponent for round one.
    const result = await fetchOpponent(1);

    // ASSERT: Exactly one HTTP request must be made.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The requested round must be included in the URL.
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/opponents?round=1",
      { signal: undefined }
    );

    // The returned opponent must match the response body.
    expect(result).toEqual(opponent);
  });

  // [req-5.3]: Test forwarding the abort signal.
  // Why: Cancellation only works if fetch receives the controller's signal.
  // Expected: The HTTP request uses the exact supplied abort signal.
  it("passes the abort signal to fetch", async () => {

    // ARRANGE: Create an abort controller.
    const controller = new AbortController();

    // Create a deterministic opponent.
    const opponent: Opponent = {
      id: "test-opponent",
      name: "Test Opponent",
      icon: "",
      hp: 40,
      round: 1,
      items: ["pot-lid"]
    };

    // Simulate a successful API response.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(opponent), {
        status: 200
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    // ACT: Request an opponent using the controller's signal.
    await fetchOpponent(1, controller.signal);

    // ASSERT: The signal must be forwarded to fetch.
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/opponents?round=1",
      { signal: controller.signal }
    );

    // A normal successful request must not abort the signal.
    expect(controller.signal.aborted).toBe(false);
  });

  // [req-5.3]: Test an HTTP error returned by the opponent service.
  // Why: Server error messages must remain understandable to the player.
  // Expected: The API rejects with the error message from the response.
  it("preserves the server error message", async () => {

    // ARRANGE: Define an error message from the server.
    const message = "The arena gates are shut.";

    // Simulate an HTTP 503 response containing the error.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: message }), {
        status: 503
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    // ACT: Request an opponent.
    const request = fetchOpponent(1);

    // ASSERT: The server error message must be preserved.
    await expect(request).rejects.toThrow(message);
  });

  // [req-5.3]: Test an HTTP error without a valid JSON body.
  // Why: Invalid error responses must still produce a usable message.
  // Expected: The API rejects with a fallback containing the HTTP status.
  it("uses a fallback message for invalid error bodies", async () => {

    // ARRANGE: Simulate an HTTP error with a non-JSON body.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Service unavailable", {
        status: 503
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    // ACT: Request an opponent.
    const request = fetchOpponent(1);

    // ASSERT: The HTTP status must appear in the fallback message.
    await expect(request).rejects.toThrow(
      "Opponent search failed (503)"
    );
  });

  // [req-5.3]: Test a network failure during matchmaking.
  // Why: Technical network errors should not be shown directly to players.
  // Expected: The API rejects with an understandable retry message.
  it("provides an understandable network error", async () => {

    // ARRANGE: Simulate a network connection failure.
    const fetchMock = vi.fn().mockRejectedValue(
      new TypeError("Failed to fetch")
    );

    vi.stubGlobal("fetch", fetchMock);

    // ACT: Request an opponent.
    const request = fetchOpponent(1);

    // ASSERT: The technical error must be replaced
    // with an understandable message.
    await expect(request).rejects.toThrow(
      "Could not reach the opponent service. Please try again."
    );
  });

  // [req-5.3]: Test cancellation of an ongoing opponent request.
  // Why: Aborted requests must reject instead of returning an opponent.
  // Expected: The original cancellation error is preserved.
  it("rejects an ongoing request when it is aborted", async () => {

    // ARRANGE: Create an abort controller.
    const controller = new AbortController();

    // Create the error produced by request cancellation.
    const abortError = new DOMException(
      "The request was aborted",
      "AbortError"
    );

    // Simulate a pending HTTP request that listens for cancellation.
    const fetchMock = vi.fn(
      (_url: string, options: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          options.signal?.addEventListener(
            "abort",
            () => reject(abortError),
            { once: true }
          );
        });
      }
    );

    vi.stubGlobal("fetch", fetchMock);

    // Start the request while the signal is still active.
    const request = fetchOpponent(1, controller.signal);

    // ACT: Cancel the ongoing request.
    controller.abort();

    // ASSERT: The request must reject with the original abort error.
    await expect(request).rejects.toBe(abortError);

    // The signal must indicate cancellation.
    expect(controller.signal.aborted).toBe(true);
  });
});
