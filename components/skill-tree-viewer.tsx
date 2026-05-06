"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown, Plus, Home, Pencil, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface Skill {
  id: string
  name: string
  unlock_hint?: string
  unlock_key?: string
  skill_text?: string
  
}

interface SkillEdge {
  id: string
  parent_skill_id: string
  child_skill_id: string
  edge_type?: string
}

interface SkillTreeViewerProps {
  isDev?: boolean
  initialSkillId?: string
}

export function SkillTreeViewer({ isDev = false, initialSkillId }: SkillTreeViewerProps) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [edges, setEdges] = useState<SkillEdge[]>([])
  const [currentSkill, setCurrentSkill] = useState<Skill | null>(null)
  const [rootSkills, setRootSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddSkill, setShowAddSkill] = useState(false)
  const [showAddEdge, setShowAddEdge] = useState(false)
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

    // Find root skills (skills that are never a child)
    if (skillsRes.data && edgesRes.data) {
      const childIds = new Set(edgesRes.data.map(e => e.child_skill_id))
      const roots = skillsRes.data.filter(s => !childIds.has(s.id))
      setRootSkills(roots)

      // Set initial skill
      if (initialSkillId) {
        const initial = skillsRes.data.find(s => s.id === initialSkillId)
        if (initial) setCurrentSkill(initial)
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

  const goToRoot = () => {
    if (rootSkills.length > 0) {
      setCurrentSkill(rootSkills[0])
    }
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
      setSkills(prev => [...prev, data])
      if (!currentSkill) setCurrentSkill(data)
      setNewSkill({ name: "", unlock_hint: "", unlock_key: "" })
      setShowAddSkill(false)
      fetchData()
    }
  }

  const handleAddEdge = async () => {
    if (!newEdge.parent_skill_id || !newEdge.child_skill_id) return
    
    const supabase = createClient()
    const { error } = await supabase
      .from("skill_edges")
      .insert({
        parent_skill_id: newEdge.parent_skill_id,
        child_skill_id: newEdge.child_skill_id,
        edge_type: newEdge.edge_type
      })

    if (!error) {
      setNewEdge({ parent_skill_id: "", child_skill_id: "", edge_type: "unlocks" })
      setShowAddEdge(false)
      fetchData()
    }
  }

  const handleDeleteSkill = async (skillId: string) => {
    const supabase = createClient()
    
    // Delete edges first
    await supabase.from("skill_edges").delete().or(`parent_skill_id.eq.${skillId},child_skill_id.eq.${skillId}`)
    
    // Delete skill
    await supabase.from("skills").delete().eq("id", skillId)
    
    fetchData()
    if (currentSkill?.id === skillId) {
      setCurrentSkill(rootSkills[0] || skills.find(s => s.id !== skillId) || null)
    }
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
      <div className="border border-border bg-card p-8 flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground text-sm italic font-serif">Loading skill tree...</p>
      </div>
    )
  }

  if (skills.length === 0) {
    return (
      <div className="border border-border bg-card p-8 min-h-[400px]">
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-muted-foreground text-sm italic font-serif text-center">
            No skills have been created yet.
          </p>
          {isDev && (
            <Button
              onClick={() => setShowAddSkill(true)}
              className="bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add First Skill
            </Button>
          )}
        </div>
        
        {isDev && showAddSkill && (
          <AddSkillForm 
            newSkill={newSkill}
            setNewSkill={setNewSkill}
            onAdd={handleAddSkill}
            onCancel={() => setShowAddSkill(false)}
          />
        )}
      </div>
    )
  }

  const parents = currentSkill ? getParents(currentSkill.id) : []
  const children = currentSkill ? getChildren(currentSkill.id) : []

  return (
    <div className="border border-border bg-card min-h-[400px]">
      {/* Header with navigation */}
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToRoot}
            className="text-muted-foreground hover:text-foreground uppercase text-xs tracking-widest"
          >
            <Home className="w-4 h-4 mr-1" />
            Root
          </Button>
          {rootSkills.length > 1 && (
            <select
              value={rootSkills.find(r => r.id === currentSkill?.id)?.id || ""}
              onChange={(e) => {
                const root = rootSkills.find(r => r.id === e.target.value)
                if (root) navigateTo(root)
              }}
              className="bg-secondary border border-border text-foreground text-xs px-2 py-1"
            >
              <option value="" disabled>Select Root</option>
              {rootSkills.map(root => (
                <option key={root.id} value={root.id}>{root.name}</option>
              ))}
            </select>
          )}
        </div>
        
        {isDev && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddSkill(true)}
              className="border-border text-foreground hover:bg-secondary uppercase text-xs tracking-widest"
            >
              <Plus className="w-4 h-4 mr-1" />
              Skill
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddEdge(true)}
              className="border-border text-foreground hover:bg-secondary uppercase text-xs tracking-widest"
            >
              <Plus className="w-4 h-4 mr-1" />
              Edge
            </Button>
          </div>
        )}
      </div>

      {/* Skill Tree View - Parent / Current / Children */}
      <div className="p-6 space-y-6">
        {/* Parents Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ChevronUp className="w-4 h-4" />
            <span className="text-xs uppercase tracking-[0.2em]">Parents</span>
          </div>
          
          {parents.length === 0 ? (
            <p className="text-sm text-muted-foreground italic font-serif pl-6">
              This is a root skill
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 pl-6">
              {parents.map(parent => (
                <div key={parent.id} className="flex items-center gap-1">
                  <button
                    onClick={() => navigateTo(parent)}
                    className="border border-border bg-secondary/50 px-4 py-2 text-sm font-serif text-foreground hover:bg-secondary hover:border-foreground/30 transition-colors"
                  >
                    {parent.name}
                  </button>
                  {isDev && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteEdge(parent.id, currentSkill!.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connecting Line */}
        {parents.length > 0 && (
          <div className="flex justify-center">
            <div className="w-px h-6 bg-border" />
          </div>
        )}

        {/* Current Skill */}
        {currentSkill && (
          <div className="flex justify-center">
            <div className="border-2 border-foreground bg-card px-8 py-6 text-center min-w-[200px] relative">
              <h3 className="font-serif text-2xl text-foreground mb-2">
                {currentSkill.name}
              </h3>
              {currentSkill.skill_text && (
                <p className="text-sm text-muted-foreground italic mb-2">
                  {currentSkill.skill_text}
                </p>
              )}
              {currentSkill.unlock_hint && (
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                  unlock: {currentSkill.unlock_hint}
                </p>
              )}
              
              {isDev && (
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSkill(currentSkill.id)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Connecting Line */}
        {children.length > 0 && (
          <div className="flex justify-center">
            <div className="w-px h-6 bg-border" />
          </div>
        )}

        {/* Children Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ChevronDown className="w-4 h-4" />
            <span className="text-xs uppercase tracking-[0.2em]">Children</span>
          </div>
          
          {children.length === 0 ? (
            <p className="text-sm text-muted-foreground italic font-serif pl-6">
              No skills branch from here
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 pl-6">
              {children.map(child => (
                <div key={child.id} className="flex items-center gap-1">
                  <button
                    onClick={() => navigateTo(child)}
                    className="border border-border bg-secondary/50 px-4 py-2 text-sm font-serif text-foreground hover:bg-secondary hover:border-foreground/30 transition-colors"
                  >
                    
                    {child.name}
                  </button>
                  {isDev && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteEdge(currentSkill!.id, child.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Skill Modal */}
      {isDev && showAddSkill && (
        <AddSkillForm 
          newSkill={newSkill}
          setNewSkill={setNewSkill}
          onAdd={handleAddSkill}
          onCancel={() => setShowAddSkill(false)}
        />
      )}

      {/* Add Edge Modal */}
      {isDev && showAddEdge && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
          <div className="border border-border bg-card p-6 w-full max-w-md">
            <h3 className="font-serif text-lg text-foreground mb-4">Add Connection</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">
                  Parent Skill
                </label>
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
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">
                  Child Skill
                </label>
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
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">
                  Edge Type
                </label>
                <input
                  type="text"
                  value={newEdge.edge_type}
                  onChange={(e) => setNewEdge({ ...newEdge, edge_type: e.target.value })}
                  placeholder="unlocks"
                  className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground"
                />
              </div>
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
          </div>
        </div>
      )}
    </div>
  )
}

function AddSkillForm({ 
  newSkill, 
  setNewSkill, 
  onAdd, 
  onCancel 
}: { 
  newSkill: { name: string; unlock_hint: string; unlock_key: string }
  setNewSkill: (skill: { name: string; unlock_hint: string; unlock_key: string }) => void
  onAdd: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
      <div className="border border-border bg-card p-6 w-full max-w-md">
        <h3 className="font-serif text-lg text-foreground mb-4">Add Skill</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">
              Name
            </label>
            <input
              type="text"
              value={newSkill.name}
              onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
              placeholder="Skill name"
              className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">
              Unlock Hint
            </label>
            <input
              type="text"
              value={newSkill.unlock_hint}
              onChange={(e) => setNewSkill({ ...newSkill, unlock_hint: e.target.value })}
              placeholder="A cryptic hint for the player..."
              className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">
              Unlock Key
            </label>
            <input
              type="text"
              value={newSkill.unlock_key}
              onChange={(e) => setNewSkill({ ...newSkill, unlock_key: e.target.value })}
              placeholder="QUEST_COMPLETE"
              className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              onClick={onAdd}
              disabled={!newSkill.name.trim()}
              className="flex-1 bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
            >
              Add Skill
            </Button>
            <Button
              variant="outline"
              onClick={onCancel}
              className="border-border text-foreground hover:bg-secondary uppercase tracking-widest text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
