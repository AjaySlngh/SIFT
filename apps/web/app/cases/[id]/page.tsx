/**
 * Case view: the packet's documents with status chips, a completeness
 * checklist against each template's required_per_packet, live stage
 * progress, and a tab for the audit trail.
 *
 * TODO: fetch GET /api/cases/:id, subscribe to GET /api/cases/:id/events
 * for live stage ticks, fetch GET /api/audit?entity=case:<id> for the
 * audit tab.
 */
export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="flex-1 p-8">
      <h1 className="text-xl font-semibold">Case {id}</h1>
      <p className="mt-2 text-sm text-gray-500">Not loaded yet.</p>
    </main>
  );
}
