// The tool-quality checks: each reads an MCP server's `tools/list` and names the published
// criterion it prepares for (see ./sources.ts for the documents and URLs). Heuristic checks only
// warn; a check fails only where a directory states the rule outright (a missing title, a missing
// hint, an empty description, a name over 64 characters, a tool mixing reads and writes) or the
// MCP specification requires it.
import { SOURCES, type Directory, type Source } from "./sources";
import { intentOf, looksDestructive, looksPublic, titleFrom, verbOf, words } from "./words";

/** A tool as `tools/list` returns it, read defensively: any field may be missing or mistyped. */
export type ToolInput = {
  name?: unknown;
  title?: unknown;
  description?: unknown;
  inputSchema?: unknown;
  annotations?: unknown;
  /** How the tool signs in (OpenAI Apps SDK; SEP-1488 draft): top level, or mirrored in `_meta`. */
  securitySchemes?: unknown;
  _meta?: unknown;
};

export type Tool = {
  name: string;
  /** The tool's `title`, or its `annotations.title`. */
  title?: string;
  description: string;
  schema: unknown;
  annotations: Record<string, unknown>;
  /** The declared `securitySchemes` (top level, else `_meta.securitySchemes`); undefined when absent. */
  securitySchemes?: unknown;
};

export type Finding = {
  tools: string[];
  status: "warn" | "fail";
  /** The offending field or text. */
  evidence: string;
  fix: string;
};

export type Context = {
  /** A warning from this many tools on. */
  manyTools: number;
  skipped: { name: string; reason: string }[];
};

export type Outcome = {
  /** Tools the check applies to; none means not applicable. */
  applies: string[];
  findings: Finding[];
};

export type Check = {
  id: string;
  criterion: string;
  /** Directories whose published criteria this prepares for; empty means the MCP spec or product. */
  directories: Directory[];
  sources: Source[];
  /** Evidence shown when every applicable tool passes. */
  passed: string | ((tools: Tool[]) => string);
  /** Why the check can't apply, shown when it applies to no tool. */
  notApplicable: string;
  run(tools: Tool[], context: Context): Outcome;
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);
const quote = (text: string, max = 160) => JSON.stringify(clip(text, max));
/** A value as compact JSON, shortened. */
const json = (value: unknown, max = 80) => clip(JSON.stringify(value ?? null), max);
const HINTS = ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"] as const;
type Hint = (typeof HINTS)[number];
/** The hint's value when it is a boolean; mistyped values count as missing. */
const hint = (t: Tool, key: Hint) =>
  typeof t.annotations[key] === "boolean" ? (t.annotations[key] as boolean) : undefined;
/** The hints by the names owners see on the connector page. */
const LABEL: Record<Hint, string> = {
  readOnlyHint: "Read-only",
  destructiveHint: "Destructive",
  idempotentHint: "Safe to repeat",
  openWorldHint: "Open world",
};
/** "a, b and c" (or "a, b or c"). */
const list = (items: string[], last = "and") =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ${last} ${items.at(-1)}`;
/** Hints set to something other than true or false, e.g. `Read-only is set to "true", not on or off.` */
const mistyped = (t: Tool, keys: readonly Hint[]) =>
  keys
    .filter((k) => k in t.annotations && hint(t, k) === undefined)
    .map((k) => ` ${LABEL[k]} is set to ${json(t.annotations[k], 30)}, not on or off.`)
    .join("");

function properties(t: Tool): Record<string, Record<string, unknown>> {
  const props = isObject(t.schema) ? t.schema.properties : undefined;
  if (!isObject(props)) return {};
  return Object.fromEntries(
    Object.entries(props).map(([k, v]) => [k, isObject(v) ? v : {}]),
  );
}
/** Property names as snake_case words, e.g. `pageSize` → `page_size`. */
const snake = (name: string) => words(name).join("_");

/** Every `description` string in a schema, for the prompt-injection scan. */
function schemaTexts(schema: unknown, depth = 0, out: string[] = []): string[] {
  if (depth > 6 || !schema || typeof schema !== "object") return out;
  if (Array.isArray(schema)) {
    for (const item of schema) schemaTexts(item, depth + 1, out);
    return out;
  }
  for (const [key, value] of Object.entries(schema)) {
    if ((key === "description" || key === "title") && typeof value === "string") out.push(value);
    else schemaTexts(value, depth + 1, out);
  }
  return out;
}

const per = (
  tools: Tool[],
  applies: (t: Tool) => boolean,
  find: (t: Tool) => Omit<Finding, "tools"> | undefined,
): Outcome => {
  const applicable = tools.filter(applies);
  return {
    applies: applicable.map((t) => t.name),
    findings: applicable.flatMap((t) => {
      const f = find(t);
      return f ? [{ ...f, tools: [t.name] }] : [];
    }),
  };
};
const all = () => true;
/** Tools that declare themselves read-only, or, if they don't say, whose name reads as a read. */
const reads = (t: Tool) => hint(t, "readOnlyHint") ?? intentOf(t.name) === "read";
/** Tools that explicitly declare they change data. */
const declaredWrites = (t: Tool) => hint(t, "readOnlyHint") === false;

// ---------------------------------------------------------------------------------------------
// Annotations

const title: Check = {
  id: "annotations.title",
  criterion: "Every tool has a human-readable title",
  directories: ["claude"],
  sources: [SOURCES.claudeSubmission, SOURCES.claudePolicy],
  passed: "Every tool has a title.",
  notApplicable: "No tools listed.",
  run: (tools) =>
    per(tools, all, (t) => {
      if (!t.title?.trim())
        return {
          status: "fail",
          evidence: "No title.",
          fix: `Add a short title, such as ${quote(titleFrom(t.name))} (title or annotations.title).`,
        };
      if (t.title === t.name && /[_\-.]|[a-z][A-Z]/.test(t.name))
        return {
          status: "warn",
          evidence: `The title ${quote(t.title)} repeats the tool’s code name.`,
          fix: `Use a human-readable title, such as ${quote(titleFrom(t.name))}.`,
        };
    }),
};

const claudeHints: Check = {
  id: "annotations.claude_hints",
  criterion: "Every tool says whether it is read-only or destructive",
  directories: ["claude"],
  sources: [SOURCES.claudeSubmission, SOURCES.claudeReview, SOURCES.claudePolicy],
  passed: "Every tool says whether it's read-only or destructive.",
  notApplicable: "No tools listed.",
  run: (tools) =>
    per(tools, all, (t) => {
      if (hint(t, "readOnlyHint") === true || hint(t, "destructiveHint") !== undefined) return;
      if (hint(t, "readOnlyHint") === false)
        return {
          status: "warn",
          evidence: "Changes data, but doesn't say whether it's destructive.",
          fix: "Turn Destructive on if it can delete or overwrite data, off if it only adds (destructiveHint).",
        };
      return {
        status: "fail",
        evidence: `Doesn't say whether it's read-only or destructive.${mistyped(t, ["readOnlyHint", "destructiveHint"])}`,
        fix:
          intentOf(t.name) === "read"
            ? "If it only reads, turn Read-only on and Destructive off (readOnlyHint: true, destructiveHint: false)."
            : "Turn Read-only on if it only reads. Otherwise, turn it off and turn Destructive on if it can delete or overwrite data (readOnlyHint, destructiveHint).",
      };
    }),
};

/** Google Connected Apps: tools declare readOnlyHint / destructiveHint (destructive pre-ticks "User confirmation required"). */
const geminiHints: Check = {
  ...claudeHints,
  id: "annotations.gemini_hints",
  directories: ["gemini"],
  sources: [SOURCES.googleMcp],
};

const chatgptHints: Check = {
  id: "annotations.chatgpt_hints",
  criterion: "Read-only, Destructive and Open world are each set",
  directories: ["chatgpt"],
  sources: [SOURCES.openai],
  passed: "Every tool sets Read-only, Destructive and Open world.",
  notApplicable: "No tools listed.",
  run: (tools) =>
    per(tools, all, (t) => {
      const missing = (["readOnlyHint", "destructiveHint", "openWorldHint"] as const).filter(
        (k) => hint(t, k) === undefined,
      );
      if (!missing.length) return;
      return {
        status: "fail",
        evidence: `Doesn't say whether it's ${list(missing.map((k) => LABEL[k].toLowerCase()), "or")}.${mistyped(t, missing)}`,
        fix: `Set ${list(missing.map((k) => LABEL[k]))} explicitly (${missing.join(", ")}). Open world means the tool reaches people or services outside your product. Without these hints, AI apps assume defaults that may misdescribe the tool.`,
      };
    }),
};

const consistent: Check = {
  id: "annotations.consistent",
  criterion: "Hints don't contradict each other",
  directories: [],
  sources: [SOURCES.mcpAnnotations],
  passed: "No tool is marked both read-only and destructive.",
  notApplicable: "No tools listed.",
  run: (tools) =>
    per(tools, all, (t) =>
      hint(t, "readOnlyHint") === true && hint(t, "destructiveHint") === true
        ? {
            status: "warn",
            evidence: "Marked both read-only and destructive.",
            fix: "A read-only tool changes nothing: turn Destructive off, or turn Read-only off if it does change data.",
          }
        : undefined,
    ),
};

const readOnlyAccurate: Check = {
  id: "annotations.read_only_accurate",
  criterion: "Read-only matches what the tool's name says it does",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES.claudeReview, SOURCES.openai],
  passed: "No tool's name contradicts its Read-only setting.",
  notApplicable: "No tool sets Read-only with a name that clearly reads or writes.",
  run: (tools) =>
    per(
      tools,
      (t) => hint(t, "readOnlyHint") !== undefined && intentOf(t.name) !== "unknown",
      (t) => {
        const readOnly = hint(t, "readOnlyHint");
        const intent = intentOf(t.name);
        if (readOnly && intent === "write")
          return {
            status: "warn",
            evidence: `Marked read-only, but its name starts with “${verbOf(t.name)}”.`,
            fix: "If it creates, changes, sends or deletes anything, turn Read-only off. If it only reads, rename it so the name says so.",
          };
        if (!readOnly && intent === "read")
          return {
            status: "warn",
            evidence: `Marked as changing data, but its name starts with “${verbOf(t.name)}”.`,
            fix: "If it only reads, turn Read-only on so AI apps can run it without asking. If it has side effects, say so in the description.",
          };
      },
    ),
};

const destructiveAccurate: Check = {
  id: "annotations.destructive_accurate",
  criterion: "Tools that delete, cancel or overwrite are marked destructive",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES.claudeReview, SOURCES.openai],
  passed: "Every tool named for deleting, cancelling or overwriting is marked destructive.",
  notApplicable: "No write tool is named for deleting, cancelling or overwriting.",
  run: (tools) =>
    per(
      tools,
      (t) => hint(t, "readOnlyHint") !== true && looksDestructive(t.name),
      (t) =>
        hint(t, "destructiveHint") === false
          ? {
              status: "warn",
              evidence: `Not marked destructive, but its name starts with “${verbOf(t.name)}”.`,
              fix: "Turn Destructive on so AI apps ask before running it, unless the action can be fully undone.",
            }
          : undefined,
    ),
};

const openWorldAccurate: Check = {
  id: "annotations.open_world_accurate",
  criterion: "Tools that send or publish are marked open world",
  directories: ["chatgpt"],
  sources: [SOURCES.openai, SOURCES.mcpAnnotations],
  passed: "Every tool named for sending or publishing is marked open world.",
  notApplicable: "No write tool is named for sending, posting or publishing.",
  run: (tools) =>
    per(
      tools,
      (t) => hint(t, "readOnlyHint") !== true && looksPublic(t.name),
      (t) =>
        hint(t, "openWorldHint") === false
          ? {
              status: "warn",
              evidence: `Not marked open world, but its name starts with “${verbOf(t.name)}”.`,
              fix: "If it reaches other people or public places (email, messages, posts), turn Open world on.",
            }
          : undefined,
    ),
};

const idempotent: Check = {
  id: "annotations.idempotent",
  criterion: "Write tools say whether retrying repeats the effect",
  directories: ["chatgpt"],
  sources: [SOURCES.openai, SOURCES.mcpAnnotations],
  passed: "Every write tool says whether calling it twice repeats the effect.",
  notApplicable: "No tool is marked as changing data.",
  run: (tools) =>
    per(tools, declaredWrites, (t) =>
      hint(t, "idempotentHint") === undefined
        ? {
            status: "warn",
            evidence: "Changes data, but doesn't say whether calling it twice repeats the effect.",
            fix: "Set Safe to repeat (idempotentHint): true if calling again with the same inputs changes nothing more (set, replace, delete by ID), false if it repeats (create, send, charge).",
          }
        : undefined,
    ),
};

// ---------------------------------------------------------------------------------------------
// Names

const NAME_CHARS = /^[A-Za-z0-9_.-]+$/;
const names: Check = {
  id: "names.valid",
  criterion: "Names are unique, 64 characters or fewer, and use safe characters",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES.claudeReview, SOURCES.claudePolicy, SOURCES.openai, SOURCES.mcpTools],
  passed: "Every name is unique, 64 characters or fewer, and uses letters, digits, _ - or .",
  notApplicable: "No tools listed.",
  run: (tools) => {
    const counts = new Map<string, number>();
    for (const t of tools) counts.set(t.name, (counts.get(t.name) ?? 0) + 1);
    const findings: Finding[] = [];
    for (const [name, n] of counts)
      if (n > 1)
        findings.push({
          tools: [name],
          status: "fail",
          evidence: `Two or more tools are called ${quote(name)} (${n}).`,
          fix: "Give every tool a different name; clients call tools by name.",
        });
    for (const t of tools) {
      if (!t.name)
        findings.push({ tools: [t.name], status: "fail", evidence: "Empty name.", fix: "Name the tool after what it does, e.g. get_order_status." });
      else if (t.name.length > 64)
        findings.push({
          tools: [t.name],
          status: "fail",
          evidence: `The name is ${t.name.length} characters long.`,
          fix: "Shorten the name to 64 characters or fewer.",
        });
      else if (!NAME_CHARS.test(t.name))
        findings.push({
          tools: [t.name],
          status: "warn",
          evidence: `The name ${quote(t.name)} has characters other than letters, digits, _ - and .`,
          fix: "Use only letters, digits, underscores and hyphens; spaces and punctuation break some clients.",
        });
    }
    return { applies: tools.map((t) => t.name), findings };
  },
};

const GENERIC = new Set(
  `tool tools run execute exec do action call request handler handle process query api main test
   invoke perform go fn func function op operation command cmd method helper util utils misc
   default data http`.split(/\s+/),
);
const clearNames: Check = {
  id: "names.clear",
  criterion: "Names say what the tool does, in plain words",
  directories: ["chatgpt"],
  sources: [SOURCES.openai],
  passed: "No name is generic or an opaque identifier.",
  notApplicable: "No tools listed.",
  run: (tools) =>
    per(tools, (t) => Boolean(t.name), (t) => {
      const w = words(t.name);
      const opaque =
        t.name.length < 3 ||
        !/[a-z]/i.test(t.name) ||
        GENERIC.has(w.join("_")) ||
        /^(tool|fn|func|op|action|cmd|t|f)[_-]?\d+$/i.test(t.name) ||
        w.some((x) => /\d{4,}/.test(x) || (/^[0-9a-f]{8,}$/.test(x) && /\d/.test(x)));
      if (opaque)
        return {
          status: "warn",
          evidence: `The name ${quote(t.name)} doesn't say what the tool does.`,
          fix: "Use a verb and an object, e.g. get_order_status or search_products.",
        };
    }),
};

// ---------------------------------------------------------------------------------------------
// Descriptions

const described: Check = {
  id: "descriptions.present",
  criterion: "Every tool has a description",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES.openai, SOURCES.claudeReview],
  passed: "Every tool has a description.",
  notApplicable: "No tools listed.",
  run: (tools) =>
    per(tools, all, (t) =>
      t.description.trim()
        ? undefined
        : {
            status: "fail",
            evidence: "The description is empty.",
            fix: "Say what the tool does, what it returns, when to use it, and any side effects or limits.",
          },
    ),
};

const detailed: Check = {
  id: "descriptions.detail",
  criterion: "Descriptions explain purpose, result and when to use the tool",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES.openai, SOURCES.claudeReview, SOURCES.claudePolicy],
  passed: "Every description is more than a restatement of the name.",
  notApplicable: "No tool has a description.",
  run: (tools) =>
    per(tools, (t) => Boolean(t.description.trim()), (t) => {
      const text = words(t.description).join(" ");
      const restates = text === words(t.name).join(" ") || (t.title && text === words(t.title).join(" "));
      if (restates || text.split(" ").length < 5)
        return {
          status: "warn",
          evidence: `The description is too brief: ${quote(t.description)}`,
          fix: "Add what the tool returns and when to use it (and, for changes, what it changes). One or two plain sentences is enough.",
        };
    }),
};

const HIDDEN = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]|[\u{E0000}-\u{E007F}]/u;
const OVERRIDE: RegExp[] = [
  /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(instructions?|prompts?|rules|guidelines|guardrails)\b/i,
  /\bsystem prompt\b/i,
  /\b(do not|don['’]t|never)\s+(tell|inform|mention|reveal|show|disclose)\b[^.\n]{0,30}\buser\b/i,
  /<\/?\s*(important|system|instructions?|secret)\s*>/i,
  /<!--/,
];
const STEERING: RegExp[] = [
  /\b(always|must)\s+(use|call|invoke|run)\s+this\s+tool\b/i,
  /\b(instead of|rather than)\s+(any\s+|the\s+)?other\s+(tools?|apps?|connectors?|plugins?|servers?)\b/i,
  /\b(do not|don['’]t|never)\s+(use|call|invoke)\s+(any\s+)?other\s+(tools?|apps?|connectors?|plugins?|servers?)\b/i,
  /\bbefore\s+(using|calling)\s+any\s+other\s+tools?\b/i,
  /\b(fetch|read|load|download|follow|obey)\b[^.\n]{0,40}\binstructions\b[^.\n]{0,20}\b(from|at)\b/i,
];
const ENCODED = /[A-Za-z0-9+/]{80,}={0,2}/;
const PROMO: RegExp[] = [
  /(^|\s)#1\b/,
  /\bnumber one\b/i,
  /\bworld['’]?s (best|leading|first|most)\b/i,
  /\bindustry[- ]leading\b/i,
  /\bbetter than\b/i,
  /\bsuperior to\b/i,
  /\bthe best (tool|app|service|choice|option|way|solution)\b/i,
  /\bunlike (other|competing|competitor)/i,
];
function snippet(text: string, match: RegExpExecArray) {
  const start = Math.max(0, match.index - 30);
  return quote(text.slice(start, match.index + match[0].length + 30).trim(), 120);
}
const codePoint = (ch: string) => `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;

const injection: Check = {
  id: "descriptions.no_injection",
  criterion: "Descriptions describe the tool and don't instruct the model",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES.claudeReview, SOURCES.claudePolicy, SOURCES.openai],
  passed: "No hidden characters, override phrases or steering found in names, titles or descriptions.",
  notApplicable: "No tools listed.",
  run: (tools) =>
    per(tools, all, (t) => {
      const texts = [t.description, t.title ?? "", ...schemaTexts(t.schema)];
      for (const text of texts) {
        const hidden = HIDDEN.exec(text);
        if (hidden)
          return {
            status: "fail",
            evidence: `Invisible character ${codePoint(hidden[0])} in ${quote(text, 80)}.`,
            fix: "Remove invisible and direction-changing characters; all guidance must be readable.",
          };
      }
      for (const text of texts)
        for (const re of OVERRIDE) {
          const m = re.exec(text);
          if (m)
            return {
              status: "fail",
              evidence: snippet(text, m),
              fix: "Describe what the tool does; don't address the model's instructions, hide text or tell it what to keep from the user.",
            };
        }
      for (const text of texts) {
        for (const re of STEERING) {
          const m = re.exec(text);
          if (m)
            return {
              status: "warn",
              evidence: snippet(text, m),
              fix: "Say when the tool is useful instead of telling the model to prefer it, avoid other tools, or load instructions from elsewhere.",
            };
        }
        const encoded = ENCODED.exec(text);
        if (encoded)
          return {
            status: "warn",
            evidence: `Long encoded-looking text: ${quote(encoded[0], 40)}.`,
            fix: "Remove encoded blobs from descriptions; reviewers treat them as possible hidden instructions.",
          };
      }
    }),
};

const promotional: Check = {
  id: "descriptions.not_promotional",
  criterion: "Names and descriptions aren't promotional or comparative",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES.openai, SOURCES.claudeReview],
  passed: "No promotional or comparative wording found.",
  notApplicable: "No tools listed.",
  run: (tools) =>
    per(tools, all, (t) => {
      for (const text of [t.name, t.title ?? "", t.description])
        for (const re of PROMO) {
          const m = re.exec(text);
          if (m)
            return {
              status: "warn",
              evidence: snippet(text, m),
              fix: "State what the tool does without ranking it against other tools or services.",
            };
        }
    }),
};

// ---------------------------------------------------------------------------------------------
// Input schemas

const schemaValid: Check = {
  id: "schema.valid",
  criterion: "Input schema is a JSON Schema object with consistent required fields",
  directories: [],
  sources: [SOURCES.mcpTools],
  passed: "Every input schema is an object schema, and every required field is defined.",
  notApplicable: "No tools listed.",
  run: (tools) =>
    per(tools, all, (t) => {
      const s = t.schema;
      if (!isObject(s) || s.type !== "object")
        return {
          status: "fail",
          evidence: `Its inputs aren't described as an object: ${json(s)}`,
          fix: 'Use an object schema: { "type": "object", "properties": { … } }, or { "type": "object", "additionalProperties": false } for no inputs.',
        };
      if (s.required !== undefined && (!Array.isArray(s.required) || s.required.some((r) => typeof r !== "string")))
        return {
          status: "fail",
          evidence: `The list of required inputs isn't a list of names: ${json(s.required)}`,
          fix: "Make required an array of property names.",
        };
      const props = properties(t);
      const undefinedRequired = ((s.required as string[] | undefined) ?? []).filter((r) => !(r in props));
      if (undefinedRequired.length)
        return {
          status: "fail",
          evidence: `${undefinedRequired.map((r) => quote(r)).join(", ")} ${undefinedRequired.length > 1 ? "are" : "is"} marked required but ${undefinedRequired.length > 1 ? "aren't" : "isn't"} defined as ${undefinedRequired.length > 1 ? "inputs" : "an input"}.`,
          fix: "Define every required field under properties, or drop it from required.",
        };
    }),
};

const TYPED = ["type", "enum", "const", "$ref", "anyOf", "oneOf", "allOf"];
const schemaTypes: Check = {
  id: "schema.types",
  criterion: "Every input has a type",
  directories: [],
  sources: [SOURCES.mcpTools, SOURCES.claudeReview],
  passed: "Every input declares a type (or enum, const or composition).",
  notApplicable: "No tool takes inputs.",
  run: (tools) =>
    per(tools, (t) => Object.keys(properties(t)).length > 0, (t) => {
      const untyped = Object.entries(properties(t))
        .filter(([, p]) => !TYPED.some((k) => k in p))
        .map(([k]) => k);
      if (untyped.length)
        return {
          status: "warn",
          evidence: `${untyped.length > 1 ? "These inputs have" : "This input has"} no type: ${untyped.join(", ")}.`,
          fix: "Give each input a type (string, integer, boolean, array, object) so clients and models send valid values.",
        };
    }),
};

const schemaDescriptions: Check = {
  id: "schema.descriptions",
  criterion: "Inputs are described",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES.openai, SOURCES.claudeReview, SOURCES.mcpTools],
  passed: "Every input has a description.",
  notApplicable: "No tool takes inputs.",
  run: (tools) =>
    per(tools, (t) => Object.keys(properties(t)).length > 0, (t) => {
      const bare = Object.entries(properties(t))
        .filter(([, p]) => typeof p.description !== "string" || !p.description.trim())
        .map(([k]) => k);
      if (bare.length)
        return {
          status: "warn",
          evidence: `${bare.length > 1 ? "These inputs have" : "This input has"} no description: ${bare.join(", ")}.`,
          fix: "Describe each input: what it is, its format, and where to get it (e.g. “Order ID from list_orders”).",
        };
    }),
};

const ID = /(^|_)(id|ids|uuid|key|slug)$/;
const schemaRequired: Check = {
  id: "schema.required",
  criterion: "Inputs a tool can't work without are required",
  directories: [],
  sources: [SOURCES.mcpTools, SOURCES.claudeReview],
  passed: "Tools acting on one record by ID mark the ID required.",
  notApplicable: "No tool acts on a single record by ID.",
  run: (tools) =>
    per(
      tools,
      (t) => {
        const verb = verbOf(t.name);
        return (
          Boolean(verb) &&
          !["list", "search", "find", "query", "browse", "export", "create", "add", "new", "count"].includes(verb!) &&
          Object.keys(properties(t)).some((k) => ID.test(snake(k)))
        );
      },
      (t) => {
        const s = t.schema as Record<string, unknown>;
        if (Array.isArray(s.required) && s.required.length) return;
        const ids = Object.keys(properties(t)).filter((k) => ID.test(snake(k)));
        return {
          status: "warn",
          evidence: `No input is marked required, but ${ids.join(", ")} look${ids.length > 1 ? "" : "s"} necessary.`,
          fix: `Add ${ids.map((k) => quote(k)).join(", ")} to required if the tool can't run without ${ids.length > 1 ? "them" : "it"}, so bad calls fail with a clear error.`,
        };
      },
    ),
};

const CONVERSATION = new Set(
  `conversation conversation_history chat chat_history chat_log transcript full_transcript
   prior_turns previous_messages message_history context full_context user_context memory memories`.split(/\s+/),
);
const SECRET = new Set(
  `password passwd api_key apikey secret client_secret access_token refresh_token private_key
   credentials otp ssn card_number cvv cvc`.split(/\s+/),
);
const minimalInputs: Check = {
  id: "schema.minimal_inputs",
  criterion: "Inputs don't ask for conversation history or credentials",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES.openai, SOURCES.claudeReview, SOURCES.claudeSubmission],
  passed: "No input asks for chat history, broad context or secrets.",
  notApplicable: "No tool takes inputs.",
  run: (tools) =>
    per(tools, (t) => Object.keys(properties(t)).length > 0, (t) => {
      const keys = Object.keys(properties(t));
      const context = keys.filter((k) => CONVERSATION.has(snake(k)));
      if (context.length)
        return {
          status: "warn",
          evidence: `Asks for conversation context: ${context.join(", ")}.`,
          fix: "Ask only for the fields this tool needs, not the conversation or broad context.",
        };
      const secrets = keys.filter((k) => SECRET.has(snake(k)));
      if (secrets.length)
        return {
          status: "warn",
          evidence: `Asks for secrets or sensitive numbers: ${secrets.join(", ")}.`,
          fix: "Don't take credentials or sensitive numbers as tool arguments; sign users in with OAuth and act on their account.",
        };
    }),
};

// ---------------------------------------------------------------------------------------------
// Read/write separation and custom query tools

const METHOD = new Set(["method", "http_method", "request_method", "verb", "http_verb"]);
const PATHLIKE = new Set(["path", "url", "uri", "endpoint", "route", "api_path", "resource_path", "request_path", "api_url"]);
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const MODE = new Set(["action", "operation", "op", "mode", "command"]);

const freeString = (p: Record<string, unknown>) => !("enum" in p) && !("const" in p) && (p.type === undefined || p.type === "string");
function methodProps(t: Tool) {
  return Object.entries(properties(t)).filter(([k]) => METHOD.has(snake(k)));
}
function pathProps(t: Tool) {
  return Object.entries(properties(t)).filter(([k, p]) => PATHLIKE.has(snake(k)) && freeString(p));
}

const separated: Check = {
  id: "tools.read_write_separated",
  criterion: "No single tool both reads and changes data",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES.claudeReview, SOURCES.openai],
  passed: "No tool takes an HTTP method, or a read-or-write mode, as an argument.",
  notApplicable: "No tool takes a method, action or mode argument.",
  run: (tools) =>
    per(
      tools,
      (t) => methodProps(t).length > 0 || Object.keys(properties(t)).some((k) => MODE.has(snake(k))),
      (t) => {
        for (const [key, p] of methodProps(t)) {
          if (Array.isArray(p.enum)) {
            const values = p.enum.map((v) => String(v).toUpperCase());
            if (values.some((v) => SAFE.has(v)) && values.some((v) => UNSAFE.has(v)))
              return {
                status: "fail",
                evidence: `The ${key} input lets one tool both read and change data (${json(p.enum)}).`,
                fix: "Split this into a read-only tool and separate write tools (ideally one each for create, update and delete). Explaining the difference in the description isn't enough.",
              };
          } else if (freeString(p) && pathProps(t).length)
            return {
              status: "fail",
              evidence: `The ${key} input is free text next to ${pathProps(t)[0][0]}, so one tool can make any kind of request.`,
              fix: "Replace the catch-all request tool with a read-only tool and separate write tools; don't take the HTTP method as an argument.",
            };
        }
        for (const [key, p] of Object.entries(properties(t)).filter(([k]) => MODE.has(snake(k)))) {
          if (!Array.isArray(p.enum)) continue;
          const intents = new Set(p.enum.map((v) => intentOf(String(v))));
          if (intents.has("read") && intents.has("write"))
            return {
              status: "warn",
              evidence: `The ${key} input mixes reads and changes (${json(p.enum)}).`,
              fix: "Split reads and changes into separate tools so each can say accurately whether it's read-only or destructive.",
            };
        }
      },
    ),
};

const QUERY_NAMES = new Set(["request", "http", "api", "graphql", "sql", "raw", "proxy", "fetch", "call"]);
const API_REFERENCE = /https?:\/\/\S+|\b[A-Z][A-Za-z0-9.]*(\s+[A-Z][A-Za-z0-9.]*)*\s+(REST\s+|GraphQL\s+|Web\s+|HTTP\s+)?API\b/;
const customQuery: Check = {
  id: "tools.custom_query_documented",
  criterion: "Tools that take free-form paths or queries name the API they call",
  directories: ["claude"],
  sources: [SOURCES.claudeReview],
  passed: "Every free-form query tool links to or names its target API.",
  notApplicable: "No tool takes a free-form endpoint, path or query.",
  run: (tools) =>
    per(
      tools,
      (t) => {
        const named = words(t.name).some((w) => QUERY_NAMES.has(w));
        const queryProp = Object.entries(properties(t)).some(
          ([k, p]) => ["query", "sql", "graphql", "body", "request_body"].includes(snake(k)) && freeString(p),
        );
        return (pathProps(t).length > 0 && (methodProps(t).length > 0 || named)) ||
          (queryProp && words(t.name).some((w) => w === "graphql" || w === "sql"));
      },
      (t) =>
        API_REFERENCE.test(t.description)
          ? undefined
          : {
              status: "warn",
              evidence: `The description doesn't name the API it uses: ${quote(t.description || "(empty)")}`,
              fix: "Name the API this tool queries and link its reference docs, e.g. “Queries the Acme REST API, see https://docs.acme.example/api”.",
            },
    ),
};

// ---------------------------------------------------------------------------------------------
// Outputs, errors and size

const PAGING = new Set(
  `limit page page_size per_page page_number cursor next_cursor offset max max_results max_items
   max_count top first last count size page_token next_token next_page_token starting_after
   ending_before after before skip take num_results`.split(/\s+/),
);
const MANY = new Set(["list", "search", "find", "query", "browse", "export"]);
const bounded: Check = {
  id: "outputs.bounded",
  criterion: "List and search tools can return a bounded page",
  directories: ["claude"],
  sources: [SOURCES.claudePolicy, SOURCES.claudeReview],
  passed: "Every list or search tool takes a limit, page or cursor argument.",
  notApplicable: "No read tool is named for listing or searching.",
  run: (tools) =>
    per(
      tools,
      (t) => reads(t) && (MANY.has(verbOf(t.name) ?? "") || words(t.name).some((w) => ["all", "history", "logs", "feed"].includes(w))),
      (t) =>
        Object.keys(properties(t)).some((k) => PAGING.has(snake(k)))
          ? undefined
          : {
              status: "warn",
              evidence: "Returns a list with no limit or paging input.",
              fix: "Add a limit (with a sensible default and maximum) and a cursor or page argument, and say in the description that results are paged. Directories expect token use in proportion to the task.",
            },
    ),
};

const errors: Check = {
  id: "errors.useful",
  criterion: "Errors are specific and actionable",
  directories: ["claude"],
  sources: [SOURCES.claudePolicy, SOURCES.claudeReview, SOURCES.mcpTools],
  passed: "",
  notApplicable:
    "Can’t be checked from tools/list alone. Connector test results cover this (rejected arguments, calls abandoned after an error).",
  run: () => ({ applies: [], findings: [] }),
};

const count: Check = {
  id: "tools.count",
  criterion: "The server lists a focused set of tools",
  directories: [],
  sources: [SOURCES.product],
  passed: (tools) => `${tools.length} tool${tools.length === 1 ? "" : "s"} listed.`,
  notApplicable: "",
  run: (tools, ctx) => {
    const names = tools.map((t) => t.name);
    if (!tools.length)
      return {
        applies: ["(server)"],
        findings: [{ tools: [], status: "fail", evidence: "tools/list returned no tools.", fix: "List at least one tool." }],
      };
    // Our drafts' general page reader already reads any mapped page, so single-page tools can go.
    const pageReader = names.find((n) => /^read_site_page(_\d+)?$/.test(n));
    return {
      applies: names,
      findings:
        tools.length >= ctx.manyTools
          ? [
              {
                tools: [],
                status: "warn",
                evidence: `${tools.length} tools listed.`,
                fix: `With ${ctx.manyTools} or more tools, agents choose less reliably. Merge overlapping tools${
                  pageReader ? `: ${pageReader} already reads any mapped page, so single-page tools can be removed` : ", or split the server by task"
                }.`,
              },
            ]
          : [],
    };
  },
};

const SCHEMES = new Set(["noauth", "oauth2"]);
const securitySchemes: Check = {
  id: "auth.security_schemes",
  criterion: "When tools declare how they sign in, every tool does, with noauth or oauth2",
  directories: ["chatgpt"],
  sources: [SOURCES.openaiAuth],
  passed: "Every tool declares noauth or oauth2.",
  notApplicable: "No tool declares securitySchemes.",
  run: (tools) => {
    if (!tools.some((t) => t.securitySchemes !== undefined)) return { applies: [], findings: [] };
    return per(tools, all, (t) => {
      if (t.securitySchemes === undefined)
        return {
          status: "warn",
          evidence: "securitySchemes is missing, but other tools declare it.",
          fix: 'Declare securitySchemes on every tool: [{"type":"noauth"}] for tools anyone can call, [{"type":"oauth2","scopes":[...]}] for tools that need sign-in.',
        };
      const list = t.securitySchemes;
      if (!Array.isArray(list) || !list.length || list.some((s) => !isObject(s) || !SCHEMES.has(String(s.type))))
        return {
          status: "warn",
          evidence: `Its sign-in setting (securitySchemes) isn't one ChatGPT reads: ${json(list)}`,
          fix: 'Use a non-empty list of {"type":"noauth"} or {"type":"oauth2","scopes":[...]}.',
        };
    });
  },
};

const skipped: Check = {
  id: "tools.usable",
  criterion: "Every listed tool can be imported and called",
  directories: [],
  sources: [SOURCES.mcpTools, SOURCES.product],
  passed: "Every listed tool can be imported.",
  notApplicable: "No tools listed.",
  run: (tools, ctx) => ({
    applies: tools.length || ctx.skipped.length ? ["(server)"] : [],
    findings: ctx.skipped.map((s) => ({
      tools: [s.name],
      status: "warn" as const,
      evidence: s.reason,
      fix: "Fix this tool's name or input schema so clients can call it.",
    })),
  }),
};

export const CHECKS: Check[] = [
  count,
  skipped,
  securitySchemes,
  title,
  claudeHints,
  geminiHints,
  chatgptHints,
  consistent,
  readOnlyAccurate,
  destructiveAccurate,
  openWorldAccurate,
  idempotent,
  separated,
  customQuery,
  names,
  clearNames,
  described,
  detailed,
  injection,
  promotional,
  schemaValid,
  schemaTypes,
  schemaDescriptions,
  schemaRequired,
  minimalInputs,
  bounded,
  errors,
];

