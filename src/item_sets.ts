import { getItem } from "./items";
import type { ItemSetId } from "./types";

export const ITEM_SETS = {
  /** REQUIREMENT 4: The item sets and the lookup if an item set is activated is too big to have it in another .ts file */
  fire: {
    name: "Fire",
    description: "2+ items: each Burn applies +1 extra burn on the stack."
  },
  defense: {
    name: "Defense",
    description: "2+ items: each block item applies +1 extra block on activation."
  }
}

const countOfItemsOfSet = {
    fire: 0,
    defense: 0,
  };

const activeSets: ItemSetId[] = [];

export function getActiveSets(itemIds: string[]): ItemSetId[] {
  for (const id of itemIds){
    //get the setItems and count them
    const set = getItem(id).set;
    if(set) {
      countOfItemsOfSet[set] += 1;
    }
  }

  //Return the current active sets if the count is > 2`
  if(countOfItemsOfSet.fire >= 2) activeSets.push("fire");
  if(countOfItemsOfSet.defense >= 2) activeSets.push("defense");

  return activeSets;
}