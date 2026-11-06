// The published documents each directory rule comes from, read on 2 October 2026. Directories change their rules monthly: re-read these before relying on
// a rule, and bump RUBRIC in ./index.ts when a rule changes.

export type Directory = "chatgpt" | "claude" | "gemini";
export const DIRECTORIES: readonly Directory[] = ["chatgpt", "claude", "gemini"];
export const DIRECTORY_NAME: Record<Directory, string> = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini" };

export type Source = { id: string; title: string; url: string };

export const SOURCES = {
  openaiSubmission: {
    id: "openai-submission",
    title: "OpenAI: Upload and submit your plugin",
    url: "https://developers.openai.com/plugins/deploy/submission",
  },
  openaiReview: {
    id: "openai-review",
    title: "OpenAI: Remote MCP server review requirements",
    url: "https://developers.openai.com/plugins/deploy/app-review",
  },
  openaiGuidelines: {
    id: "openai-guidelines",
    title: "OpenAI: App submission guidelines",
    url: "https://developers.openai.com/apps-sdk/app-submission-guidelines",
  },
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
  claudeListing: {
    id: "claude-listing",
    title: "Claude: Manage your directory listing",
    url: "https://claude.com/docs/connectors/building/managing-your-listing",
  },
  claudeAfterPublishing: {
    id: "claude-after-publishing",
    title: "Claude: After publishing",
    url: "https://claude.com/docs/connectors/building/after-publishing",
  },
  claudeDirectory: {
    id: "claude-directory",
    title: "Claude: Connectors directory",
    url: "https://claude.com/docs/connectors/directory",
  },
  // Google Connected Apps (Gemini), read 31 Oct 2026.
  googleOverview: {
    id: "google-overview",
    title: "Google: Connected Apps overview",
    url: "https://developers.google.com/connected-apps",
  },
  googleMcp: {
    id: "google-mcp",
    title: "Google: Build a connected app with an MCP server",
    url: "https://developers.google.com/connected-apps/mcp",
  },
  googleOauth: {
    id: "google-oauth",
    title: "Google: OAuth for connected apps",
    url: "https://developers.google.com/connected-apps/mcp/oauth",
  },
  googlePrerequisites: {
    id: "google-prerequisites",
    title: "Google Connected Console: Prerequisites",
    url: "https://developers.google.com/connected-apps/gpc/prerequisites",
  },
  googleConsole: {
    id: "google-console",
    title: "Google Connected Console: Perform the steps",
    url: "https://developers.google.com/connected-apps/gpc/perform-the-steps",
  },
  googlePolicy: {
    id: "google-policy",
    title: "Google: Connected Apps policy",
    url: "https://developers.google.com/connected-apps/connected-apps-policy",
  },
  // Kept on 2025-11-25 (24 Oct 2026): the 2026-07-28 authorization page is split into subpages and
  // no longer carries the PKCE S256 and 401 discovery text these sign-in rules cite.
  mcpAuth: {
    id: "mcp-auth",
    title: "MCP specification: Authorization",
    url: "https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization",
  },
} as const satisfies Record<string, Source>;
