"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = [
  { key: "reading", label: "Looking at your public page" },
  { key: "writing", label: "Working out what it means for you" },
  { key: "done", label: "Putting your report together" },
];

/**
 * Shown while a report builds. Live and public reports get the "working hard"
 * steps; sent (pre-built) links get a plain loader, because those are
 * normally finished before the link goes out.
 */
export function BuildingView({ apiPath, quiet, title, loadingText }: { apiPath: string; quiet: boolean; title: string; loadingText: string | null }) {
  const router = useRouter();
  const [phase, setPhase] = useState("reading");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let stopped = false;
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    async function poll() {
      while (!stopped) {
        try {
          const res = await fetch(apiPath, { cache: "no-store" });
          if (res.status === 404) {
            setError("This report link isn't valid anymore.");
            return;
          }
          const data = (await res.json()) as { status: string; phase: string; error: string | null };
          if (data.status === "complete") {
            router.refresh();
            return;
          }
          if (data.status === "failed") {
            setError(data.error ?? "Something went wrong.");
            return;
          }
          setPhase(data.phase === "queued" ? "reading" : data.phase);
        } catch {
          // Network blip: keep polling.
        }
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }
    void poll();
    return () => {
      stopped = true;
      clearInterval(tick);
    };
  }, [apiPath, router]);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-xl px-5 py-20 text-center">
        <h1 className="text-2xl font-bold">We hit a snag</h1>
        <p className="mt-4 text-mute">{error}</p>
        <Link href="/" className="mt-8 inline-block rounded-lg bg-brand px-5 py-3 font-semibold text-brand-ink">
          Start again
        </Link>
      </main>
    );
  }

  const index = Math.max(0, STEPS.findIndex((s) => s.key === phase));
  const current = seconds > 25 && index === 1 ? 2 : index;
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-20 text-center" role="status" aria-live="polite">
      <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-soft border-t-brand" aria-hidden="true" />
      {quiet ? (
        <p className="mt-6 text-mute">Loading your report...</p>
      ) : (
        <>
          <h1 className="mt-6 text-2xl font-bold">{title}</h1>
          <ol className="mx-auto mt-6 max-w-sm space-y-2 text-left">
            {STEPS.map((step, i) => (
              <li key={step.key} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${i < current ? "text-brand" : i === current ? "bg-soft font-semibold" : "text-mute"}`}>
                <span aria-hidden="true" className="w-4 text-center">
                  {i < current ? "✓" : i === current ? "•" : "○"}
                </span>
                {step.label}
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-mute">{loadingText ?? "This usually takes under a minute. Keep this page open."}</p>
        </>
      )}
    </main>
  );
}
