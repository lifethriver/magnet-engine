/**
 * Keeps strangers from spending the owner's Apify and Claude credits: a daily
 * cap for the whole magnet, a per-visitor daily limit, and a short burst
 * limit. Counters live in the store and expire through the cleanup function.
 */
import { kv, mutate } from "./store";

interface Counter {
  count: number;
}

/** Days roll over at midnight US Central, which is what most attendees expect. */
export function dayStamp(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

async function bump(key: string, limit: number): Promise<boolean> {
  let allowed = false;
  await mutate<Counter>(key, (current) => {
    const count = current?.count ?? 0;
    if (count >= limit) {
      allowed = false;
      return undefined;
    }
    allowed = true;
    return { count: count + 1 };
  });
  return allowed;
}

export type LimitResult = { ok: true } | { ok: false; reason: "daily_cap" | "visitor_cap" | "burst" };

export async function takeVisitorAllowance(ipHash: string, perVisitorPerDay: number, now = new Date()): Promise<LimitResult> {
  const tenMinutes = Math.floor(now.getTime() / 600_000);
  if (!(await bump(`count/burst/${ipHash}/${tenMinutes}`, 2))) return { ok: false, reason: "burst" };
  if (!(await bump(`count/visitor/${dayStamp(now)}/${ipHash}`, perVisitorPerDay))) return { ok: false, reason: "visitor_cap" };
  return { ok: true };
}

export async function takeDailyAllowance(dailyReports: number, now = new Date()): Promise<LimitResult> {
  if (!(await bump(`count/day/${dayStamp(now)}`, dailyReports))) return { ok: false, reason: "daily_cap" };
  return { ok: true };
}

/**
 * Opt-ins (name + email) go to storage and the owner's CRM webhook even when
 * the report itself is reused, so they get their own limit, taken before
 * anything is saved or sent.
 */
export async function takeLeadAllowance(ipHash: string, now = new Date()): Promise<boolean> {
  const tenMinutes = Math.floor(now.getTime() / 600_000);
  if (!(await bump(`count/leadburst/${ipHash}/${tenMinutes}`, 3))) return false;
  return bump(`count/lead/${dayStamp(now)}/${ipHash}`, 10);
}

export async function reportsToday(now = new Date()): Promise<number> {
  const entry = await kv().get<Counter>(`count/day/${dayStamp(now)}`);
  return entry?.data.count ?? 0;
}

/**
 * Failed-login throttle for /admin: 10 wrong passwords per 15 minutes per
 * visitor, and 50 per 15 minutes across the whole site, so spreading guesses
 * over many addresses doesn't help either.
 */
const ADMIN_PER_VISITOR = 10;
const ADMIN_SITE_WIDE = 50;

export async function recordAdminFailure(ipHash: string, now = new Date()): Promise<void> {
  const window = Math.floor(now.getTime() / 900_000);
  await bump(`count/admin/${ipHash}/${window}`, Number.MAX_SAFE_INTEGER);
  await bump(`count/admin-all/${window}`, Number.MAX_SAFE_INTEGER);
}

export async function adminAttemptsLeft(ipHash: string, now = new Date()): Promise<boolean> {
  const window = Math.floor(now.getTime() / 900_000);
  const [mine, all] = await Promise.all([kv().get<Counter>(`count/admin/${ipHash}/${window}`), kv().get<Counter>(`count/admin-all/${window}`)]);
  return (mine?.data.count ?? 0) < ADMIN_PER_VISITOR && (all?.data.count ?? 0) < ADMIN_SITE_WIDE;
}
