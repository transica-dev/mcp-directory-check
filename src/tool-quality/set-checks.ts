// Static checks on a tool set as a whole: overlapping read tools,
// steering text, references to tools that don't exist or disagree about where an id comes from,
// and generated API text. Used by the AI tool-design pass (findings go back for one fix-up round)
// and later by the directory listing checks. Pure; no AI and no network.
import { READ_VERBS, words } from "./words";

export type SetTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: unknown;
  /** Whether it only reads; from the catalogue's safety class or the tool's readOnlyHint. */
  readOnly: boolean;
  /** Response field names, when known (`items[].name`). */
  outputFields?: string[];
};

export type SetFinding = {
  kind: "overlap" | "steering" | "cross_reference" | "id_source" | "generated_text";
  tools: string[];
  message: string;
};

type Arg = { name: string; description: string; required: boolean };

function args(t: SetTool): Arg[] {
  const s = t.inputSchema as { properties?: Record<string, { description?: unknown }>; required?: unknown } | undefined;
  const required = new Set(Array.isArray(s?.required) ? (s!.required as string[]) : []);
  return Object.entries(s?.properties ?? {}).map(([name, p]) => ({
    name,
    description: typeof p?.description === "string" ? p.description : "",
    required: required.has(name),
  }));
}

// Words that say nothing about which things a read returns.
const FILLER = new Set("user users my all the of for by a an detail details info information data current self me".split(" "));
// Names for "the things the person has" that sites use interchangeably.
const SYNONYMS: Record<string, string> = {
  item: "item", product: "item", inventory: "item", archive: "item", record: "item", entry: "item", thing: "item", possession: "item",
  order: "order", purchase: "order",
  message: "message", conversation: "message",
  alert: "alert", reminder: "alert", notification: "alert",
};
const singular = (w: string) => (w.length > 3 && w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

/** What a read tool's name says it returns: `list_user_products` and `list_items` → {item}. */
export function nameSubject(name: string): string[] {
  // Only a leading verb is a verb: in `get_list_bookmarks`, "list" is a thing.
  const all = words(name);
  const ws = (READ_VERBS.has(all[0]) ? all.slice(1) : all).filter((w) => !FILLER.has(w)).map(singular);
  return [...new Set(ws.map((w) => SYNONYMS[w] ?? w))].sort();
}

const STOP = new Set(
  `a an the and or of to for in on at by with from as is are be it its this that these those their they them use used using when
  which what who whose how can may will each any all one more such than then also only not no your you user users user's person
  returns return get gets list lists paginated page skip limit results result fetch further incomplete give gives`.split(/\s+/),
);
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, "");
function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map(stem),
  );
}
function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let both = 0;
  for (const w of a) if (b.has(w)) both++;
  return both / (a.size + b.size - both);
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((w, i) => w === b[i]);
const pair = (a: string, b: string) => [a, b].sort().join(" ");

function overlaps(tools: SetTool[]): SetFinding[] {
  const reads = tools.filter((t) => t.readOnly);
  const groups = new Map<string, Set<string>>();
  const why = new Map<string, string>();
  for (let i = 0; i < reads.length; i++)
    for (let j = i + 1; j < reads.length; j++) {
      const a = reads[i];
      const b = reads[j];
      // A lookup by id and a list of the same things answer different questions, and so do
      // lists scoped by different ids (bookmarks in a list, bookmarks with a tag).
      const needsA = args(a).filter((x) => x.required).map((x) => x.name).sort();
      const needsB = args(b).filter((x) => x.required).map((x) => x.name).sort();
      if (!sameSet(needsA, needsB)) continue;
      const subjectA = nameSubject(a.name);
      const subjectB = nameSubject(b.name);
      const sameName = subjectA.length > 0 && sameSet(subjectA, subjectB);
      const desc = jaccard(contentWords(a.description), contentWords(b.description));
      const outA = new Set(a.outputFields ?? []);
      const outB = new Set(b.outputFields ?? []);
      const out = outA.size >= 3 && outB.size >= 3 ? jaccard(outA, outB) : 0;
      let reason = "";
      if (sameName) reason = "their names describe the same things";
      else if (desc >= 0.5) reason = "their descriptions are nearly the same";
      else if (out >= 0.7) reason = "they return nearly the same fields";
      if (!reason) continue;
      why.set(pair(a.name, b.name), reason);
      // Group transitively: five lists of the same things are one finding.
      const ga = [...groups.values()].find((g) => g.has(a.name));
      const gb = [...groups.values()].find((g) => g.has(b.name));
      if (ga && gb && ga !== gb) {
        for (const n of gb) ga.add(n);
        groups.delete([...groups.entries()].find(([, g]) => g === gb)![0]);
      } else if (ga) ga.add(b.name);
      else if (gb) gb.add(a.name);
      else groups.set(a.name, new Set([a.name, b.name]));
    }
  return [...groups.values()].map((g) => {
    const names = [...g].sort();
    const reasons = [...new Set(names.flatMap((a) => names.map((b) => why.get(pair(a, b))).filter(Boolean)))];
    return {
      kind: "overlap" as const,
      tools: names,
      message: `These read tools look like they answer the same questions (${reasons.join("; ")}). Keep one for each question and leave the others out, or make each description say when to use it and name the sibling for the rest.`,
    };
  });
}

const STEERING: RegExp[] = [
  /\buse (it|this(?: tool)?) first\b/i,
  /\b(call|use|run) (it|this(?: tool)?) (first|before)\b/i,
  /\bas a whole\b/i,
  /\b(always|must)\s+(use|call|invoke|run|start)\b/i,
  /\bstart (here|with this)\b/i,
  /\bfor (any|all|every) (questions?|requests?)\b/i,
  /\b(primary|default|main|go-to) tool\b/i,
  /\bbefore (using|calling) any other\b/i,
  /\b(instead of|rather than) (any )?other tools?\b/i,
];

function snippet(text: string, index: number, length: number) {
  const start = Math.max(0, index - 30);
  return JSON.stringify(text.slice(start, index + length + 30).replace(/\s+/g, " ").trim());
}

function steering(tools: SetTool[]): SetFinding[] {
  return tools.flatMap((t) => {
    for (const re of STEERING) {
      const m = re.exec(t.description);
      if (m)
        return [
          {
            kind: "steering" as const,
            tools: [t.name],
            message: `The description steers the assistant (${snippet(t.description, m.index, m[0].length)}), so it picks this tool for questions others answer better. Say what it returns and when to use a sibling instead.`,
          },
        ];
    }
    return [];
  });
}

// A tool-like reference: snake_case starting with a verb (`list_user_items`), not a field name.
const TOOLISH = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;
const VERBISH = new Set([...READ_VERBS, "create", "add", "update", "delete", "remove", "set", "send", "cancel", "submit", "upload", "mark"]);

function references(text: string): string[] {
  return [...new Set([...text.matchAll(TOOLISH)].map((m) => m[0]).filter((w) => VERBISH.has(w.split("_")[0])))];
}

function crossReferences(tools: SetTool[]): SetFinding[] {
  const names = new Set(tools.map((t) => t.name));
  const fieldish = new Set(tools.flatMap((t) => [...args(t).map((a) => a.name), ...(t.outputFields ?? []).map((f) => f.replace(/^.*[.\]]/, ""))]));
  const out: SetFinding[] = [];
  for (const t of tools) {
    const texts = [t.description, ...args(t).map((a) => a.description)].join(" ");
    const missing = references(texts).filter((r) => !names.has(r) && !fieldish.has(r));
    if (missing.length)
      out.push({
        kind: "cross_reference",
        tools: [t.name],
        message: `Names ${missing.map((m) => `"${m}"`).join(", ")}, which ${missing.length > 1 ? "aren't tools" : "isn't a tool"} in this set. Name only tools the assistant has.`,
      });
  }
  return out;
}

/** Tools named as the source of an id: in the argument's own text, and in description sentences that mention it. */
function idSources(tools: SetTool[]): SetFinding[] {
  const names = new Set(tools.map((t) => t.name));
  const out: SetFinding[] = [];
  const bySource = new Map<string, { tool: string; sources: string[] }[]>();
  for (const t of tools) {
    const sentences = t.description.split(/(?<=[.!?])\s+/);
    for (const a of args(t).filter((x) => /(^|_)(id|ids|slug|key|uuid)$|Id$/.test(x.name))) {
      const inArg = references(a.description).filter((r) => names.has(r));
      const inDesc = sentences
        .filter((s) => s.includes(a.name))
        .flatMap((s) => references(s))
        .filter((r) => names.has(r) && r !== t.name);
      if (inArg.length && inDesc.length && !inArg.some((r) => inDesc.includes(r)))
        out.push({
          kind: "id_source",
          tools: [t.name],
          message: `The description says ${a.name} comes from ${inDesc.join(" or ")}, but the argument says ${inArg.join(" or ")}. Name one source in both places.`,
        });
      const sources = [...new Set([...inArg, ...inDesc])];
      if (sources.length) bySource.set(a.name, [...(bySource.get(a.name) ?? []), { tool: t.name, sources }]);
    }
  }
  for (const [arg, uses] of bySource) {
    if (uses.length < 2) continue;
    const shared = uses.slice(1).reduce((acc, u) => acc.filter((s) => u.sources.includes(s)), uses[0].sources);
    if (!shared.length)
      out.push({
        kind: "id_source",
        tools: uses.map((u) => u.tool),
        message: `These tools take ${arg} but name different sources for it (${uses.map((u) => `${u.tool}: ${u.sources.join(" or ")}`).join("; ")}). Name the same source everywhere.`,
      });
  }
  return out;
}

const PARAM_SUFFIX = /\((query|path|header|cookie|body) parameter\)|\(request body\)/i;
const OPERATION_ID = /\b[a-z0-9]+(?:_[a-z0-9]+)*__[a-z0-9_]+\b|\b[a-z0-9_]+_(get|post|put|patch|delete)\b/;

function generatedText(tools: SetTool[]): SetFinding[] {
  const out: SetFinding[] = [];
  for (const t of tools) {
    const problems: string[] = [];
    const first = t.description.split(/(?<=\.)\s+|\n/)[0]?.trim() ?? "";
    const firstWords = first.replace(/\.$/, "").split(/\s+/).filter(Boolean);
    const nameWords = words(t.name).join(" ");
    const titleCase = firstWords.length >= 2 && firstWords.length <= 6 && firstWords.every((w) => /^[A-Z0-9]/.test(w)) && first.endsWith(".");
    if (titleCase) problems.push(`it opens with a Title-Case echo (${JSON.stringify(first)})`);
    else if (first.endsWith(".") && firstWords.length <= 6 && (words(first).join(" ") === nameWords || (t.title && first.replace(/\.$/, "").toLowerCase() === t.title.toLowerCase())))
      problems.push(`it opens by repeating the tool's name (${JSON.stringify(first)})`);
    const texts = [{ where: "description", text: t.description }, ...args(t).map((a) => ({ where: `argument ${a.name}`, text: a.description }))];
    for (const { where, text } of texts) {
      if (PARAM_SUFFIX.test(text)) problems.push(`the ${where} has generated "(… parameter)" text`);
      const op = OPERATION_ID.exec(text);
      if (op) problems.push(`the ${where} contains an operation id (${op[0]})`);
    }
    for (const a of args(t)) if (a.description && words(a.description).join(" ") === words(a.name).join(" ")) problems.push(`argument ${a.name}'s description only repeats its name`);
    if (t.description.trim().length < 40) problems.push("the description is too short to say what it returns and when to use it");
    if (problems.length)
      out.push({
        kind: "generated_text",
        tools: [t.name],
        message: `Generated API text: ${problems.join("; ")}. Write what it returns and when to use it, in plain words.`,
      });
  }
  return out;
}

export function checkToolSet(tools: readonly SetTool[]): SetFinding[] {
  const list = [...tools];
  return [...overlaps(list), ...steering(list), ...crossReferences(list), ...idSources(list), ...generatedText(list)];
}
