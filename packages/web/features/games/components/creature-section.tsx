"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCreatures } from "@/lib/services/encounter-service";
import { CreateCreatureModal } from "@/features/games/components/create-creature-modal";
import { InspectCreatureModal } from "@/features/games/components/inspect-creature-modal";
import type { Tables } from "@/components/types/supabase";

type Creature = Tables<"creatures">;

type SortKey = "name" | "level" | "attack_damage" | "defence" | "health_max";
type SortDir = "asc" | "desc";

const ghostBtnClass =
  "font-sans text-[0.65rem] tracking-widest uppercase bg-transparent border border-border text-muted-foreground px-3 py-1.5 cursor-pointer disabled:opacity-40";

interface CreatureSectionProps {
  onAddToEncounter?: (creatures: Creature[]) => void;
}

export function CreatureSection({ onAddToEncounter }: CreatureSectionProps) {
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [myOnly, setMyOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [inspecting, setInspecting] = useState<Creature | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
    getCreatures(supabase).then((data) => {
      setCreatures(data as Creature[]);
      setLoading(false);
    });
  }, []);

  function handleCreated(creature: Creature) {
    setCreatures(prev => [...prev, creature]);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = creatures
    .filter(c => {
      if (myOnly && c.created_by !== currentUserId) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? (sortKey === "name" ? "" : -1);
      const bv = b[sortKey] ?? (sortKey === "name" ? "" : -1);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  function SortBtn({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <button
        onClick={() => toggleSort(col)}
        className={`text-[10px] uppercase tracking-widest flex items-center gap-1 transition-colors ${
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
        }`}
      >
        {label}
        <span className="font-mono text-[9px]">{active ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
      </button>
    );
  }

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground uppercase tracking-widest py-8 text-center">
        Loading…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <input
            className="bg-background border border-border px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-foreground/50 placeholder:text-muted-foreground/50 w-48"
            placeholder="Search creatures…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="creature-filter"
              className="accent-cyan-500"
              checked={myOnly}
              onChange={() => setMyOnly(true)}
            />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Mine only</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="creature-filter"
              className="accent-cyan-500"
              checked={!myOnly}
              onChange={() => setMyOnly(false)}
            />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">All</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          {onAddToEncounter && (
            <button
              onClick={() => {
                const selected = filtered.filter(c => selectedIds.has(c.id));
                if (selected.length > 0) {
                  onAddToEncounter(selected);
                  setSelectedIds(new Set());
                }
              }}
              disabled={selectedIds.size === 0}
              className={ghostBtnClass}
            >
              Add to Encounter
            </button>
          )}
          <button
            onClick={() => setCreateOpen(true)}
            className="border border-border text-[10px] uppercase tracking-widest px-4 py-2 text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
          >
            + New Creature
          </button>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex gap-4 pl-10 px-1">
        <SortBtn col="name" label="Name" />
        <SortBtn col="level" label="Level" />
        <SortBtn col="attack_damage" label="Attack" />
        <SortBtn col="defence" label="Defence" />
        <SortBtn col="health_max" label="HP" />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-6 text-center">
          {myOnly ? "You haven't created any creatures yet." : "No creatures found."}
        </p>
      ) : (
        <div className="space-y-1">
          {/* Desktop header row */}
          <div className="hidden md:flex items-center py-1">
            <div className="w-10 shrink-0" />
            <div className="flex-1 grid grid-cols-[1fr_5rem_6rem_6rem_6rem_6rem] gap-2 px-3">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Name</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground text-center">LVL</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground text-center">ATK</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground text-center">DEF</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground text-center">HP</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground text-center">AC</span>
            </div>
          </div>

          {filtered.map(creature => (
            <div
              key={creature.id}
              className="w-full flex items-stretch border border-border bg-card hover:bg-secondary/20 transition-colors"
            >
              {/* Checkbox */}
              <label className="w-10 flex items-center justify-center border-r border-border/30 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.has(creature.id)}
                  onChange={() => toggleSelect(creature.id)}
                  className="accent-cyan-500"
                />
              </label>

              {/* Row — opens inspect modal */}
              <button
                onClick={() => setInspecting(creature)}
                className="flex-1 text-left"
              >
                {/* Desktop row */}
                <div className="hidden md:grid grid-cols-[1fr_5rem_6rem_6rem_6rem_6rem] gap-2 px-3 py-3 items-center">
                  <div>
                    <span className="font-serif text-sm text-foreground">{creature.name}</span>
                    {creature.description && (
                      <p className="text-[10px] text-muted-foreground truncate max-w-xs mt-0.5">
                        {creature.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground text-center">{creature.level ?? "—"}</span>
                  <span className="text-xs text-foreground text-center font-mono">
                    {creature.attack_damage ?? "—"}
                  </span>
                  <span className="text-xs text-foreground text-center font-mono">
                    {creature.defence ?? "—"}
                  </span>
                  <span className="text-xs text-foreground text-center font-mono">
                    {creature.health_max ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground text-center">
                    {creature.armor_class ?? "—"}
                  </span>
                </div>

                {/* Mobile card */}
                <div className="md:hidden px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-base text-foreground">{creature.name}</span>
                    {creature.level != null && (
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Lvl {creature.level}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4">
                    {creature.attack_damage != null && (
                      <span className="text-[10px] text-muted-foreground">
                        ATK <span className="text-foreground font-mono">{creature.attack_damage}</span>
                      </span>
                    )}
                    {creature.defence != null && (
                      <span className="text-[10px] text-muted-foreground">
                        DEF <span className="text-foreground font-mono">{creature.defence}</span>
                      </span>
                    )}
                    {creature.health_max != null && (
                      <span className="text-[10px] text-muted-foreground">
                        HP <span className="text-foreground font-mono">{creature.health_max}</span>
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      <CreateCreatureModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
        currentUserId={currentUserId}
      />

      <InspectCreatureModal
        creature={inspecting}
        onClose={() => setInspecting(null)}
      />
    </div>
  );
}
