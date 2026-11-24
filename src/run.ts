import { getItem } from "./items";
import { BACKPACK_SIZE, rollShop } from "./shop";
import type { RunState, Side } from "./types";

export const START_GOLD = 10;
export const START_LIVES = 3;
export const WINS_TO_VICTORY = 5;
export const GOLD_PER_ROUND = 5;
// [req-1.3]: A shop reroll costs exactly one gold.
export const REROLL_COST = 1;

export function newRun(seed: number): RunState {
  const roll = rollShop(seed);
  return {
    /** Bugfix error when starting: Create one UUID at run start */
    runId: crypto.randomUUID(),
    round: 1,
    gold: START_GOLD,
    lives: START_LIVES,
    wins: 0,
    seed: roll.seed,
    shop: roll.offers,
    backpack: Array(BACKPACK_SIZE).fill(null),
    nextUid: 1,
  };
}

export function firstFreeSlot(state: RunState): number {
  return state.backpack.indexOf(null);
}

/** Why an offer can't be bought right now, or `null` if it can. */
export function buyBlocker(state: RunState, offerIndex: number): string | null {
  // [req-1.1]: Reject indices that are not valid shop positions.
  if (!Number.isInteger(offerIndex) || offerIndex < 0 || offerIndex >= state.shop.length) {
    return "Invalid shop offer";
  }

  const itemId = state.shop[offerIndex];
  if (!itemId) return "Already sold";
  if (state.gold < getItem(itemId).price) return "Not enough gold";
  // [req-1.1]: Prevent buying when no backpack slot is available.
  if (firstFreeSlot(state) === -1) return "Backpack is full";
  return null;
}

/** Buys a shop offer into the first free backpack slot; unchanged state if not allowed. */
export function buyItem(state: RunState, offerIndex: number): RunState {
  if (buyBlocker(state, offerIndex) !== null) return state;
  // [req-1.1]: Verify the offer exists before using it.
  const itemId = state.shop[offerIndex];
  if (!itemId) return state;
  const slot = firstFreeSlot(state);
  const backpack = [...state.backpack];
  backpack[slot] = { uid: `item-${state.nextUid}`, itemId };
  const shop = [...state.shop];
  shop[offerIndex] = null;
  return { ...state, gold: state.gold - getItem(itemId).price, shop, backpack, nextUid: state.nextUid + 1 };
}

/** Why an item can't be sold, or `null` if it can. */
export function sellBlocker(state: RunState, slotIndex: number): string | null {
  // [req-1.2]: Only valid backpack slots can be sold.
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= state.backpack.length) {
    return "Invalid backpack slot";
  }

  // [req-1.2]: Empty slots contain no item to sell.
  if (!state.backpack[slotIndex]) return "Empty backpack slot";
  return null;
}

/** Sells an item and returns the updated run state. */
export function sellItem(state: RunState, slotIndex: number): RunState {
  // [req-1.2]: Invalid sales leave the original state unchanged.
  if (sellBlocker(state, slotIndex) !== null) return state;

  // [req-1.2]: Verify the selected item actually exists.
  const item = state.backpack[slotIndex];
  if (!item) return state;

  // [req-1.2]: Calculate half the original price, rounded down.
  const sellPrice = Math.floor(getItem(item.itemId).price / 2);

  // [req-1.2]: Copy the backpack before removing the selected item.
  const backpack = [...state.backpack];
  backpack[slotIndex] = null;

  // [req-1.2]: Remove the item and add gold in one state update.
  return { ...state, gold: state.gold + sellPrice, backpack };
}

/** Moves an item to another slot or swaps two items. */
export function moveBackpackItem(
  state: RunState,
  fromIndex: number,
  toIndex: number
): RunState {
  // [req-2.1]: Only existing integer slot indices are valid.
  const isValidIndex = (index: number) =>
    Number.isInteger(index) && index >= 0 && index < state.backpack.length;

  // [req-2.1]: Reject invalid positions and moving to the same slot.
  if (!isValidIndex(fromIndex) || !isValidIndex(toIndex) || fromIndex === toIndex) {
    return state;
  }

  // [req-2.1]: An empty starting slot cannot be moved.
  if (!state.backpack[fromIndex]) return state;

  // [req-2.1]: Copy the array to avoid changing the original state.
  const backpack = [...state.backpack];

  // [req-2.1]: Swap both slots. If the target is empty, this moves the item.
  [backpack[fromIndex], backpack[toIndex]] = [backpack[toIndex], backpack[fromIndex]];

  // [req-2.1]: Return a new state with the updated backpack.
  return { ...state, backpack };
}

/** Why the shop can't be rerolled, or `null` if it can. */
export function rerollBlocker(state: RunState): string | null {
  // [req-1.3]: A reroll requires at least one gold.
  if (state.gold < REROLL_COST) return "Not enough gold";
  return null;
}

/** Rerolls all shop offers for one gold. */
export function rerollShop(state: RunState): RunState {
  // [req-1.3]: Invalid rerolls leave the original state unchanged.
  if (rerollBlocker(state) !== null) return state;

  // [req-1.3]: Generate four new offers using the current seed.
  const roll = rollShop(state.seed);

  // [req-1.3]: Update gold, offers and seed together.
  return { ...state, gold: state.gold - REROLL_COST, shop: roll.offers, seed: roll.seed };
}

export type RunOutcome = "victory" | "defeat";

/** `victory` / `defeat` once the run is over, otherwise `null`. */
export function runOutcome(state: RunState): RunOutcome | null {
  if (state.wins >= WINS_TO_VICTORY) return "victory";
  if (state.lives <= 0) return "defeat";
  return null;
}

/** Starts the next round: round + 1, round gold, fresh shop. The backpack is kept. */
export function startNextRound(state: RunState): RunState {
  const roll = rollShop(state.seed);
  return { ...state, round: state.round + 1, gold: state.gold + GOLD_PER_ROUND, seed: roll.seed, shop: roll.offers };
}

/** Records a battle (win → +1 win, loss → −1 life) and moves on to the next round unless the run is over. */
export function applyBattleResult(state: RunState, winner: Side): RunState {
  const scored = winner === "player" ? { ...state, wins: state.wins + 1 } : { ...state, lives: state.lives - 1 };
  return runOutcome(scored) ? scored : startNextRound(scored);
}
