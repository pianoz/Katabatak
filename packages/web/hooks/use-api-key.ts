"use client"

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'katabatak_anthropic_key'

export interface UseApiKeyReturn {
  apiKey: string | null
  hasKey: boolean
  setApiKey: (key: string) => void
  clearApiKey: () => void
}

/**
 * Manages the user's BYOK Anthropic API key in localStorage.
 * The key is NEVER written to the server — it travels only as a per-request header.
 * Returns null on initial render (SSR-safe).
 */
export function useApiKey(): UseApiKeyReturn {
  const [apiKey, setApiKeyState] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) setApiKeyState(stored)
  }, [])

  const setApiKey = useCallback((key: string) => {
    localStorage.setItem(STORAGE_KEY, key)
    setApiKeyState(key)
  }, [])

  const clearApiKey = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setApiKeyState(null)
  }, [])

  return { apiKey, hasKey: !!apiKey, setApiKey, clearApiKey }
}
