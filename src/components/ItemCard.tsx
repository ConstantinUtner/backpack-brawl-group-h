import type { ReactNode } from "react";
import { TICK_SECONDS } from "../battle";
import { describeEffects } from "../items";
import { COOLDOWN_HELP, EFFECT_HELP } from "../rules";
import type { ItemDef } from "../types";
import { ITEM_SETS } from "../item_sets";

interface ItemCardProps {
  item: ItemDef;
  /** Extra content below the stats, e.g. a buy button. */
  children?: ReactNode;
}

export function ItemCard({ item, children }: ItemCardProps) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border-2 border-gold/40 bg-ink/40 p-3">
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none" aria-hidden>
           <ItemIcon item={item} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display font-bold">{item.name}</h3>
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {describeEffects(item.effects).map(({ effect, label }) => (
          <li key={effect} title={EFFECT_HELP[effect]} className={HELP}>
            {label}
          </li>
        ))}
        <li title={COOLDOWN_HELP} className={`text-muted ${HELP}`}>
          ⏱️ every {item.cooldown * TICK_SECONDS}s
        </li>
      </ul>
      {children}
    </article>
  );
}

/** Hover hint styling for texts that have an explanatory tooltip. */
const HELP = "cursor-help underline decoration-dotted decoration-muted/60 underline-offset-2";

interface ItemIconProps {
  item: ItemDef;
}

export function ItemIcon({item }: ItemIconProps) {
  const set = item.set;
  const setInfo = set ? ITEM_SETS[set] : undefined;

  return (
    <span className="relative inline-flex shrink-0 p-1">
      <span aria-hidden="true">{item.icon}</span>
 
      {set && setInfo && (
        <span
          className={`absolute -right-1 -top-1 rounded-full border px-1 text-[10px] font-bold leading-4 ${
            set === "fire"
              ? "border-orange-400 bg-orange-950 text-orange-200"
              : "border-blue-400 bg-blue-950 text-blue-200"
          }`}
          title={`${setInfo.name} set: ${setInfo.description}`}
          aria-label={`${setInfo.name} set`}
        >
          {set === "fire" ? "F" : "D"}
        </span>
      )}
    </span>
  );
}
