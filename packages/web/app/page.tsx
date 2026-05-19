import { Header } from "@/components/header"
import { NarrativeExcerpts } from "@/components/narrative-excerpts"
import { LoginForm } from "@/components/login-form"

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 flex flex-col px-6 md:px-12 lg:px-20 pt-24 pb-12">
        {/* Hero Title */}
        <div className="text-center md:text-left mb-12">
          <h1 className="font-serif text-6xl md:text-8xl tracking-wide text-foreground mb-4">
            KatabataK
          </h1>
          <div className="w-24 h-px bg-border mx-auto md:mx-0 mb-6" />
        </div>

        {/* Narrative Excerpts */}
        <div className="w-full max-w-2xl mb-16">
          <NarrativeExcerpts />
        </div>

        {/* Decorative Divider */}
        <div className="flex items-center gap-4 mb-12 justify-center md:justify-start">
        </div>

        {/* Login Form - Left aligned */}
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-left">
        <p className="text-xs uppercase tracking-widest text-muted-foreground/50">
          A Tool for Tabletop Adventurers
        </p>
      </footer>
    </div>
  )
}
