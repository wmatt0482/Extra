import { NextRequest, NextResponse } from "next/server";
import { getComments, getTask, isDraftComment, parseMeta } from "@/lib/todoist";
import { createReplyDraft, draftBodyFromComment, graphEnabled } from "@/lib/graph";

// Push a draft-ready task's draft into the real Outlook Drafts folder.
export async function POST(req: NextRequest) {
  if (!graphEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Graph not configured — see docs/GRAPH_SETUP.md" },
      { status: 501 }
    );
  }
  const { taskId } = (await req.json()) as { taskId: string };
  try {
    const task = await getTask(taskId);
    const meta = parseMeta(task.description);
    if (!meta.messageId) {
      throw new Error("Task has no Message-ID — only email tasks can be placed in Drafts");
    }
    const comments = await getComments(taskId);
    const draft = [...comments].reverse().find((c) => isDraftComment(c.content));
    if (!draft) throw new Error("No draft comment on this task yet");

    const webLink = await createReplyDraft(
      meta.messageId,
      draftBodyFromComment(draft.content)
    );
    return NextResponse.json({ ok: true, webLink });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
