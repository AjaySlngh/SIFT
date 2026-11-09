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
      <main className="flex-1 px-8 py-12">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Loading…
        </p>
      </main>
    );
  }

  if (task.status !== "open") {
    return (
      <main className="flex-1 px-8 py-12">
        <p className="label-eyebrow">Task · {task.id.slice(0, 8)}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Already {task.status}</h1>
      </main>
    );
  }

  if (task.kind === "approve_letter") {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-8 py-12">
        <p className="label-eyebrow">Approve letter</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Missing-documents letter</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Case: {task.case?.borrowerName || task.caseId}
        </p>
        <pre className="card mt-5 font-mono text-sm whitespace-pre-wrap">{task.reason}</pre>
        {error && (
          <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <button disabled={busy} onClick={() => resolve({ action: "approve" })} className="btn-primary">
            Approve
          </button>
          <button disabled={busy} onClick={() => resolve({ action: "reject" })} className="btn-secondary">
            Reject
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-8 py-12">
      <p className="label-eyebrow">
        {task.kind ? task.kind.replace(/_/g, " ") : "review"} · pages {task.document?.pageStart}–
        {task.document?.pageEnd}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {task.document?.docType ?? "(unclassified)"}
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        {task.reason}
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {task.fields.map((f) => {
          const weak = (f.score !== null && Number(f.score) < 0.85) || (f.failedChecks?.length ?? 0) > 0;
          return (
            <div
              key={f.id}
              className="card py-3"
              style={{ borderColor: weak ? "rgba(210,153,34,0.4)" : "var(--border)" }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{f.name}</span>
                <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                  conf {f.modelConfidence ? Number(f.modelConfidence).toFixed(2) : "—"} · score{" "}
                  {f.score ? Number(f.score).toFixed(2) : "—"}
                </span>
              </div>
              <input
                className="input mt-2 w-full"
                defaultValue={String(f.value ?? "")}
                onChange={(e) => setEdits((prev) => ({ ...prev, [f.id]: e.target.value }))}
              />
              {f.evidence && (
                <p className="mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  “{f.evidence}” (p.{f.sourcePage})
                </p>
              )}
              {f.failedChecks && f.failedChecks.length > 0 && (
                <p className="mt-1 font-mono text-xs" style={{ color: "var(--warning)" }}>
                  failed: {f.failedChecks.join(", ")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col gap-1">
        <label htmlFor="reason" className="label-eyebrow">
          Reason (required for edits/reject)
        </label>
        <input
          id="reason"
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {error && (
        <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button disabled={busy} onClick={approve} className="btn-primary">
          Approve
        </button>
        <button disabled={busy} onClick={reject} className="btn-secondary">
          Reject document
        </button>
        <select
          className="input font-mono text-xs"
          value={newDocType}
          onChange={(e) => setNewDocType(e.target.value)}
        >
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button disabled={busy} onClick={reclassify} className="btn-secondary">
          Reclassify
        </button>
      </div>
    </main>
  );
}
