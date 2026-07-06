// Todoist is extra's backend: tasks + labels + comments ARE the state machine.
// The morning-brief and draft-worker routines write this state; extra reads it
// and flips labels. See routines/README.md in the blender_mcp repo.

const API = "https://api.todoist.com/rest/v2";

// The draft pipeline, as written by the routines:
//   draftable    → routine says "a draft is feasible here"
//   draft-me     → Matt's selection: "write this one" (extra sets this)
//   draft-ready  → draft posted as a task comment
//   draft-failed → drafting blocked; comment explains why
export const PIPELINE_FILTER =
  "@draftable | @draft-me | @draft-ready | @draft-failed | @thought-leadership | @action-for-matt";

export interface TodoistTask {
  id: string;
  content: string;
  description: string;
  labels: string[];
  priority: number;
  created_at: string;
  url: string;
  due?: { date: string } | null;
}

export interface TodoistComment {
  id: string;
  task_id: string;
  content: string;
  posted_at: string;
}

export interface TaskMeta {
  from?: string;
  to?: string;
  subject?: string;
  meeting?: string;
  outlookLink?: string;
  messageId?: string;
  granolaId?: string;
}

export type Section =
  | "ready"
  | "pick"
  | "queued"
  | "failed"
  | "posts"
  | "decide";

export interface PipelineTask {
  id: string;
  title: string;
  labels: string[];
  createdAt: string;
  todoistUrl: string;
  meta: TaskMeta;
  section: Section;
  /** Latest ✏️/✉️/⏰ draft comment (ready/failed) or the post body (thought-leadership). */
  draft?: string;
  /** True when the latest draft is Matt's edited version (✏️). */
  edited?: boolean;
  ageDays: number;
}

function token(): string {
  const t = process.env.TODOIST_API_TOKEN;
  if (!t) throw new Error("TODOIST_API_TOKEN is not set — see .env.example");
  return t;
}

async function todoist<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Todoist ${init?.method ?? "GET"} ${path} → ${res.status}`);
  }
  // 204 on close/update endpoints
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function parseMeta(description: string): TaskMeta {
  const line = (prefix: string): string | undefined => {
    const m = description.match(new RegExp(`^${prefix}:\\s*(.+)$`, "m"));
    return m?.[1]?.trim();
  };
  const link = description.match(/\[Outlook\]\((https:\/\/[^)]+)\)/)?.[1];
  return {
    from: line("From"),
    to: line("To"),
    subject: line("Subject"),
    meeting: line("From meeting"),
    outlookLink: link,
    messageId: line("Message-ID"),
    granolaId: line("Granola ID"),
  };
}

/** The routines mark drafts ✉️/⏰; extra marks Matt's edits ✏️. */
export function isDraftComment(content: string): boolean {
  return (
    content.startsWith("✉️") ||
    content.startsWith("⏰") ||
    content.startsWith("✏️")
  );
}

function sectionFor(labels: string[]): Section | null {
  const has = (l: string) => labels.includes(l);
  if (has("thought-leadership")) return "posts";
  if (has("draft-ready")) return "ready";
  if (has("draft-failed")) return "failed";
  if (has("draft-me")) return "queued";
  if (has("draftable")) return "pick";
  if (has("action-for-matt")) return "decide";
  return null;
}

function ageDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
}

export async function getTask(id: string): Promise<TodoistTask> {
  return todoist<TodoistTask>(`/tasks/${id}`);
}

export async function getComments(taskId: string): Promise<TodoistComment[]> {
  return todoist<TodoistComment[]>(`/comments?task_id=${taskId}`);
}

export async function updateLabels(id: string, labels: string[]): Promise<void> {
  await todoist(`/tasks/${id}`, {
    method: "POST",
    body: JSON.stringify({ labels }),
  });
}

export async function updateTask(
  id: string,
  fields: { labels?: string[]; due_string?: string }
): Promise<void> {
  await todoist(`/tasks/${id}`, { method: "POST", body: JSON.stringify(fields) });
}

export async function postComment(taskId: string, content: string): Promise<void> {
  await todoist(`/comments`, {
    method: "POST",
    body: JSON.stringify({ task_id: taskId, content }),
  });
}

export async function closeTask(id: string): Promise<void> {
  await todoist(`/tasks/${id}/close`, { method: "POST" });
}

export interface CompletedItem {
  content: string;
  completed_at: string;
  labels: string[];
}

/**
 * Completed-task history via the Sync API (REST v2 has no completed
 * endpoint). Callers must tolerate failure — Todoist has been migrating
 * API surfaces, so metrics degrade gracefully rather than crash.
 */
export async function getCompletedHistory(days: number): Promise<CompletedItem[]> {
  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 19);
  const res = await fetch(
    `https://api.todoist.com/sync/v9/completed/get_all?since=${encodeURIComponent(
      since
    )}&limit=200&annotate_items=true`,
    { headers: { Authorization: `Bearer ${token()}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Sync completed/get_all → ${res.status}`);
  const json = (await res.json()) as {
    items: {
      content: string;
      completed_at: string;
      item_object?: { labels?: string[] };
    }[];
  };
  return (json.items ?? []).map((i) => ({
    content: i.content,
    completed_at: i.completed_at,
    labels: i.item_object?.labels ?? [],
  }));
}

export async function getPipeline(): Promise<PipelineTask[]> {
  const raw = await todoist<TodoistTask[]>(
    `/tasks?filter=${encodeURIComponent(PIPELINE_FILTER)}`
  );

  const today = new Date().toISOString().slice(0, 10);
  const tasks: PipelineTask[] = [];
  for (const t of raw) {
    const section = sectionFor(t.labels);
    if (!section) continue;
    // Snoozed by extra: hidden until the snooze due date arrives.
    if (t.labels.includes("snoozed") && t.due?.date && t.due.date > today)
      continue;
    const item: PipelineTask = {
      id: t.id,
      title: t.content,
      labels: t.labels,
      createdAt: t.created_at,
      todoistUrl: t.url,
      meta: parseMeta(t.description),
      section,
      ageDays: ageDays(t.created_at),
    };
    if (section === "posts") {
      // The post draft lives in the description, above the "---" divider.
      item.draft = t.description.split("\n---\n")[0]?.trim();
    }
    tasks.push(item);
  }

  // Drafts live in comments; only fetch for the sections that need them.
  await Promise.all(
    tasks
      .filter((t) => t.section === "ready" || t.section === "failed")
      .map(async (t) => {
        const comments = await getComments(t.id);
        const draft = [...comments]
          .reverse()
          .find(
            (c) => t.section === "failed" || isDraftComment(c.content)
          );
        t.draft = draft?.content;
        t.edited = draft?.content.startsWith("✏️") ?? false;
      })
  );

  const order: Section[] = ["ready", "pick", "queued", "failed", "posts", "decide"];
  return tasks.sort(
    (a, b) =>
      order.indexOf(a.section) - order.indexOf(b.section) ||
      b.ageDays - a.ageDays
  );
}
