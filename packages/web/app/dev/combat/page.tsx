"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ChevronLeft, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { CombatOverlay } from "@/features/combat/components/combat-overlay"

interface Game {
  id: string
  name: string
}

interface Character {
  id: string
  name: string
}

interface Creature {
  id: string
  name: string
  level: number | null
}

const LABEL = "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60 mb-1"
const INPUT =
  "w-full bg-background border border-border text-foreground font-mono text-xs px-3 py-2 focus:outline-none focus:border-foreground/40"
const SELECT =
  "w-full bg-background border border-border text-foreground font-mono text-xs px-3 py-2 focus:outline-none focus:border-foreground/40"
const BTN_PRIMARY =
  "font-mono text-[9px] uppercase tracking-widest px-4 py-2 border border-foreground/40 text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
const BTN_DANGER =
  "font-mono text-[9px] uppercase tracking-widest px-4 py-2 border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"

export default function CombatTestPage() {
  const supabase = createClient()

  const [games, setGames] = useState<Game[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [creatures, setCreatures] = useState<Creature[]>([])

  const [selectedGameId, setSelectedGameId] = useState("")
  const [selectedCharId, setSelectedCharId] = useState("")

  const [selectedCreatures, setSelectedCreatures] = useState<Creature[]>([])
  const [creatureSearch, setCreatureSearch] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const [combatActive, setCombatActive] = useState(false)
  const [outcome, setOutcome] = useState<"victory" | "defeat" | null>(null)
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: gs }, { data: chars }, { data: crs }] = await Promise.all([
        supabase.from("games").select("id, name").order("name"),
        supabase.from("characters").select("id, name").order("name"),
        supabase.from("creatures").select("id, name, level").order("level").order("name"),
      ])
      setGames((gs ?? []) as Game[])
      setCharacters((chars ?? []) as Character[])
      setCreatures((crs ?? []) as Creature[])
    }
    void load()
  }, [supabase])

  // Close search dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const filteredCreatures = creatures.filter(c => {
    if (selectedCreatures.find(s => s.id === c.id)) return false
    if (!creatureSearch.trim()) return true
    return c.name.toLowerCase().includes(creatureSearch.toLowerCase())
  })

  function addCreature(c: Creature) {
    if (selectedCreatures.length >= 5) return
    setSelectedCreatures(prev => [...prev, c])
    setCreatureSearch("")
  }

  function removeCreature(id: string) {
    setSelectedCreatures(prev => prev.filter(c => c.id !== id))
  }

  async function startCombat() {
    if (!selectedGameId || !selectedCharId || selectedCreatures.length === 0) return
    setBusy(true)
    setStatus("Adding creatures to encounter…")
    try {
      const { data: templates } = await supabase
        .from("creatures")
        .select("*")
        .in("id", selectedCreatures.map(c => c.id))

      if (!templates?.length) { setStatus("Creature templates not found."); return }

      await supabase.from("encounter_creatures").delete().eq("game_id", selectedGameId)

      const rows = templates.map(c => ({
        game_id: selectedGameId,
        creature_id: c.id,
        name: c.name,
        level: c.level,
        attack_damage: c.attack_damage,
        attack_cost: c.attack_cost,
        defence: c.defence,
        strong_attack: c.strong_attack,
        strong_cost: c.strong_cost,
        strong_defence: c.strong_defence,
        health_max: c.health_max,
        current_health: c.health_max ?? 0,
        power_max: c.power_max,
        current_power: c.power_max ?? 0,
        will_max: c.will_max,
        current_will: c.will_max ?? 0,
        essence_max: c.essence_max,
        current_essence: c.essence_max ?? 0,
        is_alive: true,
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await supabase.from("encounter_creatures").insert(rows as any)
      if (insertError) { setStatus(`Insert error: ${insertError.message}`); return }

      setStatus("Starting combat…")
      const res = await fetch("/api/gm/combat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: selectedGameId }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!data.ok) { setStatus(`Error: ${data.error ?? "unknown"}`); return }

      setOutcome(null)
      setCombatActive(true)
      setStatus("")
    } finally {
      setBusy(false)
    }
  }

  async function endCombat() {
    if (!selectedGameId) return
    setBusy(true)
    try {
      await fetch("/api/gm/combat/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: selectedGameId }),
      })
    } finally {
      setCombatActive(false)
      setBusy(false)
    }
  }

  function handleCombatEnd(result: "victory" | "defeat") {
    setOutcome(result)
    setCombatActive(false)
  }

  if (combatActive && selectedGameId && selectedCharId) {
    return (
      <div className="relative h-screen">
        <CombatOverlay
          gameId={selectedGameId}
          characterId={selectedCharId}
          onCombatEnd={handleCombatEnd}
        />
        <button
          onClick={endCombat}
          className="fixed top-3 right-3 z-60 font-mono text-[9px] uppercase tracking-widest px-3 py-1.5 border border-destructive/40 text-destructive hover:bg-destructive/10 bg-background"
        >
          Abort
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8 max-w-2xl mx-auto">
      <Link href="/dashboard" className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs mb-8">
        <ChevronLeft className="w-3 h-3" />
        Dev Tools
      </Link>

      <h1 className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground mb-8">
        Combat Test Harness
      </h1>

      {outcome && (
        <div className={`border p-4 mb-6 font-mono text-sm uppercase tracking-widest text-center ${outcome === "victory" ? "border-amber-600/40 text-amber-400" : "border-destructive/40 text-destructive"}`}>
          {outcome === "victory" ? "⚔ Victory" : "✦ Defeat"}
        </div>
      )}

      {status && (
        <p className="font-mono text-[10px] text-muted-foreground/60 mb-4">{status}</p>
      )}

      <div className="flex flex-col gap-6">
        {/* Game */}
        <div>
          <div className={LABEL}>Game</div>
          <select value={selectedGameId} onChange={e => setSelectedGameId(e.target.value)} className={SELECT}>
            <option value="">— select game —</option>
            {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        {/* Character */}
        <div>
          <div className={LABEL}>Character</div>
          <select value={selectedCharId} onChange={e => setSelectedCharId(e.target.value)} className={SELECT}>
            <option value="">— select character —</option>
            {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Creatures — searchable */}
        <div>
          <div className={LABEL}>Creatures (max 5)</div>

          {/* Selected creature chips */}
          {selectedCreatures.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedCreatures.map(c => (
                <span key={c.id} className="flex items-center gap-1 border border-border/60 bg-card px-2 py-1 font-mono text-[9px] text-foreground/80">
                  {c.name}{c.level != null && <span className="text-muted-foreground/50 ml-1">L{c.level}</span>}
                  <button onClick={() => removeCreature(c.id)} className="ml-1 text-muted-foreground/50 hover:text-foreground">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search input + dropdown */}
          {selectedCreatures.length < 5 && (
            <div className="relative" ref={searchRef}>
              <input
                type="text"
                placeholder="Search creatures…"
                value={creatureSearch}
                onChange={e => { setCreatureSearch(e.target.value); setSearchOpen(true) }}
                onFocus={() => setSearchOpen(true)}
                className={INPUT}
              />
              {searchOpen && filteredCreatures.length > 0 && (
                <div className="absolute z-10 w-full bg-card border border-border/60 mt-px max-h-48 overflow-y-auto">
                  {filteredCreatures.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { addCreature(c); setSearchOpen(false) }}
                      className="w-full text-left px-3 py-1.5 font-mono text-[10px] text-foreground/80 hover:bg-border/20 flex items-center justify-between"
                    >
                      <span>{c.name}</span>
                      {c.level != null && <span className="text-muted-foreground/50">L{c.level}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={startCombat}
            disabled={busy || !selectedGameId || !selectedCharId || selectedCreatures.length === 0}
            className={BTN_PRIMARY}
          >
            {busy ? "Starting…" : "Start Combat"}
          </button>
          <button
            onClick={endCombat}
            disabled={busy || !selectedGameId}
            className={BTN_DANGER}
          >
            Force End
          </button>
        </div>
      </div>
    </div>
  )
}
