import { NextRequest, NextResponse } from "next/server";
import { getComments, isDraftComment, postComment } from "@/lib/todoist";

// Save Matt's edited version of a draft as a new ✏️ comment. The edit
// becomes the latest draft (copy / To-Outlook use it), stays in Todoist as
// the audit trail, and the draft-worker routine studies original-vs-edited
// pairs to calibrate voice over time.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { body } = (await req.json()) as { body: string };
  if (!body?.trim()) {
    return NextResponse.json(
      { ok: false, error: "empty draft" },
      { status: 400 }
    );
  }
  try {
    // Carry the To/Subject header lines over from the previous draft so the
    // edited comment stands alone.
    const comments = await getComments(params.id);
    const prev = [...comments].reverse().find((c) => isDraftComment(c.content));
    const headerLines =
      prev?.content
        .split("\n---\n")[0]
        ?.split("\n")
        .filter((l) => l.startsWith("To:") || l.startsWith("Subject:")) ?? [];

    const content = [
      "✏️ EDITED DRAFT — Matt's version. Nothing has been sent.",
      ...headerLines,
      "---",
      body.trim(),
    ].join("\n");

    await postComment(params.id, content);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
