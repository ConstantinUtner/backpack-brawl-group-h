import { TICK_SECONDS } from "../battle";
import { describeEffects, getItem } from "../items";
import { BACKPACK_COLS } from "../shop";
import type { Backpack as BackpackSlots, ItemDef } from "../types";

/** Hover text for a backpack slot: name, effects and cooldown. */
const tooltip = (item: ItemDef) =>
  [item.name, ...describeEffects(item.effects).map(({ label }) => label), `⏱️ every ${item.cooldown * TICK_SECONDS}s`].join("\n");

interface BackpackProps {
  backpack: BackpackSlots;
  // [req-1.4]: Receive the sell action from ShopPage.
  onSell: (slotIndex: number) => void;
}

export function Backpack({ backpack, onSell }: BackpackProps) {
  return (
    <section className="rounded-lg border border-panel-edge bg-panel p-4">
      <h2 className="font-display text-xl font-bold">🎒 Backpack</h2>
      <p className="mb-3 text-sm text-muted">Hover an item to see its stats.</p>
      <ul className="grid gap-2" style={{ gridTemplateColumns: `repeat(${BACKPACK_COLS}, minmax(0, 1fr))` }}>
        {backpack.map((slot, index) => {
          const item = slot ? getItem(slot.itemId) : null;
          // [req-1.4]: Display half the item's price, rounded down.
          const sellPrice = item ? Math.floor(item.price / 2) : 0;
          return (
            <li
              key={slot?.uid ?? `empty-${index}`}
              title={item ? tooltip(item) : undefined}
              aria-label={item ? item.name : `Empty slot ${index + 1}`}
              className={[
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-md border-2 p-1",
                item ? "cursor-help border-gold/40 bg-ink/40" : "border-dashed border-panel-edge",
              ].join(" ")}
            >
              {item && (
                <>
                  <span className="text-3xl leading-none sm:text-4xl" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="text-center text-xs leading-tight">{item.name}</span>
                  {/* [req-1.4]: Sell only the item in the selected slot. */}
                  <button
                    type="button"
                    onClick={() => onSell(index)}
                    className="rounded-md bg-gold px-2 py-1 text-xs font-bold text-ink hover:brightness-110"
                  >
                    Sell for {sellPrice} gold
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
