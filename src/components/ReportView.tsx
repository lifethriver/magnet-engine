import type { ReportRecord } from "@/lib/reports";
import { fillName, type Settings } from "@/lib/settings";
import type { WrittenSection } from "@/lib/ai";
import { CtaButton } from "./CtaButton";

/**
 * Renders a finished report. Every piece of AI text is rendered as a React
 * text node, so it's escaped; nothing here uses dangerouslySetInnerHTML.
 * Fixed wording (headline, section titles and intros, closing, button) comes
 * from settings, never from the AI.
 */
export function ReportView({ settings, record, path }: { settings: Settings; record: ReportRecord; path: string }) {
  const result = record.result;
  if (!result) return null;
  const headline = fillName(settings.wording.reportHeadline, result.readerName);
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand">{settings.name}</p>
      <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{headline}</h1>
      {settings.wording.reportIntro && <p className="mt-4 text-lg text-mute">{settings.wording.reportIntro}</p>}
      {result.opening && <p className="mt-6 text-lg leading-relaxed">{result.opening}</p>}

      <div className="mt-10 space-y-8">
        {result.sections.map((section, index) => (
          <SectionBlock key={`${index}-${section.title}`} section={section} number={index + 1} />
        ))}
      </div>

      {settings.wording.closing && <p className="mt-10 text-lg leading-relaxed">{settings.wording.closing}</p>}

      <section className="mt-10 rounded-2xl bg-brand p-7 text-brand-ink print-hidden">
        {settings.cta.heading && <h2 className="text-2xl font-bold">{settings.cta.heading}</h2>}
        {settings.cta.text && <p className="mt-3 text-base leading-relaxed opacity-95">{settings.cta.text}</p>}
        <div className="mt-6">
          <CtaButton href={settings.cta.url} label={settings.cta.buttonText} reportPath={path} />
        </div>
      </section>
    </main>
  );
}

function SectionBlock({ section, number }: { section: WrittenSection; number: number }) {
  return (
    <section className="rounded-2xl border border-line p-6">
      <div className="flex items-baseline gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-soft text-sm font-bold text-brand">{number}</span>
        <h2 className="text-xl font-bold">{section.title}</h2>
      </div>
      {section.intro && <p className="mt-3 text-mute">{section.intro}</p>}
      {section.summary && <p className="mt-4 leading-relaxed">{section.summary}</p>}
      {section.items.length > 0 && (
        <ol className="mt-5 space-y-4">
          {section.items.map((item, index) => (
            <li key={index} className="rounded-xl bg-soft p-4">
              <div className="flex items-start justify-between gap-4">
                <p className="font-semibold">
                  {section.style === "steps" && <span className="text-brand">Step {index + 1}: </span>}
                  {item.title}
                </p>
                {section.style === "scores" && item.score !== null && (
                  <span className="shrink-0 rounded-full bg-brand px-2.5 py-0.5 text-sm font-bold text-brand-ink">{item.score}/10</span>
                )}
              </div>
              {section.style === "scores" && item.score !== null && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${item.score * 10}%` }} />
                </div>
              )}
              {item.detail && <p className="mt-2 leading-relaxed">{item.detail}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
