import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./index.js";

/** REQUIREMENT 7: Exercise real HTTP validation, idempotency and ranking without extra dependencies. */
let server;
let url;
beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  url = `http://127.0.0.1:${server.address().port}/api/hall-of-fame`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
const score = { runId: "550e8400-e29b-41d4-a716-446655440000", name: " Player ", outcome: "victory", wins: 5, rounds: 7, remainingLives: 1 };
const post = (body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("Hall of Fame endpoints", () => {
  it("starts with an empty list", async () => {
    expect(await (await fetch(url)).json()).toEqual([]);
  });

  it.each([
    { runId: "bad" }, { name: " " }, { name: "a".repeat(31) },
    { wins: 6 }, { wins: 1.5 }, { remainingLives: -1 }, { remainingLives: 4 },
    { rounds: 0 }, { rounds: 8 }, { rounds: 6.5 }, { rounds: 6 },
    { outcome: "defeat" }, { outcome: "unknown" },
    { wins: 4, rounds: 6 },
  ])("rejects implausible values %j", async (change) => {
    const response = await post({ ...score, ...change });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toEqual(expect.any(String));
  });

  it("stores trimmed names once, accepts retries, and rejects changed data", async () => {
    const created = await post(score);
    expect(created.status).toBe(201);
    const saved = await created.json();
    expect(saved.name).toBe("Player");
    const retry = await post(score);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(saved);
    expect((await post({ ...score, name: "Other" })).status).toBe(409);
    expect(await (await fetch(url)).json()).toHaveLength(1);
  });

  it("ranks victories, wins, rounds and earlier submissions in that order", async () => {
    const entries = [
      { name: "Defeat low", outcome: "defeat", wins: 0, rounds: 3, remainingLives: 0 },
      { name: "Victory first tie", outcome: "victory", wins: 5, rounds: 5, remainingLives: 3 },
      { name: "Victory second tie", outcome: "victory", wins: 5, rounds: 5, remainingLives: 3 },
      { name: "Defeat high", outcome: "defeat", wins: 4, rounds: 7, remainingLives: 0 },
    ];
    for (const entry of entries) {
      expect((await post({ ...entry, runId: crypto.randomUUID() })).status).toBe(201);
    }
    expect((await (await fetch(url)).json()).map((entry) => entry.name)).toEqual([
      "Victory first tie", "Victory second tie", "Player", "Defeat high", "Defeat low",
    ]);
  });

  it("returns a clear JSON error for malformed JSON", async () => {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("valid JSON");
  });
});
