// components/item-table.tsx
"use client"

import { getConditionStyle } from "@/lib/utils"

const COLUMN_LABELS: Record<string, string> = {
  damage:            "Damage",
  defence:           "Armor",
  weight:            "Weight",
  short_description: "Short Description",
  condition:         "Condition",
}

export interface Item {
  id: string
  name: string
  type: string
  hidden: boolean // 1. Added the hidden property
  subtype?: string
  weight?: number
  short_description?: string
  damage?: number
  defence?: number
  character_id: string
  condition: number
  consumable: boolean
  die_count?: number
  modifier?: number
  modifier_attribute_name?: string
  coefficient?: number
  coefficient_attribute_name?: string
  cost?: number
  cost_attribute_name?: "power" | "will"
  image_url?: string
  action_text?: string
}

interface ItemTableProps {
  items: Item[]
  columns: string[]
  emptyMessage: string
  onRepair?: (item: Item) => void
  onConsume?: (item: Item) => void
  onDrop?: (item: Item) => void
  onInspect?: (item: Item) => void
}

export function ItemTable({ items, columns, emptyMessage, onRepair, onConsume, onDrop, onInspect }: ItemTableProps) {
  // 2. Filter the items list once at the top of the component
  const visibleItems = items.filter(item => !item.hidden)

  // 3. Use visibleItems for the empty state check
  if (visibleItems.length === 0) {
    return (
      <div className="border border-border bg-card p-6 text-center">
        <p className="text-muted-foreground text-sm italic font-serif">{emptyMessage}</p>
      </div>
    )
  }

  const genericColumns = columns.filter((col) => col !== "condition")
  const showCondition  = columns.includes("condition")

  return (
    <div className="border border-border bg-card overflow-hidden">
      {/* ── Mobile view ── */}
      <div className="md:hidden divide-y divide-border">
        {/* 4. Use visibleItems here */}
        {visibleItems.map((item) => (
          <div key={item.id} className="p-4 space-y-3 hover:bg-secondary/10 transition-colors">
            {/* ... mobile row content remains same ... */}
            <div className="flex justify-between items-start">
               <button
                 onClick={() => onInspect?.(item)}
                 className="flex flex-col items-start group text-left"
               >
                 <h4 className="font-serif text-lg text-foreground group-hover:text-cyan-400 transition-colors underline decoration-dotted decoration-muted-foreground/30 underline-offset-4">
                   {item.name}
                 </h4>
                 <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
                   {item.weight} lbs • <span className="text-cyan-500/70">View Details</span>
                 </p>
               </button>

               {showCondition && (
                 <div
                   className="flex flex-col items-center justify-center w-10 h-10 rounded-sm"
                   style={getConditionStyle(item.condition)}
                 >
                   <span className="text-[8px] uppercase text-white/60 tracking-tight leading-none mb-0.5">
                     Cond
                   </span>
                   <span className="text-[11px] font-semibold text-white/90 leading-none">
                     {item.condition}%
                   </span>
                 </div>
               )}
             </div>

             <div className="grid grid-cols-2 gap-2 text-sm">
               {genericColumns
                 .filter((c) => c !== "name" && c !== "weight")
                 .map((col) => (
                   <div key={col} className="flex flex-col">
                     <span className="text-[10px] uppercase text-muted-foreground tracking-tighter">
                       {COLUMN_LABELS[col] ?? col}
                     </span>
                     <span className="text-foreground/90">{item[col as keyof Item] ?? "—"}</span>
                   </div>
                 ))}
             </div>

             <div className="flex gap-2 pt-2">
               {!item.consumable && (item.condition ?? 100) < 100 && (
                 <button
                   onClick={() => onRepair?.(item)}
                   className="flex-1 py-2 text-xs bg-blue-900/30 text-blue-400 border border-blue-800 active:bg-blue-800 transition-all"
                 >
                   Repair
                 </button>
               )}
               {item.consumable && (
                 <button
                   onClick={() => window.confirm(`Use ${item.name}? This will destroy it.`) && onConsume?.(item)}
                   className="flex-1 py-2 text-xs bg-green-900/30 text-green-400 border border-green-800 active:bg-green-800 transition-all"
                 >
                   Use
                 </button>
               )}
               <button
                 onClick={() => window.confirm(`Drop ${item.name}?`) && onDrop?.(item)}
                 className="flex-1 py-2 text-xs bg-red-900/30 text-red-400 border border-red-800 active:bg-red-800 transition-all"
               >
                 Drop
               </button>
             </div>
          </div>
        ))}
      </div>

      {/* ── Desktop view ── */}
      <table className="hidden md:table w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            {genericColumns.map((col) => (
              <th key={col} className="text-xs uppercase tracking-widest text-muted-foreground p-3 font-normal">
                {COLUMN_LABELS[col] ?? col}
              </th>
            ))}
            {showCondition && (
              <th className="text-xs uppercase tracking-widest text-muted-foreground p-3 font-normal">
                {COLUMN_LABELS["condition"]}
              </th>
            )}
            <th className="w-px whitespace-nowrap text-right text-xs uppercase tracking-widest text-muted-foreground p-3 font-normal">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {/* 5. Use visibleItems here */}
          {visibleItems.map((item) => (
            <tr key={item.id} className="border-b border-border hover:bg-secondary/20 transition-colors">
              {/* ... desktop row content remains same ... */}
              {genericColumns.map((col) => (
                 <td key={col} className="p-3 text-sm text-foreground">
                   {col === "name" ? (
                     <button
                       onClick={() => onInspect?.(item)}
                       className="font-serif text-left hover:text-cyan-400 transition-colors underline decoration-dotted decoration-muted-foreground/30 underline-offset-4"
                     >
                       {item.name}
                     </button>
                   ) : (
                     <span className="text-foreground/80">{item[col as keyof Item] ?? "—"}</span>
                   )}
                 </td>
               ))}

               {showCondition && (
                 <td className="p-3 text-sm text-foreground whitespace-nowrap">
                   <div className="flex items-center gap-2">
                     <div className="w-12 h-2 bg-secondary rounded-full overflow-hidden">
                       <div
                         className="h-full transition-all"
                         style={{
                           width: `${item.condition}%`,
                           backgroundColor: getConditionStyle(item.condition).backgroundColor,
                         }}
                       />
                     </div>
                     <span className="text-[10px] tabular-nums">{item.condition}%</span>
                   </div>
                 </td>
               )}

               <td className="p-3 text-right space-x-2 whitespace-nowrap">
                 {!item.consumable && (item.condition ?? 100) < 100 && (
                   <button
                     onClick={() => onRepair?.(item)}
                     className="px-2 py-1 text-xs bg-blue-900/30 text-blue-400 border border-blue-800 hover:bg-blue-800 hover:text-white transition-all"
                   >
                     Repair 1d10
                   </button>
                 )}
                 {item.consumable && (
                   <button
                     onClick={async () => {
                       if (window.confirm(`Use ${item.name}? This will destroy it.`)) {
                         await onConsume?.(item)
                       }
                     }}
                     className="px-2 py-1 text-xs bg-green-900/30 text-green-400 border border-green-800 hover:bg-green-800 hover:text-white transition-all"
                   >
                     Use
                   </button>
                 )}
                 <button
                   onClick={() => window.confirm(`Drop ${item.name}?`) && onDrop?.(item)}
                   className="px-2 py-1 text-xs bg-red-900/30 text-red-400 border border-red-800 hover:bg-red-800 hover:text-white transition-all"
                 >
                   Drop
                 </button>
               </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}