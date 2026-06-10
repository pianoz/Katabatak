/**
 * Client-side copy of bumper lane normalization maps from packages/server/gm/bumper-lanes.ts.
 * Used by the code grader to treat bumper-lane aliases as passing grades.
 * Keep in sync with the server-side file when adding new mappings.
 */

export function collapse(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function applyBumperLane(value: unknown, map: Record<string, string>): unknown {
  if (typeof value !== 'string') return value
  return map[collapse(value)] ?? value
}

export const LEDGER_ACTIONS: Record<string, string> = {
  movecharacter: 'move_character',
  moveto: 'move_character',
  move: 'move_character',

  updateentity: 'update_entity',
  modifyentity: 'update_entity',

  createentity: 'create_entity',
  addentity: 'create_entity',
  newentity: 'create_entity',

  deleteentity: 'delete_entity',
  removeentity: 'delete_entity',
  destroyentity: 'delete_entity',

  updatenpc: 'update_npc',
  modifynpc: 'update_npc',

  longrest: 'long_rest',
  overnightrest: 'long_rest',
  fullrest: 'long_rest',
  sleep: 'long_rest',
  rest: 'long_rest',

  grantitem: 'grant_item',
  giveitem: 'grant_item',
  additem: 'grant_item',
  pickup: 'grant_item',
}

export const LORE_ACTION_TYPES: Record<string, string> = {
  info: 'info',
  information: 'info',
  inquiry: 'info',
  explore: 'info',
  passive: 'info',

  task: 'task',
  action: 'task',
  attempt: 'task',

  attack: 'attack',
  combat: 'attack',
  fight: 'attack',
  strike: 'attack',
}

export const LORE_POOLS: Record<string, string> = {
  power: 'Power',
  strength: 'Power',
  physical: 'Power',
  constitution: 'Power',
  conviction: 'Power',

  essence: 'Essence',
  magic: 'Essence',
  perception: 'Essence',
  lore: 'Essence',

  will: 'Will',
  willpower: 'Will',
  mental: 'Will',
  social: 'Will',
  endurance: 'Will',
}

export const QUEST_STATUSES: Record<string, string> = {
  active: 'active',
  inprogress: 'active',
  ongoing: 'active',
  started: 'active',
  open: 'active',

  completed: 'completed',
  complete: 'completed',
  done: 'completed',
  finished: 'completed',
  success: 'completed',
  succeeded: 'completed',

  failed: 'failed',
  failure: 'failed',
  abandoned: 'failed',
  lost: 'failed',
}

export const ITEM_TYPES: Record<string, string> = {
  weapon: 'weapon',
  sword: 'weapon',
  blade: 'weapon',
  bow: 'weapon',
  staff: 'weapon',

  armor: 'armor',
  armour: 'armor',
  shield: 'armor',
  helm: 'armor',
  helmet: 'armor',

  consumable: 'consumable',
  potion: 'consumable',
  food: 'consumable',
  drink: 'consumable',
  scroll: 'consumable',

  misc: 'misc',
  miscellaneous: 'misc',
  other: 'misc',
  key: 'misc',
  tool: 'misc',
  trinket: 'misc',

  currency: 'currency',
  gold: 'currency',
  silver: 'currency',
  money: 'currency',
  dollars: 'currency',
  coin: 'currency',
  coins: 'currency',
  denarius: 'currency',
  denarii: 'currency',
}
