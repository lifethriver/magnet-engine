/** Browser-side events for GTM (dataLayer) and the Meta Pixel. Never sends URLs, names or emails. */
type Fbq = (...args: unknown[]) => void;

export function track(event: "magnet_report_started" | "magnet_report_viewed" | "magnet_cta_click" | "magnet_lead"): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: unknown[]; fbq?: Fbq };
  w.dataLayer?.push({ event });
  if (!w.fbq) return;
  if (event === "magnet_lead") w.fbq("track", "Lead");
  else if (event === "magnet_cta_click") w.fbq("trackCustom", "MagnetButtonClick");
  else if (event === "magnet_report_viewed") w.fbq("trackCustom", "MagnetReportViewed");
}
