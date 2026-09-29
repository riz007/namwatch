import { APP } from "@/config/app.config.ts";
import { log } from "@/lib/log.ts";
import { parseWarnings } from "@/lib/sources/hii-warning/parse.ts";
import { NextResponse } from "next/server";

/**
 * `GET /api/v1/warnings` — HII's warnings for the Chao Phraya basin.
 *
 * Proxied rather than ingested: 29 KB, no history worth keeping, and an edge
 * cache of five minutes bounds upstream traffic however many people open the
 * page. A failure returns an empty list marked degraded — never an error page,
 * and never a silent "no warnings", which would read as good news.
 */
export const dynamic = "force-dynamic";

const URL_WARNING =
  "https://api-v3.thaiwater.net/api/v1/thaiwater30/public/warning";

export async function GET() {
  try {
    const response = await fetch(URL_WARNING, {
      headers: { "user-agent": APP.userAgent, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`HII responded ${response.status}`);
    const { basin, otherCount } = parseWarnings(await response.json());
    return NextResponse.json(
      { warnings: basin, otherCount, degraded: false },
      {
        headers: {
          "cache-control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      },
    );
  } catch (error) {
    log.warn({ err: String(error) }, "hii warnings failed");
    return NextResponse.json(
      { warnings: [], otherCount: 0, degraded: true },
      { headers: { "cache-control": "public, s-maxage=60" } },
    );
  }
}
