import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { BrandBar, Footer } from "@/components/BrandBar";
import { BuildingView } from "@/components/BuildingView";
import { ViewedPing } from "@/components/CtaButton";
import { ReportView } from "@/components/ReportView";
import { expireIfStale, getReportByLink, publicErrorMessage, reportPath, updateReport } from "@/lib/reports";
import { loadSettings } from "@/lib/settings-store";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await params;
  const loaded = await loadSettings();
  if (!loaded) notFound();
  const { settings } = loaded;
  const found = await getReportByLink(id, key, settings.limits.keepReportsDays);
  if (!found) notFound();
  const record = await expireIfStale(found);
  const path = reportPath(record);

  let body: React.ReactNode;
  if (record.status === "complete" && record.result) {
    if (!record.viewedAt) {
      after(() => updateReport(record.id, (current) => (current.viewedAt ? undefined : { ...current, viewedAt: new Date().toISOString() })));
    }
    body = (
      <>
        <ViewedPing />
        <ReportView settings={settings} record={record} path={path} />
      </>
    );
  } else if (record.status === "failed") {
    body = (
      <main className="mx-auto w-full max-w-xl px-5 py-20 text-center">
        <h1 className="text-2xl font-bold">We hit a snag</h1>
        <p className="mt-4 text-mute">{publicErrorMessage(record.errorCode)}</p>
        <Link href="/" className="mt-8 inline-block rounded-lg bg-brand px-5 py-3 font-semibold text-brand-ink">
          Start again
        </Link>
      </main>
    );
  } else {
    body = <BuildingView apiPath={`/api${path}`} quiet={record.mode === "sent"} title={`Building your ${settings.name}`} loadingText={settings.wording.loadingText ?? null} />;
  }

  return (
    <>
      <BrandBar settings={settings} />
      {body}
      <Footer settings={settings} />
    </>
  );
}
