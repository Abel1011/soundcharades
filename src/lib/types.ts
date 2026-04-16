export type Category = "movies" | "series" | "videogames" | "countries" | "food" | "music" | "custom";

export type Difficulty = "easy" | "medium" | "hard";

export type RoundType = "sfx" | "music";

export interface GameCategory {
  id: Category;
  label: string;
  icon: string; // lucide icon name
  description: string;
  count: number;
}

export interface GameMode {
  id: string;
  label: string;
  description: string;
  rounds: number;
  icon: string;
}

/* ─── Game Session Types ─── */

export interface Concept {
  id: string;
  name: string;
  description: string;
  category: Category;
  difficulty: Difficulty;
  sfxPrompts: string[];
  musicPrompt: string;
  audioSfxUrls: string[];
  audioMusicUrls: string[];
}

export interface RoundData {
  index: number; // 0-based
  type: RoundType;
  concept: Concept;
  options: string[]; // 4 answer strings (1 correct + 3 distractors)
  correctIndex: number; // index within options[]
}

export interface RoundResult {
  roundIndex: number;
  selectedIndex: number | null; // null = timed out
  isCorrect: boolean;
  basePoints: number;
  speedBonus: number;
  replayPenalty: number;
  hintPenalty: number;
  voicePenalty: number;
  totalPoints: number;
  timeMs: number; // how long the player took
  replays: number;
  usedHint: boolean;
  heardVoice: boolean;
}

export interface GameSession {
  id: string;
  mode: string;
  category: Category | null; // null = mixed
  difficulty: Difficulty;
  rounds: RoundData[];
  results: RoundResult[];
  currentRound: number;
  status: "lobby" | "playing" | "result" | "finished";
}

export interface GameSummary {
  totalScore: number;
  correctCount: number;
  totalRounds: number;
  avgTimeMs: number;
  bestStreak: number;
  results: RoundResult[];
  rounds: RoundData[];
  mode: string;
  category: Category | null;
  difficulty: Difficulty;
}
