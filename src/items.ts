import type { ItemDef, ItemEffects } from "./types";

/* REQUIREMENT 3: Item Definition in sections poison + heal. Added to CATALOG for mapping */
export const POISON_CATALOG: ItemDef[] = [
  { id: "poison-dagger", name: "Poison Dagger", icon: "🗡️🧪", price: 3, cooldown: 4, effects: { poison: 1 } },
  { id: "toxic-bow", name: "Toxic Bow", icon: "🏹🧪", price: 5, cooldown: 6, effects: { poison: 2 } },
  { id: "venom-blade", name: "Venom Blade", icon: "⚔️🧪", price: 7, cooldown: 8, effects: { poison: 3 } },
]
export const HEAL_CATALOG: ItemDef[] = [
  { id: "small-potion", name: "Small Potion", icon: "🍷", price: 3, cooldown: 5, effects: { heal: 3 } },
  { id: "healing-herb", name: "Healing Herb", icon: "🌿", price: 5, cooldown: 7, effects: { heal: 5 } },
  { id: "healing-crystal", name: "Healing Crystal", icon: "💎", price: 7, cooldown: 10, effects: { heal: 8 } },
]

/** REQUIREMENT 4: New status effect FIRE inside a new set of items, burn effect added*/
export const FIRE_CATALOG: ItemDef[] = [
  { id: "fire-dagger", name: "Fire Dagger", icon: "🗡️🔥", price: 3, cooldown: 3, effects: { burn: 3 }, set: "fire" },
  { id: "fire-bow", name: "Fire Bow", icon: "🏹🔥", price: 5, cooldown: 4, effects: { burn: 5 }, set: "fire" },
  { id: "fire-chopsticks", name: "Fire Chopsticks", icon: "🥢", price: 7, cooldown: 6, effects: { burn: 8 }, set: "fire" },
]

/** REQUIREMENT 4: Added the defense set to the oak-buckler, pot-lid and spiked-shield */
export const CATALOG: ItemDef[] = [
  { id: "chipped-dagger", name: "Chipped Dagger", icon: "🗡️", price: 2, cooldown: 4, effects: { damage: 3 } },
  { id: "hunting-bow", name: "Hunting Bow", icon: "🏹", price: 4, cooldown: 4, effects: { damage: 5 } },
  { id: "iron-cleaver", name: "Iron Cleaver", icon: "🪓", price: 5, cooldown: 8, effects: { damage: 12 } },
  { id: "oak-buckler", name: "Oak Buckler", icon: "🛡️", price: 3, cooldown: 5, effects: { block: 4 }, set: "defense" },
  { id: "pot-lid", name: "Pot Lid", icon: "🍳", price: 2, cooldown: 3, effects: { block: 2 }, set: "defense" },
  { id: "spiked-shield", name: "Spiked Shield", icon: "⚔️", price: 4, cooldown: 6, effects: { damage: 3, block: 3 }, set: "defense" },
  ...POISON_CATALOG,
  ...HEAL_CATALOG,
  ...FIRE_CATALOG
];

const byId = new Map(CATALOG.map((item) => [item.id, item]));

export function getItem(id: string): ItemDef {
  const item = byId.get(id);
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}

const EFFECT_LABELS: [keyof ItemEffects, (n: number) => string][] = [
  ["damage", (n) => `⚔️ ${n} dmg`],
  ["block", (n) => `🛡️ +${n} block`],
  /* REQUIREMENT 3: Effects need to have labels to be shown on the UI */
  ["poison", (n) => `🧪+${n} damage per stack`],
  ["heal", (n) => `❤️+${n} heal`],
  /** REQUIREMENT 4: Burn label effect for UI */
  ["burn", (n) => `🔥+${n} burn damage per stack`]
];

/** Short labels for an item's effects, e.g. `[{ effect: "damage", label: "⚔️ 2 dmg" }, …]`. */
export function describeEffects(effects: ItemEffects): { effect: keyof ItemEffects; label: string }[] {
  return EFFECT_LABELS.flatMap(([effect, label]) => (effects[effect] ? [{ effect, label: label(effects[effect]) }] : []));
}
