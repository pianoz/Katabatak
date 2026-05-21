"use client"

import { useState, useEffect } from "react"

const EFFECT_SKELETON = JSON.stringify(
  [
    {
      type: "",
      target: null,
      source: null,
      destination: null,
      add: null,
      multiply: null,
      condition: {
        weapon_type: null,
        armor_type: null,
        item_type: null,
        is_combat: null,
      },
      limit: {
        amount: null,
        period: null,
      },
      grant_spell: null,
      grant_item: null,
    },
  ],
  null,
  2
)
import { Button } from "@/components/ui/button"
import { 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Home, 
  List,
  GitBranch,
  Pencil,
  X,
  Check
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Json } from "@/components/types/supabase"
import type { SkillEffect } from "@/lib/skill-engine"

interface Skill {
  id: string
  name: string
  skill_text?: string | null
  unlock_hint?: string | null
  unlock_key?: string | null
  is_passive?: boolean | null
  max_rank?: number | null
  min_level?: number | null
  in_development?: boolean | null
  effects?: unknown
}

interface SkillEdge {
  id: string
  parent_skill_id: string | null
  child_skill_id: string | null
  edge_type?: string | null
}

type ViewMode = "tree" | "list"

async function saveSkillEdgesDelta(
  upsertEdges: { parent_skill_id: string; child_skill_id: string; edge_type?: string }[],
  deleteEdgeIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  const { error } = await supabase.rpc("save_skill_edges_delta", {
    p_delete_ids: deleteEdgeIds,
    p_upsert_edges: upsertEdges,
  })
  if (error) {
    console.error("saveSkillEdgesDelta:", error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export function SkillTreeEditor() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [edges, setEdges] = useState<SkillEdge[]>([])
  const [currentSkill, setCurrentSkill] = useState<Skill | null>(null)
  const [rootSkills, setRootSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>("tree")

  // Modal states
  const [showAddSkill, setShowAddSkill] = useState(false)
  const [showAddEdge, setShowAddEdge] = useState(false)
  const [showRemoveEdge, setShowRemoveEdge] = useState(false)
  const [edgeError, setEdgeError] = useState<string | null>(null)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [editingEffectsJson, setEditingEffectsJson] = useState("[]")
  const [effectsJsonError, setEffectsJsonError] = useState<string | null>(null)

  // Form states
  const [newSkill, setNewSkill] = useState({ name: "", skill_text: "", unlock_hint: "", unlock_key: "", is_passive: false, in_development: false, max_rank: 1, min_level: 0, effects_json: EFFECT_SKELETON, edge_parent_id: "", edge_child_id: "" })
  const [newEdge, setNewEdge] = useState({ parent_skill_id: "", child_skill_id: "", edge_type: "unlocks" })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const supabase = createClient()

    const [skillsRes, edgesRes] = await Promise.all([
      supabase.from("skills").select("*").order("name"),
      supabase.from("skill_edges").select("*")
    ])

    if (skillsRes.data) setSkills(skillsRes.data)
    if (edgesRes.data) setEdges(edgesRes.data)

    if (skillsRes.data && edgesRes.data) {
      const childIds = new Set(edgesRes.data.map(e => e.child_skill_id))
      const roots = skillsRes.data.filter(s => !childIds.has(s.id))
      setRootSkills(roots)

      if (currentSkill) {
        const updated = skillsRes.data.find(s => s.id === currentSkill.id)
        if (updated) setCurrentSkill(updated)
      } else if (roots.length > 0) {
        setCurrentSkill(roots[0])
      } else if (skillsRes.data.length > 0) {
        setCurrentSkill(skillsRes.data[0])
      }
    }

    setLoading(false)
  }

  const getParents = (skillId: string): Skill[] => {
    const parentIds = edges.filter(e => e.child_skill_id === skillId).map(e => e.parent_skill_id)
    return skills.filter(s => parentIds.includes(s.id))
  }

  const getChildren = (skillId: string): Skill[] => {
    const childIds = edges.filter(e => e.parent_skill_id === skillId).map(e => e.child_skill_id)
    return skills.filter(s => childIds.includes(s.id))
  }

  const getEdgeType = (parentId: string, childId: string): string => {
    const edge = edges.find(e => e.parent_skill_id === parentId && e.child_skill_id === childId)
    return edge?.edge_type || "unlocks"
  }

  const navigateTo = (skill: Skill) => {
    setCurrentSkill(skill)
  }

  const handleAddSkill = async () => {
    if (!newSkill.name.trim()) return

    let effects: SkillEffect[] | null = null
    const trimmed = newSkill.effects_json.trim()
    if (trimmed && trimmed !== "[]") {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) effects = parsed
      } catch { /* skip invalid effects */ }
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from("skills")
      .insert({
        name: newSkill.name,
        skill_text: newSkill.skill_text || null,
        unlock_hint: newSkill.unlock_hint || null,
        unlock_key: newSkill.unlock_key || null,
        is_passive: newSkill.is_passive || null,
        in_development: newSkill.in_development,
        max_rank: newSkill.max_rank || null,
        min_level: newSkill.min_level ?? 0,
        effects: effects as Json | null,
      })
      .select()
      .single()

    if (!error && data) {
      const edgesToCreate: { parent_skill_id: string; child_skill_id: string; edge_type: string }[] = []
      if (newSkill.edge_parent_id) {
        edgesToCreate.push({ parent_skill_id: newSkill.edge_parent_id, child_skill_id: data.id, edge_type: "unlocks" })
      }
      if (newSkill.edge_child_id) {
        edgesToCreate.push({ parent_skill_id: data.id, child_skill_id: newSkill.edge_child_id, edge_type: "unlocks" })
      }
      if (edgesToCreate.length > 0) {
        await saveSkillEdgesDelta(edgesToCreate, [])
      }
      setNewSkill({ name: "", skill_text: "", unlock_hint: "", unlock_key: "", is_passive: false, in_development: false, max_rank: 1, min_level: 0, effects_json: EFFECT_SKELETON, edge_parent_id: "", edge_child_id: "" })
      setShowAddSkill(false)
      fetchData()
    }
  }

  const handleUpdateSkill = async () => {
    if (!editingSkill || !editingSkill.name.trim()) return

    let effects: SkillEffect[] | null = null
    const trimmed = editingEffectsJson.trim()
    if (trimmed && trimmed !== "[]") {
      try {
        const parsed = JSON.parse(trimmed)
        if (!Array.isArray(parsed)) throw new Error()
        effects = parsed
      } catch {
        setEffectsJsonError("Must be a valid JSON array")
        return
      }
    }
    setEffectsJsonError(null)

    const supabase = createClient()
    const { error } = await supabase
      .from("skills")
      .update({
        name: editingSkill.name,
        skill_text: editingSkill.skill_text || null,
        unlock_hint: editingSkill.unlock_hint || null,
        unlock_key: editingSkill.unlock_key || null,
        is_passive: editingSkill.is_passive ?? null,
        in_development: editingSkill.in_development ?? false,
        max_rank: editingSkill.max_rank ?? null,
        min_level: editingSkill.min_level ?? 0,
        effects: effects as Json | null,
      })
      .eq("id", editingSkill.id)

    if (!error) {
      setEditingSkill(null)
      fetchData()
    }
  }

  const handleOpenEditSkill = (skill: Skill) => {
    setEditingSkill(skill)
    setEditingEffectsJson(skill.effects ? JSON.stringify(skill.effects, null, 2) : "[]")
    setEffectsJsonError(null)
  }

  const handleAddEdge = async () => {
    if (!newEdge.parent_skill_id || !newEdge.child_skill_id) return
    if (newEdge.parent_skill_id === newEdge.child_skill_id) return

    setEdgeError(null)
    const result = await saveSkillEdgesDelta(
      [{ parent_skill_id: newEdge.parent_skill_id, child_skill_id: newEdge.child_skill_id, edge_type: newEdge.edge_type }],
      []
    )

    if (result.success) {
      setNewEdge({ parent_skill_id: "", child_skill_id: "", edge_type: "unlocks" })
      setShowAddEdge(false)
      fetchData()
    } else {
      setEdgeError(result.error ?? "Failed to add connection.")
    }
  }

  const handleDeleteSkill = async (skillId: string) => {
    if (!confirm("Delete this skill and all its connections?")) return

    const supabase = createClient()

    await supabase.from("skill_edges").delete().or(`parent_skill_id.eq.${skillId},child_skill_id.eq.${skillId}`)
    await supabase.from("skills").delete().eq("id", skillId)

    if (currentSkill?.id === skillId) {
      setCurrentSkill(null)
    }
    fetchData()
  }

  const handleBatchDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} skill${ids.length > 1 ? "s" : ""} and all their connections?`)) return

    const supabase = createClient()
    for (const id of ids) {
      await supabase.from("skill_edges").delete().or(`parent_skill_id.eq.${id},child_skill_id.eq.${id}`)
    }
    await supabase.from("skills").delete().in("id", ids)

    if (currentSkill && ids.includes(currentSkill.id)) {
      setCurrentSkill(null)
    }
    fetchData()
  }

  const handleDeleteEdge = async (parentId: string, childId: string) => {
    const edge = edges.find(e => e.parent_skill_id === parentId && e.child_skill_id === childId)
    if (!edge) return

    const result = await saveSkillEdgesDelta([], [edge.id])
    if (result.success) {
      fetchData()
    } else {
      console.error("Delete edge failed:", result.error)
    }
  }

  if (loading) {
    return (
      <div className="border border-border bg-card p-8 flex items-center justify-center min-h-125">
        <p className="text-muted-foreground text-sm italic font-serif">Loading skill tree...</p>
      </div>
    )
  }

  const parents = currentSkill ? getParents(currentSkill.id) : []
  const children = currentSkill ? getChildren(currentSkill.id) : []

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl text-foreground mb-1">Skill Tree</h2>
          <p className="text-muted-foreground text-sm">
            {skills.length} skills, {edges.length} connections
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex border border-border">
            <button
              onClick={() => setViewMode("tree")}
              className={`px-3 py-2 text-xs uppercase tracking-widest flex items-center gap-1 transition-colors ${
                viewMode === "tree" 
                  ? "bg-foreground text-background" 
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <GitBranch className="w-4 h-4" />
              Tree
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-2 text-xs uppercase tracking-widest flex items-center gap-1 transition-colors ${
                viewMode === "list" 
                  ? "bg-foreground text-background" 
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
          </div>

          <Button
            onClick={() => setShowAddSkill(true)}
            className="bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
          >
            <Plus className="w-4 h-4 mr-1" />
            Skill
          </Button>
          <Button
            onClick={() => setShowAddEdge(true)}
            variant="outline"
            className="border-border text-foreground hover:bg-secondary uppercase tracking-widest text-xs"
          >
            <Plus className="w-4 h-4 mr-1" />
            Edge
          </Button>
          <Button
            onClick={() => setShowRemoveEdge(true)}
            variant="outline"
            className="border-border text-foreground hover:bg-secondary uppercase tracking-widest text-xs"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Edge
          </Button>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === "tree" ? (
        <TreeView
          skills={skills}
          edges={edges}
          currentSkill={currentSkill}
          rootSkills={rootSkills}
          parents={parents}
          children={children}
          navigateTo={navigateTo}
          getEdgeType={getEdgeType}
          onDeleteSkill={handleDeleteSkill}
          onDeleteEdge={handleDeleteEdge}
          onEditSkill={handleOpenEditSkill}
        />
      ) : (
        <ListView
          skills={skills}
          edges={edges}
          getParents={getParents}
          getChildren={getChildren}
          onDeleteSkill={handleDeleteSkill}
          onBatchDelete={handleBatchDelete}
          onEditSkill={handleOpenEditSkill}
          onNavigate={(skill) => {
            setCurrentSkill(skill)
            setViewMode("tree")
          }}
        />
      )}

      {/* Add Skill Modal */}
      {showAddSkill && (
        <Modal onClose={() => setShowAddSkill(false)}>
          <h3 className="font-serif text-lg text-foreground mb-4">Add New Skill</h3>
          <div className="space-y-4">
            <Field label="Name">
              <input
                type="text"
                value={newSkill.name}
                onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                placeholder="Skill name"
                className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground"
                autoFocus
              />
            </Field>
            <Field label="Skill Text">
              <textarea
                value={newSkill.skill_text}
                onChange={(e) => setNewSkill({ ...newSkill, skill_text: e.target.value })}
                placeholder="Description shown to the player..."
                rows={2}
                className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground resize-none"
              />
            </Field>
            <Field label="Unlock Hint">
              <textarea
                value={newSkill.unlock_hint}
                onChange={(e) => setNewSkill({ ...newSkill, unlock_hint: e.target.value })}
                placeholder="A cryptic hint for the player..."
                rows={2}
                className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground resize-none"
              />
            </Field>
            <Field label="Unlock Key">
              <input
                type="text"
                value={newSkill.unlock_key}
                onChange={(e) => setNewSkill({ ...newSkill, unlock_key: e.target.value })}
                placeholder="QUEST_COMPLETE"
                className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground"
              />
            </Field>
            <div className="flex gap-4">
              <Field label="Max Rank">
                <input
                  type="number"
                  min={1}
                  value={newSkill.max_rank}
                  onChange={(e) => setNewSkill({ ...newSkill, max_rank: parseInt(e.target.value) || 1 })}
                  className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2"
                />
              </Field>
              <Field label="Min Level">
                <input
                  type="number"
                  min={0}
                  value={newSkill.min_level}
                  onChange={(e) => setNewSkill({ ...newSkill, min_level: parseInt(e.target.value) || 0 })}
                  className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2"
                />
              </Field>
              <Field label="Passive">
                <div className="flex items-center h-9.5">
                  <input
                    type="checkbox"
                    checked={newSkill.is_passive}
                    onChange={(e) => setNewSkill({ ...newSkill, is_passive: e.target.checked })}
                    className="w-4 h-4 accent-cyan-500"
                  />
                </div>
              </Field>
              <Field label="In Dev">
                <div className="flex items-center h-9.5">
                  <input
                    type="checkbox"
                    checked={newSkill.in_development}
                    onChange={(e) => setNewSkill({ ...newSkill, in_development: e.target.checked })}
                    className="w-4 h-4 accent-orange-500"
                  />
                </div>
              </Field>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Effects (JSON)</label>
                <a
                  href="/Skill-Effects-Reference.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs uppercase tracking-widest text-cyan-400 hover:text-cyan-300 border border-cyan-800 hover:border-cyan-500 px-2 py-0.5 transition-colors"
                >
                  Reference
                </a>
              </div>
              <textarea
                value={newSkill.effects_json}
                onChange={(e) => setNewSkill({ ...newSkill, effects_json: e.target.value })}
                rows={4}
                spellCheck={false}
                className="w-full bg-secondary border border-border text-foreground text-xs px-3 py-2 font-mono resize-none"
              />
            </div>
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Connect (optional)</p>
              <Field label="Parent Skill">
                <select
                  value={newSkill.edge_parent_id}
                  onChange={(e) => setNewSkill({ ...newSkill, edge_parent_id: e.target.value })}
                  className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2"
                >
                  <option value="">None</option>
                  {skills.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Child Skill">
                <select
                  value={newSkill.edge_child_id}
                  onChange={(e) => setNewSkill({ ...newSkill, edge_child_id: e.target.value })}
                  className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2"
                >
                  <option value="">None</option>
                  {skills.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleAddSkill}
                disabled={!newSkill.name.trim()}
                className="flex-1 bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
              >
                Add Skill
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAddSkill(false)}
                className="border-border text-foreground hover:bg-secondary uppercase tracking-widest text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Edge Modal */}
      {showAddEdge && (
        <Modal onClose={() => setShowAddEdge(false)}>
          <h3 className="font-serif text-lg text-foreground mb-4">Add Connection</h3>
          <div className="space-y-4">
            <Field label="Parent Skill">
              <select
                value={newEdge.parent_skill_id}
                onChange={(e) => setNewEdge({ ...newEdge, parent_skill_id: e.target.value })}
                className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2"
              >
                <option value="">Select parent...</option>
                {skills.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Child Skill">
              <select
                value={newEdge.child_skill_id}
                onChange={(e) => setNewEdge({ ...newEdge, child_skill_id: e.target.value })}
                className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2"
              >
                <option value="">Select child...</option>
                {skills.filter(s => s.id !== newEdge.parent_skill_id).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Edge Type">
              <input
                type="text"
                value={newEdge.edge_type}
                onChange={(e) => setNewEdge({ ...newEdge, edge_type: e.target.value })}
                placeholder="unlocks"
                className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground"
              />
            </Field>
            {edgeError && (
              <p className="text-xs text-red-400 uppercase tracking-widest">{edgeError}</p>
            )}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleAddEdge}
                disabled={!newEdge.parent_skill_id || !newEdge.child_skill_id}
                className="flex-1 bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
              >
                Add Connection
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAddEdge(false)}
                className="border-border text-foreground hover:bg-secondary uppercase tracking-widest text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Remove Edge Modal */}
      {showRemoveEdge && (
        <RemoveEdgeModal
          edges={edges}
          skills={skills}
          onDelete={handleDeleteEdge}
          onClose={() => setShowRemoveEdge(false)}
        />
      )}

      {/* Edit Skill Modal */}
      {editingSkill && (
        <Modal onClose={() => setEditingSkill(null)} className="max-w-xl min-h-[75vh] max-h-[90vh] overflow-y-auto">
          <h3 className="font-serif text-lg text-foreground mb-4">Edit Skill</h3>
          <div className="space-y-4">
            <Field label="Name">
              <input
                type="text"
                value={editingSkill.name}
                onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2"
                autoFocus
              />
            </Field>
            <Field label="Skill Text">
              <textarea
                value={editingSkill.skill_text || ""}
                onChange={(e) => setEditingSkill({ ...editingSkill, skill_text: e.target.value })}
                rows={2}
                placeholder="Description shown to the player..."
                className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 resize-none placeholder:text-muted-foreground"
              />
            </Field>
            <Field label="Unlock Hint">
              <textarea
                value={editingSkill.unlock_hint || ""}
                onChange={(e) => setEditingSkill({ ...editingSkill, unlock_hint: e.target.value })}
                rows={2}
                className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 resize-none"
              />
            </Field>
            <Field label="Unlock Key">
              <input
                type="text"
                value={editingSkill.unlock_key || ""}
                onChange={(e) => setEditingSkill({ ...editingSkill, unlock_key: e.target.value })}
                className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2"
              />
            </Field>
            <div className="flex gap-4">
              <Field label="Max Rank">
                <input
                  type="number"
                  min={1}
                  value={editingSkill.max_rank ?? 0}
                  onChange={(e) => setEditingSkill({ ...editingSkill, max_rank: parseInt(e.target.value) || 1 })}
                  className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2"
                />
              </Field>
              <Field label="Min Level">
                <input
                  type="number"
                  min={0}
                  value={editingSkill.min_level ?? 0}
                  onChange={(e) => setEditingSkill({ ...editingSkill, min_level: parseInt(e.target.value) || 0 })}
                  className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2"
                />
              </Field>
              <Field label="Passive">
                <div className="flex items-center h-9.5">
                  <input
                    type="checkbox"
                    checked={editingSkill.is_passive ?? false}
                    onChange={(e) => setEditingSkill({ ...editingSkill, is_passive: e.target.checked })}
                    className="w-4 h-4 accent-cyan-500"
                  />
                </div>
              </Field>
              <Field label="In Dev">
                <div className="flex items-center h-9.5">
                  <input
                    type="checkbox"
                    checked={editingSkill.in_development ?? false}
                    onChange={(e) => setEditingSkill({ ...editingSkill, in_development: e.target.checked })}
                    className="w-4 h-4 accent-orange-500"
                  />
                </div>
              </Field>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Effects (JSON)</label>
                <a
                  href="/Skill-Effects-Reference.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs uppercase tracking-widest text-cyan-400 hover:text-cyan-300 border border-cyan-800 hover:border-cyan-500 px-2 py-0.5 transition-colors"
                >
                  Reference
                </a>
              </div>
              <textarea
                value={editingEffectsJson}
                onChange={(e) => { setEditingEffectsJson(e.target.value); setEffectsJsonError(null) }}
                rows={10}
                spellCheck={false}
                className={`w-full bg-secondary border text-foreground text-xs px-3 py-2 font-mono resize-y ${effectsJsonError ? "border-red-500" : "border-border"}`}
              />
              {effectsJsonError && (
                <p className="text-xs text-red-400 mt-1 uppercase tracking-widest">{effectsJsonError}</p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleUpdateSkill}
                disabled={!editingSkill.name.trim()}
                className="flex-1 bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
              >
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditingSkill(null)}
                className="border-border text-foreground hover:bg-secondary uppercase tracking-widest text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// Remove Edge Modal Component
function RemoveEdgeModal({
  edges,
  skills,
  onDelete,
  onClose,
}: {
  edges: SkillEdge[]
  skills: Skill[]
  onDelete: (parentId: string, childId: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const q = query.toLowerCase()

  const filtered = edges.filter(edge => {
    if (!q) return true
    const parent = skills.find(s => s.id === edge.parent_skill_id)
    const child = skills.find(s => s.id === edge.child_skill_id)
    return (
      parent?.name.toLowerCase().includes(q) ||
      child?.name.toLowerCase().includes(q) ||
      edge.edge_type?.toLowerCase().includes(q)
    )
  })

  return (
    <Modal onClose={onClose}>
      <h3 className="font-serif text-lg text-foreground mb-4">Remove Connection</h3>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by skill name or type..."
        autoFocus
        className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground mb-3"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground italic font-serif">
          {edges.length === 0 ? "No connections exist." : "No matches."}
        </p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {filtered.map(edge => {
            const parent = skills.find(s => s.id === edge.parent_skill_id)
            const child = skills.find(s => s.id === edge.child_skill_id)
            if (!parent || !child) return null
            return (
              <div key={edge.id} className="flex items-center justify-between border border-border bg-secondary/30 px-3 py-2">
                <span className="text-sm font-serif text-foreground">
                  {parent.name}
                  <span className="text-muted-foreground text-xs mx-2">→</span>
                  {child.name}
                  {edge.edge_type && (
                    <span className="text-xs text-muted-foreground ml-2">[{edge.edge_type}]</span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(parent.id, child.id)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400 shrink-0"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )
          })}
        </div>
      )}
      <div className="mt-4">
        <Button
          variant="outline"
          onClick={onClose}
          className="border-border text-foreground hover:bg-secondary uppercase tracking-widest text-xs"
        >
          Done
        </Button>
      </div>
    </Modal>
  )
}

// Tree View Component
function TreeView({
  skills,
  edges,
  currentSkill,
  rootSkills,
  parents,
  children,
  navigateTo,
  getEdgeType,
  onDeleteSkill,
  onDeleteEdge,
  onEditSkill,
}: {
  skills: Skill[]
  edges: SkillEdge[]
  currentSkill: Skill | null
  rootSkills: Skill[]
  parents: Skill[]
  children: Skill[]
  navigateTo: (skill: Skill) => void
  getEdgeType: (parentId: string, childId: string) => string
  onDeleteSkill: (id: string) => void
  onDeleteEdge: (parentId: string, childId: string) => void
  onEditSkill: (skill: Skill) => void
}) {
  if (skills.length === 0) {
    return (
      <div className="border border-border bg-card p-12 flex flex-col items-center justify-center min-h-100">
        <p className="text-muted-foreground text-sm italic font-serif text-center mb-4">
          No skills have been created yet.
        </p>
        <p className="text-muted-foreground text-xs">
          Click &quot;+ Skill&quot; above to create your first skill.
        </p>
      </div>
    )
  }

  return (
    <div className="border border-border bg-card">
      {/* Navigation Bar */}
      <div className="border-b border-border p-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Root:</span>
          <select
            value={rootSkills.find(r => r.id === currentSkill?.id)?.id || ""}
            onChange={(e) => {
              const root = rootSkills.find(r => r.id === e.target.value)
              if (root) navigateTo(root)
            }}
            className="bg-secondary border border-border text-foreground text-sm px-2 py-1"
          >
            {rootSkills.length === 0 && <option value="">No root skills</option>}
            {rootSkills.map(root => (
              <option key={root.id} value={root.id}>{root.name}</option>
            ))}
          </select>
        </div>
        
        <div className="h-4 w-px bg-border" />
        
        <span className="text-xs text-muted-foreground">
          Click a parent or child to navigate
        </span>
      </div>

      {/* Tree Visualization */}
      <div className="p-8 space-y-8">
        {/* Parents Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ChevronUp className="w-4 h-4" />
            <span className="text-xs uppercase tracking-[0.2em]">Parents ({parents.length})</span>
          </div>
          {parents.length === 0 ? (
            <p className="text-sm text-muted-foreground italic font-serif pl-6">
              This is a root skill
            </p>
          ) : (
            <div className="flex flex-wrap gap-3 pl-6">
              {parents.map(parent => (
                <div key={parent.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => navigateTo(parent)}
                    className="border border-border bg-secondary/50 px-4 py-2 text-sm font-serif text-foreground hover:bg-secondary hover:border-foreground/30 transition-colors"
                  >
                    {parent.name}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteEdge(parent.id, currentSkill!.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connecting Line */}
        {parents.length > 0 && (
          <div className="flex justify-center">
            <div className="w-px h-8 bg-border" />
          </div>
        )}

        {/* Current Skill */}
        {currentSkill && (
          <div className="flex justify-center">
            <div className="border-2 border-foreground bg-card px-8 py-6 text-center min-w-70 max-w-md relative group">
              <h3 className="font-serif text-2xl text-foreground mb-1">
                {currentSkill.name}
              </h3>
              <div className="flex justify-center gap-3 mb-2">
                {currentSkill.is_passive && (
                  <span className="text-[10px] uppercase tracking-widest text-cyan-400/70 border border-cyan-400/30 px-2 py-0.5">Passive</span>
                )}
                {currentSkill.max_rank != null && currentSkill.max_rank > 1 && (
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border px-2 py-0.5">Rank {currentSkill.max_rank}</span>
                )}
              </div>
              {currentSkill.skill_text && (
                <p className="text-sm text-muted-foreground italic mb-2">
                  {currentSkill.skill_text}
                </p>
              )}
              {currentSkill.unlock_hint && (
                <p className="text-sm text-muted-foreground italic mb-2">
                  &quot;{currentSkill.unlock_hint}&quot;
                </p>
              )}
              {currentSkill.unlock_key && (
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                  Key: {currentSkill.unlock_key}
                </p>
              )}
              {Array.isArray(currentSkill.effects) && currentSkill.effects.length > 0 && (
                <p className="text-xs text-cyan-400/50 uppercase tracking-widest mt-2">
                  {currentSkill.effects.length} effect{currentSkill.effects.length !== 1 ? "s" : ""}
                </p>
              )}
              
              {/* Edit/Delete buttons */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditSkill(currentSkill)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteSkill(currentSkill.id)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Connecting Line */}
        {children.length > 0 && (
          <div className="flex justify-center">
            <div className="w-px h-8 bg-border" />
          </div>
        )}

        {/* Children Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ChevronDown className="w-4 h-4" />
            <span className="text-xs uppercase tracking-[0.2em]">Children ({children.length})</span>
          </div>
          
          {children.length === 0 ? (
            <p className="text-sm text-muted-foreground italic font-serif pl-6">
              No skills branch from here
            </p>
          ) : (
            <div className="flex flex-wrap gap-3 pl-6">
              {children.map(child => (
                <div key={child.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => navigateTo(child)}
                    className="border border-border bg-secondary/50 px-4 py-2 text-sm font-serif text-foreground hover:bg-secondary hover:border-foreground/30 transition-colors"
                  >
                    <span className="text-xs text-muted-foreground mr-2">
                      [{getEdgeType(currentSkill!.id, child.id)}]
                    </span>
                    {child.name}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteEdge(currentSkill!.id, child.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// List View Component
function ListView({
  skills,
  edges,
  getParents,
  getChildren,
  onDeleteSkill,
  onBatchDelete,
  onEditSkill,
  onNavigate,
}: {
  skills: Skill[]
  edges: SkillEdge[]
  getParents: (id: string) => Skill[]
  getChildren: (id: string) => Skill[]
  onDeleteSkill: (id: string) => void
  onBatchDelete: (ids: string[]) => void
  onEditSkill: (skill: Skill) => void
  onNavigate: (skill: Skill) => void
}) {
  const [sortBy, setSortBy] = useState<"name" | "parents">("name")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  if (skills.length === 0) {
    return (
      <div className="border border-border bg-card p-12 flex flex-col items-center justify-center min-h-100">
        <p className="text-muted-foreground text-sm italic font-serif text-center mb-4">
          No skills have been created yet.
        </p>
      </div>
    )
  }

  const sortedSkills = sortBy === "name"
    ? skills
    : [...skills].sort((a, b) => {
        const aParents = getParents(a.id)
        const bParents = getParents(b.id)
        if (aParents.length === 0 && bParents.length === 0) return a.name.localeCompare(b.name)
        if (aParents.length === 0) return -1
        if (bParents.length === 0) return 1
        return aParents[0].name.localeCompare(bParents[0].name) || a.name.localeCompare(b.name)
      })

  const allSelected = selectedIds.size === skills.length
  const someSelected = selectedIds.size > 0

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(skills.map(s => s.id)))
  }

  return (
    <div className="space-y-2">
      {someSelected && (
        <div className="border border-border bg-card px-4 py-2 flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {selectedIds.size} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onBatchDelete(Array.from(selectedIds))
              setSelectedIds(new Set())
            }}
            className="text-xs uppercase tracking-widest text-red-400 hover:text-red-300 hover:bg-red-400/10"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Delete Selected
          </Button>
        </div>
      )}

      <div className="border border-border bg-card">
        {/* Table Header */}
        <div className="border-b border-border px-4 py-3 grid grid-cols-12 gap-4 text-xs uppercase tracking-widest text-muted-foreground">
          <div className="col-span-1 flex items-center">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="w-3.5 h-3.5 accent-cyan-500"
            />
          </div>
          <div className="col-span-2">Name</div>
          <div className="col-span-3">Unlock Hint</div>
          <div className="col-span-1">FX</div>
          <div className="col-span-2">
            <button
              onClick={() => setSortBy(s => s === "parents" ? "name" : "parents")}
              className={`flex items-center gap-1 hover:text-foreground transition-colors ${sortBy === "parents" ? "text-foreground" : ""}`}
            >
              Parents
              {sortBy === "parents"
                ? <ChevronUp className="w-3 h-3" />
                : <ChevronDown className="w-3 h-3 opacity-30" />
              }
            </button>
          </div>
          <div className="col-span-2">Children</div>
          <div className="col-span-1">Actions</div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-border">
          {sortedSkills.map(skill => {
            const parents = getParents(skill.id)
            const children = getChildren(skill.id)
            const isSelected = selectedIds.has(skill.id)

            return (
              <div
                key={skill.id}
                className={`px-4 py-3 grid grid-cols-12 gap-4 items-center hover:bg-secondary/30 transition-colors group ${isSelected ? "bg-secondary/20" : ""}`}
              >
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(skill.id)}
                    className="w-3.5 h-3.5 accent-cyan-500"
                  />
                </div>
                <div className="col-span-2">
                  <button
                    onClick={() => onNavigate(skill)}
                    className="font-serif text-foreground hover:underline text-left"
                  >
                    {skill.name}
                  </button>
                </div>
                <div className="col-span-3 text-sm text-muted-foreground truncate">
                  {skill.unlock_hint || "—"}
                </div>
                <div className="col-span-1 text-xs text-muted-foreground">
                  {Array.isArray(skill.effects) && skill.effects.length > 0
                    ? <span className="text-cyan-400/60">{skill.effects.length}</span>
                    : "—"
                  }
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {parents.length === 0
                    ? <span className="italic">Root</span>
                    : parents.map(p => p.name).join(", ")
                  }
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {children.length === 0
                    ? <span className="italic">Leaf</span>
                    : children.map(c => c.name).join(", ")
                  }
                </div>
                <div className="col-span-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditSkill(skill)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteSkill(skill.id)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Reusable Modal Component
function Modal({ children, onClose, className }: { children: React.ReactNode; onClose: () => void; className?: string }) {
  return (
    <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
      <div className={`border border-border bg-card p-6 w-full max-w-md relative ${className ?? ""}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-2 right-2 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </Button>
        {children}
      </div>
    </div>
  )
}

// Reusable Field Component
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">
        {label}
      </label>
      {children}
    </div>
  )
}
