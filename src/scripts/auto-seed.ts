/**
 * Auto-seed script for cron jobs.
 * Picks a random category and difficulty, then runs the seed pipeline.
 * Designed to be called periodically to grow the concept database.
 *
 * Usage:
 *   node --env-file=.env --import tsx src/scripts/auto-seed.ts
 *
 * It will:
 *   1. Check turbopuffer for current category counts
 *   2. Pick the category with the fewest concepts (balances growth)
 *   3. Pick a random difficulty
 *   4. Spawn the seed pipeline with those args
 */

import { getCategoryCounts } from "../lib/turbopuffer";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const CATEGORIES = ["movies", "series", "videogames", "countries", "food", "music"] as const;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

async function autoSeed() {
  console.log("\n🤖 SoundCharades Auto-Seed\n");

  // Check current counts per category
  const counts = await getCategoryCounts();
  console.log("  Current counts:");
  for (const cat of CATEGORIES) {
    console.log(`    ${cat}: ${counts[cat] ?? 0}`);
  }

  // Pick category with fewest concepts (balances DB growth)
  const sorted = [...CATEGORIES].sort((a, b) => (counts[a] ?? 0) - (counts[b] ?? 0));
  const category = sorted[0];
  const categoryCount = counts[category] ?? 0;

  // Pick random difficulty
  const difficulty = DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)];

  console.log(`\n  Selected: ${category} (${categoryCount} existing) @ ${difficulty}`);
  console.log("  Running seed pipeline...\n");

  // Run the seed script as a child process
  const seedScript = path.join(process.cwd(), "src", "scripts", "seed.ts");
  const nodeArgs = [
    // Only use --env-file if .env exists (local dev), skip in containers
    ...(fs.existsSync(path.join(process.cwd(), ".env")) ? ["--env-file=.env"] : []),
    "--import",
    "tsx",
    seedScript,
    `--category=${category}`,
    `--difficulty=${difficulty}`,
    "--count=4",
  ];
  try {
    execFileSync("node", nodeArgs, { stdio: "inherit", cwd: process.cwd() });
    console.log("\n🤖 Auto-seed complete!\n");
  } catch (err) {
    console.error("\n❌ Auto-seed failed:", (err as Error).message);
    process.exit(1);
  }
}

autoSeed();
