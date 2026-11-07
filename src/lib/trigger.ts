/**
 * Starts building a report without making the visitor wait on the request.
 *
 * On Netlify, ordinary functions stop after 60 seconds, which a LinkedIn read
 * plus Claude can exceed. So the job goes to a background function
 * (netlify/functions/build-report-background.mts, 15 minute limit), signed
 * with the site's own signing secret. Anywhere else (local dev), or if
 * that call fails, the job runs in next/after on this request.
 */
import { after } from "next/server";
import { runReport } from "./reports";
import { jobSignature } from "./secrets";

const BACKGROUND_PATH = "/.netlify/functions/build-report-background";

function onNetlify(): boolean {
  return Boolean((globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext || process.env.NETLIFY_BLOBS_CONTEXT);
}

export async function startReport(id: string, origin: string): Promise<void> {
  if (onNetlify()) {
    try {
      const res = await fetch(`${origin}${BACKGROUND_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, sig: await jobSignature(id) }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 202 || res.ok) return;
      console.error(`background trigger returned ${res.status}; running inline`);
    } catch {
      console.error("background trigger failed; running inline");
    }
  }
  after(() => runReport(id));
}

/** The public origin of this request, for calling our own background function. */
export function requestOrigin(request: Request): string {
  return new URL(request.url).origin;
}
