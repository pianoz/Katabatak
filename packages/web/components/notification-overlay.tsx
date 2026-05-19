"use client"

export interface PendingOfferData {
  id: string
  label: string
  type: "item" | "denarius" | "skill_point" | "spell"
  quantity: number | null
  source_id?: string | null
}

interface ConsumableNotification {
  text?: string
  url?: string
}

interface NotificationOverlayProps {
  notification?: ConsumableNotification
  pendingOffer?: PendingOfferData
  onDismiss: () => void
  onAccept?: () => void
}

const offerAccent: Record<PendingOfferData["type"], { border: string; text: string; acceptBtn: string }> = {
  item:        { border: "border-amber-500",  text: "text-amber-400",  acceptBtn: "border-amber-500 text-amber-400 hover:bg-amber-950/30" },
  spell:       { border: "border-cyan-500",   text: "text-cyan-400",   acceptBtn: "border-cyan-500 text-cyan-400 hover:bg-cyan-950/30" },
  denarius:    { border: "border-yellow-500", text: "text-yellow-400", acceptBtn: "border-yellow-500 text-yellow-400 hover:bg-yellow-950/30" },
  skill_point: { border: "border-purple-500", text: "text-purple-400", acceptBtn: "border-purple-500 text-purple-400 hover:bg-purple-950/30" },
}

const typeLabel: Record<PendingOfferData["type"], string> = {
  item:        "Item Offer",
  spell:       "Spell Offer",
  denarius:    "Currency",
  skill_point: "Skill Point",
}

export function NotificationOverlay({ notification, pendingOffer, onDismiss, onAccept }: NotificationOverlayProps) {
  if (pendingOffer) {
    const accent = offerAccent[pendingOffer.type]
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        <div className={`relative flex flex-col items-center p-6 bg-gray-900 border ${accent.border} w-full max-w-md min-w-[320px] text-center transform animate-in zoom-in-95 duration-300`}>
          <p className={`text-[0.6rem] uppercase tracking-[0.3em] ${accent.text} mb-2`}>
            {typeLabel[pendingOffer.type]}
          </p>
          <p className="font-serif text-xl text-foreground mb-1">{pendingOffer.label}</p>
          {pendingOffer.quantity !== null && pendingOffer.quantity > 1 && (
            <p className={`text-xs uppercase tracking-widest ${accent.text} mb-1`}>
              ×{pendingOffer.quantity}
            </p>
          )}
          <p className="text-sm text-muted-foreground font-serif italic mt-3 mb-6">
            The GM is offering you a gift. Do you accept?
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onAccept}
              className={`flex-1 border ${accent.acceptBtn} text-[0.65rem] uppercase tracking-widest py-2.5 transition-colors`}
            >
              Accept
            </button>
            <button
              onClick={onDismiss}
              className="flex-1 border border-border text-muted-foreground text-[0.65rem] uppercase tracking-widest py-2.5 hover:border-foreground/40 transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!notification) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onDismiss} />
      <div className="relative flex flex-col items-center p-6 bg-gray-900 border border-green-500 rounded-xl shadow-2xl w-full max-w-md min-w-[320px] text-center transform animate-in zoom-in-95 duration-300">
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>

        {notification.url && (
          <img
            src={notification.url}
            alt="Item effect"
            className="w-24 h-24 object-contain mb-4 rounded border border-gray-700 bg-gray-800 p-2"
          />
        )}

        <p className="text-green-400 text-lg font-semibold mb-2">
          {notification.text ?? "Item consumed!"}
        </p>

        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-800 overflow-hidden rounded-b-xl">
          <div
            className="h-full bg-green-500 animate-shrink-width"
            style={{ width: "100%", transition: "width 10s linear" }}
          />
        </div>
      </div>
    </div>
  )
}
