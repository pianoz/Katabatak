"use client";

import { Button } from "@/components/ui/button";
import { Skull, X } from "lucide-react";
import type { Tables } from "@/components/types/supabase";

type Creature = Tables<"creatures">;

interface InspectCreatureModalProps {
  creature: Creature | null;
  onClose: () => void;
}

const SKIP_FIELDS = new Set([
  "id", "created_at", "created_by", "image_url", "name", "description",
  "current_essence", "current_health", "current_power", "current_will",
]);

const FIELD_LABELS: Partial<Record<keyof Creature, string>> = {
  level: "Level",
  speed: "Speed",
  armor_class: "Armor Class",
  essence_max: "Essence",
  power_max: "Power",
  will_max: "Will",
  health_max: "Health",
  attack_damage: "Attack Damage",
  attack_cost: "Attack Cost",
  defence: "Defence",
  defence_cost: "Defence Cost",
  strong_attack: "Strong Attack",
  strong_defence: "Strong Defence",
  strong_cost: "Strong Cost",
  attribute_cost_name: "Cost Attribute",
};

const POOL_FIELDS: (keyof Creature)[] = ["essence_max", "power_max", "will_max", "health_max"];
const PHYSICAL_FIELDS: (keyof Creature)[] = ["level", "speed", "armor_class"];
const COMBAT_FIELDS: (keyof Creature)[] = [
  "attack_damage", "attack_cost", "defence", "defence_cost", "attribute_cost_name",
];
const STRONG_FIELDS: (keyof Creature)[] = ["strong_attack", "strong_defence", "strong_cost"];

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/30 pb-1">
      <span className="text-[10px] text-muted-foreground uppercase tracking-tight">{label}</span>
      <span className="text-xs font-mono text-foreground">{value}</span>
    </div>
  );
}

function StatGroup({ title, fields, creature }: { title: string; fields: (keyof Creature)[]; creature: Creature }) {
  const rows = fields
    .filter(f => creature[f] !== null && creature[f] !== undefined)
    .map(f => ({
      label: FIELD_LABELS[f] ?? String(f).replace(/_/g, " "),
      value: String(creature[f]),
    }));

  if (rows.length === 0) return null;

  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 border-b border-border pb-1">
        {title}
      </h4>
      <div className="space-y-2">
        {rows.map(r => <StatRow key={r.label} label={r.label} value={r.value} />)}
      </div>
    </div>
  );
}

export function InspectCreatureModal({ creature, onClose }: InspectCreatureModalProps) {
  if (!creature) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden border border-border bg-card shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex justify-between items-start p-6 bg-card/95 backdrop-blur-sm border-b border-border/50">
          <div>
            <h2 className="font-serif text-3xl text-foreground mb-1">{creature.name}</h2>
            {creature.level != null && (
              <p className="text-xs uppercase tracking-widest text-cyan-500 font-bold">
                Level {creature.level} Creature
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
          <div className="flex flex-col md:flex-row gap-8">

            {/* Image */}
            <div className="w-full md:w-1/2 aspect-square order-3 md:order-1 bg-secondary/20 border border-border overflow-hidden flex items-center justify-center">
              {creature.image_url ? (
                <img
                  src={creature.image_url}
                  alt={creature.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Skull className="w-16 h-16 text-muted-foreground/20" />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40">No Image</span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="w-full md:w-1/2 order-4 md:order-2 space-y-6">
              <StatGroup title="Pools" fields={POOL_FIELDS} creature={creature} />
              <StatGroup title="Physical" fields={PHYSICAL_FIELDS} creature={creature} />
              <StatGroup title="Combat" fields={COMBAT_FIELDS} creature={creature} />
              <StatGroup title="Strong Actions" fields={STRONG_FIELDS} creature={creature} />
            </div>
          </div>

          {/* Description */}
          {creature.description && (
            <div className="text-sm text-muted-foreground leading-relaxed">
              <h4 className="text-[10px] uppercase tracking-widest text-foreground/50 mb-2">Lore & Description</h4>
              <p className="bg-secondary/10 p-4 italic">
                {creature.description}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
