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
    <main className="mx-auto w-full max-w-4xl flex-1 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ledger</h1>
        <select
          className="rounded border border-gray-300 px-2 py-1 text-sm"
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
        <p className="mt-2 text-sm text-gray-500">Loading…</p>
      ) : data.rows.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No spend data yet.</p>
      ) : (
        <>
          <div className="mt-4 flex gap-6 text-sm">
            <span>
              Total: <strong>${data.totalUsd.toFixed(4)}</strong>
            </span>
            <span>Input tokens: {data.totalInputTokens.toLocaleString()}</span>
            <span>Output tokens: {data.totalOutputTokens.toLocaleString()}</span>
          </div>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="pb-2">Stage</th>
                <th className="pb-2">Model</th>
                <th className="pb-2">Input</th>
                <th className="pb-2">Output</th>
                <th className="pb-2">USD</th>
                <th className="pb-2">When</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="py-2">{r.stage}</td>
                  <td className="py-2">{r.model}</td>
                  <td className="py-2">{r.inputTokens}</td>
                  <td className="py-2">{r.outputTokens}</td>
                  <td className="py-2">${Number(r.usd ?? 0).toFixed(5)}</td>
                  <td className="py-2 text-gray-500">{new Date(r.at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
