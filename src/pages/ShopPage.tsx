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

export function ShopPage() {
  const { game, update } = useActiveGame();
  const { run, phase } = game;

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
    if (fightBlocker(game) !== null) return;

    // [req-5.2]: Create a unique identity for this search
    // and remember the round for which it was started.
    const search: ActiveSearch = {
      searchId: crypto.randomUUID(),
      round: run.round,
    };

    // [req-5.2]: Store the search identity in the GameState.
    update((current) => startSearch(current, search));

    try {
      // [req-5.2]: Request the opponent for the captured search round.
      const opponent = await fetchOpponent(search.round);

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
      const message =
        error instanceof Error ? error.message : "Opponent search failed.";

      // [req-5.2]: Handle the error only if the failed search
      // is still active. Ignore errors from outdated searches.
      update((current) => searchFailed(current, search, message));
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
