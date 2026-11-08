"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useActor } from "./actor-context";

interface SiftCase {
  id: string;
  borrowerName: string | null;
  loanNumber: string | null;
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-gray-100 text-gray-700",
  in_review: "bg-amber-100 text-amber-800",
  incomplete: "bg-orange-100 text-orange-800",
  complete: "bg-green-100 text-green-800",
};

export default function HomePage() {
  const { actorId } = useActor();
  const [cases, setCases] = useState<SiftCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [borrowerName, setBorrowerName] = useState("");
  const [loanNumber, setLoanNumber] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadCases() {
    fetch("/api/cases")
      .then((r) => r.json())
      .then(setCases)
      .finally(() => setLoading(false));
  }

  useEffect(loadCases, []);

  async function createCase(e: React.FormEvent) {
    e.preventDefault();
    if (!actorId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ borrowerName, loanNumber, actorId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `request failed (${res.status})`);
      }
      setBorrowerName("");
      setLoanNumber("");
      loadCases();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold">sift</h1>
        <p className="mt-1 text-sm text-gray-500">
          Borrower assistance packet intake: split, classify, extract, score, route.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-medium">New case</h2>
        <form onSubmit={createCase} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="borrowerName" className="text-xs text-gray-500">
              Borrower name
            </label>
            <input
              id="borrowerName"
              className="rounded border border-gray-300 px-2 py-1 text-sm"
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="loanNumber" className="text-xs text-gray-500">
              Loan number
            </label>
            <input
              id="loanNumber"
              className="rounded border border-gray-300 px-2 py-1 text-sm"
              value={loanNumber}
              onChange={(e) => setLoanNumber(e.target.value)}
              placeholder="L-0001"
            />
          </div>
          <button
            type="submit"
            disabled={creating || !actorId}
            className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create case"}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      <section>
        <h2 className="text-lg font-medium">Cases</h2>
        {loading ? (
          <p className="mt-2 text-sm text-gray-500">Loading…</p>
        ) : cases.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No cases yet — create one above.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="pb-2">Borrower</th>
                <th className="pb-2">Loan #</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="py-2">
                    <Link href={`/cases/${c.id}`} className="underline">
                      {c.borrowerName || "(unnamed)"}
                    </Link>
                  </td>
                  <td className="py-2">{c.loanNumber || "—"}</td>
                  <td className="py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[c.status] ?? "bg-gray-100"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2 text-gray-500">{new Date(c.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
