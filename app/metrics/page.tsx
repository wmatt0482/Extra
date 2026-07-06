import Link from "next/link";
import {
  getCompletedHistory,
  getPipeline,
  type CompletedItem,
  type PipelineTask,
} from "@/lib/todoist";

export const dynamic = "force-dynamic";

interface Counterparty {
  name: string;
  count: number;
  oldest: number;
}

function waitingByCounterparty(tasks: PipelineTask[]): Counterparty[] {
  const groups = new Map<string, { count: number; oldest: number }>();
  for (const t of tasks) {
    if (!t.labels.includes("waiting-on")) continue;
    // "Waiting on [Name]: topic" title, or the To:/Waiting on: line.
    const name =
      t.title.match(/^Waiting on ([^:]+):/)?.[1]?.trim() ??
      t.meta.to?.replace(/<[^>]*>/, "").trim() ??
      "(unknown)";
    const g = groups.get(name) ?? { count: 0, oldest: 0 };
    g.count += 1;
    g.oldest = Math.max(g.oldest, t.ageDays);
    groups.set(name, g);
  }
  return [...groups.entries()]
    .map(([name, g]) => ({ name, ...g }))
    .sort((a, b) => b.oldest - a.oldest || b.count - a.count);
}

function weeklyThroughput(items: CompletedItem[], weeks = 4) {
  const buckets: { label: string; count: number }[] = [];
  const now = Date.now();
  for (let w = weeks - 1; w >= 0; w--) {
    const end = now - w * 7 * 86_400_000;
    const start = end - 7 * 86_400_000;
    const count = items.filter((i) => {
      const t = new Date(i.completed_at).getTime();
      return (
        t > start &&
        t <= end &&
        (i.labels.includes("email") || i.labels.includes("meeting"))
      );
    }).length;
    const d = new Date(start);
    buckets.push({
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      count,
    });
  }
  return buckets;
}

export default async function Metrics() {
  let tasks: PipelineTask[];
  try {
    tasks = await getPipeline();
  } catch (e) {
    return (
      <main>
        <Header />
        <div className="error">
          <p className="meta">
            <code>{e instanceof Error ? e.message : "unknown error"}</code>
          </p>
        </div>
      </main>
    );
  }

  let history: CompletedItem[] | null = null;
  try {
    history = await getCompletedHistory(28);
  } catch {
    history = null; // sync endpoint unavailable — degrade, don't crash
  }

  const bySection = (s: string) => tasks.filter((t) => t.section === s);
  const waiting = waitingByCounterparty(tasks);
  const aging = waiting.filter((w) => w.oldest > 7);
  const ready = bySection("ready");
  const edited = ready.filter((t) => t.edited);
  const throughput = history ? weeklyThroughput(history) : null;
  const maxWeek = throughput
    ? Math.max(1, ...throughput.map((b) => b.count))
    : 1;

  const tiles = [
    { label: "Ready to send", value: ready.length },
    { label: "Pick to draft", value: bySection("pick").length },
    { label: "Drafting", value: bySection("queued").length },
    { label: "Open waiting-ons", value: waiting.reduce((n, w) => n + w.count, 0) },
    { label: "Aging >7d", value: aging.length, alert: aging.length > 0 },
    {
      label: "Drafts edited before send",
      value: ready.length ? `${edited.length}/${ready.length}` : "—",
    },
  ];

  return (
    <main>
      <Header />

      <section>
        <h2>Now</h2>
        <div className="tiles">
          {tiles.map((t) => (
            <div className={`tile${t.alert ? " alert" : ""}`} key={t.label}>
              <div className="value">{t.value}</div>
              <div className="label">{t.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Waiting on people</h2>
        {waiting.length === 0 ? (
          <div className="empty">Nobody owes you anything. Enjoy it.</div>
        ) : (
          <div className="card">
            {waiting.map((w) => (
              <div className="row" key={w.name}>
                <span>
                  {w.oldest > 14 ? "🚨 " : w.oldest > 7 ? "⚠️ " : ""}
                  {w.name}
                </span>
                <span className="meta">
                  {w.count} open · oldest {w.oldest}d
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>Closed per week (email + meeting)</h2>
        {throughput ? (
          <div className="card bars">
            {throughput.map((b) => (
              <div className="barcol" key={b.label}>
                <div className="count">{b.count}</div>
                <div
                  className="bar"
                  style={{ height: `${Math.round((b.count / maxWeek) * 72) + 4}px` }}
                />
                <div className="label">{b.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            Completed-task history unavailable (Todoist sync endpoint didn&apos;t
            respond) — live pipeline metrics above are unaffected.
          </div>
        )}
      </section>
    </main>
  );
}

function Header() {
  return (
    <header className="app">
      <h1>extra</h1>
      <nav>
        <Link href="/">Triage</Link>
        <span className="active">Metrics</span>
      </nav>
    </header>
  );
}
