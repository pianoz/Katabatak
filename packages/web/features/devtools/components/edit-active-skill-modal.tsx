"use client"

import { useState, useEffect } from "react"
import { X, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { createActiveSkill, updateActiveSkill } from "@/lib/services/active-skill-service"
import type { ActiveSkill } from "@/lib/services/active-skill-service"
import { EffectEditorModal } from "@/components/effect-editor-modal"
import type { Effect } from "@/lib/effect-engine"
import type { Json } from "@/components/types/supabase"

interface EditActiveSkillModalProps {
  skill: ActiveSkill | null
  isOpen: boolean
  onClose: () => void
  onSaved: (skill: ActiveSkill) => void
}

interface FormState {
  name: string
  description: string
  cooldown: string
  effects: Effect[]
}

function blankForm(): FormState {
  return { name: "", description: "", cooldown: "", effects: [] }
}

function skillToForm(skill: ActiveSkill): FormState {
  return {
    name: skill.name,
    description: skill.description ?? "",
    cooldown: skill.cooldown != null ? String(skill.cooldown) : "",
    effects: skill.effects,
  }
}

export function EditActiveSkillModal({ skill, isOpen, onClose, onSaved }: EditActiveSkillModalProps) {
  const [form, setForm] = useState<FormState>(blankForm)
  const [effectEditorOpen, setEffectEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCreate = skill === null

  useEffect(() => {
    if (isOpen) {
      setForm(skill ? skillToForm(skill) : blankForm())
      setError(null)
    }
  }, [isOpen, skill])

  if (!isOpen) return null

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      cooldown: form.cooldown !== "" ? parseInt(form.cooldown) : null,
      effects: form.effects,
    }

    if (isCreate) {
      const { data, error: err } = await createActiveSkill(supabase, payload)
      setSaving(false)
      if (err) { setError(err.message); return }
      onSaved({ ...(data as ActiveSkill), effects: form.effects })
    } else {
      const { error: err } = await updateActiveSkill(supabase, skill!.id, payload)
      setSaving(false)
      if (err) { setError(err.message); return }
      onSaved({ ...skill!, ...payload, effects: form.effects })
    }
    onClose()
  }

  const inputClass = "w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/50 placeholder:text-muted-foreground/50"
  const labelClass = "text-[10px] uppercase tracking-widest text-muted-foreground"

  return (
    <>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
        <div
          className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto border border-border bg-card shadow-2xl flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex justify-between items-center px-6 py-4 bg-card/95 backdrop-blur-sm border-b border-border">
            <div>
              <h2 className="font-serif text-2xl text-foreground">
                {isCreate ? "New Active Skill" : skill!.name}
              </h2>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                {isCreate ? "Create Active Skill" : "Edit Active Skill"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Identity */}
            <section className="space-y-4">
              <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Identity</h3>

              <div className="space-y-1">
                <label className={labelClass}>Name *</label>
                <input
                  className={inputClass}
                  placeholder="e.g. Shadow Step"
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Description</label>
                <textarea
                  className={`${inputClass} resize-none`}
                  rows={3}
                  placeholder="What this skill does…"
                  value={form.description}
                  onChange={e => set("description", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Cooldown (rounds)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  placeholder="Leave blank for none"
                  value={form.cooldown}
                  onChange={e => set("cooldown", e.target.value)}
                />
              </div>
            </section>

            {/* Effects */}
            <section className="space-y-3">
              <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Effects</h3>
              <button
                type="button"
                onClick={() => setEffectEditorOpen(true)}
                className="flex items-center gap-2 px-4 py-2 border border-cyan-800/50 text-cyan-400 text-xs uppercase tracking-widest hover:bg-cyan-900/20 transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                {form.effects.length > 0
                  ? `Edit Effects (${form.effects.length})`
                  : "Add Effects"}
              </button>
            </section>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex flex-col gap-2 px-6 py-4 bg-card/95 backdrop-blur-sm border-t border-border">
            {error && <p className="text-xs text-red-400 text-right">{error}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={onClose} className="text-muted-foreground uppercase tracking-widest text-xs">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="uppercase tracking-widest text-xs bg-foreground text-background hover:bg-foreground/90"
              >
                {saving ? "Saving…" : isCreate ? "Create Skill" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>

        <div className="absolute inset-0 -z-10" onClick={onClose} />
      </div>

      <EffectEditorModal
        isOpen={effectEditorOpen}
        effects={form.effects}
        onSave={saved => set("effects", saved)}
        onClose={() => setEffectEditorOpen(false)}
      />
    </>
  )
}
