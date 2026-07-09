"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PipelineTask } from "@/lib/todoist";

function draftBody(draft: string): string {
  return draft.includes("\n---\n")
    ? draft.split("\n---\n").slice(1).join("\n---\n").trim()
    : draft;
}

export default function TaskCard({
  task,
  graphEnabled,
}: {
  task: PipelineTask;
  graphEnabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  async function act(action: string) {
    setBusy(true);
    setNote(null);
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) setNote((await res.json()).error ?? "failed");
    setBusy(false);
    router.refresh();
  }

  async function copyDraft() {
    if (!task.draft) return;
    await navigator.clipboard.writeText(draftBody(task.draft));
    setNote("Copied ✓");
  }

  async function saveEdit() {
    setBusy(true);
    setNote(null);
    const res = await fetch(`/api/tasks/${task.id}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    if (res.ok) {
      setEditing(false);
      setNote("Saved ✓");
      router.refresh();
    } else {
      setNote((await res.json()).error ?? "failed");
    }
    setBusy(false);
  }

  async function toOutlookDrafts() {
    setBusy(true);
    setNote(null);
    const res = await fetch(`/api/outlook/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id }),
    });
    const json = await res.json();
    setNote(res.ok ? "In your Outlook Drafts ✓" : json.error ?? "failed");
    setBusy(false);
  }

  const counterparty =
    task.meta.to ?? task.meta.from ?? task.meta.meeting ?? null;
  const editable =
    (task.section === "ready" || task.section === "posts") && !!task.draft;

  return (
    <div className="card">
      <h3>
        {task.title}
        {task.suggested && task.section === "pick" && (
          <span className="tag suggested">suggested</span>
        )}
        {task.edited && <span className="tag edited">✏️ edited</span>}
        {task.ageDays > 5 && task.section !== "posts" && (
          <span className="tag age">{task.ageDays}d</span>
        )}
      </h3>
      {counterparty && <div className="meta">{counterparty}</div>}

      {editing ? (
        <textarea
          className="editor"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.max(6, text.split("\n").length + 1)}
          autoFocus
        />
      ) : (
        task.draft && <pre>{task.draft}</pre>
      )}

      <div className="actions">
        {editing ? (
          <>
            <button className="primary" disabled={busy} onClick={saveEdit}>
              💾 Save
            </button>
            <button disabled={busy} onClick={() => setEditing(false)}>
              Discard
            </button>
          </>
        ) : (
          <>
            {task.section === "pick" && (
              <button
                className="primary"
                disabled={busy}
                onClick={() => act("queue")}
              >
                ✍️ Draft it
              </button>
            )}
            {task.section === "queued" && (
              <button disabled={busy} onClick={() => act("cancel")}>
                Cancel
              </button>
            )}
            {editable && (
              <button className="primary" disabled={busy} onClick={copyDraft}>
                📋 Copy {task.section === "posts" ? "post" : "draft"}
              </button>
            )}
            {editable && (
              <button
                disabled={busy}
                onClick={() => {
                  setText(draftBody(task.draft!));
                  setEditing(true);
                }}
              >
                ✏️ Edit
              </button>
            )}
            {task.section === "ready" && graphEnabled && (
              <button className="good" disabled={busy} onClick={toOutlookDrafts}>
                📥 To Outlook Drafts
              </button>
            )}
            {(task.section === "ready" || task.section === "failed") && (
              <button className="warn" disabled={busy} onClick={() => act("redraft")}>
                🔁 Redraft
              </button>
            )}
            {task.meta.outlookLink && (
              <a className="btn" href={task.meta.outlookLink} target="_blank">
                Open email
              </a>
            )}
            {task.section !== "queued" && (
              <>
                <button disabled={busy} onClick={() => act("snooze-day")}>
                  😴 1d
                </button>
                <button disabled={busy} onClick={() => act("snooze-week")}>
                  😴 1w
                </button>
                <button disabled={busy} onClick={() => act("complete")}>
                  ✅ Done
                </button>
              </>
            )}
          </>
        )}
      </div>
      {note && <div className="meta" style={{ marginTop: "0.5rem" }}>{note}</div>}
    </div>
  );
}
