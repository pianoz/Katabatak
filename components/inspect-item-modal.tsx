"use client"

import { Button } from "@/components/ui/button"
import { Package, X } from "lucide-react"

interface Item {
  id: string
  name: string
  type: string
  weight?: number
  description?: string
  damage?: number
  defence?: number
  character_id: string
  condition: number
  consumable: boolean
  image_url?: string | null
  action_text?: string | null
  short_description?: string | null
}

interface InspectItemModalProps {
  item: Item | null
  onClose: () => void
}

export function InspectItemModal({ item, onClose }: InspectItemModalProps) {
  if (!item) return null

  const skipFields = ['id', 'character_id', 'image_url', 'name', 'description', 'action_text', 'short_description']
  const displayFields = Object.entries(item).filter(
    ([key, value]) => !skipFields.includes(key) && value !== null && value !== undefined
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-border bg-card shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed on top */}
        <div className="sticky top-0 z-10 flex justify-between items-start p-6 bg-card/95 backdrop-blur-sm border-b border-border/50">
          <div>
            <h2 className="font-serif text-3xl text-foreground mb-1">{item.name}</h2>
            <p className="text-xs uppercase tracking-widest text-cyan-500 font-bold">
              {item.type}
            </p>
            <h3 className="text-sm font-serif text-foreground/80 italic">
              {item.short_description}
            </h3>
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
        <div className="p-6 md:p-8 space-y-8">
          {/* Top Section: Image and Stats */}
          <div className="flex flex-col md:flex-row gap-8">
            
            {/* Image (Upper Left on Desktop, 3rd in flow on Mobile) */}
            <div className="w-full md:w-1/2 aspect-square order-3 md:order-1 bg-secondary/20 border border-border rounded-lg overflow-hidden flex items-center justify-center">
              {item.image_url ? (
                <img 
                  src={item.image_url} 
                  alt={item.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Package className="w-16 h-16 text-muted-foreground/20" />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40">No Image Available</span>
                </div>
              )}
            </div>

            {/* Stats (To the side on Desktop, 4th in flow on Mobile) */}
            <div className="w-full md:w-1/2 order-4 md:order-2">
              <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4 border-b border-border pb-1">Mechanical Properties</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-3">
                {displayFields.map(([key, value]) => (
                  <div key={key} className="flex justify-between border-b border-border/30 pb-1 h-fit">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-tight mr-2">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs font-mono text-foreground">
                      {typeof value === 'boolean' ? (value ? "Yes" : "No") : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Section: Long Text Components */}
          <div className="space-y-6 order-2 md:order-3">
            {item.description && (
              <div className="text-sm text-muted-foreground leading-relaxed">
                <h4 className="text-[10px] uppercase tracking-widest text-foreground/50 mb-2">Lore & Description</h4>
                <p className="bg-secondary/10 p-4 rounded-md italic">
                  {item.description}
                </p>
              </div>
            )}

            {item.action_text && (
              <div className="p-4 border-l-4 border-cyan-500 bg-cyan-500/5">
                <h4 className="text-[10px] uppercase tracking-widest text-cyan-500/70 mb-1">Effect</h4>
                <p className="text-sm font-medium text-foreground italic">
                  "{item.action_text}"
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
      
      {/* Click outside to close overlay */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  )
}
