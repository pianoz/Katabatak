import { Header } from "@/components/header"
import Link from "next/link"

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-20">
        <div className="max-w-2xl w-full">
          <h1 className="font-serif text-4xl md:text-5xl tracking-wide text-foreground mb-4 text-center">
            About Katabatak
          </h1>

          <p className="font-serif text-lg italic text-muted-foreground text-center mb-12">
            Some records are kept in blood. Some in ink. Katabatak keeps both.
          </p>

          <div className="space-y-10">
            <section className="border border-border p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4">
                The Companion
              </p>
              <p className="font-serif text-foreground leading-relaxed">
                A digital platform for the Katabatak tabletop RPG system. Create and manage
                characters with a deep skill tree, track inventory and spells across sessions,
                and run combat with a full party. Built for GMs who want less bookkeeping and
                players who want their character&apos;s history preserved.
              </p>
            </section>

            <section className="border border-cyan-500/40 p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-500 mb-4">
                SYNGEM — AI Game Master
              </p>
              <p className="font-serif text-foreground leading-relaxed mb-4">
                For those who play alone, or cannot wait for the next session. SYNGEM is an AI
                Game Master built for the Katabatak world — one that parses what you actually
                mean, narrates the consequences, and updates the world state after every turn.
              </p>
              <p className="font-serif text-muted-foreground leading-relaxed">
                Not a chatbot reading your messages. A system that maintains a living record of
                your character&apos;s journey — tracking quests, NPCs, locations, and the choices
                that define who you are becoming.
              </p>
            </section>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/"
              className="text-sm uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Return
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
