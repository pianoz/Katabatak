"use client"

import { useState } from "react"
import { getConditionStyle } from "@/lib/utils"
import type { Tables } from "@/components/types/supabase"
import type { WeaponOption } from "./combat-overlay"

type EncounterCreature = Tables<"encounter_creatures">

// ─── Phase A ─────────────────────────────────────────────────────────────────

interface PhaseAProps {
  weapons: WeaponOption[]
  aliveCreatures: EncounterCreature[]
  selectedWeaponId: string | null
  selectedTargetId: string | null
  initialWeaponId: string | null
  onSelectWeapon: (id: string) => void
  onAttack: (type: "normal" | "strong") => void
  onEquip: (inventoryId: string) => void
  busy: boolean
}

function getShortStats(w: WeaponOption): string {
  const dmg = w.damage ?? "—"
  const cost = w.cost ?? 0
  return `${dmg} / ${cost}${w.costAttribute.charAt(0).toUpperCase()}`
}

export function PhaseAControls({
  weapons,
  aliveCreatures,
  selectedWeaponId,
  selectedTargetId,
  initialWeaponId,
  onSelectWeapon,
  onAttack,
  onEquip,
  busy,
}: PhaseAProps) {
  const [confirmingEquip, setConfirmingEquip] = useState(false)

  const weapon = weapons.find(w => w.inventoryId === selectedWeaponId)
  const hasStrong = weapon?.strongDamage != null
  // Show Attack if this weapon is DB-equipped OR was the pre-selected weapon at combat start
  const isEquipped = (weapon?.isEquipped ?? false) || weapon?.inventoryId === initialWeaponId

  function handleWeaponChange(inventoryId: string) {
    onSelectWeapon(inventoryId)
    setConfirmingEquip(false)
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground/60">
        Phase I — Your Attack
      </div>

      <div className="border border-border bg-card p-3 flex flex-col gap-3">

        {/* Weapon selector row */}
        <div className="flex items-center gap-2">
          <select
            value={selectedWeaponId ?? ""}
            onChange={(e) => handleWeaponChange(e.target.value)}
            disabled={busy}
            className="bg-secondary/40 text-[10px] uppercase tracking-wider text-foreground border border-border h-9 px-2 focus:ring-1 focus:ring-foreground/20 flex-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {weapons.length === 0 && <option value="">No weapons</option>}
            {weapons.map(w => (
              <option key={w.inventoryId} value={w.inventoryId} className="bg-card text-foreground">
                {w.name} ({getShortStats(w)}){w.isEquipped ? " ✓" : ""}
              </option>
            ))}
          </select>

          {/* Condition bubble */}
          {weapon && weapon.inventoryId !== "__unarmed__" && (
            <div
              style={getConditionStyle(weapon.condition ?? 100)}
              className="w-8 h-8 flex items-center justify-center shrink-0 opacity-75"
            >
              <span className="text-[10px] font-bold text-gray-400">{weapon.condition ?? 100}</span>
            </div>
          )}
        </div>

        {/* Short description */}
        {weapon?.shortDescription && (
          <p className="text-[10px] leading-tight text-muted-foreground italic line-clamp-2">
            {weapon.shortDescription}
          </p>
        )}

        {/* Attack / equip actions */}
        <div className="border-t border-border/30 pt-3">
          {isEquipped ? (
            /* ── Equipped — show attack buttons ── */
            <div className="flex items-end gap-4 flex-wrap">
              <div className="flex flex-col items-start gap-1">
                <button
                  onClick={() => onAttack("normal")}
                  disabled={busy || !selectedWeaponId || (!selectedTargetId && aliveCreatures.length === 0)}
                  className="font-mono text-sm uppercase tracking-[0.2em] px-8 py-3 border-2 border-red-700/60 bg-red-950/20 text-red-300 hover:enabled:bg-red-900/35 hover:enabled:border-red-600/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {busy ? "Resolving..." : "Attack"}
                </button>
                {weapon && (
                  <span className="font-mono text-[8px] text-muted-foreground/40 pl-0.5">
                    {weapon.damage} · {weapon.cost ?? 0}{weapon.costAttribute.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {hasStrong && (
                <div className="flex flex-col items-start gap-0.5 mb-0.5">
                  <button
                    onClick={() => onAttack("strong")}
                    disabled={busy || !selectedWeaponId || (!selectedTargetId && aliveCreatures.length === 0)}
                    className="font-mono text-[9px] uppercase tracking-widest px-4 py-2 border border-amber-600/50 text-amber-400 hover:enabled:bg-amber-950/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    {busy ? "Resolving..." : "Strong Attack"}
                  </button>
                  {weapon && (
                    <span className="font-mono text-[8px] text-muted-foreground/40">
                      1d{weapon.strongDamage} · {weapon.strongCost ?? (weapon.cost ?? 1) * 2}{weapon.costAttribute.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ── Not equipped — show equip button / confirm ── */
            confirmingEquip && weapon ? (
              <div className="flex flex-col gap-2 border border-border/40 bg-card/60 p-3">
                <span className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">
                  Equip {weapon.name}? — Uses your attack action.
                </span>
                <div className="flex gap-3 text-[8px] font-mono text-muted-foreground/60">
                  <span>{weapon.damage ?? "—"} dmg</span>
                  <span>{weapon.cost ?? 0}{weapon.costAttribute.charAt(0).toUpperCase()} cost</span>
                  {weapon.condition != null && <span>Cond: {weapon.condition}</span>}
                </div>
                {weapon.shortDescription && (
                  <p className="text-[9px] italic text-muted-foreground/50 line-clamp-2">{weapon.shortDescription}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setConfirmingEquip(false); onEquip(weapon.inventoryId) }}
                    disabled={busy}
                    className="font-mono text-[9px] uppercase tracking-widest px-3 py-1.5 border border-foreground/40 text-foreground hover:bg-border/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    {busy ? "Equipping..." : "Confirm Equip"}
                  </button>
                  <button
                    onClick={() => setConfirmingEquip(false)}
                    disabled={busy}
                    className="font-mono text-[9px] uppercase tracking-widest px-3 py-1.5 border border-border/40 text-muted-foreground hover:border-border transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-0.5">
                <button
                  onClick={() => setConfirmingEquip(true)}
                  disabled={busy || !weapon}
                  className="font-mono text-[9px] uppercase tracking-widest px-4 py-2 border border-cyan-800/50 text-cyan-400 hover:enabled:bg-cyan-950/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {weapon?.isEquipped === false ? "Re-equip" : "Equip"}
                </button>
                <span className="font-mono text-[8px] text-muted-foreground/40">Uses attack action</span>
              </div>
            )
          )}
        </div>
      </div>

    </div>
  )
}

// ─── Phase B ─────────────────────────────────────────────────────────────────

interface PhaseBProps {
  attackerCount: number
  normalDefence: number
  strongDefence: number
  currentWill: number
  onDefend: (type: "normal" | "strong") => void
  busy: boolean
}

export function PhaseBControls({
  attackerCount,
  normalDefence,
  strongDefence,
  currentWill,
  onDefend,
  busy,
}: PhaseBProps) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-amber-500/80">
        Phase II — Incoming Attack ({attackerCount} {attackerCount === 1 ? "enemy" : "enemies"})
      </div>

      <p className="font-mono text-[10px] text-muted-foreground/60">
        Your defence applies against all incoming damage. Read enemy pools before choosing.
      </p>

      <div className="flex gap-3 border-t border-border/30 pt-3">
        <div className="flex flex-col items-start gap-0.5">
          <button
            onClick={() => onDefend("normal")}
            disabled={busy || currentWill < 1}
            className="font-mono text-[9px] uppercase tracking-widest px-4 py-2 border border-cyan-800/50 text-cyan-400 hover:enabled:bg-cyan-950/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? "Resolving..." : "Defend"}
          </button>
          <span className="font-mono text-[8px] text-muted-foreground/40">
            AC {normalDefence} · 1W
          </span>
        </div>

        <div className="flex flex-col items-start gap-0.5">
          <button
            onClick={() => onDefend("strong")}
            disabled={busy || currentWill < 2}
            className="font-mono text-[9px] uppercase tracking-widest px-4 py-2 border border-cyan-600/60 text-cyan-300 hover:enabled:bg-cyan-950/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? "Resolving..." : "Strong Defend"}
          </button>
          <span className="font-mono text-[8px] text-muted-foreground/40">
            AC {strongDefence} · 2W
          </span>
        </div>
      </div>

      {currentWill < 1 && (
        <p className="font-mono text-[9px] text-destructive/70">
          No Will remaining — attacks land unblocked.
        </p>
      )}
    </div>
  )
}
