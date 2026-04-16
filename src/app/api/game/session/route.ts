import { getAllConceptsWithVectors } from "@/lib/turbopuffer";
import type { Category, Concept, Difficulty, RoundData, RoundType, GameSession } from "@/lib/types";
import type { ConceptDocument, ConceptWithVector } from "@/lib/turbopuffer";

// ── Helpers ───────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function docToConcept(doc: ConceptDocument): Concept {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description,
    category: doc.category,
    difficulty: doc.difficulty,
    sfxPrompts: doc.sfxPrompts,
    musicPrompt: doc.musicPrompt,
    audioSfxUrls: doc.audioSfxUrls,
    audioMusicUrls: doc.audioMusicUrls,
  };
}

/** Cosine distance between two vectors (0 = identical, 2 = opposite). */
function cosineDistance(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 1;
  return 1 - dot / denom;
}

/**
 * Pick 3 distractors based on difficulty using vector similarity.
 *
 * - easy:   distractors from OTHER categories, furthest away (obvious)
 * - medium: nearest neighbors across ALL categories (moderate)
 * - hard:   nearest neighbors from SAME category only (tricky)
 */
function buildOptions(
  concept: ConceptDocument,
  conceptVector: number[],
  all: ConceptWithVector[],
  difficulty: Difficulty,
): { options: string[]; correctIndex: number } {
  const others = all.filter((c) => c.concept.id !== concept.id);

  const withDist = others.map((c) => ({
    ...c,
    dist: cosineDistance(conceptVector, c.vector),
  }));

  let candidates: typeof withDist;

  switch (difficulty) {
    case "easy":
      // Other categories, sorted furthest-first (most obviously different)
      candidates = withDist
        .filter((c) => c.concept.category !== concept.category)
        .sort((a, b) => b.dist - a.dist);
      break;
    case "hard":
      // Same category, sorted nearest-first (most confusingly similar)
      candidates = withDist
        .filter((c) => c.concept.category === concept.category)
        .sort((a, b) => a.dist - b.dist);
      break;
    case "medium":
    default:
      // All categories, nearest-first
      candidates = withDist.sort((a, b) => a.dist - b.dist);
      break;
  }

  // If not enough in the primary pool, fill from remaining concepts
  if (candidates.length < 3) {
    const used = new Set(candidates.map((c) => c.concept.id));
    const fillers = withDist
      .filter((c) => !used.has(c.concept.id))
      .sort((a, b) => a.dist - b.dist);
    candidates = [...candidates, ...fillers];
  }

  const distractors = candidates.slice(0, 3).map((c) => c.concept.name);
  const allOptions = [concept.name, ...distractors];
  const shuffled = shuffleArray(allOptions);
  return {
    options: shuffled,
    correctIndex: shuffled.indexOf(concept.name),
  };
}

// ── Route Handler ─────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode = typeof body.mode === "string" ? body.mode : "classic";
    const category =
      typeof body.category === "string" ? (body.category as Category) : undefined;
    const difficulty: Difficulty =
      body.difficulty === "easy" || body.difficulty === "medium" || body.difficulty === "hard"
        ? body.difficulty
        : "medium";
    const roundCount =
      typeof body.roundCount === "number"
        ? Math.min(Math.max(body.roundCount, 1), 30)
        : 10;
    const conceptIds = Array.isArray(body.conceptIds)
      ? body.conceptIds.filter((id: unknown): id is string => typeof id === "string")
      : undefined;

    // Fetch ALL concepts with vectors for in-memory distractor computation
    // Always fetch every concept so cross-category distractors work for easy mode
    const allWithVectors = await getAllConceptsWithVectors();

    // Filter to selected concepts (custom quiz), category, or all
    const categoryPool = conceptIds
      ? allWithVectors.filter((c) => conceptIds.includes(c.concept.id))
      : category
        ? allWithVectors.filter((c) => c.concept.category === category)
        : allWithVectors;

    if (categoryPool.length < 1 || allWithVectors.length < 4) {
      return Response.json(
        {
          error: `Not enough concepts in database. Found ${categoryPool.length} in category, ${allWithVectors.length} total. Need at least 4. Run \`npm run seed\` first.`,
        },
        { status: 422 },
      );
    }

    // Shuffle and select concepts for rounds from the category pool
    const shuffled = shuffleArray(categoryPool);
    const selected = shuffled.slice(0, roundCount);
    const roundTypes: RoundType[] = ["sfx", "music"];

    const rounds: RoundData[] = selected.map(({ concept, vector }, i) => {
      const { options, correctIndex } = buildOptions(
        concept,
        vector,
        allWithVectors,
        difficulty,
      );
      return {
        index: i,
        type: roundTypes[i % 2],
        concept: docToConcept(concept),
        options,
        correctIndex,
      };
    });

    const session: GameSession = {
      id: `session-${Date.now()}`,
      mode,
      category: category ?? null,
      difficulty,
      rounds,
      results: [],
      currentRound: 0,
      status: "playing",
    };

    return Response.json(session);
  } catch (err) {
    console.error("Failed to create game session:", err);
    return Response.json(
      { error: "Failed to create game session" },
      { status: 500 },
    );
  }
}
