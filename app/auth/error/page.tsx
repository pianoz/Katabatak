import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <h1 className="font-serif text-4xl mb-4">Authentication Error</h1>
      <p className="text-muted-foreground mb-8 text-center max-w-md">
        Something went wrong during authentication. Please try again.
      </p>
      <Link 
        href="/" 
        className="text-sm uppercase tracking-widest hover:text-foreground/80 transition-colors"
      >
        Return Home
      </Link>
    </div>
  )
}
