"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { createCharacterWithItems, linkCharacterToInvite } from "@/lib/services/character-service"
import { Plus, Minus } from "lucide-react"

interface CharacterCreationProps {
  userId: string
  inviteMemberId?: string
  startingLevel?: number
}

export function CharacterCreation({ userId, inviteMemberId, startingLevel }: CharacterCreationProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    speed: "2",
    height: "170",
    weight: "80",
    carrying_capacity: "32",
    denarius: "0",
    background_primary: "",
    physical_description: "",
    backstory: ""
  })

  const MAX_HEIGHT = 215 //cm
  const MAX_WEIGHT = 150 //kg
  const MIN_HEIGHT = 100 //cm
  const MIN_WEIGHT = 25//kg

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
      // Convert to number for validation
      const numValue = parseFloat(value);

      setFormData(prev => {
          const newData = { ...prev, [name]: value };
          if (name === "height") {
            const heightCm = parseFloat(value);
            if (!isNaN(heightCm)) {
                const calculatedSpeed = Math.ceil(heightCm / 13);
                newData.speed = calculatedSpeed.toString();
            }
        }

        if (name === "weight") {
            const weightKgs = parseFloat(value);
            if (!isNaN(weightKgs)) {
                const calculatedCapacity = Math.ceil(weightKgs * 0.4);
                newData.carrying_capacity = calculatedCapacity.toString();
            }
        }
          return newData;
      });
  };

  const handleStepChange = (name: "height" | "weight", increment: number) => {
    setFormData(prev => {
      const currentValue = parseFloat(prev[name]) || 0;
      let newValue = currentValue + increment;

      // Apply your specific boundaries
      if (name === "height") {
        newValue = Math.min(Math.max(newValue, 50), 300);
      } else if (name === "weight") {
        newValue = Math.min(Math.max(newValue, 1), 500);
      }

      const newData = { ...prev, [name]: newValue.toString() };

      // Automatically recalculate dependencies
      if (name === "height") {
        newData.speed = Math.ceil(newValue / 13).toString();
      } else if (name === "weight") {
        newData.carrying_capacity = Math.ceil(newValue * 0.4).toString();
      }

      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const charData = await createCharacterWithItems(supabase, {
      user_id: userId,
      name: formData.name,
      essence_max: 10,
      current_essence: 10,
      power_max: 10,
      current_power: 10,
      will_max: 10,
      current_will: 10,
      speed: formData.speed ? parseInt(formData.speed) : 2,
      height: formData.height ? parseInt(formData.height) : 170,
      weight_kgs: formData.weight ? parseInt(formData.weight) : 18,
      carrying_capacity: formData.carrying_capacity ? parseInt(formData.carrying_capacity) : 0,
      denarius: formData.denarius ? parseInt(formData.denarius) : 5,
      background_primary: formData.background_primary || null,
      physical_description: formData.physical_description || null,
      backstory: formData.backstory || null,
      is_active: true,
      unused_skill_points: startingLevel ?? 0,
    })

    if (!charData) {
      setError("Failed to create character.")
      setLoading(false)
      return
    }

    if (inviteMemberId) {
      await linkCharacterToInvite(supabase, inviteMemberId, charData.id)
      router.push("/dashboard")
      return
    }

    router.push(`/characters/${charData.id}`)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="px-6 md:px-12 lg:px-20 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <h1 className="font-serif text-2xl tracking-wide text-foreground">
              New Character
            </h1>
          </div>
          <Link href="/dashboard" className="font-serif text-lg tracking-wide text-muted-foreground hover:text-foreground">
            KatabataK
          </Link>
        </div>
      </header>

      <main className="px-6 md:px-12 lg:px-20 py-8 max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Character Name */}
          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Character Name *
            </label>
            <Input
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              maxLength={100}
              placeholder="Enter character name"
              className="bg-input border-border text-foreground placeholder:text-muted-foreground font-serif text-lg"
            />
          </div>

          {/* Starting Pools Info */}
          <div className="border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Starting Pools
            </p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="font-serif text-3xl text-foreground">10</p>
                <p className="text-xs text-muted-foreground mt-1">Essence</p>
              </div>
              <div>
                <p className="font-serif text-3xl text-foreground">10</p>
                <p className="text-xs text-muted-foreground mt-1">Power</p>
              </div>
              <div>
                <p className="font-serif text-3xl text-foreground">10</p>
                <p className="text-xs text-muted-foreground mt-1">Will</p>
              </div>
            </div>
          </div>

          {/* Attributes */}
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Attributes
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Height (cm)</label>
                <div className="flex items-center gap-2 bg-input border border-border rounded-md px-2 h-10 w-full justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-md border border-border text-foreground"
                    onClick={() => handleStepChange("height", -1)}
                    disabled={parseInt(formData.height) <= 50}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="font-serif text-base text-foreground min-w-[4ch] text-center select-none">
                    {formData.height || "0"}
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-md border border-border text-foreground"
                    onClick={() => handleStepChange("height", 1)}
                    disabled={parseInt(formData.height) >= 300}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Weight (kg)</label>
                <div className="flex items-center gap-2 bg-input border border-border rounded-md px-2 h-10 w-full justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-md border border-border text-foreground"
                    onClick={() => handleStepChange("weight", -1)}
                    disabled={parseInt(formData.weight) <= 1}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="font-serif text-base text-foreground min-w-[4ch] text-center select-none">
                    {formData.weight || "0"}
                  </span>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-md border border-border text-foreground"
                    onClick={() => handleStepChange("weight", 1)}
                    disabled={parseInt(formData.weight) >= 500}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Speed (m)</label>
                <Input
                  name="speed"
                  type="number"
                  value={formData.speed}
                  readOnly
                  onChange={handleChange}
                  placeholder="—"
                  className="bg-transparent border-none p-0 h-auto text-2xl font-serif font-bold text-foreground focus-visible:ring-0 cursor-default"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Carrying Capacity (kg)</label>
                <Input
                  name="carrying_capacity"
                  type="number"
                  readOnly
                  value={formData.carrying_capacity}
                  onChange={handleChange}
                  placeholder="—"className="bg-transparent border-none p-0 h-auto text-2xl font-serif font-bold text-foreground focus-visible:ring-0 cursor-default"
                />
              </div>
            </div>
          </div>

          {/* Background */}
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Background
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Input
                  name="background_primary"
                  value={formData.background_primary}
                  onChange={handleChange}
                  maxLength={300}
                  placeholder="e.g. Soldier, Scholar, Merchant"
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>

          {/* Physical Description */}
          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Physical Description
            </label>
            <textarea
              name="physical_description"
              value={formData.physical_description}
              onChange={handleChange}
              rows={3}
              maxLength={500}
              placeholder="Describe your character's appearance..."
              className="w-full px-3 py-2 bg-input border border-border text-foreground placeholder:text-muted-foreground resize-none font-serif"
            />
          </div>

          {/* Backstory */}
          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Backstory
            </label>
            <textarea
              name="backstory"
              value={formData.backstory}
              onChange={handleChange}
              rows={6}
              maxLength={1500}
              placeholder="Tell the tale of who your character was before the adventure began..."
              className="w-full px-3 py-2 bg-input border border-border text-foreground placeholder:text-muted-foreground resize-none font-serif"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="border border-destructive bg-destructive/10 p-4 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-4 pt-4 border-t border-border">
            <Button
              type="submit"
              disabled={loading || !formData.name}
              className="bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs px-8"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Character"
              )}
            </Button>
            <Link href="/dashboard">
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground uppercase tracking-widest text-xs"
              >
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </main>
    </div>
  )
}
