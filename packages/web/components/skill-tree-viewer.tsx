"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown, Plus, Home, Pencil, Trash2, Lock } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { StatIncreaseModal } from "./attribute-increase-popup"
import type { SkillEffect } from "@/lib/skill-engine"

interface Skill {
  id: string
  name: string
  unlock_hint?: string | null
  unlock_key?: string | null
  skill_text?: string | null
  effects?: unknown
  is_passive?: boolean | null
  max_rank?: number | null
}

interface SkillEdge {
  id: string
  parent_skill_id: string | null
  child_skill_id: string | null
  edge_type?: string | null
}

interface SkillTreeViewerProps {
  isDev?: boolean
  initialSkillId?: string
  characterId?: string
  unused_skill_points: number
  onSkillChange?: () => void
}

export function SkillTreeViewer({ isDev = false, initialSkillId, characterId, unused_skill_points, onSkillChange }: SkillTreeViewerProps) {
  const [isStatModalOpen, setIsStatModalOpen] = useState(false)
  const [skills, setSkills] = useState<Skill[]>([])
  const [edges, setEdges] = useState<SkillEdge[]>([])
  const [unlockedSkillIds, setUnlockedSkillIds] = useState<Set<string>>(new Set()) 
  const [currentSkill, setCurrentSkill] = useState<Skill | null>(null)
  const [rootSkills, setRootSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddSkill, setShowAddSkill] = useState(false)
  const [showAddEdge, setShowAddEdge] = useState(false)
  const [newSkill, setNewSkill] = useState({ name: "", skill_text: "", unlock_hint: "", unlock_key: "", is_passive: true, max_rank: 1, effects_json: "[]" })
  const [newEdge, setNewEdge] = useState({ parent_skill_id: "", child_skill_id: "", edge_type: "unlocks" })
  
  // Local state to track and optimistically update skill points
  const [availablePoints, setAvailablePoints] = useState(unused_skill_points)

  // Keep local points in sync if the parent component updates the prop externally
  useEffect(() => {
    setAvailablePoints(unused_skill_points)
  }, [unused_skill_points])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const supabase = createClient()
    
    const [skillsRes, edgesRes] = await Promise.all([
      supabase.from("skills").select("*").order("name"),
      supabase.from("skill_edges").select("*")
    ])

    if (characterId) {
        const { data: charSkills } = await supabase
        .from("character_skills")
        .select("skill_id")
        .eq("character_id", characterId)
        
        if (charSkills) {
          setUnlockedSkillIds(new Set(charSkills.map(s => s.skill_id)))
        }
    }
    if (skillsRes.data) setSkills(skillsRes.data)
    if (edgesRes.data) setEdges(edgesRes.data)

    if (skillsRes.data && edgesRes.data) {
      const childIds = new Set(edgesRes.data.map(e => e.child_skill_id))
      const roots = skillsRes.data.filter(s => !childIds.has(s.id))
      setRootSkills(roots)

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
        is_passive: newSkill.is_passive,
        max_rank: newSkill.max_rank,
        effects,
      })
      .select()
      .single()

    if (!error && data) {
      setSkills(prev => [...prev, data])
      if (!currentSkill) setCurrentSkill(data)
      setNewSkill({ name: "", skill_text: "", unlock_hint: "", unlock_key: "", is_passive: true, max_rank: 1, effects_json: "[]" })
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
    await supabase.from("skill_edges").delete().or(`parent_skill_id.eq.${skillId},child_skill_id.eq.${skillId}`)
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

  const updateCharacterStatInDB = async (statField: "health_max" | "power_max" | "will_max" | "essence_max") => {
    const supabase = createClient();
    if (!characterId) return;

    // Fetch current value of that specific stat first to increment it safely
    const { data: character, error: fetchError } = await supabase
      .from('characters') // Replace with your actual character table name
      .select(statField)
      .eq('id', characterId)
      .single();

    if (fetchError) throw fetchError;

    const currentValue = (character as Record<string, any>)?.[statField] || 0;

    // Update the database with the incremented value
    const { error: updateError } = await supabase
      .from('characters')
      .update({ [statField]: currentValue + 1 } as unknown as { unused_skill_points?: number }) // Dynamic object key assignment
      .eq('id', characterId);

    if (updateError) throw updateError;
  };

  const toggleSkillUnlock = async () => {
    const supabase = createClient();
    if (!currentSkill || !characterId) return;

    const isCurrentlyUnlocked = unlockedSkillIds.has(currentSkill.id);

    if (!isCurrentlyUnlocked) {
      const skillParents = getParents(currentSkill.id)
      if (skillParents.length > 0 && !skillParents.every(p => unlockedSkillIds.has(p.id))) {
        alert("You must unlock all prerequisite skills first.")
        return
      }
    }

    try {
      if (isCurrentlyUnlocked) {
        // --- LOCKING THE SKILL (REFUND POINT) ---
        const { error } = await supabase
          .from('character_skills')
          .delete()
          .match({ character_id: characterId, skill_id: currentSkill.id });

        if (error) throw error;

        const newUnlocks = new Set(unlockedSkillIds);
        newUnlocks.delete(currentSkill.id);
        setUnlockedSkillIds(newUnlocks);
        onSkillChange?.()

      } else {
        // --- UNLOCKING THE SKILL (SPEND POINT) ---
        if (availablePoints > 0) {
          const { error } = await supabase
            .from('character_skills')
            .insert([{ character_id: characterId, skill_id: currentSkill.id }]);

          if (error) throw error;

          setUnlockedSkillIds(new Set([...unlockedSkillIds, currentSkill.id]));
          setAvailablePoints(prev => prev - 1);

          // Open the modal. The actual DB stat update happens when they hit confirm in the modal.
          setIsStatModalOpen(true);

        } else { 
          alert("You don't have enough skill points to unlock this skill.");
        }
      }
    } catch (err) {
      console.error("Error toggling skill:", err);
    }
  };

  if (loading) {
    return (
      <div className="border border-border bg-card p-8 flex items-center justify-center min-h-100">
        <p className="text-muted-foreground text-sm italic font-serif">Loading skill tree...</p>
      </div>
    )
  }

  if (skills.length === 0) {
    return (
      <div className="border border-border bg-card p-8 min-h-100">
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
  const isCurrentSkillVisible = parents.some(p => unlockedSkillIds.has(p.id));

  return (
    <div className="border border-border bg-card min-h-100">
      {/* Header with navigation & Point display */}
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
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
          {/* Display current skill points */}
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Points Available: <strong className="text-foreground">{availablePoints}</strong>
            </span>
            {isDev && characterId && (
              <button
                onClick={async () => {
                  const supabase = createClient()
                  const { error } = await supabase
                    .from("characters")
                    .update({ unused_skill_points: availablePoints + 1 })
                    .eq("id", characterId)
                  if (!error) setAvailablePoints(prev => prev + 1)
                }}
                className="w-5 h-5 flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                title="Add skill point (dev)"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
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

      {/* Skill Tree View */}
      <div className="p-6 space-y-6">
        {/* Parents Section */}
        <div className="space-y-3">
            {parents.length === 0 ? (
                <p className="text-sm text-muted-foreground italic font-serif pl-6">
                This is a root skill
                </p>
            ) : (
                <div className="flex flex-wrap gap-2 justify-evenly">
                {parents.map(parent => {
                    const isUnlocked = unlockedSkillIds.has(parent.id);
                    return (
                    <div key={parent.id} className="flex items-center gap-1">
                        <button
                        onClick={() => navigateTo(parent)}
                        className={`
                            border px-4 py-2 text-sm font-serif transition-all duration-700
                            ${isUnlocked 
                            ? "border-cyan-500/60 bg-cyan-950/30 text-cyan-100 shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]" 
                            : "border-border bg-secondary/50 text-foreground hover:bg-secondary hover:border-foreground/30"}
                        `}
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
                    );
                })}
                </div>
            )}
        </div>

        {/* Parents to Current Connectors */}
        {parents.length > 0 && (
        <div className="relative w-full h-16 -mt-2 -mb-2">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
                <filter id="parent-glow-fixed">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
            
            {parents.map((parent, index) => {
                const isParentUnlocked = unlockedSkillIds.has(parent.id);
                const total = parents.length;
                const spacing = 100 / (total + 1);
                const xStart = (index + 1) * spacing;
                
                return (
                <g key={`parent-link-${parent.id}`}>
                    <path
                    d={`M ${xStart} 0 Q ${xStart} 50, 50 100`}
                    fill="none"
                    stroke={isParentUnlocked ? "rgba(34, 211, 238, 0.8)" : "rgba(255, 255, 255, 0.25)"}
                    strokeWidth={isParentUnlocked ? "2" : "1"}
                    className={`transition-all duration-1000 ${isParentUnlocked ? "animate-pulse" : ""}`}
                    style={{ 
                        filter: isParentUnlocked ? 'url(#parent-glow-fixed)' : 'none',
                        strokeDasharray: isParentUnlocked ? 'none' : '4 2' 
                    }}
                    />
                </g>
                );
            })}
            </svg>
        </div>
        )}
        
        {/* Current Skill */}
        {currentSkill && (() => {
        const isUnlocked = unlockedSkillIds.has(currentSkill.id);
        const isAvailable = parents.some(p => unlockedSkillIds.has(p.id));
        const canUnlock = parents.length === 0 || parents.every(p => unlockedSkillIds.has(p.id));
        const showDetails = isUnlocked || isAvailable;

        return (
        <div className="flex justify-center">
        <div 
            className={`
            border-2 px-8 py-6 text-center relative transition-all duration-1000
            ${isUnlocked 
                ? "border-cyan-400/80 shadow-[0_0_20px_rgba(34,211,238,0.4),inset_0_0_12px_rgba(34,211,238,0.1)] bg-cyan-950/20" 
                : "border-foreground bg-card"}
            `}
        >
            <h3 className={`
            font-serif text-2xl mb-2 transition-colors duration-1000
            ${isUnlocked ? "text-cyan-100 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" : "text-foreground"}
            `}>
            {currentSkill.name}
            </h3>

            {showDetails ? (
            <>
                {currentSkill.skill_text && (
                <p className={`
                    text-sm italic mb-2 transition-colors duration-1000
                    ${isUnlocked ? "text-cyan-200/70" : "text-muted-foreground"}
                `}>
                    {currentSkill.skill_text}
                </p>
                )}

                {Array.isArray(currentSkill.effects) && currentSkill.effects.length > 0 && (
                <div className="mt-2 mb-2 space-y-1">
                    {currentSkill.effects.map((effect, i) => (
                    <p key={i} className="text-xs uppercase tracking-widest text-cyan-400/60">
                        {formatEffect(effect)}
                    </p>
                    ))}
                </div>
                )}

                {currentSkill.unlock_hint && (
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                    unlock: {currentSkill.unlock_hint}
                </p>
                )}
                </>
                ) : (
                <div className="py-4 space-y-2 opacity-20 select-none pointer-events-none">
                    <div className="h-2 bg-foreground/50 w-full rounded-full" />
                    <div className="h-2 bg-foreground/50 w-2/3 mx-auto rounded-full" />
                    <p className="text-[10px] uppercase tracking-[0.2em] pt-2">
                    Deep Insight Required
                    </p>
                </div>
                )}
                
                <button
                onClick={toggleSkillUnlock}
                disabled={!isUnlocked && !canUnlock}
                className={`
                    mt-6 px-6 py-2 text-xs tracking-[0.2em] uppercase font-bold transition-all duration-500 border
                    ${isUnlocked
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400"
                    : canUnlock
                      ? "bg-transparent border-foreground/30 text-muted-foreground hover:border-cyan-400/60 hover:text-foreground"
                      : "bg-transparent border-foreground/10 text-muted-foreground/30 cursor-not-allowed"
                    }
                `}
                >
                {isUnlocked ? "Remove Skill" : "Learn Skill"}
                </button>
                
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
         );
        })()}

        {/* Current to Children Connectors */}
        {children.length > 0 && (
        <div className="relative w-full h-16 -mt-2 -mb-2">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
                <filter id="line-glow">
                <feGaussianBlur stdDeviation="1" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
            
            {children.map((child, index) => {
                const isUnlocked = unlockedSkillIds.has(child.id);
                const total = children.length;
                const spacing = 100 / (total + 1);
                const xEnd = (index + 1) * spacing;
                
                return (
                <g key={`link-${child.id}`}>
                    <path
                    d={`M 50 0 Q 50 50, ${xEnd} 100`}
                    fill="none"
                    stroke={isUnlocked ? "rgba(34, 211, 238, 0.8)" : "rgba(255, 255, 255, 0.63)"}
                    strokeWidth={isUnlocked ? "1.5" : "0.5"}
                    className={`transition-all duration-1000 ${isUnlocked ? "animate-pulse" : ""}`}
                    style={{ 
                        filter: isUnlocked ? 'url(#line-glow)' : 'none',
                        strokeDasharray: isUnlocked ? 'none' : '2 2' 
                    }}
                    />
                </g>
                );
            })}
            </svg>
        </div>
        )}

        {/* Children Section */}
        <div className="space-y-3">
            <div className="h-50px"/>
            
            {children.length === 0 ? (
                <p className="text-sm text-muted-foreground italic font-serif pl-6">
                No skills branch from here
                </p>
            ) : (
                <div className="flex flex-wrap justify-evenly gap-6 w-full">
                {children.map(child => {
                    const isUnlocked = unlockedSkillIds.has(child.id);
                    const isParentUnlocked = currentSkill && unlockedSkillIds.has(currentSkill.id);
                    return (
                    <div key={child.id} className="flex items-center gap-1">
                        <button
                        onClick={() => isParentUnlocked && navigateTo(child)}
                        className={`
                            border px-4 py-2 text-sm font-serif transition-all duration-700
                            ${isUnlocked 
                            ? "border-cyan-500/60 bg-cyan-950/30 text-cyan-100 shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]" 
                            : "border-border bg-secondary/50 text-foreground hover:bg-secondary hover:border-foreground/30"}
                        `}
                        >
                        {!isParentUnlocked && (<Lock className="w-3 h-3 mr-2 text-muted-foreground" strokeWidth={2.5} />  )}
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
                    );
                })}
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
      {/* Stat Increase Popup */}
      <StatIncreaseModal 
        isOpen={isStatModalOpen}
        onClose={() => setIsStatModalOpen(false)}
        onConfirm={async (selectedPool) => {
        try {
          await updateCharacterStatInDB(selectedPool)
          setIsStatModalOpen(false)
          onSkillChange?.()
        } catch (error) {
          console.error("Failed to save stat to database:", error)
        }
      }}
      />
    </div>
  )
}

function formatEffect(e: unknown): string {
  const effect = e as SkillEffect
  switch (effect.type) {
    case "stat_modifier": {
      const parts: string[] = []
      if (effect.add != null) parts.push(`+${effect.add}`)
      if (effect.multiply != null && effect.multiply !== 1) parts.push(`×${effect.multiply}`)
      return `${parts.join(", ")} ${effect.target ?? "stat"}`
    }
    case "pool_conversion":
      return `${effect.source} → ${effect.destination}${effect.multiply != null ? ` ×${effect.multiply}` : ""}${effect.add != null ? ` +${effect.add}` : ""}`
    case "resource_gain":
      return `on rest: +${effect.add ?? 0} ${effect.destination ?? "pool"}`
    case "weight_reduction":
      return `weight −${effect.add ?? 0}${effect.target ? ` (${effect.target})` : ""}`
    case "utility": {
      const parts: string[] = []
      if (effect.grant_spell) parts.push(`grants spell: ${effect.grant_spell}`)
      if (effect.grant_item) parts.push(`grants item: ${effect.grant_item}`)
      if (effect.target) parts.push(`removes: ${effect.target}`)
      return parts.join(", ") || "utility"
    }
    default:
      return (effect as { type: string }).type
  }
}

type NewSkillState = { name: string; skill_text: string; unlock_hint: string; unlock_key: string; is_passive: boolean; max_rank: number; effects_json: string }

function AddSkillForm({
  newSkill,
  setNewSkill,
  onAdd,
  onCancel,
}: {
  newSkill: NewSkillState
  setNewSkill: (skill: NewSkillState) => void
  onAdd: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
      <div className="border border-border bg-card p-6 w-full max-w-md">
        <h3 className="font-serif text-lg text-foreground mb-4">Add Skill</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">Name</label>
            <input
              type="text"
              value={newSkill.name}
              onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
              placeholder="Skill name"
              className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">Skill Text</label>
            <textarea
              value={newSkill.skill_text}
              onChange={(e) => setNewSkill({ ...newSkill, skill_text: e.target.value })}
              placeholder="Description shown to the player..."
              rows={2}
              className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground resize-none"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">Unlock Hint</label>
            <input
              type="text"
              value={newSkill.unlock_hint}
              onChange={(e) => setNewSkill({ ...newSkill, unlock_hint: e.target.value })}
              placeholder="A cryptic hint for the player..."
              className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">Unlock Key</label>
            <input
              type="text"
              value={newSkill.unlock_key}
              onChange={(e) => setNewSkill({ ...newSkill, unlock_key: e.target.value })}
              placeholder="QUEST_COMPLETE"
              className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">Max Rank</label>
              <input
                type="number"
                min={1}
                value={newSkill.max_rank}
                onChange={(e) => setNewSkill({ ...newSkill, max_rank: parseInt(e.target.value) || 1 })}
                className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">Passive</label>
              <div className="flex items-center h-9.5">
                <input
                  type="checkbox"
                  checked={newSkill.is_passive}
                  onChange={(e) => setNewSkill({ ...newSkill, is_passive: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">Effects (JSON)</label>
            <textarea
              value={newSkill.effects_json}
              onChange={(e) => setNewSkill({ ...newSkill, effects_json: e.target.value })}
              rows={4}
              spellCheck={false}
              className="w-full bg-secondary border border-border text-foreground text-xs px-3 py-2 font-mono resize-none"
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