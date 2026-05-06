import Link from "next/link"

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif text-2xl tracking-wide text-foreground hover:text-foreground/80 transition-colors">
          KatabataK
        </Link>
        <nav>
          <Link 
            href="/about" 
            className="text-sm uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  )
}
