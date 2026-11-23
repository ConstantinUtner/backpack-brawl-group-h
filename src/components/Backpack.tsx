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

export function Backpack({ backpack }: { backpack: BackpackSlots }) {
  const activeSets = getActiveSets(itemIdsOf(backpack));
  return (
    <section className="rounded-lg border border-panel-edge bg-panel p-4">
      <h2 className="font-display text-xl font-bold">🎒 Backpack</h2>
      <p className="mb-3 text-sm text-muted">Hover an item to see its stats.</p>
      <ul className="grid gap-2" style={{ gridTemplateColumns: `repeat(${BACKPACK_COLS}, minmax(0, 1fr))` }}>
        {backpack.map((slot, index) => {
          const item = slot ? getItem(slot.itemId) : null;
          return (
            <li
              key={slot?.uid ?? `empty-${index}`}
              title={item ? tooltip(item, activeSets) : undefined}
              aria-label={item ? item.name : `Empty slot ${index + 1}`}
              className={[
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-md border-2 p-1",
                item ? "cursor-help border-gold/40 bg-ink/40" : "border-dashed border-panel-edge",
              ].join(" ")}
            >
              {item && (
                <>
                  <span className="text-3xl leading-none sm:text-4xl" aria-hidden>
                    <ItemIcon item={item} />
                  </span>
                  <span className="text-center text-xs leading-tight">{item.name}</span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
