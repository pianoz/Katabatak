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
  `
  There was a place in the woods near your house as a child.

  Four stone columns of ancient design.

  Names inscribed in a language long forgotten.

  Half-buried rubble strewn about.

  You would play there when you were younger. You would pretend to be one of those people from the stories.

  "Gather round," the bard would say, eyes shining in the evening dark. "and let me tell you of the Days of Rain."

  You still remember the sound of his voice, the whispers, the lute as clanging steel, swords on swords on swords. Steel singing, men reaching for men, and above it all a violet sun and the hum of something other, something gone.

  Magic.

  The essence of the world.

  And then you would all hurry home.

  But that place in the forest was where the stories became real, if only for a while. It was what drew you back You were Aladar the Brave or Maredea the Wise. You and your friends would gather there and play pretend among the squirrels and the trees -- the ruined columns and the dead-eyed statues lying just under the earth.
  Unseeing eyes.

  But those are all stories, and we left them behind with the cloak of childhood.

  These are the Days of Sun, and do not think of the Days of Rain. We are a people of reason, and we live beyond the long horizon of legend.
  There are no dragons in the east. There are no barrow-kings beneath our halls. Look at the birds they come in the spring and nest.
  The wheat comes up gold in the summer. There, the miller's daughter can tell you. She is wheat herself. The people come up gold every year.
  Birds roost, the snow falls, the insects sing their night song, and we all rest easy because there are no Days of Rain. There are no pale things, sneaking from the wide dark.
  There are no shadows dripping from the eaves of long-forgotten temples, columns, left to rot in the fields where children play, coalescing into something reaching and curious.
  
  There is no such thing as Essence.
  
  There is no such thing as magic.

  Or at least, that is what they say...
  `

const QUESTIONS = [
  "What name were you given?",
  "There are cities, towns, villages and homesteads. Which are you from?",
  "You had a frightening experience as a child. What was it?",
  "What have you done for work?",
  "A bird turns, lonely in the thermals. What is he searching for and why is he alone?",
  "What skills do you have?",
  "You've had a dream, and in this dream there was a painting, and in this painting was a man. Describe the man.",
  "What did your father do?",
  "Humans are the thickened desire of the world, the monks say. What is yours?",
  "What caused you to leave your previous life?"
]

const STORY = [
  `
  You have been traveling for days. Originally you took up with caravan heading south because that was where you though answers might lie. You packed up and took your time. 
  `
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

type Phase = "intro" | "questions" | "loading" | "reveal" | "error"

interface CreatorResult {
  background_primary: string
  background_secondary: string
  physical_description: string
  backstory: string
  story_hook: string
  initial_quest: { id: string; title: string; status: string; description: string }
}

export function SyngemIntro({ userId }: SyngemIntroProps) {
  const router = useRouter()
  const supabase = createClient()
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [phase, setPhase] = useState<Phase>("intro")
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [inputValue, setInputValue] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [creatorResult, setCreatorResult] = useState<CreatorResult | null>(null)
  const [characterId, setCharacterId] = useState<string | null>(null)

  // What text to typewrite depends on phase and question index
  const activeText =
    phase === "intro"
      ? INTRO_TEXT
      : phase === "questions"
      ? QUESTIONS[questionIndex]
      : phase === "reveal"
      ? (creatorResult?.story_hook ?? "")
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
      const creatorResult = await res.json() as CreatorResult

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
        quest_objectives: creatorResult.initial_quest ? [creatorResult.initial_quest] : [],
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

      setCreatorResult(creatorResult)
      setCharacterId(newChar.id)
      setPhase("reveal")
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

  const handleRevealAdvance = () => {
    if (characterId) router.push(`/characters/${characterId}`)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-16">
      <div className={`w-full ${phase === "reveal" ? "max-w-5xl" : "max-w-2xl"}`}>
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

        {/* ── Reveal phase ──────────────────────────────────────────── */}
        {phase === "reveal" && creatorResult && (
          <div className="flex gap-12 items-start animate-in fade-in duration-700">
            {/* Left panel — character identity */}
            <div className="w-[30%] shrink-0 space-y-6 pt-1">
              <div>
                <p className="text-[9px] uppercase tracking-[0.4em] text-zinc-600 font-mono mb-1">Character</p>
                <p className="font-serif text-zinc-100 text-2xl leading-snug">{answers[0]}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-600 font-mono">Origin</p>
                <p className="font-serif text-zinc-400 text-sm leading-relaxed">{creatorResult.background_primary}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-600 font-mono">Circumstance</p>
                <p className="font-serif text-zinc-400 text-sm leading-relaxed">{creatorResult.background_secondary}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-600 font-mono">Appearance</p>
                <p className="font-serif text-zinc-400 text-sm leading-relaxed">{creatorResult.physical_description}</p>
              </div>
            </div>

            {/* Center panel — story hook */}
            <div className="flex-1 space-y-8">
              <div className="border-l-2 border-cyan-900/40 pl-6">
                <p className="font-serif text-zinc-300 text-base leading-loose">
                  {displayed}
                  {!typewritingDone && (
                    <span className="inline-block w-0.5 h-4 bg-cyan-500/60 animate-pulse ml-0.5 align-middle" />
                  )}
                </p>
              </div>
              {typewritingDone && (
                <div className="pl-6 animate-in fade-in duration-700">
                  <button
                    onClick={handleRevealAdvance}
                    className="text-xs uppercase tracking-[0.4em] text-cyan-600 hover:text-cyan-400 border border-cyan-900/40 hover:border-cyan-700/60 px-8 py-3 transition-all"
                  >
                    Enter the World
                  </button>
                </div>
              )}
            </div>
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
