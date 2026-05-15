"use client"

interface Notification {
  text?: string
  url?: string
}

interface NotificationOverlayProps {
  notification: Notification
  onDismiss: () => void
}

export function NotificationOverlay({ notification, onDismiss }: NotificationOverlayProps) {
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