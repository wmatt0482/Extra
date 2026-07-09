// Todoist is extra's backend: tasks + labels + comments ARE the state machine.
// The morning-brief and draft-worker routines write this state; extra reads it
// and flips labels. See routines/README.md in the blender_mcp repo.
//
// Uses Todoist's unified v1 API (api.todoist.com/api/v1). REST v2 and Sync v9
// were retired (they now return 410). v1 paginates list responses as
// { results, next_cursor }; we normalize defensively in unwrap().

const API = "https://api.todoist.com/api/v1";

// What extra shows: the full body of the routine's work — every active
// email/meeting task — plus post ideas. The draft-pipeline labels
// (draftable/draft-me/draft-ready/draft-failed) sort a task into a section;
// an untagged email/meeting task is still shown (you can draft/act on any of
// them), so nothing the routine surfaces is ever hidden.
//   draftable    → routine says "a draft is feasible here" (a suggestion)
//   draft-me     → Matt's selection: "write this one" (extra sets this)
//   draft-ready  → draft posted as a task comment
//   draft-failed → drafting blocked; comment explains why
export const PIPELINE_FILTER =
  "@email | @meeting | @draftable | @draft-me | @draft-ready | @draft-failed | @thought-leadership | @action-for-matt";

export interface TodoistTask {
  id: string;
  content: string;
  description: string;
  labels: string[];
  created_at: string;
  url: string;
  dueDate: string | null;
}

export interface TodoistComment {
  id: string;
  content: string;
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
  /** Routine flagged this as a good draft candidate (`draftable`). */
  suggested: boolean;
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
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** v1 list responses are { results|items, next_cursor }; tolerate bare arrays. */
function unwrap(json: unknown): { items: any[]; cursor: string | null } {
  if (Array.isArray(json)) return { items: json, cursor: null };
  const o = json as any;
  return {
    items: o?.results ?? o?.items ?? [],
    cursor: o?.next_cursor ?? null,
  };
}

/** Field names drifted between API generations — normalize what we use. */
function normalizeTask(t: any): TodoistTask {
  return {
    id: String(t.id),
    content: t.content ?? "",
    description: t.description ?? "",
    labels: t.labels ?? [],
    created_at: t.added_at ?? t.created_at ?? "",
    url: t.url ?? `https://app.todoist.com/app/task/${t.id}`,
    dueDate: t.due?.date?.slice(0, 10) ?? null,
  };
}

async function todoistList(path: string, maxPages = 5): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const url = cursor
      ? `${path}${sep}cursor=${encodeURIComponent(cursor)}`
      : path;
    const { items, cursor: next } = unwrap(await todoist<unknown>(url));
    all.push(...items);
    if (!next) break;
    cursor = next;
  }
  return all;
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
  // Pipeline state wins first, most-actionable to least.
  if (has("thought-leadership")) return "posts";
  if (has("draft-ready")) return "ready";
  if (has("draft-failed")) return "failed";
  if (has("draft-me")) return "queued";
  if (has("action-for-matt")) return "decide";
  // Everything else that's real work — tagged draftable or just a plain
  // email/meeting task the routine pushed — is pickable: you can draft or
  // act on it. This is why nothing stays hidden.
  if (has("draftable") || has("email") || has("meeting")) return "pick";
  return null;
}

/** The routine explicitly suggested this one as a good draft candidate. */
export function isSuggested(labels: string[]): boolean {
  return labels.includes("draftable");
}

function ageDays(createdAt: string): number {
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export async function getTask(id: string): Promise<TodoistTask> {
  return normalizeTask(await todoist<any>(`/tasks/${id}`));
}

export async function getComments(taskId: string): Promise<TodoistComment[]> {
  const items = await todoistList(`/comments?task_id=${taskId}&limit=100`);
  return items.map((c: any) => ({ id: String(c.id), content: c.content ?? "" }));
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
 * Completed-task history for metrics. Callers must tolerate failure —
 * metrics degrade gracefully rather than crash.
 */
export async function getCompletedHistory(days: number): Promise<CompletedItem[]> {
  const until = new Date();
  const since = new Date(until.getTime() - days * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 19) + "Z";
  const items = await todoistList(
    `/tasks/completed/by_completion_date?since=${encodeURIComponent(
      iso(since)
    )}&until=${encodeURIComponent(iso(until))}&limit=200`,
    3
  );
  return items.map((i: any) => ({
    content: i.content ?? i.item_object?.content ?? "",
    completed_at: i.completed_at ?? "",
    labels: i.labels ?? i.item_object?.labels ?? [],
  }));
}

export async function getPipeline(): Promise<PipelineTask[]> {
  const raw = (
    await todoistList(
      `/tasks/filter?query=${encodeURIComponent(PIPELINE_FILTER)}&limit=200`
    )
  ).map(normalizeTask);

  const today = new Date().toISOString().slice(0, 10);
  const tasks: PipelineTask[] = [];
  for (const t of raw) {
    const section = sectionFor(t.labels);
    if (!section) continue;
    // Snoozed by extra: hidden until the snooze due date arrives.
    if (t.labels.includes("snoozed") && t.dueDate && t.dueDate > today)
      continue;
    const item: PipelineTask = {
      id: t.id,
      title: t.content,
      labels: t.labels,
      createdAt: t.created_at,
      todoistUrl: t.url,
      meta: parseMeta(t.description),
      section,
      suggested: isSuggested(t.labels),
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
      // within a section, routine-suggested first, then oldest first
      Number(b.suggested) - Number(a.suggested) ||
      b.ageDays - a.ageDays
  );
}
