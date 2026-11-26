import { HERO_BASE_HP, MAX_TICKS, TICK_SECONDS } from "./battle";
import { GOLD_PER_ROUND, REROLL_COST, START_GOLD, START_LIVES, WINS_TO_VICTORY } from "./run";
import { BACKPACK_COLS, BACKPACK_ROWS, SHOP_SIZE } from "./shop";
import type { ItemEffects } from "./types";

/**
 * Player-facing explanations of the rules. Built from the game constants so
 * the texts stay correct when numbers are rebalanced.
 */

const BATTLE_SECONDS = MAX_TICKS * TICK_SECONDS;

/** Tooltip per item effect. */
export const EFFECT_HELP: Record<keyof ItemEffects, string> = {
  damage: "Damage: hits the enemy. Block absorbs it first, the rest is lost from HP.",
  block: "Block: absorbs incoming damage until used up. Unused block stays for the rest of the battle.",
  /* REQUIREMENT 3: needed to add poison and heal for 'hovering-over' effect at items*/
  poison: "Poison: Adds stacks to the enemy on each activation. Every 2 seconds (4 ticks), each stack deals 1 HP of damage and ignores block. Stacks last until the battle ends.",
  heal: "Heal: Immediately restores the user’s HP by the listed amount, up to their maximum HP.",
  burn: "Burn: Deals 1 damage per stack every 2 ticks. Block absorbs burn damage. Burn stacks decrease by 1 every tick and are capped at the fighter's remaining HP."
};

export const COOLDOWN_HELP = `Cooldown: the item fires every time this much battle time has passed (1 tick = ${TICK_SECONDS} s).`;

/** Tooltip per fighter status shown in battle. */
export const STATUS_HELP = {
  hp: "HP: reaching 0 is a knockout.",
  block: EFFECT_HELP.block,
  /* REQUIREMENT 3: Needed to add the poison to the STATUS_HELP for explaining the poison state at battle time*/
  poison: EFFECT_HELP.poison,
  burn: EFFECT_HELP.burn,
  timer: `After ${BATTLE_SECONDS} s the fighter with the higher share of HP wins; a tie counts as your loss.`,
};

export interface RuleSection {
  title: string;
  rules: string[];
}

export const RULES: RuleSection[] = [
  {
    title: "🏆 The run",
    rules: [
      `Reach ${WINS_TO_VICTORY} wins before you lose all ${START_LIVES} lives.`,
      `Each battle is one round: a win gives +1 win, a loss costs 1 life.`,
      `Opponents get tougher every round.`,
    ],
  },
  {
    title: "🏪 Shop & backpack",
    rules: [
      `You start with ${START_GOLD} 🪙 and earn ${GOLD_PER_ROUND} 🪙 at the start of every new round. Unspent gold carries over.`,
      `The shop offers ${SHOP_SIZE} new items every round.`,
      `Bought items go to the first free slot of your ${BACKPACK_COLS}×${BACKPACK_ROWS} backpack.`,
      // [req-1.4]: Explain the new selling rule.
      `Sell an item for half its original price, rounded down.`,
      // [req-1.4]: Explain reroll costs and behavior.
      `Reroll all shop offers for ${REROLL_COST} gold.`,
      // [req-2.4]: Explain how to move and swap backpack items.
      `Select an item, then click another slot to move or swap it.`,
      // [req-2.4]: Explain valid targets and how to cancel a selection.
      `Green slots show valid moves. Click the selected item again or use Cancel selection to cancel.`,
      // [req-2.4]: Explain that backpack arrangement is also shop-only.
      `Buying, selling, rerolling and rearranging items are only available while shopping.`,
      `Only items in your backpack fight. Their position doesn't matter.`,
    ],
  },
  {
    title: "⚔️ Battle",
    rules: [
      `Battles run on their own. Your hero has ${HERO_BASE_HP} HP; every item fires whenever its cooldown is up.`,
      `Damage hits block first; only the rest is lost from HP. Unused block stays for the rest of the battle.`,
      `Knock the enemy out to win. ${STATUS_HELP.timer} If both fall at once, you lose.`,
    ],
  },
  /** REQUIREMENT 3: Item Effects Ruleset */
  {
    title: "🧪 Item Effects",
    rules: [
      `Some Battle Items have special Effects like Poison or Heal.`,
      `The effects are activated during battle after a certain time.`,
      `🧪 Poison adds stacks to the enemy on each activation. Every 2 seconds (4 ticks), each stack deals 1 HP of damage and ignores block. Stacks last until the battle ends.`,
      `❤️ Heal immediately restores the user’s HP by the listed amount, up to their maximum HP.`,
      // [req-4]: Explain burn damage, stacking and decay.
      `Burn stacks accumulate with every burn item activation.`,
      `Burn deals 1 damage per stack every 2 ticks (${2 * TICK_SECONDS} s).`,
      `Block absorbs burn damage before HP is reduced.`,
      `Burn stacks decrease by 1 every tick and are capped at the fighter's remaining HP.`,
      `Burn ends when no stacks remain.`,
    ],
  },
  /** REQUIREMENT 4: Item Sets Rules */
  {
    title: "📖 Item Sets",
    rules: [
      `Some Battle Items have a set bonus that can be applied.`,
      `It only applies in Battle if you have 2+ items of the same set bonus category.`,
      `The Item Sets are marked with a badge on the top right corner and the active bonuses are shown below the panels.`,
      // [req-4]: Clarify that the fire set bonus is fixed.
      `Fire Set: With at least 2 Fire items, each burn item activation applies 1 additional burn stack. More items do not increase the bonus.`,
      `🛡️ Defense Set Items: add +1 block to each set item.`,
    ],
  },
  /** Requirement 7: Hall Of Fame, how it works */
  {
    title: "🏅 Hall of Fame",
    rules: [
    `After finishing a run, enter your name to submit your score, or close the popup to skip.`,
    `Victories rank before defeats, then more wins, then fewer rounds. Ties favour earlier submissions.`,
    `If submission fails, retry without retyping your name.`,
    `Open the Hall of Fame from the header at any time.`,
    `Scores are stored temporarily and cleared when the API server restarts.`,
    ],
  },
];
