"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Trophy,
  Target,
  Flame,
  Clock,
  Trash2,
  Smile,
  Brain,
  Skull,
  Zap,
  AudioLines,
  CheckCircle2,
} from "lucide-react";
import { PlayfulBg } from "@/components/ui/mesh-bg";
import { SoundBuddy } from "@/components/ui/sound-buddy";
import { getHistory, getHistoryStats, clearHistory } from "@/lib/history";
import type { HistoryEntry, HistoryStats } from "@/lib/history";
import { CATEGORIES, DIFFICULTIES } from "@/data/landing";
import type { Difficulty } from "@/lib/types";

const DIFF_ICONS: Record<string, typeof Smile> = { easy: Smile, medium: Brain, hard: Skull };
const DIFF_COLORS: Record<string, string> = {
  easy: "bg-fresh-light text-fresh",
  medium: "bg-sunny-light text-sunny",
  hard: "bg-pop-light text-pop",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getGradeLetter(accuracy: number): { letter: string; color: string } {
  if (accuracy >= 90) return { letter: "S", color: "text-sunny" };
  if (accuracy >= 75) return { letter: "A", color: "text-fresh" };
  if (accuracy >= 60) return { letter: "B", color: "text-primary" };
  if (accuracy >= 40) return { letter: "C", color: "text-text-secondary" };
  return { letter: "D", color: "text-pop" };
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const h = getHistory();
    setEntries(h);
    setStats(getHistoryStats(h));
  }, []);

  function handleClear() {
    clearHistory();
    setEntries([]);
    setStats(getHistoryStats([]));
    setConfirmClear(false);
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-surface-base">
      <PlayfulBg />

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-6 sm:max-w-xl sm:px-8 lg:max-w-2xl lg:px-12 lg:py-10">
        {/* Header */}
        <header className="flex items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-2 text-text-muted transition-colors hover:text-text-primary"
          >
            <Home className="h-4 w-4" />
            <span className="text-xs font-semibold">Home</span>
          </a>
          <div className="flex items-center gap-1.5 rounded-full bg-primary-muted px-3 py-1 text-xs font-bold text-primary">
            <Clock className="h-3 w-3" />
            Game History
          </div>
        </header>

        {/* Title */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 flex flex-col items-center text-center lg:mt-12"
        >
          <SoundBuddy className="mb-4 scale-75 lg:mb-6 lg:scale-90" mood={entries.length > 0 ? "happy" : "meh"} />
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Your History
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {entries.length > 0
              ? `${entries.length} game${entries.length === 1 ? "" : "s"} played`
              : "No games yet — go play one!"}
          </p>
        </motion.section>

        {/* Lifetime Stats */}
        {stats && stats.totalGames > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-6 grid grid-cols-4 gap-2.5 lg:gap-3"
          >
            <StatCard
              icon={<AudioLines className="h-4 w-4 text-primary" />}
              value={`${stats.totalGames}`}
              label="Games"
              color="primary"
            />
            <StatCard
              icon={<Trophy className="h-4 w-4 text-sunny" />}
              value={stats.bestScore.toLocaleString()}
              label="Best"
              color="sunny"
            />
            <StatCard
              icon={<Target className="h-4 w-4 text-fresh" />}
              value={`${stats.avgAccuracy}%`}
              label="Avg acc."
              color="fresh"
            />
            <StatCard
              icon={<Flame className="h-4 w-4 text-pop" />}
              value={`${stats.bestStreak}`}
              label="Streak"
              color="pop"
            />
          </motion.section>
        )}

        {/* Game list */}
        {entries.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-6 space-y-2"
          >
            {entries.map((entry, i) => {
              const grade = getGradeLetter(entry.accuracy);
              const DiffIcon = DIFF_ICONS[entry.difficulty] ?? Brain;
              const diffColor = DIFF_COLORS[entry.difficulty] ?? DIFF_COLORS.medium;
              const catLabel = entry.category
                ? CATEGORIES.find((c) => c.id === entry.category)?.label ?? entry.category
                : "Mixed";
              const diffLabel = DIFFICULTIES.find((d) => d.id === entry.difficulty)?.label ?? "Medium";

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * Math.min(i, 10) }}
                  className="flex items-center gap-3 rounded-2xl border-2 border-border bg-surface-card p-3 transition-colors hover:bg-surface-raised lg:p-4"
                >
                  {/* Grade */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-raised font-display text-xl font-black lg:h-12 lg:w-12 lg:text-2xl ${grade.color}`}>
                    {grade.letter}
                  </div>

                  {/* Info */}
                  <div className="flex flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-bold text-text-primary lg:text-base">
                        {entry.totalScore.toLocaleString()} pts
                      </span>
                      <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${diffColor}`}>
                        <DiffIcon className="h-2.5 w-2.5" />
                        {diffLabel}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-text-muted">
                      <span>{catLabel}</span>
                      <span>·</span>
                      <span>{entry.correctCount}/{entry.totalRounds} correct</span>
                      <span>·</span>
                      <span>{entry.accuracy}%</span>
                    </div>
                  </div>

                  {/* Time */}
                  <span className="shrink-0 text-[11px] text-text-muted">
                    {formatDate(entry.playedAt)}
                  </span>
                </motion.div>
              );
            })}
          </motion.section>
        )}

        {/* Empty state */}
        {entries.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-12 flex flex-col items-center gap-4"
          >
            <motion.a
              href="/"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 rounded-2xl border-2 border-primary bg-primary px-6 py-3 font-display text-sm font-bold text-white"
            >
              <Zap className="h-4 w-4" />
              Play Your First Game
            </motion.a>
          </motion.div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Clear history */}
        {entries.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 flex justify-center pb-6"
          >
            <AnimatePresence mode="wait">
              {!confirmClear ? (
                <motion.button
                  key="clear"
                  onClick={() => setConfirmClear(true)}
                  className="flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-pop"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear History
                </motion.button>
              ) : (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-xs text-text-muted">Delete all history?</span>
                  <button
                    onClick={handleClear}
                    className="rounded-lg bg-pop px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-pop-hover"
                  >
                    Yes, clear
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="rounded-lg bg-surface-raised px-3 py-1 text-xs font-semibold text-text-muted transition-colors hover:bg-surface-overlay"
                  >
                    Cancel
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}

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
