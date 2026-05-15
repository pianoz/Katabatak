import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getConditionStyle(percent: number): React.CSSProperties {
  const p = Math.min(Math.max(percent, 1), 100) / 100
  const start = { r: 92, g: 1, b: 1 }
  const end   = { r: 3,  g: 92, b: 1 }
  const r = Math.round(start.r + (end.r - start.r) * p)
  const g = Math.round(start.g + (end.g - start.g) * p)
  const b = Math.round(start.b + (end.b - start.b) * p)
  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    transition: "background-color 0.5s ease-in",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  }
}