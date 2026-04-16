"use client";

import { motion } from "framer-motion";

/**
 * SoundBuddy — a cute speaker character mascot built with CSS.
 * Has big eyes, a speaker mouth, tiny arms, and floats/bounces.
 *
 * mood: "happy" (default), "excited", "cool", "meh", "sad"
 */
export type BuddyMood = "happy" | "excited" | "cool" | "meh" | "sad";

export function SoundBuddy({
  className,
  mood = "happy",
}: {
  className?: string;
  mood?: BuddyMood;
}) {
  return (
    <motion.div
      className={`relative ${className ?? ""}`}
      animate={{ y: [0, -10, 0], rotate: [-2, 2, -2] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Sound wave arcs — right side, expanding outward */}
      <div className="absolute -right-10 top-[30%]">
        {[0, 0.4, 0.8].map((delay, i) => (
          <motion.div
            key={`r-${i}`}
            className="absolute rounded-full border-2 border-pop"
            style={{
              width: 16 + i * 14,
              height: 16 + i * 14,
              top: -(8 + i * 7),
              left: 0,
              borderLeft: "none",
              borderTop: "none",
              borderBottom: "none",
            }}
            animate={{ opacity: [0, 0.7, 0], scale: [0.8, 1.2, 1.4] }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              delay,
              ease: "easeOut",
            }}
          />
        ))}
      </div>

      {/* Sound wave arcs — left side */}
      <div className="absolute -left-10 top-[30%] scale-x-[-1]">
        {[0.2, 0.6, 1].map((delay, i) => (
          <motion.div
            key={`l-${i}`}
            className="absolute rounded-full border-2 border-fresh"
            style={{
              width: 14 + i * 12,
              height: 14 + i * 12,
              top: -(7 + i * 6),
              left: 0,
              borderLeft: "none",
              borderTop: "none",
              borderBottom: "none",
            }}
            animate={{ opacity: [0, 0.5, 0], scale: [0.8, 1.1, 1.3] }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              delay,
              ease: "easeOut",
            }}
          />
        ))}
      </div>

      {/* Musical note floating up — right */}
      <motion.span
        className="absolute -right-5 -top-2 font-display text-lg font-bold text-sunny select-none"
        animate={{ y: [0, -16, -24], opacity: [0, 1, 0], rotate: [0, 10, -5] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
      >
        &#9835;
      </motion.span>
      {/* Musical note floating up — left */}
      <motion.span
        className="absolute -left-4 top-0 font-display text-sm font-bold text-pop select-none"
        animate={{ y: [0, -12, -20], opacity: [0, 0.8, 0], rotate: [0, -8, 5] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: 0.8 }}
      >
        &#9833;
      </motion.span>

      {/* Body */}
      <div className="relative h-28 w-24 rounded-3xl bg-primary shadow-chunky-pop">
        {/* Headphone band */}
        <div className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 rounded-t-full border-[3px] border-b-0 border-text-primary" />
        {/* Left ear cup — with pulse */}
        <motion.div
          className="absolute -left-3 top-1 h-8 w-5 rounded-lg bg-pop"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Right ear cup — with pulse */}
        <motion.div
          className="absolute -right-3 top-1 h-8 w-5 rounded-lg bg-pop"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
        />

        {/* Face area */}
        <div className="absolute inset-x-3 top-4 flex flex-col items-center gap-2">
          {/* Eyes */}
          <div className="flex w-full justify-center gap-3">
            <BuddyEye mood={mood} />
            <BuddyEye mood={mood} />
          </div>

          {/* Mouth — changes with mood */}
          <BuddyMouth mood={mood} />
        </div>

        {/* Left arm */}
        <motion.div
          className="absolute -left-2 bottom-4 h-3 w-5 origin-right rounded-full bg-primary-hover"
          animate={{ rotate: [0, -15, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Right arm — waving */}
        <motion.div
          className="absolute -right-2 bottom-4 h-3 w-5 origin-left rounded-full bg-primary-hover"
          animate={{ rotate: [0, 20, -10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        />
      </div>

      {/* Feet */}
      <div className="mt-1 flex justify-center gap-3">
        <div className="h-3 w-6 rounded-b-lg rounded-t-sm bg-primary" />
        <div className="h-3 w-6 rounded-b-lg rounded-t-sm bg-primary" />
      </div>
    </motion.div>
  );
}

function BuddyEye({ mood }: { mood: BuddyMood }) {
  // Excited: happy squint (like ^_^)
  if (mood === "excited") {
    return (
      <motion.div
        className="h-5 w-5"
        initial={{ scaleY: 0.3 }}
        animate={{ scaleY: [0.3, 0.5, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="h-2.5 w-5 rounded-t-full border-t-[3px] border-text-primary" />
      </motion.div>
    );
  }

  // Cool: sunglasses-style flat line
  if (mood === "cool") {
    return (
      <div className="flex h-5 w-5 items-center justify-center">
        <div className="h-1.5 w-5 rounded-full bg-text-primary" />
      </div>
    );
  }

  // Sad: droopy eyes (pupil looks down)
  if (mood === "sad") {
    return (
      <div className="relative h-5 w-5 rounded-full bg-surface-base">
        <div className="absolute bottom-0.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-text-primary">
          <div className="absolute right-0 top-0 h-1 w-1 rounded-full bg-surface-base" />
        </div>
        {/* Droopy eyebrow */}
        <div className="absolute -top-1.5 left-0 h-1 w-5 rotate-[5deg] rounded-full bg-text-primary/40" />
      </div>
    );
  }

  // Meh: half-closed unimpressed
  if (mood === "meh") {
    return (
      <div className="relative h-5 w-5 overflow-hidden rounded-full bg-surface-base">
        {/* Half-lid */}
        <div className="absolute inset-x-0 top-0 z-10 h-2.5 bg-primary" />
        <div className="absolute bottom-1 left-1 h-3 w-3 rounded-full bg-text-primary">
          <div className="absolute right-0 top-0 h-1 w-1 rounded-full bg-surface-base" />
        </div>
      </div>
    );
  }

  // Happy (default): normal bouncing eye
  return (
    <div className="relative h-5 w-5 rounded-full bg-surface-base">
      <motion.div
        className="absolute bottom-1 left-1 h-3 w-3 rounded-full bg-text-primary"
        animate={{ x: [0, 1, -1, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Sparkle */}
        <div className="absolute right-0 top-0 h-1 w-1 rounded-full bg-surface-base" />
      </motion.div>
    </div>
  );
}

function BuddyMouth({ mood }: { mood: BuddyMood }) {
  // Excited: big open grin with tongue, bouncing
  if (mood === "excited") {
    return (
      <motion.div
        className="relative mt-1 h-6 w-12 overflow-hidden"
        animate={{ scaleY: [1, 1.3, 1] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute inset-x-0 -top-3 h-9 w-12 rounded-b-[50%] bg-text-primary/90" />
        <div className="absolute bottom-0 left-1/2 h-3 w-5 -translate-x-1/2 rounded-b-full bg-pop" />
      </motion.div>
    );
  }

  // Cool: confident smirk (asymmetric)
  if (mood === "cool") {
    return (
      <div className="relative mt-2 h-3 w-8">
        <div className="absolute inset-x-0 bottom-0 h-4 w-8 rounded-b-[60%] border-b-[3px] border-text-primary/90" />
      </div>
    );
  }

  // Meh: flat straight line
  if (mood === "meh") {
    return (
      <div className="mt-2 h-1 w-8 rounded-full bg-text-primary/70" />
    );
  }

  // Sad: frown (upside-down curve)
  if (mood === "sad") {
    return (
      <div className="relative mt-2 h-3 w-8">
        <div className="absolute inset-x-0 top-0 h-4 w-8 rounded-t-[60%] border-t-[3px] border-text-primary/70" />
      </div>
    );
  }

  // Happy (default): cute smile with tongue
  return (
    <motion.div
      className="relative mt-1 h-5 w-10 overflow-hidden"
      animate={{ scaleY: [1, 1.4, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="absolute inset-x-0 -top-3 h-8 w-10 rounded-b-[50%] bg-text-primary/90" />
      <div className="absolute bottom-0 left-1/2 h-2.5 w-4 -translate-x-1/2 rounded-b-full bg-pop" />
    </motion.div>
  );
}
