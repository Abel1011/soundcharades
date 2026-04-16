import type { GameSummary, Category, Difficulty } from "./types";

const STORAGE_KEY = "soundcharades-history";
const MAX_ENTRIES = 50;

export interface HistoryEntry {
  id: string;
  playedAt: string; // ISO timestamp
  totalScore: number;
  correctCount: number;
  totalRounds: number;
  accuracy: number; // 0-100
  avgTimeMs: number;
  bestStreak: number;
  mode: string;
  category: Category | null;
  difficulty: Difficulty;
}

export function saveGameToHistory(summary: GameSummary): void {
  const entries = getHistory();
  const accuracy = Math.round((summary.correctCount / summary.totalRounds) * 100);

  const entry: HistoryEntry = {
    id: `game-${Date.now()}`,
    playedAt: new Date().toISOString(),
    totalScore: summary.totalScore,
    correctCount: summary.correctCount,
    totalRounds: summary.totalRounds,
    accuracy,
    avgTimeMs: summary.avgTimeMs,
    bestStreak: summary.bestStreak,
    mode: summary.mode,
    category: summary.category,
    difficulty: summary.difficulty,
  };

  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full — remove oldest half and retry
    entries.length = Math.floor(entries.length / 2);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
}

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export interface HistoryStats {
  totalGames: number;
  avgScore: number;
  avgAccuracy: number;
  bestScore: number;
  bestStreak: number;
  totalCorrect: number;
  totalRounds: number;
}

export function getHistoryStats(entries: HistoryEntry[]): HistoryStats {
  if (entries.length === 0) {
    return { totalGames: 0, avgScore: 0, avgAccuracy: 0, bestScore: 0, bestStreak: 0, totalCorrect: 0, totalRounds: 0 };
  }
  const totalGames = entries.length;
  const avgScore = Math.round(entries.reduce((s, e) => s + e.totalScore, 0) / totalGames);
  const avgAccuracy = Math.round(entries.reduce((s, e) => s + e.accuracy, 0) / totalGames);
  const bestScore = Math.max(...entries.map((e) => e.totalScore));
  const bestStreak = Math.max(...entries.map((e) => e.bestStreak));
  const totalCorrect = entries.reduce((s, e) => s + e.correctCount, 0);
  const totalRounds = entries.reduce((s, e) => s + e.totalRounds, 0);
  return { totalGames, avgScore, avgAccuracy, bestScore, bestStreak, totalCorrect, totalRounds };
}
