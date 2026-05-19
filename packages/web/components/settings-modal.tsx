"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Settings } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SettingsModalProps {
  userId: string
  initialProfile: {
    username: string
    fullName: string
  }
}

export function SettingsModal({ userId, initialProfile }: SettingsModalProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    username: initialProfile.username || "",
    fullName: initialProfile.fullName || "",
  })
  const [passwordData, setPasswordData] = useState({ newPassword: "", confirmPassword: "" })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: "error" | "success"; text: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const handleUpdate = async () => {
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        username: formData.username,
        full_name: formData.fullName,
        updated_at: new Date().toISOString(),
      })

    setLoading(false)
    if (!error) {
      setIsOpen(false)
      router.refresh()
    } else {
      alert(error.message)
    }
  }

  const handlePasswordChange = async () => {
    setPasswordMsg(null)
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMsg({ type: "error", text: "Passwords do not match" })
      return
    }
    if (passwordData.newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "Password must be at least 6 characters" })
      return
    }
    setPasswordLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword })
    setPasswordLoading(false)
    if (error) {
      setPasswordMsg({ type: "error", text: error.message })
    } else {
      setPasswordMsg({ type: "success", text: "Password updated successfully" })
      setPasswordData({ newPassword: "", confirmPassword: "" })
    }
  }

  const handleDeleteAccount = async () => {
    setDeleteLoading(true)
    const res = await fetch("/api/auth/delete-account", { method: "DELETE" })
    if (res.ok) {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push("/")
    } else {
      const data = await res.json()
      alert(data.error || "Failed to delete account")
      setDeleteLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-background border-border font-serif sm:max-w-106.25 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl tracking-widest uppercase italic">Edit Account</DialogTitle>
        </DialogHeader>

        {/* Profile */}
        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-xs uppercase tracking-tighter">Traveler Handle</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              className="bg-input border-border focus:ring-0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-xs uppercase tracking-tighter">Full Name</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              placeholder="e.g. Alaric the Bold"
              className="bg-input border-border focus:ring-0"
            />
          </div>
        </div>

        <Button
          onClick={handleUpdate}
          disabled={loading}
          className="w-full bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
        >
          {loading ? "Communing with Database..." : "Save Changes"}
        </Button>

        {/* Change Password */}
        <div className="border-t border-border/50 pt-6 mt-2 grid gap-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Change Password</p>

          {passwordMsg && (
            <div className={`text-sm px-3 py-2 border ${
              passwordMsg.type === "error"
                ? "text-red-400 border-red-400/30 bg-red-400/10"
                : "text-green-400 border-green-400/30 bg-green-400/10"
            }`}>
              {passwordMsg.text}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-xs uppercase tracking-tighter">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              placeholder="••••••••"
              className="bg-input border-border focus:ring-0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmNewPassword" className="text-xs uppercase tracking-tighter">Confirm Password</Label>
            <Input
              id="confirmNewPassword"
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              placeholder="••••••••"
              className="bg-input border-border focus:ring-0"
            />
          </div>

          <Button
            onClick={handlePasswordChange}
            disabled={passwordLoading || !passwordData.newPassword}
            variant="outline"
            className="w-full uppercase tracking-widest text-xs border-border"
          >
            {passwordLoading ? "Updating..." : "Update Password"}
          </Button>
        </div>

        {/* Danger Zone */}
        <div className="border-t border-red-900/50 pt-6 mt-2 grid gap-4">
          <p className="text-xs uppercase tracking-widest text-red-500/70">Danger Zone</p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={deleteLoading}
                className="w-full uppercase tracking-widest text-xs border-red-900/50 text-red-400 hover:bg-red-900/20 hover:text-red-300"
              >
                {deleteLoading ? "Erasing..." : "Delete Account"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-background border-border font-serif">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl tracking-widest uppercase">Erase Chronicle?</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  This will permanently delete your account and all associated data. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="uppercase tracking-widest text-xs">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-red-900 text-red-100 hover:bg-red-800 uppercase tracking-widest text-xs"
                >
                  Erase Forever
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  )
}