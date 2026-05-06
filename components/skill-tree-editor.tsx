"use client"

import { useState, useEffect } from "react"
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

interface Skill {
  id: string
  name: string
  unlock_hint?: string
  unlock_key?: string
}

interface SkillEdge {
  id: string
  parent_skill_id: string
  child_skill_id: string
  edge_type?: string
}

type ViewMode = "tree" | "list"

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
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  
  // Form states
  const [newSkill, setNewSkill] = useState({ name: "", unlock_hint: "", unlock_key: "" })
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

      if (!currentSkill && roots.length > 0) {
        setCurrentSkill(roots[0])
      } else if (!currentSkill && skillsRes.data.length > 0) {
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
    
    const supabase = createClient()
    const { data, error } = await supabase
      .from("skills")
      .insert({ 
        name: newSkill.name, 
        unlock_hint: newSkill.unlock_hint || null,
        unlock_key: newSkill.unlock_key || null 
      })
      .select()
      .single()

    if (!error && data) {
      setNewSkill({ name: "", unlock_hint: "", unlock_key: "" })
      setShowAddSkill(false)
      fetchData()
    }
  }

  const handleUpdateSkill = async () => {
    if (!editingSkill || !editingSkill.name.trim()) return
    
    const supabase = createClient()
    const { error } = await supabase
      .from("skills")
      .update({ 
        name: editingSkill.name, 
        unlock_hint: editingSkill.unlock_hint || null,
        unlock_key: editingSkill.unlock_key || null 
      })
      .eq("id", editingSkill.id)

    if (!error) {
      setEditingSkill(null)
      fetchData()
    }
  }

  const handleAddEdge = async () => {
    if (!newEdge.parent_skill_id || !newEdge.child_skill_id) return
    if (newEdge.parent_skill_id === newEdge.child_skill_id) return
    
    const supabase = createClient()
    const { error } = await supabase
      .from("skill_edges")
      .insert({
        parent_skill_id: newEdge.parent_skill_id,
        child_skill_id: newEdge.child_skill_id,
        edge_type: newEdge.edge_type || "unlocks"
      })

    if (!error) {
      setNewEdge({ parent_skill_id: "", child_skill_id: "", edge_type: "unlocks" })
      setShowAddEdge(false)
      fetchData()
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

  const handleDeleteEdge = async (parentId: string, childId: string) => {
    const supabase = createClient()
    await supabase
      .from("skill_edges")
      .delete()
      .eq("parent_skill_id", parentId)
      .eq("child_skill_id", childId)
    
    fetchData()
  }

  if (loading) {
    return (
      <div className="border border-border bg-card p-8 flex items-center justify-center min-h-[500px]">
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
          onEditSkill={setEditingSkill}
        />
      ) : (
        <ListView
          skills={skills}
          edges={edges}
          getParents={getParents}
          getChildren={getChildren}
          onDeleteSkill={handleDeleteSkill}
          onEditSkill={setEditingSkill}
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

      {/* Edit Skill Modal */}
      {editingSkill && (
        <Modal onClose={() => setEditingSkill(null)}>
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
      <div className="border border-border bg-card p-12 flex flex-col items-center justify-center min-h-[400px]">
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
            <div className="border-2 border-foreground bg-card px-8 py-6 text-center min-w-[280px] max-w-md relative group">
              <h3 className="font-serif text-2xl text-foreground mb-2">
                {currentSkill.name}
              </h3>
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
  onEditSkill,
  onNavigate,
}: {
  skills: Skill[]
  edges: SkillEdge[]
  getParents: (id: string) => Skill[]
  getChildren: (id: string) => Skill[]
  onDeleteSkill: (id: string) => void
  onEditSkill: (skill: Skill) => void
  onNavigate: (skill: Skill) => void
}) {
  if (skills.length === 0) {
    return (
      <div className="border border-border bg-card p-12 flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground text-sm italic font-serif text-center mb-4">
          No skills have been created yet.
        </p>
      </div>
    )
  }

  return (
    <div className="border border-border bg-card">
      {/* Table Header */}
      <div className="border-b border-border px-4 py-3 grid grid-cols-12 gap-4 text-xs uppercase tracking-widest text-muted-foreground">
        <div className="col-span-3">Name</div>
        <div className="col-span-3">Unlock Hint</div>
        <div className="col-span-1">Key</div>
        <div className="col-span-2">Parents</div>
        <div className="col-span-2">Children</div>
        <div className="col-span-1">Actions</div>
      </div>
      
      {/* Table Body */}
      <div className="divide-y divide-border">
        {skills.map(skill => {
          const parents = getParents(skill.id)
          const children = getChildren(skill.id)
          
          return (
            <div 
              key={skill.id} 
              className="px-4 py-3 grid grid-cols-12 gap-4 items-center hover:bg-secondary/30 transition-colors group"
            >
              <div className="col-span-3">
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
              <div className="col-span-1 text-xs text-muted-foreground uppercase">
                {skill.unlock_key || "—"}
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
  )
}

// Reusable Modal Component
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
      <div className="border border-border bg-card p-6 w-full max-w-md relative">
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
