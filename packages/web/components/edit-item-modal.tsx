"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Package, X, Info } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Item } from "@/components/types/types"

const RARITIES = ["common", "uncommon", "rare", "extremely rare", "mythical"] as const
const ITEM_TYPES = ["weapon", "armor", "gear", "tool", "accessory", "consumable", "other"] as const
const ATTRIBUTES = ["power", "will", "essence", "health"] as const

const RARITY_COLORS: Record<string, string> = {
  common: "text-muted-foreground border-muted-foreground",
  uncommon: "text-green-500 border-green-500",
  rare: "text-blue-400 border-blue-400",
  "extremely rare": "text-purple-400 border-purple-400",
  mythical: "text-amber-400 border-amber-400",
}

interface EditItemModalProps {
  item: Item | null
  onClose: () => void
  onSaved: (updatedItem: Item) => void
}

type FormState = Omit<Item, "id" | "required_skill">

export function EditItemModal({ item, onClose, onSaved }: EditItemModalProps) {
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (item) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, required_skill, ...rest } = item
      setForm(rest as FormState)
      setError(null)
    }
  }, [item])

  if (!item || !form) return null

  const isWeapon = form.type === "weapon"
  const isArmor = form.type === "armor"

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => prev ? { ...prev, [key]: value } : prev)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from("items")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(form as any)
      .eq("id", item!.id)
      .select()
      .single()
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    onSaved(data as Item)
    onClose()
  }

  const inputClass =
    "w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/50 placeholder:text-muted-foreground/50"
  const labelClass = "text-[10px] uppercase tracking-widest text-muted-foreground"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border bg-card shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex justify-between items-center px-6 py-4 bg-card/95 backdrop-blur-sm border-b border-border">
          <div>
            <h2 className="font-serif text-2xl text-foreground">{item.name}</h2>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Edit Item</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-8">

          {/* ── IDENTITY ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Identity</h3>

            <div className="space-y-1">
              <label className={labelClass}>Name *</label>
              <input
                className={inputClass}
                value={form.name ?? ""}
                onChange={e => set("name", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Type</label>
                <select
                  className={inputClass}
                  value={form.type ?? ""}
                  onChange={e => set("type", e.target.value || null)}
                >
                  <option value="">— Select Type —</option>
                  {ITEM_TYPES.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Subtype</label>
                <input
                  className={inputClass}
                  placeholder={isWeapon ? "e.g. Sword, Axe, Bow" : isArmor ? "e.g. Plate, Chain, Leather" : "e.g. Potion, Key, Scroll"}
                  value={form.subtype ?? ""}
                  onChange={e => set("subtype", e.target.value || null)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Rarity</label>
              <div className="flex flex-wrap gap-2">
                {RARITIES.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => set("rarity", r)}
                    className={`px-3 py-1 text-[10px] uppercase tracking-widest border transition-colors ${
                      form.rarity === r
                        ? `${RARITY_COLORS[r]} bg-current/10`
                        : "border-border text-muted-foreground hover:border-foreground/40"
                    }`}
                  >
                    {r}
                  </button>
                ))}
                {form.rarity && (
                  <button
                    type="button"
                    onClick={() => set("rarity", null)}
                    className="px-3 py-1 text-[10px] uppercase tracking-widest border border-border text-red-400/60 hover:text-red-400 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* ── DESCRIPTIONS ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Descriptions</h3>

            <div className="space-y-1">
              <label className={labelClass}>Short Description</label>
              <input
                className={inputClass}
                value={form.short_description ?? ""}
                onChange={e => set("short_description", e.target.value || null)}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Long Description / Lore</label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={3}
                value={form.long_description ?? ""}
                onChange={e => set("long_description", e.target.value || null)}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Action Text</label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={2}
                value={form.action_text ?? ""}
                onChange={e => set("action_text", e.target.value || null)}
              />
            </div>
          </section>

          {/* ── IMAGE ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Image</h3>
            <div className="flex gap-3 items-start">
              <div className="w-16 h-16 border border-border bg-secondary/20 shrink-0 flex items-center justify-center overflow-hidden">
                {form.image_url ? (
                  <img src={form.image_url} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-6 h-6 text-muted-foreground/30" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <label className={labelClass}>Image URL</label>
                <input
                  className={inputClass}
                  placeholder="https://…"
                  value={form.image_url ?? ""}
                  onChange={e => set("image_url", e.target.value || null)}
                />
              </div>
            </div>
          </section>

          {/* ── PHYSICAL PROPERTIES ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Physical Properties</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Weight (kg)</label>
                <input
                  type="number" min="0" step="0.1" className={inputClass} placeholder="0.0"
                  value={form.weight ?? ""}
                  onChange={e => set("weight", e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Default Condition</label>
                <input
                  type="number" min="0" step="1" className={inputClass} placeholder="100"
                  value={form.default_condition ?? ""}
                  onChange={e => set("default_condition", e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="accent-cyan-500" checked={!!form.is_magical} onChange={e => set("is_magical", e.target.checked)} />
                <span className="text-xs text-muted-foreground uppercase tracking-widest">Magical</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="accent-cyan-500" checked={!!form.consumable} onChange={e => set("consumable", e.target.checked)} />
                <span className="text-xs text-muted-foreground uppercase tracking-widest">Consumable</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="accent-cyan-500" checked={!!form.hidden} onChange={e => set("hidden", e.target.checked)} />
                <span className="text-xs text-muted-foreground uppercase tracking-widest">Hidden</span>
              </label>
            </div>
          </section>

          {/* ── COMBAT ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Combat</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Damage Die (sides)</label>
                <input
                  type="number" min="2" step="1" className={inputClass} placeholder="e.g. 6 for d6"
                  value={form.damage ?? ""}
                  onChange={e => set("damage", e.target.value || null)}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Die Count</label>
                <input
                  type="number" min="1" step="1" className={inputClass} placeholder="e.g. 2 for 2d6"
                  value={form.die_count ?? ""}
                  onChange={e => set("die_count", e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Defence Value</label>
                <input
                  type="number" min="0" step="1" className={inputClass} placeholder="e.g. 5"
                  value={form.defence ?? ""}
                  onChange={e => set("defence", e.target.value ? parseInt(e.target.value) : null)}
                />
              </div>
              <div />
            </div>

            <div className="border-t border-border/40 pt-4 space-y-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Strong Attack Overrides</span>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Strong Damage</label>
                  <input
                    type="number" min="0" step="1" className={inputClass} placeholder="—"
                    value={form.strong_damage ?? ""}
                    onChange={e => set("strong_damage", e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Strong Defence</label>
                  <input
                    type="number" min="0" step="1" className={inputClass} placeholder="—"
                    value={form.strong_defence ?? ""}
                    onChange={e => set("strong_defence", e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Strong Cost</label>
                  <input
                    type="number" min="0" step="1" className={inputClass} placeholder="—"
                    value={form.strong_cost ?? ""}
                    onChange={e => set("strong_cost", e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ── COST & ECONOMY ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Cost & Economy</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Gold Cost</label>
                <input
                  type="number" min="0" step="0.01" className={inputClass} placeholder="0"
                  value={form.cost_gold ?? ""}
                  onChange={e => set("cost_gold", e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Attribute Cost</label>
                <input
                  type="number" min="0" step="1" className={inputClass} placeholder="0"
                  value={form.cost ?? ""}
                  onChange={e => set("cost", e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Cost Attribute</label>
              <select
                className={inputClass}
                value={form.cost_attribute_name ?? ""}
                onChange={e => set("cost_attribute_name", e.target.value || null)}
              >
                <option value="">— None —</option>
                {ATTRIBUTES.map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
              </select>
            </div>
          </section>

          {/* ── MECHANICS ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Mechanics</h3>

            <div className="p-3 border border-border/50 bg-secondary/10 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Info className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">How these values interact</span>
              </div>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                <span className="font-mono text-foreground/70">result = (attribute × coefficient) + modifier</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Modifier</label>
                <input
                  type="number" step="0.01" className={inputClass} placeholder="e.g. 5 or -2"
                  value={form.modifier ?? ""}
                  onChange={e => set("modifier", e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Modifier Attribute</label>
                <select
                  className={inputClass}
                  value={form.modifier_attribute_name ?? ""}
                  onChange={e => set("modifier_attribute_name", e.target.value || null)}
                >
                  <option value="">— None —</option>
                  {ATTRIBUTES.map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Coefficient</label>
                <input
                  type="number" step="0.01" className={inputClass} placeholder="e.g. 1.5"
                  value={form.coefficient ?? ""}
                  onChange={e => set("coefficient", e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Coefficient Attribute</label>
                <select
                  className={inputClass}
                  value={form.coefficient_attribute_name ?? ""}
                  onChange={e => set("coefficient_attribute_name", e.target.value || null)}
                >
                  <option value="">— None —</option>
                  {ATTRIBUTES.map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
                </select>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex flex-col gap-2 px-6 py-4 bg-card/95 backdrop-blur-sm border-t border-border">
          {error && (
            <p className="text-xs text-red-400 text-right">{error}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose} className="text-muted-foreground uppercase tracking-widest text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name?.trim()}
              className="uppercase tracking-widest text-xs bg-foreground text-background hover:bg-foreground/90"
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      {/* Click-outside overlay */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  )
}
