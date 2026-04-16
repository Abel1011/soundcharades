"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AudioLines,
  Play,
  Zap,
  Flame,
  ArrowRight,
  Clapperboard,
  Tv,
  Gamepad2,
  Globe,
  ChefHat,
  Headphones,
  Music,
  Shuffle,
  Smile,
  Brain,
  Skull,
  Sparkles,
  HelpCircle,
  X,
  Waves,
  Trophy,
  Volume2,
  History,
} from "lucide-react";
import { PlayfulBg } from "@/components/ui/mesh-bg";
import { SoundBuddy } from "@/components/ui/sound-buddy";
import { CATEGORIES, GAME_MODES, DIFFICULTIES } from "@/data/landing";
import type { Difficulty } from "@/lib/types";
import type { ComponentType, SVGProps } from "react";

const CATEGORY_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  clapperboard: Clapperboard,
  tv: Tv,
  "gamepad-2": Gamepad2,
  globe: Globe,
  "chef-hat": ChefHat,
  headphones: Headphones,
};

const MODE_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  play: Play,
  zap: Zap,
  flame: Flame,
};

const DIFFICULTY_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  smile: Smile,
  brain: Brain,
  skull: Skull,
};

const DIFFICULTY_STYLES = [
  { accent: "border-fresh bg-fresh-light", icon: "bg-fresh text-white" },
  { accent: "border-sunny bg-sunny-light", icon: "bg-sunny text-white" },
  { accent: "border-pop bg-pop-light", icon: "bg-pop text-white" },
];

const CAT_COLORS = [
  { bg: "bg-primary-light", text: "text-cat-1", border: "border-cat-1", shadow: "shadow-chunky-primary" },
  { bg: "bg-pop-light", text: "text-cat-2", border: "border-cat-2", shadow: "shadow-chunky-pop" },
  { bg: "bg-fresh-light", text: "text-cat-3", border: "border-cat-3", shadow: "shadow-chunky-fresh" },
  { bg: "bg-sunny-light", text: "text-cat-4", border: "border-cat-4", shadow: "shadow-chunky-sunny" },
  { bg: "bg-primary-light", text: "text-cat-5", border: "border-cat-5", shadow: "shadow-chunky-primary" },
  { bg: "bg-pop-light", text: "text-cat-6", border: "border-cat-6", shadow: "shadow-chunky-pop" },
];

const MODE_STYLES = [
  { accent: "border-primary bg-primary-light", icon: "bg-primary text-white" },
  { accent: "border-pop bg-pop-light", icon: "bg-pop text-white" },
  { accent: "border-fresh bg-fresh-light", icon: "bg-fresh text-white" },
];

export default function Home() {
  const [selectedMode, setSelectedMode] = useState("classic");
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>("medium");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number> | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  useEffect(() => {
    fetch("/api/game/categories")
      .then((r) => r.json())
      .then((data: Record<string, number>) => setCategoryCounts(data))
      .catch(() => setCategoryCounts({}));
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col bg-surface-base">
      <PlayfulBg />

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-6 sm:px-8 lg:max-w-3xl lg:px-12 lg:py-10">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary lg:h-10 lg:w-10">
              <AudioLines className="h-4 w-4 text-white lg:h-5 lg:w-5" />
            </div>
            <span className="font-display text-base font-bold tracking-tight lg:text-lg">
              SoundCharades
            </span>
          </div>
          {/* How to Play + History */}
          <div className="flex items-center gap-2">
            <a
              href="/history"
              className="flex items-center gap-1.5 rounded-full bg-surface-card px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary lg:px-4 lg:py-2 lg:text-sm"
            >
              <History className="h-3.5 w-3.5" />
              History
            </a>
            <button
              onClick={() => setShowHowToPlay(true)}
              className="flex items-center gap-1.5 rounded-full bg-primary-muted px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white lg:px-4 lg:py-2 lg:text-sm"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              How to Play
            </button>
          </div>
        </header>

        {/* Hero — mascot + big title */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-8 flex flex-col items-center text-center sm:mt-12 lg:mt-14"
        >
          <SoundBuddy className="mb-6 lg:mb-8" />

          <h1 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Guess the
            <span className="relative mx-2 inline-block">
              <span className="relative z-10">sound</span>
              <motion.span
                className="absolute inset-x-0 -bottom-1 z-0 h-3 rounded-sm bg-sunny opacity-40"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" }}
                style={{ transformOrigin: "left" }}
              />
            </span>
            <br />
            before anyone else
          </h1>

          <p className="mt-3 max-w-sm text-base leading-relaxed text-text-secondary lg:mt-4 lg:max-w-md lg:text-lg">
            AI creates the clues. You guess what they mean. 
            Sound effects, riddle songs, and bragging rights.
          </p>
        </motion.section>

        {/* Mode selector — pill-style toggle */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="mt-10 lg:mt-12"
        >
          <h3 className="mb-3 font-display text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted lg:mb-4 lg:text-xs">
            Choose your mode
          </h3>
          <div className="flex gap-2.5 lg:gap-4">
            {GAME_MODES.map((mode, i) => {
              const ModeIcon = MODE_ICONS[mode.icon] ?? Play;
              const isSelected = selectedMode === mode.id;
              const style = MODE_STYLES[i];
              return (
                <motion.button
                  key={mode.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setSelectedMode(mode.id)}
                  className={`flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 px-3 py-4 transition-all duration-200 lg:gap-3 lg:px-5 lg:py-5 ${
                    isSelected
                      ? `${style.accent} border-current`
                      : "border-border bg-surface-card hover:bg-surface-raised"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors lg:h-12 lg:w-12 ${
                      isSelected
                        ? style.icon
                        : "bg-surface-raised text-text-muted"
                    }`}
                  >
                    <ModeIcon className="h-5 w-5 lg:h-6 lg:w-6" />
                  </div>
                  <div className="text-center">
                    <span className="block font-display text-sm font-bold lg:text-base">
                      {mode.label}
                    </span>
                    <span className="text-[11px] text-text-muted lg:text-xs">
                      {mode.rounds} rounds
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        {/* Difficulty selector */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-8 lg:mt-10"
        >
          <h3 className="mb-3 font-display text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted lg:mb-4 lg:text-xs">
            Difficulty
          </h3>
          <div className="flex gap-2.5 lg:gap-4">
            {DIFFICULTIES.map((diff, i) => {
              const DiffIcon = DIFFICULTY_ICONS[diff.icon] ?? Brain;
              const isSelected = selectedDifficulty === diff.id;
              const style = DIFFICULTY_STYLES[i];
              return (
                <motion.button
                  key={diff.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setSelectedDifficulty(diff.id)}
                  className={`flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 px-3 py-4 transition-all duration-200 lg:gap-3 lg:px-5 lg:py-5 ${
                    isSelected
                      ? `${style.accent} border-current`
                      : "border-border bg-surface-card hover:bg-surface-raised"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors lg:h-12 lg:w-12 ${
                      isSelected
                        ? style.icon
                        : "bg-surface-raised text-text-muted"
                    }`}
                  >
                    <DiffIcon className="h-5 w-5 lg:h-6 lg:w-6" />
                  </div>
                  <div className="text-center">
                    <span className="block font-display text-sm font-bold lg:text-base">
                      {diff.label}
                    </span>
                    <span className="text-[11px] text-text-muted lg:text-xs">
                      {diff.description}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        {/* Categories — cards with colored left accent + chunky shadow */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-8 lg:mt-10"
        >
          <div className="mb-3 flex items-center justify-between lg:mb-4">
            <h3 className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted lg:text-xs">
              Pick a category
            </h3>
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors lg:px-4 lg:py-1.5 lg:text-sm ${
                selectedCategory === null
                  ? "bg-primary text-white"
                  : "bg-surface-card text-text-muted hover:bg-surface-raised"
              }`}
            >
              <Shuffle className="h-3 w-3" />
              All mixed
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
            {CATEGORIES.map((cat, i) => {
              const CatIcon = CATEGORY_ICONS[cat.icon] ?? Music;
              const colors = CAT_COLORS[i % CAT_COLORS.length];
              const isSelected = selectedCategory === cat.id;
              return (
                <motion.button
                  key={cat.id}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() =>
                    setSelectedCategory(isSelected ? null : cat.id)
                  }
                  className={`group relative overflow-hidden rounded-2xl border-2 bg-surface-card p-4 text-left transition-all duration-200 lg:p-5 ${
                    isSelected
                      ? `${colors.border} ${colors.shadow}`
                      : "border-border hover:border-border-active"
                  }`}
                >
                  {/* Colored top bar */}
                  <div
                    className={`absolute inset-x-0 top-0 h-1 transition-opacity ${
                      isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                    }`}
                    style={{ backgroundColor: `var(--cat-${i + 1})` }}
                  />
                  <div className="flex flex-col items-start gap-2.5">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-xl lg:h-10 lg:w-10 ${colors.bg} ${colors.text}`}
                    >
                      <CatIcon className="h-4 w-4 lg:h-5 lg:w-5" />
                    </div>
                    <div>
                      <span className="block font-display text-sm font-bold text-text-primary lg:text-base">
                        {cat.label}
                      </span>
                      <span className="text-[11px] text-text-muted lg:text-xs">
                        {categoryCounts ? (categoryCounts[cat.id] ?? 0) : "–"} challenges
                      </span>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Create Your Own */}
          <motion.a
            href="/generate"
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.97 }}
            className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-dashed border-sunny/50 bg-sunny/5 p-4 transition-all hover:border-sunny hover:bg-sunny/10 lg:mt-4 lg:p-5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sunny text-white lg:h-10 lg:w-10">
              <Sparkles className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
            <div className="flex-1">
              <span className="block font-display text-sm font-bold text-text-primary lg:text-base">
                Create Your Own
              </span>
              <span className="text-[11px] text-text-muted lg:text-xs">
                Type any theme — AI generates a custom quiz
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-sunny" />
          </motion.a>
        </motion.section>

        {/* Spacer */}
        <div className="flex-1" />

        {/* CTA — big chunky button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="sticky bottom-0 z-20 mt-8 pb-6"
        >
          <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-linear-to-t from-surface-base to-transparent" />
          <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
            <motion.a
              href={`/play?mode=${selectedMode}&difficulty=${selectedDifficulty}${selectedCategory ? `&category=${selectedCategory}` : ""}`}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-primary bg-primary px-6 py-4 font-display text-base font-extrabold text-white shadow-chunky-primary transition-all hover:shadow-[8px_8px_0px_0px_var(--primary)] lg:py-5 lg:text-lg"
            >
              <Play className="h-5 w-5" fill="currentColor" />
              Let&apos;s Play!
              <ArrowRight className="h-5 w-5" />
            </motion.a>
            <AnimatePresence>
              {(selectedCategory || selectedMode) && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-[11px] font-medium text-text-muted lg:text-xs"
                >
                  {GAME_MODES.find((m) => m.id === selectedMode)?.label ?? "Classic"}
                  {" / "}
                  {DIFFICULTIES.find((d) => d.id === selectedDifficulty)?.label ?? "Medium"}
                  {selectedCategory
                    ? ` / ${CATEGORIES.find((c) => c.id === selectedCategory)?.label}`
                    : " / All Categories"}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* How to Play Modal */}
      <AnimatePresence>
        {showHowToPlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setShowHowToPlay(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", bounce: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border-2 border-border bg-surface-base p-6 shadow-xl sm:p-8"
            >
              {/* Close button */}
              <button
                onClick={() => setShowHowToPlay(false)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>

              <h2 className="font-display text-2xl font-extrabold tracking-tight">
                How to Play
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                Listen carefully, guess fast, score big!
              </p>

              <div className="mt-6 space-y-5">
                {/* Step 1 */}
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                    <Waves className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold">Listen to the clues</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
                      Each round plays AI-generated <strong>sound effects</strong> or a <strong>riddle song</strong> describing a mystery concept. Pay attention to every detail!
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sunny text-white">
                    <Brain className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold">Pick your answer</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
                      Choose from 4 options. The faster you answer, the more points you earn. Correct = 1,000 pts + up to 500 speed bonus!
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fresh text-white">
                    <Volume2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold">Use hints wisely</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
                      Replay audio (<strong>-200 pts</strong>), reveal a text hint (<strong>-300 pts</strong>), or hear voice clues (<strong>-150 pts</strong>). Use them if you&apos;re stuck!
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pop text-white">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold">Beat your score</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
                      Build streaks, minimize penalties, and aim for the perfect game. Share your results and challenge friends!
                    </p>
                  </div>
                </div>
              </div>

              {/* Round types */}
              <div className="mt-6 rounded-2xl bg-surface-card p-4">
                <h3 className="font-display text-xs font-bold uppercase tracking-widest text-text-muted">
                  Round Types
                </h3>
                <div className="mt-3 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <Waves className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <p className="text-xs text-text-secondary">
                      <strong className="text-text-primary">Sound Chain</strong> — 4 ambient sounds + 2 voice phrases play in sequence as progressive clues
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Music className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pop" />
                    <p className="text-xs text-text-secondary">
                      <strong className="text-text-primary">Riddle Song</strong> — An AI-composed song whose lyrics describe the answer as a riddle
                    </p>
                  </div>
                </div>
              </div>

              {/* Got it button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowHowToPlay(false)}
                className="mt-6 w-full rounded-2xl bg-primary py-3 font-display text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              >
                Got it!
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
