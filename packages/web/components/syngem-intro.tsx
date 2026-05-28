// @ts-nocheck
"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createCharacterWithItems } from "@/lib/services/character-service"
import { createSyngemGame } from "@/lib/services/syngem-game-service"
import { Loader2 } from "lucide-react"

// ─── Content ──────────────────────────────────────────────────────────────────

const INTRO_TEXT =
  `You were a child when you first heard the story. It was a singer of songs who came through. He was telling all the children.
  
  You remember it particularly because of the way he looked. A face like someone grabbed the sides and pulled downward.
  His eyes had a pleading quality, like an old dog. You sat with rapt attention for a whole hour. It went like nothing.
  Then it was dark and you had to run home through the reeds.

  The second time you were older, and there were travelers coming through. You always liked travelers.
  They spoke of the old places, the in-between places. The nowhere places in the far wilderness. You asked them what they sought 
  out there in the distances. They answered with a story.

  They answered that these were the days of Sun, and that the days of Rain would come again. They told you that already the old things in the high places and 
  the low places and the emptyness were stirring. But travelers always told tall tales.

  But now the story comes to you again, and it says that the sun does not shine forever. It says that these things are temporary things and this too shall pass.
  And this time you find it harder to ignore.

  `

const QUESTIONS = [
  "What name were you given?",
  "Were you raised in the city? or perhaps a town? was it the country or even a homestead?",
  "Describe your own appearance",
  "You've had a dream, and in this dream there was a painting, and in this painting was a man. Describe the man.",
  "What are you running from?",
]

// ─── Typewriter hook ──────────────────────────────────────────────────────────

function useTypewriter(text: string, speed = 18) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed("")
    setDone(false)
    if (!text) return

    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(interval)
        setDone(true)
      }
    }, speed)
    return () => clearInterval(interval)
  }, [text, speed])

  return { displayed, done }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SyngemIntroProps {
  userId: string
}

type Phase = "intro" | "questions" | "loading" | "error"

export function SyngemIntro({ userId }: SyngemIntroProps) {
  const router = useRouter()
  const supabase = createClient()
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [phase, setPhase] = useState<Phase>("intro")
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [inputValue, setInputValue] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // What text to typewrite depends on phase and question index
  const activeText =
    phase === "intro"
      ? INTRO_TEXT
      : phase === "questions"
      ? QUESTIONS[questionIndex]
      : ""

  const { displayed, done: typewritingDone } = useTypewriter(
    activeText,
    phase === "intro" ? 18 : 28
  )

  // Focus input once question finishes typewriting
  useEffect(() => {
    if (typewritingDone && phase === "questions") {
      inputRef.current?.focus()
    }
  }, [typewritingDone, phase, questionIndex])

  const handleIntroAdvance = () => {
    setPhase("questions")
  }

  const handleAnswerSubmit = () => {
    const trimmed = inputValue.trim()
    if (!trimmed) return

    const newAnswers = [...answers, trimmed]
    setAnswers(newAnswers)
    setInputValue("")

    if (questionIndex < QUESTIONS.length - 1) {
      setQuestionIndex((prev) => prev + 1)
    } else {
      void handleBegin(newAnswers)
    }
  }

  const handleBegin = async (allAnswers: string[]) => {
    setPhase("loading")
    setErrorMessage(null)

    try {
      const res = await fetch("/api/character-creator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: QUESTIONS, answers: allAnswers }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Server error ${res.status}`)
      }
      const creatorResult = await res.json() as {
        background_primary: string
        background_secondary: string
        physical_description: string
        backstory: string
      }

      const height = 170
      const weight = 70
      const newChar = await createCharacterWithItems(supabase, {
        user_id: userId,
        name: allAnswers[0],
        syngem_game: true,
        ai_game: true,
        background_primary: creatorResult.background_primary,
        background_secondary: creatorResult.background_secondary,
        physical_description: creatorResult.physical_description,
        backstory: creatorResult.backstory,
        level: 1,
        current_health: 10,
        health_max: 10,
        current_essence: 10,
        essence_max: 10,
        current_power: 10,
        power_max: 10,
        current_will: 10,
        will_max: 10,
        speed: Math.round(height / 13),
        height,
        weight_kgs: weight,
        carrying_capacity: Math.round(weight * 0.4),
        denarius: 0,
      })

      if (!newChar) throw new Error("Failed to create character record")

      await createSyngemGame(supabase, newChar.id, userId)

      router.push(`/characters/${newChar.id}`)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Try again.")
      setPhase("error")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleAnswerSubmit()
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <p className="text-[9px] uppercase tracking-[0.5em] text-cyan-900 font-mono mb-12 text-center">
          SYNGEM — Chronicle Engine
        </p>

        {/* ── Intro phase ────────────────────────────────────────────── */}
        {(phase === "intro") && (
          <div className="space-y-8">
            <div className="border-l-2 border-cyan-900/40 pl-6">
              <p className="font-serif text-zinc-300 text-base leading-loose whitespace-pre-line">
                {displayed}
                {!typewritingDone && (
                  <span className="inline-block w-0.5 h-4 bg-cyan-500/60 animate-pulse ml-0.5 align-middle" />
                )}
              </p>
            </div>
            {typewritingDone && (
              <div className="text-center animate-in fade-in duration-700">
                <button
                  onClick={handleIntroAdvance}
                  className="text-xs uppercase tracking-[0.4em] text-cyan-600 hover:text-cyan-400 border border-cyan-900/40 hover:border-cyan-700/60 px-8 py-3 transition-all"
                >
                  Begin
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Questions phase ─────────────────────────────────────────── */}
        {phase === "questions" && (
          <div className="space-y-8">
            {/* Previously answered questions */}
            {answers.map((answer, i) => (
              <div key={i} className="space-y-1 opacity-40">
                <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                  {QUESTIONS[i]}
                </p>
                <p className="font-serif text-zinc-400 text-sm">{answer}</p>
              </div>
            ))}

            {/* Current question */}
            <div className="space-y-4">
              <p className="font-serif text-zinc-200 text-lg leading-relaxed">
                {displayed}
                {!typewritingDone && (
                  <span className="inline-block w-0.5 h-5 bg-cyan-500/60 animate-pulse ml-0.5 align-middle" />
                )}
              </p>

              {typewritingDone && (
                <div className="animate-in fade-in duration-500">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                    placeholder="Your answer…"
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-800/60 focus:outline-none text-zinc-200 font-serif text-sm leading-relaxed px-4 py-3 resize-none placeholder:text-zinc-700 transition-colors"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[9px] uppercase tracking-widest text-zinc-700 font-mono">
                      Press Enter to continue
                    </span>
                    <button
                      onClick={handleAnswerSubmit}
                      disabled={!inputValue.trim()}
                      className="text-[10px] uppercase tracking-[0.3em] text-cyan-700 hover:text-cyan-400 border border-cyan-900/40 hover:border-cyan-700/60 px-4 py-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {questionIndex < QUESTIONS.length - 1 ? "Continue" : "Finish"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Loading phase ─────────────────────────────────────────── */}
        {phase === "loading" && (
          <div className="text-center space-y-4">
            <Loader2 className="w-6 h-6 text-cyan-600 animate-spin mx-auto" />
            <p className="text-xs uppercase tracking-[0.4em] text-zinc-600 font-mono">
              The Chronicle Weaver is at work…
            </p>
          </div>
        )}

        {/* ── Error phase ────────────────────────────────────────────── */}
        {phase === "error" && (
          <div className="text-center space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-red-600">
              {errorMessage}
            </p>
            <button
              onClick={() => {
                setPhase("questions")
                setAnswers([])
                setQuestionIndex(0)
                setInputValue("")
              }}
              className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-600 px-6 py-2 transition-all"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
