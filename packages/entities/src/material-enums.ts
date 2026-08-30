/** Where a base material is acquired from */
export enum MaterialSource {
  MARKET = 'Market',
  CRAFT = 'Craft',
  NPC = 'NPC',
}

/** Separates regular crafting inventory from utility/repair supplies */
export enum MaterialCategory {
  CRAFTING = 'crafting',
  REPAIR = 'repair',
}
