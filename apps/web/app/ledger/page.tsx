"use client";

import { useEffect, useState } from "react";

interface LedgerRow {
  id: number;
  caseId: string | null;
  stage: string | null;
  model: string | null;
  inputTokens: number | null;
  cachedTokens: number | null;
  outputTokens: number | null;
  usd: string | null;
  at: string;
}

interface SiftCase {
  id: string;
  borrowerName: string | null;
}

interface LedgerResponse {
  rows: LedgerRow[];
  totalUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export default function LedgerPage() {
  const [cases, setCases] = useState<SiftCase[]>([]);
  const [caseId, setCaseId] = useState("");
  const [data, setData] = useState<LedgerResponse | null>(null);

  useEffect(() => {
    fetch("/api/cases")
      .then((r) => r.json())
      .then(setCases);
  }, []);

  useEffect(() => {
    const url = caseId ? `/api/ledger?case=${caseId}` : "/api/ledger";
    fetch(url)
      .then((r) => r.json())
      .then(setData);
  }, [caseId]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-8 py-12">
      <div className="flex items-start justify-between">
        <div>
          <p className="label-eyebrow">Token spend</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Ledger</h1>
        </div>
        <select
          className="input font-mono text-xs"
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
        >
          <option value="">All cases</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.borrowerName || c.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </div>

      {!data ? (
        <p className="mt-6 text-sm" style={{ color: "var(--muted)" }}>
          Loading…
        </p>
      ) : data.rows.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: "var(--muted)" }}>
          No spend data yet.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="card">
              <p className="label-eyebrow">Total spend</p>
              <p className="mt-2 font-mono text-xl" style={{ color: "var(--accent-hover)" }}>
                ${data.totalUsd.toFixed(4)}
              </p>
            </div>
            <div className="card">
              <p className="label-eyebrow">Input tokens</p>
              <p className="mt-2 font-mono text-xl">{data.totalInputTokens.toLocaleString()}</p>
            </div>
            <div className="card">
              <p className="label-eyebrow">Output tokens</p>
              <p className="mt-2 font-mono text-xl">{data.totalOutputTokens.toLocaleString()}</p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="label-eyebrow border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="px-4 py-2 font-normal">Stage</th>
                  <th className="px-4 py-2 font-normal">Model</th>
                  <th className="px-4 py-2 font-normal">Input</th>
                  <th className="px-4 py-2 font-normal">Output</th>
                  <th className="px-4 py-2 font-normal">USD</th>
                  <th className="px-4 py-2 font-normal">When</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-2.5 font-mono text-xs tracking-wide uppercase" style={{ color: "var(--muted)" }}>
                      {r.stage}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.model}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.inputTokens}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.outputTokens}</td>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--accent-hover)" }}>
                      ${Number(r.usd ?? 0).toFixed(5)}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }}>
                      {new Date(r.at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
