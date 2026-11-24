# Backpack Brawl API

The local API is a small Express server in `server/index.js`. It listens on port 4200 (override with the `PORT` environment variable). During Vite development, `/api` is proxied to it, so the frontend uses relative URLs such as `/api/opponents?round=1`. All responses are JSON. The Hall of Fame is stored in a server-side array and is cleared on restart; opponent responses remain deterministic.

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

/** REQUIREMENT 7: Document score requests, ranking, retry semantics and errors. */
## `POST /api/hall-of-fame`

Submit a completed run with `Content-Type: application/json`:

```json
{
  "runId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Constantin",
  "outcome": "victory",
  "wins": 5,
  "rounds": 7,
  "remainingLives": 1
}
```

Success: **201 Created**, with the same object (name trimmed, UUID lowercased). An identical retry returns **200 OK** with the stored entry, without adding a duplicate or changing its ranking position. UUID comparisons are case-insensitive; names are compared after trimming. Unknown fields are ignored.

Validation: UUID format; trimmed name 1–30 characters; integer wins 0–5; integer remainingLives 0–3; integer rounds 1–7 equal to `wins + (3 - remainingLives)`. A victory requires 5 wins and at least 1 life; a defeat requires 0 lives and fewer than 5 wins. Unfinished runs are rejected. These checks detect implausible results, not cheating by a manipulated client.

| Status | Meaning | Example body |
| --- | --- | --- |
| 400 | Invalid/implausible data or malformed JSON | `{"error":"rounds must equal wins + lost lives and be between 1 and 7"}` |
| 409 | Existing runId with different score data | `{"error":"This run was already submitted with different data"}` |

A lost response can safely be retried with the **same payload**, including name and runId. The server may already have stored it. After a server restart the in-memory entries are gone.

## `GET /api/hall-of-fame`

No parameters or active run required. Returns **200 OK** and an array:

```json
[
  {
    "runId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Constantin",
    "outcome": "victory",
    "wins": 5,
    "rounds": 7,
    "remainingLives": 1
  }
]
```

An empty ranking returns `[]`. Ordering: victory before defeat, more wins first, fewer rounds first, then earlier successful submission first. Neither endpoint requires authentication or issues redirects. Unexpected HTTP failures (including 401/500 from infrastructure), non-JSON responses and network failures are shown as errors by the client; Hall-of-Fame redirects are rejected rather than silently followed.

## Environment variables

| Variable | Effect |
|---|---|
| `PORT` | Port to listen on (default 4200). The Vite proxy expects 4200. |
| `API_LATENCY` | Default delay in milliseconds when a request has no `latency` parameter. |
| `API_FAIL` | `true` makes every opponent request fail with 503. |

Example: `API_FAIL=true pnpm server`.

## Client

`fetchOpponent(round)` in `src/api.ts` performs the request. It resolves with the `Opponent` on success and throws an `Error` carrying the server's `error` text (or a generic message with the status code) for any non-2xx response. When the API is not running, the Vite proxy answers with an error status of its own, which is reported the same way; a network failure rejects as well.
