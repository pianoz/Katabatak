"use client"

import { useState, useEffect } from "react"
import { X, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { createSpell, updateSpell } from "@/lib/services/spell-service"
import { EffectEditorModal } from "@/components/effect-editor-modal"
import type { Effect } from "@/lib/effect-engine"
import type { Json } from "@/components/types/supabase"

const ATTRIBUTES = ["power", "will", "essence", "health"] as const

export interface SpellRow {
  id: number
  name: string | null
  type: string | null
  subtype: string | null
  description: string | null
  damage: number | null
  defence: number | null
  modifier: number | null
  modifier_attribute_name: string | null
  coefficient: number | null
  coefficient_attribute_name: string | null
  cost: number | null
  cost_attribute_name: string | null
  cast_time_min: number | null
  remain_time_min: number | null
  cooldown_min: number | null
  aoe_m: number | null
  range_m: number | null
  active: boolean | null
  effects: Effect[]
}

interface EditSpellModalProps {
  spell: SpellRow | null
  isOpen: boolean
  onClose: () => void
  onSaved: (spell: SpellRow) => void
}

type FormState = Omit<
  SpellRow,
  "id" | "effects" | "damage" | "defence" | "modifier" | "coefficient" | "cost" |
  "cast_time_min" | "remain_time_min" | "cooldown_min" | "aoe_m" | "range_m"
> & {
  damage: string
  defence: string
  modifier: string
  coefficient: string
  cost: string
  cast_time_min: string
  remain_time_min: string
  cooldown_min: string
  aoe_m: string
  range_m: string
  effects: Effect[]
}

function blankForm(): FormState {
  return {
    name: "", type: "", subtype: "", description: "",
    damage: "", defence: "", modifier: "", modifier_attribute_name: null,
    coefficient: "", coefficient_attribute_name: null,
    cost: "", cost_attribute_name: null,
    cast_time_min: "", remain_time_min: "", cooldown_min: "",
    aoe_m: "", range_m: "", active: true, effects: [],
  }
}

function spellToForm(spell: SpellRow): FormState {
  return {
    name: spell.name ?? "",
    type: spell.type ?? "",
    subtype: spell.subtype ?? "",
    description: spell.description ?? "",
    damage: spell.damage != null ? String(spell.damage) : "",
    defence: spell.defence != null ? String(spell.defence) : "",
    modifier: spell.modifier != null ? String(spell.modifier) : "",
    modifier_attribute_name: spell.modifier_attribute_name,
    coefficient: spell.coefficient != null ? String(spell.coefficient) : "",
    coefficient_attribute_name: spell.coefficient_attribute_name,
    cost: spell.cost != null ? String(spell.cost) : "",
    cost_attribute_name: spell.cost_attribute_name,
    cast_time_min: spell.cast_time_min != null ? String(spell.cast_time_min) : "",
    remain_time_min: spell.remain_time_min != null ? String(spell.remain_time_min) : "",
    cooldown_min: spell.cooldown_min != null ? String(spell.cooldown_min) : "",
    aoe_m: spell.aoe_m != null ? String(spell.aoe_m) : "",
    range_m: spell.range_m != null ? String(spell.range_m) : "",
    active: spell.active ?? true,
    effects: spell.effects,
  }
}

function num(s: string): number | null {
  if (s === "" || s === null) return null
  const n = Number(s)
  return isNaN(n) ? null : n
}

export function EditSpellModal({ spell, isOpen, onClose, onSaved }: EditSpellModalProps) {
  const [form, setForm] = useState<FormState>(blankForm)
  const [effectEditorOpen, setEffectEditorOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCreate = spell === null

  useEffect(() => {
    if (isOpen) {
      setForm(spell ? spellToForm(spell) : blankForm())
      setError(null)
    }
  }, [isOpen, spell])

  if (!isOpen) return null

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!form.name?.trim()) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const payload: Record<string, unknown> = {
      name: form.name.trim() || null,
      type: form.type?.trim() || null,
      subtype: form.subtype?.trim() || null,
      description: form.description?.trim() || null,
      damage: num(form.damage),
      defence: num(form.defence),
      modifier: num(form.modifier),
      modifier_attribute_name: form.modifier_attribute_name || null,
      coefficient: num(form.coefficient),
      coefficient_attribute_name: form.coefficient_attribute_name || null,
      cost: num(form.cost),
      cost_attribute_name: form.cost_attribute_name || null,
      cast_time_min: num(form.cast_time_min),
      remain_time_min: num(form.remain_time_min),
      cooldown_min: num(form.cooldown_min),
      aoe_m: num(form.aoe_m),
      range_m: num(form.range_m),
      active: form.active,
      effects: form.effects as unknown as Json,
    }

    if (isCreate) {
      const { data, error: err } = await createSpell(supabase, payload)
      setSaving(false)
      if (err) { setError(err.message); return }
      onSaved({ ...(data as SpellRow), effects: form.effects })
    } else {
      const { error: err } = await updateSpell(supabase, spell!.id, payload)
      setSaving(false)
      if (err) { setError(err.message); return }
      onSaved({ ...spell!, ...payload, id: spell!.id, effects: form.effects } as SpellRow)
    }
    onClose()
  }

  const inputClass = "w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/50 placeholder:text-muted-foreground/50"
  const labelClass = "text-[10px] uppercase tracking-widest text-muted-foreground"

  return (
    <>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
        <div
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border bg-card shadow-2xl flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex justify-between items-center px-6 py-4 bg-card/95 backdrop-blur-sm border-b border-border">
            <div>
              <h2 className="font-serif text-2xl text-foreground">
                {isCreate ? "New Spell" : (spell!.name ?? "Edit Spell")}
              </h2>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                {isCreate ? "Create Spell" : "Edit Spell"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="p-6 space-y-8">
            {/* Identity */}
            <section className="space-y-4">
              <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Identity</h3>
              <div className="space-y-1">
                <label className={labelClass}>Name *</label>
                <input className={inputClass} value={form.name ?? ""} onChange={e => set("name", e.target.value)} placeholder="e.g. Flame Lance" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Type</label>
                  <input className={inputClass} value={form.type ?? ""} onChange={e => set("type", e.target.value || null)} placeholder="e.g. attack, utility" />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Subtype</label>
                  <input className={inputClass} value={form.subtype ?? ""} onChange={e => set("subtype", e.target.value || null)} placeholder="e.g. fire, arcane" />
                </div>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Description</label>
                <textarea
                  className={`${inputClass} resize-none`}
                  rows={3}
                  value={form.description ?? ""}
                  onChange={e => set("description", e.target.value || null)}
                  placeholder="What this spell does…"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="accent-cyan-500" checked={!!form.active} onChange={e => set("active", e.target.checked)} />
                <span className="text-xs text-muted-foreground uppercase tracking-widest">Active (usable in combat)</span>
              </label>
            </section>

            {/* Combat */}
            <section className="space-y-4">
              <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Combat</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Damage</label>
                  <input type="number" step="1" className={inputClass} value={form.damage} onChange={e => set("damage", e.target.value)} placeholder="—" />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Defence</label>
                  <input type="number" step="1" className={inputClass} value={form.defence} onChange={e => set("defence", e.target.value)} placeholder="—" />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Cooldown (min)</label>
                  <input type="number" min="0" step="1" className={inputClass} value={form.cooldown_min} onChange={e => set("cooldown_min", e.target.value)} placeholder="—" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Cast Time (min)</label>
                  <input type="number" min="0" step="1" className={inputClass} value={form.cast_time_min} onChange={e => set("cast_time_min", e.target.value)} placeholder="—" />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Duration (min)</label>
                  <input type="number" min="0" step="1" className={inputClass} value={form.remain_time_min} onChange={e => set("remain_time_min", e.target.value)} placeholder="—" />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Range (m)</label>
                  <input type="number" min="0" step="1" className={inputClass} value={form.range_m} onChange={e => set("range_m", e.target.value)} placeholder="—" />
                </div>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>AoE Radius (m)</label>
                <input type="number" min="0" step="1" className={`${inputClass} max-w-xs`} value={form.aoe_m} onChange={e => set("aoe_m", e.target.value)} placeholder="—" />
              </div>
            </section>

            {/* Cost */}
            <section className="space-y-4">
              <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Cost & Scaling</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Cost Value</label>
                  <input type="number" min="0" step="1" className={inputClass} value={form.cost} onChange={e => set("cost", e.target.value)} placeholder="—" />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Cost Attribute</label>
                  <select className={inputClass} value={form.cost_attribute_name ?? ""} onChange={e => set("cost_attribute_name", e.target.value || null)}>
                    <option value="">— None —</option>
                    {ATTRIBUTES.map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Modifier</label>
                  <input type="number" step="1" className={inputClass} value={form.modifier} onChange={e => set("modifier", e.target.value)} placeholder="—" />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Modifier Attribute</label>
                  <select className={inputClass} value={form.modifier_attribute_name ?? ""} onChange={e => set("modifier_attribute_name", e.target.value || null)}>
                    <option value="">— None —</option>
                    {ATTRIBUTES.map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Coefficient</label>
                  <input type="number" step="0.01" className={inputClass} value={form.coefficient} onChange={e => set("coefficient", e.target.value)} placeholder="—" />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Coefficient Attribute</label>
                  <select className={inputClass} value={form.coefficient_attribute_name ?? ""} onChange={e => set("coefficient_attribute_name", e.target.value || null)}>
                    <option value="">— None —</option>
                    {ATTRIBUTES.map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
                  </select>
                </div>
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
                {form.effects.length > 0 ? `Edit Effects (${form.effects.length})` : "Add Effects"}
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
                disabled={saving || !form.name?.trim()}
                className="uppercase tracking-widest text-xs bg-foreground text-background hover:bg-foreground/90"
              >
                {saving ? "Saving…" : isCreate ? "Create Spell" : "Save Changes"}
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
