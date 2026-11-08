"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { useActor } from "../../actor-context";

const DOC_TYPES = ["assistance_application", "hardship_letter", "pay_stub", "bank_statement", "other"];

interface Field {
  id: string;
  name: string;
  dataType: string;
  value: unknown;
  modelConfidence: string | null;
  score: string | null;
  failedChecks: string[] | null;
  sourcePage: number | null;
  evidence: string | null;
}

interface TaskDetail {
  id: string;
  kind: string | null;
  status: string;
  reason: string | null;
  caseId: string | null;
  documentId: string | null;
  case?: { id: string; borrowerName: string | null };
  document?: { id: string; docType: string | null; pageStart: number | null; pageEnd: number | null; status: string };
  fields: Field[];
}

export default function ReviewTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { actorId } = useActor();
  const router = useRouter();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [newDocType, setNewDocType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tasks/${id}`)
      .then((r) => r.json())
      .then((data: TaskDetail) => {
        setTask(data);
        setNewDocType(data.document?.docType ?? "");
      });
  }, [id]);

  async function resolve(body: Record<string, unknown>) {
    if (!actorId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId, ...body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `request failed (${res.status})`);
      }
      router.push("/worklist");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function approve() {
    const fieldEdits = Object.entries(edits)
      .filter(([, value]) => value !== undefined)
      .map(([fieldId, value]) => ({ fieldId, value, reason: reason || "reviewer correction" }));
    if (fieldEdits.length > 0 && !reason) {
      setError("a reason is required when editing a field value");
      return;
    }
    resolve({ action: fieldEdits.length > 0 ? "edit" : "approve", fieldEdits });
  }

  function reject() {
    resolve({ action: "reject", reason: reason || undefined });
  }

  function reclassify() {
    resolve({ action: "reclassify", newDocType });
  }

  if (!task) {
    return (
      <main className="flex-1 p-8">
        <p className="text-sm text-gray-500">Loading…</p>
      </main>
    );
  }

  if (task.status !== "open") {
    return (
      <main className="flex-1 p-8">
        <h1 className="text-xl font-semibold">Task {task.id.slice(0, 8)}</h1>
        <p className="mt-2 text-sm text-gray-500">Already {task.status}.</p>
      </main>
    );
  }

  if (task.kind === "approve_letter") {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 p-8">
        <h1 className="text-xl font-semibold">Approve missing-documents letter</h1>
        <p className="mt-1 text-sm text-gray-500">Case: {task.case?.borrowerName || task.caseId}</p>
        <pre className="mt-4 whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-4 text-sm">
          {task.reason}
        </pre>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button
            disabled={busy}
            onClick={() => resolve({ action: "approve" })}
            className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={busy}
            onClick={() => resolve({ action: "reject" })}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 gap-8 p-8">
      <div className="flex-1">
        <h1 className="text-xl font-semibold">
          {task.document?.docType ?? "(unclassified)"}{" "}
          <span className="text-sm font-normal text-gray-400">
            pages {task.document?.pageStart}–{task.document?.pageEnd}
          </span>
        </h1>
        <p className="mt-1 text-sm text-gray-500">{task.reason}</p>

        <div className="mt-6 flex flex-col gap-3">
          {task.fields.map((f) => {
            const weak = (f.score !== null && Number(f.score) < 0.85) || (f.failedChecks?.length ?? 0) > 0;
            return (
              <div
                key={f.id}
                className={`rounded border p-3 text-sm ${weak ? "border-amber-400 bg-amber-50" : "border-gray-200"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{f.name}</span>
                  <span className="text-xs text-gray-500">
                    conf {f.modelConfidence ? Number(f.modelConfidence).toFixed(2) : "—"} · score{" "}
                    {f.score ? Number(f.score).toFixed(2) : "—"}
                  </span>
                </div>
                <input
                  className="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  defaultValue={String(f.value ?? "")}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [f.id]: e.target.value }))}
                />
                {f.evidence && <p className="mt-1 text-xs text-gray-500">“{f.evidence}” (p.{f.sourcePage})</p>}
                {f.failedChecks && f.failedChecks.length > 0 && (
                  <p className="mt-1 text-xs text-amber-700">failed: {f.failedChecks.join(", ")}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <label htmlFor="reason" className="text-xs text-gray-500">
            Reason (required for edits/reject)
          </label>
          <input
            id="reason"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            disabled={busy}
            onClick={approve}
            className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={busy}
            onClick={reject}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Reject document
          </button>
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            value={newDocType}
            onChange={(e) => setNewDocType(e.target.value)}
          >
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            disabled={busy}
            onClick={reclassify}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Reclassify
          </button>
        </div>
      </div>
    </main>
  );
}
