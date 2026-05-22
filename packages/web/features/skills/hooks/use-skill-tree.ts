"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  fetchSkillTree,
  addSkill as svcAddSkill,
  updateSkill as svcUpdateSkill,
  deleteSkill as svcDeleteSkill,
  batchSetDev as svcBatchSetDev,
  batchDeleteSkills as svcBatchDeleteSkills,
  saveSkillEdgesDelta,
  type Skill,
  type SkillEdge,
} from "@/lib/services/skill-service"
import type { SkillEffect } from "@/lib/skill-engine"

export type { Skill, SkillEdge }

export function useSkillTree() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [edges, setEdges] = useState<SkillEdge[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const supabase = createClient()
    const { skills: s, edges: e } = await fetchSkillTree(supabase)
    setSkills(s)
    setEdges(e)
    setLoading(false)
    return { skills: s, edges: e }
  }

  useEffect(() => {
    refresh()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addSkill = async (
    skill: {
      name: string
      skill_text?: string | null
      unlock_hint?: string | null
      unlock_key?: string | null
      is_passive?: boolean | null
      in_development?: boolean
      max_rank?: number | null
      min_level?: number
      effects?: SkillEffect[] | null
    },
    edgeParentId?: string,
    edgeChildId?: string
  ): Promise<{ success: boolean; skill?: Skill }> => {
    const supabase = createClient()
    const { data, error } = await svcAddSkill(supabase, skill)
    if (error || !data) return { success: false }

    const edgesToCreate: { parent_skill_id: string; child_skill_id: string; edge_type: string }[] =
      []
    if (edgeParentId)
      edgesToCreate.push({ parent_skill_id: edgeParentId, child_skill_id: data.id, edge_type: "unlocks" })
    if (edgeChildId)
      edgesToCreate.push({ parent_skill_id: data.id, child_skill_id: edgeChildId, edge_type: "unlocks" })
    if (edgesToCreate.length > 0) await saveSkillEdgesDelta(supabase, edgesToCreate, [])

    await refresh()
    return { success: true, skill: data as Skill }
  }

  const updateSkill = async (
    skillId: string,
    skill: {
      name: string
      skill_text?: string | null
      unlock_hint?: string | null
      unlock_key?: string | null
      is_passive?: boolean | null
      in_development?: boolean | null
      max_rank?: number | null
      min_level?: number | null
      effects?: SkillEffect[] | null
    }
  ): Promise<boolean> => {
    const supabase = createClient()
    const { error } = await svcUpdateSkill(supabase, skillId, skill)
    if (error) return false
    await refresh()
    return true
  }

  const deleteSkill = async (skillId: string): Promise<void> => {
    const supabase = createClient()
    await svcDeleteSkill(supabase, skillId)
    await refresh()
  }

  const addEdge = async (
    parentId: string,
    childId: string,
    edgeType = "unlocks"
  ): Promise<{ success: boolean; error?: string }> => {
    const supabase = createClient()
    const result = await saveSkillEdgesDelta(
      supabase,
      [{ parent_skill_id: parentId, child_skill_id: childId, edge_type: edgeType }],
      []
    )
    if (result.success) await refresh()
    return result
  }

  const deleteEdge = async (parentId: string, childId: string): Promise<boolean> => {
    const edge = edges.find(
      (e) => e.parent_skill_id === parentId && e.child_skill_id === childId
    )
    if (!edge) return false
    const supabase = createClient()
    const result = await saveSkillEdgesDelta(supabase, [], [edge.id])
    if (result.success) await refresh()
    return result.success
  }

  const batchSetDev = async (ids: string[], inDev: boolean): Promise<void> => {
    const supabase = createClient()
    await svcBatchSetDev(supabase, ids, inDev)
    await refresh()
  }

  const batchDelete = async (ids: string[]): Promise<void> => {
    const supabase = createClient()
    await svcBatchDeleteSkills(supabase, ids)
    await refresh()
  }

  return {
    skills,
    edges,
    loading,
    refresh,
    addSkill,
    updateSkill,
    deleteSkill,
    addEdge,
    deleteEdge,
    batchSetDev,
    batchDelete,
  }
}
