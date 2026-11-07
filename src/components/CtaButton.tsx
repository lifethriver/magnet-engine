"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

export function CtaButton({ href, label, reportPath }: { href: string; label: string; reportPath: string }) {
  function onClick() {
    track("magnet_cta_click");
    // Best effort: records the click for the owner's admin list.
    void fetch(`/api${reportPath}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "cta" }), keepalive: true }).catch(() => undefined);
  }
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      onClick={onClick}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-block rounded-lg bg-accent px-6 py-3.5 text-base font-semibold text-accent-ink transition hover:opacity-90"
    >
      {label}
    </a>
  );
}

export function ViewedPing() {
  useEffect(() => {
    track("magnet_report_viewed");
  }, []);
  return null;
}
