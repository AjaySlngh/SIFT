/**
 * Review task: the source page on the left (react-pdf, zoomed to
 * source_page, evidence text highlighted when the text layer allows it).
 * Fields on the right, each showing value, score, and failed checks.
 * Fields under the threshold get a colored border. Actions: approve, edit a
 * value (reason required), reclassify, or reject the document.
 *
 * TODO: fetch the task + document + fields, render react-pdf on the left,
 * the field list on the right, and POST /api/tasks/:id/resolve on action.
 */
export default async function ReviewTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="flex flex-1 p-8">
      <div className="flex-1">
        <h1 className="text-xl font-semibold">Task {id}</h1>
        <p className="mt-2 text-sm text-gray-500">Not loaded yet.</p>
      </div>
    </main>
  );
}
