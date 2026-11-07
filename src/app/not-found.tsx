import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-24 text-center">
      <h1 className="text-2xl font-bold">Report not found</h1>
      <p className="mt-4 text-mute">This link is incomplete or the report has expired.</p>
      <Link href="/" className="mt-8 inline-block rounded-lg bg-brand px-5 py-3 font-semibold text-brand-ink">
        Go to the start page
      </Link>
    </main>
  );
}
