import { getCategoryCounts } from "@/lib/turbopuffer";

export async function GET() {
  try {
    const counts = await getCategoryCounts();
    return Response.json(counts);
  } catch (err) {
    console.error("Failed to fetch category counts:", err);
    return Response.json({}, { status: 500 });
  }
}
