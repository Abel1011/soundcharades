/**
 * Audit script — checks turbopuffer concepts against local audio files.
 * Finds orphaned concepts (in DB but missing audio) and orphaned files (on disk but not in DB).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { getExistingConceptNames } from "../lib/turbopuffer";

const AUDIO_BASE = path.join(process.cwd(), "public", "audio");
const SFX_DIR = path.join(AUDIO_BASE, "sfx");
const MUSIC_DIR = path.join(AUDIO_BASE, "music");

async function audit() {
  console.log("\n🔍 SoundCharades Data Audit\n");

  // 1. Get turbopuffer concepts
  const names = await getExistingConceptNames();
  console.log(`📦 Turbopuffer: ${names.size} concepts`);
  for (const n of names) console.log(`   • ${n}`);

  // 2. Scan local audio files
  const sfxFiles = fs.existsSync(SFX_DIR) ? fs.readdirSync(SFX_DIR) : [];
  const musicFiles = fs.existsSync(MUSIC_DIR) ? fs.readdirSync(MUSIC_DIR) : [];

  // Group SFX by concept ID
  const sfxByConceptId = new Map<string, number[]>();
  for (const f of sfxFiles) {
    const match = f.match(/^(.+)-sfx-(\d+)\.mp3$/);
    if (match) {
      const id = match[1];
      if (!sfxByConceptId.has(id)) sfxByConceptId.set(id, []);
      sfxByConceptId.get(id)!.push(parseInt(match[2]));
    }
  }

  // Group music by concept ID
  const musicByConceptId = new Set<string>();
  for (const f of musicFiles) {
    const match = f.match(/^(.+)-music-\d+\.mp3$/);
    if (match) musicByConceptId.add(match[1]);
  }

  // 3. Audit each audio concept
  const allAudioIds = new Set([...sfxByConceptId.keys(), ...musicByConceptId]);
  console.log(`\n🎵 Audio files found for ${allAudioIds.size} concept IDs\n`);

  console.log("════════════════════════════════════════════════════════════");
  console.log("  AUDIO FILE AUDIT");
  console.log("════════════════════════════════════════════════════════════\n");

  const broken: string[] = [];
  const healthy: string[] = [];

  for (const id of [...allAudioIds].sort()) {
    const sfxNums = sfxByConceptId.get(id) || [];
    const hasMusic = musicByConceptId.has(id);
    const issues: string[] = [];

    if (sfxNums.length < 6) issues.push(`SFX: ${sfxNums.length}/6 (missing: ${getMissingSfx(sfxNums)})`);
    if (!hasMusic) issues.push("NO MUSIC");

    if (issues.length > 0) {
      console.log(`  ❌ ${id}`);
      for (const issue of issues) console.log(`     → ${issue}`);
      broken.push(id);
    } else {
      console.log(`  ✅ ${id} — SFX: 6/6, Music: ✅`);
      healthy.push(id);
    }
  }

  // 4. Check turbopuffer concepts vs audio
  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  TURBOPUFFER vs AUDIO CROSS-CHECK");
  console.log("════════════════════════════════════════════════════════════\n");

  const turbopufferOrphans: string[] = [];
  for (const name of names) {
    // Try to match turbopuffer name to audio file ID
    const possibleIds = [
      name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    ];

    const found = possibleIds.some((id) => allAudioIds.has(id));
    if (!found) {
      console.log(`  ❌ ORPHAN (in turbopuffer, no audio): "${name}"`);
      console.log(`     Tried IDs: ${possibleIds.join(", ")}`);
      turbopufferOrphans.push(name);
    }
  }

  // 5. Check audio files not in turbopuffer
  const audioOrphans: string[] = [];
  for (const id of allAudioIds) {
    // Check if any turbopuffer concept maps to this ID
    let found = false;
    for (const name of names) {
      const possibleIds = [
        name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        name.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      ];
      if (possibleIds.includes(id)) {
        found = true;
        break;
      }
    }
    if (!found) {
      console.log(`  ❌ ORPHAN (audio files exist, NOT in turbopuffer): "${id}"`);
      audioOrphans.push(id);
    }
  }

  if (turbopufferOrphans.length === 0 && audioOrphans.length === 0) {
    console.log("  ✅ All turbopuffer concepts have matching audio files");
  }

  // Summary
  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("════════════════════════════════════════════════════════════\n");
  console.log(`  Total concepts in turbopuffer:  ${names.size}`);
  console.log(`  Total concepts with audio:      ${allAudioIds.size}`);
  console.log(`  Healthy (6 SFX + music):        ${healthy.length}`);
  console.log(`  Broken audio:                   ${broken.length}`);
  console.log(`  Turbopuffer orphans (no audio):  ${turbopufferOrphans.length}`);
  console.log(`  Audio orphans (not in DB):       ${audioOrphans.length}`);

  if (broken.length > 0) {
    console.log(`\n  ⚠️  Broken concepts: ${broken.join(", ")}`);
  }
  if (turbopufferOrphans.length > 0) {
    console.log(`  ⚠️  DB orphans: ${turbopufferOrphans.join(", ")}`);
  }
  if (audioOrphans.length > 0) {
    console.log(`  ⚠️  Audio orphans: ${audioOrphans.join(", ")}`);
  }
  console.log();
}

function getMissingSfx(existing: number[]): string {
  const all = [1, 2, 3, 4, 5, 6];
  return all.filter((n) => !existing.includes(n)).join(", ");
}

audit().catch(console.error);
