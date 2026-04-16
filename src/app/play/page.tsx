"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  Music,
  Waves,
  CheckCircle2,
  XCircle,
  X,
  Trophy,
  Zap,
  Timer,
  Lightbulb,
  Mic,
} from "lucide-react";
import { PlayfulBg } from "@/components/ui/mesh-bg";
import { GameBuddy } from "@/components/ui/game-buddy";
import {
  computeRoundResult,
  buildGameSummary,
} from "@/data/game";
import type { Category, Difficulty, GameSession, RoundResult } from "@/lib/types";

/* ── Timer config per mode ── */
const MODE_TIMER: Record<string, number> = {
  classic: 45_000,
  blitz: 30_000,
  marathon: 55_000,
};

/* ── SFX: first N clips are ambient, the rest are voice phrases ── */
const AMBIENT_SFX_COUNT = 4;

/* ── Fake waveform bars ── */
function generateBars(count: number) {
  return Array.from({ length: count }, () => 0.15 + Math.random() * 0.85);
}

/* ── Extract lyrics from musicPrompt (text after "Lyrics: ") ── */
function extractLyrics(musicPrompt: string): string {
  const match = musicPrompt.match(/Lyrics:\s*([\s\S]*)/);
  if (!match) return musicPrompt;
  // Format: convert (Verse), (Chorus) etc into line breaks
  return match[1]
    .replace(/\s*\(Verse\)\s*/gi, "\n\n🎤 Verse\n")
    .replace(/\s*\(Chorus\)\s*/gi, "\n\n🎵 Chorus\n")
    .replace(/\s*\(Bridge\)\s*/gi, "\n\n🌉 Bridge\n")
    .replace(/\s*\(Outro\)\s*/gi, "\n\n🔚 Outro\n")
    .replace(/\s*\/\s*/g, "\n")
    .trim();
}

/* ─────────────────────── Wrapper ─────────────────────── */

export default function PlayPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-surface-base">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <PlayPageInner />
    </Suspense>
  );
}

/* ─────────────────────── Main Game ─────────────────────── */

function PlayPageInner() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") ?? "classic";
  const categoryParam = searchParams.get("category") as Category | null;
  const difficultyParam = (searchParams.get("difficulty") ?? "medium") as Difficulty;
  const conceptIdsParam = searchParams.get("conceptIds");

  const [session, setSession] = useState<GameSession | null>(null);
  const [phase, setPhase] = useState<
    "countdown" | "playing" | "result" | "finished"
  >("countdown");

  // Round state
  const [isPlaying, setIsPlaying] = useState(false);
  const [replays, setReplays] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [timerMs, setTimerMs] = useState(0);
  const [bars] = useState(() => generateBars(40));
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentSfxIndex, setCurrentSfxIndex] = useState(0);
  const [usedHint, setUsedHint] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [heardVoice, setHeardVoice] = useState(false);
  const [playSeq, setPlaySeq] = useState(0); // bumped to force audio restart

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* ── Init: fetch session from API ── */
  useEffect(() => {
    const roundCount = { classic: 10, blitz: 5, marathon: 20 }[mode] ?? 10;
    let cancelled = false;

    async function fetchSession() {
      try {
        const conceptIds = conceptIdsParam ? conceptIdsParam.split(",") : undefined;
        const res = await fetch("/api/game/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, category: categoryParam, difficulty: difficultyParam, roundCount, conceptIds }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Server error ${res.status}`);
        }
        const data: GameSession = await res.json();
        if (!cancelled) setSession(data);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load game");
      }
    }

    fetchSession();
    return () => { cancelled = true; };
  }, [mode, categoryParam, difficultyParam, conceptIdsParam]);

  /* ── Countdown ── */
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("playing");
      setIsPlaying(true);
      startTimeRef.current = Date.now();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  /* ── Timer ── */
  const maxTime = MODE_TIMER[session?.mode ?? "classic"] ?? 20_000;
  useEffect(() => {
    if (phase !== "playing" || selectedAnswer !== null) return;
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setTimerMs(elapsed);
      if (elapsed >= maxTime) handleAnswer(null);
    }, 50);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedAnswer, maxTime]);

  const round = session?.rounds[session.currentRound] ?? null;
  const totalScore =
    session?.results.reduce((s, r) => s + r.totalPoints, 0) ?? 0;

  /* ── Audio playback ── */
  // Get the audio URLs for the current round
  const audioUrls = round
    ? round.type === "sfx"
      ? round.concept.audioSfxUrls
      : round.concept.audioMusicUrls
    : [];

  // Track when voice clips start playing (SFX index >= AMBIENT_SFX_COUNT)
  useEffect(() => {
    if (round?.type === "sfx" && currentSfxIndex >= AMBIENT_SFX_COUNT && !heardVoice) {
      setHeardVoice(true);
    }
  }, [currentSfxIndex, round?.type, heardVoice]);

  // Play/pause audio when isPlaying changes
  useEffect(() => {
    if (!audioUrls.length) return;

    if (isPlaying) {
      // For SFX: play files sequentially; for music: play the single file
      const url = round?.type === "sfx" ? audioUrls[currentSfxIndex] : audioUrls[0];
      if (!url) return;

      // Reuse or create audio element
      if (!audioRef.current || audioRef.current.src !== new URL(url, window.location.origin).href) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.removeAttribute("src");
        }
        const audio = new Audio(url);
        audioRef.current = audio;
      }

      audioRef.current.play().catch(() => {/* autoplay blocked */});

      // For SFX: chain to next clip when current ends
      if (round?.type === "sfx") {
        const onEnded = () => {
          const nextIdx = currentSfxIndex + 1;
          if (nextIdx < audioUrls.length) {
            setCurrentSfxIndex(nextIdx);
          }
          // If last clip, just stop — don't set isPlaying false so waveform stays active
        };
        audioRef.current.addEventListener("ended", onEnded, { once: true });
        return () => {
          audioRef.current?.removeEventListener("ended", onEnded);
        };
      }
    } else {
      audioRef.current?.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentSfxIndex, playSeq]);

  // Stop audio on phase change (result, countdown)
  useEffect(() => {
    if (phase !== "playing") {
      audioRef.current?.pause();
    }
  }, [phase]);

  // Cleanup audio on round change
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current = null;
      }
    };
  }, [session?.currentRound]);

  /* ── Answer ── */
  const handleAnswer = useCallback(
    (index: number | null) => {
      if (!round || selectedAnswer !== null) return;
      if (timerRef.current) clearInterval(timerRef.current);

      const elapsed = Date.now() - startTimeRef.current;
      setSelectedAnswer(index);
      setIsPlaying(false);

      const result = computeRoundResult(round, index, elapsed, replays, {
        usedHint,
        heardVoice,
      });
      setRoundResult(result);
      setPhase("result");
      setPointsEarned(result.totalPoints);

      setSession((prev) =>
        prev ? { ...prev, results: [...prev.results, result] } : prev
      );
    },
    [round, selectedAnswer, replays, usedHint, heardVoice]
  );

  /* ── Next round ── */
  const handleNext = useCallback(() => {
    if (!session) return;
    const nextIndex = session.currentRound + 1;
    if (nextIndex >= session.rounds.length) {
      setPhase("finished");
      return;
    }
    setSession((prev) =>
      prev ? { ...prev, currentRound: nextIndex } : prev
    );
    setSelectedAnswer(null);
    setRoundResult(null);
    setReplays(0);
    setTimerMs(0);
    setPointsEarned(null);
    setCurrentSfxIndex(0);
    setUsedHint(false);
    setShowHint(false);
    setHeardVoice(false);
    setPhase("playing");
    setIsPlaying(true);
    startTimeRef.current = Date.now();
  }, [session]);

  /* ── Replay audio (restarts the audio, costs -200 pts) ── */
  const handleReplay = () => {
    if (selectedAnswer !== null) return;
    setReplays((r) => r + 1);
    // Reset SFX chain to first clip
    setCurrentSfxIndex(0);
    // Stop current audio so the useEffect restarts it
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current = null;
    }
    setIsPlaying(true);
    // Bump sequence to force useEffect re-run even if isPlaying was already true
    setPlaySeq((s) => s + 1);
  };

  /* ── Finished ── */
  if (phase === "finished" && session) {
    const summary = buildGameSummary(session);
    return <GameFinishedRedirect summary={summary} />;
  }

  if (!session || !round) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-base px-6">
        {loadError ? (
          <div className="w-full max-w-xs text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-pop-light">
              <XCircle className="h-6 w-6 text-pop" />
            </div>
            <h3 className="font-display text-lg font-extrabold">
              Oops!
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              {loadError}
            </p>
            <a
              href="/"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-display text-sm font-bold text-white"
            >
              Back Home
            </a>
          </div>
        ) : (
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        )}
      </div>
    );
  }

  const timerProgress = Math.min(timerMs / maxTime, 1);
  const isUrgent = timerProgress > 0.75;
  const timerSeconds = Math.max(0, Math.ceil((maxTime - timerMs) / 1000));

  const buddyState: "idle" | "playing" | "correct" | "wrong" =
    phase === "result"
      ? roundResult?.isCorrect
        ? "correct"
        : "wrong"
      : isPlaying
        ? "playing"
        : "idle";

  return (
    <div className="relative flex min-h-dvh flex-col bg-surface-base">
      <PlayfulBg />

      {/* ═══════════ Quit confirmation ═══════════ */}
      <AnimatePresence>
        {showQuitDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 px-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-xs rounded-3xl border-2 border-border bg-surface-card p-6 text-center shadow-chunky-primary"
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-pop-light">
                <X className="h-6 w-6 text-pop" />
              </div>
              <h3 className="font-display text-lg font-extrabold">
                Quit game?
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                Your progress will be lost. You&apos;ve scored{" "}
                <span className="font-bold text-primary">
                  {totalScore.toLocaleString()} pts
                </span>{" "}
                so far!
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowQuitDialog(false)}
                  className="rounded-xl border-2 border-border bg-surface-card px-4 py-2.5 font-display text-sm font-bold text-text-secondary transition-colors hover:bg-surface-raised"
                >
                  Keep Playing
                </motion.button>
                <motion.a
                  href="/"
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center justify-center rounded-xl border-2 border-pop bg-pop px-4 py-2.5 font-display text-sm font-bold text-white"
                >
                  Quit
                </motion.a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ Hint overlay ═══════════ */}
      <AnimatePresence>
        {showHint && round && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-text-primary/40 px-4 pb-6 sm:items-center sm:pb-0"
            onClick={() => setShowHint(false)}
          >
            <motion.div
              initial={{ y: 60, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 60, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl border-2 border-primary/30 bg-surface-card p-5 shadow-chunky-primary sm:max-w-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-light">
                    <Lightbulb className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-display text-base font-extrabold">
                    {round.type === "sfx" ? "Sound Clues" : "Lyrics"}
                  </h3>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowHint(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-raised text-text-muted hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>

              {round.type === "sfx" ? (
                <div className="space-y-1.5">
                  {round.concept.sfxPrompts.map((prompt, i) => {
                    const isVoice = i >= AMBIENT_SFX_COUNT;
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${
                          isVoice
                            ? "border border-pop/20 bg-pop-light"
                            : "bg-surface-raised"
                        }`}
                      >
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                          isVoice ? "bg-pop/20 text-pop" : "bg-fresh/20 text-fresh"
                        }`}>
                          {isVoice ? <Mic className="h-3 w-3" /> : i + 1}
                        </span>
                        <span className="text-text-secondary">{prompt}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl bg-surface-raised px-4 py-3">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
                    {extractLyrics(round.concept.musicPrompt)}
                  </p>
                </div>
              )}

              <p className="mt-3 text-center text-[11px] font-medium text-text-muted">
                Using a hint costs <span className="font-bold text-primary">-300 pts</span>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ Countdown ═══════════ */}
      <AnimatePresence>
        {phase === "countdown" && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-surface-base"
          >
            <div className="relative flex items-center justify-center">
              {/* Pulse ring — centered via translate so it always expands from center */}
              <motion.div
                key={`ring-${countdown}`}
                className="absolute left-1/2 top-1/2 rounded-full border-4 border-primary"
                style={{ translateX: "-50%", translateY: "-50%" }}
                initial={{ width: 80, height: 80, opacity: 0.7 }}
                animate={{ width: 280, height: 280, opacity: 0 }}
                transition={{ duration: 0.85, ease: "easeOut" }}
              />
              <motion.div
                key={countdown}
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 0.35, ease: "backOut" }}
                className="flex h-20 w-20 items-center justify-center rounded-3xl border-3 border-primary bg-primary-light shadow-chunky-primary"
              >
                <span className="font-display text-5xl font-black text-primary">
                  {countdown > 0 ? countdown : "GO"}
                </span>
              </motion.div>
            </div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-6 font-display text-sm font-bold text-text-muted sm:text-base"
            >
              {countdown > 1
                ? "Get ready..."
                : countdown === 1
                  ? "Almost..."
                  : "Listen carefully!"}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-10"
            >
              <GameBuddy roundType={round.type} state="idle" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ Game content ═══════════ */}
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-4 sm:max-w-xl sm:px-8 sm:py-6 lg:max-w-2xl lg:px-12 lg:py-8">
        {/* ── Top bar ── */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowQuitDialog(true)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-border bg-surface-card text-text-muted transition-colors hover:border-pop hover:text-pop"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </motion.button>
            <div className="rounded-full bg-primary-muted px-3 py-1 text-xs font-bold text-primary sm:px-4 sm:py-1.5 sm:text-sm">
              {session.currentRound + 1}
              <span className="text-text-muted">
                /{session.rounds.length}
              </span>
            </div>
          </div>

          {/* Score with floating +points */}
          <div className="relative flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-sunny sm:h-4 sm:w-4" />
            <span className="font-display text-sm font-bold tabular-nums text-text-primary sm:text-base">
              {totalScore.toLocaleString()}
            </span>
            <AnimatePresence>
              {pointsEarned !== null && pointsEarned > 0 && (
                <motion.span
                  key={`pts-${session.currentRound}`}
                  initial={{ opacity: 0, y: 0, scale: 0.5 }}
                  animate={{ opacity: 1, y: -22, scale: 1 }}
                  exit={{ opacity: 0, y: -36 }}
                  transition={{ duration: 0.9 }}
                  className="absolute -top-1 right-0 font-display text-xs font-black text-fresh"
                >
                  +{pointsEarned}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* ── Round progress dots ── */}
        <div className="mt-3 flex items-center gap-1 sm:mt-4 sm:gap-1.5">
          {session.rounds.map((_, i) => {
            const result = session.results[i];
            const isCurrent = i === session.currentRound;
            let dotClass = "bg-border";
            if (result?.isCorrect) dotClass = "bg-fresh";
            else if (result && !result.isCorrect) dotClass = "bg-pop";
            else if (isCurrent) dotClass = "bg-primary";
            return (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 sm:h-2 ${dotClass} ${
                  isCurrent ? "ring-2 ring-primary/30" : ""
                }`}
              />
            );
          })}
        </div>

        {/* ── Timer ── */}
        <div className="relative mt-4 sm:mt-5">
          <div
            className={`h-2.5 w-full overflow-hidden rounded-full bg-surface-card sm:h-3 ${
              isUrgent && phase === "playing" ? "animate-urgent" : ""
            }`}
          >
            <motion.div
              className={`h-full rounded-full transition-colors duration-500 ${
                isUrgent
                  ? "bg-pop"
                  : timerProgress > 0.5
                    ? "bg-sunny"
                    : "bg-fresh"
              }`}
              style={{ width: `${(1 - timerProgress) * 100}%` }}
            />
          </div>
          <div
            className={`absolute -top-0.5 right-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isUrgent
                ? "bg-pop-light text-pop"
                : "bg-surface-raised text-text-muted"
            }`}
          >
            <Timer className="h-2.5 w-2.5" />
            <span className="min-w-[18px] text-right tabular-nums sm:text-[11px]">{timerSeconds}s</span>
          </div>
        </div>

        {/* ── Mascot + audio card ── */}
        <div className="mt-4 flex flex-col items-center sm:mt-5">
          {/* Round type badge */}
          <div className="mb-3 flex items-center gap-2 sm:mb-4">
            {round.type === "sfx" ? (
              <div className="flex items-center gap-1.5 rounded-full border-2 border-fresh bg-fresh-light px-3.5 py-1 text-xs font-bold text-fresh sm:px-4 sm:py-1.5 sm:text-sm">
                <Waves className="h-3.5 w-3.5" />
                Sound Chain
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full border-2 border-pop bg-pop-light px-3.5 py-1 text-xs font-bold text-pop sm:px-4 sm:py-1.5 sm:text-sm">
                <Music className="h-3.5 w-3.5" />
                Riddle Song
              </div>
            )}
            {replays > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="rounded-full bg-sunny-light px-2 py-0.5 text-[10px] font-bold text-sunny"
              >
                -{replays * 200} pts
              </motion.div>
            )}
          </div>

          {/* ── Big audio card with mascot ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`w-full overflow-hidden rounded-3xl border-2 transition-colors duration-300 sm:rounded-[2rem] ${
              round.type === "sfx"
                ? "border-fresh/40 bg-fresh-light"
                : "border-pop/40 bg-pop-light"
            }`}
          >
            {/* Mascot centered */}
            <div className="flex justify-center pt-5 pb-2 sm:pt-6 sm:pb-3">
              <GameBuddy
                roundType={round.type}
                state={buddyState}
              />
            </div>

            {/* Waveform — full width */}
            <div className="px-5 pb-3 sm:px-8 sm:pb-4">
              <div className="flex h-14 items-end justify-center gap-[2px] sm:h-20 sm:gap-[3px]">
                  {bars.map((h, i) => (
                    <motion.div
                      key={i}
                      className={`w-[4px] rounded-full ${
                        isPlaying
                          ? round.type === "sfx"
                            ? "bg-fresh"
                            : "bg-pop"
                          : phase === "result"
                            ? roundResult?.isCorrect
                              ? "bg-fresh/50"
                              : "bg-pop/50"
                            : "bg-border-active"
                      } sm:w-[5px]`}
                      animate={
                        isPlaying
                          ? {
                              height: [
                                `${h * 100}%`,
                                `${(0.15 + Math.random() * 0.85) * 100}%`,
                                `${h * 100}%`,
                              ],
                            }
                          : { height: `${h * 60}%` }
                      }
                      transition={
                        isPlaying
                          ? {
                              duration: 0.3 + Math.random() * 0.3,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }
                          : { duration: 0.5 }
                      }
                    />
                  ))}
                </div>

              {/* SFX step indicators */}
              {round.type === "sfx" && (
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  {round.concept.audioSfxUrls.map((_, i) => (
                    <div
                      key={i}
                      className={`flex h-5 w-5 items-center justify-center rounded-md font-display text-[10px] font-bold transition-colors ${
                        i === currentSfxIndex && isPlaying
                          ? "bg-fresh text-white"
                          : i < currentSfxIndex
                            ? "bg-fresh/40 text-fresh"
                            : "bg-fresh/20 text-fresh"
                      }`}
                    >
                      {i + 1}
                    </div>
                  ))}
                  <span className="ml-1 text-[10px] text-text-muted">
                    {round.concept.audioSfxUrls.length} sounds
                  </span>
                </div>
              )}
            </div>

            {/* Controls bar */}
            <div className="flex items-center justify-between border-t border-border/30 bg-surface-card/60 px-4 py-3 sm:px-6 sm:py-4">
              {/* Replay */}
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={handleReplay}
                disabled={selectedAnswer !== null}
                className="group flex w-[90px] items-center justify-center gap-1.5 rounded-xl bg-surface-raised px-2 py-2 text-text-muted transition-all hover:bg-surface-overlay disabled:opacity-30"
              >
                <RotateCcw className="h-3.5 w-3.5 transition-transform group-hover:-rotate-180 group-hover:duration-500" />
                <span className="text-[11px] font-semibold">Replay</span>
                <span className="rounded bg-sunny-light px-1 py-px text-[9px] font-bold text-sunny sm:text-[10px]">
                  -200
                </span>
              </motion.button>

              {/* Play / Pause */}
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => setIsPlaying(!isPlaying)}
                className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white transition-all sm:h-14 sm:w-14 ${
                  round.type === "sfx"
                    ? "bg-fresh shadow-chunky-fresh"
                    : "bg-pop shadow-chunky-pop"
                }`}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" fill="currentColor" />
                ) : (
                  <Play
                    className="h-5 w-5 translate-x-[1px]"
                    fill="currentColor"
                  />
                )}
              </motion.button>

              {/* Speed bonus live indicator */}
              <div className="flex w-[90px] items-center justify-center gap-1 rounded-xl bg-surface-raised px-2 py-2 text-text-muted">
                <Zap className="h-3.5 w-3.5 shrink-0 text-sunny" />
                <span className="min-w-[32px] text-right font-display text-[11px] font-semibold tabular-nums">
                  +{Math.max(0, Math.round(500 * (1 - timerMs / 30_000)))}
                </span>
                <span className="text-[9px] text-text-muted">bonus</span>
              </div>
            </div>

            {/* Hint + penalty row */}
            <div className="flex items-center justify-center gap-2 border-t border-border/20 bg-surface-card/40 px-4 py-2">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  if (!usedHint) setUsedHint(true);
                  setShowHint(true);
                }}
                disabled={selectedAnswer !== null}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-all disabled:opacity-30 ${
                  usedHint
                    ? "border border-primary/30 bg-primary-muted text-primary"
                    : "border border-border bg-surface-raised text-text-muted hover:border-primary/40 hover:bg-primary-light hover:text-primary"
                }`}
              >
                <Lightbulb className="h-3.5 w-3.5" />
                {usedHint ? "Hint active" : "Use Hint"}
                {!usedHint && (
                  <span className="rounded bg-sunny-light px-1 py-px text-[9px] font-bold text-sunny">
                    -300
                  </span>
                )}
              </motion.button>

              <AnimatePresence>
                {heardVoice && phase === "playing" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1 rounded-full bg-pop-light px-2.5 py-1"
                  >
                    <Mic className="h-3 w-3 text-pop" />
                    <span className="text-[10px] font-bold text-pop">-150</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* ── Answer options ── */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          {round.options.map((option, i) => {
            const isSelected = selectedAnswer === i;
            const isCorrectOption = i === round.correctIndex;
            const showResult = phase === "result";

            let cardClass =
              "border-2 border-border bg-surface-card hover:border-primary/40 hover:bg-primary-light active:scale-[0.97]";
            if (showResult && isCorrectOption) {
              cardClass =
                "border-2 border-fresh bg-fresh-light shadow-chunky-fresh";
            } else if (showResult && isSelected && !isCorrectOption) {
              cardClass =
                "border-2 border-pop bg-pop-light shadow-chunky-pop";
            } else if (showResult) {
              cardClass =
                "border-2 border-border bg-surface-card opacity-50";
            }

            const letterBg =
              showResult && isCorrectOption
                ? "bg-fresh text-white"
                : showResult && isSelected && !isCorrectOption
                  ? "bg-pop text-white"
                  : "bg-surface-raised text-text-muted";

            return (
              <motion.button
                key={i}
                initial={false}
                whileTap={
                  phase !== "result" ? { scale: 0.95 } : undefined
                }
                animate={
                  showResult && isCorrectOption
                    ? { scale: [1, 1.04, 1] }
                    : showResult && isSelected && !isCorrectOption
                      ? { x: [-2, 2, -2, 2, 0] }
                      : {}
                }
                transition={{ duration: 0.4 }}
                onClick={() =>
                  phase === "playing" && handleAnswer(i)
                }
                disabled={phase === "result"}
                className={`relative flex items-center gap-2.5 rounded-2xl px-3 py-3.5 text-left transition-all duration-200 sm:gap-3 sm:px-4 sm:py-4 ${cardClass}`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl font-display text-xs font-bold transition-colors sm:h-9 sm:w-9 sm:text-sm ${letterBg}`}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1 font-display text-[13px] font-bold leading-tight text-text-primary sm:text-sm">
                  {option}
                </span>
                {showResult && isCorrectOption && (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-fresh" />
                )}
                {showResult && isSelected && !isCorrectOption && (
                  <XCircle className="h-5 w-5 shrink-0 text-pop" />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* ── Result feedback ── */}
        <AnimatePresence>
          {phase === "result" && roundResult && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{
                type: "spring",
                stiffness: 280,
                damping: 22,
              }}
              className="mt-4"
            >
              <div
                className={`rounded-3xl border-2 p-5 ${
                  roundResult.isCorrect
                    ? "border-fresh bg-fresh-light"
                    : "border-pop bg-pop-light"
                }`}
              >
                {/* Header */}
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 15,
                    }}
                  >
                    {roundResult.isCorrect ? (
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-fresh shadow-chunky-fresh">
                        <CheckCircle2 className="h-6 w-6 text-white" />
                      </div>
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pop shadow-chunky-pop">
                        <XCircle className="h-6 w-6 text-white" />
                      </div>
                    )}
                  </motion.div>
                  <div className="flex-1">
                    <h3 className="font-display text-lg font-extrabold">
                      {roundResult.isCorrect ? "Correct!" : "Not quite!"}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      It was{" "}
                      <span className="font-bold text-text-primary">
                        {round.concept.name}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Score breakdown chips */}
                {roundResult.isCorrect && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ delay: 0.2 }}
                    className="mt-4 flex flex-wrap items-center justify-center gap-2"
                  >
                    <ScoreChip
                      label="base"
                      value={`+${roundResult.basePoints}`}
                      variant="fresh"
                    />
                    {roundResult.speedBonus > 0 && (
                      <ScoreChip
                        label="speed"
                        value={`+${roundResult.speedBonus}`}
                        variant="primary"
                      />
                    )}
                    {roundResult.replayPenalty > 0 && (
                      <ScoreChip
                        label="replay"
                        value={`-${roundResult.replayPenalty}`}
                        variant="pop"
                      />
                    )}
                    {roundResult.hintPenalty > 0 && (
                      <ScoreChip
                        label="hint"
                        value={`-${roundResult.hintPenalty}`}
                        variant="pop"
                      />
                    )}
                    {roundResult.voicePenalty > 0 && (
                      <ScoreChip
                        label="voice"
                        value={`-${roundResult.voicePenalty}`}
                        variant="pop"
                      />
                    )}
                  </motion.div>
                )}

                {/* Next button */}
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleNext}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 font-display text-sm font-extrabold text-white shadow-chunky-primary transition-all"
                >
                  {session.currentRound + 1 < session.rounds.length ? (
                    <>
                      Next Round
                      <ChevronRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      See Results
                      <Trophy className="h-4 w-4" />
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="h-6" />
      </div>
    </div>
  );
}

/* ── Score chip ── */
function ScoreChip({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: "fresh" | "primary" | "pop";
}) {
  const styles = {
    fresh: "bg-fresh-light border-fresh/20 text-fresh",
    primary: "bg-primary-light border-primary/20 text-primary",
    pop: "bg-pop-light border-pop/20 text-pop",
  };
  return (
    <div
      className={`rounded-xl border px-3 py-1.5 text-center ${styles[variant]}`}
    >
      <span className="block font-display text-base font-black">
        {value}
      </span>
      <span className="text-[10px] font-medium text-text-muted">
        {label}
      </span>
    </div>
  );
}

/* ── Redirect to results ── */
function GameFinishedRedirect({
  summary,
}: {
  summary: ReturnType<typeof buildGameSummary>;
}) {
  useEffect(() => {
    sessionStorage.setItem("game-summary", JSON.stringify(summary));
    window.location.href = "/results";
  }, [summary]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-base">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
