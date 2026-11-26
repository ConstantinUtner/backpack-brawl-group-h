# Backpack Brawl API

The local API is a small Express server in `server/index.js`. It listens on port 4200 (override with the `PORT` environment variable). During Vite development, `/api` is proxied to it, so the frontend uses relative URLs such as `/api/opponents?round=1`. All responses are JSON. The opponent service is stateless. Hall of Fame entries are stored
in memory on the server and are lost when the server restarts.

## `GET /api/health`

Always answers immediately with status 200:

```json
{ "ok": true, "service": "backpack-brawl" }
```

## `GET /api/opponents`

Returns the opponent for one round of a run. The opponent table lives in `server/opponents.js`.

### Query parameters

| Parameter | Required | Meaning |
|---|---|---|
| `round` | yes | The 1-based round number. Must be a positive whole number written in digits (`1`, `2`, …). |
| `latency` | no | Response delay in milliseconds, clamped to 0–5000. Defaults to 1200. A value that is not a number falls back to the default. |
| `fail` | no | `fail=true` forces a 503 response (see below). |

### Success — 200

```json
{
  "id": "mossback-hermit",
  "name": "Mossback Hermit",
  "icon": "🐢",
  "hp": 25,
  "items": ["chipped-dagger", "pot-lid"],
  "round": 1
}
```

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable identifier of the opponent |
| `name` | string | Display name |
| `icon` | string | Emoji shown in the battle view |
| `hp` | number | Maximum (and starting) HP |
| `items` | string[] | Item ids from the catalog in `src/items.ts`; the same id may appear several times |
| `round` | number | The round this opponent was requested for (echoes `round`) |

The response matches the `Opponent` type in `src/types.ts`.

The answer is deterministic: the same `round` always returns the same opponent. There is one hand-built opponent per round for rounds 1–7. Every round past the table returns the last opponent with +6 HP per additional round. The table never needs more than 7 rounds (5 wins + 3 lives − 1), and an opponent never carries more than 6 items, the size of the player's 2×3 backpack.

### Errors

Every error response has the shape:

```json
{ "error": "human-readable explanation" }
```

| Status | When | `error` |
|---|---|---|
| 400 | `round` is missing, not a whole number, or less than 1 | `round must be a positive whole number` |
| 503 | `fail=true`, or the server was started with `API_FAIL=true` | `The arena gates are shut. No challenger answered the call.` |

An invalid `round` is reported as 400 even when failure is forced. All responses from this endpoint, errors included, arrive after the configured delay.

## `POST /api/hall-of-fame`

Submits a finished run to the Hall of Fame. Entries are stored in memory on the server. Each run is uniquely identified by its `runId`.

### Request body

Send a JSON body with the `Content-Type: application/json` header.

```json
{
  "runId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Player",
  "outcome": "victory",
  "wins": 5,
  "rounds": 7,
  "remainingLives": 1
}
```

| Field | Type | Validation |
|---|---|---|
| `runId` | string | Hyphenated UUID (version 1–8, RFC variant), case-insensitive |
| `name` | string | 1–30 characters after trimming |
| `outcome` | string | `victory` or `defeat` |
| `wins` | number | Whole number from 0 to 5 |
| `rounds` | number | Whole number from 1 to 7 |
| `remainingLives` | number | Whole number from 0 to 3 |

### Run validation

A new entry must describe a finished run.

- `rounds` must equal `wins + (3 - remainingLives)`.
- A victory requires exactly 5 wins and at least 1 remaining life.
- A defeat requires 0 remaining lives and fewer than 5 wins.
- Unfinished or inconsistent runs are rejected.

### Success — 201

A valid new entry is stored and returned as JSON. The response has the same fields as the request example and matches the `HallOfFameEntry` type in `src/types.ts`. Player names are trimmed and run IDs are normalized to lowercase.

### Duplicate submissions and retries

- A valid submission with a new `runId` creates an entry and returns `201 Created`.
- An existing `runId` with identical normalized data returns the existing entry with `200 OK`.
- An existing `runId` with different data returns `409 Conflict`. The server checks for an existing entry before validating the other fields for a new entry.

The client can retry an identical submission after a lost response without creating a duplicate entry.

### Errors

Validation and conflict responses have the following shape.

```json
{ "error": "human-readable explanation" }
```

| Status | When |
|---|---|
| 400 | Missing or invalid `runId`, or invalid name, numeric values, outcome, or run consistency for a new entry |
| 400 | Malformed JSON request body |
| 409 | The run ID already exists with different data |

## `GET /api/hall-of-fame`

Returns all submitted runs as a sorted ranking. No query parameters are required.

### Success — 200

```json
[
  {
    "runId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Player",
    "outcome": "victory",
    "wins": 5,
    "rounds": 7,
    "remainingLives": 1
  }
]
```

The response is an array of `HallOfFameEntry` objects. If no runs have been submitted, the server returns an empty array (`[]`) with status 200.

### Ranking order

Entries are sorted by the following criteria, in order.

1. Victories before defeats.
2. More wins before fewer wins.
3. Fewer rounds before more rounds.
4. Earlier submissions first if all previous criteria are equal.

Sorting does not modify the original submission order stored on the server.

### Storage

All Hall of Fame entries are stored in memory. No database is required. Restarting the API clears the ranking.

## Environment variables

| Variable | Effect |
|---|---|
| `PORT` | Port to listen on (default 4200). The Vite proxy expects 4200. |
| `API_LATENCY` | Default delay in milliseconds when a request has no `latency` parameter. |
| `API_FAIL` | `true` makes every opponent request fail with 503. |

Example: `API_FAIL=true pnpm server`.

## Client

`fetchOpponent(round)` in `src/api.ts` performs the request. It resolves with the `Opponent` on success and throws an `Error` carrying the server's `error` text (or a generic message with the status code) for any non-2xx response. When the API is not running, the Vite proxy answers with an error status of its own, which is reported the same way; a network failure rejects as well.

`submitScore(entry)` in `src/api.ts` submits a finished run using
`POST /api/hall-of-fame`.

`fetchHallOfFame()` retrieves the sorted ranking using
`GET /api/hall-of-fame`.

Both functions use the shared `hallOfFameRequest<T>()` helper,
which handles HTTP errors, redirects and unreadable JSON responses.

The client preserves the entered player name for retries and marks
a run as submitted only after a successful API response. The name
and submission status are persisted together with the saved game.
