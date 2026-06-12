import type { SupabaseClient } from "@supabase/supabase-js"
import type { Json } from "@/components/types/supabase"

export type EntityType = "nation" | "region" | "place" | "location" | "npc" | "item"

export interface WorldEntity {
  id: string
  name: string
  type: EntityType
  parent_id: string | null
  nation_context: string | null
  region_context: string | null
  place_context: string | null
  data: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
}

export interface CreateWorldEntityPayload {
  id: string
  name: string
  type: EntityType
  parent_id?: string | null
  nation_context?: string | null
  region_context?: string | null
  place_context?: string | null
  data: {
    short_description?: string
    long_description?: string
    knowledge?: string[]
  }
}

const ENTITY_COLS =
  "id, name, type, parent_id, nation_context, region_context, place_context, data, created_at, updated_at"

export async function listWorldEntities(
  supabase: SupabaseClient,
  filterType?: EntityType
): Promise<WorldEntity[]> {
  let q = supabase.from("world_entities").select(ENTITY_COLS).order("type").order("name")
  if (filterType) q = q.eq("type", filterType)
  const { data } = await q
  return (data ?? []) as unknown as WorldEntity[]
}

export async function getWorldEntityById(
  supabase: SupabaseClient,
  id: string
): Promise<WorldEntity | null> {
  const { data } = await supabase
    .from("world_entities")
    .select(ENTITY_COLS)
    .eq("id", id)
    .single()
  return data ? (data as unknown as WorldEntity) : null
}

export async function getEntitiesByTypes(
  supabase: SupabaseClient,
  types: EntityType[]
): Promise<WorldEntity[]> {
  if (types.length === 0) return []
  const { data } = await supabase
    .from("world_entities")
    .select(ENTITY_COLS)
    .in("type", types)
    .order("type")
    .order("name")
  return (data ?? []) as unknown as WorldEntity[]
}

export async function updateWorldEntity(
  supabase: SupabaseClient,
  id: string,
  updates: {
    name?: string
    parent_id?: string | null
    nation_context?: string | null
    region_context?: string | null
    place_context?: string | null
    data?: Record<string, unknown>
  }
) {
  return supabase
    .from("world_entities")
    .update({
      ...updates,
      data: updates.data as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(ENTITY_COLS)
    .single()
}

export async function createWorldEntity(
  supabase: SupabaseClient,
  payload: CreateWorldEntityPayload
) {
  return supabase
    .from("world_entities")
    .insert({
      id: payload.id,
      name: payload.name,
      type: payload.type,
      parent_id: payload.parent_id ?? null,
      nation_context: payload.nation_context ?? null,
      region_context: payload.region_context ?? null,
      place_context: payload.place_context ?? null,
      data: payload.data as unknown as Json,
    })
    .select(ENTITY_COLS)
    .single()
}
