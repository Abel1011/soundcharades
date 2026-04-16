/**
 * Seed pipeline — generate a batch of concepts for a category:
 *   1. Check turbopuffer for existing concepts (dedup)
 *   2. Gemini Pro → batch of concept metadata
 *   3. Gemini → embedding vectors for each concept
 *   4. ElevenLabs → SFX audio files per concept (with retry on copyright)
 *   5. ElevenLabs → Music audio file per concept (with retry on copyright)
 *   6. turbopuffer → store all concepts with vectors & local audio paths
 *
 * Distractors are NOT pre-generated — at game time, turbopuffer vector
 * similarity finds the N nearest concepts in the same category.
 *
 * Usage:
 *   npm run seed                                # default: 4 easy movies
 *   npm run seed -- --category=videogames       # custom category
 *   npm run seed -- --count=6                   # more concepts
 *   npm run seed -- --difficulty=medium
 *   npm run seed -- --dry                       # skip audio generation
 *   npm run seed -- --clean                     # wipe all audio files + turbopuffer data
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { generateJson, generateText, embedTexts, z } from "../lib/gemini";
import { generateSoundEffect, generateMusic, createCompositionPlan } from "../lib/elevenlabs";
import type { MusicPrompt } from "../lib/elevenlabs";
import { upsertConcepts, deleteAllConcepts, getExistingConceptNames } from "../lib/turbopuffer";
import type { ConceptDocument } from "../lib/turbopuffer";
import type { Category, Difficulty } from "../lib/types";

// ── CLI args ──────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (key: string, fallback: string) => {
    const arg = args.find((a) => a.startsWith(`--${key}=`));
    return arg ? arg.split("=")[1] : fallback;
  };
  return {
    category: get("category", "movies") as Category,
    difficulty: get("difficulty", "easy") as Difficulty,
    count: parseInt(get("count", "4"), 10),
    dry: args.includes("--dry"),
    clean: args.includes("--clean"),
  };
}

// ── Schema for Gemini structured output ───────────────────────────

const ConceptBatchSchema = z.array(
  z.object({
    id: z.string().describe("kebab-case unique id, e.g. 'jurassic-park'"),
    name: z.string().describe("Display name, e.g. 'Jurassic Park'"),
    description: z
      .string()
      .describe(
        "A direct, factual description of what this is. No metaphors or poetic language. " +
        "Example: 'A 1993 sci-fi film about a theme park where cloned dinosaurs escape and attack visitors.'",
      ),
    sfxPrompts: z
      .array(z.string())
      .length(4)
      .describe(
        "Exactly 4 sound effect prompts that together form a recognizable Sound Chain clue. " +
        "Think of it like an emoji reference sequence (for example: ⏰🚗⚡🛹 for Back to the Future), but expressed entirely through sound. " +
        "You should include the most iconic elements from the movies. For example, if it’s about racing, you can include cars; if it’s about animals, include the animal’s sound. It should be as clear as possible because sound is harder to interpret. "+
        "Don't repeat the same sound patterns, so it can cover a wider range of possibilities and have a better chance of guessing correctly. Don't use obscure sounds; stick to the most common ones, since the AI sound generator might not replicate them accurately, making it harder to guess. " +
        "Don't add unnecessary details that might make a recognizable sound unrecognizable; instead, opt for clear, identifiable sounds. " +
        "Avoid including multiple elements in a sound, as this confuses the model; be precise. " +
        "Use clever fan-recognizable references such as running jokes, iconic moments, symbolic objects, indirect clues, or recurring motifs that instantly trigger recognition. " +
        "For example, for Back to the Future: a chicken clucking (running joke), a DeLorean engine revving, clocks ticking. " +
        "For Jaws: deep underwater bubbling, distant panicked crowd screams, and a wooden boat creaking under pressure. " +
        "IMPORTANT: every sound will be looped for 5 seconds, so each prompt must describe a continuous, repeating, or naturally loopable ambient sound. " +
        "Each prompt MUST include 'loud' or 'close-up' to ensure the generated audio has strong, clear volume (e.g. 'Loud chicken clucking close-up'). " +
        "Voice-like effects are allowed (laughing, screaming, growling), but NO intelligible speech."
        ),
    sfxPhrasePrompts: z
      .array(z.string())
      .length(2)
      .describe(
        "Exactly 2 ICONIC PHRASE sound effects — pick THE most famous, most recognizable quotes/catchphrases from this concept. " +
        "Choose the phrases that EVERYONE knows, the ones people quote in everyday life. " +
        "The phrase is ALLOWED as-is if it does NOT contain character names, actor names, or the movie title. " +
        "Only paraphrase if the original quote contains a name (e.g. 'I am Iron Man' → 'I am the iron hero'). " +
        "KEEP THE VOICE DESCRIPTION SHORT AND SIMPLE. Only include 1-2 key voice traits that matter most. " +
        "Each prompt MUST include 'loud' or 'close-up' to ensure the audio is clear and audible (e.g. 'A loud robotic voice close-up saying the words: ...'). " +
        "BAD (too complex): 'A cynical, chain-smoking middle-aged man, flat and sarcastic tone, with computer keyboard clacking in the background' " +
        "GOOD (simple): 'A sarcastic middle-aged man saying the words: ...' " +
        "Do NOT add background sounds or unnecessary audio effects — just describe the voice and the phrase. " +
        "IMPORTANT: Wrap the exact phrase in double quotes so the generator knows it's literal speech to say, not a description. " +
        "Format: 'A [brief voice description] saying the words: \"[the phrase]\"'",
      ),
    musicPrompt: z
      .string()
      .describe(
        "A highly detailed prompt for generating a ~30 second riddle song. Must include: " +
        "1) Genre/style and tempo (e.g. 'upbeat pop-rock at 120bpm') " +
        "2) How the song starts (e.g. 'Opens with a soft piano intro') " +
        "3) Key instruments and sounds throughout " +
        "4) Mood and energy progression " +
        "5) FULL lyrics (verse + chorus minimum) describing the concept as a riddle " +
        "6) The lyrics must NEVER mention real names, titles, or copyrighted terms " +
        "7) Include iconic catchphrases or paraphrased quotes associated with the concept " +
        "(e.g. for a space movie: 'I can feel the force inside' — recognizable hint without using actual names)",
      ),
  }),
);

type GeneratedBatch = z.infer<typeof ConceptBatchSchema>;

// ── Config ────────────────────────────────────────────────────────

const AUDIO_BASE = path.join(process.cwd(), "public", "audio");
const SFX_DIR = path.join(AUDIO_BASE, "sfx");
const MUSIC_DIR = path.join(AUDIO_BASE, "music");
const MAX_RETRIES = 2;

// ── Helpers ───────────────────────────────────────────────────────

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function rmDir(dir: string) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function hr(char = "─", len = 60) {
  return char.repeat(len);
}

function isCopyrightError(err: unknown): boolean {
  const msg = String(err);
  return msg.includes("violated our Terms of Service") || msg.includes("bad_prompt");
}

/**
 * Detect if an MP3 buffer contains silent/empty audio.
 * Analyzes the byte variance of the audio data — silent MP3s have
 * highly repetitive frame data with very low byte variance.
 */
function isSilentAudio(buffer: Buffer): boolean {
  // Skip ID3v2 tag if present
  let offset = 0;
  if (buffer.length > 10 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    const size = (buffer[6] << 21) | (buffer[7] << 14) | (buffer[8] << 7) | buffer[9];
    offset = 10 + size;
  }

  // Sample from the middle 60% of the audio data (skip headers/tail)
  const start = Math.max(offset + 200, Math.floor(buffer.length * 0.2));
  const end = Math.min(buffer.length - 100, Math.floor(buffer.length * 0.8));

  if (end - start < 500) return false; // Too small to analyze, assume not silent

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
  const stdDev = Math.sqrt(variance);

  // Silent MP3s typically have stdDev < 20, normal audio > 50
  const SILENCE_THRESHOLD = 25;
  return stdDev < SILENCE_THRESHOLD;
}

/**
 * Normalize audio volume using ffmpeg loudnorm filter.
 * Writes a temp file, runs ffmpeg, reads the result back.
 * Falls back to original buffer if ffmpeg fails.
 */
function normalizeAudio(buffer: Buffer, filepath: string): Buffer {
  const tmpInput = filepath + ".tmp_in.mp3";
  const tmpOutput = filepath + ".tmp_out.mp3";
  try {
    fs.writeFileSync(tmpInput, buffer);
    execFileSync("ffmpeg", [
      "-y", "-i", tmpInput,
      "-af", "loudnorm=I=-14:TP=-1:LRA=11",
      "-ar", "44100", "-b:a", "128k",
      tmpOutput,
    ], { stdio: "pipe" });
    const normalized = fs.readFileSync(tmpOutput);
    console.log(`  🔊 Normalized: ${(buffer.length / 1024).toFixed(1)} KB → ${(normalized.length / 1024).toFixed(1)} KB`);
    return normalized;
  } catch (err) {
    console.log(`  ⚠️  ffmpeg normalization failed, using original audio`);
    return buffer;
  } finally {
    if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
    if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
  }
}

/**
 * Use Gemini Flash to rewrite a prompt that was rejected by ElevenLabs
 * due to copyright/TOS violations.
 */
async function rewritePrompt(original: string, type: "sfx" | "music"): Promise<string> {
  console.log(`  🔄 Rewriting ${type} prompt with Gemini Flash...`);
  console.log(`     Original: "${original.slice(0, 120)}..."`);

  const instruction = type === "sfx"
    ? `Rewrite this sound effect prompt so it describes the SAME sound but avoids any copyrighted names, character names, or franchise-specific terms. Keep it as a concrete, producible sound description. Return ONLY the rewritten prompt, nothing else.`
    : `Rewrite this music generation prompt so it keeps the same genre, mood, instruments, structure, and lyrical theme but removes ALL copyrighted names, character names, franchise references, and trademarked terms from both the description and the lyrics. Return ONLY the rewritten prompt, nothing else.`;

  const result = await generateText({
    prompt: `Original prompt:\n"${original}"\n\n${instruction}`,
    systemInstruction: "You rewrite AI generation prompts to avoid copyright issues. Keep the creative intent identical but remove any reference to real names, titles, characters, or trademarks.",
    temperature: 0.7,
  });

  const rewritten = result.trim();
  console.log(`     Rewritten: "${rewritten.slice(0, 120)}..."`);
  return rewritten;
}

/**
 * Generate a single SFX with automatic retry on copyright errors.
 * Used for ambient sounds — looped, 5s, moderate influence.
 */
async function generateSfxWithRetry(prompt: string, conceptName: string): Promise<Buffer> {
  let currentPrompt = prompt;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const buffer = await generateSoundEffect({
        text: currentPrompt,
        durationSeconds: 5,
        promptInfluence: 0.75,
        loop: true,
      });
      if (isSilentAudio(buffer)) {
        if (attempt < MAX_RETRIES) {
          console.log(`  ⚠️  Silent audio detected for "${conceptName}" — retrying (${attempt + 1}/${MAX_RETRIES})...`);
          continue;
        }
        console.log(`  ⚠️  Silent audio detected after all retries — using last result`);
      }
      return buffer;
    } catch (err) {
      if (isCopyrightError(err) && attempt < MAX_RETRIES) {
        console.log(`  ⚠️  SFX prompt rejected (copyright) for "${conceptName}"`);
        currentPrompt = await rewritePrompt(currentPrompt, "sfx");
      } else {
        throw err;
      }
    }
  }
  throw new Error("Unreachable");
}

/**
 * Generate a phrase SFX with automatic retry on copyright errors.
 * NOT looped, 4s duration, higher prompt influence for voice accuracy.
 */
async function generateSfxPhraseWithRetry(prompt: string, conceptName: string): Promise<Buffer> {
  let currentPrompt = prompt;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const buffer = await generateSoundEffect({
        text: currentPrompt,
        durationSeconds: 4,
        promptInfluence: 0.75,
        loop: false,
      });
      if (isSilentAudio(buffer)) {
        if (attempt < MAX_RETRIES) {
          console.log(`  ⚠️  Silent audio detected for "${conceptName}" — retrying (${attempt + 1}/${MAX_RETRIES})...`);
          continue;
        }
        console.log(`  ⚠️  Silent audio detected after all retries — using last result`);
      }
      return buffer;
    } catch (err) {
      if (isCopyrightError(err) && attempt < MAX_RETRIES) {
        console.log(`  ⚠️  Phrase SFX prompt rejected (copyright) for "${conceptName}"`);
        currentPrompt = await rewritePrompt(currentPrompt, "sfx");
      } else {
        throw err;
      }
    }
  }
  throw new Error("Unreachable");
}

interface MusicResult {
  buffer: Buffer;
  plan: MusicPrompt;
}

/**
 * Generate music using composition plan (plan is FREE) + compose.
 * Prints lyrics from the plan. Retries on copyright errors.
 */
async function generateMusicWithRetry(prompt: string, conceptName: string): Promise<MusicResult> {
  let currentPrompt = prompt;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Step 1: Create composition plan (FREE — no credits)
      console.log(`\n  📝 Creating composition plan (free)...`);
      const plan = await createCompositionPlan({
        prompt: currentPrompt,
        musicLengthMs: 30000,
      });

      // Print plan details
      console.log(`\n  📜 Composition Plan:`);
      console.log(`     Global styles: ${plan.positiveGlobalStyles.join(", ")}`);
      if (plan.negativeGlobalStyles.length > 0) {
        console.log(`     Avoid styles:  ${plan.negativeGlobalStyles.join(", ")}`);
      }
      console.log();
      for (const section of plan.sections) {
        console.log(`     [${section.sectionName}] (${(section.durationMs / 1000).toFixed(1)}s)`);
        if (section.positiveLocalStyles.length > 0) {
          console.log(`       Styles: ${section.positiveLocalStyles.join(", ")}`);
        }
        for (const line of section.lines) {
          console.log(`       🎤 ${line}`);
        }
      }

      // Step 2: Generate audio from the plan
      console.log(`\n  🎵 Generating audio from composition plan...`);
      const buffer = await generateMusic({
        compositionPlan: plan,
      });

      return { buffer, plan };
    } catch (err) {
      if (isCopyrightError(err) && attempt < MAX_RETRIES) {
        console.log(`  ⚠️  Music prompt rejected (copyright) for "${conceptName}"`);
        currentPrompt = await rewritePrompt(currentPrompt, "music");
      } else {
        throw err;
      }
    }
  }
  throw new Error("Unreachable");
}

// ── Clean command ─────────────────────────────────────────────────

async function clean() {
  console.log("\n🧹 SoundCharades — Clean Seed Data\n");

  console.log("[1/2] Removing local audio files...");
  let sfxCount = 0;
  let musicCount = 0;
  if (fs.existsSync(SFX_DIR)) {
    sfxCount = fs.readdirSync(SFX_DIR).filter((f) => f.endsWith(".mp3")).length;
    rmDir(SFX_DIR);
  }
  if (fs.existsSync(MUSIC_DIR)) {
    musicCount = fs.readdirSync(MUSIC_DIR).filter((f) => f.endsWith(".mp3")).length;
    rmDir(MUSIC_DIR);
  }
  console.log(`       ✅ Deleted ${sfxCount} SFX + ${musicCount} music files`);

  if (fs.existsSync(AUDIO_BASE) && fs.readdirSync(AUDIO_BASE).length === 0) {
    fs.rmdirSync(AUDIO_BASE);
  }

  console.log("[2/2] Deleting all concepts from turbopuffer...");
  try {
    await deleteAllConcepts();
    console.log("       ✅ Namespace cleared\n");
  } catch (err) {
    console.log(`       ⚠️  turbopuffer cleanup failed (namespace may not exist): ${(err as Error).message}\n`);
  }

  console.log("🧹 Clean complete!\n");
}

// ── Main pipeline ─────────────────────────────────────────────────

async function seed() {
  const { category, difficulty, count, dry, clean: shouldClean } = parseArgs();

  if (shouldClean) {
    await clean();
    return;
  }

  console.log("\n🎮 SoundCharades Seed Pipeline\n");
  console.log(`  Category:   ${category}`);
  console.log(`  Difficulty: ${difficulty}`);
  console.log(`  Count:      ${count}`);
  console.log(`  Dry run:    ${dry}`);
  console.log();

  // ── Step 0: Check for existing concepts ────────────────────────

  console.log(hr("═"));
  console.log("  STEP 0 — CHECK EXISTING CONCEPTS (turbopuffer)");
  console.log(hr("═"));

  const existingNames = await getExistingConceptNames();
  if (existingNames.size > 0) {
    console.log(`\n  Found ${existingNames.size} existing concepts:`);
    for (const name of existingNames) {
      console.log(`    • ${name}`);
    }
  } else {
    console.log("\n  No existing concepts found (fresh namespace)");
  }
  console.log();

  // ── Step 1: Generate concept batch with Gemini Pro ─────────────

  console.log(hr("═"));
  console.log("  STEP 1/5 — GENERATE CONCEPTS (Gemini Pro)");
  console.log(hr("═"));

  const CATEGORY_LABELS: Record<Category, string> = {
    movies: "movies/films",
    series: "TV series/shows",
    videogames: "video games",
    countries: "countries or cities",
    food: "foods or dishes",
    music: "music artists or bands",
    custom: "custom theme",
  };

  const existingList = existingNames.size > 0
    ? `\n\nALREADY IN DATABASE (DO NOT repeat these):\n${[...existingNames].map(n => `- ${n}`).join("\n")}`
    : "";

  const batch: GeneratedBatch = await generateJson({
    prompt: `Generate exactly ${count} SoundCharades concepts for the category "${category}" (${CATEGORY_LABELS[category]}).${existingList}

RULES:
- Pick iconic, well-known ${CATEGORY_LABELS[category]} that most people would recognize
- All concepts should be ${difficulty} difficulty
- Choose concepts that are RELATED enough to be confusing as distractors for each other
  (e.g. for movies: pick several sci-fi movies, or several animated movies, so they overlap thematically)
- But each concept must still be distinct and identifiable by its unique sounds/music
${existingNames.size > 0 ? "- DO NOT include any concept already listed above\n" : ""}
For each concept:

1. **id**: kebab-case unique identifier (e.g. "jurassic-park")

2. **name**: the REAL name as people know it (e.g. "Jurassic Park", "Star Wars", "Japan"). Players see this as answer options.

3. **description**: Direct and factual. Say exactly what it is in 1-2 sentences. No poetic language.
   - GOOD: "A 1977 space opera film about a farm boy who joins a rebellion against a galactic empire using a mystical energy force."
   - BAD: "An epic saga of light and dark across the stars."

4. **sfxPrompts**: Exactly 4 AMBIENT sound effects that form a sequential clue chain.
   BE CREATIVE — think laterally, not literally! Include clever cultural references, running jokes, and iconic scene sounds.
   - Think like a superfan: "What sounds would make me and other fans instantly think of this?"
   - Mix DIRECT sounds (obvious effects from the concept) with INDIRECT/CLEVER references

   CRITICAL — KEEP EACH PROMPT SIMPLE:
   - ONE sound per prompt. NEVER combine multiple sounds in the same prompt.
     BAD: "car engine revving + tires screeching + electrical crackle + sonic explosion" (4 sounds crammed into 1 prompt)
     GOOD: "Car speeding down a highway" (one clear sound)
   - NO filler descriptions that don't produce sound.
     BAD: "clocks ticking in a quiet, cluttered laboratory" (laboratory has no sound)
     GOOD: "Clocks ticking" (just the sound itself)
   - Keep prompts SHORT (3-8 words ideally). The AI generates BETTER audio from simple prompts.
     BAD: "A high-performance car engine revving intensely, tires screeching on asphalt" (too long, too many details)
     GOOD: "Car accelerating fast" (short, clear)
   - Use COMMON, everyday sounds. Avoid overly technical descriptions.

   RULES:
   - Sounds will be LOOPED (5s), so describe CONTINUOUS or REPEATING sounds
   - You CAN include voice-like effects (laughing, screaming, growling) but NO intelligible speech
   - Each sound must be producible as an audio effect

5. **sfxPhrasePrompts**: Exactly 2 ICONIC PHRASE sound effects.
   Pick THE most famous, universally-known quotes from this concept — the ones EVERYONE quotes in real life.
   PRIORITIZE the #1 and #2 most iconic catchphrases. Think: what would people say at a party to reference this?
   - The phrase is FINE as-is if it contains NO character names, actor names, or the movie/show title
   - Only paraphrase when the original quote contains a proper name (e.g. 'I am Iron Man' → 'I am the iron hero')
   - Keep phrases short (3-10 words)
   FORMAT for each prompt:
   - Keep the voice description SHORT (1-2 traits max). Don't over-describe.
   - NO background sounds or audio effects in the description — just the voice and the phrase.
   - WRAP the exact phrase in double quotes so the AI generator treats it as literal speech
   - Use 'saying the words:' before the quoted phrase
   - GOOD: "A robotic voice with Austrian accent saying the words: \\"Hasta la vista, baby\\""
   - GOOD: "A raspy alien voice saying the words: \\"Phone home\\""
   - BAD: "A cynical, chain-smoking middle-aged man, flat and sarcastic tone, with the sound of a computer keyboard clacking in the background saying the words: ..." (way too complex)

6. **musicPrompt**: A VERY DETAILED prompt for a ~30 second riddle song. Include ALL of these:
   - Genre/style and approximate tempo
   - How the song OPENS (first 5 seconds — e.g. "Opens with a soft acoustic guitar riff")
   - Main instruments and sounds used throughout
   - Mood and energy (e.g. "builds from mellow verse to energetic chorus")
   - FULL lyrics (verse + chorus minimum) that describe the concept as a riddle
   - Include ICONIC PARAPHRASED catchphrases or quotes associated with the concept
     (e.g. for a space film: "I can feel the force inside" — a recognizable hint without the actual name)
     (e.g. for a mafia film: "I'll make a deal you can't refuse" — paraphrased, no names)
   - The lyrics must NEVER mention the actual name, character names, actor names, or any copyrighted/trademarked terms
   - Keep lyrics fun, clever, and descriptive enough that a player could guess`,
    schema: ConceptBatchSchema,
    systemInstruction:
      "You are a creative game designer for SoundCharades, an audio guessing game. " +
      "Your job is to create concepts that are FUN TO GUESS from audio clues. " +
      "For AMBIENT SFX: Keep each prompt SHORT and SIMPLE (3-8 words). ONE sound per prompt. No filler descriptions. The AI sound generator works MUCH better with simple, direct prompts than complex, detailed ones. Think creatively — use running jokes, iconic objects, clever cultural references. " +
      "For PHRASE SFX: always pick THE #1 and #2 most famous quotes that everyone knows. Keep the voice description brief (1-2 traits). No background effects. " +
      "The music prompts must be DETAILED production briefs that an AI music generator can follow precisely. " +
      "IMPORTANT: The 'name' field must be the REAL, well-known name — not a paraphrase or alias.",
    temperature: 0.9,
  });

  // Filter out any concepts that already exist (safety check)
  const concepts = batch.filter((c) => !existingNames.has(c.name.toLowerCase()));

  if (concepts.length < batch.length) {
    console.log(`\n  ⚠️  Filtered out ${batch.length - concepts.length} duplicate(s) already in database`);
  }

  if (concepts.length === 0) {
    console.log("\n  ❌ All generated concepts already exist. Try a different category or increase count.\n");
    return;
  }

  console.log(`\n  ✅ Generated ${concepts.length} new concepts\n`);

  for (let i = 0; i < concepts.length; i++) {
    const c = concepts[i];
    console.log(hr());
    console.log(`  📦 CONCEPT ${i + 1}/${concepts.length}: ${c.name}`);
    console.log(hr());
    console.log(`  ID:          ${c.id}`);
    console.log(`  Name:        ${c.name}`);
    console.log(`  Description: ${c.description}`);
    console.log();
    console.log(`  🔊 Ambient SFX (${c.sfxPrompts.length}):`);
    c.sfxPrompts.forEach((p, j) => {
      console.log(`     ${j + 1}. "${p}"`);
    });
    console.log();
    console.log(`  🗣️  Phrase SFX (${c.sfxPhrasePrompts.length}):`);
    c.sfxPhrasePrompts.forEach((p, j) => {
      console.log(`     ${j + 1}. "${p}"`);
    });
    console.log();
    console.log(`  🎵 Music Prompt:`);
    const lines = c.musicPrompt.split("\n");
    for (const line of lines) {
      console.log(`     ${line}`);
    }
    console.log();
  }

  // ── Step 2: Generate embeddings ────────────────────────────────

  console.log(hr("═"));
  console.log("  STEP 2/5 — GENERATE EMBEDDINGS (Gemini)");
  console.log(hr("═"));

  const embeddingTexts = concepts.map(
    (c) => `${c.name} — ${c.description}`,
  );

  console.log();
  embeddingTexts.forEach((t, i) => {
    console.log(`  ${i + 1}. "${t}"`);
  });

  const vectors = await embedTexts(embeddingTexts);
  console.log(`\n  ✅ ${vectors.length} embeddings (${vectors[0].length} dims each)\n`);

  // ── Step 3 & 4: Generate audio (skip in dry run) ──────────────

  const conceptDocs: Array<{ concept: ConceptDocument; vector: number[] }> = [];

  for (let i = 0; i < concepts.length; i++) {
    const c = concepts[i];
    let sfxPaths: string[] = [];
    let musicPaths: string[] = [];

    if (!dry) {
      // ── SFX (one at a time with retry) ─────────────────────────
      console.log(hr("═"));
      console.log(`  STEP 3/5 — SFX AUDIO [${i + 1}/${concepts.length}] "${c.name}"`);
      console.log(hr("═"));
      ensureDir(SFX_DIR);

      // 4 ambient SFX (looped, 5s)
      console.log(`\n  --- Ambient SFX (looped) ---`);
      for (let j = 0; j < c.sfxPrompts.length; j++) {
        console.log(`\n  Generating Ambient SFX ${j + 1}/${c.sfxPrompts.length}:`);
        console.log(`    Prompt: "${c.sfxPrompts[j]}"`);
        console.log(`    Duration: 5s | Influence: 0.75 | Loop: true`);

        try {
          const buffer = await generateSfxWithRetry(c.sfxPrompts[j], c.name);
          const filename = `${c.id}-sfx-${j + 1}.mp3`;
          const filepath = path.join(SFX_DIR, filename);
          const normalized = normalizeAudio(buffer, filepath);
          fs.writeFileSync(filepath, normalized);
          sfxPaths.push(`/audio/sfx/${filename}`);
          console.log(`  ✅ ${filename} (${(normalized.length / 1024).toFixed(1)} KB)`);
        } catch (err) {
          console.log(`  ❌ Ambient SFX ${j + 1} failed after retries: ${(err as Error).message}`);
          console.log(`     Skipping this SFX and continuing...`);
        }
      }

      // 2 phrase SFX (NOT looped, 4s, higher prompt influence)
      console.log(`\n  --- Phrase SFX (voice) ---`);
      for (let j = 0; j < c.sfxPhrasePrompts.length; j++) {
        const sfxIndex = c.sfxPrompts.length + j;
        console.log(`\n  Generating Phrase SFX ${j + 1}/${c.sfxPhrasePrompts.length}:`);
        console.log(`    Prompt: "${c.sfxPhrasePrompts[j]}"`);
        console.log(`    Duration: 4s | Influence: 0.75 | Loop: false`);

        try {
          const buffer = await generateSfxPhraseWithRetry(c.sfxPhrasePrompts[j], c.name);
          const filename = `${c.id}-sfx-${sfxIndex + 1}.mp3`;
          const filepath = path.join(SFX_DIR, filename);
          const normalized = normalizeAudio(buffer, filepath);
          fs.writeFileSync(filepath, normalized);
          sfxPaths.push(`/audio/sfx/${filename}`);
          console.log(`  ✅ ${filename} (${(normalized.length / 1024).toFixed(1)} KB)`);
        } catch (err) {
          console.log(`  ❌ Phrase SFX ${j + 1} failed after retries: ${(err as Error).message}`);
          console.log(`     Skipping this SFX and continuing...`);
        }
      }

      // ── Music (with retry) ─────────────────────────────────────
      console.log();
      console.log(hr("═"));
      console.log(`  STEP 4/5 — MUSIC AUDIO [${i + 1}/${concepts.length}] "${c.name}"`);
      console.log(hr("═"));
      ensureDir(MUSIC_DIR);

      console.log(`\n  Prompt sent to ElevenLabs Music API:`);
      const musicLines = c.musicPrompt.split("\n");
      for (const line of musicLines) {
        console.log(`    ${line}`);
      }
      console.log(`\n  Duration: 30s | Format: mp3_44100_128`);

      try {
        const { buffer: musicBuffer } = await generateMusicWithRetry(c.musicPrompt, c.name);
        const musicFilename = `${c.id}-music-1.mp3`;
        const musicFilepath = path.join(MUSIC_DIR, musicFilename);
        const normalizedMusic = normalizeAudio(musicBuffer, musicFilepath);
        fs.writeFileSync(musicFilepath, normalizedMusic);
        musicPaths = [`/audio/music/${musicFilename}`];
        console.log(`\n  ✅ ${musicFilename} (${(normalizedMusic.length / 1024).toFixed(1)} KB)\n`);
      } catch (err) {
        console.log(`\n  ❌ Music generation failed after retries: ${(err as Error).message}`);
        console.log(`     Continuing without music for "${c.name}"...\n`);
      }
    } else {
      console.log(`  ⏭️  [${i + 1}/${concepts.length}] Skipping audio for "${c.name}" (dry run)`);
    }

    conceptDocs.push({
      concept: {
        id: c.id,
        name: c.name,
        description: c.description,
        category,
        difficulty,
        sfxPrompts: [...c.sfxPrompts, ...c.sfxPhrasePrompts],
        musicPrompt: c.musicPrompt,
        audioSfxUrls: sfxPaths,
        audioMusicUrls: musicPaths,
      },
      vector: vectors[i],
    });
  }

  // ── Step 5: Store in turbopuffer ───────────────────────────────

  console.log(hr("═"));
  console.log("  STEP 5/5 — STORE IN TURBOPUFFER");
  console.log(hr("═"));

  console.log(`\n  Upserting ${conceptDocs.length} concepts...`);
  await upsertConcepts(conceptDocs);
  console.log("  ✅ All concepts stored in turbopuffer\n");

  // ── Summary ────────────────────────────────────────────────────

  console.log(hr("═"));
  console.log("  🎉 SEED COMPLETE!");
  console.log(hr("═"));
  console.log(`  Category:     ${category}`);
  console.log(`  Difficulty:   ${difficulty}`);
  console.log(`  Concepts:     ${conceptDocs.length}`);
  console.log(`  Audio:        ${dry ? "SKIPPED (dry run)" : "generated"}`);
  console.log(hr());
  console.log("\n  Concepts seeded:");
  for (const { concept } of conceptDocs) {
    const sfxOk = concept.audioSfxUrls.length;
    const musicOk = concept.audioMusicUrls.length;
    console.log(`    • ${concept.name} (${concept.id})`);
    console.log(`      ${concept.description}`);
    console.log(`      SFX: ${sfxOk}/${concept.sfxPrompts.length} generated | Music: ${musicOk > 0 ? "✅" : "❌"}`);
  }
  console.log(
    "\n  These concepts will serve as each other's distractors via vector similarity.\n",
  );
}

// ── Run ───────────────────────────────────────────────────────────

seed().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});
