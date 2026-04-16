/**
 * Fix-orphans cron script — detects and resolves data inconsistencies.
 *
 * Handles two orphan types:
 *   1. Turbopuffer orphans: concept in DB but missing audio files
 *      → Regenerates audio using stored prompts (sfxPrompts + musicPrompt)
 *   2. Audio orphans: files on disk with no matching turbopuffer concept
 *      → Deletes the orphaned files
 *
 * Usage:
 *   node --env-file=.env --import tsx src/scripts/fix-orphans.ts
 *
 * Designed for daily cron. Safe to run multiple times (idempotent).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { generateSoundEffect, generateMusic, createCompositionPlan } from "../lib/elevenlabs";
import { generateText } from "../lib/gemini";
import { getConceptsByIds, upsertConcepts, deleteConcepts } from "../lib/turbopuffer";
import type { ConceptDocument } from "../lib/turbopuffer";

// ── Config ────────────────────────────────────────────────────────

const AUDIO_BASE = path.join(process.cwd(), "public", "audio");
const SFX_DIR = path.join(AUDIO_BASE, "sfx");
const MUSIC_DIR = path.join(AUDIO_BASE, "music");
const MAX_RETRIES = 2;

// ── Audio helpers (same logic as seed.ts) ─────────────────────────

function isCopyrightError(err: unknown): boolean {
  const msg = String(err);
  return msg.includes("violated our Terms of Service") || msg.includes("bad_prompt");
}

function isSilentAudio(buffer: Buffer): boolean {
  let offset = 0;
  if (buffer.length > 10 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    const size = (buffer[6] << 21) | (buffer[7] << 14) | (buffer[8] << 7) | buffer[9];
    offset = 10 + size;
  }
  const start = Math.max(offset + 200, Math.floor(buffer.length * 0.2));
  const end = Math.min(buffer.length - 100, Math.floor(buffer.length * 0.8));
  if (end - start < 500) return false;
  const sampleSize = end - start;
  let sum = 0;
  let sumSq = 0;
  for (let i = start; i < end; i++) {
    sum += buffer[i];
    sumSq += buffer[i] * buffer[i];
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
    execFileSync("ffmpeg", [
      "-y", "-i", tmpInput,
      "-af", "loudnorm=I=-14:TP=-1:LRA=11",
      "-ar", "44100", "-b:a", "128k",
      tmpOutput,
    ], { stdio: "pipe" });
    const normalized = fs.readFileSync(tmpOutput);
    return normalized;
  } catch {
    return buffer;
  } finally {
    if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
    if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
  }
}

async function rewritePrompt(original: string, type: "sfx" | "music"): Promise<string> {
  const instruction = type === "sfx"
    ? `Rewrite this sound effect prompt so it describes the SAME sound but avoids any copyrighted names, character names, or franchise-specific terms. Return ONLY the rewritten prompt.`
    : `Rewrite this music generation prompt so it keeps the same genre, mood, instruments, structure, and lyrical theme but removes ALL copyrighted names, character names, franchise references, and trademarked terms. Return ONLY the rewritten prompt.`;
  const result = await generateText({
    prompt: `Original prompt:\n"${original}"\n\n${instruction}`,
    systemInstruction: "You rewrite AI generation prompts to avoid copyright issues. Keep the creative intent identical but remove any reference to real names, titles, characters, or trademarks.",
    temperature: 0.7,
  });
  return result.trim();
}

async function generateSfxWithRetry(prompt: string, loop: boolean, durationSeconds: number): Promise<Buffer> {
  let currentPrompt = prompt;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const buffer = await generateSoundEffect({
        text: currentPrompt,
        durationSeconds,
        promptInfluence: 0.75,
        loop,
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
  throw new Error("Unreachable");
}

async function generateMusicForConcept(prompt: string): Promise<Buffer> {
  let currentPrompt = prompt;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const plan = await createCompositionPlan({ prompt: currentPrompt, musicLengthMs: 30000 });
      return await generateMusic({ compositionPlan: plan });
    } catch (err) {
      if (isCopyrightError(err) && attempt < MAX_RETRIES) {
        currentPrompt = await rewritePrompt(currentPrompt, "music");
      } else {
        throw err;
      }
    }
  }
  throw new Error("Unreachable");
}

// ── Scan helpers ──────────────────────────────────────────────────

function toConceptId(name: string): string {
  return name.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function scanAudioFiles(): { sfxById: Map<string, number[]>; musicIds: Set<string> } {
  const sfxById = new Map<string, number[]>();
  const musicIds = new Set<string>();

  if (fs.existsSync(SFX_DIR)) {
    for (const f of fs.readdirSync(SFX_DIR)) {
      const match = f.match(/^(.+)-sfx-(\d+)\.mp3$/);
      if (match) {
        if (!sfxById.has(match[1])) sfxById.set(match[1], []);
        sfxById.get(match[1])!.push(parseInt(match[2]));
      }
    }
  }

  if (fs.existsSync(MUSIC_DIR)) {
    for (const f of fs.readdirSync(MUSIC_DIR)) {
      const match = f.match(/^(.+)-music-\d+\.mp3$/);
      if (match) musicIds.add(match[1]);
    }
  }

  return { sfxById, musicIds };
}

// ── Main ──────────────────────────────────────────────────────────

async function fixOrphans() {
  console.log("\n🔧 SoundCharades — Fix Orphans\n");

  // 1. Query all concepts from turbopuffer
  const { getExistingConceptNames } = await import("../lib/turbopuffer");
  const names = await getExistingConceptNames();
  console.log(`  📦 Turbopuffer: ${names.size} concepts`);

  // 2. Scan local audio
  const { sfxById, musicIds } = scanAudioFiles();
  const allAudioIds = new Set([...sfxById.keys(), ...musicIds]);
  console.log(`  🎵 Audio on disk: ${allAudioIds.size} concept IDs\n`);

  // 3. Find turbopuffer orphans (concept in DB, missing/incomplete audio)
  const dbOrphans: string[] = [];
  const incompleteAudio: Array<{ id: string; missingSfx: number[]; missingMusic: boolean }> = [];

  for (const name of names) {
    const id = toConceptId(name);
    const sfxNums = sfxById.get(id) || [];
    const hasMusic = musicIds.has(id);

    if (sfxNums.length === 0 && !hasMusic) {
      dbOrphans.push(id);
    } else {
      const missingSfx: number[] = [];
      for (let n = 1; n <= 6; n++) {
        if (!sfxNums.includes(n)) missingSfx.push(n);
      }
      if (missingSfx.length > 0 || !hasMusic) {
        incompleteAudio.push({ id, missingSfx, missingMusic: !hasMusic });
      }
    }
  }

  // 4. Find audio orphans (files on disk, not in turbopuffer)
  const audioOrphans: string[] = [];
  for (const audioId of allAudioIds) {
    let found = false;
    for (const name of names) {
      if (toConceptId(name) === audioId) { found = true; break; }
    }
    if (!found) audioOrphans.push(audioId);
  }

  // ── Report ─────────────────────────────────────────────────────

  const totalIssues = dbOrphans.length + incompleteAudio.length + audioOrphans.length;

  if (totalIssues === 0) {
    console.log("  ✅ No orphans found — everything is healthy!\n");
    return;
  }

  console.log(`  ⚠️  Found ${totalIssues} issue(s):\n`);
  if (dbOrphans.length > 0) console.log(`    DB orphans (no audio at all):   ${dbOrphans.length}`);
  if (incompleteAudio.length > 0) console.log(`    Incomplete audio:               ${incompleteAudio.length}`);
  if (audioOrphans.length > 0) console.log(`    Audio orphans (not in DB):      ${audioOrphans.length}`);
  console.log();

  // ── Fix audio orphans (delete files) ───────────────────────────

  if (audioOrphans.length > 0) {
    console.log("  🗑️  Deleting audio orphans...\n");
    for (const orphanId of audioOrphans) {
      let deleted = 0;
      // Delete SFX files
      if (fs.existsSync(SFX_DIR)) {
        for (const f of fs.readdirSync(SFX_DIR)) {
          if (f.startsWith(orphanId + "-sfx-")) {
            fs.unlinkSync(path.join(SFX_DIR, f));
            deleted++;
          }
        }
      }
      // Delete music files
      if (fs.existsSync(MUSIC_DIR)) {
        for (const f of fs.readdirSync(MUSIC_DIR)) {
          if (f.startsWith(orphanId + "-music-")) {
            fs.unlinkSync(path.join(MUSIC_DIR, f));
            deleted++;
          }
        }
      }
      console.log(`    ✅ Deleted ${deleted} file(s) for orphan "${orphanId}"`);
    }
    console.log();
  }

  // ── Fix DB orphans (delete from turbopuffer — no audio to recover) ──

  if (dbOrphans.length > 0) {
    console.log("  🗑️  Removing DB orphans (concepts with zero audio)...\n");
    await deleteConcepts(dbOrphans);
    for (const id of dbOrphans) {
      console.log(`    ✅ Deleted "${id}" from turbopuffer`);
    }
    console.log();
  }

  // ── Fix incomplete audio (regenerate missing files) ────────────

  if (incompleteAudio.length > 0) {
    console.log("  🔄 Regenerating missing audio files...\n");

    // Fetch full concept data to get prompts
    const ids = incompleteAudio.map((c) => c.id);
    const concepts = await getConceptsByIds(ids);
    const conceptMap = new Map<string, ConceptDocument>();
    for (const c of concepts) conceptMap.set(c.id, c);

    if (!fs.existsSync(SFX_DIR)) fs.mkdirSync(SFX_DIR, { recursive: true });
    if (!fs.existsSync(MUSIC_DIR)) fs.mkdirSync(MUSIC_DIR, { recursive: true });

    for (const { id, missingSfx, missingMusic } of incompleteAudio) {
      const concept = conceptMap.get(id);
      if (!concept) {
        console.log(`    ⚠️  Could not find concept "${id}" in turbopuffer — skipping`);
        continue;
      }

      console.log(`    🎯 Fixing "${concept.name}" (${id})`);

      const newSfxUrls = [...concept.audioSfxUrls];

      // Regenerate missing SFX
      for (const sfxNum of missingSfx) {
        const promptIndex = sfxNum - 1;
        const prompts = concept.sfxPrompts;
        if (promptIndex >= prompts.length) {
          console.log(`      ⚠️  No prompt for SFX ${sfxNum} — skipping`);
          continue;
        }

        const isPhrase = sfxNum > 4; // SFX 1-4 are ambient, 5-6 are phrases
        const loop = !isPhrase;
        const duration = isPhrase ? 4 : 5;

        console.log(`      🔊 Generating SFX ${sfxNum} (${isPhrase ? "phrase" : "ambient"})...`);
        try {
          const buffer = await generateSfxWithRetry(prompts[promptIndex], loop, duration);
          const filename = `${id}-sfx-${sfxNum}.mp3`;
          const filepath = path.join(SFX_DIR, filename);
          const normalized = normalizeAudio(buffer, filepath);
          fs.writeFileSync(filepath, normalized);
          const url = `/audio/sfx/${filename}`;
          // Insert at correct position
          while (newSfxUrls.length < sfxNum) newSfxUrls.push("");
          newSfxUrls[sfxNum - 1] = url;
          console.log(`      ✅ ${filename} (${(normalized.length / 1024).toFixed(1)} KB)`);
        } catch (err) {
          console.log(`      ❌ SFX ${sfxNum} failed: ${(err as Error).message}`);
        }
      }

      // Regenerate missing music
      let newMusicUrls = [...concept.audioMusicUrls];
      if (missingMusic && concept.musicPrompt) {
        console.log(`      🎵 Generating music...`);
        try {
          const buffer = await generateMusicForConcept(concept.musicPrompt);
          const filename = `${id}-music-1.mp3`;
          const filepath = path.join(MUSIC_DIR, filename);
          const normalized = normalizeAudio(buffer, filepath);
          fs.writeFileSync(filepath, normalized);
          newMusicUrls = [`/audio/music/${filename}`];
          console.log(`      ✅ ${filename} (${(normalized.length / 1024).toFixed(1)} KB)`);
        } catch (err) {
          console.log(`      ❌ Music failed: ${(err as Error).message}`);
        }
      }

      // Update turbopuffer with new audio URLs if anything changed
      const sfxChanged = newSfxUrls.join(",") !== concept.audioSfxUrls.join(",");
      const musicChanged = newMusicUrls.join(",") !== concept.audioMusicUrls.join(",");

      if (sfxChanged || musicChanged) {
        console.log(`      📦 Updating turbopuffer...`);
        // We need the vector to upsert — fetch it
        const { getAllConceptsWithVectors } = await import("../lib/turbopuffer");
        const allWithVectors = await getAllConceptsWithVectors();
        const match = allWithVectors.find((c) => c.concept.id === id);
        if (match) {
          await upsertConcepts([{
            concept: {
              ...concept,
              audioSfxUrls: newSfxUrls.filter(Boolean),
              audioMusicUrls: newMusicUrls.filter(Boolean),
            },
            vector: match.vector,
          }]);
          console.log(`      ✅ Updated`);
        } else {
          console.log(`      ⚠️  Could not find vector for "${id}" — URLs not updated in DB`);
        }
      }

      console.log();
    }
  }

  // ── Summary ────────────────────────────────────────────────────

  console.log("  ════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("  ════════════════════════════════════════════════════════\n");
  console.log(`    Audio orphans deleted:      ${audioOrphans.length}`);
  console.log(`    DB orphans removed:         ${dbOrphans.length}`);
  console.log(`    Incomplete audio fixed:     ${incompleteAudio.length}`);
  console.log("\n  🔧 Fix-orphans complete!\n");
}

fixOrphans().catch((err) => {
  console.error("\n❌ Fix-orphans failed:", err);
  process.exit(1);
});
