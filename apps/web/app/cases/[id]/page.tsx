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

const DOC_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  accepted: "bg-green-100 text-green-800",
  needs_review: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
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
      <main className="flex-1 p-8">
        <p className="text-sm text-gray-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{caseData.borrowerName || "(unnamed)"}</h1>
          <p className="text-sm text-gray-500">
            Loan {caseData.loanNumber || "—"} · <span className="uppercase">{caseData.status}</span>
          </p>
        </div>
        <Link href="/" className="text-sm underline">
          ← All cases
        </Link>
      </div>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-gray-700">Upload a packet</h2>
        <form onSubmit={uploadPackage} className="mt-2 flex items-center gap-3">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <button
            type="submit"
            disabled={!file || uploading || !actorId}
            className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
        {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
      </section>

      <div className="mt-8 flex gap-4 border-b border-gray-200 text-sm">
        <button
          className={`-mb-px border-b-2 pb-2 ${tab === "documents" ? "border-black font-medium" : "border-transparent text-gray-500"}`}
          onClick={() => setTab("documents")}
        >
          Documents
        </button>
        <button
          className={`-mb-px border-b-2 pb-2 ${tab === "audit" ? "border-black font-medium" : "border-transparent text-gray-500"}`}
          onClick={() => setTab("audit")}
        >
          Audit trail
        </button>
      </div>

      {tab === "documents" ? (
        <div className="mt-6 flex flex-col gap-6">
          {caseData.packages.length === 0 && (
            <p className="text-sm text-gray-500">No packets uploaded yet.</p>
          )}
          {caseData.packages.map((pkg) => (
            <div key={pkg.id}>
              <p className="text-xs text-gray-500">
                Packet {pkg.sha256.slice(0, 12)}… · {pkg.pageCount ?? "?"} pages
              </p>
              <div className="mt-2 flex flex-col divide-y divide-gray-100 rounded border border-gray-200">
                {pkg.documents.length === 0 && (
                  <p className="p-3 text-sm text-gray-500">Splitting…</p>
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
            <p className="text-sm text-gray-500">No audit events yet.</p>
          ) : (
            auditEvents.map((ev) => (
              <div key={ev.id} className="rounded border border-gray-100 p-3 text-sm">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{ev.action}</span>
                  <span>{new Date(ev.at).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-gray-700">{ev.entity}</p>
                {ev.model && <p className="mt-1 text-xs text-gray-400">model: {ev.model}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </main>
  );
}

function DocumentRow({ doc }: { doc: Document }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-3">
      <button className="flex w-full items-center justify-between text-left text-sm" onClick={() => setOpen((v) => !v)}>
        <span>
          {doc.docType ?? "(unclassified)"}{" "}
          <span className="text-gray-400">
            pages {doc.pageStart}–{doc.pageEnd}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {doc.score && <span className="text-xs text-gray-500">score {Number(doc.score).toFixed(2)}</span>}
          <span className={`rounded px-2 py-0.5 text-xs ${DOC_STATUS_COLORS[doc.status] ?? "bg-gray-100"}`}>
            {doc.status}
          </span>
        </span>
      </button>
      {open && (
        <table className="mt-3 w-full text-left text-xs">
          <thead className="text-gray-500">
            <tr>
              <th className="pb-1">Field</th>
              <th className="pb-1">Value</th>
              <th className="pb-1">Confidence</th>
              <th className="pb-1">Score</th>
              <th className="pb-1">Failed checks</th>
            </tr>
          </thead>
          <tbody>
            {doc.fields.map((f) => (
              <tr key={f.id} className="border-t border-gray-100">
                <td className="py-1">{f.name}</td>
                <td className="py-1">{String(f.value)}</td>
                <td className="py-1">{f.modelConfidence ? Number(f.modelConfidence).toFixed(2) : "—"}</td>
                <td className="py-1">{f.score ? Number(f.score).toFixed(2) : "—"}</td>
                <td className="py-1 text-amber-700">{f.failedChecks?.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
