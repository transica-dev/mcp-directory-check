# MCP directory check

Check a remote MCP server against ChatGPT's and Claude's published directory rules, before you submit.

```
npx mcp-directory-check https://example.com/mcp
```

It reads your server the way a reviewer's first automated pass would: `initialize`, `tools/list` and public metadata. It never calls a tool, never signs in and sends no credentials. It has no runtime dependencies.

A clean result isn't approval. Directories also review privacy, policy and sign-in with a real account, and test every tool live.

## What it checks

| Area | Checks |
|---|---|
| Connection | HTTPS, a response at the address, MCP `initialize` over Streamable HTTP |
| Sign-in | 401 with `WWW-Authenticate`, protected-resource metadata, authorization server metadata, PKCE with S256, client registration |
| Domain | OpenAI's challenge file at `/.well-known/openai-apps-challenge` |
| Tools | Titles, annotations, names, descriptions, input schemas, and whether hints match what a tool says it does |

Each result links to the published rule it comes from. Servers that need sign-in before `tools/list` get the connection and sign-in checks only.

## Options

| Option | What it does |
|---|---|
| `--directory chatgpt\|claude` | Only rules for one directory |
| `--fail-on fail\|warn` | What sets exit code 1 (default `fail`) |
| `--json` | The full report as JSON |
| `--verbose` | List passed checks too |
| `--allow-localhost` | Allow `http` on localhost, for local development |

Exit codes: `0` passed, `1` found problems, `2` couldn't run.

## GitHub Action

```yaml
- uses: transica-dev/mcp-directory-check@v0
  with:
    url: https://example.com/mcp
    # directory: claude
    # fail-on: warn
```

## Use it as a library

```ts
import { checkMcpServer, publicFetch } from "mcp-directory-check";

const report = await checkMcpServer("https://example.com/mcp", { guard: publicFetch() });
console.log(report.byDirectory);
```

## Badge

If your server passes, you can show it:

```md
[![MCP directory check](https://img.shields.io/badge/MCP%20directory%20check-passed-5fd0a8)](https://github.com/transica-dev/mcp-directory-check)
```

## Rules change

Directories update their rules often. The date each rule was read is in the report's `rubric` field. If a rule is out of date, please open an issue with a link to the source.

## In your browser

[transica.dev/tools/mcp-directory-check](https://transica.dev/tools/mcp-directory-check) runs the same check with no install. It's built by [Transica](https://transica.dev), which builds, hosts and lists MCP apps for ChatGPT and Claude.

## License

MIT
