import type { Metadata } from "next";
import "./globals.css";
import { Pixels } from "@/components/Pixels";
import { brandStyle } from "@/lib/branding";
import { loadSettings } from "@/lib/settings-store";

export const dynamic = "force-dynamic";

async function safeSettings() {
  try {
    return (await loadSettings())?.settings ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await safeSettings();
  return {
    title: settings?.name ?? "Magnet Engine",
    description: settings?.wording.subheadline ?? settings?.wording.headline ?? "A free personalized report.",
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await safeSettings();
  return (
    // Brand variables sit on <html> because the theme colors in globals.css resolve there.
    <html lang="en" style={brandStyle(settings)}>
      <body className="min-h-screen flex flex-col">
        <Pixels tracking={settings?.tracking} />
        {children}
      </body>
    </html>
  );
}
