import { describe, expect, it } from "vitest";
import { checkMcpServer, type Report } from "../src/check";
import { publicFetch } from "../src/guard";

const ADDRESS = "https://mcp.example.com/mcp";
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { ...init, headers: { "content-type": "application/json", ...init.headers } });
const run = (handler: (request: Request) => Response | Promise<Response>) =>
  checkMcpServer(ADDRESS, { guard: () => (async (input, init) => handler(new Request(input as string, init))) as typeof fetch });
const status = (report: Report, id: string) => report.items.find((i) => i.id === id)?.status;

const TOOL = {
  name: "search_products",
  title: "Search products",
  description: "Searches the catalog by keyword and returns matching products. Use when someone asks what's available.",
  inputSchema: { type: "object", properties: { query: { type: "string", description: "Search words" } }, required: ["query"] },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
};

function server(calls: string[] = []) {
  return async (request: Request) => {
    if (request.method !== "POST") return new Response("", { status: 404 });
    const body = JSON.parse(await request.text());
    calls.push(body.method);
    if (body.method === "initialize") return json({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-06-18", serverInfo: { name: "shop", version: "1" } } });
    if (body.method === "tools/list") return json({ jsonrpc: "2.0", id: body.id, result: { tools: [TOOL] } });
    return new Response(null, { status: 202 });
  };
}

describe("checkMcpServer", () => {
  it("reads a public server's tools without calling one", async () => {
    const calls: string[] = [];
    const report = await run(server(calls));
    expect(status(report, "initialize")).toBe("pass");
    expect(status(report, "tools-list")).toBe("pass");
    expect(report.toolCount).toBe(1);
    expect(calls).toEqual(["initialize", "notifications/initialized", "tools/list"]);
  });

  it("fails a 401 with no sign-in metadata, and skips the tools", async () => {
    const report = await run((request) => (request.method === "POST" ? new Response("", { status: 401 }) : new Response("", { status: 404 })));
    expect(status(report, "challenge")).toBe("fail");
    expect(status(report, "tools-list")).toBe("info");
    expect(report.toolCount).toBeNull();
  });

  it("fails a 403 to a signed-out request", async () => {
    const report = await run((request) => (request.method === "POST" ? new Response("", { status: 403 }) : new Response("", { status: 404 })));
    expect(status(report, "challenge")).toBe("fail");
  });

  it("reports a server that doesn't answer", async () => {
    const report = await run(() => {
      throw new Error("boom");
    });
    expect(status(report, "reachable")).toBe("fail");
    expect(report.items.find((i) => i.id === "reachable")?.evidence).not.toContain("boom");
  });
});

describe("publicFetch", () => {
  it.each(["http://example.com/mcp", "https://127.0.0.1/mcp", "https://10.0.0.1/mcp", "https://192.168.1.1/mcp", "https://169.254.169.254/latest", "https://[::1]/mcp"])("refuses %s", async (target) => {
    await expect(publicFetch()(target)(target)).rejects.toThrow(/https|Private/);
  });
});
