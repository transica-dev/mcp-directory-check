// Name heuristics shared by the checks and by our hosted connector's annotations. Tool names are
// read verb-first (`get_order`, as OpenAI recommends), falling back to the last word for
// noun-first names (`order_cancel`). Conservative on purpose: unknown verbs match nothing.

const set = (words: string) => new Set(words.split(/\s+/).filter(Boolean));

export const READ_VERBS = set(`
  get list search find read fetch lookup query count describe show view retrieve preview browse
  check inspect lookup summarize summarise export download explain validate verify estimate
  calculate compute compare resolve suggest recommend`);

export const WRITE_VERBS = set(`
  create add insert new update edit modify set patch put save upsert delete remove destroy purge
  drop erase cancel revoke archive unarchive send post publish unpublish submit upload write move
  rename assign unassign invite share approve reject close reopen reset clear pay purchase buy
  book schedule reschedule transfer refund charge merge deploy trigger start stop enable disable
  subscribe unsubscribe like unlike follow unfollow comment reply email message tweet register
  import sync restore grant mark tag untag attach detach link unlink complete apply redeem`);

/** Verbs whose effect removes or overwrites something, per OpenAI's destructiveHint guidance. */
export const DESTRUCTIVE_VERBS = set(`
  delete remove destroy purge drop erase cancel revoke overwrite replace reset clear wipe truncate
  deactivate terminate kill void unpublish unsubscribe detach unlink`);

/** Verbs that reach people or public places, per OpenAI's openWorldHint guidance. */
export const PUBLIC_VERBS = set(`
  send email message post publish tweet share invite comment reply broadcast notify announce push`);

/** `getOrderStatus`, `get-order_status` → ["get", "order", "status"]. */
export function words(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** The name's verb: its first word if that is a known verb, otherwise its last. */
export function verbOf(name: string): string | undefined {
  const w = words(name);
  const known = (v: string | undefined) => v && (READ_VERBS.has(v) || WRITE_VERBS.has(v));
  if (known(w[0])) return w[0];
  if (w.length > 1 && known(w[w.length - 1])) return w[w.length - 1];
  return undefined;
}

export type Intent = "read" | "write" | "unknown";
export function intentOf(name: string): Intent {
  const verb = verbOf(name);
  if (!verb) return "unknown";
  return READ_VERBS.has(verb) ? "read" : "write";
}

export const looksDestructive = (name: string) => DESTRUCTIVE_VERBS.has(verbOf(name) ?? "");
export const looksPublic = (name: string) => PUBLIC_VERBS.has(verbOf(name) ?? "");

/** `list_orders` → "List orders": a readable title when a tool has none. */
export function titleFrom(name: string): string {
  const text = words(name).join(" ");
  return text ? text[0].toUpperCase() + text.slice(1) : name;
}
