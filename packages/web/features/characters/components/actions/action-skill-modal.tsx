"use client"

import { useState, useEffect, useCallback } from "react"
import { GripVertical, X, Zap } from "lucide-react"
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

export interface ActionSkill {
  id: string
  name: string
  cooldown: number | null
  type: string | null
  use: string | null
  effect: unknown | null
}

type SortField = "type" | "use" | null

function SortableSkillRow({ skill, sortActive }: { skill: ActionSkill; sortActive: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: skill.id,
    disabled: sortActive,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-secondary/10"
    >
      {!sortActive && (
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground/30 hover:text-muted-foreground/60 cursor-grab active:cursor-grabbing shrink-0"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-serif text-base text-foreground truncate">{skill.name}</p>
        {skill.cooldown != null && (
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
            {skill.cooldown}s cooldown
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {skill.type && (
          <span className="text-[9px] uppercase tracking-[0.15em] border border-border text-muted-foreground px-1.5 py-0.5">
            {skill.type}
          </span>
        )}
        {skill.use && (
          <span className="text-[9px] uppercase tracking-[0.15em] border border-cyan-800/50 text-cyan-500/70 px-1.5 py-0.5">
            {skill.use}
          </span>
        )}
        <button className="text-[9px] uppercase tracking-widest border border-amber-700/40 text-amber-500/70 px-2 py-1 hover:bg-amber-950/30 transition-colors">
          Activate
        </button>
      </div>
    </div>
  )
}

interface ActionSkillModalProps {
  isOpen: boolean
  onClose: () => void
  skills: ActionSkill[]
  characterId: string
}

export function ActionSkillModal({ isOpen, onClose, skills, characterId }: ActionSkillModalProps) {
  const [order, setOrder] = useState<string[]>(() => skills.map((s) => s.id))
  const [sortField, setSortField] = useState<SortField>(null)

  // Restore persisted order, reconciling against current skills
  useEffect(() => {
    const stored = localStorage.getItem(`action_skill_order_${characterId}`)
    if (!stored) return
    try {
      const parsed: string[] = JSON.parse(stored)
      const skillIds = new Set(skills.map((s) => s.id))
      const valid = parsed.filter((id) => skillIds.has(id))
      const missing = skills.map((s) => s.id).filter((id) => !valid.includes(id))
      if (valid.length > 0) setOrder([...valid, ...missing])
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      setOrder((prev) => {
        const from = prev.indexOf(String(active.id))
        const to = prev.indexOf(String(over.id))
        const next = arrayMove(prev, from, to)
        localStorage.setItem(`action_skill_order_${characterId}`, JSON.stringify(next))
        return next
      })
    },
    [characterId]
  )

  const toggleSort = (field: SortField) => setSortField((prev) => (prev === field ? null : field))

  if (!isOpen) return null

  const displayedSkills = sortField
    ? [...skills].sort((a, b) => (a[sortField] ?? "").toLowerCase().localeCompare((b[sortField] ?? "").toLowerCase()))
    : order.map((id) => skills.find((s) => s.id === id)).filter((s): s is ActionSkill => s !== undefined)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[80vh] border border-border bg-card shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs uppercase tracking-[0.3em] text-foreground">Active Skills</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border/50 shrink-0">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mr-1">Sort:</span>
          {(["type", "use"] as const).map((field) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`text-[9px] uppercase tracking-widest px-2.5 py-1 border transition-colors ${
                sortField === field
                  ? "border-foreground/40 text-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/20"
              }`}
            >
              {field}
            </button>
          ))}
          {sortField && (
            <button
              onClick={() => setSortField(null)}
              className="text-[9px] uppercase tracking-widest px-2.5 py-1 border border-border text-muted-foreground/50 hover:border-foreground/20 transition-colors ml-1"
            >
              Reset
            </button>
          )}
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">
          {skills.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="font-serif text-sm text-muted-foreground/40 italic">No active skills available.</p>
            </div>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={displayedSkills.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {displayedSkills.map((skill) => (
                  <SortableSkillRow key={skill.id} skill={skill} sortActive={sortField !== null} />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  )
}
