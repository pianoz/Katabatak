"use client"

import { useState } from "react"
import { useApiKey } from "@/hooks/use-api-key"
import { Key, CheckCircle, XCircle, Loader2, Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type ValidationStatus = "idle" | "validating" | "valid" | "invalid"

export function ApiKeySettings() {
  const { apiKey, setApiKey, clearApiKey } = useApiKey()
  const [draft, setDraft] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState<ValidationStatus>("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const maskedDisplay = apiKey
    ? `${apiKey.slice(0, 12)}...${apiKey.slice(-4)}`
    : null

  const handleValidateAndSave = async () => {
    if (!draft.trim()) return
    setStatus("validating")
    setErrorMsg(null)

    try {
      const res = await fetch("/api/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: draft.trim() }),
      })
      const data = await res.json() as { valid: boolean; error?: string }
      if (data.valid) {
        setApiKey(draft.trim())
        setDraft("")
        setStatus("valid")
      } else {
        setStatus("invalid")
        setErrorMsg(data.error ?? "Key validation failed")
      }
    } catch {
      setStatus("invalid")
      setErrorMsg("Could not reach validation endpoint")
    }
  }

  return (
    <div className="border-t border-border/50 pt-6 mt-2 grid gap-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
        <Key className="w-3 h-3 text-cyan-500" />
        Anthropic API Key
      </p>

      {apiKey ? (
        <div className="flex items-center justify-between px-3 py-2 border border-cyan-900/40 bg-cyan-950/20 text-xs font-mono text-cyan-400">
          <span>{showKey ? apiKey : maskedDisplay}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowKey((v) => !v)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
            <button onClick={clearApiKey} className="text-red-700 hover:text-red-400">
              <XCircle className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-600 uppercase tracking-widest">No key stored</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="apiKey" className="text-xs uppercase tracking-tighter">
          {apiKey ? "Replace Key" : "Enter Key"}
        </Label>
        <Input
          id="apiKey"
          type="password"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setStatus("idle") }}
          placeholder="sk-ant-..."
          className="bg-input border-border focus:ring-0 font-mono text-xs"
        />
      </div>

      {status === "invalid" && errorMsg && (
        <div className="text-xs px-3 py-2 border text-red-400 border-red-400/30 bg-red-400/10">
          {errorMsg}
        </div>
      )}
      {status === "valid" && (
        <div className="text-xs px-3 py-2 border text-cyan-400 border-cyan-400/30 bg-cyan-400/10 flex items-center gap-2">
          <CheckCircle className="w-3 h-3" />
          Key validated and saved to this browser.
        </div>
      )}

      <p className="text-[10px] text-zinc-600 uppercase tracking-widest leading-relaxed">
        Stored only in this browser. Never sent to our servers except as a per-request header over HTTPS.
        Clear your browser cache to remove it.
      </p>

      <Button
        onClick={handleValidateAndSave}
        disabled={!draft.trim() || status === "validating"}
        variant="outline"
        className="w-full uppercase tracking-widest text-xs border-cyan-900/50 text-cyan-400 hover:bg-cyan-900/20"
      >
        {status === "validating" ? (
          <><Loader2 className="w-3 h-3 animate-spin mr-2" />Validating…</>
        ) : (
          "Validate & Save Key"
        )}
      </Button>
    </div>
  )
}
