// The MCP directory check: reads a public MCP server the way a directory reviewer's first
// automated pass would, without signing in, and lists what meets the published ChatGPT and Claude
// requirements and what doesn't. Read-only: `initialize`, `tools/list` and GETs of public
// metadata. It never calls a tool, never sends credentials and keeps nothing but the result.
// Tool-level rules come from ./tool-quality.
import { SOURCES, type Source } from "./sources";
import { checkTools, type ToolInput } from "./tool-quality";

export const RUBRIC = "mcp-check/1 (criteria read 17 October 2026)";
export type Directory = "chatgpt" | "claude";
export type Status = "pass" | "warn" | "fail" | "info";
export type Group = "connection" | "signin" | "domain" | "tools";

export type Item = {
  id: string;
  group: Group;
  label: string;
  status: Status;
  /** What we saw. Exact; never a summary score. */
  evidence: string;
  /** What to change; empty when nothing needs changing. */
  fix: string;
  /** Directories whose published requirements this relates to; both when it comes from the MCP spec. */
  directories: Directory[];
  sources: Source[];
  /** Tools this item is about (tool-level checks only). */
  tools: string[];
  /** In a preview: how many tools the check found this result for (the names are left out). */
  toolCount?: number;
};

export type Report = {
  rubric: typeof RUBRIC;
  url: string;
  checkedAt: string;
  server: { name: string; title?: string; version: string; protocolVersion?: string } | null;
  toolCount: number | null;
  items: Item[];
  /** Per check and result (per-tool findings of one rule count once), as the page lists them. */
  counts: Record<Status, number>;
  byDirectory: Record<Directory, { fail: number; warn: number }>;
  note: string;
  /** False in a signed-out preview: results only, without evidence, fixes, tool names or sources. */
  full: boolean;
};

export const NOTE =
  "This checks what can be read without signing in. Directories also review privacy, policy and sign-in with a real account, and test every tool live, so a clean result isn’t approval.";

export type CheckOptions = {
  /** A fetch limited to one address (`serverFetch`): public HTTPS, no redirects, bounded size and time. */
  guard: (target: string) => typeof fetch;
  /** Local development only: the fixture server on loopback over http. */
  allowLoopback?: boolean;
  now?: () => Date;
};

const BOTH: Directory[] = ["chatgpt", "claude"];
const TIMEOUT_MS = 10_000;
const MAX_TOOLS = 200;
const HEADERS = { "content-type": "application/json", accept: "application/json, text/event-stream" };
const rpc = (body: object) => JSON.stringify({ jsonrpc: "2.0", ...body });
const INITIALIZE = rpc({
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "mcp-directory-check", version: "1" } },
});
const trim = (url: string) => url.replace(/\/$/, "");
export const CHALLENGE_PATH = "/.well-known/openai-apps-challenge";

/** Our own refusals (from `serverFetch`) are safe to show; other network errors aren't. */
function why(error: unknown): string {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
    return `no response within ${TIMEOUT_MS / 1000} seconds`;
  if (error instanceof Error && /^(The server|We couldn|Enter |Leave |Only |Private )/.test(error.message)) return error.message.replace(/\.$/, "");
  return "we couldn’t connect";
}

/** The JSON-RPC answer with `id`, from a JSON or event-stream body. Null when there is none. */
async function answer(res: Response, id: number): Promise<Record<string, unknown> | null> {
  const match = (m: unknown) =>
    m && typeof m === "object" && !Array.isArray(m) && (m as { id?: unknown }).id === id ? (m as Record<string, unknown>) : null;
  if (!/event-stream/i.test(res.headers.get("content-type") ?? "")) {
    const body: unknown = await res.json().catch(() => null);
    return Array.isArray(body) ? (body.map(match).find(Boolean) ?? null) : match(body);
  }
  if (!res.body) return null;
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buffer += value;
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = done ? "" : (events.pop() ?? "");
      for (const event of events) {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        try {
          const found = data ? match(JSON.parse(data)) : null;
          if (found) return found;
        } catch {
          // Not JSON: not an answer.
        }
      }
      if (done) return null;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/** A JSON object from a GET; null when it isn't one. */
async function getJson(fetcher: typeof fetch, url: string) {
  const res = await fetcher(url, { redirect: "manual", headers: { accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    return { status: res.status, body: null };
  }
  const body: unknown = await res.json().catch(() => null);
  return { status: res.status, body: body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null };
}

const wellKnown = (resource: URL, path = resource.pathname.replace(/\/$/, "")) => `${resource.origin}/.well-known/oauth-protected-resource${path}`;

export async function checkMcpServer(input: string, options: CheckOptions): Promise<Report> {
  const url = new URL(input);
  const items: Item[] = [];
  const add = (
    group: Group,
    id: string,
    label: string,
    status: Status,
    evidence: string,
    fix: string,
    sources: Source[],
    directories: Directory[] = BOTH,
  ) => items.push({ id, group, label, status, evidence, fix, directories, sources, tools: [] });
  const guard = options.guard(url.href);
  let server: Report["server"] = null;
  let toolCount: number | null = null;

  const finish = (): Report => {
    // One count per check and result: a tool rule failing on 5 tools is one failed check.
    const seen = new Set<string>();
    const checks = items.filter((i) => !seen.has(`${i.id}|${i.status}`) && seen.add(`${i.id}|${i.status}`));
    const counts: Report["counts"] = { pass: 0, warn: 0, fail: 0, info: 0 };
    for (const i of checks) counts[i.status]++;
    const byDirectory = Object.fromEntries(
      BOTH.map((d) => {
        const mine = checks.filter((i) => i.directories.includes(d));
        return [d, { fail: mine.filter((i) => i.status === "fail").length, warn: mine.filter((i) => i.status === "warn").length }];
      }),
    ) as Report["byDirectory"];
    return { rubric: RUBRIC, url: url.href, checkedAt: (options.now?.() ?? new Date()).toISOString(), server, toolCount, items, counts, byDirectory, note: NOTE, full: true };
  };

  // --- Connection -----------------------------------------------------------------------------
  const secure = url.protocol === "https:";
  if (secure) add("connection", "https", "Served over HTTPS", "pass", `${url.origin} uses HTTPS.`, "", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);
  else add("connection", "https", "Served over HTTPS", "warn", "This address uses http. It was reachable only because this check is running in local development.", "Serve the server over HTTPS.", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);

  let first: Response;
  try {
    first = await guard(url.href, { method: "POST", headers: HEADERS, body: INITIALIZE, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    add("connection", "reachable", "The server answers", "fail", `No answer: ${why(error)}.`, "Make the server reachable from the public internet over HTTPS, at the address you submit (often ending in /mcp), without redirects.", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);
    return finish();
  }
  add("connection", "reachable", "The server answers", "pass", `A POST to ${url.pathname || "/"} returned HTTP ${first.status}.`, "", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);

  let metadataUrl: string | null = null;
  let signedOut = false;
  let session: string | null = null;
  let protocolVersion = "2025-06-18";
  const mcp = [SOURCES.mcpAuth];

  if (first.status === 401) {
    signedOut = true;
    await first.body?.cancel().catch(() => {});
    const header = first.headers.get("www-authenticate");
    const named = header ? (/resource_metadata="([^"]+)"/i.exec(header)?.[1] ?? /resource_metadata=([^\s,"]+)/i.exec(header)?.[1]) : undefined;
    let valid: string | null = null;
    try {
      const at = named ? new URL(named) : null;
      if (at && (at.protocol === "https:" || (options.allowLoopback && at.protocol === "http:"))) valid = at.href;
    } catch {
      valid = null;
    }
    if (valid) {
      metadataUrl = valid;
      add("signin", "challenge", "Signed-out requests get 401 with sign-in metadata", "pass", `HTTP 401 with a WWW-Authenticate header naming ${valid}.`, "", [SOURCES.openaiReview, SOURCES.claudeSubmission, ...mcp]);
    } else if (!header) {
      add("signin", "challenge", "Signed-out requests get 401 with sign-in metadata", "fail", "HTTP 401 without a WWW-Authenticate header.", "Add a WWW-Authenticate header whose resource_metadata points to your protected-resource metadata.", [SOURCES.openaiReview, SOURCES.claudeSubmission, ...mcp]);
    } else {
      add("signin", "challenge", "Signed-out requests get 401 with sign-in metadata", "fail", named ? "The WWW-Authenticate header names an invalid metadata address." : "The WWW-Authenticate header doesn’t include resource_metadata.", "Add resource_metadata=\"https://…\" to the WWW-Authenticate header, pointing to your protected-resource metadata.", [SOURCES.openaiReview, SOURCES.claudeSubmission, ...mcp]);
    }
    add("connection", "initialize", "MCP initialize over Streamable HTTP", "info", "The server asks for sign-in before it answers initialize, so we can’t read its tools without an account.", "", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);
    add("tools", "tools-list", "Tools can be listed", "info", "Not checked: this needs a signed-in session, and this check never signs in. The tool checks below were skipped.", "", [SOURCES.openaiReview]);
  } else if (first.status === 403) {
    await first.body?.cancel().catch(() => {});
    add("signin", "challenge", "Signed-out requests get 401, not 403", "fail", "HTTP 403 to a signed-out request.", "Return HTTP 401 with a WWW-Authenticate header so clients start the sign-in flow. A 403 tells them sign-in won’t help.", [SOURCES.openaiReview, SOURCES.claudeSubmission, ...mcp]);
    add("connection", "initialize", "MCP initialize over Streamable HTTP", "info", "Not checked: the server refused the request.", "", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);
  } else if (!first.ok) {
    await first.body?.cancel().catch(() => {});
    add("connection", "initialize", "MCP initialize over Streamable HTTP", "fail", `HTTP ${first.status} to an MCP initialize request.`, first.status === 404 ? "Nothing answers at this path. Check the address (often ending in /mcp)." : "Accept POST requests with JSON-RPC at this address, per the MCP Streamable HTTP transport.", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);
  } else {
    const result = (await answer(first, 1).catch(() => null))?.result as
      | { protocolVersion?: unknown; serverInfo?: { name?: unknown; title?: unknown; version?: unknown } }
      | undefined;
    if (!result || typeof result.protocolVersion !== "string") {
      add("connection", "initialize", "MCP initialize over Streamable HTTP", "fail", `HTTP ${first.status}, but the answer isn’t an MCP initialize result (${first.headers.get("content-type") ?? "no content type"}).`, "Answer initialize with a JSON-RPC result, as JSON or a server-sent event stream.", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);
    } else {
      protocolVersion = result.protocolVersion.slice(0, 40);
      session = first.headers.get("mcp-session-id");
      const info = result.serverInfo ?? {};
      server = {
        name: String(info.name ?? "").slice(0, 200),
        ...(typeof info.title === "string" ? { title: info.title.slice(0, 200) } : {}),
        version: String(info.version ?? "").slice(0, 100),
        protocolVersion,
      };
      add("connection", "initialize", "MCP initialize over Streamable HTTP", "pass", `Protocol version ${protocolVersion}${server.name ? `; server “${server.name}” ${server.version}` : ""}.`, "", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);
    }
  }

  // --- Tools (only when initialize worked) ------------------------------------------------------
  if (server) {
    const headers: Record<string, string> = { ...HEADERS, "mcp-protocol-version": protocolVersion, ...(session ? { "mcp-session-id": session } : {}) };
    const post = (body: string) => guard(url.href, { method: "POST", headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const listed: unknown[] = [];
    let problem: string | null = null;
    try {
      const notified = await post(rpc({ method: "notifications/initialized" }));
      await notified.body?.cancel().catch(() => {});
      let cursor: string | undefined;
      for (let page = 0; page < 10 && listed.length < MAX_TOOLS; page++) {
        const res = await post(rpc({ id: 2 + page, method: "tools/list", params: cursor ? { cursor } : {} }));
        if (res.status === 401) {
          signedOut = true;
          await res.body?.cancel().catch(() => {});
          problem = "HTTP 401: listing tools needs sign-in";
          break;
        }
        if (!res.ok) {
          await res.body?.cancel().catch(() => {});
          problem = `HTTP ${res.status} to tools/list`;
          break;
        }
        const result = (await answer(res, 2 + page))?.result as { tools?: unknown; nextCursor?: unknown } | undefined;
        if (!result || !Array.isArray(result.tools)) {
          problem = "the answer to tools/list has no tools array";
          break;
        }
        listed.push(...result.tools);
        cursor = typeof result.nextCursor === "string" ? result.nextCursor : undefined;
        if (!cursor) break;
      }
    } catch (error) {
      problem = why(error);
    } finally {
      if (session) await guard(url.href, { method: "DELETE", headers, signal: AbortSignal.timeout(TIMEOUT_MS) }).then((r) => r.body?.cancel()).catch(() => {});
    }
    if (problem && !listed.length) {
      add("tools", "tools-list", "Tools can be listed", problem.includes("sign-in") ? "info" : "fail", `${problem[0].toUpperCase()}${problem.slice(1)}.${problem.includes("sign-in") ? " This check never signs in, so the tool checks below were skipped." : ""}`, problem.includes("sign-in") ? "" : "Answer tools/list with the server’s tools.", [SOURCES.openaiReview, SOURCES.claudeSubmission]);
    } else {
      toolCount = listed.length;
      add("tools", "tools-list", "Tools can be listed", listed.length ? "pass" : "fail", listed.length ? `${listed.length} tool${listed.length === 1 ? "" : "s"} listed${listed.length >= MAX_TOOLS ? ` (we read the first ${MAX_TOOLS})` : ""}.` : "tools/list returned no tools.", listed.length ? "" : "List at least one tool.", [SOURCES.openaiReview, SOURCES.claudeSubmission]);
      if (listed.length) {
        const quality = checkTools(listed as ToolInput[]);
        for (const c of quality.checks)
          items.push({
            id: `tool.${c.id}`,
            group: "tools",
            label: c.criterion,
            status: c.status === "not_applicable" ? "info" : c.status,
            evidence: c.evidence,
            fix: c.fix,
            directories: c.directories.length ? c.directories.filter((d): d is Directory => d !== "gemini") : BOTH,
            sources: c.sources.filter((s) => s.url),
            tools: c.tools,
          });
      }
    }
  }

  // --- Sign-in discovery ------------------------------------------------------------------------
  if (first.status !== 403) {
    const fetchers = (target: string) => options.guard(target);
    const read = async (target: string) => getJson(fetchers(target), target);
    const resource = trim(url.href);
    let prm: Record<string, unknown> | null = null;
    let prmAt = metadataUrl;
    try {
      if (prmAt) prm = (await read(prmAt)).body;
      else
        for (const candidate of [wellKnown(url), wellKnown(url, "")]) {
          const found = await read(candidate);
          if (found.body) {
            prm = found.body;
            prmAt = candidate;
            break;
          }
        }
    } catch {
      prm = null;
    }
    const srcSignIn = [SOURCES.openaiReview, SOURCES.claudeReview, ...mcp];
    if (!prm) {
      if (signedOut)
        add("signin", "metadata", "Protected-resource metadata", "fail", `${prmAt ? `${prmAt} didn’t return` : "No"} protected-resource metadata (JSON).`, "Serve protected-resource metadata (RFC 9728) at the address in your WWW-Authenticate header, or at /.well-known/oauth-protected-resource.", srcSignIn);
      else
        add("signin", "metadata", "Sign-in", "info", "The server answers without sign-in and publishes no sign-in metadata. Directories accept that for public data; if your tools act on a person’s account, add OAuth.", "", srcSignIn);
    } else {
      const servers = prm.authorization_servers;
      const first_ = Array.isArray(servers) && typeof servers[0] === "string" ? servers[0] : null;
      if (typeof prm.resource !== "string" || trim(prm.resource) !== resource)
        add("signin", "metadata", "Protected-resource metadata", "fail", `The metadata’s resource (${typeof prm.resource === "string" ? prm.resource : "missing"}) isn’t this server’s address (${resource}).`, "Set resource to exactly the address you submit.", srcSignIn);
      else if (!first_)
        add("signin", "metadata", "Protected-resource metadata", "fail", "The metadata lists no authorization server.", "List your authorization server in authorization_servers.", srcSignIn);
      else {
        add("signin", "metadata", "Protected-resource metadata", "pass", `Names this address and the authorization server ${first_}.`, "", srcSignIn);
        await authorizationServer(first_, read, add, srcSignIn, options.allowLoopback);
      }
    }
  }

  // --- Domain verification (ChatGPT) --------------------------------------------------------------
  try {
    const target = `${url.origin}${CHALLENGE_PATH}`;
    const res = await options.guard(target)(target, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const type = res.headers.get("content-type") ?? "";
    const text = res.ok ? (await res.text()).trim() : (await res.body?.cancel(), "");
    const looksLikeToken = text.length > 0 && text.length <= 500 && !/<\s*(html|!doctype)/i.test(text) && !/json/i.test(type);
    if (res.ok && looksLikeToken)
      add("domain", "openai-challenge", "OpenAI domain verification file", "pass", `${CHALLENGE_PATH} returns plain text (${text.length} characters). We can’t tell whether it’s the token OpenAI gave you; that’s checked when you submit.`, "", [SOURCES.openaiSubmission], ["chatgpt"]);
    else
      add("domain", "openai-challenge", "OpenAI domain verification file", "fail", res.ok ? `${CHALLENGE_PATH} returned HTTP ${res.status}, but not a plain-text token.` : `${CHALLENGE_PATH} returned HTTP ${res.status}.`, "When you submit to ChatGPT, OpenAI gives you a token. Serve it as plain text at /.well-known/openai-apps-challenge on this server’s domain.", [SOURCES.openaiSubmission], ["chatgpt"]);
  } catch (error) {
    add("domain", "openai-challenge", "OpenAI domain verification file", "fail", `Couldn’t read ${CHALLENGE_PATH}: ${why(error)}.`, "Serve the token OpenAI gives you as plain text at /.well-known/openai-apps-challenge on this server’s domain.", [SOURCES.openaiSubmission], ["chatgpt"]);
  }

  return finish();
}

type Add = (g: Group, id: string, label: string, status: Status, evidence: string, fix: string, sources: Source[], directories?: Directory[]) => void;

/** The authorization server's metadata (RFC 8414, then OpenID discovery): issuer, PKCE and client registration. */
async function authorizationServer(
  server: string,
  read: (url: string) => Promise<{ status: number; body: Record<string, unknown> | null }>,
  add: Add,
  sources: Source[],
  allowLoopback?: boolean,
) {
  let at: URL;
  try {
    at = new URL(server);
    if (at.protocol !== "https:" && !(allowLoopback && at.protocol === "http:")) throw new Error();
  } catch {
    add("signin", "as-metadata", "Authorization server metadata", "fail", "The authorization server address isn’t a valid https URL.", "Use the https address of your authorization server.", sources);
    return;
  }
  const path = at.pathname.replace(/\/$/, "");
  let doc: Record<string, unknown> | null = null;
  let tried = "";
  for (const candidate of [`${at.origin}/.well-known/oauth-authorization-server${path}`, `${at.origin}/.well-known/openid-configuration${path}`]) {
    tried = candidate;
    try {
      doc = (await read(candidate)).body;
    } catch {
      doc = null;
    }
    if (doc) break;
  }
  if (!doc) {
    add("signin", "as-metadata", "Authorization server metadata", "fail", `No metadata at ${tried.replace(/\/openid-configuration.*/, "")}/oauth-authorization-server or openid-configuration.`, "Publish authorization server metadata (RFC 8414) at /.well-known/oauth-authorization-server.", sources);
    return;
  }
  if (typeof doc.issuer !== "string" || trim(doc.issuer) !== trim(at.href)) {
    add("signin", "as-metadata", "Authorization server metadata", "fail", `The metadata’s issuer (${typeof doc.issuer === "string" ? doc.issuer : "missing"}) differs from ${server}.`, "Make issuer match the authorization server address exactly.", sources);
    return;
  }
  add("signin", "as-metadata", "Authorization server metadata", "pass", `Loaded for ${server}.`, "", sources);
  const methods = doc.code_challenge_methods_supported;
  const s256 = Array.isArray(methods) && methods.includes("S256");
  add("signin", "pkce", "PKCE with S256", s256 ? "pass" : "fail", s256 ? "code_challenge_methods_supported includes S256." : "code_challenge_methods_supported doesn’t include S256.", s256 ? "" : "Support PKCE with S256 and list it.", sources);
  const dcr = typeof doc.registration_endpoint === "string" && doc.registration_endpoint.length > 0;
  const cimd = doc.client_id_metadata_document_supported === true;
  if (!dcr && !cimd)
    add("signin", "registration", "AI apps can register as a client", "fail", "Neither dynamic client registration nor Client ID Metadata Documents is advertised.", "Support dynamic client registration, Client ID Metadata Documents, or both.", sources);
  else
    add("signin", "registration", "AI apps can register as a client", "pass", `Advertised: ${[dcr && "dynamic client registration", cimd && "Client ID Metadata Documents"].filter(Boolean).join(" and ")}.`, "", sources);
}

/**
 * The signed-out view: which checks passed or failed, once per check, without what we saw, the
 * fixes, tool names or sources. Applied on the server, so the full report never reaches the page.
 */
export function preview(report: Report): Report {
  const byKey = new Map<string, Item>();
  for (const item of report.items) {
    const key = `${item.id}|${item.status}`;
    const seen = byKey.get(key);
    if (seen) seen.toolCount = (seen.toolCount ?? 0) + item.tools.length;
    else
      byKey.set(key, { id: item.id, group: item.group, label: item.label, status: item.status, directories: item.directories, evidence: "", fix: "", sources: [], tools: [], toolCount: item.tools.length });
  }
  return { ...report, items: [...byKey.values()], full: false };
}
