import { getActiveSets } from "./item_sets";
import { getItem } from "./items";
import { itemIdsOf } from "./shop";
import type { Backpack, BattleEvent, BattleResult, Fighter, FighterItem, FighterSnapshot, Opponent, Side } from "./types";

/** Seconds per battle tick. */
export const TICK_SECONDS = 0.5;
/** Battles that last longer are decided by the timeout rule. */
export const MAX_TICKS = 60;
export const HERO_BASE_HP = 40;

/** Turns a list of item ids into a fighter with the catalog values of each item. */
export function buildFighter(itemIds: string[], baseHp: number, name = "Fighter"): Fighter {
  const items: FighterItem[] = itemIds.map((id) => {
    const def = getItem(id);
    return { itemId: def.id, name: def.name, icon: def.icon, cooldown: def.cooldown, effects: { ...def.effects } };
  });
  return { name, maxHp: baseHp, items };
}

/** The player's fighter: every backpack item and the hero's base HP. */
export function buildPlayerFighter(backpack: Backpack): Fighter {
  return buildFighter(itemIdsOf(backpack), HERO_BASE_HP, "Hero");
}

export function buildOpponentFighter(opponent: Opponent): Fighter {
  return buildFighter(opponent.items, opponent.hp, opponent.name);
}

interface FighterState {
  fighter: Fighter;
  hp: number;
  block: number;
  /* REQUIREMENT 3: FighterState needs poison as interface to use for snapshot and initialization down below */
  poison: number;
  /** REQUIREMENT 4: FighterState needs burn to use for snapshot and init */
  burn: number;
  /** Ticks each item has charged towards its cooldown. */
  charge: number[];
}

const other = (side: Side): Side => (side === "player" ? "opponent" : "player");

const snapshot = (s: FighterState): FighterSnapshot => ({
  hp: Math.max(0, s.hp),
  maxHp: s.fighter.maxHp,
  block: s.block,
  poison: s.poison,
  burn: s.burn
});

const isDown = (s: FighterState) => s.hp <= 0;

/**
 * Runs a full battle. Pure and deterministic: the same fighters always give
 * the same result.
 *
 * Each tick:
 * 1. Each fighter charges all items by one tick; items whose charge reaches their cooldown fire.
 * 2. Fired items resolve (player first, then opponent). Both sides fire "simultaneously":
 *    which items fire is decided before any effect is applied.
 * After step 2 the battle ends if someone is down; if both are down, the player loses.
 * After `MAX_TICKS` the higher HP percentage wins; a tie is a player loss.
 */
export function simulateBattle(player: Fighter, opponent: Fighter): BattleResult {
  const state: Record<Side, FighterState> = {
    player: initState(player),
    opponent: initState(opponent),
  };
  const frames: BattleResult["frames"] = [
    { tick: 0, player: snapshot(state.player), opponent: snapshot(state.opponent), events: [] },
  ];
  const events: BattleEvent[] = [];

  const knockoutWinner = (): Side | null => {
    if (isDown(state.player)) return "opponent";
    if (isDown(state.opponent)) return "player";
    return null;
  };

  let winner: Side | null = null;
  let tick = 0;
  while (winner === null && tick < MAX_TICKS) {
    tick += 1;
    const tickEvents: BattleEvent[] = [];
    const emit = (event: Omit<BattleEvent, "tick">) => tickEvents.push({ tick, ...event });

    const fired: Record<Side, FighterItem[]> = {
      player: chargeItems(state.player),
      opponent: chargeItems(state.opponent),
    };
    for (const side of ["player", "opponent"] as const) {
      for (const item of fired[side]) resolveItem(item, state[side], state[other(side)], side, emit);
    }

    //Bugfix: Required separatation of item resolve and damage over time because of the comment behaviour above
    for (const side of ["player", "opponent"] as const) {
      /** REQUIREMENT 4: Adding damage and decay over time */
      if (tick % 2 === 0) {
        //Tryout tweaking
      }
      
      if (tick % 4 === 0) {
        //Bugfix: state.player only is the FighterState, nothing that is needed for an emit
        burnDamage(state[side], side, emit);  
        poisonDamage(state[side], side, emit);
      }
        //TODO: Eventually tweak the system a little bit for better experience
        decayBurn(state[side])  
    }

    winner = knockoutWinner();

    frames.push({ tick, player: snapshot(state.player), opponent: snapshot(state.opponent), events: tickEvents });
    events.push(...tickEvents);
  }

  if (winner !== null) return { winner, reason: "knockout", frames, events };
  return { winner: timeoutWinner(state.player, state.opponent), reason: "timeout", frames, events };
}

function initState(fighter: Fighter): FighterState {
  return { fighter, hp: fighter.maxHp, block: 0, poison: 0, burn: 0, charge: fighter.items.map(() => 0) };
}

/** Advances one tick of cooldowns and returns the items that fire this tick. */
function chargeItems(s: FighterState): FighterItem[] {
  const fired: FighterItem[] = [];
  s.fighter.items.forEach((item, i) => {
    s.charge[i] += 1;
    if (s.charge[i] >= item.cooldown) {
      s.charge[i] = 0;
      fired.push(item);
    }
  });
  return fired;
}

function resolveItem(
  item: FighterItem,
  self: FighterState,
  enemy: FighterState,
  side: Side,
  emit: (event: Omit<BattleEvent, "tick">) => void,
) {
  /* REQUIREMENT 3: Added poison for effects, implementing what happens */
  const { damage, block, poison, heal, burn } = item.effects;
  const base = { source: side, itemId: item.itemId };
  const enemySide = other(side);

  const itemIdsOfSelf = self.fighter.items.map((fighterItem) => fighterItem.itemId);
  const activeSetDefense = getActiveSets(itemIdsOfSelf).includes("defense");
  const activeSetFire = getActiveSets(itemIdsOfSelf).includes("fire");

  if (damage) {
    const absorbed = Math.min(enemy.block, damage);
    enemy.block -= absorbed;
    enemy.hp -= damage - absorbed;
    const note = absorbed > 0 ? ` (${absorbed} blocked)` : "";
    emit({ ...base, target: enemySide, kind: "damage", amount: damage, message: `${item.name} hits ${enemy.fighter.name} for ${damage}${note}` });
  }
  if (block) {
    const bonus = activeSetDefense ? 1 : 0;
    //Bugfix: Bonus block not showing in Combat Log
    const blockGained = block + bonus;
    self.block += blockGained;

    const note = bonus > 0 ? ` (+${bonus} Defense set bonus)` : "";

    emit({ ...base, target: side, kind: "block", amount: block, message: `${item.name} grants ${self.fighter.name} ${blockGained} block${note}` });
  }
  if (poison) {
    //Works with ticks, but stacks upon the current value
    enemy.poison += poison;
    emit({ ...base, target: enemySide, kind: "poison", amount: poison, message: `${item.name} applies ${poison} poison to ${enemy.fighter.name}`});
  }
  if (heal) {
    //No one-time use, does not stack but heals up until the maxHP
    self.hp = Math.min(self.fighter.maxHp, self.hp + heal);
    emit({ ...base, target: side, kind: "heal", amount: heal, message: `${item.name} heals ${self.fighter.name} for ${heal} HP` });  
  }
  if (burn) {
    /** REQUIREMENT 4: Adding burn to the effects with active setItem and stacking */
    const bonus = activeSetFire ? 1 : 0;
    //Bugfix: Bonus block not showing in Combat Log
    const burnPower = burn + bonus;
    const note = bonus > 0 ? ` (+${bonus} Fire set bonus)` : "";

    //Add the burn to the stack
    enemy.burn += burnPower;

    if (burnPower > 0) {
    emit({
      ...base,
      target: enemySide,
      kind: "burn",
      amount: burnPower,
      message: `${item.name} applies ${burnPower} burn to ${enemy.fighter.name}${note}`,
    });
    }
  }
}

/** REQUIREMENT 4: Adding burnDamage and poisonDamage() over time */
function burnDamage(target: FighterState, targetSide: Side,  emit: (event: Omit<BattleEvent, "tick">) => void) {
  //Returning the method if no burn is active
  if (target.burn <= 0 || target.hp <= 0) return;

  //Burn can be absorbed by block and also let's enemy take damage until 0
  const absorbed = Math.min(target.block, target.burn);
  const hpDamage = Math.min(target.hp, target.burn - absorbed);
  
  //Reduces the block and the hp after calculation
  target.block -= absorbed;
  target.hp -= hpDamage;
  
  //Note for the emit message for Combat Log
  const note = absorbed > 0 ? ` (${absorbed} fire damage blocked)` : "";
  //Bugfix: itemId? had to be optional to work with this approach and burn damage over time
  emit({
    source: other(targetSide), target: targetSide, kind: "burn", amount: hpDamage, message: `${target.fighter.name} takes ${hpDamage} burn damage${note}`,
  });
} 

function poisonDamage(target: FighterState, targetSide: Side,  emit: (event: Omit<BattleEvent, "tick">) => void)  {
    if (target.poison <= 0 || target.hp <= 0) return;
    const hpDamage = Math.min(target.hp, target.poison);

    target.hp -= hpDamage;
 
    emit({
    source: other(targetSide), target: targetSide, kind: "poison", amount: hpDamage, message: `${target.fighter.name} takes ${hpDamage} poison damage`,
  });
}


/** REQUIREMENT 4: Decaying the burn */
function decayBurn(target: FighterState) {
  target.burn = Math.min(
    //Bugfix: Burn went into the -0 zone
    Math.max(0, target.burn - 1),
    Math.max(0, target.hp),
  );
}

function timeoutWinner(player: FighterState, opponent: FighterState): Side {
  const ratio = (s: FighterState) => s.hp / s.fighter.maxHp;
  return ratio(player) > ratio(opponent) ? "player" : "opponent";
}
