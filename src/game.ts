import {
  buildOpponentFighter,
  buildPlayerFighter,
  simulateBattle,
} from "./battle";
import { applyBattleResult, newRun, runOutcome } from "./run";
import { itemIdsOf } from "./shop";
import type {
  ActiveSearch,
  BattleReplay,
  GameState,
  Opponent,
  RunState,
} from "./types";

/**
 * Phase transitions of one run: shop → searching → battle → shop … → finished.
 * Every function is pure, so they can be passed straight to `setState`.
 */

export function newGame(seed: number): GameState {
  return {
    phase: "shop",
    run: newRun(seed),

    // [req-5.2]: A new game starts without an active search.
    activeSearch: null,

    battle: null,
    error: null,
  };
}

/** Applies a shop/backpack action; only allowed while shopping. */
export function updateRun(
  game: GameState,
  action: (run: RunState) => RunState,
): GameState {
  if (game.phase !== "shop") return game;
  const run = action(game.run);
  return run === game.run ? game : { ...game, run };
}

/** Why the player can't look for an opponent right now, or `null` if they can. */
export function fightBlocker(game: GameState): string | null {
  // [req-5.1]: Block additional searches while matchmaking is active.
  if (game.phase === "searching") return "Opponent search already running";

  // [req-5.1]: Only allow matchmaking during the shop phase.
  if (game.phase !== "shop") return "You can only search during the shop phase";

  if (itemIdsOf(game.run.backpack).length === 0)
    return "Buy at least one item first";

  return null;
}

export function startSearch(game: GameState, search: ActiveSearch): GameState {
  // [req-5.1]: Reject duplicate searches, searches outside
  // the shop phase and searches with an empty backpack.
  if (fightBlocker(game) !== null) return game;

  // [req-5.2]: Reject searches for a round that is no longer current.
  if (search.round !== game.run.round) return game;

  return {
    ...game,
    phase: "searching",

    // [req-5.2]: Remember which search is currently active.
    activeSearch: search,

    error: null,
  };
}

// [req-5.2]: Check whether a response belongs to the currently
// active search and round before applying any state changes.
function isCurrentSearch(game: GameState, search: ActiveSearch): boolean {
  return (
    game.phase === "searching" &&
    game.activeSearch !== null &&
    game.activeSearch.searchId === search.searchId &&
    game.activeSearch.round === search.round &&
    game.run.round === search.round
  );
}

export function searchFailed(
  game: GameState,
  search: ActiveSearch,
  error: string,
): GameState {
  // [req-5.2]: Ignore failures that do not belong
  // to the currently active search and round.
  if (!isCurrentSearch(game, search)) return game;

  return {
    ...game,
    phase: "shop",

    // [req-5.2]: Clear the completed search so the player can retry.
    activeSearch: null,

    error,
  };
}

/** Simulates the battle against `opponent` and starts its replay at the first frame. */
export function startBattle(
  game: GameState,
  search: ActiveSearch,
  opponent: Opponent,
): GameState {
  // [req-5.2]: Ignore responses that do not belong
  // to the currently active search and round.
  if (!isCurrentSearch(game, search)) return game;

  // [req-5.2]: Reject opponents that belong to another round.
  if (opponent.round !== game.run.round) return game;

  const player = buildPlayerFighter(game.run.backpack);
  const enemy = buildOpponentFighter(opponent);
  const result = simulateBattle(player, enemy);

  return {
    ...game,
    phase: "battle",

    // [req-5.2]: Clear the search once its response has been accepted.
    activeSearch: null,

    battle: { opponent, player, enemy, result, frame: 0 },
  };
}

export const isReplayDone = (battle: BattleReplay) =>
  battle.frame >= battle.result.frames.length - 1;

/** Shows the given frame; reaching the last frame applies the battle result to the run (exactly once). */
export function showFrame(game: GameState, frame: number): GameState {
  const { battle } = game;

  // [req-5.4]: Stop if no battle is running or the replay is already finished.
  // This prevents the same battle result from being applied twice.
  if (game.phase !== "battle" || !battle || isReplayDone(battle)) return game;
  const last = battle.result.frames.length - 1;
  const next = {
    ...battle,
    frame: Math.min(Math.max(frame, battle.frame), last),
  };
  if (!isReplayDone(next)) return { ...game, battle: next };

  // [req-5.4]: Apply the result and finish the replay
  // together in a single state update.
  return {
    ...game,
    battle: next,
    run: applyBattleResult(game.run, battle.result.winner),
  };
}

export const advanceReplay = (game: GameState) =>
  showFrame(game, (game.battle?.frame ?? 0) + 1);
export const skipReplay = (game: GameState) => showFrame(game, Infinity);

/** Leaves a finished replay: back to the shop, or to the end screen if the run is over. */
export function leaveBattle(game: GameState): GameState {
  if (game.phase !== "battle" || !game.battle || !isReplayDone(game.battle))
    return game;
  return {
    ...game,
    phase: runOutcome(game.run) ? "finished" : "shop",
    battle: null,
  };
}

/** URL paths of the app's screens. */
/** REQUIREMENT 7: Give the hall of fame its own ROUTE url (hall-of-fame) */
export const ROUTES = { start: "/", shop: "/shop", battle: "/battle", result: "/result", hallOfFame: "/hall-of-fame" } as const;
export type GameRoute = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * The screen that matches the game's phase. Shop, battle and result pages
 * redirect here when they don't match, so the URL always follows the phase.
 */
export function routeForGame(game: GameState | null): GameRoute {
  if (!game) return ROUTES.start;
  switch (game.phase) {
    case "shop":
    case "searching":
      return ROUTES.shop;
    case "battle":
      return ROUTES.battle;
    case "finished":
      return ROUTES.result;
  }
}
