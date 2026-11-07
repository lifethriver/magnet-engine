"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SourceType } from "@/lib/settings";
import { normalizeSourceUrl } from "@/lib/source-urls";
import { track } from "@/lib/track";

const INPUT =
  "mt-1.5 w-full rounded-lg border border-line bg-page px-4 py-3 text-base text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";

export interface StartFormProps {
  source: SourceType;
  inputLabel: string;
  inputPlaceholder: string;
  buttonText: string;
  optIn: boolean;
  optInHeading: string | null;
  optInButton: string | null;
  consentText: string | null;
  initialUrl: string;
  sig: string | null;
}

export function StartForm(props: StartFormProps) {
  const router = useRouter();
  const [url, setUrl] = useState(props.initialUrl);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      normalizeSourceUrl(props.source, url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check the link and try again.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, sig: props.sig, ...(props.optIn ? { firstName, email } : {}) }),
      });
      const data = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!res.ok || !data.path || !data.path.startsWith("/r/")) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      track("magnet_report_started");
      if (props.optIn) track("magnet_lead");
      router.push(data.path);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 rounded-2xl border border-line bg-page p-6 shadow-sm" noValidate>
      <label className="block text-sm font-semibold" htmlFor="url">
        {props.inputLabel}
      </label>
      <input
        id="url"
        className={INPUT}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={props.inputPlaceholder}
        autoComplete="url"
        inputMode="url"
        disabled={busy}
        required
      />
      {props.optIn && (
        <div className="mt-5 space-y-4">
          {props.optInHeading && <p className="text-sm font-semibold">{props.optInHeading}</p>}
          <div>
            <label className="block text-sm font-semibold" htmlFor="firstName">
              First name
            </label>
            <input id="firstName" className={INPUT} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" disabled={busy} required />
          </div>
          <div>
            <label className="block text-sm font-semibold" htmlFor="email">
              Email
            </label>
            <input id="email" type="email" className={INPUT} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={busy} required />
          </div>
          {props.consentText && <p className="text-xs text-mute">{props.consentText}</p>}
        </div>
      )}
      {error && (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full rounded-lg bg-brand px-5 py-3.5 text-base font-semibold text-brand-ink transition hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Starting..." : (props.optIn && props.optInButton) || props.buttonText}
      </button>
    </form>
  );
}
