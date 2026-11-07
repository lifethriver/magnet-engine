"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const PASSWORD_KEY = "magnet_admin_password";
const INPUT = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-900";
const BUTTON = "rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50";
const GHOST = "rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-50";

// sessionStorage as an external store, so the page renders the same on the server and the first client pass.
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function readPassword(): string {
  try {
    return sessionStorage.getItem(PASSWORD_KEY) ?? "";
  } catch {
    return "";
  }
}
function writePassword(value: string) {
  try {
    if (value) sessionStorage.setItem(PASSWORD_KEY, value);
    else sessionStorage.removeItem(PASSWORD_KEY);
  } catch {
    // Storage blocked: the password lives only for this page view.
  }
  listeners.forEach((listener) => listener());
}

interface Session {
  configured: boolean;
  name: string | null;
  source: string | null;
  optIn: boolean;
  dailyCap: number | null;
  today: number;
  keys: { anthropic: boolean; apify: boolean };
}

type Api = <T>(path: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; data: T }>;

export function AdminApp() {
  const stored = useSyncExternalStore(subscribe, readPassword, () => "");
  const [session, setSession] = useState<Session | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tab, setTab] = useState<"settings" | "build" | "reports" | "links" | "leads">("settings");

  const api: Api = useCallback(
    async <T,>(path: string, init: RequestInit = {}) => {
      const res = await fetch(path, {
        ...init,
        headers: { "content-type": "application/json", "x-admin-password": readPassword(), ...(init.headers ?? {}) },
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as T;
      if (res.status === 401) writePassword("");
      return { ok: res.ok, status: res.status, data };
    },
    [],
  );

  const refreshSession = useCallback(async () => {
    const res = await api<Session & { error?: string }>("/api/admin/session");
    if (res.ok) {
      setSession(res.data);
      setLoginError(null);
    } else {
      setSession(null);
      setLoginError(res.data.error ?? "Couldn't sign in.");
    }
  }, [api]);

  useEffect(() => {
    if (!stored) return;
    let cancelled = false;
    void (async () => {
      const res = await api<Session & { error?: string }>("/api/admin/session");
      if (cancelled) return;
      if (res.ok) {
        setSession(res.data);
        setLoginError(null);
      } else {
        setSession(null);
        setLoginError(res.data.error ?? "Couldn't sign in.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stored, api]);

  if (!stored || !session) {
    return <Login error={loginError} onSubmit={(password) => writePassword(password)} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Magnet Engine admin</p>
            <p className="text-lg font-bold">{session.name ?? "No settings saved yet"}</p>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-600">
            {session.configured && (
              <span>
                {session.today} of {session.dailyCap} public reports used today
              </span>
            )}
            <a className="underline" href="/" target="_blank" rel="noreferrer">
              Open my magnet
            </a>
            <button className={GHOST} onClick={() => writePassword("")}>
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-5">
          {(
            [
              ["settings", "1. Settings"],
              ["build", "2. Build reports"],
              ["reports", "Reports"],
              ["links", "Pre-filled links"],
              ["leads", "Leads"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === key ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">
        {(!session.keys.anthropic || !session.keys.apify) && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
            Missing key{!session.keys.anthropic && !session.keys.apify ? "s" : ""}: {[!session.keys.anthropic && "ANTHROPIC_API_KEY", !session.keys.apify && "APIFY_TOKEN"].filter(Boolean).join(" and ")}. Add it in Netlify under Site configuration, Environment variables, then redeploy.
          </div>
        )}
        {tab === "settings" && <SettingsTab api={api} onSaved={refreshSession} />}
        {tab === "build" && <BuildTab api={api} configured={session.configured} />}
        {tab === "reports" && <ReportsTab api={api} />}
        {tab === "links" && <LinksTab api={api} configured={session.configured} optIn={session.optIn} />}
        {tab === "leads" && <LeadsTab api={api} />}
      </main>
    </div>
  );
}

function Login({ error, onSubmit }: { error: string | null; onSubmit: (password: string) => void }) {
  const [password, setPassword] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-5">
      <form
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(password.trim());
        }}
      >
        <h1 className="text-xl font-bold text-zinc-900">Magnet Engine admin</h1>
        <p className="mt-1 text-sm text-zinc-600">Sign in with the ADMIN_PASSWORD you chose when you deployed.</p>
        <input className={`${INPUT} mt-5`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin password" autoComplete="current-password" />
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <button className={`${BUTTON} mt-5 w-full`} type="submit" disabled={!password.trim()}>
          Sign in
        </button>
      </form>
    </div>
  );
}

interface CheckResult {
  ok: boolean;
  saved?: boolean;
  errors?: string[];
  warnings?: string[];
  summary?: { name: string; source: string; sections: string[]; cta: string; optIn: boolean; dailyReports: number };
  error?: string;
}

function SettingsTab({ api, onSaved }: { api: Api; onSaved: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api<{ raw: string; savedAt: string | null }>("/api/admin/settings").then((res) => {
      if (cancelled || !res.ok) return;
      setText(res.data.raw);
      setSavedAt(res.data.savedAt);
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  async function check(save: boolean) {
    setBusy(true);
    const res = await api<CheckResult>("/api/admin/settings", { method: "POST", body: JSON.stringify({ text: text ?? "", save }) });
    setResult(res.data);
    setBusy(false);
    if (res.ok && save) {
      setSavedAt(new Date().toISOString());
      onSaved();
    }
  }

  return (
    <section>
      <h2 className="text-lg font-bold">Paste your settings</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Paste the whole settings block from the Idea Generator, click <strong>Check</strong>, fix anything it lists, then click <strong>Save and go live</strong>. You can paste a new block any time.
        {savedAt && <> Last saved {new Date(savedAt).toLocaleString()}.</>}
      </p>
      <textarea
        className={`${INPUT} mt-4 h-[420px] font-mono text-xs leading-relaxed`}
        value={text ?? ""}
        onChange={(e) => setText(e.target.value)}
        placeholder={"name: Channel Money Map\nsource:\n  type: youtube\n..."}
        spellCheck={false}
      />
      <div className="mt-3 flex flex-wrap gap-3">
        <button className={GHOST} disabled={busy || !text} onClick={() => check(false)}>
          Check
        </button>
        <button className={BUTTON} disabled={busy || !text} onClick={() => check(true)}>
          Save and go live
        </button>
      </div>
      {result && !result.ok && (
        <div className="mt-5 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">Not saved. Fix {result.errors && result.errors.length > 1 ? "these" : "this"} first:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {(result.errors ?? [result.error ?? "Unknown problem."]).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {result?.ok && result.summary && (
        <div className="mt-5 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
          <p className="font-semibold">{result.saved ? "Saved. Your magnet is live with these settings." : "Looks good. Click Save and go live when you're ready."}</p>
          <ul className="mt-2 space-y-1">
            <li>Name: {result.summary.name}</li>
            <li>Reads: {result.summary.source}</li>
            <li>Sections: {result.summary.sections.join(" / ")}</li>
            <li>Button: {result.summary.cta}</li>
            <li>Email opt-in: {result.summary.optIn ? "on (public mode)" : "off"}</li>
            <li>Daily public report cap: {result.summary.dailyReports}</li>
          </ul>
          {result.warnings && result.warnings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-amber-900">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function lines(value: string): string[] {
  return value
    .split(/\n|,(?=\s*(?:https?:\/\/|www\.|@))/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function BuildTab({ api, configured }: { api: Api; configured: boolean }) {
  const [links, setLinks] = useState("");
  const [notes, setNotes] = useState(["", "", ""]);
  const [results, setResults] = useState<{ input: string; link?: string; error?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!configured) return <p className="text-sm text-zinc-600">Save your settings first (tab 1).</p>;

  async function build() {
    setBusy(true);
    setError(null);
    const res = await api<{ results?: typeof results; error?: string }>("/api/admin/reports", {
      method: "POST",
      body: JSON.stringify({ links: lines(links), notes: notes.filter((n) => n.trim()) }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.data.error ?? "Couldn't start.");
      return;
    }
    setResults(res.data.results ?? []);
  }

  return (
    <section>
      <h2 className="text-lg font-bold">Build reports to send</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Paste one prospect link per line (up to 10). Each report builds in about a minute; check it on the Reports tab, then send the link. People who open these links never see an opt-in form.
      </p>
      <textarea className={`${INPUT} mt-4 h-36 font-mono text-xs`} value={links} onChange={(e) => setLinks(e.target.value)} placeholder="One link per line" />
      <details className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold">Add notes from a conversation (optional, one prospect only)</summary>
        <p className="mt-2 text-sm text-zinc-600">Up to 3 short answers this person gave you in a DM or call. The report uses them alongside their public page.</p>
        <div className="mt-3 space-y-2">
          {notes.map((note, index) => (
            <input
              key={index}
              className={INPUT}
              value={note}
              maxLength={500}
              onChange={(e) => setNotes((current) => current.map((n, i) => (i === index ? e.target.value : n)))}
              placeholder={`Answer ${index + 1}, e.g. "I work 60-hour weeks and travel twice a month"`}
            />
          ))}
        </div>
      </details>
      <button className={`${BUTTON} mt-4`} disabled={busy || !links.trim()} onClick={build}>
        {busy ? "Starting..." : "Build reports"}
      </button>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {results.length > 0 && (
        <ul className="mt-5 space-y-2 text-sm">
          {results.map((r) => (
            <li key={r.input} className="rounded-lg border border-zinc-200 bg-white p-3">
              <p className="font-mono text-xs text-zinc-500">{r.input}</p>
              {r.link ? (
                <p className="mt-1">
                  Building. Link: <CopyText value={r.link} />
                </p>
              ) : (
                <p className="mt-1 text-red-700">{r.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CopyText({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <a className="break-all font-mono text-xs underline" href={value} target="_blank" rel="noreferrer">
        {value}
      </a>
      <button
        className={GHOST}
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

interface ReportRow {
  id: string;
  link: string;
  mode: string;
  status: string;
  phase: string;
  source: string;
  url: string;
  name: string | null;
  notes: number;
  createdAt: string;
  viewedAt: string | null;
  ctaClickedAt: string | null;
  error: string | null;
  costs: { apifyUsd: number | null; aiUsd: number | null; seconds: number | null } | null;
}

const MODE_LABEL: Record<string, string> = { sent: "Sent link", live: "Live page", public: "Public (opt-in)", prefilled: "Pre-filled link" };

function ReportsTab({ api }: { api: Api }) {
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await api<{ reports?: ReportRow[] }>("/api/admin/reports");
      if (!cancelled && res.ok) setRows(res.data.reports ?? []);
    };
    void load();
    const timer = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [api, version]);

  async function act(id: string, method: "POST" | "DELETE") {
    if (method === "DELETE" && !window.confirm("Delete this report? Its link stops working.")) return;
    await api(`/api/admin/reports/${id}`, { method, body: method === "POST" ? JSON.stringify({ action: "rebuild" }) : undefined });
    setVersion((v) => v + 1);
  }

  if (!rows) return <p className="text-sm text-zinc-600">Loading...</p>;
  if (rows.length === 0) return <p className="text-sm text-zinc-600">No reports yet.</p>;
  return (
    <section className="space-y-3">
      {rows.map((r) => (
        <article key={r.id} className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              {r.name ?? r.url}
              <span className="ml-2 rounded bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-600">{MODE_LABEL[r.mode] ?? r.mode}</span>
              {r.notes > 0 && <span className="ml-2 rounded bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-600">{r.notes} notes</span>}
            </p>
            <p className={r.status === "complete" ? "text-emerald-700" : r.status === "failed" ? "text-red-700" : "text-amber-700"}>
              {r.status === "complete" ? "Ready" : r.status === "failed" ? "Failed" : `Building (${r.phase})`}
            </p>
          </div>
          <p className="mt-1 break-all font-mono text-xs text-zinc-500">{r.url}</p>
          {r.error && <p className="mt-2 text-red-700">{r.error}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
            <span>Created {new Date(r.createdAt).toLocaleString()}</span>
            <span>{r.viewedAt ? `Opened ${new Date(r.viewedAt).toLocaleString()}` : "Not opened yet"}</span>
            {r.ctaClickedAt && <span className="font-semibold text-emerald-700">Clicked your button</span>}
            {r.costs && (r.costs.apifyUsd !== null || r.costs.aiUsd !== null) && (
              <span>
                Cost ${((r.costs.apifyUsd ?? 0) + (r.costs.aiUsd ?? 0)).toFixed(3)}
                {r.costs.seconds !== null && `, ${r.costs.seconds}s`}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {r.status === "complete" && <CopyText value={r.link} />}
            <button className={GHOST} onClick={() => act(r.id, "POST")} disabled={r.status === "processing"}>
              Rebuild
            </button>
            <button className={GHOST} onClick={() => act(r.id, "DELETE")}>
              Delete
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

function LinksTab({ api, configured, optIn }: { api: Api; configured: boolean; optIn: boolean }) {
  const [links, setLinks] = useState("");
  const [results, setResults] = useState<{ input: string; link?: string; error?: string }[]>([]);
  if (!configured) return <p className="text-sm text-zinc-600">Save your settings first (tab 1).</p>;
  async function make() {
    const res = await api<{ results?: typeof results }>("/api/admin/links", { method: "POST", body: JSON.stringify({ links: lines(links) }) });
    setResults(res.data.results ?? []);
  }
  return (
    <section>
      <h2 className="text-lg font-bold">Pre-filled links</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Paste prospect links (one per line) to get a link to your magnet with their page already filled in. Nothing is built or spent until they open it and click your button.
        {optIn && " These links skip the email opt-in, because you already know who they are."}
      </p>
      <textarea className={`${INPUT} mt-4 h-32 font-mono text-xs`} value={links} onChange={(e) => setLinks(e.target.value)} placeholder="One link per line" />
      <button className={`${BUTTON} mt-3`} disabled={!links.trim()} onClick={make}>
        Make links
      </button>
      {results.length > 0 && (
        <ul className="mt-5 space-y-2 text-sm">
          {results.map((r) => (
            <li key={r.input} className="rounded-lg border border-zinc-200 bg-white p-3">
              <p className="font-mono text-xs text-zinc-500">{r.input}</p>
              {r.link ? <CopyText value={r.link} /> : <p className="mt-1 text-red-700">{r.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface LeadRow {
  id: string;
  firstName: string;
  email: string;
  sourceUrl: string;
  createdAt: string;
  webhook: string;
}

function LeadsTab({ api }: { api: Api }) {
  const [rows, setRows] = useState<LeadRow[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void api<{ leads?: LeadRow[] }>("/api/admin/leads").then((res) => {
      if (!cancelled && res.ok) setRows(res.data.leads ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [api]);
  if (!rows) return <p className="text-sm text-zinc-600">Loading...</p>;
  if (rows.length === 0) return <p className="text-sm text-zinc-600">No opt-ins yet. Leads appear here when public mode is on (publicMode: optIn: true).</p>;
  return (
    <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Their link</th>
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Sent to CRM</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lead) => (
            <tr key={lead.id} className="border-t border-zinc-100">
              <td className="px-3 py-2">{lead.firstName}</td>
              <td className="px-3 py-2">{lead.email}</td>
              <td className="break-all px-3 py-2 font-mono text-xs">{lead.sourceUrl}</td>
              <td className="px-3 py-2">{new Date(lead.createdAt).toLocaleString()}</td>
              <td className="px-3 py-2">{lead.webhook === "sent" ? "Yes" : lead.webhook === "failed" ? "Failed" : "No webhook"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
