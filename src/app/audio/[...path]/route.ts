import { NextRequest, NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Dynamic audio file server.
 * Next.js only serves files in `public/` that existed at build time.
 * Audio generated after build (seed cron, custom quizzes) needs this route.
 *
 * Matches: /audio/sfx/*.mp3, /audio/music/*.mp3
 */

const AUDIO_BASE = path.join(process.cwd(), "public", "audio");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const segments = (await params).path;

  // Validate: only allow [type]/[filename.mp3] — no directory traversal
  if (
    segments.length !== 2 ||
    !["sfx", "music"].includes(segments[0]) ||
    !segments[1].endsWith(".mp3") ||
    segments[1].includes("..") ||
    segments[1].includes("/") ||
    segments[1].includes("\\")
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(AUDIO_BASE, segments[0], segments[1]);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const buffer = fs.readFileSync(filePath);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
