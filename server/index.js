import cors from "cors";
import express from "express";
import { opponentForRound, parseRound } from "./opponents.js";

/** REQUIREMENT 7: Export the API for endpoint tests without opening a port. */
export const app = express();
/** REQUIREMENT 7: Keep ranked runs in memory in successful submission order. */
const hallOfFame = [];
const port = Number(process.env.PORT ?? 4200);

app.use(cors()); app.use(express.json());
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "backpack-brawl" }));

app.get("/api/opponents", (req, res) => {
  const requested = Number(req.query.latency ?? process.env.API_LATENCY ?? 1200);
  const latency = Number.isFinite(requested) ? Math.max(0, Math.min(5000, requested)) : 1200;
  setTimeout(() => {
    const round = parseRound(req.query.round);
    if (round === null) return res.status(400).json({ error: "round must be a positive whole number" });
    if (req.query.fail === "true" || process.env.API_FAIL === "true") {
      return res.status(503).json({ error: "The arena gates are shut. No challenger answered the call." });
    }
    res.json(opponentForRound(round));
  }, latency);
});

/** REQUIREMENT 7: Stable sorting keeps earlier submissions first on equal scores. */
app.get("/api/hall-of-fame", (_req, res) => {
  res.json([...hallOfFame].sort((a, b) =>
    Number(b.outcome === "victory") - Number(a.outcome === "victory") ||
    b.wins - a.wins || a.rounds - b.rounds));
});

/** REQUIREMENT 7: Validate finished runs and make identical retries idempotent. */
app.post("/api/hall-of-fame", (req, res) => {
  const { runId, name, outcome, wins, rounds, remainingLives } = req.body ?? {};
  const reject = (error) => res.status(400).json({ error });
  if (typeof runId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) {
    return reject("runId must be a UUID");
  }
  const existing = hallOfFame.find((entry) => entry.runId === runId.toLowerCase());
  const entry = { runId: runId.toLowerCase(), name: typeof name === "string" ? name.trim() : name, outcome, wins, rounds, remainingLives };
  if (existing) {
    return Object.keys(existing).every((key) => existing[key] === entry[key])
      ? res.json(existing)
      : res.status(409).json({ error: "This run was already submitted with different data" });
  }
  if (typeof entry.name !== "string" || entry.name.length < 1 || entry.name.length > 30) return reject("name must contain 1–30 characters after trimming");
  if (!Number.isInteger(wins) || wins < 0 || wins > 5) return reject("wins must be a whole number from 0 to 5");
  if (!Number.isInteger(remainingLives) || remainingLives < 0 || remainingLives > 3) return reject("remainingLives must be a whole number from 0 to 3");
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 7 || rounds !== wins + (3 - remainingLives)) return reject("rounds must equal wins + lost lives and be between 1 and 7");
  if (!((outcome === "victory" && wins === 5 && remainingLives > 0) || (outcome === "defeat" && remainingLives === 0 && wins < 5))) return reject("outcome must describe a finished victory or defeat");
  hallOfFame.push(entry);
  return res.status(201).json(entry);
});

/** REQUIREMENT 7: Malformed JSON receives the same readable API error format. */
app.use((error, _req, res, next) => {
  if (error.type === "entity.parse.failed") return res.status(400).json({ error: "Request body must be valid JSON" });
  next(error);
});

/** REQUIREMENT 7: Tests import the app without starting the normal server. */
if (!process.env.VITEST) app.listen(port, () => console.log(`Backpack Brawl API listening on http://localhost:${port}`));