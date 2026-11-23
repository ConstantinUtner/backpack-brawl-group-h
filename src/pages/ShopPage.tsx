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
    update(startSearch);
    try {
      const opponent = await fetchOpponent(run.round);
      update((current) => startBattle(current, opponent));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Opponent search failed.";
      update((current) => searchFailed(current, message));
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
