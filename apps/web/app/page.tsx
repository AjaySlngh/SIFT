import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">sift</h1>
      <p className="max-w-md text-center text-sm text-gray-500">
        Borrower assistance packet intake: split, classify, extract, score, route.
      </p>
      <nav className="flex gap-4 text-sm underline">
        <Link href="/worklist">Worklist</Link>
        <Link href="/ledger">Ledger</Link>
      </nav>
    </main>
  );
}
