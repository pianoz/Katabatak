"use client"

import { create } from "zustand"
import type { CharacterSnapshot, InventorySnapshot } from "@/lib/services/snapshot-service"

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PoolKey = "health" | "essence" | "power" | "will"

/** Stats that modifyStat can delta — pool maxes plus scalar stats. */
export type StatKey =
  | "health_max"
  | "essence_max"
  | "power_max"
  | "will_max"
  | "speed"
  | "denarius"
  | "unused_skill_points"

export interface LivePool {
  current: number
  max: number
}

export interface LiveInventoryItem {
  inventory_id: string
  item_id: string
  name: string
  type: string | null
  is_equipped: boolean
  condition: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export interface LiveSheet {
  health: LivePool
  essence: LivePool
  power: LivePool
  will: LivePool
  speed: number
  denarius: number
  unused_skill_points: number
  inventory: LiveInventoryItem[]
}

function snapshotToSheet(snapshot: CharacterSnapshot): LiveSheet {
  return {
    health: {
      current: snapshot.current_health ?? 0,
      max: snapshot.health_max ?? 0,
    },
    essence: {
      current: snapshot.current_essence ?? 0,
      max: snapshot.essence_max ?? 0,
    },
    power: {
      current: snapshot.current_power ?? 0,
      max: snapshot.power_max ?? 0,
    },
    will: {
      current: snapshot.current_will ?? 0,
      max: snapshot.will_max ?? 0,
    },
    speed: snapshot.speed ?? 30,
    denarius: snapshot.denarius ?? 0,
    unused_skill_points: snapshot.unused_skill_points,
    inventory: snapshot.inventory.map((item: InventorySnapshot) => ({
      inventory_id: item.inventory_id,
      item_id: item.item_id,
      name: item.name,
      type: item.type,
      is_equipped: item.is_equipped,
      condition: item.condition,
    })),
  }
}

function sheetEquals(a: LiveSheet, b: LiveSheet): boolean {
  if (
    a.health.current !== b.health.current ||
    a.health.max !== b.health.max ||
    a.essence.current !== b.essence.current ||
    a.essence.max !== b.essence.max ||
    a.power.current !== b.power.current ||
    a.power.max !== b.power.max ||
    a.will.current !== b.will.current ||
    a.will.max !== b.will.max ||
    a.speed !== b.speed ||
    a.denarius !== b.denarius ||
    a.unused_skill_points !== b.unused_skill_points
  ) {
    return false
  }
  if (a.inventory.length !== b.inventory.length) return false
  for (let i = 0; i < a.inventory.length; i++) {
    if (
      a.inventory[i].inventory_id !== b.inventory[i].inventory_id ||
      a.inventory[i].is_equipped !== b.inventory[i].is_equipped ||
      a.inventory[i].condition !== b.inventory[i].condition
    ) {
      return false
    }
  }
  return true
}

function liveSheet(state: CharacterStoreState): LiveSheet {
  return {
    health: state.health,
    essence: state.essence,
    power: state.power,
    will: state.will,
    speed: state.speed,
    denarius: state.denarius,
    unused_skill_points: state.unused_skill_points,
    inventory: state.inventory,
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface CharacterStoreState extends LiveSheet {
  characterId: string | null
  isDirty: boolean
  _committed: LiveSheet | null

  /**
   * Initialize (or reload) the store from a freshly fetched CharacterSnapshot.
   * Clears isDirty and sets the committed baseline.
   */
  loadFromSnapshot: (snapshot: CharacterSnapshot) => void

  /**
   * Set a pool's current value. Clamped to [0, max].
   * Does not write to the database.
   */
  updatePool: (pool: PoolKey, value: number) => void

  /**
   * Apply a signed delta to a stat (e.g., +1 or -1).
   * Does not write to the database.
   */
  modifyStat: (stat: StatKey, delta: number) => void

  /**
   * Toggle the equipped state of an inventory item by inventory_id.
   * Does not write to the database.
   */
  toggleEquip: (inventoryId: string) => void

  /**
   * Advance the committed baseline to the current live state, clearing isDirty.
   * Call this after a successful DB write confirms the live state.
   */
  markCommitted: () => void

  /**
   * Mark a specific saved snapshot as the new committed baseline.
   * Use this instead of markCommitted when saving happens asynchronously —
   * the snapshot represents exactly what was written to the DB, and isDirty
   * is recomputed against the current live state so any changes made during
   * the in-flight write are not silently discarded.
   */
  markSaved: (snapshot: LiveSheet) => void

  /**
   * Revert all live edits back to the last committed baseline.
   */
  reset: () => void
}

export const useCharacterStore = create<CharacterStoreState>((set, get) => ({
  characterId: null,
  isDirty: false,
  _committed: null,

  // Pool defaults — overwritten by loadFromSnapshot before any UI renders
  health: { current: 0, max: 0 },
  essence: { current: 0, max: 0 },
  power: { current: 0, max: 0 },
  will: { current: 0, max: 0 },
  speed: 30,
  denarius: 0,
  unused_skill_points: 0,
  inventory: [],

  loadFromSnapshot(snapshot) {
    const sheet = snapshotToSheet(snapshot)
    set({
      characterId: snapshot.character_id,
      ...sheet,
      _committed: sheet,
      isDirty: false,
    })
  },

  updatePool(pool, value) {
    set((state) => {
      const poolState = state[pool]
      const next = { ...state[pool], current: Math.max(0, Math.min(value, poolState.max)) }
      const updated = { ...state, [pool]: next }
      return {
        [pool]: next,
        isDirty: !state._committed || !sheetEquals(liveSheet(updated as CharacterStoreState), state._committed),
      }
    })
  },

  modifyStat(stat, delta) {
    set((state) => {
      const poolMaxMap: Record<string, PoolKey | null> = {
        health_max: "health",
        essence_max: "essence",
        power_max: "power",
        will_max: "will",
      }
      const poolKey = poolMaxMap[stat] ?? null

      let nextState: Partial<CharacterStoreState>

      if (poolKey) {
        // Updating a pool max — also update the pool object
        const pool = state[poolKey]
        const newMax = Math.max(0, pool.max + delta)
        nextState = { [poolKey]: { ...pool, max: newMax } }
      } else {
        const current = state[stat as Exclude<StatKey, "health_max" | "essence_max" | "power_max" | "will_max">] as number
        nextState = { [stat]: Math.max(0, current + delta) }
      }

      const merged = { ...state, ...nextState }
      return {
        ...nextState,
        isDirty: !state._committed || !sheetEquals(liveSheet(merged as CharacterStoreState), state._committed),
      }
    })
  },

  toggleEquip(inventoryId) {
    set((state) => {
      const inventory = state.inventory.map((item) =>
        item.inventory_id === inventoryId
          ? { ...item, is_equipped: !item.is_equipped }
          : item
      )
      return {
        inventory,
        isDirty: !state._committed || !sheetEquals({ ...liveSheet(state), inventory }, state._committed),
      }
    })
  },

  markCommitted() {
    set((state) => ({
      _committed: liveSheet(state),
      isDirty: false,
    }))
  },

  markSaved(snapshot) {
    set((state) => ({
      _committed: snapshot,
      isDirty: !sheetEquals(liveSheet(state), snapshot),
    }))
  },

  reset() {
    const committed = get()._committed
    if (!committed) return
    set({
      ...committed,
      isDirty: false,
    })
  },
}))
