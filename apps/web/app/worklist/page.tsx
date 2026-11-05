/**
 * Worklist: a table of open tasks sorted by age, with columns for type,
 * case, reason ("ending_balance 0.62, name mismatch"), and assignee.
 * Keyboard shortcuts: j/k to move, enter to open.
 *
 * TODO: fetch GET /api/worklist?assignee=me, render rows, wire up j/k/enter.
 */
export default function WorklistPage() {
  return (
    <main className="flex-1 p-8">
      <h1 className="text-xl font-semibold">Worklist</h1>
      <p className="mt-2 text-sm text-gray-500">No tasks loaded yet.</p>
    </main>
  );
}
