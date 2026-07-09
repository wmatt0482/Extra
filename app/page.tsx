import Link from "next/link";
import TaskCard from "@/components/TaskCard";
import AutoRefresh from "@/components/AutoRefresh";
import { getPipeline, type PipelineTask, type Section } from "@/lib/todoist";
import { graphEnabled } from "@/lib/graph";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SECTIONS: { key: Section; title: string; empty: string }[] = [
  { key: "ready", title: "✍️ Ready to send", empty: "No drafts waiting on you." },
  { key: "pick", title: "🏷 Open items — tap Draft it on any", empty: "No open email or meeting items." },
  { key: "queued", title: "⏳ Drafting (next worker run)", empty: "Queue is empty." },
  { key: "failed", title: "⚠️ Needs your input", empty: "No failures." },
  { key: "posts", title: "💡 Post ideas", empty: "No post drafts this week." },
  { key: "decide", title: "🔍 Possibly handled — close or keep", empty: "Nothing flagged." },
];

export default async function Home() {
  let tasks: PipelineTask[];
  try {
    tasks = await getPipeline();
  } catch (e) {
    return (
      <main>
        <Header />
        <div className="error">
          <p>Can&apos;t reach Todoist.</p>
          <p className="meta">
            <code>{e instanceof Error ? e.message : "unknown error"}</code>
          </p>
          <p className="meta">
            Copy <code>.env.example</code> to <code>.env.local</code> and set{" "}
            <code>TODOIST_API_TOKEN</code> (Todoist → Settings → Integrations →
            Developer).
          </p>
        </div>
      </main>
    );
  }

  const graph = graphEnabled();

  return (
    <main>
      <Header />
      {SECTIONS.map(({ key, title, empty }) => {
        const items = tasks.filter((t) => t.section === key);
        // Hide empty low-signal sections; keep the two core ones visible.
        if (items.length === 0 && key !== "ready" && key !== "pick") return null;
        return (
          <section key={key}>
            <h2>
              {title}
              {items.length > 0 ? ` · ${items.length}` : ""}
            </h2>
            {items.length === 0 ? (
              <div className="empty">{empty}</div>
            ) : (
              items.map((t) => (
                <TaskCard key={t.id} task={t} graphEnabled={graph} />
              ))
            )}
          </section>
        );
      })}
    </main>
  );
}

function Header() {
  return (
    <header className="app">
      <h1>extra</h1>
      <nav>
        <span className="active">Triage</span>
        <Link href="/metrics">Metrics</Link>
        <AutoRefresh />
      </nav>
    </header>
  );
}
