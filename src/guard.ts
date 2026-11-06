// The fetch the check uses: public HTTPS only, no redirects, bounded time and size. A server's
// metadata can name other addresses, so every target is checked before it's fetched.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 1_000_000;

function isPrivate(ip: string): boolean {
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    if (lower.startsWith("::ffff:")) return isPrivate(lower.slice(7));
    return lower === "::1" || lower === "::" || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

async function assertAllowed(target: string, allowLoopback: boolean) {
  const url = new URL(target);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (allowLoopback && (host === "localhost" || host === "127.0.0.1" || host === "::1")) return;
  if (url.protocol !== "https:") throw new Error("Only https addresses can be checked.");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.some((a) => isPrivate(a.address))) throw new Error("Private addresses can't be checked.");
}

function capped(res: Response): Response {
  if (!res.body) return res;
  let seen = 0;
  const limit = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > MAX_BYTES) controller.error(new Error("The server sent too much data."));
      else controller.enqueue(chunk);
    },
  });
  return new Response(res.body.pipeThrough(limit), { status: res.status, statusText: res.statusText, headers: res.headers });
}

/** A fetch for one address, for `checkMcpServer`'s `guard` option. */
export const publicFetch = (allowLoopback = false) => (target: string): typeof fetch =>
  (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    await assertAllowed(target, allowLoopback);
    return capped(await fetch(input, { ...init, redirect: "manual" }));
  }) as typeof fetch;
