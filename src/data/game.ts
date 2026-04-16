/**
 * Mock game data — encapsulated for easy replacement with real API data.
 *
 * To swap with real data:
 * 1. Replace `buildMockSession()` with a fetch to your game API
 * 2. Replace `buildMockSummary()` with real scoring from server
 * 3. Audio URLs should point to pre-generated ElevenLabs files
 */

import type {
  Category,
  Concept,
  RoundData,
  RoundType,
  GameSession,
  GameSummary,
  RoundResult,
} from "@/lib/types";

/* ─── Raw concept bank (replace with turbopuffer query) ─── */

const CONCEPT_BANK: Concept[] = [
  {
    id: "titanic",
    name: "Titanic",
    description: "Epic 1997 romance-disaster film about the sinking of the RMS Titanic on its maiden voyage",
    category: "movies",
    difficulty: "easy",
    sfxPrompts: [
      "ocean waves crashing on a ship hull",
      "loud ship horn blast echoing",
      "ice cracking and splitting apart",
      "bubbles rising as something sinks underwater",
    ],
    musicPrompt: "A dramatic ballad about a doomed voyage across the Atlantic",
    audioSfxUrls: ["/mock/sfx-1.mp3", "/mock/sfx-2.mp3", "/mock/sfx-3.mp3", "/mock/sfx-4.mp3"],
    audioMusicUrls: ["/mock/music-1.mp3"],
  },
  {
    id: "star-wars",
    name: "Star Wars",
    description: "Iconic space opera franchise about the battle between the Galactic Empire and the Rebel Alliance",
    category: "movies",
    difficulty: "easy",
    sfxPrompts: [
      "lightsaber igniting with electric hum",
      "heavy mechanical breathing through a mask",
      "spaceship engine roaring through space",
    ],
    musicPrompt: "An epic orchestral march about galactic rebels fighting an empire",
    audioSfxUrls: ["/mock/sfx-1.mp3", "/mock/sfx-2.mp3", "/mock/sfx-3.mp3"],
    audioMusicUrls: ["/mock/music-2.mp3"],
  },
  {
    id: "jurassic-park",
    name: "Jurassic Park",
    description: "Sci-fi adventure film about a theme park with cloned dinosaurs that escape containment",
    category: "movies",
    difficulty: "medium",
    sfxPrompts: [
      "massive dinosaur footstep shaking the ground",
      "terrifying reptilian roar echoing",
      "electric fence buzzing and sparking",
    ],
    musicPrompt: "A majestic orchestral piece about ancient creatures returning to life on a tropical island",
    audioSfxUrls: ["/mock/sfx-1.mp3", "/mock/sfx-2.mp3", "/mock/sfx-3.mp3"],
    audioMusicUrls: ["/mock/music-3.mp3"],
  },
  {
    id: "stranger-things",
    name: "Stranger Things",
    description: "1980s-set supernatural horror series about kids encountering interdimensional creatures in a small town",
    category: "series",
    difficulty: "easy",
    sfxPrompts: [
      "eerie synth pulse in a dark room",
      "christmas lights flickering rapidly",
      "creature growling from another dimension",
    ],
    musicPrompt: "A retro 80s synthwave track about kids discovering a dark parallel world",
    audioSfxUrls: ["/mock/sfx-1.mp3", "/mock/sfx-2.mp3", "/mock/sfx-3.mp3"],
    audioMusicUrls: ["/mock/music-4.mp3"],
  },
  {
    id: "breaking-bad",
    name: "Breaking Bad",
    description: "Crime drama series about a chemistry teacher who turns to manufacturing methamphetamine",
    category: "series",
    difficulty: "medium",
    sfxPrompts: [
      "RV engine sputtering in a desert",
      "chemical bubbling in glass beakers",
      "money counting machine whirring fast",
    ],
    musicPrompt: "A tense desert blues song about a teacher who becomes a kingpin",
    audioSfxUrls: ["/mock/sfx-1.mp3", "/mock/sfx-2.mp3", "/mock/sfx-3.mp3"],
    audioMusicUrls: ["/mock/music-5.mp3"],
  },
  {
    id: "minecraft",
    name: "Minecraft",
    description: "Sandbox survival videogame about mining resources and building structures in a blocky procedural world",
    category: "videogames",
    difficulty: "easy",
    sfxPrompts: [
      "blocky dirt being broken apart",
      "creeper hissing before explosion",
      "wooden pickaxe hitting stone rhythmically",
    ],
    musicPrompt: "A calm piano melody about building infinite worlds block by block",
    audioSfxUrls: ["/mock/sfx-1.mp3", "/mock/sfx-2.mp3", "/mock/sfx-3.mp3"],
    audioMusicUrls: ["/mock/music-6.mp3"],
  },
  {
    id: "zelda",
    name: "The Legend of Zelda",
    description: "Action-adventure videogame franchise about a hero named Link saving Princess Zelda in the land of Hyrule",
    category: "videogames",
    difficulty: "medium",
    sfxPrompts: [
      "treasure chest opening with magical chime",
      "sword slashing through grass",
      "fairy twinkling and healing",
    ],
    musicPrompt: "An adventurous folk melody about a hero saving a princess in a fantasy kingdom",
    audioSfxUrls: ["/mock/sfx-1.mp3", "/mock/sfx-2.mp3", "/mock/sfx-3.mp3"],
    audioMusicUrls: ["/mock/music-7.mp3"],
  },
  {
    id: "japan",
    name: "Japan",
    description: "East Asian island nation known for cherry blossoms, bullet trains, ancient temples, and cutting-edge technology",
    category: "countries",
    difficulty: "easy",
    sfxPrompts: [
      "bamboo water fountain clacking",
      "bullet train whooshing past",
      "temple bell ringing deeply",
    ],
    musicPrompt: "A serene koto melody about cherry blossoms falling near ancient temples",
    audioSfxUrls: ["/mock/sfx-1.mp3", "/mock/sfx-2.mp3", "/mock/sfx-3.mp3"],
    audioMusicUrls: ["/mock/music-8.mp3"],
  },
  {
    id: "pizza",
    name: "Pizza",
    description: "Classic Italian dish with a round baked dough base topped with tomato sauce, cheese, and various toppings",
    category: "food",
    difficulty: "easy",
    sfxPrompts: [
      "dough being stretched and slapped",
      "tomato sauce being spread with a spoon",
      "wood-fired oven crackling with flames",
    ],
    musicPrompt: "A cheerful Italian-folk song about dough rising and toppings melting in a stone oven",
    audioSfxUrls: ["/mock/sfx-1.mp3", "/mock/sfx-2.mp3", "/mock/sfx-3.mp3"],
    audioMusicUrls: ["/mock/music-9.mp3"],
  },
  {
    id: "queen",
    name: "Queen",
    description: "Legendary British rock band known for theatrical performances, operatic harmonies, and stadium anthems",
    category: "music",
    difficulty: "medium",
    sfxPrompts: [
      "stadium crowd clapping in sync",
      "piano keys hammered dramatically",
      "electric guitar solo wailing",
    ],
    musicPrompt: "A rock anthem about a legendary band whose music echoes through stadiums forever",
    audioSfxUrls: ["/mock/sfx-1.mp3", "/mock/sfx-2.mp3", "/mock/sfx-3.mp3"],
    audioMusicUrls: ["/mock/music-10.mp3"],
  },
];

/* ─── Distractor pools per category (replace with turbopuffer nearest neighbors) ─── */

const DISTRACTORS: Record<Category, string[]> = {
  movies: ["The Matrix", "Jaws", "Harry Potter", "Frozen", "Inception", "The Godfather", "Forrest Gump", "Avatar"],
  series: ["Game of Thrones", "The Office", "Friends", "The Mandalorian", "Squid Game", "Black Mirror"],
  videogames: ["Mario", "Fortnite", "GTA V", "Pokémon", "Sonic", "Among Us", "Halo"],
  countries: ["France", "Brazil", "India", "Egypt", "Australia", "Mexico", "Italy"],
  food: ["Sushi", "Tacos", "Pasta", "Ramen", "Burger", "Croissant", "Pad Thai"],
  music: ["The Beatles", "Michael Jackson", "Beyoncé", "Elvis", "Eminem", "Taylor Swift"],
  custom: [],
};

/* ─── Helpers ─── */

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function pickDistractors(concept: Concept, count: number): string[] {
  const pool = DISTRACTORS[concept.category].filter((d) => d !== concept.name);
  return shuffleArray(pool).slice(0, count);
}

function buildOptions(concept: Concept): { options: string[]; correctIndex: number } {
  const distractors = pickDistractors(concept, 3);
  const allOptions = [concept.name, ...distractors];
  const shuffled = shuffleArray(allOptions);
  return {
    options: shuffled,
    correctIndex: shuffled.indexOf(concept.name),
  };
}

/* ─── Public API (replace internals with real backend calls) ─── */

export function buildMockSession(
  mode: string,
  category: Category | null,
  roundCount: number
): GameSession {
  let pool = category
    ? CONCEPT_BANK.filter((c) => c.category === category)
    : [...CONCEPT_BANK];

  // Ensure we have enough, repeat if needed
  while (pool.length < roundCount) {
    pool = [...pool, ...CONCEPT_BANK];
  }

  const selected = shuffleArray(pool).slice(0, roundCount);
  const roundTypes: RoundType[] = ["sfx", "music"];

  const rounds: RoundData[] = selected.map((concept, i) => {
    const { options, correctIndex } = buildOptions(concept);
    return {
      index: i,
      type: roundTypes[i % 2], // alternate sfx / music
      concept,
      options,
      correctIndex,
    };
  });

  return {
    id: `session-${Date.now()}`,
    mode,
    category,
    difficulty: "medium",
    rounds,
    results: [],
    currentRound: 0,
    status: "playing",
  };
}

export function computeRoundResult(
  round: RoundData,
  selectedIndex: number | null,
  timeMs: number,
  replays: number,
  options?: { usedHint?: boolean; heardVoice?: boolean },
): RoundResult {
  const isCorrect = selectedIndex === round.correctIndex;
  const basePoints = isCorrect ? 1000 : 0;
  // Speed bonus: max 500 for instant answer, degrades over 30 seconds
  const speedBonus = isCorrect ? Math.max(0, Math.round(500 * (1 - timeMs / 30_000))) : 0;
  const replayPenalty = replays * 200;
  const usedHint = options?.usedHint ?? false;
  const heardVoice = options?.heardVoice ?? false;
  const hintPenalty = usedHint ? 300 : 0;
  const voicePenalty = heardVoice ? 150 : 0;
  const totalPoints = basePoints + speedBonus - replayPenalty - hintPenalty - voicePenalty;

  return {
    roundIndex: round.index,
    selectedIndex,
    isCorrect,
    basePoints,
    speedBonus,
    replayPenalty,
    hintPenalty,
    voicePenalty,
    totalPoints,
    timeMs,
    replays,
    usedHint,
    heardVoice,
  };
}

export function buildGameSummary(session: GameSession): GameSummary {
  const correctCount = session.results.filter((r) => r.isCorrect).length;
  const totalScore = session.results.reduce((s, r) => s + r.totalPoints, 0);
  const avgTimeMs =
    session.results.length > 0
      ? session.results.reduce((s, r) => s + r.timeMs, 0) / session.results.length
      : 0;

  // Best streak
  let bestStreak = 0;
  let currentStreak = 0;
  for (const r of session.results) {
    if (r.isCorrect) {
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  return {
    totalScore,
    correctCount,
    totalRounds: session.rounds.length,
    avgTimeMs,
    bestStreak,
    results: session.results,
    rounds: session.rounds,
    mode: session.mode,
    category: session.category,
    difficulty: session.difficulty,
  };
}
