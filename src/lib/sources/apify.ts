/**
 * Runs one Apify actor and returns its dataset items. Uses the async run API
 * (start, wait, read) instead of run-sync so a slow run can keep waiting
 * inside a background function, and so the run id can be looked up later to
 * record what the run really cost.
 *
 * API: POST /v2/acts/{actor}/runs?waitForFinish=60, GET /v2/actor-runs/{id}?waitForFinish=60,
 * GET /v2/datasets/{id}/items. waitForFinish is capped at 60 seconds by Apify.
 */

const API = "https://api.apify.com/v2";
const TERMINAL = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);

export class SourceError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export interface ActorRun<T> {
  items: T[];
  runId: string;
  actor: string;
}

function token(): string {
  const value = process.env.APIFY_TOKEN?.trim();
  if (!value) throw new SourceError("apify_missing_token");
  return value;
}

async function apify(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${token()}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(75_000),
  });
}

export async function runActor<T = unknown>(actor: string, input: Record<string, unknown>, deadlineMs = 170_000): Promise<ActorRun<T>> {
  const started = Date.now();
  let res: Response | null = null;
  // Free Apify accounts allow a few runs at once. When a batch of reports
  // hits that ceiling, wait and try again instead of failing the report.
  for (let attempt = 0; attempt < 6; attempt++) {
    res = await apify(`/acts/${actor}/runs?waitForFinish=60`, { method: "POST", body: JSON.stringify(input) });
    if (res.status !== 429 && res.status !== 402) break;
    const body = await res.text();
    if (res.status === 402 && !/concurrent|memory/i.test(body)) throw new SourceError("apify_out_of_credit");
    if (Date.now() - started > deadlineMs - 20_000) break;
    await new Promise((resolve) => setTimeout(resolve, 8_000 + attempt * 4_000));
  }
  if (!res || !res.ok) {
    if (res?.status === 401 || res?.status === 403) throw new SourceError("apify_bad_token");
    if (res?.status === 402) throw new SourceError("apify_out_of_credit");
    throw new SourceError(`apify_${res?.status ?? "no_response"}`);
  }
  let run = ((await res.json()) as { data: { id: string; status: string; defaultDatasetId: string } }).data;
  while (!TERMINAL.has(run.status)) {
    if (Date.now() - started > deadlineMs) throw new SourceError("apify_timeout");
    const poll = await apify(`/actor-runs/${run.id}?waitForFinish=60`);
    if (!poll.ok) throw new SourceError(`apify_${poll.status}`);
    run = ((await poll.json()) as { data: typeof run }).data;
  }
  if (run.status !== "SUCCEEDED") throw new SourceError(`apify_run_${run.status.toLowerCase()}`);
  const itemsRes = await apify(`/datasets/${run.defaultDatasetId}/items?clean=true&format=json`);
  if (!itemsRes.ok) throw new SourceError(`apify_dataset_${itemsRes.status}`);
  const items = (await itemsRes.json()) as unknown;
  return { items: Array.isArray(items) ? (items as T[]) : [], runId: run.id, actor };
}

/** What the listed runs actually cost, in USD. Apify books charges a few seconds after a run ends. */
export async function apifyCost(runIds: string[]): Promise<number | null> {
  if (runIds.length === 0) return 0;
  try {
    const costs = await Promise.all(
      runIds.map(async (id) => {
        const res = await apify(`/actor-runs/${id}`);
        if (!res.ok) return null;
        const data = ((await res.json()) as { data: { usageTotalUsd?: number } }).data;
        return typeof data.usageTotalUsd === "number" ? data.usageTotalUsd : null;
      }),
    );
    if (costs.some((cost) => cost === null)) return null;
    return Math.round((costs as number[]).reduce((sum, cost) => sum + cost, 0) * 10000) / 10000;
  } catch {
    return null;
  }
}
