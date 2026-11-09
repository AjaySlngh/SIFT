"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface WorklistTask {
  id: string;
  kind: string | null;
  status: string;
  reason: string | null;
  assignee: string | null;
  documentId: string | null;
  caseId: string | null;
  caseBorrowerName: string | null;
  documentType: string | null;
}

const KIND_LABELS: Record<string, string> = {
  review_fields: "Review fields",
  reclassify: "Reclassify",
  spot_check: "Spot check",
  approve_letter: "Approve letter",
};

const KIND_STYLES: Record<string, string> = {
  review_fields: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  reclassify: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  spot_check: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  approve_letter: "border-violet-500/30 bg-violet-500/10 text-violet-400",
};

export default function WorklistPage() {
  const [tasks, setTasks] = useState<WorklistTask[] | null>(null);

  useEffect(() => {
    fetch("/api/worklist")
      .then((r) => r.json())
      .then(setTasks);
  }, []);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-8 py-12">
      <p className="label-eyebrow">Open tasks</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Worklist</h1>

      {!tasks ? (
        <p className="mt-6 text-sm" style={{ color: "var(--muted)" }}>
          Loading…
        </p>
      ) : tasks.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: "var(--muted)" }}>
          No open tasks.
        </p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="label-eyebrow border-b" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2 font-normal">Type</th>
                <th className="px-4 py-2 font-normal">Case</th>
                <th className="px-4 py-2 font-normal">Document</th>
                <th className="px-4 py-2 font-normal">Reason</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-3">
                    <Link href={`/tasks/${t.id}`}>
                      <span
                        className={`rounded border px-2 py-0.5 font-mono text-xs tracking-wide uppercase ${KIND_STYLES[t.kind ?? ""] ?? "border-zinc-500/30 bg-zinc-500/10 text-zinc-300"}`}
                      >
                        {KIND_LABELS[t.kind ?? ""] ?? t.kind}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {t.caseId ? (
                      <Link href={`/cases/${t.caseId}`} className="link-accent">
                        {t.caseBorrowerName || t.caseId.slice(0, 8)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--muted)" }}>
                    {t.documentType ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>
                    {t.reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
