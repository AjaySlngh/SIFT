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

export default function WorklistPage() {
  const [tasks, setTasks] = useState<WorklistTask[] | null>(null);

  useEffect(() => {
    fetch("/api/worklist")
      .then((r) => r.json())
      .then(setTasks);
  }, []);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-8">
      <h1 className="text-xl font-semibold">Worklist</h1>
      {!tasks ? (
        <p className="mt-2 text-sm text-gray-500">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No open tasks.</p>
      ) : (
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-xs uppercase text-gray-500">
            <tr>
              <th className="pb-2">Type</th>
              <th className="pb-2">Case</th>
              <th className="pb-2">Document</th>
              <th className="pb-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-t border-gray-100">
                <td className="py-2">
                  <Link href={`/tasks/${t.id}`} className="underline">
                    {KIND_LABELS[t.kind ?? ""] ?? t.kind}
                  </Link>
                </td>
                <td className="py-2">
                  {t.caseId ? (
                    <Link href={`/cases/${t.caseId}`} className="underline">
                      {t.caseBorrowerName || t.caseId.slice(0, 8)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2">{t.documentType ?? "—"}</td>
                <td className="py-2 text-gray-600">{t.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
