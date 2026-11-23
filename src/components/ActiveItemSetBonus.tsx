import { getActiveSets, ITEM_SETS } from "../item_sets";

interface ActiveItemSetBonusProps {
  itemIds: string[];
}

export function ActiveItemSetBonus({ itemIds }: ActiveItemSetBonusProps) {
  const activeSets = getActiveSets(itemIds);
 
  return (
    <section className="text-sm" aria-label="Active set bonuses">
      <h4 className="font-bold">Active set bonuses</h4>
 
      {activeSets.length === 0 ? (
        <p className="text-muted">None — equip 2 items of the same set.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {activeSets.map((set) => (
            <li
              key={set}
              className="rounded border border-gold/40 bg-gold/10 px-2 py-1"
            >
              <strong>{ITEM_SETS[set].name}:</strong>{" "}
              {ITEM_SETS[set].description}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}