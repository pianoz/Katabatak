"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

export function LoginForm() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [username, setUsername] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    const supabase = createClient()

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      router.push("/dashboard")
      router.refresh()
    } else {
      if (password !== confirmPassword) {
        setError("Passwords do not match")
        setLoading(false)
        return
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
        // This 'data' object is what 'raw_user_meta_data' looks at in the SQL above
        data: {
          username: username, 
          avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`, // Bonus: Random avatar
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      setMessage("Check your email to confirm your account")
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="text-sm text-red-400 border border-red-400/30 bg-red-400/10 px-4 py-3">
            {error}
          </div>
        )}

        {message && (
          <div className="text-sm text-green-400 border border-green-400/30 bg-green-400/10 px-4 py-3">
            {message}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm uppercase tracking-widest text-muted-foreground">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="wanderer@realm.com"
            required
            disabled={loading}
            className="bg-input border-border text-foreground placeholder:text-muted-foreground/50 focus:border-foreground focus:ring-0 transition-colors"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm uppercase tracking-widest text-muted-foreground">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={loading}
            className="bg-input border-border text-foreground placeholder:text-muted-foreground/50 focus:border-foreground focus:ring-0 transition-colors"
          />
        </div>

        {!isLogin && (
        <>
          {/* Username - This maps to your profiles table via the Trigger */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm uppercase tracking-widest text-muted-foreground">
              Username
            </Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your Legend's Name"
              required
              disabled={loading}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground/50 focus:border-foreground focus:ring-0 transition-colors"
            />
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm uppercase tracking-widest text-muted-foreground">
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground/50 focus:border-foreground focus:ring-0 transition-colors"
            />
          </div>
        </>
      )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-sm py-6 transition-all disabled:opacity-50"
        >
          {loading ? "..." : isLogin ? "Enter" : "Begin Journey"}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin)
            setError(null)
            setMessage(null)
          }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
        >
          {isLogin ? "New Traveler" : "Already have an account?"}
        </button>
      </div>
    </div>
  )
}
