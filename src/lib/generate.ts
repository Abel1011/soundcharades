/**
 * Shared generation pipeline — used by the custom quiz SSE endpoint.
 * Extracted from src/scripts/seed.ts for reuse in API routes.
 *
 * Flow: Gemini concepts → embeddings → ElevenLabs SFX → Music → normalize → turbopuffer
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { generateJson, generateText, embedTexts, z } from "./gemini";
import { generateSoundEffect, generateMusic, createCompositionPlan } from "./elevenlabs";
import { upsertConcepts, getExistingConceptNames } from "./turbopuffer";
import type { ConceptDocument } from "./turbopuffer";

// ── Schema ────────────────────────────────────────────────────────

const ConceptBatchSchema = z.array(
  z.object({
    id: z.string().describe("kebab-case unique identifier"),
    name: z.string().describe("Real name as people know it"),
    description: z
      .string()
      .describe("Direct, factual 1-2 sentence description"),
    sfxPrompts: z
      .array(z.string())
      .length(4)
      .describe(
        "Exactly 4 AMBIENT sound effects that form a sequential clue chain. " +
          "ONE sound per prompt, 3-8 words each. Sounds will be LOOPED (5s). " +
          "Describe CONTINUOUS or REPEATING sounds only. " +
          "No intelligible speech. Keep prompts SHORT and SIMPLE.",
      ),
    sfxPhrasePrompts: z
      .array(z.string())
      .length(2)
      .describe(
        "Exactly 2 ICONIC PHRASE sound effects. Pick the most famous catchphrases. " +
          "Only paraphrase if original contains proper names. " +
          "Must include 'loud' or 'close-up' for clarity. " +
          "Format: 'A [voice description] saying the words: \"[phrase]\"'",
      ),
    musicPrompt: z
      .string()
      .describe(
        "A detailed prompt for a ~30s riddle song with genre/style, tempo, " +
          "instruments, mood, and FULL lyrics (verse+chorus). " +
          "Lyrics describe the concept as a riddle — NEVER naming it directly.",
      ),
  }),
);

type GeneratedConcept = z.infer<typeof ConceptBatchSchema>[number];

// ── Config ────────────────────────────────────────────────────────

const AUDIO_BASE = path.join(process.cwd(), "public", "audio");
const SFX_DIR = path.join(AUDIO_BASE, "sfx");
const MUSIC_DIR = path.join(AUDIO_BASE, "music");
const MAX_RETRIES = 2;

// ── Progress callback ─────────────────────────────────────────────

export type ProgressCallback = (
  step: string,
  detail: string,
  progress: number,
) => void;

// ── Audio helpers ─────────────────────────────────────────────────

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function isCopyrightError(err: unknown): boolean {
  const msg = String(err);
  return (
    msg.includes("violated our Terms of Service") ||
    msg.includes("bad_prompt")
  );
}

function isSilentAudio(buffer: Buffer): boolean {
  let offset = 0;
  if (
    buffer.length > 10 &&
    buffer[0] === 0x49 &&
    buffer[1] === 0x44 &&
    buffer[2] === 0x33
  ) {
    const size =
      (buffer[6] << 21) | (buffer[7] << 14) | (buffer[8] << 7) | buffer[9];
    offset = 10 + size;
  }
  const start = Math.max(offset + 200, Math.floor(buffer.length * 0.2));
  const end = Math.min(buffer.length - 100, Math.floor(buffer.length * 0.8));
  if (end - start < 500) return false;
  const sampleSize = end - start;
  let sum = 0;
  let sumSq = 0;
  for (let i = start; i < end; i++) {
    const val = buffer[i];
    sum += val;
    sumSq += val * val;
  }
  const mean = sum / sampleSize;
  const variance = sumSq / sampleSize - mean * mean;
  return Math.sqrt(variance) < 25;
}

function normalizeAudio(buffer: Buffer, filepath: string): Buffer {
  const tmpInput = filepath + ".tmp_in.mp3";
  const tmpOutput = filepath + ".tmp_out.mp3";
  try {
    fs.writeFileSync(tmpInput, buffer);
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        tmpInput,
        "-af",
        "loudnorm=I=-14:TP=-1:LRA=11",
        "-ar",
        "44100",
        "-b:a",
        "128k",
        tmpOutput,
      ],
      { stdio: "pipe" },
    );
    return fs.readFileSync(tmpOutput);
  } catch {
    return buffer;
  } finally {
    if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
    if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
  }
}

async function rewritePrompt(
  original: string,
  type: "sfx" | "music",
): Promise<string> {
  const instruction =
    type === "sfx"
      ? "Rewrite this sound effect prompt so it describes the SAME sound but avoids any copyrighted names, character names, or franchise-specific terms. Keep it as a concrete, producible sound description. Return ONLY the rewritten prompt."
      : "Rewrite this music generation prompt keeping the same genre, mood, instruments, structure, and lyrical theme but removing ALL copyrighted names, character names, franchise references, and trademarked terms. Return ONLY the rewritten prompt.";
  const result = await generateText({
    prompt: `Original prompt:\n"${original}"\n\n${instruction}`,
    systemInstruction:
      "You rewrite AI generation prompts to avoid copyright issues.",
    temperature: 0.7,
  });
  return result.trim();
}

async function generateSfxWithRetry(
  prompt: string,
  conceptName: string,
): Promise<Buffer> {
  let currentPrompt = prompt;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const buffer = await generateSoundEffect({
        text: currentPrompt,
        durationSeconds: 5,
        promptInfluence: 0.75,
        loop: true,
      });
      if (isSilentAudio(buffer) && attempt < MAX_RETRIES) continue;
      return buffer;
    } catch (err) {
      if (isCopyrightError(err) && attempt < MAX_RETRIES) {
        currentPrompt = await rewritePrompt(currentPrompt, "sfx");
      } else {
        throw err;
      }
    }
  }
  throw new Error(`SFX generation failed for "${conceptName}"`);
}

async function generateSfxPhraseWithRetry(
  prompt: string,
  conceptName: string,
): Promise<Buffer> {
  let currentPrompt = prompt;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const buffer = await generateSoundEffect({
        text: currentPrompt,
        durationSeconds: 4,
        promptInfluence: 0.75,
        loop: false,
      });
      if (isSilentAudio(buffer) && attempt < MAX_RETRIES) continue;
      return buffer;
    } catch (err) {
      if (isCopyrightError(err) && attempt < MAX_RETRIES) {
        currentPrompt = await rewritePrompt(currentPrompt, "sfx");
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Phrase SFX generation failed for "${conceptName}"`);
}

async function generateMusicWithRetry(
  prompt: string,
  conceptName: string,
): Promise<Buffer> {
  let currentPrompt = prompt;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const plan = await createCompositionPlan({
        prompt: currentPrompt,
        musicLengthMs: 30000,
      });
      return await generateMusic({ compositionPlan: plan });
    } catch (err) {
      if (isCopyrightError(err) && attempt < MAX_RETRIES) {
        currentPrompt = await rewritePrompt(currentPrompt, "music");
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Music generation failed for "${conceptName}"`);
}

// ── Audio generation for a single concept ─────────────────────────

async function generateAudioForConcept(
  concept: GeneratedConcept,
): Promise<{ sfxPaths: string[]; musicPaths: string[] }> {
  ensureDir(SFX_DIR);
  ensureDir(MUSIC_DIR);

  const sfxPaths: string[] = [];
  let musicPaths: string[] = [];

  // 4 ambient SFX (looped, 5s)
  for (let j = 0; j < concept.sfxPrompts.length; j++) {
    try {
      const buffer = await generateSfxWithRetry(
        concept.sfxPrompts[j],
        concept.name,
      );
      const filename = `${concept.id}-sfx-${j + 1}.mp3`;
      const filepath = path.join(SFX_DIR, filename);
      const normalized = normalizeAudio(buffer, filepath);
      fs.writeFileSync(filepath, normalized);
      sfxPaths.push(`/audio/sfx/${filename}`);
    } catch {
      // Skip failed SFX, continue with the rest
    }
  }

  // 2 phrase SFX (NOT looped, 4s)
  for (let j = 0; j < concept.sfxPhrasePrompts.length; j++) {
    const sfxIndex = concept.sfxPrompts.length + j;
    try {
      const buffer = await generateSfxPhraseWithRetry(
        concept.sfxPhrasePrompts[j],
        concept.name,
      );
      const filename = `${concept.id}-sfx-${sfxIndex + 1}.mp3`;
      const filepath = path.join(SFX_DIR, filename);
      const normalized = normalizeAudio(buffer, filepath);
      fs.writeFileSync(filepath, normalized);
      sfxPaths.push(`/audio/sfx/${filename}`);
    } catch {
      // Skip failed phrase SFX
    }
  }

  // Music (composition plan → generate)
  try {
    const buffer = await generateMusicWithRetry(
      concept.musicPrompt,
      concept.name,
    );
    const filename = `${concept.id}-music-1.mp3`;
    const filepath = path.join(MUSIC_DIR, filename);
    const normalized = normalizeAudio(buffer, filepath);
    fs.writeFileSync(filepath, normalized);
    musicPaths = [`/audio/music/${filename}`];
  } catch {
    // Continue without music
  }

  return { sfxPaths, musicPaths };
}

// ── Main generation function ──────────────────────────────────────

export async function generateCustomQuiz(
  theme: string,
  onProgress: ProgressCallback,
): Promise<string[]> {
  const COUNT = 4;

  // ── Step 1: Generate concepts with Gemini Pro ──────────────────

  onProgress("concepts", "Brainstorming concepts...", 5);

  const existingNames = await getExistingConceptNames();
  const existingList =
    existingNames.size > 0
      ? `\n\nALREADY IN DATABASE (DO NOT repeat these):\n${[...existingNames].map((n) => `- ${n}`).join("\n")}`
      : "";

  const batch = await generateJson({
    prompt: `Generate exactly ${COUNT} SoundCharades concepts for the theme "${theme}".${existingList}

RULES:
- Pick iconic, well-known things related to "${theme}" that most people would recognize
- Choose concepts that are RELATED enough to be confusing as distractors for each other
  (so they overlap thematically — e.g. for "anime": pick several from similar genres)
- But each concept must still be distinct and identifiable by its unique sounds/music
${existingNames.size > 0 ? "- DO NOT include any concept already listed above\n" : ""}
For each concept:

1. **id**: kebab-case unique identifier (e.g. "jurassic-park")

2. **name**: the REAL name as people know it (e.g. "Jurassic Park", "Japan"). Players see this as answer options.

3. **description**: Direct and factual. Say exactly what it is in 1-2 sentences.

4. **sfxPrompts**: Exactly 4 AMBIENT sound effects (sequential clue chain).
   - ONE sound per prompt. Keep prompts SHORT (3-8 words).
   - Sounds will be LOOPED (5s), so describe CONTINUOUS or REPEATING sounds.
   - No intelligible speech in ambient SFX.
   - Be creative — think laterally! Include clever cultural references and iconic scene sounds.

5. **sfxPhrasePrompts**: Exactly 2 ICONIC PHRASE sound effects.
   - Pick THE most famous, universally-known quotes/catchphrases from this concept.
   - The phrase is FINE as-is if it contains NO character names, actor names, or titles.
   - Only paraphrase when the original quote contains a proper name.
   - Keep voice description SHORT (1-2 traits max).
   - WRAP the exact phrase in double quotes so the AI knows it's literal speech.
   - Format: 'A [brief voice description] saying the words: "[the phrase]"'

6. **musicPrompt**: A VERY DETAILED prompt for a ~30 second riddle song. Include:
   - Genre/style and approximate tempo
   - Main instruments and sounds
   - Mood and energy progression
   - FULL lyrics (verse + chorus minimum) describing the concept as a riddle
   - Include iconic paraphrased catchphrases or quotes
   - Lyrics must NEVER mention actual names, titles, or trademarked terms`,
    schema: ConceptBatchSchema,
    systemInstruction:
      "You are a creative game designer for SoundCharades, an audio guessing game. " +
      "Generate fun, recognizable concepts that players can guess from audio clues. " +
      "Keep SFX prompts SHORT (3-8 words, one sound per prompt). " +
      "Music prompts should be DETAILED production briefs with full lyrics. " +
      "IMPORTANT: The 'name' field must be the REAL, well-known name.",
    temperature: 0.9,
  });

  // Filter out duplicates
  const concepts = batch.filter(
    (c) => !existingNames.has(c.name.toLowerCase()),
  );
  if (concepts.length === 0) {
    throw new Error(
      "All generated concepts already exist. Try a different theme.",
    );
  }

  onProgress(
    "concepts",
    `Generated ${concepts.length} concepts — no peeking!`,
    15,
  );

  // ── Step 2: Generate embeddings ────────────────────────────────

  onProgress("embeddings", "Creating vector embeddings...", 18);

  const embeddingTexts = concepts.map(
    (c) => `${c.name} — ${c.description}`,
  );
  const vectors = await embedTexts(embeddingTexts);

  onProgress("embeddings", "Embeddings ready", 22);

  // ── Step 3 & 4: Generate audio ─────────────────────────────────

  const conceptDocs: Array<{ concept: ConceptDocument; vector: number[] }> =
    [];
  const progressPerConcept = 65 / concepts.length;

  for (let i = 0; i < concepts.length; i++) {
    const c = concepts[i];
    const baseProgress = 22 + i * progressPerConcept;

    onProgress(
      "audio",
      `[${i + 1}/${concepts.length}] Generating sounds & music...`,
      baseProgress,
    );

    const { sfxPaths, musicPaths } = await generateAudioForConcept(c);

    conceptDocs.push({
      concept: {
        id: c.id,
        name: c.name,
        description: c.description,
        category: "custom",
        difficulty: "medium",
        sfxPrompts: [...c.sfxPrompts, ...c.sfxPhrasePrompts],
        musicPrompt: c.musicPrompt,
        audioSfxUrls: sfxPaths,
        audioMusicUrls: musicPaths,
      },
      vector: vectors[i],
    });

    onProgress(
      "audio",
      `[${i + 1}/${concepts.length}] Audio ready!`,
      baseProgress + progressPerConcept,
    );
  }

  // ── Step 5: Store in turbopuffer ───────────────────────────────

  onProgress("storage", "Saving to database...", 90);

  await upsertConcepts(conceptDocs);

  onProgress("complete", "All concepts saved!", 100);

  return conceptDocs.map((d) => d.concept.id);
}
