"use client";

import { useState, useEffect, useRef } from "react";
import { X, Info, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Spell } from "@/components/types/types";

interface CreateSpellModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (spell: Omit<Spell, "id">) => void;
}

const SPELL_TYPES = ["attack", "defense", "healing", "buff", "debuff", "utility", "ritual", "other"] as const;
const ATTRIBUTES = ["power", "will", "essence", "health"] as const;

type ItemOption = { id: string; name: string; type?: string | null };
type SkillOption = { id: string; name: string };

// ── Inline searchable picker ──────────────────────────────────────────────────
function SearchPicker<T extends { id: string; name: string }>({
  options,
  value,
  onChange,
  placeholder,
  secondaryKey,
}: {
  options: T[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder: string;
  secondaryKey?: keyof T;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.id === value) ?? null;
  const filtered = options
    .filter(o => o.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 12);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center justify-between px-3 py-2 bg-background border border-border text-sm">
        <span className="text-foreground font-serif">{selected.name}</span>
        <button
          type="button"
          onClick={() => { onChange(null); setSearch(""); }}
          className="text-muted-foreground hover:text-foreground ml-2 shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          className="w-full bg-background border border-border pl-8 pr-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/50 placeholder:text-muted-foreground/50"
          placeholder={placeholder}
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && search && filtered.length === 0 && (
        <div className="absolute z-20 w-full mt-px border border-border bg-card shadow-lg px-3 py-2">
          <span className="text-xs text-muted-foreground italic">No matches found.</span>
        </div>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-20 w-full mt-px border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { onChange(opt.id); setSearch(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/30 transition-colors flex items-center justify-between gap-2"
            >
              <span className="text-foreground font-serif">{opt.name}</span>
              {secondaryKey && opt[secondaryKey] != null && (
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
                  {String(opt[secondaryKey])}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

type FormState = Omit<Spell, "id">;

const empty: FormState = {
  name: null,
  type: null,
  subtype: null,
  damage: null,
  defence: null,
  modifier: null,
  coefficient: null,
  cost: null,
  cast_time_min: null,
  remain_time_min: null,
  aoe_m: null,
  range_m: null,
  active: true,
  cooldown_min: null,
  req_item_1: null,
  req_item_2: null,
  req_item_3: null,
  req_skill_1: null,
  req_skill_2: null,
  cost_attribute_name: null,
  modifier_attribute_name: null,
  coefficient_attribute_name: null,
  description: null,
};

export function CreateSpellModal({ isOpen, onClose, onSubmit }: CreateSpellModalProps) {
  const [form, setForm] = useState<FormState>(empty);
  const [dealsDamage, setDealsDamage] = useState(false);
  const [providesDefence, setProvidesDefence] = useState(false);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [skills, setSkills] = useState<SkillOption[]>([]);

  // Fetch item and skill catalogs once on open
  useEffect(() => {
    if (!isOpen) return;
    const supabase = createClient();

    supabase
      .from("items")
      .select("id, name, type")
      .order("name")
      .then(({ data }) => { if (data) setItems(data as ItemOption[]); });

    supabase
      .from("skills")
      .select("id, name")
      .order("name")
      .then(({ data }) => { if (data) setSkills(data as SkillOption[]); });
  }, [isOpen]);

  if (!isOpen) return null;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
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
      damage: dealsDamage ? form.damage : null,
      defence: providesDefence ? form.defence : null,
    });
    handleClose();
  }

  const inputClass =
    "w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/50 placeholder:text-muted-foreground/50";
  const labelClass = "text-[10px] uppercase tracking-widest text-muted-foreground";
  const numInput = (key: keyof FormState, placeholder: string, opts?: { min?: number; step?: number }) => (
    <input
      type="number"
      min={opts?.min ?? 0}
      step={opts?.step ?? 1}
      className={inputClass}
      placeholder={placeholder}
      value={(form[key] as number | null | undefined) ?? ""}
      onChange={e => set(key, (e.target.value ? parseInt(e.target.value) : null) as FormState[typeof key])}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border bg-card shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex justify-between items-center px-6 py-4 bg-card/95 backdrop-blur-sm border-b border-border">
          <div>
            <h2 className="font-serif text-2xl text-foreground">New Spell</h2>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Create Grimoire Entry</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose} className="text-muted-foreground hover:text-foreground">
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
                placeholder="e.g. Ember Lance"
                value={form.name ?? ""}
                onChange={e => set("name", e.target.value || null)}
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
                  {SPELL_TYPES.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Subtype</label>
                <input
                  className={inputClass}
                  placeholder="e.g. Fire, Curse, Ward"
                  value={form.subtype ?? ""}
                  onChange={e => set("subtype", e.target.value || null)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-cyan-500"
                  checked={!!form.active}
                  onChange={e => set("active", e.target.checked)}
                />
                <span className="text-xs text-muted-foreground uppercase tracking-widest">Active Spell</span>
              </label>
              <span className="text-[10px] text-muted-foreground italic">
                (uncheck for passive spells that trigger automatically)
              </span>
            </div>
          </section>

          {/* ── DESCRIPTION ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Description</h3>
            <div className="space-y-1">
              <textarea
                className={`${inputClass} resize-none`}
                rows={4}
                placeholder="Full description, lore, or effect text."
                value={form.description ?? ""}
                onChange={e => set("description", e.target.value || null)}
              />
            </div>
          </section>

          {/* ── TIMING ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Timing</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Cast Time (min)</label>
                {numInput("cast_time_min", "e.g. 1")}
                <p className="text-[10px] text-muted-foreground italic">Minutes to cast.</p>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Duration (min)</label>
                {numInput("remain_time_min", "e.g. 10")}
                <p className="text-[10px] text-muted-foreground italic">How long the effect lasts.</p>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Cooldown (min)</label>
                {numInput("cooldown_min", "e.g. 60")}
                <p className="text-[10px] text-muted-foreground italic">Wait before re-casting.</p>
              </div>
            </div>
          </section>

          {/* ── RANGE & AREA ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Range & Area</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Range (m)</label>
                {numInput("range_m", "e.g. 30")}
                <p className="text-[10px] text-muted-foreground italic">Maximum distance to target.</p>
              </div>
              <div className="space-y-1">
                <label className={labelClass}>AoE Radius (m)</label>
                {numInput("aoe_m", "e.g. 5")}
                <p className="text-[10px] text-muted-foreground italic">Radius of area effect. Leave blank for single-target.</p>
              </div>
            </div>
          </section>

          {/* ── COMBAT ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Combat</h3>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-cyan-500"
                checked={dealsDamage}
                onChange={e => setDealsDamage(e.target.checked)}
              />
              <span className="text-xs text-muted-foreground uppercase tracking-widest">This spell deals damage</span>
            </label>

            {dealsDamage && (
              <div className="pl-3 border-l-2 border-border space-y-1">
                <label className={labelClass}>Damage</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  placeholder="e.g. 8"
                  value={form.damage ?? ""}
                  onChange={e => set("damage", e.target.value ? parseInt(e.target.value) : null)}
                />
                <p className="text-[10px] text-muted-foreground italic">Base damage before modifiers and coefficient are applied.</p>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-cyan-500"
                checked={providesDefence}
                onChange={e => setProvidesDefence(e.target.checked)}
              />
              <span className="text-xs text-muted-foreground uppercase tracking-widest">This spell provides defence</span>
            </label>

            {providesDefence && (
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
                <p className="text-[10px] text-muted-foreground italic">Damage reduction granted while this spell is active.</p>
              </div>
            )}
          </section>

          {/* ── COST & ECONOMY ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Cost</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Cost (amount)</label>
                {numInput("cost", "e.g. 10")}
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
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground italic">The stat depleted from the caster when this spell is cast.</p>
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
                When the spell resolves, the engine computes:{" "}
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
                  step="1"
                  className={inputClass}
                  placeholder="e.g. 5 or -2"
                  value={form.modifier ?? ""}
                  onChange={e => set("modifier", e.target.value ? parseInt(e.target.value) : null)}
                />
                <p className="text-[10px] text-muted-foreground italic">Flat value added after scaling.</p>
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
                  step="1"
                  className={inputClass}
                  placeholder="e.g. 2"
                  value={form.coefficient ?? ""}
                  onChange={e => set("coefficient", e.target.value ? parseInt(e.target.value) : null)}
                />
                <p className="text-[10px] text-muted-foreground italic">Multiplier applied to the chosen attribute.</p>
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

          {/* ── REQUIREMENTS ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Requirements</h3>
            <p className="text-xs text-muted-foreground italic">
              Items and skills the caster must have to use this spell. Search by name below.
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className={labelClass}>Required Item 1</label>
                <SearchPicker<ItemOption>
                  options={items}
                  value={form.req_item_1 ?? null}
                  onChange={id => set("req_item_1", id)}
                  placeholder="Search items…"
                  secondaryKey="type"
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Required Item 2</label>
                <SearchPicker<ItemOption>
                  options={items}
                  value={form.req_item_2 ?? null}
                  onChange={id => set("req_item_2", id)}
                  placeholder="Search items…"
                  secondaryKey="type"
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Required Item 3</label>
                <SearchPicker<ItemOption>
                  options={items}
                  value={form.req_item_3 ?? null}
                  onChange={id => set("req_item_3", id)}
                  placeholder="Search items…"
                  secondaryKey="type"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className={labelClass}>Required Skill 1</label>
                <SearchPicker<SkillOption>
                  options={skills}
                  value={form.req_skill_1 ?? null}
                  onChange={id => set("req_skill_1", id)}
                  placeholder="Search skills…"
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Required Skill 2</label>
                <SearchPicker<SkillOption>
                  options={skills}
                  value={form.req_skill_2 ?? null}
                  onChange={id => set("req_skill_2", id)}
                  placeholder="Search skills…"
                />
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
            disabled={!form.name?.trim()}
            className="uppercase tracking-widest text-xs bg-foreground text-background hover:bg-foreground/90"
          >
            Create Spell
          </Button>
        </div>
      </div>

      {/* Click-outside overlay */}
      <div className="absolute inset-0 -z-10" onClick={handleClose} />
    </div>
  );
}
