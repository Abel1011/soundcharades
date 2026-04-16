"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Target,
  Clock,
  Flame,
  Share2,
  RotateCcw,
  Home,
  CheckCircle2,
  XCircle,
  Waves,
  Music,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Shuffle,
  Skull,
  Brain,
  Smile,
  Zap,
} from "lucide-react";
import { PlayfulBg } from "@/components/ui/mesh-bg";
import { SoundBuddy } from "@/components/ui/sound-buddy";
import type { BuddyMood } from "@/components/ui/sound-buddy";
import { CATEGORIES, DIFFICULTIES } from "@/data/landing";
import type { Difficulty, GameSummary } from "@/lib/types";
import { saveGameToHistory } from "@/lib/history";

/* ── Grade system ── */
function getGrade(score: number, maxScore: number) {
  const pct = score / maxScore;
  if (pct >= 0.9) return { letter: "S", color: "text-sunny", label: "Sound Master!", mood: "excited" as BuddyMood };
  if (pct >= 0.75) return { letter: "A", color: "text-fresh", label: "Sharp Ears!", mood: "excited" as BuddyMood };
  if (pct >= 0.6) return { letter: "B", color: "text-primary", label: "Good Listener", mood: "happy" as BuddyMood };
  if (pct >= 0.4) return { letter: "C", color: "text-text-secondary", label: "Keep Practicing", mood: "meh" as BuddyMood };
  return { letter: "D", color: "text-pop", label: "Needs Work", mood: "sad" as BuddyMood };
}

function formatTime(ms: number) {
  const s = Math.round(ms / 1000);
  return `${s}s`;
}

const DIFF_ICONS: Record<string, typeof Smile> = { easy: Smile, medium: Brain, hard: Skull };
const DIFF_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  easy: { text: "text-fresh", bg: "bg-fresh-light", border: "border-fresh" },
  medium: { text: "text-sunny", bg: "bg-sunny-light", border: "border-sunny" },
  hard: { text: "text-pop", bg: "bg-pop-light", border: "border-pop" },
};
const NEXT_DIFFICULTY: Record<Difficulty, Difficulty> = { easy: "medium", medium: "hard", hard: "hard" };

/* ─────────────────────────── Results Page ─────────────────────────── */

export default function ResultsPage() {
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [showRounds, setShowRounds] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("game-summary");
    if (raw) {
      try {
        const parsed: GameSummary = JSON.parse(raw);
        setSummary(parsed);
        saveGameToHistory(parsed);
        return;
      } catch { /* fall through */ }
    }
    // Redirect home if no summary data
    window.location.href = "/";
  }, []);

  if (!summary) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-base">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const maxScore = summary.totalRounds * 1500;
  const grade = getGrade(summary.totalScore, maxScore);
  const accuracy = Math.round((summary.correctCount / summary.totalRounds) * 100);
  const difficulty: Difficulty = summary.difficulty ?? "medium";
  const diffColor = DIFF_COLORS[difficulty];
  const DiffIcon = DIFF_ICONS[difficulty] ?? Brain;
  const diffLabel = DIFFICULTIES.find((d) => d.id === difficulty)?.label ?? "Medium";
  const categoryLabel = summary.category
    ? CATEGORIES.find((c) => c.id === summary.category)?.label ?? summary.category
    : "Mixed";
  const canLevelUp = difficulty !== "hard" && accuracy >= 60;
  const nextDiff = NEXT_DIFFICULTY[difficulty];
  const nextDiffLabel = DIFFICULTIES.find((d) => d.id === nextDiff)?.label ?? "Hard";

  const replayUrl = `/play?mode=${summary.mode}&difficulty=${difficulty}${summary.category ? `&category=${summary.category}` : ""}`;
  const levelUpUrl = `/play?mode=${summary.mode}&difficulty=${nextDiff}${summary.category ? `&category=${summary.category}` : ""}`;

  const handleShare = async () => {
    const diffEmoji = difficulty === "easy" ? "🟢" : difficulty === "medium" ? "🟡" : "🔴";
    const text = `🎧 SoundCharades ${diffEmoji} ${diffLabel}\n\n${grade.letter} Grade — ${summary.totalScore.toLocaleString()} pts\n${summary.correctCount}/${summary.totalRounds} correct | ${accuracy}% accuracy\n🔥 Best streak: ${summary.bestStreak}\n\nCan you beat my score?`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "SoundCharades", text });
      } else {
        await navigator.clipboard.writeText(text);
      }
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch { /* user cancelled */ }
  };

  return (
    <div className="relative flex min-h-dvh flex-col bg-surface-base">
      <PlayfulBg />

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-6 sm:max-w-xl sm:px-8 lg:max-w-2xl lg:px-12 lg:py-10">
        {/* Header */}
        <header className="flex items-center justify-between">
          <a
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-card text-text-muted transition-colors hover:text-text-primary lg:h-10 lg:w-10"
          >
            <Home className="h-4 w-4 lg:h-5 lg:w-5" />
          </a>
          {/* Session info pills */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${diffColor.bg} ${diffColor.text}`}>
              <DiffIcon className="h-3 w-3" />
              {diffLabel}
            </div>
            <div className="rounded-full bg-surface-card px-3 py-1 text-xs font-semibold text-text-muted">
              {categoryLabel}
            </div>
          </div>
        </header>

        {/* Grade hero */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mt-8 flex flex-col items-center text-center lg:mt-12"
        >
          <SoundBuddy className="mb-4 scale-75 lg:mb-6 lg:scale-100" mood={grade.mood} />

          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.3 }}
            className={`font-display text-8xl font-black lg:text-9xl ${grade.color}`}
          >
            {grade.letter}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-1 font-display text-lg font-bold text-text-primary lg:text-xl"
          >
            {grade.label}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-3 inline-flex items-center gap-2 rounded-2xl border-2 border-primary bg-primary-light px-5 py-2 shadow-chunky-primary lg:px-7 lg:py-3"
          >
            <Trophy className="h-5 w-5 text-primary lg:h-6 lg:w-6" />
            <span className="font-display text-2xl font-black text-primary lg:text-3xl">
              {summary.totalScore.toLocaleString()}
            </span>
            <span className="text-sm font-semibold text-primary/70 lg:text-base">pts</span>
          </motion.div>
        </motion.section>

        {/* Stat cards */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-8 grid grid-cols-4 gap-2.5 lg:gap-3"
        >
          <StatCard
            icon={<Target className="h-4 w-4 text-fresh" />}
            value={`${accuracy}%`}
            label="Accuracy"
            color="fresh"
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
            value={`${summary.correctCount}/${summary.totalRounds}`}
            label="Correct"
            color="primary"
          />
          <StatCard
            icon={<Clock className="h-4 w-4 text-sunny" />}
            value={formatTime(summary.avgTimeMs)}
            label="Avg time"
            color="sunny"
          />
          <StatCard
            icon={<Flame className="h-4 w-4 text-pop" />}
            value={`${summary.bestStreak}`}
            label="Streak"
            color="pop"
          />
        </motion.section>

        {/* Round-by-round breakdown */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="mt-6"
        >
          <button
            onClick={() => setShowRounds(!showRounds)}
            className="flex w-full items-center justify-between rounded-2xl border-2 border-border bg-surface-card px-4 py-3 transition-colors hover:bg-surface-raised"
          >
            <span className="font-display text-sm font-bold">Round Breakdown</span>
            {showRounds ? (
              <ChevronUp className="h-4 w-4 text-text-muted" />
            ) : (
              <ChevronDown className="h-4 w-4 text-text-muted" />
            )}
          </button>

          {showRounds && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="mt-2 space-y-2 overflow-hidden"
            >
              {summary.rounds.map((round, i) => {
                const result = summary.results[i];
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 lg:px-4 lg:py-3 ${
                      result.isCorrect
                        ? "border-fresh/30 bg-fresh-light"
                        : "border-pop/30 bg-pop-light"
                    }`}
                  >
                    {/* Round number + type */}
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white font-display text-xs font-bold text-text-muted">
                        {i + 1}
                      </span>
                      {round.type === "sfx" ? (
                        <Waves className="h-3.5 w-3.5 text-fresh" />
                      ) : (
                        <Music className="h-3.5 w-3.5 text-pop" />
                      )}
                    </div>

                    {/* Concept name + wrong-answer detail */}
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm font-semibold text-text-primary lg:text-base">
                        {round.concept.name}
                      </span>
                      {!result.isCorrect && result.selectedIndex !== null && (
                        <span className="text-[11px] text-pop/70">
                          You picked: {round.options[result.selectedIndex]}
                        </span>
                      )}
                      {result.selectedIndex === null && (
                        <span className="text-[11px] text-text-muted">
                          Time ran out
                        </span>
                      )}
                    </div>

                    {/* Result */}
                    <div className="flex items-center gap-2">
                      {result.totalPoints > 0 && (
                        <span className="font-display text-xs font-bold text-fresh">
                          +{result.totalPoints}
                        </span>
                      )}
                      {result.isCorrect ? (
                        <CheckCircle2 className="h-4 w-4 text-fresh" />
                      ) : (
                        <XCircle className="h-4 w-4 text-pop" />
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </motion.section>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="mt-8 space-y-3 pb-6"
        >
          {/* Level Up CTA — only if player did well enough and not already on hard */}
          {canLevelUp && (
            <motion.a
              href={levelUpUrl}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.1, type: "spring", stiffness: 200, damping: 20 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className={`flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 ${DIFF_COLORS[nextDiff].border} ${DIFF_COLORS[nextDiff].bg} px-5 py-4 font-display text-sm font-extrabold ${DIFF_COLORS[nextDiff].text} transition-all lg:py-5 lg:text-base`}
            >
              <ArrowUpRight className="h-5 w-5" />
              Level Up to {nextDiffLabel}
              <Zap className="h-4 w-4" />
            </motion.a>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleShare}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-primary px-5 py-4 font-display text-sm font-extrabold text-white shadow-chunky-primary transition-all lg:py-5 lg:text-base"
          >
            <Share2 className="h-5 w-5" />
            {shared ? "Copied!" : "Share Score"}
          </motion.button>

          <div className="grid grid-cols-3 gap-2.5 lg:gap-3">
            <motion.a
              href={replayUrl}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-fresh bg-fresh-light px-3 py-3 font-display text-xs font-bold text-fresh transition-all hover:shadow-chunky-fresh lg:py-4 lg:text-sm"
            >
              <RotateCcw className="h-4 w-4" />
              Play Again
            </motion.a>
            <motion.a
              href="/"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-primary bg-primary-light px-3 py-3 font-display text-xs font-bold text-primary transition-all hover:shadow-chunky-primary lg:py-4 lg:text-sm"
            >
              <Shuffle className="h-4 w-4" />
              New Category
            </motion.a>
            <motion.a
              href="/"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-border bg-surface-card px-3 py-3 font-display text-xs font-bold text-text-secondary transition-all hover:border-border-active lg:py-4 lg:text-sm"
            >
              <Home className="h-4 w-4" />
              Home
            </motion.a>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

/* ── Stat card component ── */
function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-border bg-surface-card p-2.5 text-center lg:p-3">
      <div className={`mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg lg:h-8 lg:w-8 bg-${color}-light`}>
        {icon}
      </div>
      <span className="block font-display text-lg font-black text-text-primary lg:text-xl">
        {value}
      </span>
      <span className="text-[10px] text-text-muted lg:text-[11px]">{label}</span>
    </div>
  );
}
