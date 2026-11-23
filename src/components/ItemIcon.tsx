import { ITEM_SETS } from "../item_sets";
import type { ItemDef } from "../types";

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