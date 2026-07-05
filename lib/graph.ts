// Microsoft Graph integration: place a drafted reply into the real Outlook
// Drafts folder, correctly threaded, ready to review-and-send on any device.
// Optional — enabled only when MS_* env vars are set. See docs/GRAPH_SETUP.md.

const GRAPH = "https://graph.microsoft.com/v1.0";

export function graphEnabled(): boolean {
  return Boolean(
    process.env.MS_TENANT_ID &&
      process.env.MS_CLIENT_ID &&
      process.env.MS_REFRESH_TOKEN
  );
}

async function accessToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MS_CLIENT_ID!,
        grant_type: "refresh_token",
        refresh_token: process.env.MS_REFRESH_TOKEN!,
        scope: "https://graph.microsoft.com/Mail.ReadWrite offline_access",
      }),
    }
  );
  if (!res.ok) throw new Error(`Graph token exchange failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

async function graph<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(
      `Graph ${init?.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`
    );
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/**
 * Create a reply draft in the Outlook Drafts folder.
 *
 * @param internetMessageId RFC Message-ID of the email being replied to
 *   (from the Todoist task description), including angle brackets.
 * @param body Plain-text draft body (the part below "---" in the comment).
 * @returns webLink of the created draft.
 */
export async function createReplyDraft(
  internetMessageId: string,
  body: string
): Promise<string> {
  const token = await accessToken();

  // Graph needs its own message id; look it up by internetMessageId.
  const escaped = internetMessageId.replace(/'/g, "''");
  const found = await graph<{ value: { id: string }[] }>(
    token,
    `/me/messages?$filter=internetMessageId eq '${encodeURIComponent(escaped)}'&$select=id&$top=1`
  );
  const messageId = found.value[0]?.id;
  if (!messageId) {
    throw new Error("Source email not found in mailbox for that Message-ID");
  }

  // createReply gives us a threaded draft with recipients/subject prefilled …
  const draft = await graph<{ id: string; webLink: string; body: { content: string } }>(
    token,
    `/me/messages/${messageId}/createReply`,
    { method: "POST", body: JSON.stringify({}) }
  );

  // … then we prepend the drafted text above the quoted thread.
  const html = body
    .split("\n")
    .map((l) => (l.trim() === "" ? "<br>" : `<p>${escapeHtml(l)}</p>`))
    .join("");
  await graph(token, `/me/messages/${draft.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      body: { contentType: "html", content: html + (draft.body?.content ?? "") },
    }),
  });

  return draft.webLink;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Strip the routine's comment header (everything through the "---" line). */
export function draftBodyFromComment(comment: string): string {
  const idx = comment.indexOf("\n---\n");
  return idx === -1 ? comment : comment.slice(idx + 5).trim();
}
