#!/usr/bin/env node
import { checkMcpServer, type Directory, type Item, type Report, type Status } from "./check";
import { publicFetch } from "./guard";

const HELP = `Check a remote MCP server against ChatGPT's and Claude's published directory rules.
Read-only: it sends initialize and tools/list, and reads public metadata. It never calls a tool or signs in.

Usage: mcp-directory-check <url> [options]

  --directory <chatgpt|claude>  Only rules for one directory
  --fail-on <fail|warn>         What sets exit code 1 (default: fail)
  --json                        Print the full report as JSON
  --verbose                     List passed checks too
  --allow-localhost             Allow http on localhost, for local development
  -h, --help                    Show this help

Exit codes: 0 passed, 1 found problems, 2 couldn't run.`;

const MARK: Record<Status, string> = { pass: "pass", warn: "warn", fail: "FAIL", info: "info" };
const GROUPS = { connection: "Connection", signin: "Sign-in", domain: "Domain", tools: "Tools" } as const;

function parse(argv: string[]) {
  const out = { url: "", directory: null as Directory | null, failOn: "fail" as "fail" | "warn", json: false, loopback: false, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      console.log(HELP);
      process.exit(0);
    } else if (arg === "--json") out.json = true;
    else if (arg === "--verbose") out.verbose = true;
    else if (arg === "--allow-localhost") out.loopback = true;
    else if (arg === "--directory") {
      const value = argv[++i];
      if (value !== "chatgpt" && value !== "claude") throw new Error("--directory must be chatgpt or claude");
      out.directory = value;
    } else if (arg === "--fail-on") {
      const value = argv[++i];
      if (value !== "fail" && value !== "warn") throw new Error("--fail-on must be fail or warn");
      out.failOn = value;
    } else if (arg.startsWith("-")) throw new Error(`Unknown option ${arg}`);
    else if (!out.url) out.url = arg;
    else throw new Error(`Unexpected argument ${arg}`);
  }
  if (!out.url) throw new Error("Give the address of an MCP server, such as https://example.com/mcp");
  return out;
}

function print(report: Report, items: Item[], verbose: boolean) {
  console.log(`\n${report.url}`);
  if (report.server) console.log(`${report.server.title || report.server.name} ${report.server.version}, ${report.toolCount ?? "?"} tools`);
  for (const group of Object.keys(GROUPS) as (keyof typeof GROUPS)[]) {
    const all = items.filter((i) => i.group === group);
    const mine = verbose ? all : all.filter((i) => i.status === "fail" || i.status === "warn" || (i.status === "info" && i.group !== "tools") || i.id === "tools-list");
    const passed = new Set(all.filter((i) => i.status === "pass").map((i) => i.id)).size;
    if (!all.length) continue;
    console.log(`\n${GROUPS[group]}${verbose ? "" : ` (${passed} passed)`}`);
    for (const item of mine) {
      console.log(`  ${MARK[item.status]}  ${item.label}`);
      if (item.status !== "pass") console.log(`        ${item.evidence}`);
      if (item.fix) console.log(`        Fix: ${item.fix}`);
      if (item.tools.length && item.status !== "pass") console.log(`        Tools: ${item.tools.slice(0, 8).join(", ")}${item.tools.length > 8 ? ` and ${item.tools.length - 8} more` : ""}`);
    }
  }
  for (const directory of ["chatgpt", "claude"] as const) {
    const counts = report.byDirectory[directory];
    console.log(`\n${directory === "chatgpt" ? "ChatGPT" : "Claude"}: ${counts.fail} failed, ${counts.warn} warnings`);
  }
  console.log(`\n${report.note}`);
  console.log("Rules and fixes in your browser: https://transica.dev/tools/mcp-directory-check");
}

async function main() {
  const options = parse(process.argv.slice(2));
  if (!options.loopback && !options.url.startsWith("https://")) throw new Error("Give an https address, such as https://example.com/mcp");
  const report = await checkMcpServer(options.url, { guard: publicFetch(options.loopback), allowLoopback: options.loopback });
  const items = options.directory ? report.items.filter((i) => i.directories.includes(options.directory as Directory)) : report.items;
  if (options.json) console.log(JSON.stringify({ ...report, items }, null, 2));
  else print(report, items, options.verbose);
  const bad = items.some((i) => i.status === "fail" || (options.failOn === "warn" && i.status === "warn"));
  process.exit(bad ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
});
