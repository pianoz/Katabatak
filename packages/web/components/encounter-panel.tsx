"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/components/types/supabase";

type EncounterCreature = Tables<"encounter_creatures">;

const ghostBtnClass =
  "font-sans text-[0.6rem] tracking-widest uppercase bg-transparent border border-border text-muted-foreground px-2 py-1 cursor-pointer disabled:opacity-30";

const dangerBtnClass =
  "font-sans text-[0.6rem] tracking-widest uppercase bg-transparent border border-destructive/30 text-destructive px-2 py-1 cursor-pointer";

interface PoolBarProps {
  label: string;
  current: number;
  max: number;
  color: string;
}

function PoolBar({ label, current, max, color }: PoolBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between items-baseline">
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/70">{label}</span>
        <span className="text-[9px] font-mono text-muted-foreground">
          {current}/{max}
        </span>
      </div>
      <div className="h-1.5 bg-border/40 w-full">
        <div
          className="h-full transition-all duration-150"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

interface EncounterPanelProps {
  gameId: string;
  refreshKey: number;
}

export function EncounterPanel({ gameId, refreshKey }: EncounterPanelProps) {
  const [creatures, setCreatures] = useState<EncounterCreature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    createClient()
      .from("encounter_creatures")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at")
      .then(({ data }) => {
        if (data) setCreatures(data as EncounterCreature[]);
        setLoading(false);
      });
  }, [gameId, refreshKey]);

  const encounterLevel = creatures
    .filter(c => c.is_alive)
    .reduce((sum, c) => sum + (c.level ?? 0), 0);

  async function handleHpChange(id: string, delta: number) {
    const creature = creatures.find(c => c.id === id);
    if (!creature) return;
    const newHp = Math.max(0, Math.min(creature.health_max ?? 0, (creature.current_health ?? 0) + delta));
    const isAlive = newHp > 0;

    await createClient()
      .from("encounter_creatures")
      .update({ current_health: newHp, is_alive: isAlive })
      .eq("id", id);

    setCreatures(prev =>
      prev.map(c => (c.id === id ? { ...c, current_health: newHp, is_alive: isAlive } : c))
    );
  }

  async function handleRemove(id: string) {
    await createClient().from("encounter_creatures").delete().eq("id", id);
    setCreatures(prev => prev.filter(c => c.id !== id));
  }

  return (
    <div className="w-1/3 border-l border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-baseline justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Encounter</span>
        <span className="text-[10px] font-mono text-muted-foreground">
          Encounter Lvl <span className="text-foreground">{encounterLevel}</span>
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-xs text-muted-foreground uppercase tracking-widest text-center py-8">
            Loading…
          </p>
        ) : creatures.length === 0 ? (
          <p className="font-serif text-sm text-muted-foreground/40 italic text-center py-8">
            No creatures in encounter.
          </p>
        ) : (
          creatures.map(c => (
            <div
              key={c.id}
              className={`border border-border p-3 flex flex-col gap-2 ${
                !c.is_alive ? "opacity-40" : ""
              }`}
            >
              {/* Name + level + remove */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-serif text-sm text-foreground">{c.name}</span>
                  {c.level != null && (
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60 ml-2">
                      Lvl {c.level}
                    </span>
                  )}
                  {!c.is_alive && (
                    <div className="text-[9px] uppercase tracking-widest text-destructive/70 mt-0.5">
                      Defeated
                    </div>
                  )}
                </div>
                <button onClick={() => handleRemove(c.id)} className={dangerBtnClass}>
                  Remove
                </button>
              </div>

              {/* Attack / defence stats */}
              <div className="flex gap-3 flex-wrap">
                {c.attack_damage != null && (
                  <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
                    ATK <span className="text-foreground font-mono">{c.attack_damage}</span>
                  </span>
                )}
                {c.defence != null && (
                  <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
                    DEF <span className="text-foreground font-mono">{c.defence}</span>
                  </span>
                )}
                {c.strong_attack != null && (
                  <span className="text-[9px] text-muted-foreground uppercase tracking-widest">
                    STR <span className="text-foreground font-mono">{c.strong_attack}</span>
                  </span>
                )}
              </div>

              {/* HP bar + controls */}
              {c.health_max != null && c.health_max > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleHpChange(c.id, -1)}
                    disabled={!c.is_alive}
                    className={ghostBtnClass}
                  >
                    −
                  </button>
                  <div className="flex-1">
                    <PoolBar
                      label="HP"
                      current={c.current_health ?? 0}
                      max={c.health_max}
                      color={!c.is_alive ? "#555" : "#ef4444"}
                    />
                  </div>
                  <button
                    onClick={() => handleHpChange(c.id, +1)}
                    disabled={!c.is_alive}
                    className={ghostBtnClass}
                  >
                    +
                  </button>
                </div>
              )}

              {/* Other pools */}
              <div className="flex flex-col gap-1.5">
                {c.power_max != null && c.power_max > 0 && (
                  <PoolBar
                    label="Power"
                    current={c.current_power ?? 0}
                    max={c.power_max}
                    color="#3b82f6"
                  />
                )}
                {c.will_max != null && c.will_max > 0 && (
                  <PoolBar
                    label="Will"
                    current={c.current_will ?? 0}
                    max={c.will_max}
                    color="#8b5cf6"
                  />
                )}
                {c.essence_max != null && c.essence_max > 0 && (
                  <PoolBar
                    label="Essence"
                    current={c.current_essence ?? 0}
                    max={c.essence_max}
                    color="#06b6d4"
                  />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
