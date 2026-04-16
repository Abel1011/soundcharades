import type { GameCategory, GameMode, Difficulty } from "@/lib/types";

export const CATEGORIES: GameCategory[] = [
  {
    id: "movies",
    label: "Movies",
    icon: "clapperboard",
    description: "Guess the movie from its sound clues",
    count: 50,
  },
  {
    id: "series",
    label: "TV Series",
    icon: "tv",
    description: "Iconic shows turned into audio puzzles",
    count: 35,
  },
  {
    id: "videogames",
    label: "Videogames",
    icon: "gamepad-2",
    description: "Level up your ear for game sounds",
    count: 40,
  },
  {
    id: "countries",
    label: "Countries",
    icon: "globe",
    description: "Can you hear where in the world this is?",
    count: 30,
  },
  {
    id: "food",
    label: "Food",
    icon: "chef-hat",
    description: "Sizzling, chopping, pouring — what dish is it?",
    count: 25,
  },
  {
    id: "music",
    label: "Artists",
    icon: "headphones",
    description: "Name the artist from a riddle song",
    count: 30,
  },
];

export const GAME_MODES: GameMode[] = [
  {
    id: "classic",
    label: "Classic",
    description: "10 rounds, mixed categories and round types",
    rounds: 10,
    icon: "play",
  },
  {
    id: "blitz",
    label: "Blitz",
    description: "5 fast rounds — think quick",
    rounds: 5,
    icon: "zap",
  },
  {
    id: "marathon",
    label: "Marathon",
    description: "20 rounds for the true sound detective",
    rounds: 20,
    icon: "flame",
  },
];

export const MOCK_STATS = {
  totalPlayers: 2_847,
  gamesPlayed: 12_503,
  topScore: 14_200,
};

export interface DifficultyOption {
  id: Difficulty;
  label: string;
  description: string;
  icon: string;
}

export const DIFFICULTIES: DifficultyOption[] = [
  {
    id: "easy",
    label: "Easy",
    description: "Obvious clues",
    icon: "smile",
  },
  {
    id: "medium",
    label: "Medium",
    description: "Balanced mix",
    icon: "brain",
  },
  {
    id: "hard",
    label: "Hard",
    description: "Tricky options",
    icon: "skull",
  },
];
