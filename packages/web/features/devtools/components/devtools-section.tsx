import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Wrench } from "lucide-react"

export function DevToolsSection() {
  return (
    <div className="mt-16 pt-8 border-t border-border">
      <div className="flex items-center gap-3 mb-6">
        <Wrench className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
          Dev Tools
        </h2>
      </div>
      <div className="flex flex-wrap gap-4">
        <Link href="/dev/skill-tree">
          <Button
            variant="outline"
            className="border-border text-foreground hover:bg-card uppercase tracking-widest text-xs"
          >
            Modify Skill Tree
          </Button>
        </Link>
        <Button
          asChild
          variant="outline"
          className="border-border text-foreground hover:bg-card uppercase tracking-widest text-xs"
        >
          <Link href="/dev/items">
            Modify Items
          </Link>
        </Button>
        <Link href="/dev/spells">
          <Button
            variant="outline"
            className="border-border text-foreground hover:bg-card uppercase tracking-widest text-xs"
          >
            Modify Spells
          </Button>
        </Link>
        <Link href="/dev/active-skills">
          <Button
            variant="outline"
            className="border-border text-foreground hover:bg-card uppercase tracking-widest text-xs"
          >
            Active Skills Editor
          </Button>
        </Link>
        <Link href="/dev/users">
          <Button
            variant="outline"
            className="border-border text-foreground hover:bg-card uppercase tracking-widest text-xs"
          >
            Modify Users
          </Button>
        </Link>
      </div>
    </div>
  )
}
