import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// ── Client singleton (Vertex AI Express — API key auth) ──────────

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY environment variable");
  return key;
}

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ vertexai: true, apiKey: getApiKey() });
  }
  return _client;
}

// ── Models (Gemini 3.1 family) ────────────────────────────────────

/** Fast & cheap — good for bulk generation tasks (1M input / 65K output) */
const FLASH_MODEL = "gemini-3-flash-preview";
/** Most capable model — for complex generation when quality matters */
const PRO_MODEL = "gemini-3.1-pro-preview";
/** Cheapest & fastest — for lightweight high-volume tasks */
const LITE_MODEL = "gemini-3.1-flash-lite-preview";
/** Embedding model — text-embedding-005 (Vertex AI, 768 dims, best quality) */
const EMBEDDING_MODEL = "text-embedding-005";
/** Embedding dimensions (768 is good balance of quality vs storage) */
const EMBEDDING_DIMENSIONS = 768;

// ── Text generation ───────────────────────────────────────────────

export interface GenerateTextOptions {
  /** The prompt / instructions */
  prompt: string;
  /** System instruction (optional) */
  systemInstruction?: string;
  /** Temperature 0–2 (default: model default) */
  temperature?: number;
  /** Max output tokens */
  maxOutputTokens?: number;
}

/**
 * Generate free-form text with Gemini Flash.
 *
 * @example
 * const text = await generateText({
 *   prompt: "Write 3 sound effect prompts for the movie Titanic",
 *   systemInstruction: "You are a creative sound designer.",
 * });
 */
export async function generateText(
  options: GenerateTextOptions,
): Promise<string> {
  const client = getClient();
  const response = await client.models.generateContent({
    model: FLASH_MODEL,
    contents: options.prompt,
    config: {
      systemInstruction: options.systemInstruction,
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
    },
  });
  return response.text ?? "";
}

// ── Structured output (JSON) ──────────────────────────────────────

export interface GenerateJsonOptions<T> {
  /** The prompt / instructions */
  prompt: string;
  /** Zod schema describing the expected output */
  schema: z.ZodType<T>;
  /** System instruction (optional) */
  systemInstruction?: string;
  /** Temperature 0–2 */
  temperature?: number;
}

/**
 * Generate structured JSON output validated against a Zod schema.
 * Uses Gemini's native structured output mode for guaranteed JSON.
 *
 * @example
 * const ConceptSchema = z.object({
 *   name: z.string(),
 *   sfxPrompts: z.array(z.string()),
 *   musicPrompt: z.string(),
 *   distractors: z.array(z.string()),
 * });
 *
 * const concept = await generateJson({
 *   prompt: "Generate SFX and music prompts for the movie Titanic",
 *   schema: ConceptSchema,
 * });
 */
export async function generateJson<T>(
  options: GenerateJsonOptions<T>,
): Promise<T> {
  const client = getClient();
  const response = await client.models.generateContent({
    model:  PRO_MODEL,
    contents: options.prompt,
    config: {
      systemInstruction: options.systemInstruction,
      temperature: options.temperature,
      responseMimeType: "application/json",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      responseJsonSchema: zodToJsonSchema(options.schema as any),
    },
  });
  const text = response.text ?? "";
  return options.schema.parse(JSON.parse(text));
}

// ── Embeddings ────────────────────────────────────────────────────

/**
 * Generate an embedding vector for a single text.
 * Uses gemini-embedding-001 with 768 dimensions (good quality/size tradeoff).
 *
 * @example
 * const vector = await embedText("A famous movie about a sinking ship");
 */
export async function embedText(text: string): Promise<number[]> {
  const client = getClient();
  const response = await client.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  });
  return response.embeddings?.[0]?.values ?? [];
}

/**
 * Generate embedding vectors for multiple texts in a single API call.
 * Returns vectors in the same order as the input texts.
 *
 * @example
 * const vectors = await embedTexts([
 *   "Titanic - movie about a sinking ship",
 *   "Star Wars - space opera saga",
 *   "Minecraft - sandbox building game",
 * ]);
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const client = getClient();
  const response = await client.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: texts,
    config: {
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  });
  return (response.embeddings ?? []).map((e) => e.values ?? []);
}

/**
 * Generate a query embedding (optimized for search/retrieval).
 * Use this for the "query" side when searching turbopuffer.
 *
 * @example
 * const queryVec = await embedQuery("horror movies");
 */
export async function embedQuery(text: string): Promise<number[]> {
  const client = getClient();
  const response = await client.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  });
  return response.embeddings?.[0]?.values ?? [];
}

// ── Re-exports ────────────────────────────────────────────────────

export { z };
