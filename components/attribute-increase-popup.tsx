"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

// Map the user-facing display to its database column counterpart
type StatField = "health_max" | "power_max" | "will_max" | "essence_max"

interface StatOption {
  id: StatField
  label: string
  description: string
}

const POOL_OPTIONS: StatOption[] = [
  { id: "health_max", label: "Health", description: "Increase your vitality and capacity to endure physical trauma." },
  { id: "power_max", label: "Power", description: "Expand your energetic reserve to fuel potent abilities." },
  { id: "will_max", label: "Will", description: "Fortify your mental resolve and resistance to psychic strain." },
  { id: "essence_max", label: "Essence", description: "Deepen your fundamental connection to the world's core magic." },
]

interface StatIncreaseModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (selectedPool: StatField) => Promise<void> | void
}

export function StatIncreaseModal({ isOpen, onClose, onConfirm }: StatIncreaseModalProps) {
  const [selectedPool, setSelectedPool] = useState<StatField | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (!selectedPool) return
    
    setIsSubmitting(true)
    try {
      await onConfirm(selectedPool)
      setSelectedPool(null) // Reset selection on success
      onClose()
    } catch (error) {
      console.error("Failed to update character pool:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl bg-background/95 backdrop-blur-md border border-border/50 shadow-2xl p-6 md:p-8">
        
        <DialogHeader className="space-y-2 text-center sm:text-left">
          <DialogTitle className="font-serif text-2xl tracking-wide text-foreground">
            Fortify Your Being
          </DialogTitle>
          <DialogDescription className="text-xs uppercase tracking-widest text-muted-foreground">
            Select a single attribute pool to permanently increase by 1.
          </DialogDescription>
        </DialogHeader>

        {/* 2x2 Grid of Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
          {POOL_OPTIONS.map((option) => {
            const isSelected = selectedPool === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedPool(option.id)}
                className={`
                  flex flex-col items-start justify-between text-left p-4 rounded-md border transition-all duration-200 group
                  ${isSelected 
                    ? "bg-foreground/5 border-foreground text-foreground" 
                    : "bg-background/40 border-border/40 hover:border-border text-muted-foreground hover:text-foreground"
                  }
                `}
              >
                <span className={`text-sm uppercase tracking-widest transition-colors font-medium mb-1 ${isSelected ? "text-foreground" : "group-hover:text-foreground"}`}>
                  {option.label}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground/80 group-hover:text-muted-foreground transition-colors">
                  {option.description}
                </span>
              </button>
            )
          })}
        </div>

        {/* Actions Footer */}
        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-border/30">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="uppercase text-xs tracking-widest text-muted-foreground hover:text-foreground h-10"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedPool || isSubmitting}
            className="uppercase text-xs tracking-widest bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 h-10 px-6 font-medium transition-colors"
          >
            {isSubmitting ? "Updating..." : "Confirm Selection"}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  )
}