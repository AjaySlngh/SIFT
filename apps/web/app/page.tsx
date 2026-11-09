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

const STATUS_STYLES: Record<string, string> = {
  open: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  in_review: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  incomplete: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  complete: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
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
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-8 py-12">
      <div>
        <p className="label-eyebrow">Document intake &amp; decisioning</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
          Helps you find the right documents, and make the right decisions.
        </h1>
        <p className="mt-2 max-w-xl text-sm" style={{ color: "var(--muted)" }}>
          Split, classify, extract, and score borrower assistance packets — with every
          auto-accept and human correction written to an auditable ledger.
        </p>
      </div>

      <section className="card">
        <p className="label-eyebrow">New case</p>
        <form onSubmit={createCase} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="borrowerName" className="label-eyebrow">
              Borrower name
            </label>
            <input
              id="borrowerName"
              className="input"
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="loanNumber" className="label-eyebrow">
              Loan number
            </label>
            <input
              id="loanNumber"
              className="input font-mono"
              value={loanNumber}
              onChange={(e) => setLoanNumber(e.target.value)}
              placeholder="L-0001"
            />
          </div>
          <button type="submit" disabled={creating || !actorId} className="btn-primary">
            {creating ? "Creating…" : "Create case"}
          </button>
        </form>
        {error && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      </section>

      <section>
        <p className="label-eyebrow">Cases</p>
        {loading ? (
          <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
            Loading…
          </p>
        ) : cases.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
            No cases yet — create one above.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="label-eyebrow border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="px-4 py-2 font-normal">Borrower</th>
                  <th className="px-4 py-2 font-normal">Loan #</th>
                  <th className="px-4 py-2 font-normal">Status</th>
                  <th className="px-4 py-2 font-normal">Created</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b last:border-b-0"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-4 py-2.5">
                      <Link href={`/cases/${c.id}`} className="link-accent">
                        {c.borrowerName || "(unnamed)"}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--muted)" }}>
                      {c.loanNumber || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded border px-2 py-0.5 font-mono text-xs tracking-wide uppercase ${STATUS_STYLES[c.status] ?? "border-zinc-500/30 bg-zinc-500/10 text-zinc-300"}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }}>
                      {new Date(c.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
