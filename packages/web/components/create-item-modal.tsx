"use client";

import { useState } from "react";
import { X, Info, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Item } from "@/components/types/types";

interface CreateItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (item: Omit<Item, "id">) => void;
  /** UUID of the skill required to use this item. Hidden from the form — pass programmatically. */
  requiredSkillId?: string;
}

const RARITIES = ["common", "uncommon", "rare", "extremely rare", "mythical"] as const;
const ITEM_TYPES = ["weapon", "armor", "gear", "tool", "accessory", "consumable", "other"] as const;
const ATTRIBUTES = ["power", "will", "essence", "health"] as const;

const RARITY_COLORS: Record<string, string> = {
  common: "text-muted-foreground border-muted-foreground",
  uncommon: "text-green-500 border-green-500",
  rare: "text-blue-400 border-blue-400",
  "extremely rare": "text-purple-400 border-purple-400",
  mythical: "text-amber-400 border-amber-400",
};

const TYPE_HINTS: Record<string, string> = {
  weapon: "Deals damage in combat. Damage fields are enabled below.",
  armor: "Worn for protection. Defence field is enabled below.",
  gear: "Adventuring equipment — ropes, torches, tools.",
  tool: "A specialized instrument with a specific function.",
  accessory: "Rings, amulets, cloaks — worn for passive effects.",
  consumable: "Single-use items destroyed upon activation.",
  other: "Doesn't fit another category.",
};

type FormState = Omit<Item, "id" | "required_skill">;

const empty: FormState = {
  name: "",
  type: "",
  subtype: "",
  rarity: null,
  short_description: null,
  long_description: null,
  action_text: null,
  cost_gold: null,
  weight: null,
  is_magical: false,
  consumable: false,
  default_condition: null,
  damage: null,
  defence: null,
  die_count: null,
  cost: null,
  cost_attribute_name: null,
  modifier: null,
  modifier_attribute_name: null,
  coefficient: null,
  coefficient_attribute_name: null,
  image_url: null,
  hidden: null,
  strong_cost: null,
  strong_defence: null,
  strong_damage: null
};

export function CreateItemModal({ isOpen, onClose, onSubmit, requiredSkillId }: CreateItemModalProps) {
  const [form, setForm] = useState<FormState>(empty);
  const [dealsDamage, setDealsDamage] = useState(false);
  const [providesDefence, setProvidesDefence] = useState(false);

  if (!isOpen) return null;

  const isWeapon = form.type === "weapon";
  const isArmor = form.type === "armor";
  const showDamage = isWeapon || dealsDamage;
  const showDefence = isArmor || providesDefence;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleTypeChange(type: string) {
    set("type", type || null);
    if (type === "weapon") setDealsDamage(false);
    if (type === "armor") setProvidesDefence(false);
  }

  function handleClose() {
    setForm(empty);
    setDealsDamage(false);
    setProvidesDefence(false);
    onClose();
  }

  function handleSubmit() {
    onSubmit({
      ...form,
      required_skill: requiredSkillId ?? null,
      damage: showDamage ? form.damage : null,
      die_count: showDamage ? form.die_count : null,
      defence: showDefence ? form.defence : null,
    });
    handleClose();
  }

  const inputClass =
    "w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/50 placeholder:text-muted-foreground/50";
  const labelClass = "text-[10px] uppercase tracking-widest text-muted-foreground";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border bg-card shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex justify-between items-center px-6 py-4 bg-card/95 backdrop-blur-sm border-b border-border">
          <div>
            <h2 className="font-serif text-2xl text-foreground">New Item</h2>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Create Inventory Record</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground"
          >
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
                placeholder="e.g. Iron Longsword"
                value={form.name}
                onChange={e => set("name", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Type</label>
                <select
                  className={inputClass}
                  value={form.type ?? ""}
                  onChange={e => handleTypeChange(e.target.value)}
                >
                  <option value="">— Select Type —</option>
                  {ITEM_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t === "weapon" ? "Weapon" : t === "armor" ? "Armor" : t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
                {form.type && (
                  <p className="text-[10px] text-muted-foreground italic">{TYPE_HINTS[form.type]}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Subtype</label>
                <input
                  className={inputClass}
                  placeholder={
                    isWeapon ? "e.g. Sword, Axe, Bow"
                    : isArmor ? "e.g. Plate, Chain, Leather"
                    : "e.g. Potion, Key, Scroll"
                  }
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
                placeholder="A brief identifier shown in lists and on hover."
                value={form.short_description ?? ""}
                onChange={e => set("short_description", e.target.value || null)}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Long Description / Lore</label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder="Full history, lore, or detailed description."
                value={form.long_description ?? ""}
                onChange={e => set("long_description", e.target.value || null)}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Action Text</label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={2}
                placeholder='e.g. "You swing the blade with deadly precision."'
                value={form.action_text ?? ""}
                onChange={e => set("action_text", e.target.value || null)}
              />
              <p className="text-[10px] text-muted-foreground italic">Displayed to the player when this item's action triggers.</p>
            </div>
          </section>

          {/* ── IMAGE ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Image</h3>

            {/*
              TODO: Replace the URL input below with a file-upload button once a storage provider is set up.
              Suggested flow:
                1. User picks a file via <input type="file" />.
                2. Upload the file to your storage bucket (e.g. Supabase Storage "item-images", or S3/R2).
                3. Get back the public URL from the storage SDK.
                4. Call set("image_url", publicUrl) to persist it on the form.
              Until then, a direct-URL input is provided as a placeholder.
            */}
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
                  placeholder="https://… (file upload coming once storage is configured)"
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
                  type="number"
                  min="0"
                  step="0.1"
                  className={inputClass}
                  placeholder="0.0"
                  value={form.weight ?? ""}
                  onChange={e => set("weight", e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Default Condition</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  placeholder="e.g. 100"
                  value={form.default_condition ?? ""}
                  onChange={e => set("default_condition", e.target.value ? parseInt(e.target.value) : null)}
                />
                <p className="text-[10px] text-muted-foreground italic">Starting durability when first acquired.</p>
              </div>
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-cyan-500"
                  checked={!!form.is_magical}
                  onChange={e => set("is_magical", e.target.checked)}
                />
                <span className="text-xs text-muted-foreground uppercase tracking-widest">Magical</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-cyan-500"
                  checked={!!form.consumable}
                  onChange={e => set("consumable", e.target.checked)}
                />
                <span className="text-xs text-muted-foreground uppercase tracking-widest">Consumable</span>
                <span className="text-[10px] text-muted-foreground italic">(destroyed on use)</span>
              </label>
            </div>
          </section>

          {/* ── COMBAT ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Combat</h3>

            {/* Damage — always visible for weapons; opt-in for everything else */}
            {!isWeapon && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-cyan-500"
                  checked={dealsDamage}
                  onChange={e => setDealsDamage(e.target.checked)}
                />
                <span className="text-xs text-muted-foreground uppercase tracking-widest">This item deals damage</span>
              </label>
            )}

            {showDamage && (
              <div className="pl-3 border-l-2 border-border grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelClass}>Damage Die (sides)</label>
                  <input
                    type="number"
                    min="2"
                    step="1"
                    className={inputClass}
                    placeholder="e.g. 6 for a d6"
                    value={form.damage ?? ""}
                    onChange={e => {
                      const v = e.target.value;
                      set("damage", v ? String(Math.max(2, Math.floor(Math.abs(parseFloat(v))))) : null);
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground italic">Number of sides — 4, 6, 8, 10, 12, or 20.</p>
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Die Count</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className={inputClass}
                    placeholder="e.g. 2 for 2d6"
                    value={form.die_count ?? ""}
                    onChange={e => set("die_count", e.target.value ? parseInt(e.target.value) : null)}
                  />
                  <p className="text-[10px] text-muted-foreground italic">How many dice to roll each hit.</p>
                </div>
              </div>
            )}

            {/* Defence — always visible for armor; opt-in for everything else */}
            {!isArmor && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-cyan-500"
                  checked={providesDefence}
                  onChange={e => setProvidesDefence(e.target.checked)}
                />
                <span className="text-xs text-muted-foreground uppercase tracking-widest">This item provides defence</span>
              </label>
            )}

            {showDefence && (
              <div className="pl-3 border-l-2 border-border space-y-1">
                <label className={labelClass}>Defence Value</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  placeholder="e.g. 5"
                  value={form.defence ?? ""}
                  onChange={e => set("defence", e.target.value ? parseInt(e.target.value) : null)}
                />
                <p className="text-[10px] text-muted-foreground italic">Flat damage reduction while this item is equipped.</p>
              </div>
            )}
          </section>

          {/* ── COST & ECONOMY ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Cost & Economy</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Gold Cost</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  placeholder="0"
                  value={form.cost_gold ?? ""}
                  onChange={e => set("cost_gold", e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Attribute Cost</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  placeholder="0"
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
                {ATTRIBUTES.map(a => (
                  <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground italic">The character stat depleted when this item is activated.</p>
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
                When the item resolves, the engine computes:{" "}
                <span className="font-mono text-foreground/70">result = (attribute × coefficient) + modifier</span>.
                Use <strong className="text-foreground/60">coefficient</strong> to scale the effect with a stat,
                and <strong className="text-foreground/60">modifier</strong> for a flat bonus or penalty on top.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Modifier</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputClass}
                  placeholder="e.g. 5 or -2"
                  value={form.modifier ?? ""}
                  onChange={e => set("modifier", e.target.value ? parseFloat(e.target.value) : null)}
                />
                <p className="text-[10px] text-muted-foreground italic">Flat value added after the coefficient is applied.</p>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Modifier Attribute</label>
                <select
                  className={inputClass}
                  value={form.modifier_attribute_name ?? ""}
                  onChange={e => set("modifier_attribute_name", e.target.value || null)}
                >
                  <option value="">— None —</option>
                  {ATTRIBUTES.map(a => (
                    <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Coefficient</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputClass}
                  placeholder="e.g. 1.5"
                  value={form.coefficient ?? ""}
                  onChange={e => set("coefficient", e.target.value ? parseFloat(e.target.value) : null)}
                />
                <p className="text-[10px] text-muted-foreground italic">Multiplier applied to the chosen attribute before the modifier is added.</p>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Coefficient Attribute</label>
                <select
                  className={inputClass}
                  value={form.coefficient_attribute_name ?? ""}
                  onChange={e => set("coefficient_attribute_name", e.target.value || null)}
                >
                  <option value="">— None —</option>
                  {ATTRIBUTES.map(a => (
                    <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 px-6 py-4 bg-card/95 backdrop-blur-sm border-t border-border">
          <Button
            variant="ghost"
            onClick={handleClose}
            className="text-muted-foreground uppercase tracking-widest text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.name.trim()}
            className="uppercase tracking-widest text-xs bg-foreground text-background hover:bg-foreground/90"
          >
            Create Item
          </Button>
        </div>
      </div>

      {/* Click-outside overlay */}
      <div className="absolute inset-0 -z-10" onClick={handleClose} />
    </div>
  );
}
