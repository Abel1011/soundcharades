import { generateCustomQuiz } from "@/lib/generate";

export const maxDuration = 300; // 5 minutes max

// ── In-memory job store ───────────────────────────────────────────

interface Job {
  status: "running" | "complete" | "error";
  step: string;
  detail: string;
  progress: number;
  conceptIds?: string[];
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();

// Clean up jobs older than 15 minutes
function cleanupJobs() {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}

// ── POST: start a generation job ──────────────────────────────────

export async function POST(request: Request) {
  const body = await request.json();
  const theme = typeof body.theme === "string" ? body.theme.trim() : "";

  if (!theme || theme.length < 2 || theme.length > 100) {
    return Response.json(
      { error: "Theme must be between 2 and 100 characters" },
      { status: 400 },
    );
  }

  cleanupJobs();

  const jobId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job: Job = {
    status: "running",
    step: "init",
    detail: "Starting generation...",
    progress: 0,
    createdAt: Date.now(),
  };
  jobs.set(jobId, job);

  // Fire-and-forget: run generation in background
  generateCustomQuiz(theme, (step, detail, progress) => {
    const j = jobs.get(jobId);
    if (j) {
      j.step = step;
      j.detail = detail;
      j.progress = progress;
    }
  })
    .then((conceptIds) => {
      const j = jobs.get(jobId);
      if (j) {
        j.status = "complete";
        j.step = "complete";
        j.detail = "Quiz ready!";
        j.progress = 100;
        j.conceptIds = conceptIds;
      }
    })
    .catch((err) => {
      const j = jobs.get(jobId);
      if (j) {
        j.status = "error";
        j.error = err instanceof Error ? err.message : "Generation failed";
      }
    });

  return Response.json({ jobId });
}

// ── GET: poll job status ──────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return Response.json({ error: "Missing jobId parameter" }, { status: 400 });
  }

  const job = jobs.get(jobId);
  if (!job) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  return Response.json({
    status: job.status,
    step: job.step,
    detail: job.detail,
    progress: job.progress,
    conceptIds: job.conceptIds,
    error: job.error,
  });
}
