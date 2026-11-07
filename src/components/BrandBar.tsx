/* eslint-disable @next/next/no-img-element -- the logo is an owner-supplied https URL on any host, so next/image's host allowlist can't know it */
import type { Settings } from "@/lib/settings";

export function BrandBar({ settings }: { settings: Settings }) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
        {settings.branding.logoUrl ? (
          <img src={settings.branding.logoUrl} alt={settings.name} className="h-9 w-auto max-w-[180px] object-contain" referrerPolicy="no-referrer" />
        ) : (
          <span className="text-lg font-bold text-brand">{settings.name}</span>
        )}
      </div>
    </header>
  );
}

export function Footer({ settings }: { settings: Settings }) {
  return (
    <footer className="mt-auto border-t border-line print-hidden">
      <div className="mx-auto max-w-3xl px-5 py-6 text-sm text-mute">
        {settings.footer.text && <p>{settings.footer.text}</p>}
        {settings.footer.privacyUrl && (
          <p className="mt-2">
            <a className="underline" href={settings.footer.privacyUrl} rel="noopener noreferrer" target="_blank">
              Privacy
            </a>
          </p>
        )}
      </div>
    </footer>
  );
}
