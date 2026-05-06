import { Header } from "@/components/header"
import Link from "next/link"

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-20">
        <div className="max-w-2xl text-center">
          <h1 className="font-serif text-4xl md:text-5xl tracking-wide text-foreground mb-8">
            About KatabataK
          </h1>
          
          <div className="space-y-6 text-muted-foreground leading-relaxed">
            <p className="font-serif text-lg italic">
              Every journey needs a chronicle. Every hero needs a record.
            </p>
            
            <p>
              KatabataK is the digital game companion for the KatabataK tabletop role playing system. It allows
              the players and GM to seamlessly create and manage characters using the unique skill tree system, and 
              track those changes across interactions and combat. It comes with a complete skill tree for deep character
              customization, as well as a large item inventory and world database.
            </p>
          </div>

          <div className="mt-12">
            <Link 
              href="/"
              className="text-sm uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Return to login
              
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground/50">
          A Tool for Tabletop Adventurers
        </p>
      </footer>
    </div>
  )
}
