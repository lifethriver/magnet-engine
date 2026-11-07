import { BrandBar, Footer } from "@/components/BrandBar";
import { StartForm } from "@/components/StartForm";
import { verifyLinkSignature } from "@/lib/secrets";
import { loadSettings } from "@/lib/settings-store";
import { normalizeSourceUrl, sourceExample } from "@/lib/source-urls";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.slice(0, 500) ?? "";
}

export default async function Home({ searchParams }: { searchParams: Search }) {
  let loaded = null;
  try {
    loaded = await loadSettings();
  } catch {
    loaded = null;
  }
  if (!loaded) return <NotSetUp />;
  const { settings } = loaded;
  const params = await searchParams;
  const initialUrl = one(params.url);
  const sig = one(params.sig) || null;

  // A valid signed link (made in /admin) skips the opt-in for that one URL.
  let signed = false;
  if (initialUrl && sig) {
    try {
      signed = await verifyLinkSignature(normalizeSourceUrl(settings.source.type, initialUrl), sig);
    } catch {
      signed = false;
    }
  }
  const optIn = settings.publicMode.optIn && !signed;

  return (
    <>
      <BrandBar settings={settings} />
      <main className="mx-auto w-full max-w-2xl px-5 py-12">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{settings.wording.headline}</h1>
        {settings.wording.subheadline && <p className="mt-4 text-lg text-mute">{settings.wording.subheadline}</p>}
        <StartForm
          source={settings.source.type}
          inputLabel={settings.wording.inputLabel}
          inputPlaceholder={settings.wording.inputPlaceholder ?? sourceExample(settings.source.type).replace(/^Enter (a|an) [^,]+, such as /, "").replace(/\.$/, "")}
          buttonText={settings.wording.buttonText}
          optIn={optIn}
          optInHeading={settings.publicMode.heading ?? null}
          optInButton={settings.publicMode.buttonText ?? null}
          consentText={settings.publicMode.consentText ?? null}
          initialUrl={initialUrl}
          sig={signed ? sig : null}
        />
      </main>
      <Footer settings={settings} />
    </>
  );
}

function NotSetUp() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-24 text-center">
      <h1 className="text-2xl font-bold">Almost there</h1>
      <p className="mt-4 text-mute">
        This magnet is installed but has no settings yet. If it&rsquo;s yours, open <a className="underline" href="/admin">/admin</a>, sign in with your admin password, and paste your settings block.
      </p>
    </main>
  );
}
