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

  const handleUpdate = async () => {
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('profiles')
      .upsert({ 
        id: userId, 
        username: formData.username,
        full_name: formData.fullName, // Match your DB column name exactly
        updated_at: new Date().toISOString(),
      })

    setLoading(false)
    if (!error) {
      setIsOpen(false)
      router.refresh() // This tells the server component to fetch the new name!
    } else {
      alert(error.message)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="bg-background border-border font-serif sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl tracking-widest uppercase italic">Edit Chronicle</DialogTitle>
        </DialogHeader>
        
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
      </DialogContent>
    </Dialog>
  )
}