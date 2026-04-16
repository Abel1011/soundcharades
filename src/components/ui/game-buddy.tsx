"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { RoundType } from "@/lib/types";

/**
 * GameBuddy — SoundBuddy adapted for gameplay.
 * - SFX mode: makes sound effect gestures, ears pulsing, wave arcs
 * - Music mode: singing with open mouth, musical notes floating, swaying
 * - Reacts to game state: idle, playing, correct, wrong
 */

type BuddyState = "idle" | "playing" | "correct" | "wrong";

interface GameBuddyProps {
  roundType: RoundType;
  state: BuddyState;
  className?: string;
}

export function GameBuddy({ roundType, state, className }: GameBuddyProps) {
  const isSfx = roundType === "sfx";
  const isPlaying = state === "playing";
  const isCorrect = state === "correct";
  const isWrong = state === "wrong";

  // Body color reacts to state
  const bodyColor = isCorrect
    ? "bg-fresh"
    : isWrong
      ? "bg-pop"
      : "bg-primary";

  const earColor = isCorrect
    ? "bg-sunny"
    : isWrong
      ? "bg-text-primary"
      : "bg-pop";

  return (
    <motion.div
      className={`relative ${className ?? ""}`}
      animate={
        isPlaying
          ? isSfx
            ? { y: [0, -3, 0], rotate: [0, 0, 0] } // subtle bounce for SFX
            : { y: [0, -4, 0], rotate: [-3, 3, -3] } // sway for music
          : isCorrect
            ? { y: [0, -12, 0], rotate: [0, 5, -5, 0] } // celebration jump
            : isWrong
              ? { y: 0, rotate: 0 } // still
              : { y: [0, -5, 0], rotate: [-1, 1, -1] } // idle float
      }
      transition={{
        duration: isPlaying ? (isSfx ? 0.6 : 1.2) : isCorrect ? 0.6 : isWrong ? 0.3 : 2.5,
        repeat: isWrong ? 0 : Infinity,
        ease: "easeInOut",
      }}
    >
      {/* ── SFX Mode: Sound wave arcs ── */}
      <AnimatePresence>
        {isPlaying && isSfx && (
          <>
            {/* Right arcs */}
            <div className="absolute -right-8 top-[25%]">
              {[0, 0.3, 0.6].map((delay, i) => (
                <motion.div
                  key={`r-${i}`}
                  className="absolute rounded-full border-[2.5px] border-pop"
                  style={{
                    width: 14 + i * 14,
                    height: 14 + i * 14,
                    top: -(7 + i * 7),
                    left: 0,
                    borderLeft: "none",
                    borderTop: "none",
                    borderBottom: "none",
                  }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: [0, 0.8, 0], scale: [0.7, 1.2, 1.5] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2, repeat: Infinity, delay, ease: "easeOut" }}
                />
              ))}
            </div>
            {/* Left arcs */}
            <div className="absolute -left-8 top-[25%] scale-x-[-1]">
              {[0.15, 0.45, 0.75].map((delay, i) => (
                <motion.div
                  key={`l-${i}`}
                  className="absolute rounded-full border-[2.5px] border-fresh"
                  style={{
                    width: 14 + i * 14,
                    height: 14 + i * 14,
                    top: -(7 + i * 7),
                    left: 0,
                    borderLeft: "none",
                    borderTop: "none",
                    borderBottom: "none",
                  }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: [0, 0.6, 0], scale: [0.7, 1.1, 1.4] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.4, repeat: Infinity, delay, ease: "easeOut" }}
                />
              ))}
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── Music Mode: Floating notes ── */}
      <AnimatePresence>
        {isPlaying && !isSfx && (
          <>
            {[
              { char: "♫", x: -18, delay: 0, size: "text-base", color: "text-pop" },
              { char: "♪", x: 22, delay: 0.7, size: "text-lg", color: "text-sunny" },
              { char: "♩", x: -10, delay: 1.4, size: "text-sm", color: "text-fresh" },
              { char: "♬", x: 16, delay: 0.4, size: "text-base", color: "text-primary" },
            ].map((note, i) => (
              <motion.span
                key={i}
                className={`absolute font-bold select-none ${note.size} ${note.color}`}
                style={{ left: `calc(50% + ${note.x}px)`, top: -4 }}
                initial={{ y: 0, opacity: 0 }}
                animate={{ y: [-4, -30, -50], opacity: [0, 1, 0], rotate: [-10, 15, -5] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, delay: note.delay, ease: "easeOut" }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* ── Celebration particles ── */}
      <AnimatePresence>
        {isCorrect && (
          <>
            {["★", "✦", "★", "✦", "★"].map((star, i) => (
              <motion.span
                key={i}
                className="absolute left-1/2 top-0 text-sm font-bold text-sunny select-none"
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1.2, 0.5],
                  x: [0, (i - 2) * 20],
                  y: [0, -20 - Math.random() * 20],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, delay: i * 0.1 }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* ── Body ── */}
      <div className={`relative h-20 w-16 rounded-2xl ${bodyColor} shadow-chunky-pop transition-colors duration-300`}>
        {/* Headphone band */}
        <div className="absolute -top-2.5 left-1/2 h-5 w-14 -translate-x-1/2 rounded-t-full border-[2.5px] border-b-0 border-text-primary" />

        {/* Left ear cup */}
        <motion.div
          className={`absolute -left-2.5 top-0.5 h-6 w-4 rounded-md ${earColor} transition-colors duration-300`}
          animate={
            isPlaying
              ? { scale: [1, 1.15, 1] }
              : { scale: 1 }
          }
          transition={{ duration: 0.5, repeat: isPlaying ? Infinity : 0, ease: "easeInOut" }}
        />
        {/* Right ear cup */}
        <motion.div
          className={`absolute -right-2.5 top-0.5 h-6 w-4 rounded-md ${earColor} transition-colors duration-300`}
          animate={
            isPlaying
              ? { scale: [1, 1.15, 1] }
              : { scale: 1 }
          }
          transition={{ duration: 0.5, repeat: isPlaying ? Infinity : 0, delay: 0.1, ease: "easeInOut" }}
        />

        {/* Face */}
        <div className="absolute inset-x-2 top-3 flex flex-col items-center gap-1.5">
          {/* Eyes */}
          <div className="flex w-full justify-center gap-2">
            <GameEye state={state} />
            <GameEye state={state} />
          </div>

          {/* Mouth — changes based on mode + state */}
          {isCorrect ? (
            /* Big happy grin */
            <motion.div
              className="relative mt-0.5 h-4 w-8 overflow-hidden"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="absolute inset-x-0 -top-2 h-6 w-8 rounded-b-[50%] bg-text-primary/90" />
              <div className="absolute bottom-0 left-1/2 h-2 w-3.5 -translate-x-1/2 rounded-b-full bg-pop" />
            </motion.div>
          ) : isWrong ? (
            /* Sad frown */
            <div className="mt-1 h-1 w-5 rounded-full bg-text-primary/80" />
          ) : isPlaying && !isSfx ? (
            /* Singing — big open O */
            <motion.div
              className="relative mt-0.5 overflow-hidden"
              animate={{ scaleY: [0.8, 1.3, 0.8], scaleX: [1, 0.9, 1] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="h-4 w-4 rounded-full bg-text-primary/90">
                <div className="absolute left-1/2 top-1/2 h-2 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pop/60" />
              </div>
            </motion.div>
          ) : isPlaying && isSfx ? (
            /* SFX — mouth opens with each "sound" */
            <motion.div
              className="relative mt-0.5 h-3.5 w-7 overflow-hidden"
              animate={{ scaleY: [1, 1.5, 0.8, 1.3, 1] }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="absolute inset-x-0 -top-2 h-5.5 w-7 rounded-b-[50%] bg-text-primary/90" />
              <div className="absolute bottom-0 left-1/2 h-1.5 w-3 -translate-x-1/2 rounded-b-full bg-pop" />
            </motion.div>
          ) : (
            /* Idle — small smile */
            <motion.div
              className="relative mt-0.5 h-3.5 w-7 overflow-hidden"
              animate={{ scaleY: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="absolute inset-x-0 -top-2 h-5.5 w-7 rounded-b-[50%] bg-text-primary/90" />
            </motion.div>
          )}
        </div>

        {/* Arms */}
        {isPlaying && isSfx ? (
          /* SFX mode: arms out like making sound effects */
          <>
            <motion.div
              className="absolute -left-3 bottom-3 h-2.5 w-5 origin-right rounded-full bg-primary-hover"
              animate={{ rotate: [-20, -40, -20], x: [-1, -3, -1] }}
              transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -right-3 bottom-3 h-2.5 w-5 origin-left rounded-full bg-primary-hover"
              animate={{ rotate: [20, 40, 20], x: [1, 3, 1] }}
              transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
            />
          </>
        ) : isPlaying && !isSfx ? (
          /* Music mode: conducting / swaying arms */
          <>
            <motion.div
              className="absolute -left-3 bottom-3 h-2.5 w-5 origin-right rounded-full bg-primary-hover"
              animate={{ rotate: [0, -25, 5, -15, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -right-3 bottom-3 h-2.5 w-5 origin-left rounded-full bg-primary-hover"
              animate={{ rotate: [0, 25, -5, 15, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            />
          </>
        ) : isCorrect ? (
          /* Celebration — arms up! */
          <>
            <motion.div
              className="absolute -left-3 bottom-3 h-2.5 w-5 origin-right rounded-full bg-primary-hover"
              animate={{ rotate: [-60, -70, -60] }}
              transition={{ duration: 0.3, repeat: Infinity }}
            />
            <motion.div
              className="absolute -right-3 bottom-3 h-2.5 w-5 origin-left rounded-full bg-primary-hover"
              animate={{ rotate: [60, 70, 60] }}
              transition={{ duration: 0.3, repeat: Infinity }}
            />
          </>
        ) : (
          /* Idle arms */
          <>
            <motion.div
              className="absolute -left-2 bottom-3 h-2.5 w-4 origin-right rounded-full bg-primary-hover"
              animate={{ rotate: [0, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -right-2 bottom-3 h-2.5 w-4 origin-left rounded-full bg-primary-hover"
              animate={{ rotate: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            />
          </>
        )}
      </div>

      {/* Feet */}
      <div className="mt-0.5 flex justify-center gap-2">
        <motion.div
          className={`h-2.5 w-5 rounded-b-md rounded-t-sm ${bodyColor} transition-colors duration-300`}
          animate={isPlaying && !isSfx ? { rotate: [-5, 5, -5] } : { rotate: 0 }}
          transition={{ duration: 0.6, repeat: isPlaying ? Infinity : 0, ease: "easeInOut" }}
        />
        <motion.div
          className={`h-2.5 w-5 rounded-b-md rounded-t-sm ${bodyColor} transition-colors duration-300`}
          animate={isPlaying && !isSfx ? { rotate: [5, -5, 5] } : { rotate: 0 }}
          transition={{ duration: 0.6, repeat: isPlaying ? Infinity : 0, ease: "easeInOut", delay: 0.15 }}
        />
      </div>
    </motion.div>
  );
}

/* ── Eye with state reactions ── */
function GameEye({ state }: { state: BuddyState }) {
  if (state === "correct") {
    // Happy squint — ^  ^
    return (
      <div className="flex h-4 w-4 items-end justify-center">
        <div className="h-1 w-3.5 rounded-t-full border-t-[2px] border-text-primary" />
      </div>
    );
  }

  if (state === "wrong") {
    // Worried — X X
    return (
      <div className="relative h-4 w-4">
        <div className="absolute left-1/2 top-1/2 h-[2px] w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-text-primary" />
        <div className="absolute left-1/2 top-1/2 h-[2px] w-3 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-text-primary" />
      </div>
    );
  }

  // Normal / playing
  return (
    <div className="relative h-4 w-4 rounded-full bg-surface-base">
      <motion.div
        className="absolute bottom-0.5 left-0.5 h-2.5 w-2.5 rounded-full bg-text-primary"
        animate={
          state === "playing"
            ? { x: [0, 1.5, -1.5, 0], y: [0, -0.5, 0.5, 0] }
            : { x: [0, 0.5, -0.5, 0] }
        }
        transition={{ duration: state === "playing" ? 1.5 : 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute right-0 top-0 h-1 w-1 rounded-full bg-surface-base" />
      </motion.div>
    </div>
  );
}
