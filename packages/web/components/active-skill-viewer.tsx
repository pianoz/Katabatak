"use client"

import type { ActiveSkill } from "@/lib/services/active-skill-service"

interface ActiveSkillViewerProps {
  activeSkills: ActiveSkill[]
  selectedIds?: Set<string>
  onToggle?: (id: string) => void
}

export function ActiveSkillViewer({ activeSkills, selectedIds, onToggle }: ActiveSkillViewerProps) {
  if (activeSkills.length === 0) {
    return (
      <div className="border border-border bg-card p-8 flex items-center justify-center">
        <p className="text-muted-foreground text-sm italic font-serif">No active skills.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {activeSkills.map((skill) => {
        const isSelected = selectedIds?.has(skill.id) ?? false
        return (
          <div
            key={skill.id}
            onClick={() => onToggle?.(skill.id)}
            className={`border bg-card px-4 py-3 transition-colors ${
              onToggle ? "cursor-pointer" : ""
            } ${
              isSelected
                ? "border-cyan-500 bg-cyan-500/5"
                : "border-border hover:border-foreground/30"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="font-serif text-foreground">{skill.name}</h4>
                {skill.description && (
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                    {skill.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {skill.cooldown != null && (
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border px-2 py-0.5">
                    CD {skill.cooldown}
                  </span>
                )}
                {Array.isArray(skill.effects) && skill.effects.length > 0 && (
                  <span className="text-[10px] uppercase tracking-widest text-cyan-400/70 border border-cyan-800/50 px-2 py-0.5">
                    {skill.effects.length} FX
                  </span>
                )}
                {onToggle && (
                  <div
                    className={`w-4 h-4 border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? "border-cyan-500 bg-cyan-500" : "border-border"
                    }`}
                  >
                    {isSelected && <div className="w-2 h-2 bg-background" />}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
