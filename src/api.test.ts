import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHallOfFame, submitScore } from "./api";
import { newRun } from "./run";

/** REQUIREMENT 7: Verify request data, response handling and stable run identity. */
const entry = { runId: "550e8400-e29b-41d4-a716-446655440000", name: "Player", outcome: "victory" as const, wins: 5, rounds: 7, remainingLives: 1 };
afterEach(() => vi.unstubAllGlobals());
describe("Hall of Fame client", () => {
  it("posts the complete score and reads the confirmed entry", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(entry), { status: 201 }));
    vi.stubGlobal("fetch", request);
    await expect(submitScore(entry)).resolves.toEqual(entry);
    expect(request).toHaveBeenCalledWith("/api/hall-of-fame", expect.objectContaining({ method: "POST", body: JSON.stringify(entry), redirect: "error" }));
  });

  it("reads an empty ranking", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]")));
    await expect(fetchHallOfFame()).resolves.toEqual([]);
  });

  it.each([301, 400, 401, 409, 500])("reports HTTP %s errors", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Please retry" }), { status })));
    await expect(submitScore(entry)).rejects.toThrow("Please retry");
  });

  it("handles non-JSON errors and network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 500 })));
    await expect(fetchHallOfFame()).rejects.toThrow("500");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network unavailable")));
    await expect(fetchHallOfFame()).rejects.toThrow("Network unavailable");
  });

  it("rejects an unreadable success instead of marking it successful", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not JSON")));
    await expect(submitScore(entry)).rejects.toThrow("unreadable");
  });

  it("assigns different IDs to separate runs", () => {
    const first = newRun(123);
    expect(first.runId).not.toBe(newRun(123).runId);
    expect(first.runId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
