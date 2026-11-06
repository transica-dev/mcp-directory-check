// The published criteria each check comes from. Read on 30 September 2026:
// - Claude: Submit a connector to the directory
//   https://claude.com/docs/connectors/building/submission
// - Claude: Connector pre-submission checklist (review criteria)
//   https://claude.com/docs/connectors/building/review-criteria
// - Anthropic Software Directory Policy (sections 2 and 5)
//   https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy
// - OpenAI Apps SDK: App submission guidelines
//   https://developers.openai.com/apps-sdk/app-submission-guidelines
// - OpenAI Apps SDK: Reference, per-tool securitySchemes (read 1 October 2026)
//   https://developers.openai.com/apps-sdk/reference
// - MCP specification 2026-07-28 (current; moved from 2025-11-25 on 24 Oct 2026, the cited text
//   on tool names, annotations and ToolAnnotations is unchanged there): Tools, and the schema
//   https://modelcontextprotocol.io/specification/2026-07-28/server/tools
//   https://modelcontextprotocol.io/specification/2026-07-28/schema#toolannotations

export type Directory = "claude" | "chatgpt" | "gemini";

export type Source = { id: string; title: string; url: string };

export const SOURCES = {
  claudeSubmission: {
    id: "claude-submission",
    title: "Claude: Submit a connector to the directory",
    url: "https://claude.com/docs/connectors/building/submission",
  },
  claudeReview: {
    id: "claude-review",
    title: "Claude: Connector pre-submission checklist",
    url: "https://claude.com/docs/connectors/building/review-criteria",
  },
  claudePolicy: {
    id: "claude-policy",
    title: "Anthropic Software Directory Policy",
    url: "https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy",
  },
  openai: {
    id: "openai-submission",
    title: "OpenAI Apps SDK: App submission guidelines",
    url: "https://developers.openai.com/apps-sdk/app-submission-guidelines",
  },
  openaiAuth: {
    id: "openai-auth",
    title: "OpenAI Apps SDK: Reference (tool securitySchemes)",
    url: "https://developers.openai.com/apps-sdk/reference",
  },
  // Google Connected Apps (Gemini), read 31 Oct 2026.
  googleMcp: {
    id: "google-mcp",
    title: "Google: Build a connected app with an MCP server",
    url: "https://developers.google.com/connected-apps/mcp",
  },
  mcpTools: {
    id: "mcp-tools",
    title: "MCP specification: Tools",
    url: "https://modelcontextprotocol.io/specification/2026-07-28/server/tools",
  },
  mcpAnnotations: {
    id: "mcp-annotations",
    title: "MCP specification: ToolAnnotations",
    url: "https://modelcontextprotocol.io/specification/2026-07-28/schema#toolannotations",
  },
  product: {
    id: "product",
    title: "Advice, not a directory rule",
    url: "",
  },
} as const satisfies Record<string, Source>;
