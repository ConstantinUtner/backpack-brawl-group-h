// [req-2.2]: Keep the selected backpack slot in local React state.
import { useState } from "react";
import { TICK_SECONDS } from "../battle";
import { getActiveSets } from "../item_sets";
import { describeEffects, getItem } from "../items";
import { BACKPACK_COLS, itemIdsOf } from "../shop";
import type { Backpack as BackpackSlots, ItemDef, ItemSetId } from "../types";
import { ItemIcon } from "./ItemIcon";

/** Hover text for a backpack slot: name, effects and cooldown. */
/**REQUIREMENT 4: Showing the active set bonus in the backpack */
const tooltip = (item: ItemDef, activeSets: ItemSetId[]) => {
  //Block bonus
  const blockBonus = item.effects.block && activeSets.includes("defense") ? 1 : 0;
 
  const burnBonus = item.effects.burn && activeSets.includes("fire") ? 1 : 0;
  return [item.name, ...describeEffects(item.effects).map(({ label }) => label),
    ...(blockBonus ? ["Includes +1 block from the Defense item set"] : []),
    ...(burnBonus ? ["Includes +1 burn stack from the Burn item set"] : []),
    `⏱️ every ${item.cooldown * TICK_SECONDS}s`].join("\n");
}

interface BackpackProps {
  backpack: BackpackSlots;
  // [req-1.4]: Receive the sell action from ShopPage.
  onSell: (slotIndex: number) => void;
  // [req-2.3]: Notify the parent which two slots should be swapped.
  onMove: (fromIndex: number, toIndex: number) => void;
}

// [req-2.3]: Receive the move callback from ShopPage.
export function Backpack({ backpack, onSell, onMove }: BackpackProps) {
  const activeSets = getActiveSets(itemIdsOf(backpack));
  // [req-2.2]: null means that no backpack item is selected.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // [req-2.3]: Select, deselect, move or swap depending on the clicked slot.
  function handleSlotClick(index: number) {
    // [req-2.3]: Select an item if nothing is selected yet.
    if (selectedIndex === null) {
      if (backpack[index]) {
        setSelectedIndex(index);
      }
      return;
    }

    // [req-2.3]: Clicking the selected slot again cancels selection.
    if (selectedIndex === index) {
      setSelectedIndex(null);
      return;
    }

    // [req-2.3]: Move or swap the selected item with the target slot.
    onMove(selectedIndex, index);

    // [req-2.3]: Clear the selection after the move.
    setSelectedIndex(null);
  }

  // [req-2.2]: Clear selection only when selling the selected item.
  function handleSell(index: number) {
    if (selectedIndex === index) {
      setSelectedIndex(null);
    }

    onSell(index);
  }

  const activeSets = getActiveSets(itemIdsOf(backpack));
  return (
    <section className="rounded-lg border border-panel-edge bg-panel p-4">
      <h2 className="font-display text-xl font-bold">🎒 Backpack</h2>
      {/* [req-2.4]: Explain how players can arrange their backpack. */}
      <p className="mb-3 text-sm text-muted">
        Select an item, then click another slot to move or swap it.
        Hover an item to see its stats.
      </p>
      <ul className="grid gap-2" style={{ gridTemplateColumns: `repeat(${BACKPACK_COLS}, minmax(0, 1fr))` }}>
        {backpack.map((slot, index) => {
          const item = slot ? getItem(slot.itemId) : null;
          // [req-1.4]: Display half the item's price, rounded down.
          const sellPrice = item ? Math.floor(item.price / 2) : 0;
          return (
            <li
              key={slot?.uid ?? `empty-${index}`}
              title={item ? tooltip(item, activeSets) : undefined}
              aria-label={item ? item.name : `Empty slot ${index + 1}`}
              className={[
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-md border-2 p-1",
                // [req-2.2]: Highlight the selected slot in gold.
                selectedIndex === index
                  ? "border-gold bg-gold/20"
                  // [req-2.4]: Highlight all other slots in green when an item is selected.
                  // Both empty and occupied slots are valid targets for moving or swapping.
                  : selectedIndex !== null
                    ? "border-green-500 bg-green-500/10"
                    // Keep the default appearance when no item is selected.
                    : item
                      ? "border-gold/40 bg-ink/40"
                      : "border-dashed border-panel-edge",
              ].join(" ")}
            >
              {/* [req-2.3]: Every slot is clickable, including empty target slots. */}
              <button
                type="button"
                onClick={() => handleSlotClick(index)}
                aria-pressed={selectedIndex === index}
                aria-label={item ? item.name : `Empty slot ${index + 1}`}
                className="flex w-full flex-1 flex-col items-center justify-center gap-1"
              >
                {item ? (
                  <>
                    <span className="text-3xl leading-none sm:text-4xl" aria-hidden>
                      <ItemIcon item={item} />
                    </span>
                    <span className="text-center text-xs leading-tight">{item.name}</span>
                  </>
                ) : (
                  <span className="text-xs text-muted">Empty</span>
                )}
              </button>
              {/* [req-2.3]: Keep selling separate from selecting and moving. */}
              {item && (
                <button
                  type="button"
                  onClick={() => handleSell(index)}
                  className="rounded-md bg-gold px-2 py-1 text-xs font-bold text-ink hover:brightness-110"
                >
                  Sell for {sellPrice} gold
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {/* [req-2.4]: Show a cancel button only while an item is selected. */}
      {selectedIndex !== null && (
        <button
          type="button"
          onClick={() => setSelectedIndex(null)}
          className="mt-3 w-full rounded-md border border-panel-edge px-3 py-1.5 text-sm hover:bg-ink/40"
        >
          Cancel selection
        </button>
      )}
    </section>
  );
}
