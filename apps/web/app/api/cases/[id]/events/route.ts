/**
 * GET /api/cases/:id/events — server-sent events for live stage updates.
 * TODO: subscribe to Postgres LISTEN/NOTIFY (or poll `jobs`/`documents`) for
 * this case and stream ticks as each stage completes.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(`event: connected\ndata: ${JSON.stringify({ caseId: id })}\n\n`);
      // TODO: push further events as stages complete, controller.close() when the case closes.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
