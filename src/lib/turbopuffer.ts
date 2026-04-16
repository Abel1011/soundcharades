import Turbopuffer from "@turbopuffer/turbopuffer";
import type { Filter } from "@turbopuffer/turbopuffer/resources/custom";
import type { Category, Difficulty } from "./types";

// ── Client singleton ──────────────────────────────────────────────

const REGION = "gcp-us-central1";
const NAMESPACE = "soundcharades-concepts";
const DISTANCE_METRIC = "cosine_distance" as const;
const VECTOR_DIMENSIONS = 768;

function getApiKey(): string {
  const key = process.env.TURBOPUFFER_API_KEY;
  if (!key) throw new Error("Missing TURBOPUFFER_API_KEY environment variable");
  return key;
}

let _client: Turbopuffer | null = null;

function getClient(): Turbopuffer {
  if (!_client) {
    _client = new Turbopuffer({ apiKey: getApiKey(), region: REGION });
  }
  return _client;
}

function getNamespace() {
  return getClient().namespace(NAMESPACE);
}

// ── Types ─────────────────────────────────────────────────────────

export interface ConceptDocument {
  id: string;
  name: string;
  description: string;
  category: Category;
  difficulty: Difficulty;
  sfxPrompts: string[]; // JSON-serialized for storage
  musicPrompt: string;
  audioSfxUrls: string[]; // JSON-serialized for storage
  audioMusicUrls: string[]; // JSON-serialized for storage
}

export interface ConceptSearchResult {
  id: string;
  name: string;
  category: Category;
  difficulty: Difficulty;
  dist: number;
}

// ── Write operations ──────────────────────────────────────────────

/**
 * Upsert a single concept with its embedding vector.
 */
export async function upsertConcept(
  concept: ConceptDocument,
  vector: number[],
): Promise<void> {
  const ns = getNamespace();
  await ns.write({
    upsert_rows: [
      {
        id: concept.id,
        vector,
        name: concept.name,
        description: concept.description,
        category: concept.category,
        difficulty: concept.difficulty,
        sfx_prompts: JSON.stringify(concept.sfxPrompts),
        music_prompt: concept.musicPrompt,
        audio_sfx_urls: JSON.stringify(concept.audioSfxUrls),
        audio_music_urls: JSON.stringify(concept.audioMusicUrls),
      },
    ],
    distance_metric: DISTANCE_METRIC,
    schema: {
      vector: { type: `[${VECTOR_DIMENSIONS}]f32`, ann: true },
      name: "string",
      description: "string",
      category: "string",
      difficulty: "string",
      sfx_prompts: "string",
      music_prompt: "string",
      audio_sfx_urls: "string",
      audio_music_urls: "string",
    },
  });
}

/**
 * Upsert multiple concepts in a single batch call.
 */
export async function upsertConcepts(
  concepts: Array<{ concept: ConceptDocument; vector: number[] }>,
): Promise<void> {
  if (concepts.length === 0) return;
  const ns = getNamespace();
  await ns.write({
    upsert_rows: concepts.map(({ concept, vector }) => ({
      id: concept.id,
      vector,
      name: concept.name,
      description: concept.description,
      category: concept.category,
      difficulty: concept.difficulty,
      sfx_prompts: JSON.stringify(concept.sfxPrompts),
      music_prompt: concept.musicPrompt,
      audio_sfx_urls: JSON.stringify(concept.audioSfxUrls),
      audio_music_urls: JSON.stringify(concept.audioMusicUrls),
    })),
    distance_metric: DISTANCE_METRIC,
    schema: {
      vector: { type: `[${VECTOR_DIMENSIONS}]f32`, ann: true },
      name: "string",
      description: "string",
      category: "string",
      difficulty: "string",
      sfx_prompts: "string",
      music_prompt: "string",
      audio_sfx_urls: "string",
      audio_music_urls: "string",
    },
  });
}

/**
 * Delete concepts by their IDs.
 */
export async function deleteConcepts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const ns = getNamespace();
  await ns.write({ deletes: ids });
}

/**
 * Delete ALL concepts in the namespace. Use with caution.
 */
export async function deleteAllConcepts(): Promise<void> {
  const ns = getNamespace();
  await ns.deleteAll();
}

// ── Query operations ──────────────────────────────────────────────

/**
 * Find the nearest concepts to a query vector (ANN search).
 * Used for distractor generation — finds semantically similar concepts.
 *
 * @example
 * const distractors = await findSimilarConcepts(queryVector, {
 *   category: "movies",
 *   excludeIds: ["titanic"],
 *   limit: 3,
 * });
 */
export async function findSimilarConcepts(
  queryVector: number[],
  options: {
    category?: Category;
    difficulty?: Difficulty;
    excludeIds?: string[];
    limit?: number;
  } = {},
): Promise<ConceptSearchResult[]> {
  const { category, difficulty, excludeIds, limit = 3 } = options;
  const ns = getNamespace();

  const filters = buildFilters({ category, difficulty, excludeIds });

  const result = await ns.query({
    rank_by: ["vector", "ANN", queryVector],
    top_k: limit,
    filters,
    include_attributes: ["name", "category", "difficulty"],
  });

  return (result.rows ?? []).map((row) => ({
    id: String(row.id),
    name: row.name as string,
    category: row.category as Category,
    difficulty: row.difficulty as Difficulty,
    dist: row.$dist ?? 0,
  }));
}

/**
 * Get a concept by ID with all its data.
 */
export async function getConceptById(
  id: string,
): Promise<ConceptDocument | null> {
  const ns = getNamespace();
  const result = await ns.query({
    filters: ["id", "Eq", id],
    rank_by: ["id", "asc"],
    limit: 1,
    include_attributes: true,
  });

  const row = result.rows?.[0];
  if (!row) return null;
  return rowToConceptDocument(row);
}

/**
 * Get multiple concepts by their IDs.
 */
export async function getConceptsByIds(
  ids: string[],
): Promise<ConceptDocument[]> {
  if (ids.length === 0) return [];
  const ns = getNamespace();
  const result = await ns.query({
    filters: ["id", "In", ids],
    rank_by: ["id", "asc"],
    limit: ids.length,
    include_attributes: true,
  });

  return (result.rows ?? []).map(rowToConceptDocument);
}

/**
 * Get random concepts for a game session.
 * Fetches concepts filtered by category/difficulty and returns a diverse set.
 *
 * @example
 * const concepts = await getSessionConcepts({
 *   category: "movies",
 *   count: 10,
 *   excludeIds: previouslyPlayed,
 * });
 */
export async function getSessionConcepts(options: {
  category?: Category;
  difficulty?: Difficulty;
  count?: number;
  excludeIds?: string[];
}): Promise<ConceptDocument[]> {
  const { category, difficulty, count = 10, excludeIds } = options;
  const ns = getNamespace();

  const filters = buildFilters({ category, difficulty, excludeIds });

  // Fetch more than needed so we can pick a diverse subset
  const fetchLimit = Math.min(count * 3, 100);

  const result = await ns.query({
    rank_by: ["id", "asc"],
    limit: fetchLimit,
    filters,
    include_attributes: true,
  });

  const concepts = (result.rows ?? []).map(rowToConceptDocument);

  // Shuffle and pick `count` items for variety
  const shuffled = concepts.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get all existing concept names in the namespace.
 * Used to avoid seeding duplicate concepts.
 */
export async function getExistingConceptNames(): Promise<Set<string>> {
  const ns = getNamespace();
  try {
    const result = await ns.query({
      rank_by: ["id", "asc"],
      limit: 1000,
      include_attributes: ["name"],
    });
    return new Set((result.rows ?? []).map((row) => (row.name as string).toLowerCase()));
  } catch {
    // Namespace may not exist yet
    return new Set();
  }
}

/**
 * Get concept counts grouped by category.
 */
export async function getCategoryCounts(): Promise<Record<string, number>> {
  const ns = getNamespace();
  try {
    const result = await ns.query({
      rank_by: ["id", "asc"],
      limit: 1000,
      include_attributes: ["category"],
    });
    const counts: Record<string, number> = {};
    for (const row of result.rows ?? []) {
      const cat = row.category as string;
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

/**
 * Find distractor names for a given concept.
 * Returns the names of the N nearest concepts in the same category (excluding the concept itself).
 */
export async function findDistractors(
  conceptId: string,
  conceptVector: number[],
  options: {
    category: Category;
    count?: number;
  },
): Promise<string[]> {
  const { category, count = 3 } = options;
  const results = await findSimilarConcepts(conceptVector, {
    category,
    excludeIds: [conceptId],
    limit: count,
  });
  return results.map((r) => r.name);
}

// ── Vector-aware queries (for difficulty-based distractors) ───────

export interface ConceptWithVector {
  concept: ConceptDocument;
  vector: number[];
}

/**
 * Fetch all concepts with their embedding vectors.
 * Used for in-memory distractor selection based on vector distance.
 */
export async function getAllConceptsWithVectors(options?: {
  category?: Category;
}): Promise<ConceptWithVector[]> {
  const ns = getNamespace();
  const filters = buildFilters({ category: options?.category });

  const result = await ns.query({
    rank_by: ["id", "asc"],
    limit: 1000,
    filters,
    include_attributes: true,
    vector_encoding: "float",
  });

  return (result.rows ?? [])
    .filter((row) => row.vector)
    .map((row) => ({
      concept: rowToConceptDocument(row),
      vector: row.vector as number[],
    }));
}

// ── Helpers ───────────────────────────────────────────────────────

function buildFilters(options: {
  category?: Category;
  difficulty?: Difficulty;
  excludeIds?: string[];
}): Filter | undefined {
  const { category, difficulty, excludeIds } = options;
  const conditions: Filter[] = [];

  if (category) {
    conditions.push(["category", "Eq", category]);
  }
  if (difficulty) {
    conditions.push(["difficulty", "Eq", difficulty]);
  }
  if (excludeIds && excludeIds.length > 0) {
    conditions.push(["id", "NotIn", excludeIds]);
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return ["And", conditions];
}

function rowToConceptDocument(row: Record<string, unknown>): ConceptDocument {
  return {
    id: String(row.id),
    name: row.name as string,
    description: (row.description as string) || "",
    category: row.category as Category,
    difficulty: row.difficulty as Difficulty,
    sfxPrompts: JSON.parse((row.sfx_prompts as string) || "[]"),
    musicPrompt: (row.music_prompt as string) || "",
    audioSfxUrls: JSON.parse((row.audio_sfx_urls as string) || "[]"),
    audioMusicUrls: JSON.parse((row.audio_music_urls as string) || "[]"),
  };
}
