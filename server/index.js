import cors from "cors";
import express from "express";
import { opponentForRound, parseRound } from "./opponents.js";

/** REQUIREMENT 7: Export the API for endpoint tests without opening a port. */

export const app = express();
/** Bugfix: After 2 runs the runs have not been saved. */
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

/** REQUIREMENT 7: Forgot to do something with the route I created inside api.ts --> i needed endpoints to work */
app.get("/api/hall-of-fame", (_req, res) => {
  // Copy the array so sorting does not change the submission order.
  const sortedEntries = [...hallOfFame];
 
  //Sorting done with our DECISION.md-> how we decided
  sortedEntries.sort((a, b) => {
    // Victories come before defeats.
    if (a.outcome !== b.outcome) {
      return a.outcome === "victory" ? -1 : 1;
    }
 
    // More wins come first.
    if (a.wins !== b.wins) {
      return b.wins - a.wins;
    }
 
    // Fewer rounds come first.
    if (a.rounds !== b.rounds) {
      return a.rounds - b.rounds;
    }
 
    // Equal scores keep their original submission order.
    return 0;
  });
 
  //converts to json and sets response´s content type to application/json --> Frontend reads response
  res.json(sortedEntries);
});


/** REQUIREMENT 7: Not only a get - but I need to submit the data I created with the types and submission forms */
app.post("/api/hall-of-fame", (req, res) => {
  const { runId, name, outcome, wins, rounds, remainingLives } = req.body ?? {};

  const reject = (error) => res.status(400).json({ error });

  // Check the UUID before using it --> runId as DECISION.md
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof runId !== "string" || !uuid.test(runId)) return reject("Invalid runId");

  // Normalize the submitted data.
  const entry = {
    runId: runId.toLowerCase(),
    name: typeof name === "string" ? name.trim() : name,
    outcome, wins, rounds, remainingLives,
  };

  // Return an existing entry only if all its data matches.
  const existing = hallOfFame.find((saved) => saved.runId === entry.runId);

  if (existing) {
    const identical = Object.keys(entry).every((key) => entry[key] === existing[key]);

    if (identical) return res.json(existing);

    //Resolve duplication, which is needed for the requirement. No duplicate runId submits ("and never submits the same run twice")
    return res.status(409).json({ error: "This run already exists with different data" });
  }

  //Refactor: The API validates every submitted run and rejects invalid or implausible data with a clear error.
  if (typeof entry.name !== "string" || !entry.name || entry.name.length > 30){
    return reject("Name must contain 1–30 characters");
  }
  
  if (!Number.isInteger(wins) || wins < 0 || wins > 5) {
    return reject("Wins must be a whole number from 0 to 5");
  }
  
  if (!Number.isInteger(remainingLives) || remainingLives < 0 || remainingLives > 3){
    return reject("Remaining lives must be a whole number from 0 to 3");
  }

  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 7) {
    return reject("Rounds must be a whole number from 1 to 7");
  }
  
  if (rounds !== wins + (3 - remainingLives)) {
    return reject("Rounds must equal wins + lost lives");
  }

  // Check that the run really ended --> small check.
  const victory = outcome === "victory" && wins === 5 && remainingLives > 0;
  const defeat = outcome === "defeat" && remainingLives === 0 && wins < 5;
  if (!victory && !defeat) return reject("The run must be a finished victory or defeat");

  // Store the entry and send the array back through res.status with a 201 HTTP status
  hallOfFame.push(entry);
  return res.status(201).json(entry);
});

/** BUGFIX: Returning a readable JSON --> error after testing  */
app.use((error, _req, res, next) => {
  // Handle invalid JSON detected by express.json().
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "Request body must be valid JSON",
    });
  }

  // Let Express handle other errors normally.
  next(error);
});

app.listen(port, () => console.log(`Backpack Brawl API listening on http://localhost:${port}`));
