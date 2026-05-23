"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, ShieldCheck, ShieldOff, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { setUserDevStatus } from "@/lib/services/admin-service"

interface Profile {
  id: string
  username: string | null
  full_name: string | null
  is_dev: boolean | null
  email?: string | null
}

export default function DevUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/"); return }
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_dev")
        .eq("id", user.id)
        .single()
      if (!profile?.is_dev) { router.push("/dashboard"); return }

      setCurrentUserId(user.id)

      const [{ data: profiles }, emailsRes] = await Promise.all([
        supabase.from("profiles").select("id, username, full_name, is_dev").order("username"),
        fetch("/api/dev/users"),
      ])

      const emailMap: Record<string, string | null> = {}
      if (emailsRes.ok) {
        const emailData: { id: string; email: string | null }[] = await emailsRes.json()
        for (const e of emailData) emailMap[e.id] = e.email
      }

      if (profiles) {
        setUsers(profiles.map(p => ({ ...p, email: emailMap[p.id] ?? null })) as Profile[])
      }
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSetDev(userId: string, value: boolean) {
    setWorking(userId)
    const supabase = createClient()
    const { success } = await setUserDevStatus(supabase, userId, value)
    if (success) setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_dev: value } : u))
    setWorking(null)
  }

  async function handleDelete(userId: string) {
    setWorking(userId)
    const supabase = createClient()
    await supabase.from("profiles").delete().eq("id", userId)
    setUsers(prev => prev.filter(u => u.id !== userId))
    setConfirmDelete(null)
    setWorking(null)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="px-6 md:px-12 lg:px-20 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
              User Management
            </h1>
          </div>
          <Link href="/dashboard" className="font-serif text-lg tracking-wide text-muted-foreground hover:text-foreground">
            KatabataK
          </Link>
        </div>
      </header>

      <main className="px-6 md:px-12 lg:px-20 py-8">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="font-serif text-xl text-foreground">Users</h2>
          {!loading && (
            <span className="font-sans text-[0.6rem] tracking-widest uppercase text-muted-foreground border border-border px-2 py-0.5">
              {users.length} total
            </span>
          )}
        </div>

        {loading ? (
          <div className="border border-border bg-card p-12 text-center">
            <p className="font-serif text-muted-foreground italic">Loading users…</p>
          </div>
        ) : users.length === 0 ? (
          <div className="border border-border bg-card p-12 text-center">
            <p className="font-serif text-muted-foreground italic">No users found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="border border-border bg-card px-5 py-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-base text-foreground truncate">
                      {user.username ?? <span className="italic text-muted-foreground">no username</span>}
                    </span>
                    {user.is_dev && (
                      <span className="font-sans text-[0.55rem] tracking-widest uppercase border border-cyan-700/50 text-cyan-400 px-1.5 py-0.5 shrink-0">
                        dev
                      </span>
                    )}
                    {user.id === currentUserId && (
                      <span className="font-sans text-[0.55rem] tracking-widest uppercase border border-border text-muted-foreground px-1.5 py-0.5 shrink-0">
                        you
                      </span>
                    )}
                  </div>
                  {user.full_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">{user.full_name}</p>
                  )}
                  {user.email && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5 font-mono">{user.email}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {confirmDelete === user.id ? (
                    <>
                      <span className="font-sans text-[0.6rem] tracking-widest uppercase text-muted-foreground">
                        Delete?
                      </span>
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={!!working}
                        className="font-sans text-[0.65rem] tracking-widest uppercase border border-destructive/50 text-destructive px-3 py-1.5 hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      >
                        {working === user.id ? "…" : "Yes"}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="font-sans text-[0.65rem] tracking-widest uppercase border border-border text-muted-foreground px-3 py-1.5 hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {user.is_dev ? (
                        <button
                          onClick={() => handleSetDev(user.id, false)}
                          disabled={!!working || user.id === currentUserId}
                          className="flex items-center gap-1.5 font-sans text-[0.65rem] tracking-widest uppercase border border-border text-muted-foreground px-3 py-1.5 hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={user.id === currentUserId ? "Cannot demote yourself" : undefined}
                        >
                          <ShieldOff className="w-3 h-3" />
                          Demote
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSetDev(user.id, true)}
                          disabled={!!working}
                          className="flex items-center gap-1.5 font-sans text-[0.65rem] tracking-widest uppercase border border-cyan-700/50 text-cyan-400 px-3 py-1.5 hover:bg-cyan-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          Elevate
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDelete(user.id)}
                        disabled={!!working || user.id === currentUserId}
                        className="flex items-center gap-1.5 font-sans text-[0.65rem] tracking-widest uppercase border border-destructive/30 text-destructive px-3 py-1.5 hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={user.id === currentUserId ? "Cannot delete yourself" : undefined}
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
