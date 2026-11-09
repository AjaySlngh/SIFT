"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useActor } from "../../actor-context";

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

interface Document {
  id: string;
  pageStart: number | null;
  pageEnd: number | null;
  docType: string | null;
  classConfidence: string | null;
  score: string | null;
  status: string;
  fields: Field[];
}

interface Package {
  id: string;
  storageKey: string;
  sha256: string;
  pageCount: number | null;
  documents: Document[];
}

interface CaseDetail {
  id: string;
  borrowerName: string | null;
  loanNumber: string | null;
  status: string;
  createdAt: string;
  packages: Package[];
}

interface AuditEvent {
  id: number;
  at: string;
  actor: string;
  action: string;
  entity: string;
  before: unknown;
  after: unknown;
  model: string | null;
}

const DOC_STATUS_STYLES: Record<string, string> = {
  pending: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  accepted: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  needs_review: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  rejected: "border-red-500/30 bg-red-500/10 text-red-400",
};

const CASE_STATUS_STYLES: Record<string, string> = {
  open: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  in_review: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  incomplete: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  complete: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
};

export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { actorId } = useActor();
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [tab, setTab] = useState<"documents" | "audit">("documents");
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function load() {
    fetch(`/api/cases/${id}`)
      .then((r) => r.json())
      .then(setCaseData);
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      // Poll while there's still work in flight; cheap enough for a demo.
      load();
    }, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (tab !== "audit") return;
    fetch(`/api/audit?caseId=${id}`)
      .then((r) => r.json())
      .then(setAuditEvents);
  }, [tab, id]);

  async function uploadPackage(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !actorId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("actorId", actorId);
      const res = await fetch(`/api/cases/${id}/packages`, { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `request failed (${res.status})`);
      }
      setFile(null);
      load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  if (!caseData) {
    return (
      <main className="flex-1 px-8 py-12">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Loading…
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-8 py-12">
      <div className="flex items-start justify-between">
        <div>
          <p className="label-eyebrow">
            Case · <span className="font-mono">{caseData.id.slice(0, 8)}</span>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {caseData.borrowerName || "(unnamed)"}
          </h1>
          <div className="mt-2 flex items-center gap-3 text-sm" style={{ color: "var(--muted)" }}>
            <span className="font-mono">{caseData.loanNumber || "—"}</span>
            <span
              className={`rounded border px-2 py-0.5 font-mono text-xs tracking-wide uppercase ${CASE_STATUS_STYLES[caseData.status] ?? "border-zinc-500/30 bg-zinc-500/10 text-zinc-300"}`}
            >
              {caseData.status}
            </span>
          </div>
        </div>
        <Link href="/" className="link-accent text-sm">
          ← All cases
        </Link>
      </div>

      <section className="card mt-8">
        <p className="label-eyebrow">Upload a packet</p>
        <form onSubmit={uploadPackage} className="mt-3 flex items-center gap-3">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="font-mono text-xs"
            style={{ color: "var(--muted)" }}
          />
          <button type="submit" disabled={!file || uploading || !actorId} className="btn-primary">
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
        {uploadError && (
          <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>
            {uploadError}
          </p>
        )}
      </section>

      <div className="mt-8 flex gap-6 border-b" style={{ borderColor: "var(--border)" }}>
        <button
          className="-mb-px border-b-2 pb-2 font-mono text-xs tracking-widest uppercase transition"
          style={{
            borderColor: tab === "documents" ? "var(--accent)" : "transparent",
            color: tab === "documents" ? "var(--foreground)" : "var(--muted)",
          }}
          onClick={() => setTab("documents")}
        >
          Documents
        </button>
        <button
          className="-mb-px border-b-2 pb-2 font-mono text-xs tracking-widest uppercase transition"
          style={{
            borderColor: tab === "audit" ? "var(--accent)" : "transparent",
            color: tab === "audit" ? "var(--foreground)" : "var(--muted)",
          }}
          onClick={() => setTab("audit")}
        >
          Audit trail
        </button>
      </div>

      {tab === "documents" ? (
        <div className="mt-6 flex flex-col gap-8">
          {caseData.packages.length === 0 && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No packets uploaded yet.
            </p>
          )}
          {caseData.packages.map((pkg) => (
            <div key={pkg.id}>
              <p className="label-eyebrow">
                Packet {pkg.sha256.slice(0, 12)}… · {pkg.pageCount ?? "?"} pages
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {pkg.documents.length === 0 && (
                  <p className="card text-sm" style={{ color: "var(--muted)" }}>
                    Splitting…
                  </p>
                )}
                {pkg.documents.map((doc) => (
                  <DocumentRow key={doc.id} doc={doc} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {auditEvents.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No audit events yet.
            </p>
          ) : (
            auditEvents.map((ev) => (
              <div key={ev.id} className="card py-3">
                <div className="flex justify-between font-mono text-xs" style={{ color: "var(--muted)" }}>
                  <span className="tracking-wide uppercase">{ev.action}</span>
                  <span>{new Date(ev.at).toLocaleString()}</span>
                </div>
                <p className="mt-1 font-mono text-sm">{ev.entity}</p>
                {ev.model && (
                  <p className="mt-1 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
                    model: {ev.model}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </main>
  );
}

const STATUS_BORDER: Record<string, string> = {
  pending: "rgba(255,255,255,0.09)",
  accepted: "rgba(63,185,80,0.35)",
  needs_review: "rgba(210,153,34,0.4)",
  rejected: "rgba(229,72,77,0.4)",
};

function DocumentRow({ doc }: { doc: Document }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="card py-3"
      style={{ borderColor: STATUS_BORDER[doc.status] ?? "var(--border)" }}
    >
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen((v) => !v)}>
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-sm">{doc.docType ?? "(unclassified)"}</span>
          <span className="font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
            pages {doc.pageStart}–{doc.pageEnd}
          </span>
        </span>
        <span className="flex items-center gap-3">
          {doc.score && (
            <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>
              score {Number(doc.score).toFixed(2)}
            </span>
          )}
          <span
            className={`rounded border px-2 py-0.5 font-mono text-xs tracking-wide uppercase ${DOC_STATUS_STYLES[doc.status] ?? "border-zinc-500/30 bg-zinc-500/10 text-zinc-300"}`}
          >
            {doc.status}
          </span>
        </span>
      </button>
      {open && (
        <table className="mt-4 w-full text-left text-xs">
          <thead>
            <tr className="label-eyebrow">
              <th className="pb-2 font-normal">Field</th>
              <th className="pb-2 font-normal">Value</th>
              <th className="pb-2 font-normal">Confidence</th>
              <th className="pb-2 font-normal">Score</th>
              <th className="pb-2 font-normal">Failed checks</th>
            </tr>
          </thead>
          <tbody>
            {doc.fields.map((f) => (
              <tr key={f.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="py-2 font-mono">{f.name}</td>
                <td className="py-2">{String(f.value)}</td>
                <td className="py-2 font-mono">{f.modelConfidence ? Number(f.modelConfidence).toFixed(2) : "—"}</td>
                <td className="py-2 font-mono">{f.score ? Number(f.score).toFixed(2) : "—"}</td>
                <td className="py-2 font-mono" style={{ color: "var(--warning)" }}>
                  {f.failedChecks?.join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
