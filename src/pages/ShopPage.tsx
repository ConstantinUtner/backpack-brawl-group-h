import { useEffect, useRef } from "react";
import { fetchOpponent } from "../api";
import { Backpack } from "../components/Backpack";
import { FightBar } from "../components/FightBar";
import { RulesPanel } from "../components/RulesPanel";
import { RunHeader } from "../components/RunHeader";
import { Shop } from "../components/Shop";
import {
  fightBlocker,
  searchFailed,
  startBattle,
  startSearch,
  updateRun,
} from "../game";
// [req-2.3]: Reuse the tested backpack move and swap function.
import { buyItem, sellItem, rerollShop, moveBackpackItem } from "../run";
import { useActiveGame } from "../state/GameContext";
import type { ActiveSearch } from "../types";

// [req-5.3]: Limit the time spent waiting for an opponent.
const SEARCH_TIMEOUT_MS = 10_000;

export function ShopPage() {
  const { game, update } = useActiveGame();
  const { run, phase } = game;

  // [req-5.3]: Store the active AbortController in a ref
  // so it can be accessed immediately without a re-render.
  const requestRef = useRef<AbortController | null>(null);

  // [req-5.3]: Cancel an unfinished opponent request
  // when the shop component is unmounted.
  useEffect(() => {
    return () => {
      requestRef.current?.abort();
    };
  }, []);

  function handleBuy(offerIndex: number) {
    update((current) =>
      updateRun(current, (currentRun) => buyItem(currentRun, offerIndex)),
    );
  }

  // [req-1.4]: Connect backpack selling to the game state.
  function handleSell(slotIndex: number) {
    update((current) =>
      updateRun(current, (currentRun) => sellItem(currentRun, slotIndex)),
    );
  }

  // [req-2.3]: Apply backpack moves through the existing shop-phase guard.
  function handleMove(fromIndex: number, toIndex: number) {
    update((current) =>
      updateRun(current, (currentRun) =>
        moveBackpackItem(currentRun, fromIndex, toIndex),
      ),
    );
  }

  // [req-1.4]: Connect the shop reroll to the game state.
  function handleReroll() {
    update((current) => updateRun(current, rerollShop));
  }

  // Once the opponent is found the phase becomes "battle" and RequireRoute redirects to the battle page.
  async function handleFindOpponent() {
    // [req-5.3]: Reject new HTTP requests if one is already active.
    // The ref is updated immediately, unlike the React state.
    if (requestRef.current !== null) return;

    if (fightBlocker(game) !== null) return;

    // [req-5.2]: Identify the current matchmaking attempt.
    const search: ActiveSearch = {
      searchId: crypto.randomUUID(),
      round: run.round,
    };

    // [req-5.3]: Create and immediately register a controller
    // for this request.
    const controller = new AbortController();
    requestRef.current = controller;

    // [req-5.2]: Store the search identity in the GameState.
    update((current) => startSearch(current, search));

    // [req-5.3]: Track whether cancellation was caused by a timeout.
    let timedOut = false;

    // [req-5.3]: Abort requests that exceed the time limit.
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, SEARCH_TIMEOUT_MS);

    try {
      // [req-5.3]: Connect the request to its abort controller.
      const opponent = await fetchOpponent(search.round, controller.signal);
      controller.signal.throwIfAborted();

      // [req-5.2]: If the server returns an opponent for the wrong
      // round, throw an error so the catch block can end the
      // search and return the player to the shop.
      if (opponent.round !== search.round) {
        throw new Error("Received an opponent for the wrong round.");
      }

      // [req-5.2]: Start the battle only if the response belongs
      // to the currently active search. Ignore outdated responses.
      update((current) => startBattle(current, search, opponent));
    } catch (error) {
      // [req-5.3]: Provide understandable error messages for
      // timeouts, cancellations and API failures.
      let message = "Opponent search failed. Please try again.";

      if (timedOut) {
        message = "Opponent search timed out. Please try again.";
      } else if (controller.signal.aborted) {
        message = "Opponent search was cancelled. Please try again.";
      } else if (error instanceof Error) {
        message = error.message;
      }

      // [req-5.2]: Handle the error only if the failed search
      // is still active. Ignore errors from outdated searches.
      update((current) => searchFailed(current, search, message));
    } finally {
      // [req-5.3]: Remove the timeout after the request has settled.
      clearTimeout(timeoutId);

      // [req-5.3]: Release only the controller of this request.
      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    }
  }

  return (
    <>
      <RunHeader run={run} />
      <FightBar
        phase={phase}
        blocker={fightBlocker(game)}
        error={game.error}
        onFight={handleFindOpponent}
      />

      {/* While searching, the whole shop/backpack area is disabled so the fighting build can't change. */}
      <fieldset
        disabled={phase !== "shop"}
        className="grid min-w-0 gap-4 disabled:opacity-60 lg:grid-cols-[1fr_16rem_18rem]"
      >
        {/* [req-1.4]: Pass buying and reroll actions to the shop. */}
        <Shop run={run} onBuy={handleBuy} onReroll={handleReroll} />
        {/* [req-2.3]: Connect backpack slot clicks to the move/swap action & reset the local item selection when the game phase changes with key={phase} */}
        <Backpack
          backpack={run.backpack}
          onSell={handleSell}
          onMove={handleMove}
          key={phase}
        />
        <aside className="flex flex-col gap-4">
          <RulesPanel open={run.round === 1} />
        </aside>
      </fieldset>
    </>
  );
}
