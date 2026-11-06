#!/usr/bin/env node

// src/sources.ts
var SOURCES = {
  openaiSubmission: {
    id: "openai-submission",
    title: "OpenAI: Upload and submit your plugin",
    url: "https://developers.openai.com/plugins/deploy/submission"
  },
  openaiReview: {
    id: "openai-review",
    title: "OpenAI: Remote MCP server review requirements",
    url: "https://developers.openai.com/plugins/deploy/app-review"
  },
  openaiGuidelines: {
    id: "openai-guidelines",
    title: "OpenAI: App submission guidelines",
    url: "https://developers.openai.com/apps-sdk/app-submission-guidelines"
  },
  claudeSubmission: {
    id: "claude-submission",
    title: "Claude: Submit a connector to the directory",
    url: "https://claude.com/docs/connectors/building/submission"
  },
  claudeReview: {
    id: "claude-review",
    title: "Claude: Connector pre-submission checklist",
    url: "https://claude.com/docs/connectors/building/review-criteria"
  },
  claudePolicy: {
    id: "claude-policy",
    title: "Anthropic Software Directory Policy",
    url: "https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy"
  },
  claudeListing: {
    id: "claude-listing",
    title: "Claude: Manage your directory listing",
    url: "https://claude.com/docs/connectors/building/managing-your-listing"
  },
  claudeAfterPublishing: {
    id: "claude-after-publishing",
    title: "Claude: After publishing",
    url: "https://claude.com/docs/connectors/building/after-publishing"
  },
  claudeDirectory: {
    id: "claude-directory",
    title: "Claude: Connectors directory",
    url: "https://claude.com/docs/connectors/directory"
  },
  // Google Connected Apps (Gemini), read 31 Oct 2026.
  googleOverview: {
    id: "google-overview",
    title: "Google: Connected Apps overview",
    url: "https://developers.google.com/connected-apps"
  },
  googleMcp: {
    id: "google-mcp",
    title: "Google: Build a connected app with an MCP server",
    url: "https://developers.google.com/connected-apps/mcp"
  },
  googleOauth: {
    id: "google-oauth",
    title: "Google: OAuth for connected apps",
    url: "https://developers.google.com/connected-apps/mcp/oauth"
  },
  googlePrerequisites: {
    id: "google-prerequisites",
    title: "Google Connected Console: Prerequisites",
    url: "https://developers.google.com/connected-apps/gpc/prerequisites"
  },
  googleConsole: {
    id: "google-console",
    title: "Google Connected Console: Perform the steps",
    url: "https://developers.google.com/connected-apps/gpc/perform-the-steps"
  },
  googlePolicy: {
    id: "google-policy",
    title: "Google: Connected Apps policy",
    url: "https://developers.google.com/connected-apps/connected-apps-policy"
  },
  // Kept on 2025-11-25 (24 Oct 2026): the 2026-07-28 authorization page is split into subpages and
  // no longer carries the PKCE S256 and 401 discovery text these sign-in rules cite.
  mcpAuth: {
    id: "mcp-auth",
    title: "MCP specification: Authorization",
    url: "https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization"
  }
};

// src/tool-quality/sources.ts
var SOURCES2 = {
  claudeSubmission: {
    id: "claude-submission",
    title: "Claude: Submit a connector to the directory",
    url: "https://claude.com/docs/connectors/building/submission"
  },
  claudeReview: {
    id: "claude-review",
    title: "Claude: Connector pre-submission checklist",
    url: "https://claude.com/docs/connectors/building/review-criteria"
  },
  claudePolicy: {
    id: "claude-policy",
    title: "Anthropic Software Directory Policy",
    url: "https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy"
  },
  openai: {
    id: "openai-submission",
    title: "OpenAI Apps SDK: App submission guidelines",
    url: "https://developers.openai.com/apps-sdk/app-submission-guidelines"
  },
  openaiAuth: {
    id: "openai-auth",
    title: "OpenAI Apps SDK: Reference (tool securitySchemes)",
    url: "https://developers.openai.com/apps-sdk/reference"
  },
  // Google Connected Apps (Gemini), read 31 Oct 2026.
  googleMcp: {
    id: "google-mcp",
    title: "Google: Build a connected app with an MCP server",
    url: "https://developers.google.com/connected-apps/mcp"
  },
  mcpTools: {
    id: "mcp-tools",
    title: "MCP specification: Tools",
    url: "https://modelcontextprotocol.io/specification/2026-07-28/server/tools"
  },
  mcpAnnotations: {
    id: "mcp-annotations",
    title: "MCP specification: ToolAnnotations",
    url: "https://modelcontextprotocol.io/specification/2026-07-28/schema#toolannotations"
  },
  product: {
    id: "product",
    title: "Advice, not a directory rule",
    url: ""
  }
};

// src/tool-quality/words.ts
var set = (words2) => new Set(words2.split(/\s+/).filter(Boolean));
var READ_VERBS = set(`
  get list search find read fetch lookup query count describe show view retrieve preview browse
  check inspect lookup summarize summarise export download explain validate verify estimate
  calculate compute compare resolve suggest recommend`);
var WRITE_VERBS = set(`
  create add insert new update edit modify set patch put save upsert delete remove destroy purge
  drop erase cancel revoke archive unarchive send post publish unpublish submit upload write move
  rename assign unassign invite share approve reject close reopen reset clear pay purchase buy
  book schedule reschedule transfer refund charge merge deploy trigger start stop enable disable
  subscribe unsubscribe like unlike follow unfollow comment reply email message tweet register
  import sync restore grant mark tag untag attach detach link unlink complete apply redeem`);
var DESTRUCTIVE_VERBS = set(`
  delete remove destroy purge drop erase cancel revoke overwrite replace reset clear wipe truncate
  deactivate terminate kill void unpublish unsubscribe detach unlink`);
var PUBLIC_VERBS = set(`
  send email message post publish tweet share invite comment reply broadcast notify announce push`);
function words(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}
function verbOf(name) {
  const w = words(name);
  const known = (v) => v && (READ_VERBS.has(v) || WRITE_VERBS.has(v));
  if (known(w[0])) return w[0];
  if (w.length > 1 && known(w[w.length - 1])) return w[w.length - 1];
  return void 0;
}
function intentOf(name) {
  const verb = verbOf(name);
  if (!verb) return "unknown";
  return READ_VERBS.has(verb) ? "read" : "write";
}
var looksDestructive = (name) => DESTRUCTIVE_VERBS.has(verbOf(name) ?? "");
var looksPublic = (name) => PUBLIC_VERBS.has(verbOf(name) ?? "");
function titleFrom(name) {
  const text2 = words(name).join(" ");
  return text2 ? text2[0].toUpperCase() + text2.slice(1) : name;
}

// src/tool-quality/checks.ts
var isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
var clip = (text2, max) => text2.length > max ? `${text2.slice(0, max)}\u2026` : text2;
var quote = (text2, max = 160) => JSON.stringify(clip(text2, max));
var json = (value, max = 80) => clip(JSON.stringify(value ?? null), max);
var hint = (t, key) => typeof t.annotations[key] === "boolean" ? t.annotations[key] : void 0;
var LABEL = {
  readOnlyHint: "Read-only",
  destructiveHint: "Destructive",
  idempotentHint: "Safe to repeat",
  openWorldHint: "Open world"
};
var list = (items, last = "and") => items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ${last} ${items.at(-1)}`;
var mistyped = (t, keys) => keys.filter((k) => k in t.annotations && hint(t, k) === void 0).map((k) => ` ${LABEL[k]} is set to ${json(t.annotations[k], 30)}, not on or off.`).join("");
function properties(t) {
  const props = isObject(t.schema) ? t.schema.properties : void 0;
  if (!isObject(props)) return {};
  return Object.fromEntries(
    Object.entries(props).map(([k, v]) => [k, isObject(v) ? v : {}])
  );
}
var snake = (name) => words(name).join("_");
function schemaTexts(schema, depth = 0, out = []) {
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
var per = (tools, applies, find) => {
  const applicable = tools.filter(applies);
  return {
    applies: applicable.map((t) => t.name),
    findings: applicable.flatMap((t) => {
      const f = find(t);
      return f ? [{ ...f, tools: [t.name] }] : [];
    })
  };
};
var all = () => true;
var reads = (t) => hint(t, "readOnlyHint") ?? intentOf(t.name) === "read";
var declaredWrites = (t) => hint(t, "readOnlyHint") === false;
var title = {
  id: "annotations.title",
  criterion: "Every tool has a human-readable title",
  directories: ["claude"],
  sources: [SOURCES2.claudeSubmission, SOURCES2.claudePolicy],
  passed: "Every tool has a title.",
  notApplicable: "No tools listed.",
  run: (tools) => per(tools, all, (t) => {
    if (!t.title?.trim())
      return {
        status: "fail",
        evidence: "No title.",
        fix: `Add a short title, such as ${quote(titleFrom(t.name))} (title or annotations.title).`
      };
    if (t.title === t.name && /[_\-.]|[a-z][A-Z]/.test(t.name))
      return {
        status: "warn",
        evidence: `The title ${quote(t.title)} repeats the tool\u2019s code name.`,
        fix: `Use a human-readable title, such as ${quote(titleFrom(t.name))}.`
      };
  })
};
var claudeHints = {
  id: "annotations.claude_hints",
  criterion: "Every tool says whether it is read-only or destructive",
  directories: ["claude"],
  sources: [SOURCES2.claudeSubmission, SOURCES2.claudeReview, SOURCES2.claudePolicy],
  passed: "Every tool says whether it's read-only or destructive.",
  notApplicable: "No tools listed.",
  run: (tools) => per(tools, all, (t) => {
    if (hint(t, "readOnlyHint") === true || hint(t, "destructiveHint") !== void 0) return;
    if (hint(t, "readOnlyHint") === false)
      return {
        status: "warn",
        evidence: "Changes data, but doesn't say whether it's destructive.",
        fix: "Turn Destructive on if it can delete or overwrite data, off if it only adds (destructiveHint)."
      };
    return {
      status: "fail",
      evidence: `Doesn't say whether it's read-only or destructive.${mistyped(t, ["readOnlyHint", "destructiveHint"])}`,
      fix: intentOf(t.name) === "read" ? "If it only reads, turn Read-only on and Destructive off (readOnlyHint: true, destructiveHint: false)." : "Turn Read-only on if it only reads. Otherwise, turn it off and turn Destructive on if it can delete or overwrite data (readOnlyHint, destructiveHint)."
    };
  })
};
var geminiHints = {
  ...claudeHints,
  id: "annotations.gemini_hints",
  directories: ["gemini"],
  sources: [SOURCES2.googleMcp]
};
var chatgptHints = {
  id: "annotations.chatgpt_hints",
  criterion: "Read-only, Destructive and Open world are each set",
  directories: ["chatgpt"],
  sources: [SOURCES2.openai],
  passed: "Every tool sets Read-only, Destructive and Open world.",
  notApplicable: "No tools listed.",
  run: (tools) => per(tools, all, (t) => {
    const missing = ["readOnlyHint", "destructiveHint", "openWorldHint"].filter(
      (k) => hint(t, k) === void 0
    );
    if (!missing.length) return;
    return {
      status: "fail",
      evidence: `Doesn't say whether it's ${list(missing.map((k) => LABEL[k].toLowerCase()), "or")}.${mistyped(t, missing)}`,
      fix: `Set ${list(missing.map((k) => LABEL[k]))} explicitly (${missing.join(", ")}). Open world means the tool reaches people or services outside your product. Without these hints, AI apps assume defaults that may misdescribe the tool.`
    };
  })
};
var consistent = {
  id: "annotations.consistent",
  criterion: "Hints don't contradict each other",
  directories: [],
  sources: [SOURCES2.mcpAnnotations],
  passed: "No tool is marked both read-only and destructive.",
  notApplicable: "No tools listed.",
  run: (tools) => per(
    tools,
    all,
    (t) => hint(t, "readOnlyHint") === true && hint(t, "destructiveHint") === true ? {
      status: "warn",
      evidence: "Marked both read-only and destructive.",
      fix: "A read-only tool changes nothing: turn Destructive off, or turn Read-only off if it does change data."
    } : void 0
  )
};
var readOnlyAccurate = {
  id: "annotations.read_only_accurate",
  criterion: "Read-only matches what the tool's name says it does",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES2.claudeReview, SOURCES2.openai],
  passed: "No tool's name contradicts its Read-only setting.",
  notApplicable: "No tool sets Read-only with a name that clearly reads or writes.",
  run: (tools) => per(
    tools,
    (t) => hint(t, "readOnlyHint") !== void 0 && intentOf(t.name) !== "unknown",
    (t) => {
      const readOnly = hint(t, "readOnlyHint");
      const intent = intentOf(t.name);
      if (readOnly && intent === "write")
        return {
          status: "warn",
          evidence: `Marked read-only, but its name starts with \u201C${verbOf(t.name)}\u201D.`,
          fix: "If it creates, changes, sends or deletes anything, turn Read-only off. If it only reads, rename it so the name says so."
        };
      if (!readOnly && intent === "read")
        return {
          status: "warn",
          evidence: `Marked as changing data, but its name starts with \u201C${verbOf(t.name)}\u201D.`,
          fix: "If it only reads, turn Read-only on so AI apps can run it without asking. If it has side effects, say so in the description."
        };
    }
  )
};
var destructiveAccurate = {
  id: "annotations.destructive_accurate",
  criterion: "Tools that delete, cancel or overwrite are marked destructive",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES2.claudeReview, SOURCES2.openai],
  passed: "Every tool named for deleting, cancelling or overwriting is marked destructive.",
  notApplicable: "No write tool is named for deleting, cancelling or overwriting.",
  run: (tools) => per(
    tools,
    (t) => hint(t, "readOnlyHint") !== true && looksDestructive(t.name),
    (t) => hint(t, "destructiveHint") === false ? {
      status: "warn",
      evidence: `Not marked destructive, but its name starts with \u201C${verbOf(t.name)}\u201D.`,
      fix: "Turn Destructive on so AI apps ask before running it, unless the action can be fully undone."
    } : void 0
  )
};
var openWorldAccurate = {
  id: "annotations.open_world_accurate",
  criterion: "Tools that send or publish are marked open world",
  directories: ["chatgpt"],
  sources: [SOURCES2.openai, SOURCES2.mcpAnnotations],
  passed: "Every tool named for sending or publishing is marked open world.",
  notApplicable: "No write tool is named for sending, posting or publishing.",
  run: (tools) => per(
    tools,
    (t) => hint(t, "readOnlyHint") !== true && looksPublic(t.name),
    (t) => hint(t, "openWorldHint") === false ? {
      status: "warn",
      evidence: `Not marked open world, but its name starts with \u201C${verbOf(t.name)}\u201D.`,
      fix: "If it reaches other people or public places (email, messages, posts), turn Open world on."
    } : void 0
  )
};
var idempotent = {
  id: "annotations.idempotent",
  criterion: "Write tools say whether retrying repeats the effect",
  directories: ["chatgpt"],
  sources: [SOURCES2.openai, SOURCES2.mcpAnnotations],
  passed: "Every write tool says whether calling it twice repeats the effect.",
  notApplicable: "No tool is marked as changing data.",
  run: (tools) => per(
    tools,
    declaredWrites,
    (t) => hint(t, "idempotentHint") === void 0 ? {
      status: "warn",
      evidence: "Changes data, but doesn't say whether calling it twice repeats the effect.",
      fix: "Set Safe to repeat (idempotentHint): true if calling again with the same inputs changes nothing more (set, replace, delete by ID), false if it repeats (create, send, charge)."
    } : void 0
  )
};
var NAME_CHARS = /^[A-Za-z0-9_.-]+$/;
var names = {
  id: "names.valid",
  criterion: "Names are unique, 64 characters or fewer, and use safe characters",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES2.claudeReview, SOURCES2.claudePolicy, SOURCES2.openai, SOURCES2.mcpTools],
  passed: "Every name is unique, 64 characters or fewer, and uses letters, digits, _ - or .",
  notApplicable: "No tools listed.",
  run: (tools) => {
    const counts = /* @__PURE__ */ new Map();
    for (const t of tools) counts.set(t.name, (counts.get(t.name) ?? 0) + 1);
    const findings = [];
    for (const [name, n] of counts)
      if (n > 1)
        findings.push({
          tools: [name],
          status: "fail",
          evidence: `Two or more tools are called ${quote(name)} (${n}).`,
          fix: "Give every tool a different name; clients call tools by name."
        });
    for (const t of tools) {
      if (!t.name)
        findings.push({ tools: [t.name], status: "fail", evidence: "Empty name.", fix: "Name the tool after what it does, e.g. get_order_status." });
      else if (t.name.length > 64)
        findings.push({
          tools: [t.name],
          status: "fail",
          evidence: `The name is ${t.name.length} characters long.`,
          fix: "Shorten the name to 64 characters or fewer."
        });
      else if (!NAME_CHARS.test(t.name))
        findings.push({
          tools: [t.name],
          status: "warn",
          evidence: `The name ${quote(t.name)} has characters other than letters, digits, _ - and .`,
          fix: "Use only letters, digits, underscores and hyphens; spaces and punctuation break some clients."
        });
    }
    return { applies: tools.map((t) => t.name), findings };
  }
};
var GENERIC = new Set(
  `tool tools run execute exec do action call request handler handle process query api main test
   invoke perform go fn func function op operation command cmd method helper util utils misc
   default data http`.split(/\s+/)
);
var clearNames = {
  id: "names.clear",
  criterion: "Names say what the tool does, in plain words",
  directories: ["chatgpt"],
  sources: [SOURCES2.openai],
  passed: "No name is generic or an opaque identifier.",
  notApplicable: "No tools listed.",
  run: (tools) => per(tools, (t) => Boolean(t.name), (t) => {
    const w = words(t.name);
    const opaque = t.name.length < 3 || !/[a-z]/i.test(t.name) || GENERIC.has(w.join("_")) || /^(tool|fn|func|op|action|cmd|t|f)[_-]?\d+$/i.test(t.name) || w.some((x) => /\d{4,}/.test(x) || /^[0-9a-f]{8,}$/.test(x) && /\d/.test(x));
    if (opaque)
      return {
        status: "warn",
        evidence: `The name ${quote(t.name)} doesn't say what the tool does.`,
        fix: "Use a verb and an object, e.g. get_order_status or search_products."
      };
  })
};
var described = {
  id: "descriptions.present",
  criterion: "Every tool has a description",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES2.openai, SOURCES2.claudeReview],
  passed: "Every tool has a description.",
  notApplicable: "No tools listed.",
  run: (tools) => per(
    tools,
    all,
    (t) => t.description.trim() ? void 0 : {
      status: "fail",
      evidence: "The description is empty.",
      fix: "Say what the tool does, what it returns, when to use it, and any side effects or limits."
    }
  )
};
var detailed = {
  id: "descriptions.detail",
  criterion: "Descriptions explain purpose, result and when to use the tool",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES2.openai, SOURCES2.claudeReview, SOURCES2.claudePolicy],
  passed: "Every description is more than a restatement of the name.",
  notApplicable: "No tool has a description.",
  run: (tools) => per(tools, (t) => Boolean(t.description.trim()), (t) => {
    const text2 = words(t.description).join(" ");
    const restates = text2 === words(t.name).join(" ") || t.title && text2 === words(t.title).join(" ");
    if (restates || text2.split(" ").length < 5)
      return {
        status: "warn",
        evidence: `The description is too brief: ${quote(t.description)}`,
        fix: "Add what the tool returns and when to use it (and, for changes, what it changes). One or two plain sentences is enough."
      };
  })
};
var HIDDEN = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]|[\u{E0000}-\u{E007F}]/u;
var OVERRIDE = [
  /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(instructions?|prompts?|rules|guidelines|guardrails)\b/i,
  /\bsystem prompt\b/i,
  /\b(do not|don['’]t|never)\s+(tell|inform|mention|reveal|show|disclose)\b[^.\n]{0,30}\buser\b/i,
  /<\/?\s*(important|system|instructions?|secret)\s*>/i,
  /<!--/
];
var STEERING = [
  /\b(always|must)\s+(use|call|invoke|run)\s+this\s+tool\b/i,
  /\b(instead of|rather than)\s+(any\s+|the\s+)?other\s+(tools?|apps?|connectors?|plugins?|servers?)\b/i,
  /\b(do not|don['’]t|never)\s+(use|call|invoke)\s+(any\s+)?other\s+(tools?|apps?|connectors?|plugins?|servers?)\b/i,
  /\bbefore\s+(using|calling)\s+any\s+other\s+tools?\b/i,
  /\b(fetch|read|load|download|follow|obey)\b[^.\n]{0,40}\binstructions\b[^.\n]{0,20}\b(from|at)\b/i
];
var ENCODED = /[A-Za-z0-9+/]{80,}={0,2}/;
var PROMO = [
  /(^|\s)#1\b/,
  /\bnumber one\b/i,
  /\bworld['’]?s (best|leading|first|most)\b/i,
  /\bindustry[- ]leading\b/i,
  /\bbetter than\b/i,
  /\bsuperior to\b/i,
  /\bthe best (tool|app|service|choice|option|way|solution)\b/i,
  /\bunlike (other|competing|competitor)/i
];
function snippet(text2, match) {
  const start = Math.max(0, match.index - 30);
  return quote(text2.slice(start, match.index + match[0].length + 30).trim(), 120);
}
var codePoint = (ch) => `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
var injection = {
  id: "descriptions.no_injection",
  criterion: "Descriptions describe the tool and don't instruct the model",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES2.claudeReview, SOURCES2.claudePolicy, SOURCES2.openai],
  passed: "No hidden characters, override phrases or steering found in names, titles or descriptions.",
  notApplicable: "No tools listed.",
  run: (tools) => per(tools, all, (t) => {
    const texts = [t.description, t.title ?? "", ...schemaTexts(t.schema)];
    for (const text2 of texts) {
      const hidden = HIDDEN.exec(text2);
      if (hidden)
        return {
          status: "fail",
          evidence: `Invisible character ${codePoint(hidden[0])} in ${quote(text2, 80)}.`,
          fix: "Remove invisible and direction-changing characters; all guidance must be readable."
        };
    }
    for (const text2 of texts)
      for (const re of OVERRIDE) {
        const m = re.exec(text2);
        if (m)
          return {
            status: "fail",
            evidence: snippet(text2, m),
            fix: "Describe what the tool does; don't address the model's instructions, hide text or tell it what to keep from the user."
          };
      }
    for (const text2 of texts) {
      for (const re of STEERING) {
        const m = re.exec(text2);
        if (m)
          return {
            status: "warn",
            evidence: snippet(text2, m),
            fix: "Say when the tool is useful instead of telling the model to prefer it, avoid other tools, or load instructions from elsewhere."
          };
      }
      const encoded = ENCODED.exec(text2);
      if (encoded)
        return {
          status: "warn",
          evidence: `Long encoded-looking text: ${quote(encoded[0], 40)}.`,
          fix: "Remove encoded blobs from descriptions; reviewers treat them as possible hidden instructions."
        };
    }
  })
};
var promotional = {
  id: "descriptions.not_promotional",
  criterion: "Names and descriptions aren't promotional or comparative",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES2.openai, SOURCES2.claudeReview],
  passed: "No promotional or comparative wording found.",
  notApplicable: "No tools listed.",
  run: (tools) => per(tools, all, (t) => {
    for (const text2 of [t.name, t.title ?? "", t.description])
      for (const re of PROMO) {
        const m = re.exec(text2);
        if (m)
          return {
            status: "warn",
            evidence: snippet(text2, m),
            fix: "State what the tool does without ranking it against other tools or services."
          };
      }
  })
};
var schemaValid = {
  id: "schema.valid",
  criterion: "Input schema is a JSON Schema object with consistent required fields",
  directories: [],
  sources: [SOURCES2.mcpTools],
  passed: "Every input schema is an object schema, and every required field is defined.",
  notApplicable: "No tools listed.",
  run: (tools) => per(tools, all, (t) => {
    const s = t.schema;
    if (!isObject(s) || s.type !== "object")
      return {
        status: "fail",
        evidence: `Its inputs aren't described as an object: ${json(s)}`,
        fix: 'Use an object schema: { "type": "object", "properties": { \u2026 } }, or { "type": "object", "additionalProperties": false } for no inputs.'
      };
    if (s.required !== void 0 && (!Array.isArray(s.required) || s.required.some((r) => typeof r !== "string")))
      return {
        status: "fail",
        evidence: `The list of required inputs isn't a list of names: ${json(s.required)}`,
        fix: "Make required an array of property names."
      };
    const props = properties(t);
    const undefinedRequired = (s.required ?? []).filter((r) => !(r in props));
    if (undefinedRequired.length)
      return {
        status: "fail",
        evidence: `${undefinedRequired.map((r) => quote(r)).join(", ")} ${undefinedRequired.length > 1 ? "are" : "is"} marked required but ${undefinedRequired.length > 1 ? "aren't" : "isn't"} defined as ${undefinedRequired.length > 1 ? "inputs" : "an input"}.`,
        fix: "Define every required field under properties, or drop it from required."
      };
  })
};
var TYPED = ["type", "enum", "const", "$ref", "anyOf", "oneOf", "allOf"];
var schemaTypes = {
  id: "schema.types",
  criterion: "Every input has a type",
  directories: [],
  sources: [SOURCES2.mcpTools, SOURCES2.claudeReview],
  passed: "Every input declares a type (or enum, const or composition).",
  notApplicable: "No tool takes inputs.",
  run: (tools) => per(tools, (t) => Object.keys(properties(t)).length > 0, (t) => {
    const untyped = Object.entries(properties(t)).filter(([, p]) => !TYPED.some((k) => k in p)).map(([k]) => k);
    if (untyped.length)
      return {
        status: "warn",
        evidence: `${untyped.length > 1 ? "These inputs have" : "This input has"} no type: ${untyped.join(", ")}.`,
        fix: "Give each input a type (string, integer, boolean, array, object) so clients and models send valid values."
      };
  })
};
var schemaDescriptions = {
  id: "schema.descriptions",
  criterion: "Inputs are described",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES2.openai, SOURCES2.claudeReview, SOURCES2.mcpTools],
  passed: "Every input has a description.",
  notApplicable: "No tool takes inputs.",
  run: (tools) => per(tools, (t) => Object.keys(properties(t)).length > 0, (t) => {
    const bare = Object.entries(properties(t)).filter(([, p]) => typeof p.description !== "string" || !p.description.trim()).map(([k]) => k);
    if (bare.length)
      return {
        status: "warn",
        evidence: `${bare.length > 1 ? "These inputs have" : "This input has"} no description: ${bare.join(", ")}.`,
        fix: "Describe each input: what it is, its format, and where to get it (e.g. \u201COrder ID from list_orders\u201D)."
      };
  })
};
var ID = /(^|_)(id|ids|uuid|key|slug)$/;
var schemaRequired = {
  id: "schema.required",
  criterion: "Inputs a tool can't work without are required",
  directories: [],
  sources: [SOURCES2.mcpTools, SOURCES2.claudeReview],
  passed: "Tools acting on one record by ID mark the ID required.",
  notApplicable: "No tool acts on a single record by ID.",
  run: (tools) => per(
    tools,
    (t) => {
      const verb = verbOf(t.name);
      return Boolean(verb) && !["list", "search", "find", "query", "browse", "export", "create", "add", "new", "count"].includes(verb) && Object.keys(properties(t)).some((k) => ID.test(snake(k)));
    },
    (t) => {
      const s = t.schema;
      if (Array.isArray(s.required) && s.required.length) return;
      const ids = Object.keys(properties(t)).filter((k) => ID.test(snake(k)));
      return {
        status: "warn",
        evidence: `No input is marked required, but ${ids.join(", ")} look${ids.length > 1 ? "" : "s"} necessary.`,
        fix: `Add ${ids.map((k) => quote(k)).join(", ")} to required if the tool can't run without ${ids.length > 1 ? "them" : "it"}, so bad calls fail with a clear error.`
      };
    }
  )
};
var CONVERSATION = new Set(
  `conversation conversation_history chat chat_history chat_log transcript full_transcript
   prior_turns previous_messages message_history context full_context user_context memory memories`.split(/\s+/)
);
var SECRET = new Set(
  `password passwd api_key apikey secret client_secret access_token refresh_token private_key
   credentials otp ssn card_number cvv cvc`.split(/\s+/)
);
var minimalInputs = {
  id: "schema.minimal_inputs",
  criterion: "Inputs don't ask for conversation history or credentials",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES2.openai, SOURCES2.claudeReview, SOURCES2.claudeSubmission],
  passed: "No input asks for chat history, broad context or secrets.",
  notApplicable: "No tool takes inputs.",
  run: (tools) => per(tools, (t) => Object.keys(properties(t)).length > 0, (t) => {
    const keys = Object.keys(properties(t));
    const context = keys.filter((k) => CONVERSATION.has(snake(k)));
    if (context.length)
      return {
        status: "warn",
        evidence: `Asks for conversation context: ${context.join(", ")}.`,
        fix: "Ask only for the fields this tool needs, not the conversation or broad context."
      };
    const secrets = keys.filter((k) => SECRET.has(snake(k)));
    if (secrets.length)
      return {
        status: "warn",
        evidence: `Asks for secrets or sensitive numbers: ${secrets.join(", ")}.`,
        fix: "Don't take credentials or sensitive numbers as tool arguments; sign users in with OAuth and act on their account."
      };
  })
};
var METHOD = /* @__PURE__ */ new Set(["method", "http_method", "request_method", "verb", "http_verb"]);
var PATHLIKE = /* @__PURE__ */ new Set(["path", "url", "uri", "endpoint", "route", "api_path", "resource_path", "request_path", "api_url"]);
var SAFE = /* @__PURE__ */ new Set(["GET", "HEAD", "OPTIONS"]);
var UNSAFE = /* @__PURE__ */ new Set(["POST", "PUT", "PATCH", "DELETE"]);
var MODE = /* @__PURE__ */ new Set(["action", "operation", "op", "mode", "command"]);
var freeString = (p) => !("enum" in p) && !("const" in p) && (p.type === void 0 || p.type === "string");
function methodProps(t) {
  return Object.entries(properties(t)).filter(([k]) => METHOD.has(snake(k)));
}
function pathProps(t) {
  return Object.entries(properties(t)).filter(([k, p]) => PATHLIKE.has(snake(k)) && freeString(p));
}
var separated = {
  id: "tools.read_write_separated",
  criterion: "No single tool both reads and changes data",
  directories: ["claude", "chatgpt"],
  sources: [SOURCES2.claudeReview, SOURCES2.openai],
  passed: "No tool takes an HTTP method, or a read-or-write mode, as an argument.",
  notApplicable: "No tool takes a method, action or mode argument.",
  run: (tools) => per(
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
              fix: "Split this into a read-only tool and separate write tools (ideally one each for create, update and delete). Explaining the difference in the description isn't enough."
            };
        } else if (freeString(p) && pathProps(t).length)
          return {
            status: "fail",
            evidence: `The ${key} input is free text next to ${pathProps(t)[0][0]}, so one tool can make any kind of request.`,
            fix: "Replace the catch-all request tool with a read-only tool and separate write tools; don't take the HTTP method as an argument."
          };
      }
      for (const [key, p] of Object.entries(properties(t)).filter(([k]) => MODE.has(snake(k)))) {
        if (!Array.isArray(p.enum)) continue;
        const intents = new Set(p.enum.map((v) => intentOf(String(v))));
        if (intents.has("read") && intents.has("write"))
          return {
            status: "warn",
            evidence: `The ${key} input mixes reads and changes (${json(p.enum)}).`,
            fix: "Split reads and changes into separate tools so each can say accurately whether it's read-only or destructive."
          };
      }
    }
  )
};
var QUERY_NAMES = /* @__PURE__ */ new Set(["request", "http", "api", "graphql", "sql", "raw", "proxy", "fetch", "call"]);
var API_REFERENCE = /https?:\/\/\S+|\b[A-Z][A-Za-z0-9.]*(\s+[A-Z][A-Za-z0-9.]*)*\s+(REST\s+|GraphQL\s+|Web\s+|HTTP\s+)?API\b/;
var customQuery = {
  id: "tools.custom_query_documented",
  criterion: "Tools that take free-form paths or queries name the API they call",
  directories: ["claude"],
  sources: [SOURCES2.claudeReview],
  passed: "Every free-form query tool links to or names its target API.",
  notApplicable: "No tool takes a free-form endpoint, path or query.",
  run: (tools) => per(
    tools,
    (t) => {
      const named = words(t.name).some((w) => QUERY_NAMES.has(w));
      const queryProp = Object.entries(properties(t)).some(
        ([k, p]) => ["query", "sql", "graphql", "body", "request_body"].includes(snake(k)) && freeString(p)
      );
      return pathProps(t).length > 0 && (methodProps(t).length > 0 || named) || queryProp && words(t.name).some((w) => w === "graphql" || w === "sql");
    },
    (t) => API_REFERENCE.test(t.description) ? void 0 : {
      status: "warn",
      evidence: `The description doesn't name the API it uses: ${quote(t.description || "(empty)")}`,
      fix: "Name the API this tool queries and link its reference docs, e.g. \u201CQueries the Acme REST API, see https://docs.acme.example/api\u201D."
    }
  )
};
var PAGING = new Set(
  `limit page page_size per_page page_number cursor next_cursor offset max max_results max_items
   max_count top first last count size page_token next_token next_page_token starting_after
   ending_before after before skip take num_results`.split(/\s+/)
);
var MANY = /* @__PURE__ */ new Set(["list", "search", "find", "query", "browse", "export"]);
var bounded = {
  id: "outputs.bounded",
  criterion: "List and search tools can return a bounded page",
  directories: ["claude"],
  sources: [SOURCES2.claudePolicy, SOURCES2.claudeReview],
  passed: "Every list or search tool takes a limit, page or cursor argument.",
  notApplicable: "No read tool is named for listing or searching.",
  run: (tools) => per(
    tools,
    (t) => reads(t) && (MANY.has(verbOf(t.name) ?? "") || words(t.name).some((w) => ["all", "history", "logs", "feed"].includes(w))),
    (t) => Object.keys(properties(t)).some((k) => PAGING.has(snake(k))) ? void 0 : {
      status: "warn",
      evidence: "Returns a list with no limit or paging input.",
      fix: "Add a limit (with a sensible default and maximum) and a cursor or page argument, and say in the description that results are paged. Directories expect token use in proportion to the task."
    }
  )
};
var errors = {
  id: "errors.useful",
  criterion: "Errors are specific and actionable",
  directories: ["claude"],
  sources: [SOURCES2.claudePolicy, SOURCES2.claudeReview, SOURCES2.mcpTools],
  passed: "",
  notApplicable: "Can\u2019t be checked from tools/list alone. Connector test results cover this (rejected arguments, calls abandoned after an error).",
  run: () => ({ applies: [], findings: [] })
};
var count = {
  id: "tools.count",
  criterion: "The server lists a focused set of tools",
  directories: [],
  sources: [SOURCES2.product],
  passed: (tools) => `${tools.length} tool${tools.length === 1 ? "" : "s"} listed.`,
  notApplicable: "",
  run: (tools, ctx) => {
    const names2 = tools.map((t) => t.name);
    if (!tools.length)
      return {
        applies: ["(server)"],
        findings: [{ tools: [], status: "fail", evidence: "tools/list returned no tools.", fix: "List at least one tool." }]
      };
    const pageReader = names2.find((n) => /^read_site_page(_\d+)?$/.test(n));
    return {
      applies: names2,
      findings: tools.length >= ctx.manyTools ? [
        {
          tools: [],
          status: "warn",
          evidence: `${tools.length} tools listed.`,
          fix: `With ${ctx.manyTools} or more tools, agents choose less reliably. Merge overlapping tools${pageReader ? `: ${pageReader} already reads any mapped page, so single-page tools can be removed` : ", or split the server by task"}.`
        }
      ] : []
    };
  }
};
var SCHEMES = /* @__PURE__ */ new Set(["noauth", "oauth2"]);
var securitySchemes = {
  id: "auth.security_schemes",
  criterion: "When tools declare how they sign in, every tool does, with noauth or oauth2",
  directories: ["chatgpt"],
  sources: [SOURCES2.openaiAuth],
  passed: "Every tool declares noauth or oauth2.",
  notApplicable: "No tool declares securitySchemes.",
  run: (tools) => {
    if (!tools.some((t) => t.securitySchemes !== void 0)) return { applies: [], findings: [] };
    return per(tools, all, (t) => {
      if (t.securitySchemes === void 0)
        return {
          status: "warn",
          evidence: "securitySchemes is missing, but other tools declare it.",
          fix: 'Declare securitySchemes on every tool: [{"type":"noauth"}] for tools anyone can call, [{"type":"oauth2","scopes":[...]}] for tools that need sign-in.'
        };
      const list2 = t.securitySchemes;
      if (!Array.isArray(list2) || !list2.length || list2.some((s) => !isObject(s) || !SCHEMES.has(String(s.type))))
        return {
          status: "warn",
          evidence: `Its sign-in setting (securitySchemes) isn't one ChatGPT reads: ${json(list2)}`,
          fix: 'Use a non-empty list of {"type":"noauth"} or {"type":"oauth2","scopes":[...]}.'
        };
    });
  }
};
var skipped = {
  id: "tools.usable",
  criterion: "Every listed tool can be imported and called",
  directories: [],
  sources: [SOURCES2.mcpTools, SOURCES2.product],
  passed: "Every listed tool can be imported.",
  notApplicable: "No tools listed.",
  run: (tools, ctx) => ({
    applies: tools.length || ctx.skipped.length ? ["(server)"] : [],
    findings: ctx.skipped.map((s) => ({
      tools: [s.name],
      status: "warn",
      evidence: s.reason,
      fix: "Fix this tool's name or input schema so clients can call it."
    }))
  })
};
var CHECKS = [
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
  errors
];

// src/tool-quality/index.ts
var MANY_TOOLS = 25;
var RUBRIC = "tool-quality/2.1 (criteria read 2026-10-01)";
var NOTE = "These checks help you prepare for directory review; they don\u2019t guarantee approval. Directories also review sign-in, privacy and policy, test every tool live, and update their criteria.";
var text = (v) => typeof v === "string" ? v : "";
function normalize(raw) {
  const annotations = raw.annotations && typeof raw.annotations === "object" && !Array.isArray(raw.annotations) ? raw.annotations : {};
  const title2 = text(raw.title) || text(annotations.title);
  const meta = raw._meta && typeof raw._meta === "object" && !Array.isArray(raw._meta) ? raw._meta : {};
  const schemes = raw.securitySchemes ?? meta.securitySchemes;
  return {
    name: text(raw.name),
    ...title2 ? { title: title2 } : {},
    description: text(raw.description),
    schema: raw.inputSchema,
    annotations,
    ...schemes !== void 0 ? { securitySchemes: schemes } : {}
  };
}
var ORDER = { fail: 0, warn: 1, pass: 2, not_applicable: 3 };
function results(check, tools, options) {
  const base = {
    id: check.id,
    criterion: check.criterion,
    directories: check.directories,
    sources: check.sources
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
        fix: ""
      }
    ];
  }
  return outcome.findings.map((f) => ({ ...base, status: f.status, tools: f.tools, evidence: f.evidence, fix: f.fix }));
}
function checkTools(tools, options = {}) {
  const selected = options.directories?.length ? options.directories : ["claude", "chatgpt"];
  const normalized = tools.map(normalize);
  const opts = { ...options, manyTools: options.manyTools ?? MANY_TOOLS };
  const checks = CHECKS.filter((c) => !c.directories.length || c.directories.some((d) => selected.includes(d))).flatMap((c) => results(c, normalized, opts)).map((r, i) => ({ r, i })).sort((a, b) => ORDER[a.r.status] - ORDER[b.r.status] || a.i - b.i).map(({ r }) => r);
  const counts = { pass: 0, warn: 0, fail: 0, not_applicable: 0 };
  for (const r of checks) counts[r.status]++;
  const byDirectory = {};
  for (const d of selected) {
    const mine = checks.filter((r) => r.directories.includes(d) || !r.directories.length);
    byDirectory[d] = {
      fail: mine.filter((r) => r.status === "fail").length,
      warn: mine.filter((r) => r.status === "warn").length
    };
  }
  const toolStatus = {};
  for (const t of normalized) toolStatus[t.name] = "pass";
  for (const r of checks)
    for (const name of r.tools)
      if (name in toolStatus && (r.status === "fail" || r.status === "warn" && toolStatus[name] === "pass"))
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
      note: NOTE
    }
  };
}

// src/check.ts
var RUBRIC2 = "mcp-check/1 (criteria read 17 October 2026)";
var NOTE2 = "This checks what can be read without signing in. Directories also review privacy, policy and sign-in with a real account, and test every tool live, so a clean result isn\u2019t approval.";
var BOTH = ["chatgpt", "claude"];
var TIMEOUT_MS = 1e4;
var MAX_TOOLS = 200;
var HEADERS = { "content-type": "application/json", accept: "application/json, text/event-stream" };
var rpc = (body) => JSON.stringify({ jsonrpc: "2.0", ...body });
var INITIALIZE = rpc({
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "mcp-directory-check", version: "1" } }
});
var trim = (url) => url.replace(/\/$/, "");
var CHALLENGE_PATH = "/.well-known/openai-apps-challenge";
function why(error) {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
    return `no response within ${TIMEOUT_MS / 1e3} seconds`;
  if (error instanceof Error && /^(The server|We couldn|Enter |Leave |Only |Private )/.test(error.message)) return error.message.replace(/\.$/, "");
  return "we couldn\u2019t connect";
}
async function answer(res, id) {
  const match = (m) => m && typeof m === "object" && !Array.isArray(m) && m.id === id ? m : null;
  if (!/event-stream/i.test(res.headers.get("content-type") ?? "")) {
    const body = await res.json().catch(() => null);
    return Array.isArray(body) ? body.map(match).find(Boolean) ?? null : match(body);
  }
  if (!res.body) return null;
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (; ; ) {
      const { value, done } = await reader.read();
      if (value) buffer += value;
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = done ? "" : events.pop() ?? "";
      for (const event of events) {
        const data = event.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        try {
          const found = data ? match(JSON.parse(data)) : null;
          if (found) return found;
        } catch {
        }
      }
      if (done) return null;
    }
  } finally {
    await reader.cancel().catch(() => {
    });
  }
}
async function getJson(fetcher, url) {
  const res = await fetcher(url, { redirect: "manual", headers: { accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {
    });
    return { status: res.status, body: null };
  }
  const body = await res.json().catch(() => null);
  return { status: res.status, body: body && typeof body === "object" && !Array.isArray(body) ? body : null };
}
var wellKnown = (resource, path = resource.pathname.replace(/\/$/, "")) => `${resource.origin}/.well-known/oauth-protected-resource${path}`;
async function checkMcpServer(input, options) {
  const url = new URL(input);
  const items = [];
  const add = (group, id, label, status, evidence, fix, sources, directories = BOTH) => items.push({ id, group, label, status, evidence, fix, directories, sources, tools: [] });
  const guard = options.guard(url.href);
  let server = null;
  let toolCount = null;
  const finish = () => {
    const seen = /* @__PURE__ */ new Set();
    const checks = items.filter((i) => !seen.has(`${i.id}|${i.status}`) && seen.add(`${i.id}|${i.status}`));
    const counts = { pass: 0, warn: 0, fail: 0, info: 0 };
    for (const i of checks) counts[i.status]++;
    const byDirectory = Object.fromEntries(
      BOTH.map((d) => {
        const mine = checks.filter((i) => i.directories.includes(d));
        return [d, { fail: mine.filter((i) => i.status === "fail").length, warn: mine.filter((i) => i.status === "warn").length }];
      })
    );
    return { rubric: RUBRIC2, url: url.href, checkedAt: (options.now?.() ?? /* @__PURE__ */ new Date()).toISOString(), server, toolCount, items, counts, byDirectory, note: NOTE2, full: true };
  };
  const secure = url.protocol === "https:";
  if (secure) add("connection", "https", "Served over HTTPS", "pass", `${url.origin} uses HTTPS.`, "", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);
  else add("connection", "https", "Served over HTTPS", "warn", "This address uses http. It was reachable only because this check is running in local development.", "Serve the server over HTTPS.", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);
  let first;
  try {
    first = await guard(url.href, { method: "POST", headers: HEADERS, body: INITIALIZE, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    add("connection", "reachable", "The server answers", "fail", `No answer: ${why(error)}.`, "Make the server reachable from the public internet over HTTPS, at the address you submit (often ending in /mcp), without redirects.", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);
    return finish();
  }
  add("connection", "reachable", "The server answers", "pass", `A POST to ${url.pathname || "/"} returned HTTP ${first.status}.`, "", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);
  let metadataUrl = null;
  let signedOut = false;
  let session = null;
  let protocolVersion = "2025-06-18";
  const mcp = [SOURCES.mcpAuth];
  if (first.status === 401) {
    signedOut = true;
    await first.body?.cancel().catch(() => {
    });
    const header = first.headers.get("www-authenticate");
    const named = header ? /resource_metadata="([^"]+)"/i.exec(header)?.[1] ?? /resource_metadata=([^\s,"]+)/i.exec(header)?.[1] : void 0;
    let valid = null;
    try {
      const at = named ? new URL(named) : null;
      if (at && (at.protocol === "https:" || options.allowLoopback && at.protocol === "http:")) valid = at.href;
    } catch {
      valid = null;
    }
    if (valid) {
      metadataUrl = valid;
      add("signin", "challenge", "Signed-out requests get 401 with sign-in metadata", "pass", `HTTP 401 with a WWW-Authenticate header naming ${valid}.`, "", [SOURCES.openaiReview, SOURCES.claudeSubmission, ...mcp]);
    } else if (!header) {
      add("signin", "challenge", "Signed-out requests get 401 with sign-in metadata", "fail", "HTTP 401 without a WWW-Authenticate header.", "Add a WWW-Authenticate header whose resource_metadata points to your protected-resource metadata.", [SOURCES.openaiReview, SOURCES.claudeSubmission, ...mcp]);
    } else {
      add("signin", "challenge", "Signed-out requests get 401 with sign-in metadata", "fail", named ? "The WWW-Authenticate header names an invalid metadata address." : "The WWW-Authenticate header doesn\u2019t include resource_metadata.", 'Add resource_metadata="https://\u2026" to the WWW-Authenticate header, pointing to your protected-resource metadata.', [SOURCES.openaiReview, SOURCES.claudeSubmission, ...mcp]);
    }
    add("connection", "initialize", "MCP initialize over Streamable HTTP", "info", "The server asks for sign-in before it answers initialize, so we can\u2019t read its tools without an account.", "", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);
    add("tools", "tools-list", "Tools can be listed", "info", "Not checked: this needs a signed-in session, and this check never signs in. The tool checks below were skipped.", "", [SOURCES.openaiReview]);
  } else if (first.status === 403) {
    await first.body?.cancel().catch(() => {
    });
    add("signin", "challenge", "Signed-out requests get 401, not 403", "fail", "HTTP 403 to a signed-out request.", "Return HTTP 401 with a WWW-Authenticate header so clients start the sign-in flow. A 403 tells them sign-in won\u2019t help.", [SOURCES.openaiReview, SOURCES.claudeSubmission, ...mcp]);
    add("connection", "initialize", "MCP initialize over Streamable HTTP", "info", "Not checked: the server refused the request.", "", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);
  } else if (!first.ok) {
    await first.body?.cancel().catch(() => {
    });
    add("connection", "initialize", "MCP initialize over Streamable HTTP", "fail", `HTTP ${first.status} to an MCP initialize request.`, first.status === 404 ? "Nothing answers at this path. Check the address (often ending in /mcp)." : "Accept POST requests with JSON-RPC at this address, per the MCP Streamable HTTP transport.", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);
  } else {
    const result = (await answer(first, 1).catch(() => null))?.result;
    if (!result || typeof result.protocolVersion !== "string") {
      add("connection", "initialize", "MCP initialize over Streamable HTTP", "fail", `HTTP ${first.status}, but the answer isn\u2019t an MCP initialize result (${first.headers.get("content-type") ?? "no content type"}).`, "Answer initialize with a JSON-RPC result, as JSON or a server-sent event stream.", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);
    } else {
      protocolVersion = result.protocolVersion.slice(0, 40);
      session = first.headers.get("mcp-session-id");
      const info = result.serverInfo ?? {};
      server = {
        name: String(info.name ?? "").slice(0, 200),
        ...typeof info.title === "string" ? { title: info.title.slice(0, 200) } : {},
        version: String(info.version ?? "").slice(0, 100),
        protocolVersion
      };
      add("connection", "initialize", "MCP initialize over Streamable HTTP", "pass", `Protocol version ${protocolVersion}${server.name ? `; server \u201C${server.name}\u201D ${server.version}` : ""}.`, "", [SOURCES.claudeSubmission, SOURCES.openaiSubmission]);
    }
  }
  if (server) {
    const headers = { ...HEADERS, "mcp-protocol-version": protocolVersion, ...session ? { "mcp-session-id": session } : {} };
    const post = (body) => guard(url.href, { method: "POST", headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const listed = [];
    let problem = null;
    try {
      const notified = await post(rpc({ method: "notifications/initialized" }));
      await notified.body?.cancel().catch(() => {
      });
      let cursor;
      for (let page = 0; page < 10 && listed.length < MAX_TOOLS; page++) {
        const res = await post(rpc({ id: 2 + page, method: "tools/list", params: cursor ? { cursor } : {} }));
        if (res.status === 401) {
          signedOut = true;
          await res.body?.cancel().catch(() => {
          });
          problem = "HTTP 401: listing tools needs sign-in";
          break;
        }
        if (!res.ok) {
          await res.body?.cancel().catch(() => {
          });
          problem = `HTTP ${res.status} to tools/list`;
          break;
        }
        const result = (await answer(res, 2 + page))?.result;
        if (!result || !Array.isArray(result.tools)) {
          problem = "the answer to tools/list has no tools array";
          break;
        }
        listed.push(...result.tools);
        cursor = typeof result.nextCursor === "string" ? result.nextCursor : void 0;
        if (!cursor) break;
      }
    } catch (error) {
      problem = why(error);
    } finally {
      if (session) await guard(url.href, { method: "DELETE", headers, signal: AbortSignal.timeout(TIMEOUT_MS) }).then((r) => r.body?.cancel()).catch(() => {
      });
    }
    if (problem && !listed.length) {
      add("tools", "tools-list", "Tools can be listed", problem.includes("sign-in") ? "info" : "fail", `${problem[0].toUpperCase()}${problem.slice(1)}.${problem.includes("sign-in") ? " This check never signs in, so the tool checks below were skipped." : ""}`, problem.includes("sign-in") ? "" : "Answer tools/list with the server\u2019s tools.", [SOURCES.openaiReview, SOURCES.claudeSubmission]);
    } else {
      toolCount = listed.length;
      add("tools", "tools-list", "Tools can be listed", listed.length ? "pass" : "fail", listed.length ? `${listed.length} tool${listed.length === 1 ? "" : "s"} listed${listed.length >= MAX_TOOLS ? ` (we read the first ${MAX_TOOLS})` : ""}.` : "tools/list returned no tools.", listed.length ? "" : "List at least one tool.", [SOURCES.openaiReview, SOURCES.claudeSubmission]);
      if (listed.length) {
        const quality = checkTools(listed);
        for (const c of quality.checks)
          items.push({
            id: `tool.${c.id}`,
            group: "tools",
            label: c.criterion,
            status: c.status === "not_applicable" ? "info" : c.status,
            evidence: c.evidence,
            fix: c.fix,
            directories: c.directories.length ? c.directories.filter((d) => d !== "gemini") : BOTH,
            sources: c.sources.filter((s) => s.url),
            tools: c.tools
          });
      }
    }
  }
  if (first.status !== 403) {
    const fetchers = (target) => options.guard(target);
    const read = async (target) => getJson(fetchers(target), target);
    const resource = trim(url.href);
    let prm = null;
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
        add("signin", "metadata", "Protected-resource metadata", "fail", `${prmAt ? `${prmAt} didn\u2019t return` : "No"} protected-resource metadata (JSON).`, "Serve protected-resource metadata (RFC 9728) at the address in your WWW-Authenticate header, or at /.well-known/oauth-protected-resource.", srcSignIn);
      else
        add("signin", "metadata", "Sign-in", "info", "The server answers without sign-in and publishes no sign-in metadata. Directories accept that for public data; if your tools act on a person\u2019s account, add OAuth.", "", srcSignIn);
    } else {
      const servers = prm.authorization_servers;
      const first_ = Array.isArray(servers) && typeof servers[0] === "string" ? servers[0] : null;
      if (typeof prm.resource !== "string" || trim(prm.resource) !== resource)
        add("signin", "metadata", "Protected-resource metadata", "fail", `The metadata\u2019s resource (${typeof prm.resource === "string" ? prm.resource : "missing"}) isn\u2019t this server\u2019s address (${resource}).`, "Set resource to exactly the address you submit.", srcSignIn);
      else if (!first_)
        add("signin", "metadata", "Protected-resource metadata", "fail", "The metadata lists no authorization server.", "List your authorization server in authorization_servers.", srcSignIn);
      else {
        add("signin", "metadata", "Protected-resource metadata", "pass", `Names this address and the authorization server ${first_}.`, "", srcSignIn);
        await authorizationServer(first_, read, add, srcSignIn, options.allowLoopback);
      }
    }
  }
  try {
    const target = `${url.origin}${CHALLENGE_PATH}`;
    const res = await options.guard(target)(target, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const type = res.headers.get("content-type") ?? "";
    const text2 = res.ok ? (await res.text()).trim() : (await res.body?.cancel(), "");
    const looksLikeToken = text2.length > 0 && text2.length <= 500 && !/<\s*(html|!doctype)/i.test(text2) && !/json/i.test(type);
    if (res.ok && looksLikeToken)
      add("domain", "openai-challenge", "OpenAI domain verification file", "pass", `${CHALLENGE_PATH} returns plain text (${text2.length} characters). We can\u2019t tell whether it\u2019s the token OpenAI gave you; that\u2019s checked when you submit.`, "", [SOURCES.openaiSubmission], ["chatgpt"]);
    else
      add("domain", "openai-challenge", "OpenAI domain verification file", "fail", res.ok ? `${CHALLENGE_PATH} returned HTTP ${res.status}, but not a plain-text token.` : `${CHALLENGE_PATH} returned HTTP ${res.status}.`, "When you submit to ChatGPT, OpenAI gives you a token. Serve it as plain text at /.well-known/openai-apps-challenge on this server\u2019s domain.", [SOURCES.openaiSubmission], ["chatgpt"]);
  } catch (error) {
    add("domain", "openai-challenge", "OpenAI domain verification file", "fail", `Couldn\u2019t read ${CHALLENGE_PATH}: ${why(error)}.`, "Serve the token OpenAI gives you as plain text at /.well-known/openai-apps-challenge on this server\u2019s domain.", [SOURCES.openaiSubmission], ["chatgpt"]);
  }
  return finish();
}
async function authorizationServer(server, read, add, sources, allowLoopback) {
  let at;
  try {
    at = new URL(server);
    if (at.protocol !== "https:" && !(allowLoopback && at.protocol === "http:")) throw new Error();
  } catch {
    add("signin", "as-metadata", "Authorization server metadata", "fail", "The authorization server address isn\u2019t a valid https URL.", "Use the https address of your authorization server.", sources);
    return;
  }
  const path = at.pathname.replace(/\/$/, "");
  let doc = null;
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
    add("signin", "as-metadata", "Authorization server metadata", "fail", `The metadata\u2019s issuer (${typeof doc.issuer === "string" ? doc.issuer : "missing"}) differs from ${server}.`, "Make issuer match the authorization server address exactly.", sources);
    return;
  }
  add("signin", "as-metadata", "Authorization server metadata", "pass", `Loaded for ${server}.`, "", sources);
  const methods = doc.code_challenge_methods_supported;
  const s256 = Array.isArray(methods) && methods.includes("S256");
  add("signin", "pkce", "PKCE with S256", s256 ? "pass" : "fail", s256 ? "code_challenge_methods_supported includes S256." : "code_challenge_methods_supported doesn\u2019t include S256.", s256 ? "" : "Support PKCE with S256 and list it.", sources);
  const dcr = typeof doc.registration_endpoint === "string" && doc.registration_endpoint.length > 0;
  const cimd = doc.client_id_metadata_document_supported === true;
  if (!dcr && !cimd)
    add("signin", "registration", "AI apps can register as a client", "fail", "Neither dynamic client registration nor Client ID Metadata Documents is advertised.", "Support dynamic client registration, Client ID Metadata Documents, or both.", sources);
  else
    add("signin", "registration", "AI apps can register as a client", "pass", `Advertised: ${[dcr && "dynamic client registration", cimd && "Client ID Metadata Documents"].filter(Boolean).join(" and ")}.`, "", sources);
}

// src/guard.ts
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
var MAX_BYTES = 1e6;
function isPrivate(ip) {
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    if (lower.startsWith("::ffff:")) return isPrivate(lower.slice(7));
    return lower === "::1" || lower === "::" || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 198 && (b === 18 || b === 19);
}
async function assertAllowed(target, allowLoopback) {
  const url = new URL(target);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (allowLoopback && (host === "localhost" || host === "127.0.0.1" || host === "::1")) return;
  if (url.protocol !== "https:") throw new Error("Only https addresses can be checked.");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.some((a) => isPrivate(a.address))) throw new Error("Private addresses can't be checked.");
}
function capped(res) {
  if (!res.body) return res;
  let seen = 0;
  const limit = new TransformStream({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > MAX_BYTES) controller.error(new Error("The server sent too much data."));
      else controller.enqueue(chunk);
    }
  });
  return new Response(res.body.pipeThrough(limit), { status: res.status, statusText: res.statusText, headers: res.headers });
}
var publicFetch = (allowLoopback = false) => (target) => (async (input, init) => {
  await assertAllowed(target, allowLoopback);
  const headers = new Headers(init?.headers);
  headers.set("user-agent", "mcp-directory-check (+https://transica.dev/tools/mcp-directory-check)");
  return capped(await fetch(input, { ...init, headers, redirect: "manual" }));
});

// src/cli.ts
var HELP = `Check a remote MCP server against ChatGPT's and Claude's published directory rules.
Read-only: it sends initialize and tools/list, and reads public metadata. It never calls a tool or signs in.

Usage: mcp-directory-check <url> [options]

  --directory <chatgpt|claude>  Only rules for one directory
  --fail-on <fail|warn>         What sets exit code 1 (default: fail)
  --json                        Print the full report as JSON
  --verbose                     List passed checks too
  --allow-localhost             Allow http on localhost, for local development
  -h, --help                    Show this help

Exit codes: 0 passed, 1 found problems, 2 couldn't run.`;
var MARK = { pass: "pass", warn: "warn", fail: "FAIL", info: "info" };
var GROUPS = { connection: "Connection", signin: "Sign-in", domain: "Domain", tools: "Tools" };
function parse(argv) {
  const out = { url: "", directory: null, failOn: "fail", json: false, loopback: false, verbose: false };
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
function print(report, items, verbose) {
  console.log(`
${report.url}`);
  if (report.server) console.log(`${report.server.title || report.server.name} ${report.server.version}, ${report.toolCount ?? "?"} tools`);
  for (const group of Object.keys(GROUPS)) {
    const all2 = items.filter((i) => i.group === group);
    const mine = verbose ? all2 : all2.filter((i) => i.status === "fail" || i.status === "warn" || i.status === "info" && i.group !== "tools" || i.id === "tools-list");
    const passed = new Set(all2.filter((i) => i.status === "pass").map((i) => i.id)).size;
    if (!all2.length) continue;
    console.log(`
${GROUPS[group]}${verbose ? "" : ` (${passed} passed)`}`);
    for (const item of mine) {
      console.log(`  ${MARK[item.status]}  ${item.label}`);
      if (item.status !== "pass") console.log(`        ${item.evidence}`);
      if (item.fix) console.log(`        Fix: ${item.fix}`);
      if (item.tools.length && item.status !== "pass") console.log(`        Tools: ${item.tools.slice(0, 8).join(", ")}${item.tools.length > 8 ? ` and ${item.tools.length - 8} more` : ""}`);
    }
  }
  for (const directory of ["chatgpt", "claude"]) {
    const counts = report.byDirectory[directory];
    console.log(`
${directory === "chatgpt" ? "ChatGPT" : "Claude"}: ${counts.fail} failed, ${counts.warn} warnings`);
  }
  console.log(`
${report.note}`);
  console.log("Rules and fixes in your browser: https://transica.dev/tools/mcp-directory-check");
}
async function main() {
  const options = parse(process.argv.slice(2));
  if (!options.loopback && !options.url.startsWith("https://")) throw new Error("Give an https address, such as https://example.com/mcp");
  const report = await checkMcpServer(options.url, { guard: publicFetch(options.loopback), allowLoopback: options.loopback });
  const items = options.directory ? report.items.filter((i) => i.directories.includes(options.directory)) : report.items;
  if (options.json) console.log(JSON.stringify({ ...report, items }, null, 2));
  else print(report, items, options.verbose);
  const bad = items.some((i) => i.status === "fail" || options.failOn === "warn" && i.status === "warn");
  process.exit(bad ? 1 : 0);
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
});
