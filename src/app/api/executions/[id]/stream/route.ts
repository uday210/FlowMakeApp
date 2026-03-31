import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";

const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { admin, orgId } = ctx;
  const encoder = new TextEncoder();
  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();

      // Track how many log entries we've already sent
      let sentLogCount = 0;

      const send = (data: string) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(data));
          } catch {
            isClosed = true;
          }
        }
      };

      const done = () => {
        if (!isClosed) {
          isClosed = true;
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      };

      while (!isClosed) {
        // Check for timeout
        if (Date.now() - startTime > TIMEOUT_MS) {
          send(`event: done\ndata: ${JSON.stringify({ status: "timeout" })}\n\n`);
          done();
          break;
        }

        try {
          const { data: execution } = await admin
            .from("executions")
            .select("status, logs, workflow_id, workflows!inner(org_id)")
            .eq("id", id)
            .eq("workflows.org_id", orgId)
            .single();

          if (!execution) {
            send(`event: done\ndata: ${JSON.stringify({ status: "not_found" })}\n\n`);
            done();
            break;
          }

          // Stream any new log entries
          const logs: unknown[] = Array.isArray(execution.logs) ? execution.logs : [];
          for (let i = sentLogCount; i < logs.length; i++) {
            send(`data: ${JSON.stringify(logs[i])}\n\n`);
          }
          sentLogCount = logs.length;

          // Check if execution is complete
          const status = execution.status as string;
          if (status === "success" || status === "failed") {
            send(`event: done\ndata: ${JSON.stringify({ status })}\n\n`);
            done();
            break;
          }
        } catch {
          // Supabase error — try again next poll
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    },
    cancel() {
      isClosed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
