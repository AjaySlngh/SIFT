/**
 * Ledger: token spend per case and per stage.
 *
 * TODO: fetch GET /api/ledger?case=<id> and render a table grouped by stage.
 */
export default function LedgerPage() {
  return (
    <main className="flex-1 p-8">
      <h1 className="text-xl font-semibold">Ledger</h1>
      <p className="mt-2 text-sm text-gray-500">No spend data yet.</p>
    </main>
  );
}
