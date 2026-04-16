import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { MusicPrompt, SongSection } from "@elevenlabs/elevenlabs-js/api";

// ── Client singleton ──────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("Missing ELEVENLABS_API_KEY environment variable");
  return key;
}

let _client: ElevenLabsClient | null = null;

function getClient(): ElevenLabsClient {
  if (!_client) {
    _client = new ElevenLabsClient({ apiKey: getApiKey() });
  }
  return _client;
}

// ── Types ─────────────────────────────────────────────────────────

export interface SfxOptions {
  /** Text prompt describing the sound effect */
  text: string;
  /** Duration in seconds (0.5–30). null = auto-detect from prompt */
  durationSeconds?: number;
  /** How closely to follow the prompt (0–1, default 0.3) */
  promptInfluence?: number;
  /** Whether to create a smoothly looping sound effect */
  loop?: boolean;
}

export interface MusicOptions {
  /** Simple text prompt describing the song. Mutually exclusive with compositionPlan */
  prompt?: string;
  /** Detailed composition plan. Mutually exclusive with prompt */
  compositionPlan?: MusicPrompt;
  /** Duration in ms (3000–600000). Only used with prompt */
  musicLengthMs?: number;
  /** Force instrumental (no vocals). Only used with prompt */
  forceInstrumental?: boolean;
}

export interface CompositionPlanOptions {
  /** Text prompt to generate a composition plan from */
  prompt: string;
  /** Duration in ms (3000–600000) */
  musicLengthMs?: number;
}

// ── Helpers ───────────────────────────────────────────────────────

/** Collect a ReadableStream<Uint8Array> into a single Buffer */
async function streamToBuffer(
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

// ── Sound Effects ─────────────────────────────────────────────────

/**
 * Generate a single sound effect from a text prompt.
 * Returns raw MP3 audio as a Buffer.
 *
 * @example
 * const audio = await generateSoundEffect({
 *   text: "Ocean waves crashing on a rocky shore",
 *   durationSeconds: 5,
 *   promptInfluence: 0.5,
 * });
 */
export async function generateSoundEffect(
  options: SfxOptions,
): Promise<Buffer> {
  const client = getClient();
  const response = await client.textToSoundEffects.convert({
    text: options.text,
    durationSeconds: options.durationSeconds,
    promptInfluence: options.promptInfluence ?? 0.3,
    loop: options.loop,
    outputFormat: "mp3_44100_128",
  });
  return streamToBuffer(response);
}

/**
 * Generate multiple sound effects in parallel (for a Sound Chain round).
 * Returns an array of MP3 Buffers in the same order as the input prompts.
 *
 * @example
 * const audios = await generateSoundChain([
 *   { text: "Ocean waves crashing" },
 *   { text: "Ship horn blowing in fog" },
 *   { text: "Ice cracking and breaking apart" },
 * ]);
 */
export async function generateSoundChain(
  prompts: SfxOptions[],
): Promise<Buffer[]> {
  return Promise.all(prompts.map(generateSoundEffect));
}

// ── Music Generation ──────────────────────────────────────────────

/**
 * Create a composition plan from a text prompt.
 * This endpoint is FREE (no credits) but rate-limited.
 * Returns a structured plan with sections, styles, and lyrics.
 *
 * @example
 * const plan = await createCompositionPlan({
 *   prompt: "A riddle song about a famous sinking ship",
 *   musicLengthMs: 30000,
 * });
 */
export async function createCompositionPlan(
  options: CompositionPlanOptions,
): Promise<MusicPrompt> {
  const client = getClient();
  const response = await client.music.compositionPlan.create({
    prompt: options.prompt,
    musicLengthMs: options.musicLengthMs,
  });
  return response;
}

/**
 * Generate a song from a prompt or a composition plan.
 * Returns raw MP3 audio as a Buffer.
 *
 * Two modes:
 * - Simple: pass `prompt` + optional `musicLengthMs`
 * - Advanced: pass a `compositionPlan` (from createCompositionPlan)
 *
 * @example
 * // Simple mode
 * const audio = await generateMusic({
 *   prompt: "Upbeat pop riddle about a famous plumber who jumps",
 *   musicLengthMs: 30000,
 * });
 *
 * // Advanced mode with composition plan
 * const plan = await createCompositionPlan({ prompt: "..." });
 * const audio = await generateMusic({ compositionPlan: plan });
 */
export async function generateMusic(options: MusicOptions): Promise<Buffer> {
  const client = getClient();
  const response = await client.music.compose({
    prompt: options.prompt,
    compositionPlan: options.compositionPlan,
    musicLengthMs: options.musicLengthMs,
    forceInstrumental: options.forceInstrumental,
    outputFormat: "mp3_44100_128",
  });
  return streamToBuffer(response);
}

/**
 * Stream a song from a prompt or composition plan.
 * Returns a ReadableStream for progressive delivery.
 *
 * Useful if you want to pipe directly to a response without buffering.
 */
export async function streamMusic(
  options: MusicOptions,
): Promise<ReadableStream<Uint8Array>> {
  const client = getClient();
  return client.music.stream({
    prompt: options.prompt,
    compositionPlan: options.compositionPlan,
    musicLengthMs: options.musicLengthMs,
    forceInstrumental: options.forceInstrumental,
    outputFormat: "mp3_44100_128",
  });
}

// ── Re-exports for convenience ────────────────────────────────────

export type { MusicPrompt, SongSection };
