// Tool-quality check: a static read of an MCP server's `tools/list` against the published review
// criteria of the Claude connector directory and ChatGPT apps, plus MCP specification guidance.
// No agent run and no network. This is preparation for directory review, never a promise of
// approval: directories also review authentication, policy and a live test of every tool.
// Each check names the published criteria it relies on (see ./sources.ts).
import { CHECKS, type Check, type Tool, type ToolInput } from "./checks";
import type { Directory, Source } from "./sources";

export { CHECKS, type ToolInput } from "./checks";
export type { Directory } from "./sources";

export type Status = "pass" | "warn" | "fail" | "not_applicable";

export type CheckResult = {
  id: string;
  criterion: string;
  status: Status;
  /** The tools this result is about; empty for server-wide results. */
  tools: string[];
  /** The offending field or text, or what passed. */
  evidence: string;
  /** What to change; empty when nothing needs changing. */
  fix: string;
  /** Directories whose published criteria this prepares for; empty means MCP spec or product. */
  directories: Directory[];
  sources: Source[];
};

export type Summary = {
  /** Which rules and which reading of the published criteria produced this result. */
  rubric: typeof RUBRIC;
  tools: number;
  counts: Record<Status, number>;
  /**
   * `fix_first`: a stated directory rule isn't met. `review_warnings`: only heuristic warnings.
   * `prepared`: nothing found by these checks (which is not approval).
   */
  readiness: "fix_first" | "review_warnings" | "prepared";
  byDirectory: Partial<Record<Directory, { fail: number; warn: number }>>;
  /** Each tool's worst status across checks. */
  toolStatus: Record<string, "pass" | "warn" | "fail">;
  note: string;
};

export type ToolQuality = { checks: CheckResult[]; summary: Summary };

export type Options = {
  /** Only checks for these directories (plus spec and product checks). Default: both. */
  directories?: Directory[];
  /** Tools the server listed but we couldn't import, with why (a stored manifest's `skipped`). */
  skipped?: { name: string; reason: string }[];
  /** This many tools or more is a warning. Default MANY_TOOLS. */
  manyTools?: number;
};

/**
 * From this many tools, the tool-quality check warns and suggests merging: tool choice gets less
 * reliable as the list grows.
 */
export const MANY_TOOLS = 25;

/**
 * tool-quality/2: tools.count warns from MANY_TOOLS (25) and suggests merging, instead of past 40.
 * 2.1: auth.security_schemes (ChatGPT) when tools declare how they sign in.
 */
export const RUBRIC = "tool-quality/2.1 (criteria read 2026-10-01)";

export const NOTE =
  "These checks help you prepare for directory review; they don’t guarantee approval. Directories also review sign-in, privacy and policy, test every tool live, and update their criteria.";

const text = (v: unknown) => (typeof v === "string" ? v : "");

/** Reads a `tools/list` entry defensively. */
function normalize(raw: ToolInput): Tool {
  const annotations =
    raw.annotations && typeof raw.annotations === "object" && !Array.isArray(raw.annotations)
      ? (raw.annotations as Record<string, unknown>)
      : {};
  const title = text(raw.title) || text(annotations.title);
  const meta = raw._meta && typeof raw._meta === "object" && !Array.isArray(raw._meta) ? (raw._meta as Record<string, unknown>) : {};
  const schemes = raw.securitySchemes ?? meta.securitySchemes;
  return {
    name: text(raw.name),
    ...(title ? { title } : {}),
    description: text(raw.description),
    schema: raw.inputSchema,
    annotations,
    ...(schemes !== undefined ? { securitySchemes: schemes } : {}),
  };
}

const ORDER: Record<Status, number> = { fail: 0, warn: 1, pass: 2, not_applicable: 3 };

function results(check: Check, tools: Tool[], options: Required<Pick<Options, "manyTools">> & Options): CheckResult[] {
  const base = {
    id: check.id,
    criterion: check.criterion,
    directories: check.directories,
    sources: check.sources,
  };
  const outcome = check.run(tools, { manyTools: options.manyTools, skipped: options.skipped ?? [] });
  const named = outcome.applies.filter((n) => n !== "(server)");
  if (!outcome.applies.length)
    return [{ ...base, status: "not_applicable", tools: [], evidence: check.notApplicable, fix: "" }];
  if (!outcome.findings.length) {
    const applicable = tools.filter((t) => named.includes(t.name));
    return [
      {
        ...base,
        status: "pass",
        tools: named,
        evidence: typeof check.passed === "function" ? check.passed(applicable) : check.passed,
        fix: "",
      },
    ];
  }
  return outcome.findings.map((f) => ({ ...base, status: f.status, tools: f.tools, evidence: f.evidence, fix: f.fix }));
}

/**
 * Checks an MCP server's tools against published directory criteria. Pure: pass the `tools`
 * array from `tools/list` (or a stored connector version's tools).
 */
export function checkTools(tools: readonly ToolInput[], options: Options = {}): ToolQuality {
  const selected = options.directories?.length ? options.directories : (["claude", "chatgpt"] as Directory[]);
  const normalized = tools.map(normalize);
  const opts = { ...options, manyTools: options.manyTools ?? MANY_TOOLS };
  const checks = CHECKS.filter((c) => !c.directories.length || c.directories.some((d) => selected.includes(d)))
    .flatMap((c) => results(c, normalized, opts))
    .map((r, i) => ({ r, i }))
    .sort((a, b) => ORDER[a.r.status] - ORDER[b.r.status] || a.i - b.i)
    .map(({ r }) => r);

  const counts: Record<Status, number> = { pass: 0, warn: 0, fail: 0, not_applicable: 0 };
  for (const r of checks) counts[r.status]++;
  const byDirectory: Summary["byDirectory"] = {};
  for (const d of selected) {
    const mine = checks.filter((r) => r.directories.includes(d) || !r.directories.length);
    byDirectory[d] = {
      fail: mine.filter((r) => r.status === "fail").length,
      warn: mine.filter((r) => r.status === "warn").length,
    };
  }
  const toolStatus: Summary["toolStatus"] = {};
  for (const t of normalized) toolStatus[t.name] = "pass";
  for (const r of checks)
    for (const name of r.tools)
      if (name in toolStatus && (r.status === "fail" || (r.status === "warn" && toolStatus[name] === "pass")))
        toolStatus[name] = r.status;

  return {
    checks,
    summary: {
      rubric: RUBRIC,
      tools: normalized.length,
      counts,
      readiness: counts.fail ? "fix_first" : counts.warn ? "review_warnings" : "prepared",
      byDirectory,
      toolStatus,
      note: NOTE,
    },
  };
}
