"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"

const narratives = [
  "The sun presses in. You have been walking for what feels like days. The blisters on your feet have become familiar and you can count them as you walk",
  "She is friendly. That is what you have to keep telling yourself. The shadows are long and the wind is howling but she is friendly because you have no alternative.",
  "Come see what lies beyond the thin wall of our reality. He gestures as he speaks. His motions remind you of the marionettes you uses to play with as a child; how their limbs would flick strangely.",
  "She presents you with a stone which is black and cool to the touch. She says that even if you lay it in a fire, it will always be cool. You're interested, but not sure it's worth 200 drachma.",
  "You have seen the sun rise in the west and set in the east. You have seen the rain fall upward and snow conflagrate into flame. You have seen the essence. You have seen Magic.",
  "He does not have anything to give you in return for your protection, but he will feed you and tell you stories along the way. Perhaps that is enough for now.",
  "She will not give you the book. She promised it to you, but still, she says she has grown fond of it. The door closes in your face and you are left alone in the rain.",
  "The map he hands you displays a path into the gorge. You puzzle for a moment. Surely it is not this steep. Surely it is not this long. The man who handed it to you winces."
  ]

export function NarrativeExcerpts() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % narratives.length)
    }, 8000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative h-32 flex items-center justify-left">
      <AnimatePresence mode="wait">
        <motion.p
          key={currentIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="font-serif text-lg md:text-xl text-muted-foreground italic text-left max-w-2xl leading-relaxed px-4"
        >
          {narratives[currentIndex]}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
