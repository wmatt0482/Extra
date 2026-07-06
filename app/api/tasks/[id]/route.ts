import { NextRequest, NextResponse } from "next/server";
import { closeTask, getTask, updateLabels, updateTask } from "@/lib/todoist";

type Action =
  | "queue"
  | "cancel"
  | "redraft"
  | "complete"
  | "snooze-day"
  | "snooze-week";

// Label transitions extra is allowed to make. Everything else in Todoist
// belongs to the routines; this app only flips the selection labels.
function nextLabels(labels: string[], action: Action): string[] | null {
  const set = new Set(labels);
  switch (action) {
    case "queue": // pick → queued ("draft this one")
      set.add("draft-me");
      return [...set];
    case "cancel": // queued → pick
      set.delete("draft-me");
      return [...set];
    case "redraft": // ready/failed → queued (fresh draft wanted)
      set.delete("draft-ready");
      set.delete("draft-failed");
      set.add("draft-me");
      return [...set];
    default:
      return null; // complete/snooze handled below
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { action } = (await req.json()) as { action: Action };
  try {
    if (action === "complete") {
      await closeTask(params.id);
    } else if (action === "snooze-day" || action === "snooze-week") {
      // Snooze = hide from extra until the due date arrives; Todoist's own
      // Today view then resurfaces it natively too.
      const task = await getTask(params.id);
      const labels = [...new Set([...task.labels, "snoozed"])];
      await updateTask(params.id, {
        labels,
        due_string: action === "snooze-day" ? "tomorrow" : "next monday",
      });
    } else {
      const task = await getTask(params.id);
      const labels = nextLabels(task.labels, action);
      if (labels) await updateLabels(params.id, labels);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
