"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createCreature } from "@/lib/services/encounter-service";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/components/types/supabase";

type Creature = Tables<"creatures">;
type CreatureInsert = Omit<Creature, "id" | "created_at">;

interface CreateCreatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (creature: Creature) => void;
  currentUserId: string;
}

const ATTRIBUTES = ["essence", "will", "power", "health"] as const;

const empty: CreatureInsert = {
  name: "",
  level: null,
  description: null,
  image_url: null,
  speed: null,
  armor_class: null,
  essence_max: null,
  power_max: null,
  will_max: null,
  health_max: null,
  current_essence: null,
  current_power: null,
  current_will: null,
  current_health: null,
  attack_damage: null,
  attack_cost: null,
  defence: null,
  defence_cost: null,
  strong_attack: null,
  strong_defence: null,
  strong_cost: null,
  attribute_cost_name: null,
  ascii_art: null,
  created_by: null,
};

export function CreateCreatureModal({ isOpen, onClose, onCreated, currentUserId }: CreateCreatureModalProps) {
  const [form, setForm] = useState<CreatureInsert>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function set<K extends keyof CreatureInsert>(key: K, value: CreatureInsert[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function numVal(raw: string): number | null {
    return raw === "" ? null : parseInt(raw, 10);
  }

  function handleClose() {
    setForm(empty);
    setError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const payload: CreatureInsert = {
      ...form,
      created_by: currentUserId,
      current_essence: form.essence_max,
      current_power: form.power_max,
      current_will: form.will_max,
      current_health: form.health_max,
    };

    const { data, error: err } = await createCreature(supabase, payload as Record<string, unknown>);

    setSaving(false);

    if (err) {
      setError(err.message);
      return;
    }

    onCreated(data as Creature);
    handleClose();
  }

  const inputClass =
    "w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/50 placeholder:text-muted-foreground/50";
  const labelClass = "text-[10px] uppercase tracking-widest text-muted-foreground";

  function numInput(key: keyof CreatureInsert, placeholder: string) {
    return (
      <input
        type="number"
        min={0}
        step={1}
        className={inputClass}
        placeholder={placeholder}
        value={(form[key] as number | null) ?? ""}
        onChange={e => set(key, numVal(e.target.value) as CreatureInsert[typeof key])}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border bg-card shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex justify-between items-center px-6 py-4 bg-card/95 backdrop-blur-sm border-b border-border">
          <div>
            <h2 className="font-serif text-2xl text-foreground">New Creature</h2>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Bestiary Entry</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-8">

          {/* ── IDENTITY ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Identity</h3>
            <div className="space-y-1">
              <label className={labelClass}>Name *</label>
              <input
                className={inputClass}
                placeholder="e.g. Dire Wolf"
                value={form.name}
                onChange={e => set("name", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Level</label>
                {numInput("level", "e.g. 3")}
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Image URL</label>
                <input
                  className={inputClass}
                  placeholder="https://…"
                  value={form.image_url ?? ""}
                  onChange={e => set("image_url", e.target.value || null)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Description</label>
              <textarea
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder="Lore, appearance, or behaviour."
                value={form.description ?? ""}
                onChange={e => set("description", e.target.value || null)}
              />
            </div>
          </section>

          {/* ── POOLS ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Pools (Max)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Essence Max</label>
                {numInput("essence_max", "e.g. 10")}
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Power Max</label>
                {numInput("power_max", "e.g. 10")}
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Will Max</label>
                {numInput("will_max", "e.g. 10")}
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Health Max</label>
                {numInput("health_max", "e.g. 10")}
              </div>
            </div>
          </section>

          {/* ── PHYSICAL ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Physical</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Speed</label>
                {numInput("speed", "e.g. 6")}
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Armor Class</label>
                {numInput("armor_class", "e.g. 12")}
              </div>
            </div>
          </section>

          {/* ── COMBAT ── */}
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Combat</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Attack Damage</label>
                {numInput("attack_damage", "e.g. 8")}
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Attack Cost</label>
                {numInput("attack_cost", "e.g. 2")}
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Defence</label>
                {numInput("defence", "e.g. 4")}
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Defence Cost</label>
                {numInput("defence_cost", "e.g. 1")}
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Cost Attribute</label>
              <select
                className={inputClass}
                value={form.attribute_cost_name ?? ""}
                onChange={e => set("attribute_cost_name", e.target.value || null)}
              >
                <option value="">— None —</option>
                {ATTRIBUTES.map(a => (
                  <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground italic">The pool spent when this creature attacks or defends.</p>
            </div>

            <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground pt-2">Strong Actions</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className={labelClass}>Strong Attack</label>
                {numInput("strong_attack", "e.g. 14")}
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Strong Defence</label>
                {numInput("strong_defence", "e.g. 7")}
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Strong Cost</label>
                {numInput("strong_cost", "e.g. 4")}
              </div>
            </div>
          </section>
        </div>

        {error && (
          <div className="mx-6 mb-4 p-3 bg-red-950/60 border border-red-700/70 text-center">
            <span className="text-xs uppercase tracking-widest text-red-400">{error}</span>
          </div>
        )}

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
            disabled={!form.name.trim() || saving}
            className="uppercase tracking-widest text-xs bg-foreground text-background hover:bg-foreground/90"
          >
            {saving ? "Saving…" : "Create Creature"}
          </Button>
        </div>
      </div>

      <div className="absolute inset-0 -z-10" onClick={handleClose} />
    </div>
  );
}
