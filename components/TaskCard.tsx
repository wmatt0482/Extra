"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PipelineTask } from "@/lib/todoist";

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
    const body = task.draft.includes("\n---\n")
      ? task.draft.split("\n---\n").slice(1).join("\n---\n").trim()
      : task.draft;
    await navigator.clipboard.writeText(body);
    setNote("Copied ✓");
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

  return (
    <div className="card">
      <h3>
        {task.title}
        {task.ageDays > 5 && task.section !== "posts" && (
          <span className="tag age">{task.ageDays}d</span>
        )}
      </h3>
      {counterparty && <div className="meta">{counterparty}</div>}
      {task.draft && <pre>{task.draft}</pre>}
      <div className="actions">
        {task.section === "pick" && (
          <button className="primary" disabled={busy} onClick={() => act("queue")}>
            ✍️ Draft it
          </button>
        )}
        {task.section === "queued" && (
          <button disabled={busy} onClick={() => act("cancel")}>
            Cancel
          </button>
        )}
        {(task.section === "ready" || task.section === "posts") && task.draft && (
          <button className="primary" disabled={busy} onClick={copyDraft}>
            📋 Copy {task.section === "posts" ? "post" : "draft"}
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
          <button disabled={busy} onClick={() => act("complete")}>
            ✅ Done
          </button>
        )}
      </div>
      {note && <div className="meta" style={{ marginTop: "0.5rem" }}>{note}</div>}
    </div>
  );
}
