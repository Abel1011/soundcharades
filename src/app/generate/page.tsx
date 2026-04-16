"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
  RotateCcw,
  Home,
  AudioLines,
  CheckCircle2,
} from "lucide-react";
import { PlayfulBg } from "@/components/ui/mesh-bg";
import { SoundBuddy } from "@/components/ui/sound-buddy";
import type { BuddyMood } from "@/components/ui/sound-buddy";

type Phase = "input" | "generating" | "done" | "error";

interface ProgressState {
  step: string;
  detail: string;
  progress: number;
}

const STEP_LABELS: Record<string, string> = {
  init: "Starting...",
  concepts: "Brainstorming",
  embeddings: "Mapping concepts",
  audio: "Creating audio",
  storage: "Saving",
  complete: "Done!",
};

const POLL_INTERVAL = 2000;

export default function GeneratePage() {
  const router = useRouter();
  const [theme, setTheme] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [progress, setProgress] = useState<ProgressState>({
    step: "",
    detail: "",
    progress: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [conceptIds, setConceptIds] = useState<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  async function handleGenerate() {
    if (!theme.trim()) return;

    setPhase("generating");
    setError(null);
    setProgress({ step: "init", detail: "Starting generation...", progress: 0 });
    stopPolling();

    try {
      // Start the job
      const res = await fetch("/api/game/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: theme.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Server error ${res.status}`);
      }

      const { jobId } = await res.json();
      jobIdRef.current = jobId;

      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/game/generate?jobId=${jobId}`);
          if (!pollRes.ok) return;
          const data = await pollRes.json();

          setProgress({
            step: data.step,
            detail: data.detail,
            progress: data.progress,
          });

          if (data.status === "complete") {
            stopPolling();
            setConceptIds(data.conceptIds);
            setPhase("done");
          } else if (data.status === "error") {
            stopPolling();
            setError(data.error ?? "Generation failed");
            setPhase("error");
          }
        } catch {
          // Network blip — keep polling, don't fail
        }
      }, POLL_INTERVAL);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setPhase("error");
    }
  }

  function handlePlayNow() {
    const ids = conceptIds.join(",");
    router.push(`/play?mode=classic&difficulty=medium&conceptIds=${ids}`);
  }

  const buddyMood: BuddyMood =
    phase === "done"
      ? "excited"
      : phase === "error"
        ? "sad"
        : phase === "generating"
          ? "cool"
          : "happy";

  return (
    <div className="relative flex min-h-dvh flex-col bg-surface-base">
      <PlayfulBg />

      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center px-5 py-6 sm:px-8 lg:py-10">
        {/* Header */}
        <div className="flex w-full items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 rounded-xl bg-surface-card px-3 py-2 text-xs font-semibold text-text-muted transition-colors hover:bg-surface-raised"
          >
            <Home className="h-3.5 w-3.5" />
            Home
          </button>
          <div className="flex items-center gap-1 rounded-full bg-sunny/20 px-3 py-1 text-xs font-bold text-sunny">
            <Sparkles className="h-3 w-3" />
            Create Your Own
          </div>
        </div>

        {/* Buddy */}
        <motion.div
          className="mt-10 lg:mt-14"
          animate={
            phase === "generating"
              ? { scale: [1, 1.05, 1], rotate: [0, 3, -3, 0] }
              : {}
          }
          transition={
            phase === "generating"
              ? { repeat: Infinity, duration: 3, ease: "easeInOut" }
              : {}
          }
        >
          <SoundBuddy mood={buddyMood} className="mb-6 lg:mb-8" />
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ── Input Phase ── */}
          {phase === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex w-full flex-col items-center gap-6"
            >
              <div className="text-center">
                <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Create Your Own Quiz
                </h1>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary lg:text-base">
                  Type any theme and AI will generate a custom quiz with sounds
                  and riddle songs
                </p>
              </div>

              <div className="w-full">
                <input
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                  placeholder="e.g. anime, horror movies, 90s rock bands..."
                  maxLength={100}
                  className="w-full rounded-2xl border-2 border-border bg-surface-card px-5 py-4 text-base font-medium text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleGenerate}
                disabled={!theme.trim()}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-primary bg-primary px-6 py-4 font-display text-base font-extrabold text-white shadow-chunky-primary transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                <Sparkles className="h-5 w-5" />
                Generate Quiz
                <ArrowRight className="h-5 w-5" />
              </motion.button>

              <p className="text-center text-[11px] text-text-muted lg:text-xs">
                This generates 4 concepts with sound effects &amp; riddle songs.
                <br />
                It may take 3-5 minutes — grab a snack!
              </p>
            </motion.div>
          )}

          {/* ── Generating Phase ── */}
          {phase === "generating" && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex w-full flex-col items-center gap-6"
            >
              <div className="text-center">
                <h2 className="font-display text-2xl font-extrabold">
                  Creating your quiz...
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Theme:{" "}
                  <span className="font-semibold text-primary">{theme}</span>
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-text-secondary">
                    {STEP_LABELS[progress.step] ?? progress.step}
                  </span>
                  <span className="font-bold text-primary">
                    {Math.round(progress.progress)}%
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-surface-raised">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-sunny"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Detail text */}
              <div className="min-h-[3rem] rounded-xl bg-surface-card px-4 py-3 text-center">
                <p className="text-sm text-text-secondary">{progress.detail}</p>
              </div>

              {/* Spinning indicator */}
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>AI is composing sounds &amp; riddle songs...</span>
              </div>

              {/* Step icons */}
              <div className="flex items-center gap-3">
                {["concepts", "embeddings", "audio", "storage"].map((s) => {
                  const stepOrder = [
                    "concepts",
                    "embeddings",
                    "audio",
                    "storage",
                  ];
                  const currentIdx = stepOrder.indexOf(progress.step);
                  const thisIdx = stepOrder.indexOf(s);
                  const isDone = thisIdx < currentIdx;
                  const isActive = thisIdx === currentIdx;

                  return (
                    <div
                      key={s}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                        isDone
                          ? "border-fresh bg-fresh text-white"
                          : isActive
                            ? "border-primary bg-primary text-white"
                            : "border-border bg-surface-card text-text-muted"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isActive ? (
                        <AudioLines className="h-4 w-4" />
                      ) : (
                        thisIdx + 1
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Done Phase ── */}
          {phase === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex w-full flex-col items-center gap-6"
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
                  className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-fresh/20 px-4 py-1.5 text-sm font-bold text-fresh"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Quiz Ready!
                </motion.div>
                <h2 className="font-display text-2xl font-extrabold">
                  Let&apos;s play!
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  {conceptIds.length} concepts generated for{" "}
                  <span className="font-semibold text-primary">{theme}</span>
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={handlePlayNow}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-fresh bg-fresh px-6 py-4 font-display text-base font-extrabold text-white shadow-[4px_4px_0px_0px_var(--fresh)] transition-all hover:shadow-[8px_8px_0px_0px_var(--fresh)]"
              >
                Play Now!
                <ArrowRight className="h-5 w-5" />
              </motion.button>

              <button
                onClick={() => {
                  setPhase("input");
                  setConceptIds([]);
                  setTheme("");
                }}
                className="text-sm font-semibold text-text-muted transition-colors hover:text-text-secondary"
              >
                Generate another quiz
              </button>
            </motion.div>
          )}

          {/* ── Error Phase ── */}
          {phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex w-full flex-col items-center gap-6"
            >
              <div className="text-center">
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-pop/10 px-3 py-1 text-xs font-bold text-pop">
                  <AlertCircle className="h-3 w-3" />
                  Something went wrong
                </div>
                <p className="max-w-sm text-sm text-text-secondary">{error}</p>
              </div>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleGenerate}
                className="flex items-center gap-2 rounded-2xl border-2 border-primary bg-primary px-6 py-3 font-display text-sm font-bold text-white"
              >
                <RotateCcw className="h-4 w-4" />
                Try Again
              </motion.button>

              <button
                onClick={() => router.push("/")}
                className="text-sm font-semibold text-text-muted transition-colors hover:text-text-secondary"
              >
                Back to Home
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
