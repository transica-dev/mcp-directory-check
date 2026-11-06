// Runs the check across remote servers in the official MCP Registry and prints totals only.
// Read-only and slow on purpose: one request set per host, a few at a time.
// Hosts are picked in a fixed pseudo-random order, with at most 25 under one registered domain, so
// one platform's subdomains don't dominate. The OpenAI domain file is left out of the failure
// totals, because a server only needs it once it's submitted.
// Usage: npm run build && node scripts/registry-study.mjs [--limit 2000] [--out results.jsonl]
import { appendFileSync } from "node:fs";
import { checkMcpServer, publicFetch } from "../dist/index.js";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const LIMIT = Number(arg("--limit", 0));
const OUT = arg("--out", "");
const CONCURRENCY = 3;
const PAUSE_MS = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function listRemotes() {
  const found = new Map();
  let cursor = "";
  let total = 0;
  for (;;) {
    const res = await fetch(`https://registry.modelcontextprotocol.io/v0/servers?limit=100&version=latest${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (!res.ok) throw new Error(`Registry answered ${res.status}`);
    const page = await res.json();
    for (const entry of page.servers ?? []) {
      total++;
      const remote = (entry.server?.remotes ?? []).find((r) => r.type === "streamable-http" && /^https:\/\/[^{}]+$/.test(r.url ?? ""));
      if (!remote) continue;
      const host = new URL(remote.url).host;
      if (!found.has(host)) found.set(host, { name: entry.server.name, url: remote.url });
    }
    cursor = page.metadata?.nextCursor;
    if (!cursor) break;
    await sleep(200);
  }
  return { total, remotes: [...found.values()] };
}

const { total, remotes } = await listRemotes();
console.log(`Registry: ${total} servers, ${remotes.length} remote hosts over Streamable HTTP`);
// A fixed shuffle, so a sample isn't just the alphabet's start.
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const perDomain = new Map();
const queue = [...remotes]
  .sort((a, b) => hash(a.url) - hash(b.url))
  .filter((r) => {
    const domain = new URL(r.url).hostname.split(".").slice(-2).join(".");
    const seen = perDomain.get(domain) ?? 0;
    perDomain.set(domain, seen + 1);
    return seen < 25;
  })
  .slice(0, LIMIT || undefined);
console.log(`Hosts after the per-domain cap, in this run: ${queue.length}`);

const rows = [];
async function worker() {
  for (;;) {
    const item = queue.shift();
    if (!item) return;
    let report;
    try {
      report = await checkMcpServer(item.url, { guard: publicFetch() });
    } catch {
      report = null;
    }
    const status = (id) => report?.items.find((i) => i.id === id)?.status ?? "none";
    const fails = report ? [...new Set(report.items.filter((i) => i.status === "fail").map((i) => i.id))] : [];
    const row = {
      url: item.url,
      reachable: status("reachable") === "pass",
      initialize: status("initialize"),
      signedOut: status("challenge") !== "none",
      tools: report?.toolCount ?? null,
      chatgptFails: report?.byDirectory.chatgpt.fail ?? null,
      claudeFails: report?.byDirectory.claude.fail ?? null,
      fails,
    };
    rows.push(row);
    if (OUT) appendFileSync(OUT, `${JSON.stringify(row)}\n`);
    await sleep(PAUSE_MS);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const pct = (n, of) => `${n} of ${of} (${of ? Math.round((100 * n) / of) : 0}%)`;
const reachable = rows.filter((r) => r.reachable);
const mcpOk = rows.filter((r) => r.initialize === "pass" || r.signedOut);
const readable = rows.filter((r) => r.tools !== null && r.tools > 0);
console.log(`Checked: ${rows.length}`);
console.log(`Answered at all: ${pct(reachable.length, rows.length)}`);
console.log(`Spoke MCP or asked for sign-in: ${pct(mcpOk.length, rows.length)}`);
console.log(`Asked for sign-in first: ${pct(rows.filter((r) => r.signedOut).length, rows.length)}`);
console.log(`Tools readable without sign-in: ${pct(readable.length, rows.length)}`);
const real = (r) => r.fails.filter((id) => id !== "openai-challenge");
const failsFor = (r, field) => r[field] - (r.fails.includes("openai-challenge") && field === "chatgptFails" ? 1 : 0);
console.log(`Of those, at least one failed rule (domain file aside): ${pct(readable.filter((r) => real(r).length).length, readable.length)}`);
console.log(`Of those, a failed ChatGPT rule (domain file aside): ${pct(readable.filter((r) => failsFor(r, "chatgptFails") > 0).length, readable.length)}`);
console.log(`Of those, a failed Claude rule: ${pct(readable.filter((r) => failsFor(r, "claudeFails") > 0).length, readable.length)}`);
const counts = {};
for (const r of readable) for (const id of real(r)) counts[id] = (counts[id] ?? 0) + 1;
console.log("Most common failed checks, among servers with readable tools:");
for (const [id, n] of Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${id}: ${pct(n, readable.length)}`);
const signIn = {};
const asks = rows.filter((r) => r.signedOut);
for (const r of asks) for (const id of real(r)) signIn[id] = (signIn[id] ?? 0) + 1;
console.log("Most common failed checks, among servers that ask for sign-in:");
for (const [id, n] of Object.entries(signIn).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${id}: ${pct(n, asks.length)}`);
const tools = readable.map((r) => r.tools).sort((a, b) => a - b);
console.log(`Median tools per readable server: ${tools[Math.floor(tools.length / 2)] ?? "n/a"}`);
