"use client"

import { useState, useEffect } from "react"
import { useSkillTree, type Skill, type SkillEdge } from "@/features/skills/hooks/use-skill-tree"
import { EffectEditorModal } from "@/components/effect-editor-modal"
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
  Check,
  Wand2,
} from "lucide-react"
import type { Effect } from "@/lib/effect-engine"

type ViewMode = "tree" | "list"

export function SkillTreeEditor() {
  const { skills, edges, loading, addSkill, updateSkill, deleteSkill, addEdge, deleteEdge, batchSetDev, batchDelete } = useSkillTree()
  const [currentSkill, setCurrentSkill] = useState<Skill | null>(null)
  const [rootSkills, setRootSkills] = useState<Skill[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("tree")

  useEffect(() => {
    if (skills.length === 0 && !loading) return
    const childIds = new Set(edges.map((e) => e.child_skill_id))
    const roots = skills.filter((s) => !childIds.has(s.id))
    setRootSkills(roots)
    setCurrentSkill((prev) => {
      if (prev) {
        const updated = skills.find((s) => s.id === prev.id)
        return updated ?? (roots[0] ?? skills[0] ?? null)
      }
      return roots[0] ?? skills[0] ?? null
    })
  }, [skills, edges, loading])

  // Modal visibility
  const [showAddSkill, setShowAddSkill] = useState(false)
  const [showAddEdge, setShowAddEdge] = useState(false)
  const [showRemoveEdge, setShowRemoveEdge] = useState(false)
  const [edgeError, setEdgeError] = useState<string | null>(null)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)

  // Effect editor modal — shared for both add and edit flows
  const [effectEditorOpen, setEffectEditorOpen] = useState(false)
  const [effectEditorTarget, setEffectEditorTarget] = useState<"new" | "edit">("new")

  // New skill form
  const [newSkill, setNewSkill] = useState({
    name: "",
    skill_text: "",
    unlock_hint: "",
    unlock_key: "",
    is_passive: false,
    in_development: false,
    max_rank: 1,
    min_level: 0,
    effects: [] as Effect[],
    edge_parent_id: "",
    edge_child_id: "",
  })

  // Edge form
  const [newEdge, setNewEdge] = useState({ parent_skill_id: "", child_skill_id: "", edge_type: "unlocks" })

  const getParents = (skillId: string): Skill[] => {
    const parentIds = edges.filter((e) => e.child_skill_id === skillId).map((e) => e.parent_skill_id)
    return skills.filter((s) => parentIds.includes(s.id))
  }

  const getChildren = (skillId: string): Skill[] => {
    const childIds = edges.filter((e) => e.parent_skill_id === skillId).map((e) => e.child_skill_id)
    return skills.filter((s) => childIds.includes(s.id))
  }

  const getEdgeType = (parentId: string, childId: string): string => {
    const edge = edges.find((e) => e.parent_skill_id === parentId && e.child_skill_id === childId)
    return edge?.edge_type || "unlocks"
  }

  const navigateTo = (skill: Skill) => setCurrentSkill(skill)

  const handleAddSkill = async () => {
    if (!newSkill.name.trim()) return
    const { success } = await addSkill(
      {
        name: newSkill.name,
        skill_text: newSkill.skill_text || null,
        unlock_hint: newSkill.unlock_hint || null,
        unlock_key: newSkill.unlock_key || null,
        is_passive: newSkill.is_passive || null,
        in_development: newSkill.in_development,
        max_rank: newSkill.max_rank || null,
        min_level: newSkill.min_level ?? 0,
        effects: newSkill.effects.length > 0 ? newSkill.effects : null,
      },
      newSkill.edge_parent_id || undefined,
      newSkill.edge_child_id || undefined
    )
    if (success) {
      setNewSkill({ name: "", skill_text: "", unlock_hint: "", unlock_key: "", is_passive: false, in_development: false, max_rank: 1, min_level: 0, effects: [], edge_parent_id: "", edge_child_id: "" })
      setShowAddSkill(false)
    }
  }

  const handleUpdateSkill = async () => {
    if (!editingSkill || !editingSkill.name.trim()) return
    const ok = await updateSkill(editingSkill.id, {
      name: editingSkill.name,
      skill_text: editingSkill.skill_text || null,
      unlock_hint: editingSkill.unlock_hint || null,
      unlock_key: editingSkill.unlock_key || null,
      is_passive: editingSkill.is_passive ?? null,
      in_development: editingSkill.in_development ?? false,
      max_rank: editingSkill.max_rank ?? null,
      min_level: editingSkill.min_level ?? 0,
      effects: editingSkill.effects.length > 0 ? editingSkill.effects : null,
    })
    if (ok) setEditingSkill(null)
  }

  const handleOpenEditSkill = (skill: Skill) => {
    setEditingSkill(skill)
  }

  const handleAddEdge = async () => {
    if (!newEdge.parent_skill_id || !newEdge.child_skill_id) return
    if (newEdge.parent_skill_id === newEdge.child_skill_id) return
    setEdgeError(null)
    const result = await addEdge(newEdge.parent_skill_id, newEdge.child_skill_id, newEdge.edge_type)
    if (result.success) {
      setNewEdge({ parent_skill_id: "", child_skill_id: "", edge_type: "unlocks" })
      setShowAddEdge(false)
    } else {
      setEdgeError(result.error ?? "Failed to add connection.")
    }
  }

  const handleDeleteSkill = async (skillId: string) => {
    if (!confirm("Delete this skill and all its connections?")) return
    if (currentSkill?.id === skillId) setCurrentSkill(null)
    await deleteSkill(skillId)
  }

  const handleDeleteEdge = async (parentId: string, childId: string) => {
    const ok = await deleteEdge(parentId, childId)
    if (!ok) console.error("Delete edge failed")
  }

  const openEffectEditor = (target: "new" | "edit") => {
    setEffectEditorTarget(target)
    setEffectEditorOpen(true)
  }

  const handleEffectEditorSave = (saved: Effect[]) => {
    if (effectEditorTarget === "new") {
      setNewSkill((prev) => ({ ...prev, effects: saved }))
    } else if (editingSkill) {
      setEditingSkill((prev) => (prev ? { ...prev, effects: saved } : prev))
    }
  }

  const effectsForEditor =
    effectEditorTarget === "new" ? newSkill.effects : (editingSkill?.effects ?? [])

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
          onBatchDelete={async (ids) => {
            if (!confirm(`Delete ${ids.length} skill${ids.length > 1 ? "s" : ""} and all their connections?`)) return
            if (currentSkill && ids.includes(currentSkill.id)) setCurrentSkill(null)
            await batchDelete(ids)
          }}
          onBatchSetDev={async (ids, inDev) => { await batchSetDev(ids, inDev) }}
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
            <Field label="Effects">
              <Button
                variant="outline"
                onClick={() => openEffectEditor("new")}
                className="w-full border-cyan-800 text-cyan-400 hover:border-cyan-500 hover:text-cyan-300 uppercase tracking-widest text-xs justify-start gap-2"
              >
                <Wand2 className="w-4 h-4" />
                {newSkill.effects.length > 0
                  ? `${newSkill.effects.length} effect${newSkill.effects.length !== 1 ? "s" : ""} configured`
                  : "Open Effect Editor"}
              </Button>
            </Field>
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Connect (optional)</p>
              <Field label="Parent Skill">
                <select
                  value={newSkill.edge_parent_id}
                  onChange={(e) => setNewSkill({ ...newSkill, edge_parent_id: e.target.value })}
                  className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2"
                >
                  <option value="">None</option>
                  {skills.map((s) => (
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
                  {skills.map((s) => (
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
                {skills.map((s) => (
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
                {skills.filter((s) => s.id !== newEdge.parent_skill_id).map((s) => (
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
            <Field label="Effects">
              <Button
                variant="outline"
                onClick={() => openEffectEditor("edit")}
                className="w-full border-cyan-800 text-cyan-400 hover:border-cyan-500 hover:text-cyan-300 uppercase tracking-widest text-xs justify-start gap-2"
              >
                <Wand2 className="w-4 h-4" />
                {Array.isArray(editingSkill.effects) && editingSkill.effects.length > 0
                  ? `${editingSkill.effects.length} effect${editingSkill.effects.length !== 1 ? "s" : ""} configured`
                  : "Open Effect Editor"}
              </Button>
            </Field>
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

      {/* Effect Editor Modal (global, sits above all other modals) */}
      <EffectEditorModal
        isOpen={effectEditorOpen}
        effects={effectsForEditor}
        onSave={handleEffectEditorSave}
        onClose={() => setEffectEditorOpen(false)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Remove Edge Modal
// ---------------------------------------------------------------------------

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

  const filtered = edges.filter((edge) => {
    if (!q) return true
    const parent = skills.find((s) => s.id === edge.parent_skill_id)
    const child = skills.find((s) => s.id === edge.child_skill_id)
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
          {filtered.map((edge) => {
            const parent = skills.find((s) => s.id === edge.parent_skill_id)
            const child = skills.find((s) => s.id === edge.child_skill_id)
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

// ---------------------------------------------------------------------------
// Tree View
// ---------------------------------------------------------------------------

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
            value={rootSkills.find((r) => r.id === currentSkill?.id)?.id || ""}
            onChange={(e) => {
              const root = rootSkills.find((r) => r.id === e.target.value)
              if (root) navigateTo(root)
            }}
            className="bg-secondary border border-border text-foreground text-sm px-2 py-1"
          >
            {rootSkills.length === 0 && <option value="">No root skills</option>}
            {rootSkills.map((root) => (
              <option key={root.id} value={root.id}>{root.name}</option>
            ))}
          </select>
        </div>
        <div className="h-4 w-px bg-border" />
        <span className="text-xs text-muted-foreground">Click a parent or child to navigate</span>
      </div>

      {/* Tree Visualization */}
      <div className="p-8 space-y-8">
        {/* Parents */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ChevronUp className="w-4 h-4" />
            <span className="text-xs uppercase tracking-[0.2em]">Parents ({parents.length})</span>
          </div>
          {parents.length === 0 ? (
            <p className="text-sm text-muted-foreground italic font-serif pl-6">This is a root skill</p>
          ) : (
            <div className="flex flex-wrap gap-3 pl-6">
              {parents.map((parent) => (
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

        {parents.length > 0 && (
          <div className="flex justify-center">
            <div className="w-px h-8 bg-border" />
          </div>
        )}

        {/* Current Skill */}
        {currentSkill && (
          <div className="flex justify-center">
            <div className="border-2 border-foreground bg-card px-8 py-6 text-center min-w-70 max-w-md relative group">
              <h3 className="font-serif text-2xl text-foreground mb-1">{currentSkill.name}</h3>
              <div className="flex justify-center gap-3 mb-2">
                {currentSkill.is_passive && (
                  <span className="text-[10px] uppercase tracking-widest text-cyan-400/70 border border-cyan-400/30 px-2 py-0.5">
                    Passive
                  </span>
                )}
                {currentSkill.max_rank != null && currentSkill.max_rank > 1 && (
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border px-2 py-0.5">
                    Rank {currentSkill.max_rank}
                  </span>
                )}
              </div>
              {currentSkill.skill_text && (
                <p className="text-sm text-muted-foreground italic mb-2">{currentSkill.skill_text}</p>
              )}
              {currentSkill.unlock_hint && (
                <p className="text-sm text-muted-foreground italic mb-2">&quot;{currentSkill.unlock_hint}&quot;</p>
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

        {children.length > 0 && (
          <div className="flex justify-center">
            <div className="w-px h-8 bg-border" />
          </div>
        )}

        {/* Children */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ChevronDown className="w-4 h-4" />
            <span className="text-xs uppercase tracking-[0.2em]">Children ({children.length})</span>
          </div>
          {children.length === 0 ? (
            <p className="text-sm text-muted-foreground italic font-serif pl-6">No skills branch from here</p>
          ) : (
            <div className="flex flex-wrap gap-3 pl-6">
              {children.map((child) => (
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

// ---------------------------------------------------------------------------
// List View
// ---------------------------------------------------------------------------

function ListView({
  skills,
  edges,
  getParents,
  getChildren,
  onDeleteSkill,
  onBatchDelete,
  onBatchSetDev,
  onEditSkill,
  onNavigate,
}: {
  skills: Skill[]
  edges: SkillEdge[]
  getParents: (id: string) => Skill[]
  getChildren: (id: string) => Skill[]
  onDeleteSkill: (id: string) => void
  onBatchDelete: (ids: string[]) => void
  onBatchSetDev: (ids: string[], inDev: boolean) => void
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

  const sortedSkills =
    sortBy === "name"
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
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-2">
      {someSelected && (
        <div className="border border-border bg-card px-4 py-2 flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { onBatchSetDev(Array.from(selectedIds), false); setSelectedIds(new Set()) }}
              className="text-xs uppercase tracking-widest text-green-400 hover:text-green-300 hover:bg-green-400/10"
            >
              <Check className="w-3 h-3 mr-1" />
              Deploy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { onBatchSetDev(Array.from(selectedIds), true); setSelectedIds(new Set()) }}
              className="text-xs uppercase tracking-widest text-orange-400 hover:text-orange-300 hover:bg-orange-400/10"
            >
              Shelve
            </Button>
            <div className="w-px h-4 bg-border" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { onBatchDelete(Array.from(selectedIds)); setSelectedIds(new Set()) }}
              className="text-xs uppercase tracking-widest text-red-400 hover:text-red-300 hover:bg-red-400/10"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      )}

      <div className="border border-border bg-card">
        <div className="border-b border-border px-4 py-3 grid grid-cols-12 gap-4 text-xs uppercase tracking-widest text-muted-foreground">
          <div className="col-span-1 flex items-center">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelectedIds(allSelected ? new Set() : new Set(skills.map((s) => s.id)))}
              className="w-3.5 h-3.5 accent-cyan-500"
            />
          </div>
          <div className="col-span-2">Name</div>
          <div className="col-span-3">Unlock Hint</div>
          <div className="col-span-1">FX</div>
          <div className="col-span-2">
            <button
              onClick={() => setSortBy((s) => (s === "parents" ? "name" : "parents"))}
              className={`flex items-center gap-1 hover:text-foreground transition-colors ${sortBy === "parents" ? "text-foreground" : ""}`}
            >
              Parents
              {sortBy === "parents" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3 opacity-30" />}
            </button>
          </div>
          <div className="col-span-2">Children</div>
          <div className="col-span-1">Actions</div>
        </div>

        <div className="divide-y divide-border">
          {sortedSkills.map((skill) => {
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
                <div className="col-span-2 flex items-center gap-1.5">
                  <button
                    onClick={() => onNavigate(skill)}
                    className="font-serif text-foreground hover:underline text-left"
                  >
                    {skill.name}
                  </button>
                  {skill.in_development && (
                    <span className="text-[9px] uppercase tracking-widest text-orange-400/70 border border-orange-400/30 px-1 py-0.5 shrink-0">
                      Dev
                    </span>
                  )}
                </div>
                <div className="col-span-3 text-sm text-muted-foreground truncate">
                  {skill.unlock_hint || "—"}
                </div>
                <div className="col-span-1 text-xs text-muted-foreground">
                  {Array.isArray(skill.effects) && skill.effects.length > 0 ? (
                    <span className="text-cyan-400/60">{skill.effects.length}</span>
                  ) : (
                    "—"
                  )}
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {parents.length === 0 ? <span className="italic">Root</span> : parents.map((p) => p.name).join(", ")}
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {children.length === 0 ? <span className="italic">Leaf</span> : children.map((c) => c.name).join(", ")}
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

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function Modal({
  children,
  onClose,
  className,
}: {
  children: React.ReactNode
  onClose: () => void
  className?: string
}) {
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
