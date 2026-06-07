// @ts-nocheck
"use client"

import { useState, useEffect, useLayoutEffect, useRef } from "react"
import ReactMarkdown from "react-markdown"
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

  It was the place where you could pretend to be heroes, to act out those stories you heard in so many songs.

  "Gather round," the bard would say, her eyes shining in the evening dark. "and let me tell you of the Days of Rain."

  You still remember the sound of her voice, the whispers, the lute transforming with every strum. It was a window's howl then it was an warchant.
  It was swords on swords on swords. Steel. Men reaching for men, eyes glittering with violence, and above it all a violet sun and the hum of something other,
  something beyond and something lost.


  Magic.


  The essence of the world.

  And then you would all hurry home.


  Because those are all stories, and we left them behind with the cloak of childhood.

  These are the Days of Sun, and do not think of the Days of Rain. We are a people of reason, and we live beyond the long horizon of legend.
  There are no dragons in the east. There are no barrow-kings beneath the earth. Look at the birds, they come every spring to nest.
  The wheat comes up gold in the summer. There, the miller's daughter can tell you. She is wheat herself. The people come up gold every year.
  Birds roost, the snow falls, the insects sing their night song, and what need is there for magic?

  But some cannot rest so easy.

  Because there is always a turning, and the days of sun were never going to stay forever.

  And now there are pale things in these late days. sinewy, old things from the old places and the high places. They coalese like dew, shadows, dripping from the lintels of ruins,
  collecting, turning into something with shape, curiosity, and cruelty. 

  Or at least, that is what they say...
  `

const QUESTIONS = [
  "What name were you given, and how should the game refer to you?",
  "There are cities, towns, villages and homesteads. Which are you from?",
  "You had a frightening experience as a child. What was it?",
  "What have you done for work?",
  "A bird turns, lonely in the thermals. What is he searching for and why is he alone?",
  "What did your father do?",
  "Humans are the thickened desire of the world, the monks say. What is yours?",
  "What caused you to leave your previous life?"
]

// ─── Typewriter hook ──────────────────────────────────────────────────────────

function useTypewriter(text: string, speed = 18) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setDisplayed("")
    setDone(false)
    if (!text) return

    let i = 0
    intervalRef.current = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(intervalRef.current!)
        setDone(true)
      }
    }, speed)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [text, speed])

  const skip = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setDisplayed(text)
    setDone(true)
  }

  return { displayed, done, skip }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SyngemIntroProps {
  userId: string
}

type Phase = "intro" | "questions" | "loading" | "reveal" | "error"

interface CreatorResult {
  background_primary: string
  physical_description: string
  backstory: string
  story_hook: string
  initial_quest: { id: string; title: string; status: string; description: string }
}

const SCROLLBAR_CLASSES =
  "overflow-y-auto [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full"

export function SyngemIntro({ userId }: SyngemIntroProps) {
  const router = useRouter()
  const supabase = createClient()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [topSpacerHeight, setTopSpacerHeight] = useState(0)

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
      ? (creatorResult?.story_hook || creatorResult?.backstory || "")
      : ""

  const { displayed, done: typewritingDone, skip } = useTypewriter(
    activeText,
    phase === "intro" ? 18 : 28
  )

  // Focus input once question finishes typewriting
  useEffect(() => {
    if (typewritingDone && phase === "questions") {
      inputRef.current?.focus()
    }
  }, [typewritingDone, phase, questionIndex])

  // Measure scroll container and set spacer: top = 2/3 height, bottom = 1/3 height
  // useLayoutEffect prevents flash on first render
  useLayoutEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const measure = () => setTopSpacerHeight(el.clientHeight * (2 / 3))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [phase])

  // Auto-scroll to bottom so the latest text sits at 1/3 from the bottom
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [displayed, topSpacerHeight])

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

      // Fire quest start grants (Brin NPC + starter items) — non-blocking, failure is non-fatal
      fetch("/api/gm/quest/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: newChar.id, questId: "follow_the_waystone" }),
      }).catch(() => {})

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
    <div className="h-screen bg-zinc-950 flex flex-col items-center px-6 py-10 overflow-hidden">
      <div className={`w-full flex flex-col flex-1 min-h-0 ${phase === "reveal" ? "max-w-5xl" : "max-w-2xl"}`}>
        {/* Logo */}
        <p className="text-[9px] uppercase tracking-[0.5em] text-cyan-900 font-mono mb-8 text-center shrink-0">
          SYNGEM — Chronicle Engine
        </p>

        {/* ── Intro phase ────────────────────────────────────────────── */}
        {phase === "intro" && (
          <div className="flex flex-col flex-1 min-h-0">
            <div
              ref={scrollContainerRef}
              className={`flex-1 min-h-0 ${SCROLLBAR_CLASSES}`}
              style={{ scrollbarWidth: "thin", scrollbarColor: "#3f3f46 transparent" }}
            >
              {/* Top spacer: pushes text to 2/3 down on first render */}
              <div style={{ height: topSpacerHeight }} aria-hidden="true" />
              {/* Bottom padding: keeps cursor at 1/3 from bottom when scrolled to end */}
              <div className="border-l-2 border-cyan-900/40 pl-6" style={{ paddingBottom: topSpacerHeight / 2 }}>
                <p className="font-serif text-zinc-300 text-base leading-loose whitespace-pre-line">
                  {displayed}
                  {!typewritingDone && (
                    <span className="inline-block w-0.5 h-4 bg-cyan-500/60 animate-pulse ml-0.5 align-middle" />
                  )}
                </p>
              </div>
            </div>
            <div className="h-12 flex items-center shrink-0 mt-4">
              {!typewritingDone ? (
                <button
                  onClick={skip}
                  className="ml-auto text-[9px] uppercase tracking-[0.4em] text-zinc-700 hover:text-zinc-400 transition-colors font-mono"
                >
                  Skip
                </button>
              ) : (
                <div className="w-full flex justify-center animate-in fade-in duration-700">
                  <button
                    onClick={handleIntroAdvance}
                    className="text-xs uppercase tracking-[0.4em] text-cyan-600 hover:text-cyan-400 border border-cyan-900/40 hover:border-cyan-700/60 px-8 py-3 transition-all"
                  >
                    Begin
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Questions phase ─────────────────────────────────────────── */}
        {phase === "questions" && (
          <div className="flex-1 flex items-center">
            <div className="w-full space-y-8">
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
          </div>
        )}

        {/* ── Loading phase ─────────────────────────────────────────── */}
        {phase === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <Loader2 className="w-6 h-6 text-cyan-600 animate-spin mx-auto" />
              <p className="text-xs uppercase tracking-[0.4em] text-zinc-600 font-mono">
                The Chronicle Weaver is at work…
              </p>
            </div>
          </div>
        )}

        {/* ── Reveal phase ──────────────────────────────────────────── */}
        {phase === "reveal" && creatorResult && (
          <div className="flex gap-12 flex-1 min-h-0 animate-in fade-in duration-700">
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
                <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-600 font-mono">Appearance</p>
                <p className="font-serif text-zinc-400 text-sm leading-relaxed">{creatorResult.physical_description}</p>
              </div>
            </div>

            {/* Right panel — scrollable story hook */}
            <div className="flex-1 flex flex-col min-h-0">
              <div
                ref={scrollContainerRef}
                className={`flex-1 min-h-0 ${SCROLLBAR_CLASSES}`}
                style={{ scrollbarWidth: "thin", scrollbarColor: "#3f3f46 transparent" }}
              >
                <div style={{ height: topSpacerHeight }} aria-hidden="true" />
                <div className="border-l-2 border-cyan-900/40 pl-6" style={{ paddingBottom: topSpacerHeight / 2 }}>
                  <div className="prose prose-invert max-w-none prose-p:font-serif prose-p:text-zinc-300 prose-p:leading-loose prose-headings:font-sans prose-headings:uppercase prose-headings:tracking-widest prose-headings:text-[0.65rem] prose-headings:text-zinc-500 prose-headings:mb-4 prose-strong:text-zinc-100 prose-p:mt-0 prose-p:mb-4">
                    <ReactMarkdown>{displayed}</ReactMarkdown>
                    {!typewritingDone && (
                      <span className="inline-block w-0.5 h-4 bg-cyan-500/60 animate-pulse ml-0.5 align-middle" />
                    )}
                  </div>
                </div>
              </div>
              <div className="h-12 flex items-center pl-6 shrink-0 mt-4">
                {typewritingDone && (
                  <div className="animate-in fade-in duration-700">
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
          </div>
        )}

        {/* ── Error phase ────────────────────────────────────────────── */}
        {phase === "error" && (
          <div className="flex-1 flex items-center justify-center">
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
          </div>
        )}
      </div>
    </div>
  )
}
