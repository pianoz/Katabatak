"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { getActiveSkillsCatalog } from "@/lib/services/active-skill-service"
import type {
  Effect,
  EffectTrait,
  EffectTrigger,
  EffectRollContext,
  ActionType,
  MathOp,
  ResourcePool,
} from "@/lib/effect-engine"
import { Button } from "@/components/ui/button"
import { X, Plus, Trash2, RotateCcw, Info } from "lucide-react"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRAITS: EffectTrait[] = ["none", "pure_narrative", "partial_narrative", "passive", "skeng", "one_time"]
const TRIGGERS: EffectTrigger[] = ["activated", "passive", "reactive"]
const ROLL_CONTEXTS: EffectRollContext[] = ["any", "attack", "defense", "skill_check"]
const POOLS: ResourcePool[] = ["essence", "power", "will", "health"]
const ACTION_TYPES: ActionType[] = [
  "stat_modifier",
  "weight_negation",
  "grant_spell",
  "grant_item",
  "grant_active_skill",
  "rest_modifier",
  "pool_recharge",
  "critical",
  "near_critical",
  "discount",
]
const MATH_OPS: MathOp[] = ["add", "multiply"]
const STAT_TARGETS = [
  "sorcery",
  "perception",
  "attunement",
  "might",
  "fortitude",
  "intimidation",
  "agility",
  "acumen",
  "eloquence",
  "carry_weight",
]
const REST_TARGETS = ["essence", "power", "will", "health"]
const CRITICAL_TARGETS = ["attack", "defense", "skill_check"]
const DISCOUNT_TARGETS = ["spell", "attack", "defense"]

const ACTION_TYPE_HINTS: Record<ActionType, string> = {
  stat_modifier:      "Adds or multiplies a character stat. Target = stat name (e.g. might, sorcery). Math = add stacks linearly, multiply stacks multiplicatively.",
  weight_negation:    "Sets the effective carry weight of a specific item subtype to 0. Enter the subtype string (e.g. 'sword', 'bow').",
  grant_spell:        "Grants the character access to a specific spell. Used with the 'one_time' trait.",
  grant_item:         "Grants the character a specific item. Used with the 'one_time' trait.",
  grant_active_skill: "Grants the character a specific active skill. Used with the 'one_time' trait.",
  rest_modifier:      "Adds bonus pool recovery on rest. Target = pool (health/will/power/essence). Val = how much extra is restored.",
  pool_recharge:      "In-combat pool recovery — e.g. vampiric drain. Target = pool to refill. Val = amount regained per trigger.",
  critical:           "Enables critical hits for a roll context. Target = attack / defense / skill_check. Val = the die's max face (6 for d6, 10 for d10, 20 for d20). No extra modifier is applied — a crit just confirms the roll.",
  near_critical:      "Rolls that are exactly 1 below the die maximum are automatically promoted to the maximum. Target = attack / defense / skill_check. Val = the die's max face (must match the weapon's die size). Only applies to attack rolls with dice.",
  discount:           "Reduces cost or weight for a category. Target = spell / attack / defense. Subtype = specific kind (e.g. 'fire', 'sword') or 'all'. Val = integer amount to reduce. Silently ignored if the character has no matching properties.",
}

const TRAIT_HINT = "Determines how the engine processes this effect.\n• skeng: always-on stat/pool bonus\n• one_time: grants spells, items, or active skills\n• passive: reminder text only — no stat change\n• partial_narrative: GM/player approval required before applying\n• pure_narrative / none: informational only"
const TRIGGER_HINT = "When this effect fires.\n• activated: player explicitly triggers it (costs pool)\n• passive: always active in the background\n• reactive: fires automatically in response to a game event"
const ROLL_CONTEXT_HINT = "Which action phase surfaces this reminder to the player.\n• any: always shown\n• attack: shown only when the player clicks Attack\n• defense: shown only when the player clicks Defend\n• skill_check: reserved for future skill-check flows\n\nOnly relevant for partial_narrative effects."
const COST_HINT = "Pool and amount spent each time this effect is activated. Only applies to 'activated' triggers."
const PROMPT_HINT = "Question shown to the player or GM before applying conditional modifiers. Used with the 'partial_narrative' trait."
const REMINDER_HINT = "Always-visible description on the character sheet. Describes what the effect does in plain terms."
const MATH_HINT = "add: values stack linearly (+3 and +5 = +8 total).\nmultiply: values stack multiplicatively (×1.3 and ×1.5 = ×1.95 total)."
const VAL_HINT = "Base value at rank 1. For non-scaling effects this is the only value used."
const PER_RANK_ADD_HINT = "Added to Val for each rank above 1. At rank 3 with Val=2 and +/rank=1: 2 + 1×(3–1) = 4. Leave blank for no linear scaling."
const PER_RANK_MUL_HINT = "Multiplied by Val for each rank above 1. At rank 3 with Val=2 and ×/rank=0.5: 2 + 0.5×(3–1) = 3. Leave blank for no multiplicative scaling."
const EFFECT_ID_HINT = "Unique snake_case identifier for this effect (e.g. 'vampiric_drain_01'). Must be unique within the entity. Used for deduplication and GM references."

// ---------------------------------------------------------------------------
// Tip — inline hover tooltip
// ---------------------------------------------------------------------------

function Tip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center ml-1 align-middle">
      <Info className="w-3 h-3 text-muted-foreground/40 hover:text-muted-foreground/70 cursor-help transition-colors" />
      <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-card border border-border text-[10px] text-muted-foreground leading-relaxed px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[300] font-sans normal-case tracking-normal whitespace-pre-line shadow-xl">
        {text}
      </span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Internal editing types
// ---------------------------------------------------------------------------

interface CatalogItem {
  id: string
  name: string
}

interface EditingAction {
  type: ActionType | ""
  target: string
  math: MathOp
  Value: string
  per_rank_add: string
  per_rank_multiply: string
  target_value: string
}

interface EditingEffect {
  effect_id: string
  trait: EffectTrait | ""
  trigger: EffectTrigger | ""
  roll_context: EffectRollContext
  costEnabled: boolean
  costPool: ResourcePool | ""
  costValue: string
  displayEnabled: boolean
  displayPromptText: string
  displayReminderText: string
  actions: EditingAction[]
}

// ---------------------------------------------------------------------------
// Converters
// ---------------------------------------------------------------------------

function blankAction(): EditingAction {
  return { type: "", target: "", math: "add", Value: "0", per_rank_add: "", per_rank_multiply: "", target_value: "" }
}

function blankEffect(): EditingEffect {
  return {
    effect_id: "",
    trait: "",
    trigger: "",
    roll_context: "any",
    costEnabled: false,
    costPool: "",
    costValue: "1",
    displayEnabled: false,
    displayPromptText: "",
    displayReminderText: "",
    actions: [blankAction()],
  }
}

function effectToEditing(e: Effect): EditingEffect {
  return {
    effect_id: e.effect_id,
    trait: e.trait,
    trigger: e.trigger,
    roll_context: e.roll_context ?? "any",
    costEnabled: e.cost !== null,
    costPool: e.cost?.pool ?? "",
    costValue: String(e.cost?.value ?? 1),
    displayEnabled: e.display !== null,
    displayPromptText: e.display?.prompt_text ?? "",
    displayReminderText: e.display?.reminder_text ?? "",
    actions:
      e.actions.length > 0
        ? e.actions.map((a) => ({
            type: a.type,
            target: a.target,
            math: a.math,
            Value: String(a.Value),
            per_rank_add: a.per_rank_add !== null ? String(a.per_rank_add) : "",
            per_rank_multiply: a.per_rank_multiply !== null ? String(a.per_rank_multiply) : "",
            target_value: a.target_value ?? "",
          }))
        : [blankAction()],
  }
}

function editingToEffect(e: EditingEffect): Effect | null {
  if (!e.effect_id || !e.trait || !e.trigger) return null
  return {
    effect_id: e.effect_id,
    trait: e.trait as EffectTrait,
    trigger: e.trigger as EffectTrigger,
    roll_context: e.roll_context,
    cost:
      e.costEnabled && e.costPool
        ? { pool: e.costPool as ResourcePool, value: Math.max(1, parseInt(e.costValue) || 1) }
        : null,
    display: e.displayEnabled
      ? { prompt_text: e.displayPromptText, reminder_text: e.displayReminderText }
      : null,
    actions: e.actions
      .filter((a) => a.type)
      .map((a) => ({
        type: a.type as ActionType,
        target: a.type === "weight_negation" ? "item_sub-type" : a.target,
        math: a.math,
        Value: parseFloat(a.Value) || 0,
        per_rank_add: a.per_rank_add !== "" ? parseFloat(a.per_rank_add) : null,
        per_rank_multiply: a.per_rank_multiply !== "" ? parseFloat(a.per_rank_multiply) : null,
        target_value: (a.type === "weight_negation" || a.type === "discount") ? (a.target_value || null) : null,
      })),
  }
}

// ---------------------------------------------------------------------------
// Picker sub-modal
// ---------------------------------------------------------------------------

function PickerModal({
  title,
  catalog,
  selectedIds,
  maxSelectable,
  onConfirm,
  onClose,
}: {
  title: string
  catalog: CatalogItem[]
  selectedIds: string[]
  maxSelectable: number
  onConfirm: (ids: string[]) => void
  onClose: () => void
}) {
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set(selectedIds))
  const [query, setQuery] = useState("")

  const filtered = catalog.filter(
    (item) => !query || item.name.toLowerCase().includes(query.toLowerCase())
  )

  const toggle = (id: string) => {
    setLocalSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < maxSelectable) {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="border border-border bg-card w-full max-w-md max-h-[70vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="font-serif text-lg text-foreground">{title}</h4>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="px-4 py-3 border-b border-border space-y-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            autoFocus
            className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            {localSelected.size} / {maxSelectable} selected
          </p>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground italic p-4 font-serif">No results.</p>
          ) : (
            filtered.map((item) => {
              const checked = localSelected.has(item.id)
              const disabled = !checked && localSelected.size >= maxSelectable
              return (
                <label
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-secondary/50 ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(item.id)}
                    className="w-4 h-4 accent-cyan-500"
                  />
                  <span className="font-serif text-sm text-foreground">{item.name}</span>
                </label>
              )
            })
          )}
        </div>
        <div className="px-4 py-3 border-t border-border flex gap-2 justify-end">
          <Button
            onClick={() => onConfirm(Array.from(localSelected))}
            className="bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
          >
            Confirm
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-border text-foreground hover:bg-secondary uppercase tracking-widest text-xs"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Action target input (for non-one_time traits)
// ---------------------------------------------------------------------------

function ActionTargetInput({
  action,
  actionIdx,
  spellsCatalog,
  itemsCatalog,
  activeSkillsCatalog,
  onChange,
}: {
  action: EditingAction
  actionIdx: number
  spellsCatalog: CatalogItem[]
  itemsCatalog: CatalogItem[]
  activeSkillsCatalog: CatalogItem[]
  onChange: (idx: number, updates: Partial<EditingAction>) => void
}) {
  const selectCls = "flex-1 bg-secondary border border-border text-foreground text-xs px-2 py-1.5"
  const inputCls = "flex-1 bg-secondary border border-border text-foreground text-xs px-2 py-1.5 placeholder:text-muted-foreground"

  switch (action.type) {
    case "stat_modifier":
      return (
        <select value={action.target} onChange={(e) => onChange(actionIdx, { target: e.target.value })} className={selectCls}>
          <option value="">Target...</option>
          {STAT_TARGETS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      )
    case "rest_modifier":
      return (
        <select value={action.target} onChange={(e) => onChange(actionIdx, { target: e.target.value })} className={selectCls}>
          <option value="">Pool...</option>
          {REST_TARGETS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      )
    case "weight_negation":
      return (
        <input
          type="text"
          value={action.target_value}
          onChange={(e) => onChange(actionIdx, { target_value: e.target.value, target: "item_sub-type" })}
          placeholder="sub-type name (e.g. sword)"
          className={inputCls}
        />
      )
    case "grant_spell":
      return (
        <select value={action.target} onChange={(e) => onChange(actionIdx, { target: e.target.value })} className={selectCls}>
          <option value="">Spell...</option>
          {spellsCatalog.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )
    case "grant_item":
      return (
        <select value={action.target} onChange={(e) => onChange(actionIdx, { target: e.target.value })} className={selectCls}>
          <option value="">Item...</option>
          {itemsCatalog.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
      )
    case "grant_active_skill":
      return (
        <select value={action.target} onChange={(e) => onChange(actionIdx, { target: e.target.value })} className={selectCls}>
          <option value="">Active Skill...</option>
          {activeSkillsCatalog.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )
    case "pool_recharge":
      return (
        <select value={action.target} onChange={(e) => onChange(actionIdx, { target: e.target.value })} className={selectCls}>
          <option value="">Pool...</option>
          {REST_TARGETS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      )
    case "critical":
    case "near_critical":
      return (
        <select value={action.target} onChange={(e) => onChange(actionIdx, { target: e.target.value })} className={selectCls}>
          <option value="">Roll type...</option>
          {CRITICAL_TARGETS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      )
    case "discount":
      return (
        <div className="flex gap-2 flex-1">
          <select value={action.target} onChange={(e) => onChange(actionIdx, { target: e.target.value })} className={selectCls}>
            <option value="">Applies to...</option>
            {DISCOUNT_TARGETS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="text"
            value={action.target_value}
            onChange={(e) => onChange(actionIdx, { target_value: e.target.value })}
            placeholder='subtype or "all"'
            className={inputCls}
          />
        </div>
      )
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export interface EffectEditorModalProps {
  isOpen: boolean
  effects: Effect[]
  onSave: (effects: Effect[]) => void
  onClose: () => void
}

export function EffectEditorModal({ isOpen, effects, onSave, onClose }: EffectEditorModalProps) {
  const [editingEffects, setEditingEffects] = useState<EditingEffect[]>([blankEffect()])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [pickerOpen, setPickerOpen] = useState<"active_skills" | "spells" | "items" | null>(null)
  const [spellsCatalog, setSpellsCatalog] = useState<CatalogItem[]>([])
  const [itemsCatalog, setItemsCatalog] = useState<CatalogItem[]>([])
  const [activeSkillsCatalog, setActiveSkillsCatalog] = useState<CatalogItem[]>([])

  useEffect(() => {
    if (!isOpen) return
    setEditingEffects(effects.length > 0 ? effects.map(effectToEditing) : [blankEffect()])
    setCurrentIdx(0)

    const supabase = createClient()
    Promise.all([
      supabase.from("spells").select("id, name").order("name"),
      supabase.from("items").select("id, name").order("name"),
      getActiveSkillsCatalog(supabase),
    ]).then(([spellsRes, itemsRes, activeSkills]) => {
      setSpellsCatalog((spellsRes.data ?? []).map((s) => ({ id: String(s.id), name: s.name as string })))
      setItemsCatalog((itemsRes.data ?? []).map((i) => ({ id: i.id as string, name: i.name as string })))
      setActiveSkillsCatalog(activeSkills)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  const current = editingEffects[currentIdx] ?? blankEffect()
  const isOneTime = current.trait === "one_time"
  const grantActions = current.actions.filter((a) =>
    ["grant_spell", "grant_item", "grant_active_skill"].includes(a.type)
  )

  // ---------------------------------------------------------------------------
  // State mutators
  // ---------------------------------------------------------------------------

  const updateCurrent = (updates: Partial<EditingEffect>) => {
    setEditingEffects((prev) => prev.map((e, i) => (i === currentIdx ? { ...e, ...updates } : e)))
  }

  const updateAction = (idx: number, updates: Partial<EditingAction>) => {
    const newActions = current.actions.map((a, i) => (i === idx ? { ...a, ...updates } : a))
    updateCurrent({ actions: newActions })
  }

  const addEffect = () => {
    const next = [...editingEffects, blankEffect()]
    setEditingEffects(next)
    setCurrentIdx(next.length - 1)
  }

  const removeEffect = () => {
    if (editingEffects.length <= 1) return
    const next = editingEffects.filter((_, i) => i !== currentIdx)
    setEditingEffects(next)
    setCurrentIdx(Math.min(currentIdx, next.length - 1))
  }

  const addAction = () => updateCurrent({ actions: [...current.actions, blankAction()] })

  const removeAction = (idx: number) => {
    if (current.actions.length <= 1) return
    updateCurrent({ actions: current.actions.filter((_, i) => i !== idx) })
  }

  // ---------------------------------------------------------------------------
  // One-time picker
  // ---------------------------------------------------------------------------

  const pickerGrantType = (): "grant_spell" | "grant_item" | "grant_active_skill" =>
    pickerOpen === "active_skills" ? "grant_active_skill" : pickerOpen === "spells" ? "grant_spell" : "grant_item"

  const pickerCurrentIds = (): string[] => {
    const type = pickerGrantType()
    return current.actions.filter((a) => a.type === type).map((a) => a.target)
  }

  const pickerMaxSelectable = (): number => {
    const type = pickerGrantType()
    const otherGrantCount = grantActions.filter((a) => a.type !== type).length
    return Math.max(0, 5 - otherGrantCount)
  }

  const handlePickerConfirm = (ids: string[]) => {
    const type = pickerGrantType()
    const otherActions = current.actions.filter((a) => a.type !== type)
    const newGrants: EditingAction[] = ids.map((id) => ({
      type,
      target: id,
      math: "add" as MathOp,
      Value: "1",
      per_rank_add: "",
      per_rank_multiply: "",
      target_value: "",
    }))
    updateCurrent({ actions: [...otherActions, ...newGrants] })
    setPickerOpen(null)
  }

  const removeGrant = (grantIdx: number) => {
    const actual = current.actions.indexOf(grantActions[grantIdx])
    updateCurrent({ actions: current.actions.filter((_, i) => i !== actual) })
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = () => {
    const valid = editingEffects.map(editingToEffect).filter(Boolean) as Effect[]
    onSave(valid)
    onClose()
  }

  // ---------------------------------------------------------------------------
  // Catalog lookup helpers
  // ---------------------------------------------------------------------------

  const lookupName = (type: string, id: string): string => {
    if (type === "grant_active_skill") return activeSkillsCatalog.find((s) => s.id === id)?.name ?? id
    if (type === "grant_spell") return spellsCatalog.find((s) => s.id === id)?.name ?? id
    return itemsCatalog.find((s) => s.id === id)?.name ?? id
  }

  const grantTypeLabel = (type: string) =>
    type === "grant_active_skill" ? "A.Skill" : type === "grant_spell" ? "Spell" : "Item"

  const needsValueRow = (type: ActionType | "") =>
    type === "stat_modifier" || type === "rest_modifier" || type === "pool_recharge" || type === "critical" || type === "near_critical" || type === "discount"

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-background/80 backdrop-blur-md">
        <div className="relative w-full max-w-3xl max-h-[90vh] border border-border bg-card shadow-2xl flex flex-col">
          {/* Header */}
          <div className="sticky top-0 z-10 flex justify-between items-center px-6 py-4 bg-card/95 backdrop-blur-sm border-b border-border">
            <div>
              <h2 className="font-serif text-2xl text-foreground">Effect Editor</h2>
              <p className="text-xs uppercase tracking-widest text-cyan-500 font-bold">
                {editingEffects.length} Effect{editingEffects.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Effect navigation tabs */}
          <div className="flex items-center gap-2 px-6 py-2.5 border-b border-border bg-secondary/20 overflow-x-auto">
            {editingEffects.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIdx(i)}
                className={`px-3 py-1 text-xs uppercase tracking-widest shrink-0 transition-colors ${
                  i === currentIdx
                    ? "bg-foreground text-background"
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                Effect {i + 1}
              </button>
            ))}
            <button
              onClick={addEffect}
              className="px-3 py-1 text-xs uppercase tracking-widest border border-cyan-800 text-cyan-500 hover:border-cyan-500 transition-colors shrink-0"
            >
              <Plus className="w-3 h-3 inline mr-1" />Add
            </button>
            {editingEffects.length > 1 && (
              <button
                onClick={removeEffect}
                className="px-3 py-1 text-xs uppercase tracking-widest border border-red-900 text-red-400 hover:border-red-500 transition-colors shrink-0"
              >
                <Trash2 className="w-3 h-3 inline mr-1" />Remove
              </button>
            )}
            <button
              onClick={() => setEditingEffects((prev) => prev.map((e, i) => (i === currentIdx ? blankEffect() : e)))}
              className="ml-auto px-3 py-1 text-xs uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <RotateCcw className="w-3 h-3 inline mr-1" />Reset
            </button>
          </div>

          {/* Effect form */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Basic fields */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center mb-1.5">Effect ID<Tip text={EFFECT_ID_HINT} /></label>
                <input
                  type="text"
                  value={current.effect_id}
                  onChange={(e) => updateCurrent({ effect_id: e.target.value })}
                  placeholder="snake_case_name_01"
                  className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center mb-1.5">Trait<Tip text={TRAIT_HINT} /></label>
                <select
                  value={current.trait}
                  onChange={(e) => updateCurrent({ trait: e.target.value as EffectTrait })}
                  className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2"
                >
                  <option value="">Select trait...</option>
                  {TRAITS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center mb-1.5">Trigger<Tip text={TRIGGER_HINT} /></label>
                <select
                  value={current.trigger}
                  onChange={(e) => updateCurrent({ trigger: e.target.value as EffectTrigger })}
                  className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2"
                >
                  <option value="">Select trigger...</option>
                  {TRIGGERS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Roll Context — only meaningful for partial_narrative */}
            {current.trait === "partial_narrative" && (
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center mb-1.5">Roll Context<Tip text={ROLL_CONTEXT_HINT} /></label>
                  <select
                    value={current.roll_context}
                    onChange={(e) => updateCurrent({ roll_context: e.target.value as EffectRollContext })}
                    className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2"
                  >
                    {ROLL_CONTEXTS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Cost */}
            <div className="border border-border p-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={current.costEnabled}
                  onChange={(e) => updateCurrent({ costEnabled: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500"
                />
                <span className="text-xs uppercase tracking-widest text-muted-foreground flex items-center">Has Cost<Tip text={COST_HINT} /></span>
              </label>
              {current.costEnabled && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">Pool</label>
                    <select
                      value={current.costPool}
                      onChange={(e) => updateCurrent({ costPool: e.target.value as ResourcePool })}
                      className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2"
                    >
                      <option value="">Pool...</option>
                      {POOLS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">Value</label>
                    <input
                      type="number"
                      min={1}
                      value={current.costValue}
                      onChange={(e) => {
                        const v = parseInt(e.target.value)
                        if (!isNaN(v) && v >= 1) updateCurrent({ costValue: String(v) })
                      }}
                      className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Display */}
            <div className="border border-border p-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={current.displayEnabled}
                  onChange={(e) => updateCurrent({ displayEnabled: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500"
                />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Has Display Text</span>
              </label>
              {current.displayEnabled && (
                <>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center mb-1">Prompt Text<Tip text={PROMPT_HINT} /></label>
                    <textarea
                      value={current.displayPromptText}
                      onChange={(e) => updateCurrent({ displayPromptText: e.target.value })}
                      placeholder="Question shown to player/GM before applying modifiers"
                      rows={2}
                      className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted-foreground flex items-center mb-1">Reminder Text<Tip text={REMINDER_HINT} /></label>
                    <textarea
                      value={current.displayReminderText}
                      onChange={(e) => updateCurrent({ displayReminderText: e.target.value })}
                      placeholder="Static description of what this effect does"
                      rows={2}
                      className="w-full bg-secondary border border-border text-foreground text-sm px-3 py-2 placeholder:text-muted-foreground resize-none"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="border border-border p-4 space-y-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Actions</p>

              {isOneTime ? (
                /* One-time grant UI */
                <div className="space-y-4">
                  <div className="space-y-2">
                    {grantActions.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic font-serif">No grants added yet.</p>
                    ) : (
                      grantActions.map((action, i) => (
                        <div key={i} className="flex items-center gap-2 border border-border bg-secondary/30 px-3 py-2">
                          <span className="text-[10px] uppercase tracking-widest text-cyan-500 border border-cyan-800/60 px-1.5 py-0.5 shrink-0">
                            {grantTypeLabel(action.type)}
                          </span>
                          <span className="font-serif text-sm text-foreground flex-1 truncate">
                            {lookupName(action.type, action.target)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeGrant(i)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400 shrink-0"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">
                      Add grants ({grantActions.length}/5):
                    </p>
                    <div className="flex gap-2">
                      {(
                        [
                          { key: "active_skills" as const, label: "A. Skills" },
                          { key: "spells" as const, label: "Spells" },
                          { key: "items" as const, label: "Items" },
                        ] as const
                      ).map(({ key, label }) => (
                        <Button
                          key={key}
                          variant="outline"
                          onClick={() => setPickerOpen(key)}
                          disabled={grantActions.length >= 5}
                          className="border-cyan-800 text-cyan-400 hover:border-cyan-500 hover:text-cyan-300 uppercase tracking-widest text-xs"
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Regular action list */
                <div className="space-y-3">
                  {current.actions.map((action, actionIdx) => (
                    <div key={actionIdx} className="border border-border/50 bg-secondary/10 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Action {actionIdx + 1}
                        </span>
                        {current.actions.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAction(actionIdx)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-2 items-center flex-wrap">
                        <select
                          value={action.type}
                          onChange={(e) =>
                            updateAction(actionIdx, {
                              type: e.target.value as ActionType,
                              target: "",
                              target_value: "",
                            })
                          }
                          className="bg-secondary border border-border text-foreground text-xs px-2 py-1.5"
                        >
                          <option value="">Type...</option>
                          {ACTION_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        {action.type && <Tip text={ACTION_TYPE_HINTS[action.type as ActionType]} />}
                        {action.type && (
                          <ActionTargetInput
                            action={action}
                            actionIdx={actionIdx}
                            spellsCatalog={spellsCatalog}
                            itemsCatalog={itemsCatalog}
                            activeSkillsCatalog={activeSkillsCatalog}
                            onChange={updateAction}
                          />
                        )}
                      </div>
                      {needsValueRow(action.type) && (
                        <div className="flex gap-2 items-center flex-wrap">
                          <div className="flex items-center gap-1">
                            <select
                              value={action.math}
                              onChange={(e) => updateAction(actionIdx, { math: e.target.value as MathOp })}
                              className="bg-secondary border border-border text-foreground text-xs px-2 py-1.5"
                            >
                              {MATH_OPS.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                            <Tip text={MATH_HINT} />
                          </div>
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-muted-foreground shrink-0">Val<Tip text={VAL_HINT} /></label>
                            <input
                              type="number"
                              value={action.Value}
                              onChange={(e) => updateAction(actionIdx, { Value: e.target.value })}
                              className="w-20 bg-secondary border border-border text-foreground text-xs px-2 py-1.5"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-muted-foreground shrink-0 flex items-center">+/rank<Tip text={PER_RANK_ADD_HINT} /></label>
                            <input
                              type="number"
                              value={action.per_rank_add}
                              placeholder="null"
                              onChange={(e) => updateAction(actionIdx, { per_rank_add: e.target.value })}
                              className="w-20 bg-secondary border border-border text-foreground text-xs px-2 py-1.5 placeholder:text-muted-foreground/50"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <label className="text-xs text-muted-foreground shrink-0 flex items-center">×/rank<Tip text={PER_RANK_MUL_HINT} /></label>
                            <input
                              type="number"
                              value={action.per_rank_multiply}
                              placeholder="null"
                              onChange={(e) => updateAction(actionIdx, { per_rank_multiply: e.target.value })}
                              className="w-20 bg-secondary border border-border text-foreground text-xs px-2 py-1.5 placeholder:text-muted-foreground/50"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={addAction}
                    className="border-border text-muted-foreground hover:text-foreground uppercase tracking-widest text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />Add Action
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 border-t border-border p-4 bg-card/95 flex gap-2 justify-end">
            <Button
              onClick={handleSave}
              className="bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
            >
              Save Effects
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="border-border text-foreground hover:bg-secondary uppercase tracking-widest text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Picker sub-modal */}
      {pickerOpen && (
        <PickerModal
          title={
            pickerOpen === "active_skills"
              ? "Select Active Skills"
              : pickerOpen === "spells"
              ? "Select Spells"
              : "Select Items"
          }
          catalog={
            pickerOpen === "active_skills"
              ? activeSkillsCatalog
              : pickerOpen === "spells"
              ? spellsCatalog
              : itemsCatalog
          }
          selectedIds={pickerCurrentIds()}
          maxSelectable={pickerMaxSelectable()}
          onConfirm={handlePickerConfirm}
          onClose={() => setPickerOpen(null)}
        />
      )}
    </>
  )
}
